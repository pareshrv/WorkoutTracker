# Workout Tracker

Phone-friendly workout logger. One Google Apps Script project bound to a Google Sheet serves the page and writes every set to the Sheet. **Everything the app shows (workouts, sections, exercises) comes from the `Reference` tab, and each workout gets its own log tab.**

> The Vite + React files in the repo root (`src/`, `index.html`, `package.json`, …) are an unused scaffold. The app is in `apps-script/`.

## Files
| File | What |
|---|---|
| `apps-script/Code.gs` | Server: `setupAndSeed()`, `getData`, `logSets`, `deleteSet`, `doGet`, `testServer()` |
| `apps-script/index.html` | The app page (must be named `index` in Apps Script) |
| `TASKS.md` | Task list / status |

## The Reference tab
Column A is a tag. Colored bands make it readable:

| A | B | C | D | E | F | G | H |
|---|---|---|---|---|---|---|---|
| `WORKOUT` | Push | Chest · Shoulders · Triceps | | | | | |
| `SECTION` | Warm-Up | | | | | | |
| | Exercise | Sets | Reps | Rest (sec) | Tempo | Superset | Notes |
| | Band Pull-Aparts | 2 | 15 | | | | |
| `SECTION` | Workout | | | | | | |
| | Flat Barbell Bench Press | 4 | 8-10 | 90 | 2-1-2-0 | | Retract shoulder blades… |

- **Add an exercise:** insert a row inside the section and fill in at least the Exercise column. Leave column A empty.
- **Add a workout:** copy a whole `WORKOUT` block, paste it below, rename it. A log tab with the same name is created automatically (when the app loads or you run `syncLogTabs`).
- **Sections:** a name containing "warm" is a green checklist, containing "cool" is a blue checklist, anything else is a yellow section where you log sets.
- **Superset:** give both exercises the same id (e.g. `S1`) and set Rest to `0` on the first one.
- Rows starting with `NOTE` in column A are comments. The app shows any problems it finds (duplicate workout, stray rows, …) as banners on Home.
- Renaming a workout starts a **new** log tab (no "last workout" history from the old tab).

## Log tabs
One tab per workout, named after it: `Timestamp | Date | Exercise | Set | Weight (kg) | Reps | SetId | Notes`.
Tabs are created automatically. A tab that already exists with other columns (e.g. the old `Log` tab) is never touched; if a workout has the same name you'll get a warning.

## Body weight
The Home screen has a separate dashed **Body Weight** card (below the workouts). Tap it, enter your weight (± buttons or type), optional note, **Save**. Today's date is stored automatically in a `Weight` tab (`Timestamp | Date | Weight (kg) | Notes | EntryId`), created if missing. Recent entries show with the change since the previous one; Undo removes today's last entry. Entries sync through the same offline queue as sets.
To track more later (arm, chest, waist…) add a line to `METRICS` at the top of `Code.gs`; a tab and a Home card appear automatically.

## Setup / update
1. In your Sheet: Extensions → Apps Script. Replace the whole `Code.gs` with `apps-script/Code.gs`.
2. File **`index`** (HTML): replace its contents with `apps-script/index.html`.
3. Run **`setupAndSeed`** (approve permissions if asked). If `Reference` has no `WORKOUT` rows (empty or old layout) it is rewritten with the starter plan; otherwise your Reference is kept. Log tabs are created for every workout.
   - To throw away your Reference edits and restore the starter plan: run `resetReferenceToStarter`.
4. Run **`testServer`**; expect the popup `ALL PASS (5 workouts)`.
5. *(Optional, once)* Run **`migrateOldLog`** to copy sets from the old single `Log` tab into the per-workout tabs, so "Last workout" shows your earlier sessions. It's safe to re-run and leaves the old `Log` tab alone (delete it later).

### Try it
Deploy → **Test deployments** → open the `/dev` URL (always runs the latest saved code).

### Install on iPhone
1. Deploy → New deployment → **Web app**, Execute as **Me**, access **Only myself** (to update an existing deployment: Deploy → Manage deployments → ✏ → Version: **New version**; the Home Screen icon keeps working).
2. Open the `/exec` URL in Safari → Share → **Add to Home Screen**.

## Test checklist
1. `testServer` → `ALL PASS`.
2. Home shows a card per `WORKOUT` in Reference, in alternating colors. Section screen: Warm-Up green, Workout yellow, Cooldown blue.
3. Log a set → a row appears in that workout's tab (not in others); the pill stays green `Synced`; rest timer starts.
4. Next time you open the same exercise: a blue **LAST WORKOUT** box shows the previous session's sets (and a `Last (date): …` line on the collapsed card). No box for exercises you never logged.
5. Undo removes the row. Airplane mode → pill turns orange `N queued`; back online → rows appear once.
6. Add `Push1` (copy the Push block, rename) → Home → ↻ Refresh → a new card appears and a `Push1` tab exists; log a set and it lands in `Push1`.
7. Change a rest time in Reference → Home → ↻ Refresh → new value on the next workout open.
8. Upper Body supersets: logging the first exercise jumps to its partner, no timer until the second.
9. Finish: the **Finish Workout** button appears on the section screen only after every warm-up, workout and cooldown item is complete. After finishing, the Home card says `Completed today ✓`.
