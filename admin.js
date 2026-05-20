/**
 * Admin Dashboard — admin.js
 *
 * Data sources (both from Supabase):
 *   • students     table  →  full roster for "Not Checked" report
 *   • access_logs  table  →  every lookup event
 *
 * Features:
 *   • Password-protected login (sessionStorage)
 *   • Stats bar (total lookups / unique / never checked / roster size)
 *   • Tab 1 — Live Log      : every access_log row, paginated + filterable
 *   • Tab 2 — Checked       : unique students grouped, sorted by lookup count
 *   • Tab 3 — Not Checked   : roster rows with zero log entries
 */
(function () {
  "use strict";

  /* ── Config ─────────────────────────────────────────────── */
  const CFG   = (typeof APP_CONFIG !== "undefined") ? APP_CONFIG : {};
  const SB_OK =
    CFG.supabaseUrl  && !CFG.supabaseUrl.includes("YOUR_PROJECT_ID") &&
    CFG.supabaseKey  && !CFG.supabaseKey.includes("YOUR_ANON_KEY");

  let _sb = null;
  if (SB_OK) {
    try { _sb = supabase.createClient(CFG.supabaseUrl, CFG.supabaseKey); }
    catch (_) {}
  }

  /* SHA-256 hash stored in config.js — plain text never lives in source */
  const ADMIN_HASH = (CFG.adminPasswordHash || "").toLowerCase();
  const PAGE_SIZE  = 25;

  /* ── DOM refs ────────────────────────────────────────────── */
  const loginScreen  = document.getElementById("login-screen");
  const dashboard    = document.getElementById("dashboard");
  const adminPwInput = document.getElementById("admin-pw");
  const loginBtn     = document.getElementById("login-btn");
  const loginError   = document.getElementById("login-error");
  const logoutBtn    = document.getElementById("logout-btn");
  const configWarn   = document.getElementById("config-warn");

  const statTotal     = document.getElementById("stat-total");
  const statUnique    = document.getElementById("stat-unique");
  const statUnchecked = document.getElementById("stat-unchecked");
  const statRoster    = document.getElementById("stat-roster");

  /* ── State ───────────────────────────────────────────────── */
  let allLogs    = [];
  let roster     = [];
  let dataLoaded = false;

  const paging  = { log: 1, checked: 1, missing: 1 };
  const filters = { log: "",  checked: "",  missing: "" };

  /* ── Pure-JS SHA-256 ─────────────────────────────────────────
     Self-contained implementation — no browser APIs, works on
     HTTP, file://, all browsers, Vercel, everywhere.
     Returns a Promise<string> so call-sites stay unchanged.
  ─────────────────────────────────────────────────────────── */
  function sha256(str) {
    return new Promise(function (resolve) {
      // Convert string to UTF-8 bytes
      function strToBytes(s) {
        var out = [], i = 0;
        while (i < s.length) {
          var c = s.charCodeAt(i++);
          if (c < 128) { out.push(c); }
          else if (c < 2048) { out.push((c >> 6) | 192, (c & 63) | 128); }
          else { out.push((c >> 12) | 224, ((c >> 6) & 63) | 128, (c & 63) | 128); }
        }
        return out;
      }

      // SHA-256 constants
      var K = [
        0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
        0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
        0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
        0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
        0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
        0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
        0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
        0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2
      ];

      function rotr(x, n) { return (x >>> n) | (x << (32 - n)); }
      function safe_add(x, y) {
        var lsw = (x & 0xffff) + (y & 0xffff);
        return (((x >> 16) + (y >> 16) + (lsw >> 16)) << 16) | (lsw & 0xffff);
      }

      var bytes = strToBytes(str);
      var bitLen = bytes.length * 8;

      // Padding
      bytes.push(0x80);
      while (bytes.length % 64 !== 56) bytes.push(0);
      bytes.push(0,0,0,0);
      bytes.push((bitLen >>> 24)&0xff,(bitLen>>>16)&0xff,(bitLen>>>8)&0xff,bitLen&0xff);

      // Words
      var w = new Array(64);
      var H = [0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19];

      for (var i = 0; i < bytes.length; i += 64) {
        for (var j = 0; j < 16; j++) {
          w[j] = (bytes[i+j*4]<<24)|(bytes[i+j*4+1]<<16)|(bytes[i+j*4+2]<<8)|bytes[i+j*4+3];
        }
        for (var j = 16; j < 64; j++) {
          var s0 = rotr(w[j-15],7)^rotr(w[j-15],18)^(w[j-15]>>>3);
          var s1 = rotr(w[j-2],17)^rotr(w[j-2],19)^(w[j-2]>>>10);
          w[j] = safe_add(safe_add(safe_add(w[j-16],s0),w[j-7]),s1);
        }
        var a=H[0],b=H[1],c=H[2],d=H[3],e=H[4],f=H[5],g=H[6],h=H[7];
        for (var j = 0; j < 64; j++) {
          var S1 = rotr(e,6)^rotr(e,11)^rotr(e,25);
          var ch = (e&f)^(~e&g);
          var temp1 = safe_add(safe_add(safe_add(safe_add(h,S1),ch),K[j]),w[j]);
          var S0 = rotr(a,2)^rotr(a,13)^rotr(a,22);
          var maj = (a&b)^(a&c)^(b&c);
          var temp2 = safe_add(S0,maj);
          h=g; g=f; f=e; e=safe_add(d,temp1);
          d=c; c=b; b=a; a=safe_add(temp1,temp2);
        }
        H[0]=safe_add(H[0],a); H[1]=safe_add(H[1],b);
        H[2]=safe_add(H[2],c); H[3]=safe_add(H[3],d);
        H[4]=safe_add(H[4],e); H[5]=safe_add(H[5],f);
        H[6]=safe_add(H[6],g); H[7]=safe_add(H[7],h);
      }

      resolve(H.map(function(x){
        return ('00000000'+((x>>>0).toString(16))).slice(-8);
      }).join(""));
    });
  }

  /* ── Auth ────────────────────────────────────────────────── */
  /* ── Session auth with 30-minute expiry ─────────────────────
     Stores a timestamp alongside the auth flag. If more than
     30 minutes have passed since login, the session is treated
     as expired and the user is returned to the login screen.
  ─────────────────────────────────────────────────────────── */
  var SESSION_DURATION_MS = 30 * 60 * 1000;   // 30 minutes

  function isLoggedIn() {
    if (sessionStorage.getItem("admin_auth") !== "1") return false;
    var loginTime = parseInt(sessionStorage.getItem("admin_auth_ts") || "0", 10);
    if (Date.now() - loginTime > SESSION_DURATION_MS) {
      sessionStorage.removeItem("admin_auth");
      sessionStorage.removeItem("admin_auth_ts");
      return false;
    }
    return true;
  }

  function touchSession() {
    sessionStorage.setItem("admin_auth_ts", String(Date.now()));
  }

  function showDashboard() {
    loginScreen.style.display = "none";
    dashboard.classList.add("visible");
    if (!SB_OK) configWarn.classList.add("visible");
    if (!dataLoaded) loadAllData();
  }

  function showLogin() {
    loginScreen.style.display = "";
    dashboard.classList.remove("visible");
  }

  if (isLoggedIn()) showDashboard();

  loginBtn.addEventListener("click", doLogin);
  adminPwInput.addEventListener("keydown", function (e) {
    if (e.key === "Enter") doLogin();
  });

  function doLogin() {
    var typed = adminPwInput.value;
    if (!typed) return;

    /* Disable button while hashing to prevent double-submit */
    loginBtn.disabled = true;
    loginBtn.textContent = "Verifying…";

    sha256(typed).then(function (hash) {
      if (hash === ADMIN_HASH) {
        sessionStorage.setItem("admin_auth", "1");
        touchSession();
        loginError.textContent = "";
        adminPwInput.value = "";
        loginBtn.disabled = false;
        loginBtn.textContent = "Sign in";
        showDashboard();
      } else {
        loginError.textContent = "Incorrect password. Please try again.";
        adminPwInput.classList.add("invalid");
        adminPwInput.focus();
        loginBtn.disabled = false;
        loginBtn.textContent = "Sign in";
      }
    }).catch(function (err) {
      console.error("[Admin] Hash error:", err);
      loginError.textContent = "Verification failed. Try again.";
      loginBtn.disabled = false;
      loginBtn.textContent = "Sign in";
    });
  }

  adminPwInput.addEventListener("input", function () {
    adminPwInput.classList.remove("invalid");
    loginError.textContent = "";
  });

  logoutBtn.addEventListener("click", function () {
    sessionStorage.removeItem("admin_auth");
    sessionStorage.removeItem("admin_auth_ts");
    showLogin();
  });

  /* ── Tabs ────────────────────────────────────────────────── */
  document.querySelectorAll(".tab-btn").forEach(function (btn) {
    btn.addEventListener("click", function () {
      touchSession();  // extend session on activity
      document.querySelectorAll(".tab-btn").forEach(function (b) {
        b.classList.remove("active");
        b.setAttribute("aria-selected", "false");
      });
      document.querySelectorAll(".panel").forEach(function (p) {
        p.classList.remove("active");
      });
      btn.classList.add("active");
      btn.setAttribute("aria-selected", "true");
      document.getElementById("panel-" + btn.dataset.panel).classList.add("active");
    });
  });

  /* ── Refresh ─────────────────────────────────────────────── */
  const refreshLogBtn = document.getElementById("refresh-log-btn");
  refreshLogBtn.addEventListener("click", function () {
    refreshLogBtn.classList.add("spinning");
    loadLogs().finally(function () {
      refreshLogBtn.classList.remove("spinning");
    });
  });

  /* ── CSV export helper ────────────────────────────────────── */
  function downloadCSV(filename, headers, rows) {
    var lines = [headers.join(",")];
    rows.forEach(function (row) {
      lines.push(row.map(function (cell) {
        var val = String(cell == null ? "" : cell);
        /* Wrap in quotes if it contains comma, quote or newline */
        if (val.indexOf(",") > -1 || val.indexOf(""") > -1 || val.indexOf("
") > -1) {
          val = """ + val.replace(/"/g, """") + """;
        }
        return val;
      }).join(","));
    });
    var blob = new Blob([lines.join("
")], { type: "text/csv;charset=utf-8;" });
    var url  = URL.createObjectURL(blob);
    var a    = document.createElement("a");
    a.href     = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /* ── Wire CSV buttons ─────────────────────────────────────── */
  document.getElementById("csv-log-btn").addEventListener("click", function () {
    var f       = filters.log;
    var fromEl  = document.getElementById("date-from");
    var toEl    = document.getElementById("date-to");
    var fromVal = fromEl && fromEl.value ? new Date(fromEl.value + "T00:00:00") : null;
    var toVal   = toEl   && toEl.value   ? new Date(toEl.value   + "T23:59:59") : null;
    var rows = allLogs.filter(function (r) {
      if (f && !String(r.student_id||"").toLowerCase().includes(f) &&
               !String(r.student_name||"").toLowerCase().includes(f)) return false;
      var d = new Date(r.checked_at);
      if (fromVal && d < fromVal) return false;
      if (toVal   && d > toVal)   return false;
      return true;
    });
    downloadCSV(
      "access-log-" + new Date().toISOString().slice(0,10) + ".csv",
      ["#", "Student ID", "Name", "Date & Time"],
      rows.map(function (r, i) {
        return [i + 1, r.student_id, r.student_name || "", formatDate(r.checked_at)];
      })
    );
  });

  document.getElementById("csv-classes-btn").addEventListener("click", function () {
    var checkedIds = new Set(allLogs.map(function (r) { return String(r.student_id); }));
    var map = {};
    roster.forEach(function (s) {
      var cls = (s.class_name && String(s.class_name).trim()) || "Unknown";
      if (!map[cls]) map[cls] = { checked: 0, notChecked: 0, total: 0 };
      map[cls].total++;
      if (checkedIds.has(String(s.student_id))) map[cls].checked++;
      else map[cls].notChecked++;
    });
    var rows = Object.entries(map)
      .sort(function (a, b) { return b[1].checked - a[1].checked; })
      .map(function (e, i) {
        var pct = e[1].total > 0 ? Math.round((e[1].checked / e[1].total) * 100) : 0;
        return [i + 1, e[0], e[1].total, e[1].checked, e[1].notChecked, pct + "%"];
      });
    downloadCSV(
      "class-report-" + new Date().toISOString().slice(0,10) + ".csv",
      ["#", "Class", "Total", "Checked", "Not Checked", "Progress"],
      rows
    );
  });

  document.getElementById("csv-checked-btn").addEventListener("click", function () {
    var f = filters.checked;
    var map = {};
    allLogs.forEach(function (r) {
      var id = r.student_id;
      if (!map[id]) map[id] = { id, name: r.student_name, count: 0, last: r.checked_at };
      map[id].count++;
      if (r.checked_at > map[id].last) map[id].last = r.checked_at;
    });
    var rows = Object.values(map)
      .filter(function (r) {
        return !f || String(r.id||"||r.name").toLowerCase().includes(f);
      })
      .sort(function (a, b) { return b.count - a.count; });
    downloadCSV(
      "checked-students-" + new Date().toISOString().slice(0,10) + ".csv",
      ["#", "Student ID", "Name", "Lookups", "Last Checked"],
      rows.map(function (r, i) {
        return [i + 1, r.id, r.name || "", r.count, formatDate(r.last)];
      })
    );
  });

  document.getElementById("csv-missing-btn").addEventListener("click", function () {
    var f = filters.missing;
    var checkedIds = new Set(allLogs.map(function (r) { return String(r.student_id); }));
    var rows = roster
      .filter(function (s) { return !checkedIds.has(String(s.student_id)); })
      .filter(function (s) {
        return !f || String(s.student_id||"||s.name").toLowerCase().includes(f);
      });
    downloadCSV(
      "not-checked-" + new Date().toISOString().slice(0,10) + ".csv",
      ["#", "Student ID", "Name", "Class", "Status"],
      rows.map(function (s, i) {
        return [i + 1, s.student_id, s.name || "", s.class_name || "", "Not Checked"];
      })
    );
  });

  /* ── Search inputs ───────────────────────────────────────── */
  ["log", "checked", "missing"].forEach(function (key) {
    const el = document.getElementById(key + "-search");
    if (!el) return;
    el.addEventListener("input", function () {
      filters[key] = el.value.trim().toLowerCase();
      paging[key]  = 1;
      renderPanel(key);
    });
  });

  /* ── Date range filter for Live Log ──────────────────────── */
  ["date-from", "date-to"].forEach(function (id) {
    var el = document.getElementById(id);
    if (el) el.addEventListener("change", function () {
      paging.log = 1;
      renderLog();
    });
  });

  /* ── Pagination ──────────────────────────────────────────── */
  ["log", "checked", "missing"].forEach(function (key) {
    const prev = document.getElementById(key + "-prev");
    const next = document.getElementById(key + "-next");
    if (!prev || !next) return;
    prev.addEventListener("click", function () {
      if (paging[key] > 1) { paging[key]--; renderPanel(key); }
    });
    next.addEventListener("click", function () {
      paging[key]++;
      renderPanel(key);
    });
  });

  /* ── Data loading ────────────────────────────────────────── */
  function loadAllData() {
    dataLoaded = true;
    Promise.all([loadRoster(), loadLogs(), loadLastUpdated()]);
  }

  /* ── Last updated timestamp ──────────────────────────────── */
  function loadLastUpdated() {
    if (!_sb) return Promise.resolve();
    /* Supabase tracks row updates if you add an updated_at column.
       As a fallback we use the most recent access_log entry date
       to show when the system was last actively used. Instead,
       we query students and pick the max id as a proxy — or better:
       store a meta row. Here we use a simple SELECT max approach. */
    return _sb
      .from("students")
      .select("student_id", { count: "exact", head: true })
      .then(function () {
        /* Try to get the last import time from a meta table if it exists,
           otherwise fall back to showing the roster count fetch time. */
        return _sb
          .from("access_logs")
          .select("checked_at")
          .order("id", { ascending: false })
          .limit(1);
      })
      .then(function (res) {
        /* Show last log time as a proxy for system activity */
        if (res.data && res.data.length > 0) {
          var wrap = document.getElementById("last-updated-wrap");
          var val  = document.getElementById("last-updated-val");
          if (wrap && val) {
            val.textContent = formatDate(res.data[0].checked_at);
            wrap.hidden = false;
          }
        }
      })
      .catch(function () {});
  }

  /* ── Load roster from Supabase students table ────────────── */
  function loadRoster() {
    if (!_sb) {
      roster = [];
      statRoster.textContent = "—";
      return Promise.resolve();
    }

    return _sb
      .from("students")
      .select("student_id, name, class_name")
      .order("student_id", { ascending: true })
      .then(function (res) {
        if (res.error) {
          console.error("[Admin] roster error:", res.error.message);
          roster = [];
          return;
        }
        roster = res.data || [];
        statRoster.textContent = roster.length;
        /* Refresh "missing" panel if logs already loaded */
        if (allLogs.length > 0 || dataLoaded) {
          renderPanel("classes");
          renderPanel("missing");
          updateStats();
        }
      })
      .catch(function (err) {
        console.error("[Admin] roster fetch failed:", err.message);
        roster = [];
      });
  }

  /* ── Load access logs from Supabase ──────────────────────── */
  function loadLogs() {
    if (!_sb) {
      allLogs = [];
      ["log", "classes", "checked", "missing"].forEach(renderPanel);
      return Promise.resolve();
    }

    return _sb
      .from("access_logs")
      .select("id, student_id, student_name, checked_at")
      .order("checked_at", { ascending: false })
      .then(function (res) {
        if (res.error) {
          showError("log-error", "Could not load logs: " + res.error.message);
          return;
        }
        allLogs = res.data || [];
        ["log", "classes", "checked", "missing"].forEach(renderPanel);
        updateStats();
      })
      .catch(function (err) {
        showError("log-error", "Network error: " + err.message);
      });
  }

  /* ── Stats ───────────────────────────────────────────────── */
  function updateStats() {
    statTotal.textContent  = allLogs.length;

    const uniqueIds        = new Set(allLogs.map(function (r) { return r.student_id; }));
    statUnique.textContent = uniqueIds.size;
    statRoster.textContent = roster.length || statRoster.textContent;

    if (roster.length > 0) {
      const never = roster.filter(function (s) {
        return !uniqueIds.has(String(s.student_id));
      });
      statUnchecked.textContent = never.length;
    } else {
      statUnchecked.textContent = "—";
    }
  }

  /* ── Render helpers ──────────────────────────────────────── */
  function esc(str) {
    return String(str ?? "")
      .replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function formatDate(iso) {
    if (!iso) return "—";
    try {
      return new Date(iso).toLocaleString(undefined, {
        year: "numeric", month: "short", day: "numeric",
        hour: "2-digit", minute: "2-digit",
      });
    } catch (_) { return iso; }
  }

  function paginate(arr, page) {
    return arr.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  }

  function updatePagination(key, total, page) {
    const paginationEl = document.getElementById(key + "-pagination");
    const labelEl      = document.getElementById(key + "-page-label");
    const prevBtn      = document.getElementById(key + "-prev");
    const nextBtn      = document.getElementById(key + "-next");
    const pages        = Math.max(1, Math.ceil(total / PAGE_SIZE));

    if (total > PAGE_SIZE) {
      paginationEl.style.display = "";
      labelEl.textContent        = "Page " + page + " of " + pages;
      prevBtn.disabled           = page <= 1;
      nextBtn.disabled           = page >= pages;
    } else {
      paginationEl.style.display = "none";
    }
  }

  function showError(elId, msg) {
    const el = document.getElementById(elId);
    if (el) { el.textContent = msg; el.classList.add("visible"); }
  }

  function emptyState(msg) {
    return `<div class="empty-state">
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none"
           stroke="currentColor" stroke-width="1.5"
           stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10"/>
        <path d="M12 8v4M12 16h.01"/>
      </svg>
      ${esc(msg)}
    </div>`;
  }

  /* ── Panel dispatch ──────────────────────────────────────── */
  function renderPanel(key) {
    if (key === "log")     renderLog();
    if (key === "classes") renderClasses();
    if (key === "checked") renderChecked();
    if (key === "missing") renderMissing();
  }

  /* ── Tab 2: By Class ─────────────────────────────────────── */
  function renderClasses() {
    var wrap = document.getElementById("classes-table-wrap");

    if (roster.length === 0) {
      wrap.innerHTML = emptyState(!_sb
        ? "Supabase is not configured — roster unavailable."
        : "Loading student roster…"
      );
      return;
    }

    /* ── Build a set of IDs that have checked ── */
    var checkedIds = new Set(allLogs.map(function (r) {
      return String(r.student_id);
    }));

    /* ── Aggregate per class_name ── */
    var classMap = {};

    roster.forEach(function (s) {
      var cls     = (s.class_name && String(s.class_name).trim()) || "Unknown";
      var sid     = String(s.student_id);
      var checked = checkedIds.has(sid);

      if (!classMap[cls]) {
        classMap[cls] = { name: cls, checked: 0, notChecked: 0, total: 0 };
      }
      classMap[cls].total++;
      if (checked) { classMap[cls].checked++;    }
      else          { classMap[cls].notChecked++; }
    });

    /* ── Sort: most checked first, then alphabetically ── */
    var rows = Object.values(classMap).sort(function (a, b) {
      if (b.checked !== a.checked) return b.checked - a.checked;
      return a.name.localeCompare(b.name);
    });

    if (rows.length === 0) {
      wrap.innerHTML = emptyState("No class data found.");
      return;
    }

    /* ── Build table ── */
    var html = [
      "<table>",
      "<thead><tr>",
      "<th>#</th>",
      "<th>Class</th>",
      "<th class='center'>Total</th>",
      "<th class='center'>Checked</th>",
      "<th class='center'>Not Checked</th>",
      "<th>Progress</th>",
      "</tr></thead>",
      "<tbody>"
    ].join("");

    rows.forEach(function (row, i) {
      var rank   = i + 1;
      var pct    = row.total > 0 ? Math.round((row.checked / row.total) * 100) : 0;
      var rankMod = rank === 1 ? "1" : rank === 2 ? "2" : rank === 3 ? "3" : "n";

      html += "<tr>";
      html += "<td><span class='class-rank class-rank--" + rankMod + "'>" + rank + "</span></td>";
      html += "<td><div class='class-name-cell'><strong>" + esc(row.name) + "</strong></div></td>";
      html += "<td class='center'><span class='total-count'>" + row.total + "</span></td>";
      html += "<td class='center'><span class='checked-count'>" + row.checked + "</span></td>";
      html += "<td class='center'><span class='missing-count'>" + row.notChecked + "</span></td>";
      html += "<td><div class='class-progress-wrap'>" +
                "<div class='class-bar-track'>" +
                  "<div class='class-bar-fill' data-pct='" + pct + "' style='width:0%'></div>" +
                "</div>" +
                "<span class='class-bar-pct'>" + pct + "%</span>" +
              "</div></td>";
      html += "</tr>";
    });

    /* ── Totals summary row — inside tbody so padding is identical ── */
    var grandTotal      = rows.reduce(function (s, r) { return s + r.total;      }, 0);
    var grandChecked    = rows.reduce(function (s, r) { return s + r.checked;    }, 0);
    var grandNotChecked = rows.reduce(function (s, r) { return s + r.notChecked; }, 0);
    var grandPct        = grandTotal > 0 ? Math.round((grandChecked / grandTotal) * 100) : 0;

    html += "<tr class='class-summary-footer'>";
    html += "<td class='center'><span class='class-rank class-rank--n'>*</span></td>";
    html += "<td><strong class='footer-all-label'>All Classes</strong></td>";
    html += "<td class='center'><span class='total-count'>" + grandTotal + "</span></td>";
    html += "<td class='center'><span class='checked-count'>" + grandChecked + "</span></td>";
    html += "<td class='center'><span class='missing-count'>" + grandNotChecked + "</span></td>";
    html += "<td><div class='class-progress-wrap'>" +
              "<div class='class-bar-track'>" +
                "<div class='class-bar-fill' data-pct='" + grandPct + "' style='width:0%'></div>" +
              "</div>" +
              "<span class='class-bar-pct'>" + grandPct + "%</span>" +
            "</div></td>";
    html += "</tr>";

    html += "</tbody>";
    html += "</table>";

    wrap.innerHTML = html;

    /* ── Animate progress bars ── */
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        wrap.querySelectorAll(".class-bar-fill[data-pct]").forEach(function (el) {
          el.style.width = el.getAttribute("data-pct") + "%";
        });
      });
    });
  }

  /* ── Tab 1: Live Log ─────────────────────────────────────── */
  function renderLog() {
    const wrap    = document.getElementById("log-table-wrap");
    const f       = filters.log;
    const fromEl  = document.getElementById("date-from");
    const toEl    = document.getElementById("date-to");
    const fromVal = fromEl && fromEl.value ? new Date(fromEl.value + "T00:00:00") : null;
    const toVal   = toEl   && toEl.value   ? new Date(toEl.value   + "T23:59:59") : null;

    let rows = allLogs;

    /* Text filter */
    if (f) {
      rows = rows.filter(function (r) {
        return String(r.student_id   || "").toLowerCase().includes(f) ||
               String(r.student_name || "").toLowerCase().includes(f);
      });
    }

    /* Date range filter */
    if (fromVal || toVal) {
      rows = rows.filter(function (r) {
        var d = new Date(r.checked_at);
        if (fromVal && d < fromVal) return false;
        if (toVal   && d > toVal)   return false;
        return true;
      });
    }

    updatePagination("log", rows.length, paging.log);
    const page = paginate(rows, paging.log);

    if (rows.length === 0) {
      wrap.innerHTML = emptyState(
        allLogs.length === 0
          ? "No log entries yet. Entries appear here as students look up their marks."
          : "No entries match your search."
      );
      return;
    }

    let html = `
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Student ID</th>
            <th>Name</th>
            <th>Date &amp; Time</th>
          </tr>
        </thead>
        <tbody>`;

    page.forEach(function (row, i) {
      const num = (paging.log - 1) * PAGE_SIZE + i + 1;
      html += `
        <tr>
          <td style="color:var(--text4);font-size:.72rem">${num}</td>
          <td><span class="id-mono">${esc(row.student_id)}</span></td>
          <td>${esc(row.student_name || "—")}</td>
          <td class="ts-cell">${esc(formatDate(row.checked_at))}</td>
        </tr>`;
    });

    html += "</tbody></table>";
    wrap.innerHTML = html;
  }

  /* ── Tab 2: Checked (aggregated) ─────────────────────────── */
  function renderChecked() {
    const wrap = document.getElementById("checked-table-wrap");
    const f    = filters.checked;

    /* Aggregate by student_id */
    const map = {};
    allLogs.forEach(function (row) {
      const id = row.student_id;
      if (!map[id]) {
        map[id] = { id, name: row.student_name, count: 0, last: row.checked_at };
      }
      map[id].count++;
      if (row.checked_at > map[id].last) map[id].last = row.checked_at;
    });

    let agg = Object.values(map).sort(function (a, b) { return b.count - a.count; });

    if (f) {
      agg = agg.filter(function (r) {
        return String(r.id   || "").toLowerCase().includes(f) ||
               String(r.name || "").toLowerCase().includes(f);
      });
    }

    updatePagination("checked", agg.length, paging.checked);
    const page = paginate(agg, paging.checked);

    if (agg.length === 0) {
      wrap.innerHTML = emptyState(
        allLogs.length === 0
          ? "No students have checked their marks yet."
          : "No results match your search."
      );
      return;
    }

    let html = `
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Student ID</th>
            <th>Name</th>
            <th class="center">Lookups</th>
            <th>Last Checked</th>
          </tr>
        </thead>
        <tbody>`;

    page.forEach(function (row, i) {
      const num = (paging.checked - 1) * PAGE_SIZE + i + 1;
      html += `
        <tr>
          <td style="color:var(--text4);font-size:.72rem">${num}</td>
          <td><span class="id-mono">${esc(row.id)}</span></td>
          <td>${esc(row.name || "—")}</td>
          <td class="center"><span class="count-badge">${row.count}</span></td>
          <td class="ts-cell">${esc(formatDate(row.last))}</td>
        </tr>`;
    });

    html += "</tbody></table>";
    wrap.innerHTML = html;
  }

  /* ── Tab 3: Not Checked ──────────────────────────────────── */
  function renderMissing() {
    const wrap = document.getElementById("missing-table-wrap");
    const f    = filters.missing;

    if (roster.length === 0) {
      wrap.innerHTML = emptyState(
        !_sb
          ? "Supabase is not configured — roster unavailable."
          : "Loading student roster from Supabase…"
      );
      return;
    }

    const checkedIds = new Set(allLogs.map(function (r) { return String(r.student_id); }));

    let missing = roster.filter(function (s) {
      return !checkedIds.has(String(s.student_id));
    });

    if (f) {
      missing = missing.filter(function (s) {
        return String(s.student_id || "").toLowerCase().includes(f) ||
               String(s.name       || "").toLowerCase().includes(f);
      });
    }

    updatePagination("missing", missing.length, paging.missing);
    const page = paginate(missing, paging.missing);

    if (missing.length === 0) {
      wrap.innerHTML = emptyState("All students have checked their marks! 🎉");
      return;
    }

    let html = `
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Student ID</th>
            <th>Name</th>
            <th class="center">Status</th>
          </tr>
        </thead>
        <tbody>`;

    page.forEach(function (s, i) {
      const num = (paging.missing - 1) * PAGE_SIZE + i + 1;
      html += `
        <tr>
          <td style="color:var(--text4);font-size:.72rem">${num}</td>
          <td><span class="id-mono">${esc(s.student_id)}</span></td>
          <td>${esc(s.name || "—")}</td>
          <td class="center"><span class="not-checked-tag">Not checked</span></td>
        </tr>`;
    });

    html += "</tbody></table>";
    wrap.innerHTML = html;
  }

})();
