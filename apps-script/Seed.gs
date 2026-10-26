/**
 * Reference data from the workout plan.
 * Row format per item: [exercise, sets, reps, restSec, tempo, notes, group]
 *  - Warm-Up / Cooldown items are checklist items (sets/reps are display text only).
 *  - group: superset id (e.g. "S1"); items in a group are ordered A, B by Order.
 *  - restSec 0 = no rest (go straight to the superset partner).
 */
function buildSeedRows_() {
  var out = [];

  function add(workout, section, items) {
    items.forEach(function (it, i) {
      out.push([
        workout,
        section,
        i + 1,
        it[6] || "",
        it[0],
        it[1] === undefined ? "" : it[1],
        it[2] === undefined ? "" : it[2],
        it[3] === undefined ? "" : it[3],
        it[4] === undefined ? "" : it[4],
        it[5] === undefined ? "" : it[5],
      ]);
    });
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

  return out;
}

/**
 * Writes the Reference tab. Safe to re-run: replaces all data rows.
 * Cells are formatted as plain text first so values like "8-10" or "12-15"
 * are not converted to dates by Sheets.
 */
function seedReference() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var ref = ss.getSheetByName(REF_SHEET);
  if (!ref) throw new Error("Run setup() first (Reference tab not found).");

  var rows = buildSeedRows_().map(function (r, i) {
    if (r.length !== REF_HEADERS.length) {
      throw new Error("Seed row " + (i + 1) + " has " + r.length + " columns, expected " + REF_HEADERS.length);
    }
    return r.map(function (c) { return String(c); });
  });

  var needed = rows.length + 1;
  if (ref.getMaxRows() < needed) ref.insertRowsAfter(ref.getMaxRows(), needed - ref.getMaxRows());

  ref.getRange(2, 1, ref.getMaxRows() - 1, REF_HEADERS.length).clearContent();
  ref.getRange(2, 1, rows.length, REF_HEADERS.length).setNumberFormat("@").setValues(rows);
  SpreadsheetApp.flush();
  Logger.log("Seeded " + rows.length + " Reference rows.");
}
