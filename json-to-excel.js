/**
 * json-to-excel.js
 *
 * Converts data.json → students.xlsx so you can edit it in Excel
 * (add the Class column, fix marks, etc.) then re-import with:
 *
 *   node import-to-supabase.js students.xlsx
 *
 * Usage:
 *   node json-to-excel.js                        → reads data.json,    writes students.xlsx
 *   node json-to-excel.js myfile.json            → reads myfile.json,  writes students.xlsx
 *   node json-to-excel.js myfile.json out.xlsx   → reads myfile.json,  writes out.xlsx
 *
 * Requirements (already installed):
 *   npm install xlsx
 */

const XLSX = require("xlsx");
const fs   = require("fs");
const path = require("path");

/* ── Args ────────────────────────────────────────────────────── */
const inputFile  = path.resolve(process.argv[2] || "data.json");
const outputFile = path.resolve(process.argv[3] || "students.xlsx");

/* ── Read JSON ───────────────────────────────────────────────── */
if (!fs.existsSync(inputFile)) {
  console.error(`❌  File not found: ${inputFile}`);
  process.exit(1);
}

let records;
try {
  records = JSON.parse(fs.readFileSync(inputFile, "utf8"));
} catch (e) {
  console.error(`❌  Failed to parse JSON: ${e.message}`);
  process.exit(1);
}

if (!Array.isArray(records) || records.length === 0) {
  console.error("❌  data.json must be a non-empty JSON array.");
  process.exit(1);
}

console.log(`📂  Read ${records.length} records from ${inputFile}`);

/* ── Ensure consistent column order ─────────────────────────────
   Puts Class right after Name so it's easy to fill in Excel.
   Any extra columns in the JSON are appended at the end.
────────────────────────────────────────────────────────────────*/
const PREFERRED_ORDER = [
  "ID", "Name", "Class",
  "Attendance", "Activities", "Midterm", "Project", "Bonus", "Total",
];

/* Collect all unique keys across all records */
const allKeys = Array.from(
  new Set(records.flatMap(r => Object.keys(r)))
);

/* Build final column order: preferred first, then any extras */
const extras      = allKeys.filter(k => !PREFERRED_ORDER.includes(k));
const columnOrder = [
  ...PREFERRED_ORDER.filter(k => allKeys.includes(k) || k === "Class"),
  ...extras,
];

/* Normalise every record to the full column order */
const normalised = records.map(row => {
  const out = {};
  columnOrder.forEach(col => {
    /* Case-insensitive match for incoming keys */
    const matchingKey = Object.keys(row).find(
      k => k.toLowerCase() === col.toLowerCase()
    );
    out[col] = matchingKey !== undefined ? row[matchingKey] : null;
  });
  return out;
});

/* ── Build workbook ──────────────────────────────────────────── */
const worksheet = XLSX.utils.json_to_sheet(normalised, { header: columnOrder });

/* ── Column widths (makes the sheet readable immediately) ─────── */
const COL_WIDTHS = {
  ID:         12,
  Name:       30,
  Class:      10,
  Attendance: 14,
  Activities: 14,
  Midterm:    14,
  Project:    14,
  Bonus:      10,
  Total:      10,
};

worksheet["!cols"] = columnOrder.map(col => ({
  wch: COL_WIDTHS[col] || Math.max(col.length + 2, 12),
}));

/* ── Freeze the header row so it stays visible while scrolling ── */
worksheet["!freeze"] = { xSplit: 0, ySplit: 1 };

const workbook = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(workbook, worksheet, "Students");

/* ── Write file ──────────────────────────────────────────────── */
XLSX.writeFile(workbook, outputFile);

console.log(`✅  Excel file written to: ${outputFile}`);
console.log(`\n📝  Next steps:`);
console.log(`    1. Open ${path.basename(outputFile)} in Excel`);
console.log(`    2. Fill in the "Class" column for every student`);
console.log(`       (e.g. BIS  or  CS)`);
console.log(`    3. Save the file`);
console.log(`    4. Re-import:  node import-to-supabase.js ${path.basename(outputFile)}\n`);
