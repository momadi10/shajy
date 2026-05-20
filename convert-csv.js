/**
 * Convert a CSV export to data.json (no npm packages required).
 * In Excel: File → Save As → CSV UTF-8.
 * Usage: node convert-csv.js [input.csv] [output.json]
 */
const fs = require("fs");

const inputFile = process.argv[2] || "marks.csv";
const outputFile = process.argv[3] || "data.json";

function parseCsvLine(line) {
  const values = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      values.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  values.push(current.trim());
  return values;
}

if (!fs.existsSync(inputFile)) {
  console.error("File not found:", inputFile);
  process.exit(1);
}

const text = fs.readFileSync(inputFile, "utf8").replace(/^\uFEFF/, "");
const lines = text.split(/\r?\n/).filter(function (line) {
  return line.trim().length > 0;
});

if (lines.length < 2) {
  console.error("CSV must have a header row and at least one data row.");
  process.exit(1);
}

const headers = parseCsvLine(lines[0]);
const rows = lines.slice(1).map(function (line) {
  const cells = parseCsvLine(line);
  const record = {};
  headers.forEach(function (header, i) {
    if (!header) return;
    const raw = cells[i] != null ? cells[i] : "";
    const num = Number(raw);
    record[header] = raw !== "" && !Number.isNaN(num) && /^-?\d+(\.\d+)?$/.test(raw) ? num : raw;
  });
  return record;
});

fs.writeFileSync(outputFile, JSON.stringify(rows, null, 2));
console.log("Wrote", rows.length, "records to", outputFile);
