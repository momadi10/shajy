/**
 * Student Marks Portal — script.js
 *
 * Fetches student records from the Supabase `students` table.
 * Falls back gracefully if Supabase is not yet configured.
 *
 * The only thing that changed from the original version is loadData():
 * instead of fetch("data.json") it queries Supabase. All search,
 * display, and logging logic is identical to before.
 */
(function () {
  "use strict";

  /* ── Supabase client ────────────────────────────────────────
     Initialised from config.js (loaded before this script).
     _sb is null when credentials are still the placeholder values.
  ─────────────────────────────────────────────────────────── */
  let _sb = null;
  try {
    if (
      typeof APP_CONFIG !== "undefined" &&
      APP_CONFIG.supabaseUrl &&
      !APP_CONFIG.supabaseUrl.includes("YOUR_PROJECT_ID") &&
      APP_CONFIG.supabaseKey &&
      !APP_CONFIG.supabaseKey.includes("YOUR_ANON_KEY")
    ) {
      _sb = supabase.createClient(APP_CONFIG.supabaseUrl, APP_CONFIG.supabaseKey);
    }
  } catch (_) {}

  /* ── Log a successful lookup to access_logs ─────────────── */
  function logAccess(studentId, studentName) {
    if (!_sb) return;
    _sb.from("access_logs")
      .insert({ student_id: String(studentId), student_name: String(studentName) })
      .then(function (res) {
        if (res.error) console.warn("[log]", res.error.message);
      })
      .catch(function () {});
  }

  /* ── Constants ──────────────────────────────────────────── */
  /* Map display field names → Supabase column names */
  const FIELDS = [
    { label: "Attendance", col: "attendance" },
    { label: "Activities", col: "activities" },
    { label: "Midterm",    col: "midterm"    },
    { label: "Project",    col: "project"    },
    { label: "Bonus",      col: "bonus"      },
    { label: "Total",      col: "total"      },
  ];

  /* ── DOM refs ────────────────────────────────────────────── */
  const form          = document.getElementById("search-form");
  const input         = document.getElementById("student-id");
  const searchBtn     = document.getElementById("search-btn");
  const statusEl      = document.getElementById("status");
  const statusMsgEl   = document.getElementById("status-message");
  const resultsEl     = document.getElementById("results");

  /* ── State ───────────────────────────────────────────────── */
  let students  = [];   // full roster cached after first load
  let dataReady = false;

  /* ── Helpers ─────────────────────────────────────────────── */
  function normalizeId(value) {
    return String(value).trim().toLowerCase();
  }

  /**
   * Find a student in the cached array.
   * Works with both the original JSON shape {ID, Name, Attendance…}
   * and the Supabase shape {student_id, name, attendance…}.
   */
  function findStudent(id) {
    const needle = normalizeId(id);
    return students.find(function (s) {
      const sid = s.student_id !== undefined ? s.student_id : s.ID;
      return sid != null && normalizeId(sid) === needle;
    });
  }

  /* ── Status helpers ──────────────────────────────────────── */
  function showStatus(message, type, options) {
    options = options || {};
    statusMsgEl.textContent = message;
    statusEl.className = "alert alert--" + type;
    if (options.variant) statusEl.classList.add("alert--" + options.variant);
    statusEl.hidden = false;
    statusEl.setAttribute("role",     type === "loading" ? "status" : "alert");
    statusEl.setAttribute("aria-live", type === "loading" ? "polite" : "assertive");

    if (options.highlightInput) {
      input.setAttribute("aria-invalid", "true");
      input.classList.add("search__input--invalid");
    } else {
      input.removeAttribute("aria-invalid");
      input.classList.remove("search__input--invalid");
    }
  }

  function hideStatus() {
    statusEl.hidden = true;
    statusMsgEl.textContent = "";
    statusEl.className = "alert";
    statusEl.setAttribute("role",     "alert");
    statusEl.setAttribute("aria-live", "assertive");
    input.removeAttribute("aria-invalid");
    input.classList.remove("search__input--invalid");
  }

  /* ── Display result ──────────────────────────────────────── */
  /* ── Class-based grading schemes ────────────────────────────
     Add more entries here if you add more classes in the future.
  ─────────────────────────────────────────────────────────── */
  var CLASS_LABELS = {
    "BIS": { activities: "Activities (10%)", project: "Project (20%)" },
  };
  var DEFAULT_LABELS = { activities: "Activities (5%)",  project: "Project (25%)" };

  function updateClassLabels(studentClass) {
    var scheme  = (studentClass && CLASS_LABELS[studentClass.toUpperCase()])
                  ? CLASS_LABELS[studentClass.toUpperCase()]
                  : DEFAULT_LABELS;
    var elAct  = document.getElementById("label-activities");
    var elProj = document.getElementById("label-project");
    if (elAct)  elAct.textContent  = scheme.activities;
    if (elProj) elProj.textContent = scheme.project;
  }

  function showResults(student, searchedId) {
    /* Support both Supabase column names and original JSON keys */
    const name      = student.name       !== undefined ? student.name       : student.Name;
    const id        = student.student_id !== undefined ? student.student_id : student.ID;
    const classVal  = student.class_name !== undefined ? student.class_name : student.Class;

    document.getElementById("result-name").textContent = name != null ? String(name) : "—";
    document.getElementById("result-id").textContent   = id   != null ? String(id)   : searchedId;

    /* DEBUG — remove once class labels work */
    console.log("[Portal] student raw:", student);
    console.log("[Portal] classVal:", classVal);

    /* Update Activities / Project labels for this student's class */
    updateClassLabels(classVal);

    FIELDS.forEach(function (f) {
      const el    = document.getElementById("mark-" + f.label.toLowerCase());
      if (!el) return;
      /* Try Supabase column name first, then original JSON key */
      const value = student[f.col] !== undefined ? student[f.col] : student[f.label];
      el.textContent = value != null && value !== "" ? String(value) : "—";
    });

    resultsEl.hidden = false;
    var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    resultsEl.scrollIntoView({
      behavior: reduceMotion ? "auto" : "smooth",
      block: "nearest",
    });

    /* Log the successful lookup */
    logAccess(
      id   != null ? id   : searchedId,
      name != null ? name : "Unknown"
    );
  }

  /* ── Search handler ──────────────────────────────────────── */
  function handleSearch() {
    hideStatus();
    resultsEl.hidden = true;

    if (!dataReady) {
      showStatus("Marks data is still loading. Please try again in a moment.", "error");
      return;
    }

    const rawId = input.value.trim();
    if (!rawId) {
      showStatus("Please enter your student ID.", "error", {
        variant: "empty",
        highlightInput: true,
      });
      input.focus();
      return;
    }

    const student = findStudent(rawId);
    if (!student) {
      showStatus(
        'No record found for ID "' + rawId + '". Please check your ID and try again.',
        "error"
      );
      input.focus();
      return;
    }

    showResults(student, rawId);
  }

  /* ── Load data from Supabase (or fall back to data.json) ─── */
  function loadData() {
    showStatus("Loading marks…", "loading");
    searchBtn.disabled = true;

    /* ── Path A: Supabase ── */
    if (_sb) {
      _sb
        .from("students")
        .select("student_id, name, class_name, attendance, activities, midterm, project, bonus, total")
        .then(function (res) {
          if (res.error) throw new Error(res.error.message);
          if (!Array.isArray(res.data) || res.data.length === 0) {
            throw new Error(
              "The students table is empty. Run import-to-supabase.js first."
            );
          }
          students  = res.data;
          dataReady = true;
          hideStatus();
          console.log("[Portal] Loaded " + students.length + " students from Supabase.");
        })
        .catch(function (err) {
          dataReady = false;
          showStatus(
            "Could not load marks from Supabase: " + (err.message || "Unknown error."),
            "error"
          );
          console.error("[Portal]", err);
        })
        .finally(function () {
          searchBtn.disabled = false;
          input.focus();
        });
      return;
    }

    /* ── Path B: local data.json fallback ── */
    console.warn("[Portal] Supabase not configured — falling back to data.json");
    fetch("data.json")
      .then(function (response) {
        if (!response.ok) throw new Error("HTTP " + response.status);
        return response.json();
      })
      .then(function (data) {
        if (!Array.isArray(data)) throw new Error("data.json must be a JSON array.");
        students  = data;
        dataReady = true;
        hideStatus();
        console.log("[Portal] Loaded " + students.length + " students from data.json.");
      })
      .catch(function (err) {
        dataReady = false;
        showStatus(
          "Failed to load marks. Configure Supabase in config.js or ensure data.json exists. " +
            (err.message || ""),
          "error"
        );
      })
      .finally(function () {
        searchBtn.disabled = false;
        input.focus();
      });
  }

  /* ── Event listeners ─────────────────────────────────────── */
  form.addEventListener("submit", function (event) {
    event.preventDefault();
    handleSearch();
  });

  input.addEventListener("input", function () {
    if (input.value.trim()) {
      input.removeAttribute("aria-invalid");
      input.classList.remove("search__input--invalid");
    }
  });

  /* ── Boot ────────────────────────────────────────────────── */
  loadData();

})();
