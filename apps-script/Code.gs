// Workout Tracker — server side (Google Apps Script, bound to the Sheet).
// Paste this ENTIRE file into Code.gs (replace everything).
//
// Reference tab layout (column A is a tag, everything is driven by this tab):
//   WORKOUT | <name> | <muscle groups>          starts a workout (a log tab with the same name is created)
//   SECTION | <name>                            starts a section ("warm" -> checklist, "cool" -> checklist, else logs sets)
//           | Exercise | Sets | Reps | Rest (sec) | Tempo | Superset | Notes     (exercise rows: column A empty)
// Any other text in column A (e.g. NOTE) is a comment and is ignored.

var REF_SHEET = "Reference";
var REF_COLS = 8;
var LOG_HEADERS = ["Timestamp", "Date", "Exercise", "Set", "Weight (kg)", "Reps", "SetId", "Notes"];

// Body measurements, one tab each: Timestamp | Date | <tab> (<unit>) | Notes | EntryId.
// To track more later (arm, chest, waist...) add a line here; the tab is created automatically.
var METRICS = [
  { key: "weight", name: "Body Weight", tab: "Weight", unit: "kg", max: 400 },
];

// =====================================================================
// Entry points you run from the editor
// =====================================================================

/**
 * RUN THIS ONE (first time, or after pasting a new version).
 *  - If the Reference tab has no WORKOUT rows yet (empty or old format) it is replaced with the starter plan.
 *  - If it already has WORKOUT rows it is left alone (your edits are safe).
 *  - Then a log tab is created for every workout found in Reference.
 */
function setupAndSeed() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(REF_SHEET);
  var seeded = false;
  if (!sh || !hasWorkoutRows_(sh)) {
    writeStarterReference_();
    seeded = true;
  }
  var res = syncLogTabs();
  toast_((seeded ? "Reference rewritten (new layout). " : "Reference kept. ") + res.message);
}

/** Overwrites the Reference tab with the starter plan, even if you edited it. */
function resetReferenceToStarter() {
  writeStarterReference_();
  toast_("Reference reset. " + syncLogTabs().message);
}

/** Creates a log tab for every workout in Reference. Run after editing Reference (the app also does this on load). */
function syncLogTabs() {
  var ref = readReference_();
  var made = 0;
  var warnings = ref.warnings.slice();
  ref.workouts.forEach(function (w) {
    try {
      var existed = !!SpreadsheetApp.getActiveSpreadsheet().getSheetByName(w.tab);
      ensureLogTab_(w.tab);
      if (!existed) made++;
    } catch (e) {
      warnings.push(String(e.message || e));
    }
  });
  METRICS.forEach(function (m) {
    try {
      var had = !!SpreadsheetApp.getActiveSpreadsheet().getSheetByName(m.tab);
      ensureMetricTab_(m);
      if (!had) made++;
    } catch (e) {
      warnings.push(String(e.message || e));
    }
  });
  var msg = ref.workouts.length + " workouts, " + made + " new log tab(s)" +
    (warnings.length ? ", " + warnings.length + " warning(s) - see Execution log" : "") + ".";
  warnings.forEach(function (x) { Logger.log("WARNING: " + x); });
  Logger.log(msg);
  return { workouts: ref.workouts.length, created: made, warnings: warnings, message: msg };
}

/**
 * ONE-TIME (optional): copies sets from the old single "Log" tab (v1 layout) into each workout's tab,
 * so "Last workout" works for sets you already logged. Safe to run repeatedly (skips SetIds already there;
 * skips test rows). The old Log tab is left untouched; delete it yourself when you're happy.
 */
function migrateOldLog() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var old = ss.getSheetByName("Log");
  if (!old || old.getLastRow() < 2) { toast_("No old Log tab with data - nothing to migrate."); return; }
  var tz = ss.getSpreadsheetTimeZone();
  var head = old.getRange(1, 1, 1, 9).getDisplayValues()[0].join("|");
  if (head !== "Timestamp|Date|Workout|Exercise|Set|Weight (kg)|Reps|SetId|Notes") {
    toast_("The 'Log' tab doesn't have the old v1 columns - nothing migrated.");
    return;
  }
  var rng = old.getRange(2, 1, old.getLastRow() - 1, 9);
  var vals = rng.getValues();
  var disp = rng.getDisplayValues();
  var byWorkout = {};
  var skipped = 0;
  vals.forEach(function (r, i) {
    var id = String(disp[i][7]).trim();
    var workout = String(disp[i][2]).trim();
    var ex = String(disp[i][3]).trim();
    if (!id || !workout || !ex || id.indexOf("s_test_") === 0) { skipped++; return; }
    var day = r[1] instanceof Date ? Utilities.formatDate(r[1], tz, "yyyy-MM-dd") : String(disp[i][1]).trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) { skipped++; return; }
    (byWorkout[workout] = byWorkout[workout] || []).push({
      setId: id, date: day, workout: workout, exercise: ex, set: Number(r[4]),
      weight: Number(r[5]), reps: Number(r[6]), notes: String(disp[i][8] || ""),
      ts: r[0] instanceof Date ? r[0].getTime() : 0,
    });
  });

  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  var copied = 0;
  try {
    Object.keys(byWorkout).forEach(function (workout) {
      var tab = tabName_(workout);
      if (!tab) { skipped += byWorkout[workout].length; return; }
      var sh = ensureLogTab_(tab);
      var have = {};
      var n = sh.getLastRow();
      if (n >= 2) sh.getRange(2, 7, n - 1, 1).getDisplayValues().forEach(function (x) { have[String(x[0])] = true; });
      var fresh = byWorkout[workout].filter(function (s) { return !have[s.setId]; });
      copied += appendToTab_(sh, fresh).saved;
    });
  } finally {
    lock.releaseLock();
  }
  var msg = "Migrated " + copied + " set(s) from the old Log tab (" + skipped + " skipped). You can delete the old 'Log' tab.";
  Logger.log(msg);
  toast_(msg);
}

/** Shows a small popup in the Sheet (visible even if the execution log is empty). */
function toast_(msg) {
  SpreadsheetApp.getActiveSpreadsheet().toast(msg, "Workout Tracker", 10);
}

// =====================================================================
// Helpers
// =====================================================================

function sheet_(name) {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
  if (!sh) throw new Error('Tab "' + name + '" not found. Run setupAndSeed() first.');
  return sh;
}

/** Cell -> text. If Sheets turned "8-10" into a Date, convert it back to "8-10". */
function cellText_(v, display, tz) {
  if (v instanceof Date) return Utilities.formatDate(v, tz, "M-d");
  return String(display).trim();
}

function cellAt_(vals, disp, r, c, tz) {
  if (c >= vals[r].length) return "";
  return cellText_(vals[r][c], disp[r][c], tz);
}

/** "warm" / "cool" sections are checklists; everything else logs sets. */
function kindOf_(sectionName) {
  var s = String(sectionName).toLowerCase();
  if (s.indexOf("warm") >= 0) return "warm";
  if (s.indexOf("cool") >= 0) return "cool";
  return "work";
}

/** Workout name -> valid sheet tab name ("" if unusable). */
function tabName_(workout) {
  var n = String(workout || "")
    .replace(/[\[\]\*\?:\/\\]/g, "-")
    .replace(/^'+/, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 100);
  if (!n) return "";
  if (n.toLowerCase() === REF_SHEET.toLowerCase()) n += " Log";
  return n;
}

function hasWorkoutRows_(sh) {
  var n = sh.getLastRow();
  if (n < 1) return false;
  var cols = sh.getRange(1, 1, n, 2).getDisplayValues();
  for (var i = 0; i < cols.length; i++) {
    var b = String(cols[i][1]).trim().toLowerCase();
    // The old layout's header row ("Workout | Section | ...") must not count as a WORKOUT row.
    if (String(cols[i][0]).trim().toUpperCase() === "WORKOUT" && b && b !== "section") return true;
  }
  return false;
}

// =====================================================================
// Reference parsing (everything the app shows comes from here)
// =====================================================================

/** Returns {workouts:[{name,muscles,tab,sections:[{name,kind,items:[...]}]}], warnings:[...]} (plain strings/numbers only). */
function readReference_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var tz = ss.getSpreadsheetTimeZone();
  var range = sheet_(REF_SHEET).getDataRange();
  var vals = range.getValues();
  var disp = range.getDisplayValues();

  var workouts = [];
  var warnings = [];
  var usedTabs = {};
  var cw = null;
  var cs = null;

  for (var i = 0; i < vals.length; i++) {
    var rowNo = i + 1;
    var tag = cellAt_(vals, disp, i, 0, tz).toUpperCase();
    var b = cellAt_(vals, disp, i, 1, tz);

    if (tag === "WORKOUT") {
      cw = null; cs = null;
      if (b.toLowerCase() === "section") continue;   // header row of the old Reference layout
      var tab = tabName_(b);
      if (!b || !tab) { warnings.push("Row " + rowNo + ": WORKOUT has no usable name - ignored."); continue; }
      if (usedTabs[tab.toLowerCase()]) {
        warnings.push('Row ' + rowNo + ': workout "' + b + '" duplicates another workout (same tab "' + tab + '") - ignored.');
        continue;
      }
      usedTabs[tab.toLowerCase()] = true;
      cw = { name: b, muscles: cellAt_(vals, disp, i, 2, tz), tab: tab, sections: [] };
      workouts.push(cw);
    } else if (tag === "SECTION") {
      cs = null;
      if (!cw) { warnings.push("Row " + rowNo + ": SECTION is outside any WORKOUT - ignored."); continue; }
      if (!b) { warnings.push("Row " + rowNo + ": SECTION has no name - ignored."); continue; }
      cs = { name: b, kind: kindOf_(b), items: [] };
      cw.sections.push(cs);
    } else if (tag === "") {
      if (!b || b.toLowerCase() === "exercise") continue;          // blank row or column-header row
      if (!cs) { warnings.push('Row ' + rowNo + ': exercise "' + b + '" is not under a WORKOUT/SECTION - ignored.'); continue; }
      var rest = parseFloat(cellAt_(vals, disp, i, 4, tz));
      cs.items.push({
        exercise: b,
        sets: cellAt_(vals, disp, i, 2, tz),
        reps: cellAt_(vals, disp, i, 3, tz),
        rest: isNaN(rest) ? 0 : rest,
        tempo: cellAt_(vals, disp, i, 5, tz),
        group: cellAt_(vals, disp, i, 6, tz),
        notes: cellAt_(vals, disp, i, 7, tz),
      });
    }
    // any other tag (NOTE, ...) is a comment
  }

  // Drop empty sections / workouts; warn about duplicate loggable exercises.
  var out = [];
  workouts.forEach(function (w) {
    w.sections = w.sections.filter(function (s) { return s.items.length > 0; });
    if (!w.sections.length) { warnings.push('Workout "' + w.name + '" has no exercises - ignored.'); return; }
    var seen = {};
    w.sections.forEach(function (s) {
      if (s.kind !== "work") return;
      s.items.forEach(function (it) {
        if (seen[it.exercise]) warnings.push('Workout "' + w.name + '": exercise "' + it.exercise + '" appears twice - its sets will be combined.');
        seen[it.exercise] = true;
      });
    });
    out.push(w);
  });
  return { workouts: out, warnings: warnings };
}

// =====================================================================
// Log tabs (one per workout)
// =====================================================================

function isLogTab_(sh) {
  if (sh.getName() === REF_SHEET) return false;
  if (sh.getLastColumn() < LOG_HEADERS.length) return false;
  var head = sh.getRange(1, 1, 1, LOG_HEADERS.length).getDisplayValues()[0];
  for (var i = 0; i < LOG_HEADERS.length; i++) if (head[i] !== LOG_HEADERS[i]) return false;
  return true;
}

function initLogTab_(sh) {
  sh.getRange(1, 1, 1, LOG_HEADERS.length).setValues([LOG_HEADERS]).setFontWeight("bold");
  sh.setFrozenRows(1);
  var rows = Math.max(sh.getMaxRows() - 1, 1);
  sh.getRange(2, 1, rows, 1).setNumberFormat("yyyy-mm-dd hh:mm:ss");
  sh.getRange(2, 2, rows, 1).setNumberFormat("yyyy-mm-dd");
  sh.getRange(2, 7, rows, 2).setNumberFormat("@"); // SetId + Notes stay text
}

/** Gets or creates the log tab for a workout. Throws if a tab with that name exists but isn't a log tab. */
function ensureLogTab_(tab) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(tab);
  if (!sh) {
    try { sh = ss.insertSheet(tab); }
    catch (e) { sh = ss.getSheetByName(tab); if (!sh) throw e; }   // lost a creation race
  }
  if (String(sh.getRange(1, 1).getDisplayValue()).trim() === "") {
    initLogTab_(sh);
  } else if (!isLogTab_(sh)) {
    throw new Error('Tab "' + tab + '" already exists but is not a workout log (different columns). Rename that tab or the workout.');
  }
  return sh;
}

/** Last session per exercise for one log tab. {exercise: {date, sets:[{set,w,r}]}} - newest rows first, today excluded. */
function readLast_(sh, todayStr) {
  var out = {};
  var n = sh.getLastRow();
  if (n < 2) return out;
  var from = Math.max(2, n - 1499);
  var rng = sh.getRange(from, 1, n - from + 1, LOG_HEADERS.length);
  var v = rng.getDisplayValues();   // date + exercise as shown
  var nums = rng.getValues();       // numbers as real numbers (display strings break in decimal-comma locales)
  for (var j = v.length - 1; j >= 0; j--) {
    var day = v[j][1];
    var name = v[j][2];
    if (!name || day === todayStr) continue;
    var e = out[name];
    if (!e) e = out[name] = { date: day, sets: [] };
    if (e.date !== day) continue;
    e.sets.push({ set: Number(nums[j][3]), w: Number(nums[j][4]), r: Number(nums[j][5]) });
  }
  Object.keys(out).forEach(function (k) {
    out[k].sets.sort(function (a, b) { return a.set - b.set; });
  });
  return out;
}

// =====================================================================
// Body measurements. One tab per metric; to add arm/chest/waist later just add a row to METRICS.
// =====================================================================

function metric_(key) {
  for (var i = 0; i < METRICS.length; i++) if (METRICS[i].key === key) return METRICS[i];
  throw new Error('Unknown measurement "' + key + '".');
}

function metricHeaders_(m) {
  return ["Timestamp", "Date", m.tab + " (" + m.unit + ")", "Notes", "EntryId"];
}

/** Gets or creates the tab for a metric (e.g. "Weight"). Throws if a tab with that name exists with other columns. */
function ensureMetricTab_(m) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(m.tab);
  if (!sh) {
    try { sh = ss.insertSheet(m.tab); }
    catch (e) { sh = ss.getSheetByName(m.tab); if (!sh) throw e; }   // lost a creation race
  }
  var head = metricHeaders_(m);
  if (String(sh.getRange(1, 1).getDisplayValue()).trim() === "") {
    sh.getRange(1, 1, 1, head.length).setValues([head]).setFontWeight("bold");
    sh.setFrozenRows(1);
    var rows = Math.max(sh.getMaxRows() - 1, 1);
    sh.getRange(2, 1, rows, 1).setNumberFormat("yyyy-mm-dd hh:mm:ss");
    sh.getRange(2, 2, rows, 1).setNumberFormat("yyyy-mm-dd");
    sh.getRange(2, 4, rows, 2).setNumberFormat("@"); // Notes + EntryId stay text
  } else {
    var got = sh.getRange(1, 1, 1, head.length).getDisplayValues()[0];
    for (var i = 0; i < head.length; i++) {
      if (got[i] !== head[i]) {
        throw new Error('Tab "' + m.tab + '" already exists but is not a ' + m.name + ' log (different columns). Rename that tab.');
      }
    }
  }
  return sh;
}

/** Latest entries of a metric tab, oldest first: [{id, date, value, notes}]. */
function readRecent_(sh, count) {
  var last = sh.getLastRow();
  if (last < 2) return [];
  var from = Math.max(2, last - count + 1);
  var rng = sh.getRange(from, 1, last - from + 1, 5);
  var disp = rng.getDisplayValues();
  var nums = rng.getValues();
  return disp.map(function (r, i) {
    return { id: r[4], date: r[1], value: Number(nums[i][2]), notes: r[3] };
  });
}

/**
 * Appends measurement entries (e.g. body weight). Idempotent by entryId, like logSets.
 * Each entry: {entryId, metric:"weight", date?:"yyyy-MM-dd" (defaults to today in the Sheet's timezone), value, notes?}
 */
function logMeasurements(entries) {
  if (!Array.isArray(entries) || entries.length === 0) return { saved: 0, dupes: 0, ids: [] };

  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var tz = SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone();
    var groups = {};
    var ids = [];
    entries.forEach(function (e) {
      var id = String(e.entryId || "");
      if (!id) throw new Error("entryId is required");
      var m = metric_(String(e.metric));
      var v = Number(String(e.value).replace(",", "."));
      if (!isFinite(v) || v <= 0 || v > m.max) throw new Error(m.name + " must be between 0 and " + m.max + " " + m.unit + ".");
      var day = e.date ? String(e.date) : Utilities.formatDate(new Date(), tz, "yyyy-MM-dd");
      if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new Error("Bad date: " + e.date);
      ids.push(id);
      (groups[m.key] = groups[m.key] || { m: m, list: [] }).list.push({ id: id, day: day, v: v, notes: String(e.notes || ""), ts: e.ts });
    });

    var saved = 0;
    var dupes = 0;
    Object.keys(groups).forEach(function (key) {
      var g = groups[key];
      var sh = ensureMetricTab_(g.m);
      var lastRow = sh.getLastRow();
      var seen = {};
      if (lastRow >= 2) {
        var from = Math.max(2, lastRow - 999);
        sh.getRange(from, 5, lastRow - from + 1, 1).getDisplayValues().forEach(function (r) { if (r[0]) seen[String(r[0])] = true; });
      }
      var now = new Date();
      var rows = [];
      g.list.forEach(function (x) {
        if (seen[x.id]) { dupes++; return; }
        seen[x.id] = true;
        rows.push([x.ts ? new Date(x.ts) : now, x.day, x.v, x.notes, x.id]);
      });
      if (rows.length) {
        var needRows = lastRow + rows.length;
        if (sh.getMaxRows() < needRows) sh.insertRowsAfter(sh.getMaxRows(), needRows - sh.getMaxRows());
        var first = lastRow + 1;
        sh.getRange(first, 1, rows.length, 1).setNumberFormat("yyyy-mm-dd hh:mm:ss");
        sh.getRange(first, 2, rows.length, 1).setNumberFormat("yyyy-mm-dd");
        sh.getRange(first, 4, rows.length, 2).setNumberFormat("@");
        sh.getRange(first, 1, rows.length, 5).setValues(rows);
        saved += rows.length;
      }
    });
    return { saved: saved, dupes: dupes, ids: ids };
  } finally {
    lock.releaseLock();
  }
}

/** Deletes a measurement entry by id (undo). Returns 1 if deleted, else 0. */
function deleteMeasurement(entryId, metricKey) {
  var id = String(entryId || "");
  if (!id) return 0;
  var m = metric_(String(metricKey));
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(m.tab);
    if (!sh) return 0;
    var n = sh.getLastRow();
    if (n < 2) return 0;
    var col = sh.getRange(2, 5, n - 1, 1).getDisplayValues();
    for (var i = col.length - 1; i >= 0; i--) {
      if (col[i][0] === id) { sh.deleteRow(i + 2); return 1; }
    }
    return 0;
  } finally {
    lock.releaseLock();
  }
}

// =====================================================================
// Server API (called from the page via google.script.run)
// =====================================================================

/** Serves the app page (index.html). */
function doGet() {
  return HtmlService.createHtmlOutputFromFile("index")
    .setTitle("Workout Tracker")
    .addMetaTag("viewport", "width=device-width, initial-scale=1, viewport-fit=cover")
    .addMetaTag("apple-mobile-web-app-capable", "yes")
    .addMetaTag("mobile-web-app-capable", "yes")
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * Everything the page needs: workouts/sections/exercises from Reference, last session per exercise per workout,
 * and warnings. Creates any missing log tab. todayStr = "yyyy-MM-dd" from the phone (today's sets are excluded from "last").
 */
function getData(todayStr) {
  var ref = readReference_();
  if (!ref.workouts.length) {
    throw new Error("No workouts found in the Reference tab. Run setupAndSeed() to see an example layout." +
      (ref.warnings.length ? " (" + ref.warnings[0] + ")" : ""));
  }
  var warnings = ref.warnings.slice();
  var last = {};
  ref.workouts.forEach(function (w) {
    try {
      last[w.name] = readLast_(ensureLogTab_(w.tab), todayStr);
    } catch (e) {
      last[w.name] = {};
      warnings.push(String(e.message || e));
    }
  });
  var metrics = METRICS.map(function (m) {
    var recent = [];
    try { recent = readRecent_(ensureMetricTab_(m), 12); }
    catch (e) { warnings.push(String(e.message || e)); }
    return { key: m.key, name: m.name, unit: m.unit, tab: m.tab, max: m.max, recent: recent };
  });
  return { workouts: ref.workouts, last: last, warnings: warnings, metrics: metrics };
}

/**
 * Appends sets to the log tab of their workout. Safe to call repeatedly with the same sets:
 * rows whose setId already exists in that tab are skipped, so client retries never duplicate.
 * Each set: {setId, date:"yyyy-MM-dd", workout, exercise, set, weight, reps, notes?}
 */
function logSets(sets) {
  if (!Array.isArray(sets) || sets.length === 0) return { saved: 0, dupes: 0, ids: [] };

  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var groups = {};
    var ids = [];
    sets.forEach(function (s) {
      var id = String(s.setId || "");
      if (!id) throw new Error("setId is required");
      if (!/^\d{4}-\d{2}-\d{2}$/.test(String(s.date))) throw new Error("Bad date: " + s.date);
      if (!s.exercise) throw new Error("exercise is required");
      var tab = tabName_(s.workout);
      if (!tab) throw new Error("workout is required");
      ids.push(id);
      (groups[tab] = groups[tab] || []).push(s);
    });

    var saved = 0;
    var dupes = 0;
    Object.keys(groups).forEach(function (tab) {
      var r = appendToTab_(ensureLogTab_(tab), groups[tab]);
      saved += r.saved;
      dupes += r.dupes;
    });
    return { saved: saved, dupes: dupes, ids: ids };
  } finally {
    lock.releaseLock();
  }
}

function appendToTab_(sh, list) {
  var lastRow = sh.getLastRow();
  var seen = {};
  if (lastRow >= 2) {
    var from = Math.max(2, lastRow - 999);
    sh.getRange(from, 7, lastRow - from + 1, 1).getDisplayValues().forEach(function (r) {
      if (r[0]) seen[String(r[0])] = true;
    });
  }
  var now = new Date();
  var rows = [];
  var dupes = 0;
  list.forEach(function (s) {
    var id = String(s.setId);
    if (seen[id]) { dupes++; return; }
    seen[id] = true;
    var w = Number(s.weight);
    var r = Number(s.reps);
    rows.push([s.ts ? new Date(s.ts) : now, String(s.date), String(s.exercise), Number(s.set) || 0,
      isNaN(w) ? 0 : w, isNaN(r) ? 0 : r, id, String(s.notes || "")]);
  });
  if (rows.length) {
    // A new tab has 1000 rows; grow it when the log fills up, or getRange would throw.
    var needRows = lastRow + rows.length;
    if (sh.getMaxRows() < needRows) sh.insertRowsAfter(sh.getMaxRows(), needRows - sh.getMaxRows());
    var first = lastRow + 1;
    sh.getRange(first, 1, rows.length, 1).setNumberFormat("yyyy-mm-dd hh:mm:ss");
    sh.getRange(first, 2, rows.length, 1).setNumberFormat("yyyy-mm-dd");
    sh.getRange(first, 7, rows.length, 2).setNumberFormat("@");
    sh.getRange(first, 1, rows.length, LOG_HEADERS.length).setValues(rows);
  }
  return { saved: rows.length, dupes: dupes };
}

/** Deletes the log row with this setId (undo). Looks in the workout's tab first, then every other log tab. Returns 1/0. */
function deleteSet(setId, workout) {
  var id = String(setId || "");
  if (!id) return 0;

  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var preferred = workout ? ss.getSheetByName(tabName_(workout)) : null;
    var cands = [];
    if (preferred && isLogTab_(preferred)) cands.push(preferred);
    ss.getSheets().forEach(function (sh) {
      if (sh !== preferred && isLogTab_(sh)) cands.push(sh);
    });
    for (var c = 0; c < cands.length; c++) {
      var sh = cands[c];
      var n = sh.getLastRow();
      if (n < 2) continue;
      var col = sh.getRange(2, 7, n - 1, 1).getDisplayValues();
      for (var i = col.length - 1; i >= 0; i--) {
        if (col[i][0] === id) {
          sh.deleteRow(i + 2);
          return 1;
        }
      }
    }
    return 0;
  } finally {
    lock.releaseLock();
  }
}

/**
 * RUN THIS to test the server against your real Sheet.
 * Writes one test row to the first workout's log tab, checks dedupe/read/undo, then removes it.
 */
function testServer() {
  var fails = [];
  function check(label, ok) { if (!ok) fails.push(label); }

  var ref = readReference_();
  check("Reference has workouts", ref.workouts.length > 0);
  var w = ref.workouts[0];
  var sec = w ? w.sections.filter(function (s) { return s.kind === "work"; })[0] : null;
  var item = sec ? sec.items[0] : null;
  check("first workout has a loggable exercise", !!item);

  var allReps = [];
  ref.workouts.forEach(function (x) { x.sections.forEach(function (s) { s.items.forEach(function (it) { allReps.push(it.reps); }); }); });
  check("no reps turned into dates (e.g. 'Aug 10')", !allReps.some(function (r) { return /^[A-Z][a-z]{2}\b/.test(r); }));

  var count = 0;
  if (item) {
    var tz = SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone();
    var day = Utilities.formatDate(new Date(), tz, "yyyy-MM-dd");
    var id = "s_test_" + Date.now();
    var set = { setId: id, date: day, workout: w.name, exercise: item.exercise, set: 1, weight: 60, reps: 10 };

    var a = logSets([set]);
    check("first write saved 1", a.saved === 1 && a.dupes === 0);
    var b = logSets([set]);
    check("repeat write skipped as duplicate", b.saved === 0 && b.dupes === 1);

    var d = getData("1999-01-01");
    count = d.workouts.length;
    var e = d.last[w.name] && d.last[w.name][item.exercise];
    check("last session includes test set", !!e && e.sets.some(function (s) { return s.w === 60 && s.r === 10; }));
    var eToday = getData(day).last[w.name][item.exercise];
    check("today's sets excluded from last", !eToday || eToday.date !== day);

    check("delete removed 1 row", deleteSet(id, w.name) === 1);
    check("second delete finds nothing", deleteSet(id, w.name) === 0);

    // Body measurements
    var m = METRICS[0];
    var eid = "m_test_" + Date.now();
    var entry = { entryId: eid, metric: m.key, date: day, value: 80.5, notes: "" };
    check("measurement saved", logMeasurements([entry]).saved === 1);
    check("measurement duplicate skipped", logMeasurements([entry]).dupes === 1);
    var md = getData(day).metrics.filter(function (x) { return x.key === m.key; })[0];
    check("measurement visible in getData", !!md && md.recent.some(function (x) { return x.id === eid && x.value === 80.5; }));
    check("measurement deleted", deleteMeasurement(eid, m.key) === 1 && deleteMeasurement(eid, m.key) === 0);
  }

  var msg = fails.length
    ? "FAIL: " + fails.join("; ")
    : "ALL PASS (" + count + " workouts" + (ref.warnings.length ? ", " + ref.warnings.length + " warning(s): " + ref.warnings[0] : "") + ")";
  Logger.log(msg);
  toast_(msg);
}

// =====================================================================
// Starter plan (only used to fill an empty Reference tab)
// =====================================================================

/**
 * Item format: [exercise, sets, reps, restSec, tempo, notes, superset]
 * Warm-Up / Cooldown items are checklist items (sets/reps are display text only).
 * restSec 0 = no rest (go straight to the superset partner).
 */
function buildStarter_() {
  var list = [];
  var muscles = {
    "Push": "Chest · Shoulders · Triceps",
    "Pull": "Back · Biceps · Rear Delts",
    "Legs (Machine)": "Quads · Hamstrings · Glutes · Calves",
    "Upper Body": "Supersets · Chest · Back · Shoulders · Arms",
    "Legs (Free Weight)": "Quads · Glutes · Hamstrings · Calves",
  };

  function add(workout, section, items) {
    var w = list.filter(function (x) { return x.name === workout; })[0];
    if (!w) { w = { name: workout, muscles: muscles[workout] || "", sections: [] }; list.push(w); }
    w.sections.push({ name: section, items: items });
  }

  // ---------------- PUSH ----------------
  add("Push", "Warm-Up", [
    ["Treadmill Incline Walk", "", "5 min", "", "", "5 km/h, 6% incline"],
    ["Arm Circles", "", "15+15", "", "", ""],
    ["Band Pull-Aparts", 2, 15, "", "", ""],
    ["Band Dislocations", 2, 12, "", "", ""],
    ["Push-Ups (slow)", 2, 10, "", "", ""],
    ["Scapular Push-Ups", 1, 12, "", "", ""],
  ]);
  add("Push", "Workout", [
    ["Flat Barbell Bench Press", 4, "8-10", 90, "2-1-2-0", "2 warm-up sets first. Retract shoulder blades, slight arch, drive feet into floor."],
    ["Cable Fly (Low-to-High)", 3, "12-15", 60, "2-1-3-1", "Cables at lowest. Bring hands to chin height. Squeeze 1 sec at top."],
    ["Seated DB Overhead Press", 3, "10-12", 75, "2-0-2-0", "Back supported. Press straight up. Don't lock out."],
    ["Lateral Raises", 3, "12-15", 60, "2-1-3-0", "Lead with elbows. Shoulder height only. 3-sec negative. Light weight."],
    ["Tricep Rope Pushdowns", 3, "12-15", 60, "2-0-2-1", "Elbows pinned. Split rope at bottom, squeeze 1 sec."],
    ["Overhead DB Tricep Extension", 3, "10-12", 60, "3-0-2-0", "Both hands, one DB behind head. Elbows forward. 3-sec negative."],
  ]);
  add("Push", "Cooldown", [
    ["Chest Doorway Stretch", "", "30s/side", "", "", "Opens pecs"],
    ["Cross-Body Shoulder Stretch", "", "30s/arm", "", "", ""],
    ["Overhead Tricep Stretch", "", "30s/arm", "", "", ""],
    ["Deep Breathing", "", "1 min", "", "", "4-7-8 pattern"],
  ]);

  // ---------------- PULL ----------------
  add("Pull", "Warm-Up", [
    ["Rowing Machine", "", "5 min", "", "", ""],
    ["Band Pull-Aparts", 2, 15, "", "", ""],
    ["Dead Hangs", 2, "20 sec", "", "", ""],
    ["Scapular Pull-Ups", 2, 10, "", "", ""],
    ["Light DB Curls", 1, 15, "", "", ""],
  ]);
  add("Pull", "Workout", [
    ["Barbell Bent-Over Row", 4, "8-10", 90, "2-1-2-0", "1 warm-up set at 50%. Hinge 45°, pull to lower chest, squeeze shoulder blades."],
    ["Lat Pulldown (Wide Grip)", 3, "10-12", 75, "2-1-3-0", "Pull to upper chest. 3-sec negative. Think 'elbows to hips'."],
    ["Single-Arm DB Row", 3, "10-12", 60, "2-1-2-0", "Each arm (rest 60s per arm). Pull to hip, not chest. Let DB stretch lat at bottom."],
    ["Face Pulls", 3, "15-20", 60, "2-0-2-1", "Cable at chest height. Pull to forehead. External rotation at top."],
    ["EZ-Bar Curl", 3, "10-12", 60, "2-0-2-0", "Elbows pinned. No swinging. Squeeze at top."],
    ["Incline DB Curl", 3, "10-12", 60, "3-0-2-1", "30° incline bench. Arms hanging. 3-sec negative."],
  ]);
  add("Pull", "Cooldown", [
    ["Lat Stretch", "", "30s/side", "", "", ""],
    ["Seated Forward Fold", "", "45s", "", "", ""],
    ["Bicep Wall Stretch", "", "30s/side", "", "", ""],
    ["Deep Breathing", "", "1 min", "", "", ""],
  ]);

  // ---------------- LEGS (MACHINE) ----------------
  add("Legs (Machine)", "Warm-Up", [
    ["Leg Swings (front-to-back)", "", "15/leg", "", "", ""],
    ["Leg Swings (side-to-side)", "", "15/leg", "", "", ""],
    ["Glute Bridges", 2, 15, "", "", ""],
    ["Hip Openers / Fire Hydrants", "", "12/leg", "", "", ""],
    ["Hamstring Sweeps", "", "10/leg", "", "", ""],
    ["World's Greatest Stretch", "", "5/side", "", "", ""],
  ]);
  add("Legs (Machine)", "Workout", [
    ["Leg Extensions", 3, "12-15", 60, "2-0-2-2", "Hold squeeze at top 2 sec. Start light as knee warm-up."],
    ["Leg Curls (Lying/Seated)", 3, "12-15", 60, "2-1-2-0", "Squeeze at peak 1 sec. Don't lift hips off pad."],
    ["Leg Press", 4, "10-12", 90, "3-1-2-0", "1 warm-up set at 50%. 3-sec negative. Don't lock knees. Press through heels."],
    ["Hip Abduction", 3, 15, 45, "2-1-2-1", "Push knees outward. Hold open position 1 sec."],
    ["Hip Adduction", 3, 15, 45, "2-1-2-1", "Pull knees inward. Prevents groin strains."],
    ["Hip Thrust (Machine/Barbell)", 3, "10-12", 75, "2-1-2-1", "Squeeze hard at top 1 sec. Drive through heels."],
    ["Standing Calf Raise", 3, "12-15", 45, "2-2-2-1", "Full ROM. 2-sec hold top and bottom."],
  ]);
  add("Legs (Machine)", "Cooldown", [
    ["Standing Quad Stretch", "", "30s/leg", "", "", ""],
    ["Standing Hamstring Stretch", "", "30s/leg", "", "", ""],
    ["Hip Flexor Stretch (half-kneeling)", "", "30s/side", "", "", ""],
    ["Child's Pose", "", "1 min", "", "", ""],
  ]);

  // ---------------- UPPER BODY (SUPERSETS) ----------------
  add("Upper Body", "Warm-Up", [
    ["Jump Rope / Jumping Jacks", "", "3 min", "", "", ""],
    ["Band Pull-Aparts", 2, 15, "", "", ""],
    ["Band Dislocations", 1, 12, "", "", ""],
    ["Push-Ups", 1, 12, "", "", ""],
    ["Light Lat Pulldown", 1, 15, "", "", ""],
  ]);
  add("Upper Body", "Workout", [
    ["Incline DB Press", 3, "10-12", 0, "2-0-2-0", "Superset: go straight to Seated Cable Row, no rest.", "S1"],
    ["Seated Cable Row", 3, "10-12", 75, "2-1-2-0", "Rest after both.", "S1"],
    ["Arnold Press", 3, "10-12", 0, "2-0-2-0", "Superset: go straight to Pull-Ups/Assisted, no rest.", "S2"],
    ["Pull-Ups/Assisted", 3, "8-10", 75, "2-0-2-1", "Rest after both.", "S2"],
    ["Hammer Curls", 3, 12, 0, "2-0-2-0", "Superset: go straight to Skull Crushers, no rest.", "S3"],
    ["Skull Crushers (EZ-bar)", 3, 12, 60, "2-1-2-0", "Rest after both.", "S3"],
    ["Face Pulls", 3, 15, 0, "2-0-2-1", "Superset: go straight to Hanging Leg Raises, no rest.", "S4"],
    ["Hanging Leg Raises", 3, "12-15", 60, "2-0-2-1", "Rest after both.", "S4"],
  ]);
  add("Upper Body", "Cooldown", [
    ["Chest Doorway Stretch", "", "30s/side", "", "", ""],
    ["Lat Stretch", "", "30s/side", "", "", ""],
    ["Cross-Body Shoulder Stretch", "", "30s/arm", "", "", ""],
    ["Deep Breathing", "", "1 min", "", "", ""],
  ]);

  // ---------------- LEGS (FREE WEIGHT) ----------------
  add("Legs (Free Weight)", "Warm-Up", [
    ["Leg Swings (front-to-back)", "", "15/leg", "", "", ""],
    ["Leg Swings (side-to-side)", "", "15/leg", "", "", ""],
    ["Glute Bridges", 2, 15, "", "", ""],
    ["Hip Openers / Fire Hydrants", "", "12/leg", "", "", ""],
    ["Hamstring Sweeps", "", "10/leg", "", "", ""],
    ["World's Greatest Stretch", "", "5/side", "", "", ""],
  ]);
  add("Legs (Free Weight)", "Workout", [
    ["Goblet Squat (DB/KB)", 3, 12, 75, "3-1-2-0", "Hold at chest. Elbows inside knees. Go deep. 3-sec negative."],
    ["Dumbbell RDL", 3, "10-12", 75, "3-1-2-0", "DBs close to legs. Hinge at hips. Flat back always."],
    ["Hip Thrust (BW or light)", 3, "10-12", 75, "2-1-2-1", "Lighter than machine day. 3-sec hold at top if bodyweight."],
    ["Weighted Walking Lunges", 3, 12, 90, "2-1-2-0", "Each leg, 24 total steps/set. Torso upright. Start light (8-10 kg each hand)."],
    ["Weighted Sumo Squat Pulse", 3, 15, 60, "1-0-1-0", "Wide stance, toes 45° out. Pulse in bottom half."],
    ["Seated Calf Raise", 3, "15-20", 45, "2-2-2-1", "Targets soleus. Full stretch at bottom."],
  ]);
  add("Legs (Free Weight)", "Cooldown", [
    ["Standing Quad Stretch", "", "30s/leg", "", "", ""],
    ["Pigeon Pose", "", "45s/side", "", "", ""],
    ["Seated Hamstring Stretch", "", "45s", "", "", ""],
    ["Frog Stretch", "", "45s", "", "", ""],
    ["Child's Pose", "", "1 min", "", "", ""],
  ]);

  return list;
}

/** Pure: starter plan -> {rows: 8-column string rows, types: per-row type for formatting}. */
function starterRows_() {
  var rows = [];
  var types = [];
  function push(arr, type) {
    var r = [];
    for (var i = 0; i < REF_COLS; i++) r.push(arr[i] === undefined || arr[i] === null ? "" : String(arr[i]));
    rows.push(r);
    types.push(type);
  }

  push(["NOTE", "HOW TO EDIT: to add an exercise, insert a row inside a section and fill in Exercise (Sets / Reps / Rest / Tempo / Notes are optional). Leave column A empty."], "note");
  push(["NOTE", "Superset: give both exercises the same id in the Superset column (e.g. S1) and set Rest = 0 on the first one."], "note");
  push(["NOTE", "New workout: copy a whole WORKOUT block and rename it - a log tab with the same name is created automatically."], "note");
  push(["NOTE", 'Sections whose name contains "warm" or "cool" are checklists; any other section logs sets. Column A only holds WORKOUT / SECTION (or NOTE).'], "note");
  push([], "blank");

  buildStarter_().forEach(function (w) {
    push(["WORKOUT", w.name, w.muscles], "workout");
    w.sections.forEach(function (s) {
      var kind = kindOf_(s.name);
      push(["SECTION", s.name], kind);
      push(["", "Exercise", "Sets", "Reps", "Rest (sec)", "Tempo", "Superset", "Notes"], "header");
      s.items.forEach(function (it) {
        push(["", it[0], it[1], it[2], it[3], it[4], it[6] || "", it[5]], "item");
      });
      push([], "blank");
    });
    push([], "blank");
  });
  return { rows: rows, types: types };
}

/** Replaces the whole Reference tab (content + formatting) with the starter plan. */
function writeStarterReference_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(REF_SHEET) || ss.insertSheet(REF_SHEET);
  sh.clear();
  var s = starterRows_();
  var need = s.rows.length + 30; // spare rows so you can insert exercises
  if (sh.getMaxRows() < need) sh.insertRowsAfter(sh.getMaxRows(), need - sh.getMaxRows());

  // Plain text so "8-10" / "12-15" are never parsed as dates.
  sh.getRange(1, 1, sh.getMaxRows(), REF_COLS).setNumberFormat("@");
  sh.getRange(1, 1, s.rows.length, REF_COLS).setValues(s.rows);

  var style = {
    workout: ["#0b3d91", "#ffffff"],
    warm: ["#1e8e3e", "#ffffff"],
    work: ["#f9ab00", "#202124"],
    cool: ["#1a73e8", "#ffffff"],
    header: ["#e8eaed", "#202124"],
  };
  s.types.forEach(function (t, i) {
    var rng = sh.getRange(i + 1, 1, 1, REF_COLS);
    if (style[t]) {
      rng.setBackground(style[t][0]).setFontColor(style[t][1]).setFontWeight("bold");
      if (t === "workout") rng.setFontSize(14);
    } else if (t === "note") {
      rng.setFontColor("#5f6368").setFontStyle("italic");
    }
  });

  var widths = [90, 280, 55, 90, 85, 85, 80, 520];
  widths.forEach(function (w, i) { sh.setColumnWidth(i + 1, w); });
  sh.setFrozenRows(0);
  SpreadsheetApp.flush();
  Logger.log("Reference written: " + s.rows.length + " rows.");
}
