# Workout Tracker — Task List

Legend: `[ ]` todo · `[~]` in progress / needs your action · `[x]` done · `[-]` dropped (reason given)

## Approach change
The original plan (React PWA + Dexie + Google OAuth + hosting) is replaced by **one Apps Script project bound to the Google Sheet**. `doGet` serves one HTML page; the page calls server functions via `google.script.run`. Original task IDs (T-xxx) are kept below so nothing is silently lost. New tasks use `N-xxx`.
All new code lives in `apps-script/`. The Vite/React scaffold in the repo root is unused.

## Decisions
- Backend: Apps Script web app (execute as me, access: only myself)
- Log: single `Log` tab: `Timestamp | Date | Workout | Exercise | Set | Weight (kg) | Reps | SetId | Notes`
- Reference: `Workout | Section | Order | Group | Exercise | Target Sets | Target Reps | Rest (sec) | Tempo | Notes`, seeded by `seedReference()` (plain-text cells so "8-10" is not parsed as a date)
- Not offline-first: rely on cellular + localStorage retry queue; server dedupes by `SetId`
- Analytics: later (backlog)

## Phase 0: Sheet + project setup (DO FIRST)
- [x] T-001 Initialize project repository (Git) — remote `origin` set; push pending (you)
- [~] T-005 Project structure — `apps-script/` created (Code.gs, Seed.gs done; index.html pending)
- [ ] T-010 Create Google Sheet *(changed: `Reference` + single `Log` tab, not 5 workout tabs)* — **you**
- [~] T-011 Populate Reference with all exercise data — `Seed.gs` written; **you run `seedReference()`**
- [~] T-012 Add headers to log sheet — `setup()` written; **you run `setup()` first**
- [ ] N-001 Paste `Code.gs`, `Seed.gs` into Apps Script, run `setup()` then `seedReference()`, check Reference tab — **you**
- [-] T-002 Scaffold React + TS with Vite — not used
- [-] T-003 Living Design — not used (policy question moot)
- [-] T-004 ESLint + Prettier — not used
- [-] T-006 `.env.example` — no env: script is bound to the Sheet
- [-] T-007 IntelliJ run configs — nothing to run locally
- [-] T-008 Google Cloud project + Sheets API — not needed
- [-] T-009 OAuth credentials — not needed (script runs as you)

## Phase 1: Core app shell (was "Core PWA Setup")
- [ ] T-013 Home screen name/meta *(changed: page title + `apple-mobile-web-app-capable` via `addMetaTag`; no manifest.json)*
- [ ] T-014 App icon *(changed: optional, via `setFaviconUrl`)*
- [ ] T-017 Test "Add to Home Screen" on iPhone Safari
- [ ] T-018 Verify opens full screen (no browser chrome)
- [-] T-015 Service Worker — not possible in Apps Script iframe
- [-] T-016 vite-plugin-pwa — not used
- [-] T-017a First-launch onboarding — no sign-in/Sheet ID needed; replaced by N-001

## Phase 2: Google Auth
- [-] T-019 – T-022, T-024 — no auth code; web app runs as you
- [-] T-023 Handle auth errors — merged into T-042 (red sync state)

## Phase 3: Sheets service layer (server, `Code.gs`)
- [ ] T-025 Sheets service module (read/write abstraction)
- [ ] T-026 `getData`: read Reference
- [ ] T-027 `logSets`: append rows
- [ ] T-028 `getData`: last session data per exercise (excludes today)
- [ ] T-029 Batch write (flush multiple queued sets)
- [ ] T-030 Error handling + retry (client side)
- [ ] T-031 Test read/write with the actual Sheet
- [ ] N-002 Server dedupe by `SetId` + script lock (retries never duplicate)
- [ ] N-003 `deleteSet(setId)` for undo
- [ ] N-004 Recover Date-parsed cells (if Sheets turns "8-10" into a date)

## Phase 4: Local storage (was IndexedDB)
- [ ] T-033 Define localStorage schema (queue, cached reference, sessions, settings) *(changed from Dexie tables)*
- [ ] T-034 "Save set locally" (always first)
- [ ] T-035 Sync queue (pending sets)
- [ ] T-036 Flush queue to Sheet
- [ ] T-037 Cache Reference data locally
- [ ] T-038 Cache refresh (refresh on every launch)
- [ ] T-038a Show cached instantly, refresh in background
- [ ] T-038b Manual refresh *(changed: Home refresh button; pull gesture not native in standalone)*
- [ ] T-038c "Refresh Exercise Data" button in Settings
- [ ] T-038e Mid-workout isolation (cache updates, current session unchanged)
- [ ] T-038f Stale cache banner (>7 days)
- [-] T-032 Install/configure Dexie.js — localStorage instead
- [-] T-038d Cache-age auto refresh — merged into T-038 (refresh every launch)

## Phase 5: Auto-sync engine
- [ ] T-039 Online/offline detection (`online`, `visibilitychange`, interval; failure = truth)
- [ ] T-040 Auto-sync on reconnect
- [ ] T-041 Real-time sync when online (after each set)
- [ ] T-042 Sync status indicator (green synced / orange N queued / **red error**)
- [ ] T-043 Handle sync failures (keep in queue, retry) + 25s timeout guard on `google.script.run`
- [ ] T-044 Test offline → online transition

## Phase 6: UI — Home screen
- [ ] T-045 Home layout (5 workout cards)
- [ ] T-046 Design workout cards
- [ ] T-047 Muscle group labels
- [ ] T-048 Sync status indicator on home
- [ ] T-049 Navigation Home → Section selection

## Phase 7: UI — Section selection
- [ ] T-050 Layout (Warm-Up, Workout, Cooldown)
- [ ] T-051 Exercise count per section (from cached Reference)
- [ ] T-052 Section completion status
- [ ] T-053 Back navigation to Home
- [ ] T-054 Navigation Section → Exercise list

## Phase 8: UI — Warm-Up & Cooldown
- [ ] T-055 Checklist layout
- [ ] T-056 Name, duration/reps, notes
- [ ] T-057 Tap-to-complete
- [ ] T-058 "All Done" button
- [ ] T-059 Persist checklist state for current session

## Phase 9: UI — Workout exercise list
- [ ] T-060 Scrollable exercise cards
- [ ] T-061 Card states (not started / in progress / completed)
- [ ] T-062 Summary on completed cards
- [ ] T-063 Tap-to-expand
- [ ] N-005 Superset badges (S1 A/B); no timer when rest = 0

## Phase 10: UI — Set logging
- [ ] T-064 Expanded card details (name, target, tempo, rest, notes, last-session hint)
- [ ] T-065 Set input rows (weight + reps, steppers)
- [ ] T-066 Smart weight defaults (previous set → last session)
- [ ] T-067 "Log Set" saves locally + triggers sync
- [ ] T-068 Completed sets shown read-only
- [ ] N-006 Undo last set (removes from queue, or `deleteSet` on server)
- [ ] T-069 Mark exercise complete when all sets logged
- [ ] T-070 Optional Notes per set (writes to Log `Notes` column)

## Phase 11: Rest timer
- [ ] T-071 Timer component (end-timestamp based, survives screen lock)
- [ ] T-072 Auto-start after logging a set
- [ ] T-073 Vibration *(changed: not supported on iOS; call kept for Android)*
- [ ] T-074 Skip/dismiss
- [ ] T-075 Visual + audio cue at end
- [ ] T-076 Test timer cues on iPhone *(changed from vibration test)*
- [ ] N-007 Screen Wake Lock during workout

## Phase 12: Workout complete
- [ ] T-077 Complete summary screen
- [ ] T-078 Total workout time
- [ ] T-079 Exercises completed count
- [ ] T-080 Sync status (all synced vs X pending)
- [ ] T-081 Navigation back to Home

## Phase 13: Settings
- [ ] T-082 Minimal settings screen
- [ ] T-085 Manual "Force Sync"
- [ ] T-086 Clear local cache (warn if queue not empty)
- [ ] T-087 App version display
- [-] T-083 Sheet ID config — script is bound to the Sheet
- [-] T-084 Google account / sign-out — no auth

## Phase 14: Edge cases
- [ ] T-090 Corrupted/blocked localStorage (try/catch, reset)
- [ ] T-091 Missing/renamed sheet tabs (clear error message)
- [ ] T-093 Restore session state after app crash/reload
- [ ] T-094 Storage quota exceeded
- [-] T-092 Concurrent sessions — merged into N-002 (lock + SetId dedupe)
- [-] T-088 Sheets API rate limits — retry in T-043 is enough
- [-] T-089 Expired Google tokens — no tokens

## Phase 15: Testing (manual, hacky app)
- [ ] T-102 iPhone Safari testing (Add to Home Screen, timer, audio, queue)
- [ ] T-103 Screen sizes (iPhone SE, 15, 15 Pro Max)
- [ ] N-008 `node --check` on page script + server code review
- [-] T-095 – T-100b Unit/component/E2E tests — deferred (manual testing for now)
- [-] T-101 Lighthouse PWA audit — not a real PWA here

## Phase 16: Deployment
- [ ] N-009 Deploy as web app (Execute as: Me, Access: Only myself); new version per change — **you**
- [ ] T-110 Install on iPhone and log a real workout end-to-end — **you**
- [ ] N-010 README with setup/deploy steps
- [-] T-104 Hosting choice, T-105 CI/CD, T-106 custom domain, T-107 HTTPS, T-108 prod env vars, T-109 Lighthouse — Apps Script hosts it over HTTPS

## Backlog
### Analytics (Phase 17, was in plan)
- [ ] T-111 Progressive overload tracking (weight trends per exercise)
- [ ] T-112 Volume analysis (sets × reps × weight per session)
- [ ] T-113 Consistency tracking (expected vs actual days, schedule swaps)
- [ ] T-114 Frequency analysis (days between each workout type)
- [ ] T-115 Personal records detection
- [ ] T-116 Dashboard view (Sheet charts or separate web view)
### Other
- [ ] B-001 Cardio log (15–20 min incline walk after every workout)
- [ ] B-002 Body-weight log
- [ ] B-003 Sessions tab (start/end time, warm-up/cooldown completion)
- [ ] B-004 Offline page load (static hosting + service worker, Apps Script as write endpoint)
- [ ] B-005 Edit (not just undo) of logged sets
- [ ] B-006 Skip/swap exercise; extra sets
- [ ] B-007 Pull-to-refresh gesture

## Verify on device
- Home-screen icon stays signed in with "Only myself" (else deploy as "Anyone" + secret param)
- localStorage works inside the Apps Script iframe on iOS Safari (queue persistence)
