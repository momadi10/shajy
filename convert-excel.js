/**
 * Convert the first sheet of an Excel file to data.json.
 * Usage: node convert-excel.js [input.xlsx] [output.json]
 *
 * Requires: npm install exceljs
 */
const fs = require("fs");
const ExcelJS = require("exceljs");

const inputFile = process.argv[2] || "marks.xlsx";
const outputFile = process.argv[3] || "data.json";

const CANONICAL_HEADERS = {
  id: "ID",
  name: "Name",
  attendance: "Attendance",
  activities: "Activities",
  midterm: "Midterm",
  project: "Project",
  bonus: "Bonus",
  total: "Total",
};

function cellToText(value) {
  if (value == null || value === "") return "";
  if (typeof value === "object") {
    if (value.result != null && value.result !== "") return value.result;
    if (value.text != null) return value.text;
    if (value.richText) {
      return value.richText.map(function (part) {
        return part.text || "";
      }).join("");
    }
    if (value instanceof Date) return value.toISOString().slice(0, 10);
  }
  return value;
}

function normalizeHeader(text) {
  return String(text).trim().toLowerCase();
}

function findHeaderRow(sheet) {
  var maxScan = Math.min(sheet.actualRowCount || sheet.rowCount || 20, 20);
  for (var r = 1; r <= maxScan; r++) {
    var row = sheet.getRow(r);
    var foundId = false;
    row.eachCell({ includeEmpty: false }, function (cell, col) {
      var text = String(cellToText(cell.value)).trim().toLowerCase();
      if (text === "id" || text === "student id" || text === "studentid") {
        foundId = true;
      }
    });
    if (foundId) return r;
  }
  return 1;
}

function buildHeaderMap(sheet, headerRowIndex) {
  var map = {};
  var row = sheet.getRow(headerRowIndex);
  row.eachCell({ includeEmpty: true }, function (cell, col) {
    var raw = String(cellToText(cell.value)).trim();
    if (!raw) return;
    var key = normalizeHeader(raw);
    var canonical = CANONICAL_HEADERS[key] || raw;
    map[col] = canonical;
  });
  return map;
}

function normalizeValue(key, value) {
  if (value == null || value === "") {
    return key === "Bonus" ? null : value;
  }

  if (key === "ID") {
    return String(value).trim();
  }

  if (typeof value === "string") {
    var trimmed = value.trim();
    if (trimmed === "?" || trimmed === "-" || trimmed === "—") return null;
    var num = Number(trimmed);
    if (trimmed !== "" && !Number.isNaN(num)) return num;
    return trimmed;
  }

  return value;
}

async function convert() {
  if (!fs.existsSync(inputFile)) {
    console.error("File not found:", inputFile);
    process.exit(1);
  }

  var workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(inputFile);

  var sheet = workbook.worksheets[0];
  if (!sheet) {
    console.error("No worksheet found in", inputFile);
    process.exit(1);
  }

  var headerRowIndex = findHeaderRow(sheet);
  var headerMap = buildHeaderMap(sheet, headerRowIndex);

  var idColumn = null;
  Object.keys(headerMap).forEach(function (col) {
    if (headerMap[col] === "ID") idColumn = Number(col);
  });

  if (!idColumn) {
    console.error(
      "Could not find an 'ID' column in row",
      headerRowIndex + ".",
      "Check that the first row (or the row with headers) includes a column named ID."
    );
    process.exit(1);
  }

  var rows = [];
  var lastRow = sheet.actualRowCount || sheet.rowCount || 0;

  for (var rowNumber = headerRowIndex + 1; rowNumber <= lastRow; rowNumber++) {
    var row = sheet.getRow(rowNumber);
    if (!row || row.cellCount === 0) continue;

    var record = {};
    row.eachCell({ includeEmpty: true }, function (cell, col) {
      var key = headerMap[col];
      if (!key) return;
      record[key] = normalizeValue(key, cellToText(cell.value));
    });

    var id = record.ID;
    if (id == null || String(id).trim() === "") continue;

    rows.push(record);
  }

  fs.writeFileSync(outputFile, JSON.stringify(rows, null, 2));
  console.log(
    "Wrote",
    rows.length,
    "records to",
    outputFile,
    "(header row:",
    headerRowIndex + ")"
  );

  if (rows.length === 0) {
    console.warn(
      "\nNo data rows found. Common causes:\n" +
        "  • Headers are not in the first row (we scan the first 20 rows for 'ID')\n" +
        "  • ID column is empty for all students\n" +
        "  • File is open in Excel — save and close it, then run again\n"
    );
  }
}

convert().catch(function (err) {
  console.error(err.message || err);
  process.exit(1);
});
