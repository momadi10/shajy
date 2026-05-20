# Continuous Assessment Marks Viewer

Static site for students to look up continuous assessment marks by student ID. All data lives in `data.json`; no backend required. Deploy on Vercel or any static host.

## Files

| File        | Purpose                                      |
|-------------|----------------------------------------------|
| `index.html`| Page structure and form                      |
| `style.css` | Layout and styling                           |
| `script.js` | Load `data.json`, search by ID               |
| `data.json` | Student records (replace with your data)     |

## 1. Convert Excel to JSON

Your spreadsheet should have one row per student and columns matching the app (case-insensitive headers are fine):

`ID`, `Name`, `Attendance`, `Activities`, `Midterm`, `Project`, `Bonus`, `Total`

### Option A — Online converter

1. Export or save your sheet as `.xlsx` or `.csv`.
2. Use a converter such as [ConvertCSV](https://www.convertcsv.com/csv-to-json.htm) or [TableConvert](https://tableconvert.com/excel-to-json).
3. Choose **array of objects** (not nested by sheet name unless you extract the array).
4. Download the result and save it as `data.json` in this folder, replacing the sample file.

### Option B — Node.js + ExcelJS (recommended for `.xlsx`)

The old `xlsx` (SheetJS) package on npm has **known high-severity advisories with no fix**. Do not use it. This project includes `convert-excel.js` using **[exceljs](https://www.npmjs.com/package/exceljs)** instead.

1. Install [Node.js](https://nodejs.org/).
2. In this folder, run:

   ```bash
   npm install
   ```

   (Installs `exceljs` from `package.json` as a dev tool only — it is **not** used by the website.)

3. Put your spreadsheet in this folder as `marks.xlsx`, then run:

   ```bash
   npm run convert
   ```

   Or with custom paths:

   ```bash
   node convert-excel.js "C:\path\to\marks.xlsx" data.json
   ```

4. If you previously installed `xlsx`, remove it:

   ```bash
   npm uninstall xlsx
   ```

5. Upload or commit the updated `data.json` when you redeploy.

### Option C — CSV + Node (no npm packages)

Avoids npm audit issues entirely.

1. In Excel: **File → Save As → CSV UTF-8** → save as `marks.csv`.
2. Run (Node.js only, no `npm install`):

   ```bash
   node convert-csv.js marks.csv data.json
   ```

   Or: `npm run convert:csv` if you already ran `npm install` for Option B.

**Example `data.json` structure:**

```json
[
  {
    "ID": "S001",
    "Name": "Alice Johnson",
    "Attendance": 9,
    "Activities": 24,
    "Midterm": 16,
    "Project": 19,
    "Bonus": 2,
    "Total": 60
  }
]
```

## 2. Test locally

`fetch()` needs a real HTTP server (opening `index.html` as a `file://` URL will block loading `data.json`).

**Python (if installed):**

```bash
cd path/to/this/folder
python -m http.server 8080
```

Open [http://localhost:8080](http://localhost:8080). Try IDs `S001` and `S002`, and an invalid ID to see the error message.

**Node.js alternative:**

```bash
npx serve .
```

Then open the URL shown in the terminal.

After the first successful load, the browser may cache `data.json` for offline use on repeat visits.

## 3. Deploy to Vercel

### Via GitHub

1. Push this folder to a GitHub repository.
2. Sign in at [vercel.com](https://vercel.com) and **Add New Project**.
3. Import the repo. Framework preset: **Other** (no build command).
4. Root directory: project root. Output: static files (default).
5. Deploy. Vercel serves `index.html`, `style.css`, `script.js`, and `data.json`.

To update marks: regenerate `data.json`, commit, and push; Vercel redeploys automatically.

### Direct upload

1. Zip the project folder (include all four main files).
2. In the Vercel dashboard, create a project and use **Deploy** without Git, or use the Vercel CLI:

   ```bash
   npm i -g vercel
   vercel
   ```

3. Follow prompts and deploy the directory.

No environment variables or build step are required.

## Notes

- IDs are matched as strings (e.g. `S001` and `s001` both work).
- Field names in JSON are matched case-insensitively (`ID` / `id`, `Name` / `name`, etc.).
- Press **Enter** in the ID field to search.
