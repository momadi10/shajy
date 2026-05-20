/**
 * ╔═══════════════════════════════════════════════════════════╗
 * ║       Import Student Marks → Supabase                     ║
 * ║                                                           ║
 * ║  Run once (or any time you update marks):                 ║
 * ║    node import-to-supabase.js              (from JSON)    ║
 * ║    node import-to-supabase.js marks.xlsx   (from Excel)   ║
 * ║                                                           ║
 * ║  Requirements:                                            ║
 * ║    npm install @supabase/supabase-js xlsx dotenv          ║
 * ║                                                           ║
 * ║  Create a .env file (or edit the CONFIG block below):     ║
 * ║    SUPABASE_URL=https://xxxx.supabase.co                  ║
 * ║    SUPABASE_SERVICE_KEY=your_service_role_key             ║
 * ║                                                           ║
 * ║  ⚠  Use the SERVICE ROLE key here (not the anon key),    ║
 * ║     since this script runs only on your machine and        ║
 * ║     needs write access.                                   ║
 * ╚═══════════════════════════════════════════════════════════╝
 *
 * SQL to run in Supabase BEFORE importing:
 * ─────────────────────────────────────────────────────────────
 *
 *   CREATE TABLE students (
 *     id          BIGSERIAL PRIMARY KEY,
 *     student_id  TEXT UNIQUE NOT NULL,
 *     name        TEXT,
 *     class_name  TEXT,
 *     attendance  NUMERIC,
 *     activities  NUMERIC,
 *     midterm     NUMERIC,
 *     project     NUMERIC,
 *     bonus       NUMERIC,
 *     total       NUMERIC
 *   );
 *
 *   -- Allow the anon key (used by the web portal) to read
 *   ALTER TABLE students ENABLE ROW LEVEL SECURITY;
 *   CREATE POLICY "public read" ON students FOR SELECT USING (true);
 *
 * ─────────────────────────────────────────────────────────────
 */

require("dotenv").config();
const { createClient } = require("@supabase/supabase-js");
const XLSX             = require("xlsx");
const fs               = require("fs");
const path             = require("path");

/* ── CONFIG — edit here OR use a .env file ──────────────────── */
const SUPABASE_URL         = process.env.SUPABASE_URL         || "https://YOUR_PROJECT_ID.supabase.co";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || "YOUR_SERVICE_ROLE_KEY";
const DEFAULT_JSON_FILE    = "data.json";   // fallback if no Excel is given
/* ─────────────────────────────────────────────────────────────── */

if (
  SUPABASE_URL.includes("YOUR_PROJECT_ID") ||
  SUPABASE_SERVICE_KEY.includes("YOUR_SERVICE_ROLE_KEY")
) {
  console.error("❌  Please set SUPABASE_URL and SUPABASE_SERVICE_KEY (in .env or in this file).");
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

/* ── Read source data ───────────────────────────────────────── */
function loadRecords() {
  const arg = process.argv[2];

  // Excel file supplied
  if (arg && (arg.endsWith(".xlsx") || arg.endsWith(".xls"))) {
    const filePath = path.resolve(arg);
    if (!fs.existsSync(filePath)) {
      console.error(`❌  File not found: ${filePath}`);
      process.exit(1);
    }
    console.log(`📂  Reading Excel: ${filePath}`);
    const wb    = XLSX.readFile(filePath);
    const sheet = wb.Sheets[wb.SheetNames[0]];
    return XLSX.utils.sheet_to_json(sheet, { defval: null });
  }

  // JSON file (default)
  const jsonPath = path.resolve(arg || DEFAULT_JSON_FILE);
  if (!fs.existsSync(jsonPath)) {
    console.error(`❌  File not found: ${jsonPath}`);
    process.exit(1);
  }
  console.log(`📂  Reading JSON: ${jsonPath}`);
  return JSON.parse(fs.readFileSync(jsonPath, "utf8"));
}

/* ── Normalise one raw record → DB row ──────────────────────── */
function normalise(raw) {
  function get(obj, key) {
    const lower = key.toLowerCase();
    const found = Object.keys(obj).find(k => k.toLowerCase() === lower);
    return found !== undefined ? obj[found] : null;
  }

  const num = v => {
    if (v === null || v === undefined || v === "") return null;
    const n = Number(v);
    return isNaN(n) ? null : n;
  };

  const sid = String(get(raw, "ID") ?? "").trim();
  if (!sid) return null;   // skip rows without an ID

  return {
    student_id: sid,
    name:       String(get(raw, "Name")  ?? "").trim() || null,
    class_name: String(get(raw, "Class") ?? "").trim() || null,
    attendance: num(get(raw, "Attendance")),
    activities: num(get(raw, "Activities")),
    midterm:    num(get(raw, "Midterm")),
    project:    num(get(raw, "Project")),
    bonus:      num(get(raw, "Bonus")),
    total:      num(get(raw, "Total")),
  };
}

/* ── Upload in batches ──────────────────────────────────────── */
async function run() {
  const raw     = loadRecords();
  const records = raw.map(normalise).filter(Boolean);

  console.log(`📋  ${records.length} records parsed from source.`);

  // Deduplicate by student_id — Postgres rejects a batch that
  // tries to upsert the same conflict key more than once.
  const seen = new Map();
  records.forEach(r => seen.set(r.student_id, r));
  const deduped = Array.from(seen.values());

  if (deduped.length < records.length) {
    console.warn(`⚠   Removed ${records.length - deduped.length} duplicate ID(s). Uploading ${deduped.length} unique records.`);
  } else {
    console.log(`✅  ${deduped.length} unique records ready for import.`);
  }

  const BATCH = 50;
  let inserted = 0;
  let errors   = 0;

  for (let i = 0; i < deduped.length; i += BATCH) {
    const batch = deduped.slice(i, i + BATCH);
    const { data, error } = await sb
      .from("students")
      .upsert(batch, { onConflict: "student_id", ignoreDuplicates: false })
      .select("student_id");

    if (error) {
      console.error(`  ❌  Batch ${i / BATCH + 1} error:`, error.message);
      errors += batch.length;
    } else {
      const count = data?.length ?? batch.length;
      inserted += count;
      console.log(`  ✓  Batch ${i / BATCH + 1}: ${count} rows upserted`);
    }
  }

  console.log("\n─────────────────────────────────────");
  console.log(`  Total parsed  : ${records.length}`);
  console.log(`  Unique records: ${deduped.length}`);
  console.log(`  Imported      : ${inserted}`);
  if (errors) console.log(`  Failed        : ${errors}`);
  console.log("─────────────────────────────────────");
  if (errors === 0) {
    console.log("✅  All records imported successfully!\n");
  } else {
    console.log("⚠   Import finished with errors. Check output above.\n");
  }
}

run().catch(err => {
  console.error("Fatal:", err.message);
  process.exit(1);
});
