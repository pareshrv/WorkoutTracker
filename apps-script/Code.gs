// Workout Tracker — server side (Google Apps Script, bound to the Sheet).

var REF_SHEET = "Reference";
var LOG_SHEET = "Log";

var REF_HEADERS = [
  "Workout", "Section", "Order", "Group", "Exercise",
  "Target Sets", "Target Reps", "Rest (sec)", "Tempo", "Notes",
];

var LOG_HEADERS = [
  "Timestamp", "Date", "Workout", "Exercise", "Set",
  "Weight (kg)", "Reps", "SetId", "Notes",
];

/**
 * Run once from the Apps Script editor: creates/formats the Reference and Log tabs.
 * Then run seedReference() (Seed.gs) to fill the Reference tab.
 */
function setup() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  var ref = ss.getSheetByName(REF_SHEET) || ss.insertSheet(REF_SHEET);
  // Plain text so "8-10" / "12-15" are never parsed as dates.
  ref.getRange(1, 1, ref.getMaxRows(), REF_HEADERS.length).setNumberFormat("@");
  ref.getRange(1, 1, 1, REF_HEADERS.length).setValues([REF_HEADERS]).setFontWeight("bold");
  ref.setFrozenRows(1);

  var log = ss.getSheetByName(LOG_SHEET) || ss.insertSheet(LOG_SHEET);
  log.getRange(1, 1, 1, LOG_HEADERS.length).setValues([LOG_HEADERS]).setFontWeight("bold");
  log.setFrozenRows(1);
  log.getRange("A2:A").setNumberFormat("yyyy-mm-dd hh:mm:ss");
  log.getRange("B2:B").setNumberFormat("yyyy-mm-dd");
  log.getRange("H2:I").setNumberFormat("@"); // SetId + Notes stay text

  SpreadsheetApp.flush();
  Logger.log("Setup done. Next: run seedReference().");
}
