# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

Node.js was installed to `C:\Program Files\nodejs\` and may not be in PATH for all shells. If `npm` is not found, use PowerShell with:

```powershell
$env:Path = 'C:\Program Files\nodejs\;' + $env:Path
npm run dev
```

```bash
npm run dev       # start Vite dev server at http://localhost:5173
npm run build     # production build → dist/
npm run preview   # serve the dist/ build locally
```

There are no tests or linter configured in this project.

If the browser shows stale UI, a previous Node process may still own port 5173 and Vite silently moved to 5174. Kill all Node processes before restarting:

```powershell
Get-Process -Name 'node' -ErrorAction SilentlyContinue | Stop-Process -Force
```

## Resetting demo data

`seedDemoData()` only runs when `dss_students` is absent from localStorage. After changing seed data in `storage.js`, clear the browser's localStorage to re-seed:

```js
// browser DevTools console
localStorage.clear()
```

Then refresh the page.

## Architecture

**React SPA** with a required Python/FastAPI backend for CP-SAT scheduling. All state is persisted in `localStorage`. No routing library — active view is managed via `useState('schedule')` in `App.jsx`. Auto Schedule requires the CP-SAT backend — if unreachable, it shows an error. Six pages: Schedule, Classes, Teachers, Students, Rooms, and Help (DocsPage).

### Data flow

`App.jsx` calls `useStudioData()` (the single source of truth), then passes entity arrays and CRUD callbacks as props to each page. There is no context or global state.

### Key files

| File | Role |
|---|---|
| `src/services/storage.js` | Pure localStorage I/O. Four services (`studentsService`, `teachersService`, `roomsService`, `classesService`), each with `getAll()` and `save()`. Also contains `seedDemoData()` which runs once on first load. |
| `src/hooks/useStudioData.js` | Owns all React state. Exposes `students`, `teachers`, `rooms`, `classes` arrays plus `studentCrud`, `teacherCrud`, `roomCrud`, `classCrud` objects. Each crud object has `add`, `update`, `remove`; `classCrud` also has `enroll`, `unenroll`, and `updateMany`. `teacherCrud.update` and `roomCrud.update` extend the base behavior: after saving, they call `unscheduleInvalidClasses()` to automatically unschedule any classes that no longer fall within the updated availability. |
| `src/utils/conflicts.js` | `detectConflicts(candidate, allClasses)` — used in `ClassForm` for real-time warnings. `findAllConflictingIds(allClasses)` — O(n²) scan used for conflict badges on the Classes list and `ClassBlock` tinting. |
| `src/utils/availability.js` | `isWithinAvailability(availability, dayOfWeek, startTime, durationMinutes)` — returns true if the class fits inside an availability window. Applies a **1-minute inset**: checks `classStart+1` through `classEnd-1`, so a class can start/end exactly at an availability boundary. `detectAvailabilityWarnings(candidate, teacher, room)` — called alongside `detectConflicts` in `ClassForm`. |
| `src/utils/timeHelpers.js` | Grid positioning math: `timeToRow`, `durationToRowSpan`. Constants: `DAYS`, `GRID_START_HOUR` (15), `GRID_START_MIN` (30), `GRID_END_HOUR` (21), `GRID_END_MIN` (30), `SLOT_MINUTES` (15), `TOTAL_SLOTS` (24). |
| `src/utils/optimizerCPSAT.js` | `optimizeWithCPSAT(classes, teachers, rooms, onProgress, timeoutSeconds, externalSignal)` — calls the CP-SAT backend and merges results. When `onProgress` is provided, uses the streaming SSE endpoint (`/api/optimize/stream`) and fires `{ message, scheduled, total, elapsed }` on each improved solution; otherwise calls `POST /api/optimize` (non-streaming). The optional `externalSignal` (an `AbortSignal`) is merged with the internal timeout signal via a `makeSignal()` helper so either source can cancel the fetch. Fetch timeout = `(timeoutSeconds + 300) * 1000` ms (5-min buffer on top of solver time); when `timeoutSeconds === 0` ("Until Optimal"), fetch timeout is 5 days. Also exports `isCPSATAvailable()` — hits `/api/health` with a 2s timeout. |
| `src/utils/exportSchedule.js` | `exportScheduleToExcel(classes, teachers, rooms, students, visibleDays, visibleRooms, colorMode)` — ExcelJS-based export that mirrors the room-subdivided weekly grid. `colorMode` (`'teacher'` \| `'skillLevel'`) controls block fill colors, matching the Schedule page toggle. |
| `src/utils/exportPDF.js` | `exportScheduleToPDF(gridElement)` — html2canvas + jsPDF export. Captures the inner `.weekly-grid` element (not the overflow wrapper) to avoid clipping. Uses a custom page size wide enough to fit the full grid aspect ratio. |
| `src/pages/DocsPage/DocsPage.jsx` | Help page. Renders `README.md` and `USER-GUIDE.md` as tabbed markdown (using the `marked` library). README tab is shown first by default. Imports the markdown files as raw strings via Vite's `?raw` import. A **Print** button in the tab bar calls `window.print()`; `@media print` in `DocsPage.css` hides the sidebar, sidebar toggle, and tab bar so only the document content prints. Code blocks and blockquotes are capped at `max-width: 700px`. |
| `src/pages/SchedulePage/AnalyticsPanel.jsx` | Modal shown after Auto Schedule completes. Displays summary stat cards, Teacher Workload, Room Utilization, Day Distribution, Genre Breakdown, and Skill Level Breakdown tables. Receives `analytics` object (computed in `App.jsx handleAutoSchedule`) and `onClose` prop. |

### Data schema (localStorage)

```js
// dss_teachers
{ id, name, genre: string[], specialties: string[], phone, email, color: "#hex", availability: [{dayOfWeek, startTime, endTime}] }

// dss_rooms
{ id, name, capacity: number, availability: [{dayOfWeek, startTime, endTime}] }

// dss_students
{ id, name, age: number, skillLevel: "Beg/Int (6-10)" | "Beg/Int (10+)" | "Int/Adv (6-10)" | "Int/Adv (10+)" }

// dss_classes
{ id, name, style, skillLevel: string, teacherId, roomId, dayOfWeek, startTime: "HH:MM", durationMinutes: number, enrolledStudentIds: [] }

// dss_schedule_progress
{ messages: string[], scheduled: number|null, total: number|null, analytics: object|null }
```

`availability` empty array = no restriction (always available).

`dayOfWeek` and `startTime` are empty strings `''` for unscheduled classes.

### Seed data defaults

- **Teachers (6):** Suzan Ponthier (`#0984e3` blue), Mark Ponthier (`#6c5ce7` purple), Virginia Nuckolls (`#00b894` green), Julia Ponthier (`#e17055` coral), Jake Ponthier (`#d63031` red), Doc Nuckolls (`#fd79a8` pink) — specialties span all 10 genres (see below)
- **Rooms:** Tots, Pink, Green, Blue — capacity 25 each
- **Availability (teachers & rooms):** Mon–Fri, 3:30pm–9:30pm
- **Classes:** 60 classes across all 10 genres, seeded with **no teacher, no day/time, no room** assigned. Each class has a `skillLevel` pre-assigned (`BI6` = Beg/Int (6-10), `BI10` = Beg/Int (10+), `IA6` = Int/Adv (6-10), `IA10` = Int/Adv (10+)). Skill levels are evenly distributed: **15 classes per level**. Duration distribution: 25 classes at 60 min; 13 at 45 min; 8 at 75 min; 7 at 90 min; 5 at 30 min; 1 at 105 min; 1 at 120 min. Mini/young classes → 30 min; beginners/mini-level → 45 min; mid-advanced → 75 min; teen/team/advanced → 90 min; advanced technique → 105 min; top-level advanced → 120 min. Teen-prefixed classes are `BI10`; Elite/Company variants for younger students are `BI6` or `IA6` as appropriate.
- **Students:** one per skill level — Emma Johnson (Beg/Int 10+), Liam Park (Int/Adv 10+), Sofia Rivera (Int/Adv 10+), Noah Chen (Beg/Int 6-10), Olivia Williams (Int/Adv 10+), Ava Martinez (Int/Adv 6-10)
- **Phone format:** `555-010-000X` (fake/demo — e.g. `555-010-0001`)
- **Email format:** `firstname.lastname@tdc-demo.com` (fake/demo)

### Teacher genres & class genres

`GENRES` (used as checkboxes in TeacherForm, dropdown in ClassForm):
`Ballet, Contemporary, Hip Hop, Jazz, Lyrical, Musical Theater, Pointe, Tap, Drill, All-Star`

The UI label is **Genre** everywhere. Teacher `genre` is stored as an array of strings. A teacher with no genres set is **never** eligible for any class that has a genre. ClassForm filters the teacher dropdown to only show teachers whose `genre` array includes the selected class genre (case-insensitive). Changing genre clears the teacher if they are no longer eligible.

`teachersService.getAll()` includes a migration shim: if a loaded teacher record is missing `genre`, it copies the value from `specialty` (old field name); if missing `specialties`, it copies from `priorityGenres` (old field name). This preserves existing localStorage data after the field renames.

**Specialty for Scheduling (`specialties`):** Each teacher has a `specialties: string[]` field (a subset of their `genre`). Configured in `TeacherForm` under a **"Specialty for Scheduling"** checkbox section that only shows genres the teacher can already teach (sorted alphabetically); unchecking a genre automatically removes it from `specialties`. In the CP-SAT solver (`solver.py`), a `priority_score` term is added to the objective (weighted by `PRIORITY_BONUS = 70`, 10× the max day weight, between day score and `BIG_M`) to prefer assigning classes to specialty-for-scheduling teachers. `BIG_M` is recalculated as `len(unscheduled) * (PRIORITY_BONUS + max_day_weight) + 1` to maintain objective hierarchy: more classes > priority teacher matches > earlier days. In `ClassBlock`, the teacher name is rendered bold and underlined when the assigned teacher has the class genre in their `specialties`.

### Weekly grid (Schedule page)

CSS Grid: time label column + variable data columns (per-day room counts), 2 header rows (day headers row, room sub-headers row) + 24 fifteen-minute slot rows (3:30pm–9:30pm). The corner cell spans both header rows. `TIME_ROW_OFFSET = 3` so time slot rows start at CSS grid row 3.

**Time range & granularity:** Grid runs 3:30pm–9:30pm (`GRID_START_HOUR = 15`, `GRID_START_MIN = 30`, `GRID_END_HOUR = 21`, `GRID_END_MIN = 30`). Slots are 15 minutes each (`SLOT_MINUTES = 15`), giving 24 total slots. Classes snap to 15-minute boundaries.

**Per-day room columns:** Each day shows only the rooms that have availability on that day (`isRoomAvailableOnDay` helper). Days with no available rooms render no columns. Column layout uses cumulative offsets (`dayColStart` map) rather than a fixed `numRooms * dayIdx` formula. `getCol(day, ri)` returns the CSS grid column for a given day name and room index within that day's available rooms.

**Unavailable slots:** Slots outside a room's availability window are rendered in medium grey (`#b0b0b0`, CSS class `.slot-unavailable`) with a white italic "N/A" label. `isRoomSlotAvailable(room, day, slotIndex)` uses strict `>` for the end-time check (slot at exactly `endTime` is grey). Drag-over/drop validation uses `isWithinAvailability` only — not `isRoomSlotAvailable` — so the full class duration is checked, not just the start slot.

**Lane-based overlap layout:** `RoomColumn` component (`position: relative`, `pointer-events: none`) spans all time rows for its (day, room) column. Class blocks inside are `position: absolute` with top/height computed from `slotHeight`. `assignLanes()` groups overlapping classes into side-by-side lanes. Class blocks have `pointer-events: auto`.

**Day visual distinction:** All slot cells are white (no alternating tint between days). Thick solid left border (`border-left: 4px solid`) on the first room column of each day. Day headers: even = `#500000` (deep maroon), odd = `#732f2f` (lighter maroon), both with white text. Room sub-headers: even = `#f9f0f0`, odd = `#ede8e8`. These colors match the Excel export exactly.

**Hour delineation:** Slots at hour boundaries (4:00pm, 5:00pm, …) receive `.hour-boundary` class, styled with `border-top: 1px dashed #b0a0a0` across both slot cells and the time label column. Time labels are shown every 30 minutes (every 2 slots) in consistent `H:MMpm` format (e.g. `4:00pm`, `4:30pm`). Excel export mirrors this using a **dashed black `bottom` border on the cell immediately before each hour boundary** (not a `top` border on the hour cell itself) — this is required because Excel resolves shared cell edges by the heavier style, and a solid `thin` bottom from the preceding cell would override a `dashed` top on the hour cell.

**Day visibility toggles:** Row of day chips above the grid. Only days where at least one room has availability are shown (`daysWithRooms = DAYS.filter(...)`). Active days = filled maroon buttons; clicking a day hides its columns. Managed via `hiddenDays` Set in state. `visibleDays` is derived from `daysWithRooms` (not all `DAYS`) so the grid and toggles stay consistent.

**Zoom controls:** `+` / `−` / `↺` buttons in the `.toolbar-right` group. Zoom range 60%–200%, default 100%. All grid dimensions (slot height, header heights, time label column width, room column min-width) are derived from base constants multiplied by the zoom factor. `slotHeight` is passed as a prop to `RoomColumn` so class block positioning scales correctly.

**Color mode toggle:** Segmented control (Teacher / Skill Level) in `.toolbar-right` alongside zoom. Controls `colorMode` state (`'teacher'` | `'skillLevel'`), passed as a prop through `RoomColumn` → `ClassBlock`. In `ClassBlock`, `SKILL_COLORS` maps each skill level to a hex accent color (`Beg/Int (6-10)` → `#e67e22`, `Beg/Int (10+)` → `#2980b9`, `Int/Adv (6-10)` → `#27ae60`, `Int/Adv (10+)` → `#8e44ad`); the accent is lightened 72% for the block background and used full-strength for the left border.

Base constants in `SchedulePage.jsx`:
```js
const BASE_DAY_HDR   = 52   // day header row height (px)
const BASE_ROOM_HDR  = 28   // room sub-header row height (px)
const BASE_SLOT      = 30   // 15-min slot height (px)
const BASE_TIME_COL  = 56   // time label column width (px)
const BASE_COL_MIN   = 90   // room column minimum width (px)
const TIME_ROW_OFFSET = 3   // CSS grid row where time slots begin (2 header rows + 1-based)
```

**Teacher, room & skill level filters:** Multi-select dropdown panels in the page header. Each filter is a button that opens a checkbox list. The button label shows "All …" when nothing is selected, the item name when exactly one is selected, or "N …" for multiple. A "Clear selection" link appears inside the dropdown when any items are chosen. Clicking outside closes any open dropdown. Room filter also controls which room sub-columns are rendered (`visibleRooms`). State: `filterTeacherIds`, `filterRoomIds`, and `filterSkillLevels` are `Set` objects. Skill level filter matches on `c.skillLevel || ''`.

**Auto Schedule button:** Clicking opens a `ConfirmDialog` (confirm label "Schedule") with a dynamic message based on the current `solverTimeout` value. Async. Calls `optimizeWithCPSAT` with an `onProgress` callback that updates `scheduleProgress` state for real-time progress display. If the backend is unreachable or the fetch times out, an error message is shown. Shows a `cursor: wait` and "Scheduling…" button label while running. A `stopwatchSecs` counter increments every second via `setInterval` while `optimizing === true`; displayed in `HH:MM:SS` format via `fmtStopwatch()` in `SchedulePage.jsx`. While the solver is running, an **Abort** button appears next to the "Scheduling…" button; clicking it calls `onAbort` prop → `handleAbort` in `App.jsx` → `abortControllerRef.current.abort()`. The catch block distinguishes `AbortError` from other errors and shows "Scheduling aborted." in the progress messages. `App.jsx` creates a fresh `AbortController` per run stored in `abortControllerRef`. Export to Excel and Export to PDF buttons are also disabled while `optimizing === true`. Result message format: `"Scheduled N classes. M assigned to a specialty teacher. Could not place: X, Y. (CP-SAT, 3.2s)"`. The "Could not place" and specialty sentences are omitted when not applicable.

**Solver Timeout control:** A `<select>` dropdown in the toolbar (label "Timeout") lets the user choose the solver time limit. Default is **180 seconds**. Options range from 1m to 10m. A special **"Until Optimal"** option (value `0`) appears at the end of the list — when selected, the backend skips setting `max_time_in_seconds` entirely so CP-SAT runs until it proves optimality (gap = 0%). Fetch timeout for "Until Optimal" is 5 days; the Abort button is the practical way to stop early. The confirmation dialog shows a tailored message for this option. `solverTimeout` state in `SchedulePage` is passed to `onAutoSchedule(solverTimeout)`. Fetch timeout for timed options is `(timeoutSeconds + 300) * 1000` ms.

**Streaming progress & analytics:** `App.jsx` maintains `scheduleProgress` state (`{ messages: [], scheduled: null, total: null, analytics: null }`). The `onProgress` callback from `optimizeWithCPSAT` pushes progress updates into this state; `SchedulePage` renders progress messages while the solver runs. After the solver finishes, `handleAutoSchedule` computes an `analytics` object and stores it in `scheduleProgress.analytics`. `analytics.solverInfo` contains solver quality fields returned by the backend: `{ solverStatus, isOptimal, objectiveValue, bestBound, optimalityGapPct, wallTime }` (see CP-SAT backend section). When analytics are present, a **View Analytics** button appears in the `.optimize-messages-footer`; clicking it opens `AnalyticsPanel` (a `Modal` with `size="xl"`, max-width 980px). The analytics modal layout: Row 1 = four summary stat cards (Classes Scheduled, Not Placed, Specialty Matches, Solve Time). Row 2 = **Solver Quality** horizontal strip showing: Status badge (green = Optimal, amber = Feasible), Optimality Gap progress bar (green = 0%, yellow < 5%, orange < 20%, red ≥ 20%) with "Provably optimal" note at 0%, Objective Value, Best Bound. Row 3 = three-column grid: Teacher Workload | Room Utilization + Day Distribution | Genre Breakdown + Skill Level Breakdown. The Clear button in the footer resets `scheduleProgress` (including `analytics: null`) and closes the modal. `AnalyticsPanel.jsx` and `AnalyticsPanel.css` are co-located in `src/pages/SchedulePage/`. `scheduleProgress` is **persisted to `localStorage`** under the key `dss_schedule_progress`: it is initialized from `localStorage.getItem('dss_schedule_progress')` on first render and synced back on every update via `useEffect`. This means progress messages, result summaries, and analytics survive page reloads, browser tab switches, and the app sitting idle. The state is cleared when the user clicks Clear or starts a new Auto Schedule.

**Clear Schedule button:** Opens a `ConfirmDialog` (title "Confirm Clear", confirm label "Clear") before resetting all classes to `dayOfWeek: '', startTime: '', roomId: '', teacherId: ''`.

**Export to PDF / Export to Excel / Clear Schedule / Auto Schedule buttons:** All styled as `btn btn-primary` (maroon). Export to Excel and Export to PDF buttons are disabled when `classes.length === 0` (no classes exist at all) **or** when `optimizing === true` (Auto Schedule is running). Clear Schedule button is disabled when no classes are scheduled (`scheduledClasses.length === 0`).

**Drag & drop rescheduling:** Class blocks are `draggable`. Grid slot divs are drop targets — each carries `day`, `roomId`, and `slotIndex`. Behavior differs by source:
- **Unscheduled class dropped onto grid:** `findEligibleTeachers()` returns all genre-matching, availability-passing, conflict-free teachers. If none exist the drop is blocked. Otherwise a teacher-picker modal appears so the user selects which teacher to assign.
- **Already-scheduled class dragged to a new slot:** `findAvailableTeacher()` auto-assigns (verifies existing teacher passes availability + is free, or finds the first eligible one). Drop is blocked if no valid teacher exists.

Both functions check teacher availability via `isWithinAvailability` (full class duration, with 1-minute inset) in addition to conflict-checking. Room availability is also validated with `isWithinAvailability` in the drag handlers — `isRoomSlotAvailable` is **not** used for drop validation, only for visual slot coloring.

Drop validation enforces three additional constraints via helpers in `SchedulePage.jsx`:
- `isRoomFreeForSlot(roomId, day, slotIndex, durationMinutes, excludeClassId, allClasses)` — blocks drop if another class already occupies the target room at an overlapping time.
- `hasSkillLevelConflict(skillLevel, day, slotIndex, durationMinutes, excludeClassId, allClasses)` — blocks drop if another class with the same non-empty `skillLevel` overlaps on the same day.
- Both checks are applied in `handleSlotDragOver` (prevents highlight) and `handleSlotDrop` (prevents commit).

`slotIndexToTime(slotIndex)` converts grid row back to `"HH:MM"`.

**Unscheduled panel:** Shown below the grid when any classes lack a day/time. Chips are sorted alphabetically by class name. Draggable chips can be dropped onto the grid to schedule them into a specific day + room slot. Chips are colored by skill level using the same `SKILL_COLORS` map as `ClassBlock` (background = full color + `22` alpha hex, left border = full color). Falls back to teacher color if no skill level is set. The `SKILL_COLORS` constant is defined locally in `SchedulePage.jsx` (matching `ClassBlock.jsx` and `exportSchedule.js`) — keep all three in sync. The sorted `unscheduledClasses` array is also passed to `exportScheduleToExcel` (Sheet 2) and `exportScheduleToPDF` (page 2), so export order matches the panel.

**Right-click context menu:** Right-clicking a class block shows a context menu with "Unschedule class". Selecting it opens a `ConfirmDialog`; confirming resets that class to `dayOfWeek: '', startTime: '', roomId: '', teacherId: ''`.

**Class detail panel:** Left-clicking a class block opens `ClassDetailPanel` — a read-only overlay (`.detail-overlay`) showing the class name, genre, day, time range, duration, teacher, room, and enrolled students list. Clicking outside the panel or the × button closes it.

`ClassBlock` displays class name, teacher name, skill level, and time range (start–end, shown when `cls.startTime` is set). Room is omitted — it's already shown as the column header. The teacher name is rendered **bold and underlined** when the assigned teacher has the class genre in their `specialties` (Specialty for Scheduling). Text is always black (`#000000`) regardless of color mode or background color. Text wraps (`word-break: break-word`) rather than truncating. The hover tooltip includes the same fields plus the time range. Block background and border coloring is controlled by `colorMode` (see Color mode toggle above).

### Export to Excel (`src/utils/exportSchedule.js`)

Uses ExcelJS. Mirrors the room-subdivided weekly grid exactly, with per-day room filtering:

- **Row 1:** Corner cell (spans 2 rows) + day headers merged across that day's available room sub-columns. Even days `#500000`, odd days `#732F2F`, white bold text. Days with no available rooms are omitted entirely.
- **Row 2:** Room sub-headers (only rooms available on that day). Even days `#F9F0F0`, odd days `#EDE8E8`.
- **Rows 3+:** 24 time slot rows at 24pt height. All available slots white (`#FFFFFF`). Unavailable slots (outside room availability): solid medium grey `#B0B0B0` fill with white italic "N/A" text centered. Time label in column 1 every 30 minutes in `H:MM AM/PM` format. The cell immediately before each hour boundary has a dashed black `bottom` border (not a `top` on the hour cell — see Hour delineation note above). Day-start columns have a solid medium left border. Thick medium black outer border on all four edges of the full grid.
- **Class blocks:** Merged cells spanning slot rows. Color follows the `colorMode` parameter: in `'teacher'` mode, teacher color lightened 78% for fill and full color for font/border; in `'skillLevel'` mode, the matching `SKILL_COLORS` hex lightened 72% for fill and full color for font/border (matching `ClassBlock` exactly). Displays class name, teacher name, skill level, and time range. Uses ExcelJS **rich text** (`cell.value = { richText: [...] }`) so each line can carry its own font; the teacher name segment gets `underline: true` when the teacher has the class genre in their `specialties`. `try/catch` around `mergeCells` handles overlapping classes gracefully. **Any future visual change to `ClassBlock` must be mirrored here.**
- **Sheet 2:** Unscheduled classes as a styled flat list. The call site in `SchedulePage.jsx` always passes all unscheduled classes separately (appended after `visibleClasses`) so Sheet 2 is never filtered empty by the active teacher/room/skill-level filters.
- Uses `dayColStart` map and `getCol(day, ri)` for per-day column offsets (days can have different room counts).
- Local constants: `GRID_START_HOUR = 15`, `GRID_START_MIN = 30`, `SLOT_MINUTES = 15`, `TOTAL_SLOTS = 24`. `timeToSlot` accounts for the `:30` start offset.
- Accepts `visibleDays`, `visibleRooms`, and `colorMode` so filters and the color toggle applied in the UI are respected. `colorMode` defaults to `'teacher'` if omitted. `SKILL_COLORS` in `exportSchedule.js` must stay in sync with `SKILL_COLORS` in `ClassBlock.jsx`.
- Downloads via `Blob` + `URL.createObjectURL`.

### Export to PDF (`src/utils/exportPDF.js`)

Uses html2canvas + jsPDF.

- Signature: `exportScheduleToPDF(gridElement, unscheduledClasses = [], teachers = [], colorMode = 'teacher')`.
- Captures the inner `.weekly-grid` element (not the `.grid-wrapper` overflow container) using `target.scrollWidth`/`scrollHeight` so the full grid is captured without clipping.
- Page size: at minimum A4 landscape (297×210mm); expands width proportionally if the grid aspect ratio requires it.
- Title ("The Dance Collective McKinney — Weekly Schedule") and generation date printed above the grid image.
- Grid image scaled with `Math.min(scaleByW, scaleByH)` to fit within available area.
- If `unscheduledClasses` is non-empty, a **second page** is appended with the title "The Dance Collective McKinney — Unscheduled Classes" and a subtitle showing the count. The page contains a styled table with columns: Class, Genre, Skill Level, Duration, Teacher. Rows are colored by skill level or teacher color (matching the `colorMode` parameter), lightened 82%.
- Unavailable slots render as solid `#B0B0B0` medium grey (CSS background-color), which html2canvas captures reliably. Do not use CSS gradients or patterns for unavailability — html2canvas does not render `repeating-linear-gradient` consistently.

### CP-SAT scheduling backend (`backend/`)

Optional Python FastAPI backend for OR-Tools CP-SAT scheduling. If the backend is unreachable or times out, `handleAutoSchedule` in `App.jsx` catches the error and shows an error message — there is no greedy fallback.

**Setup & run:**
```bash
cd backend
py -3 -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --port 8000
```

**Files:**
- `backend/main.py` — FastAPI app. CORS allows `localhost:5173` and `localhost:5174`. Custom HTTP middleware adds `Access-Control-Allow-Private-Network: true` to all responses (required by Chrome for cross-port localhost requests). Endpoints: `POST /api/optimize`, `POST /api/optimize/stream` (SSE), `GET /api/health`.
- `backend/solver.py` — CP-SAT model. Enumerates all feasible (class, day, start, room, teacher) assignments filtered by availability (1-minute inset) and genre eligibility. Uses **optional interval variables + `AddNoOverlap`** for room, teacher, and skill-level conflict constraints (much more efficient than pairwise). Pre-filters assignments that conflict with already-scheduled classes. Objective (in priority order): maximize classes scheduled (primary, `BIG_M`) → prefer `specialties`-matched teacher assignments (`PRIORITY_BONUS = 70`) → prefer earlier days Monday→Sunday → minimize distinct (teacher, day) working pairs (`TEACHER_DAY_WEIGHT = 1`). `BIG_M` is computed to dominate all lower-priority terms combined, including the teacher-day upper bound. Solver time limit: `timeoutSeconds - 5` (5s buffer for enumeration overhead); when `timeoutSeconds === 0` ("Until Optimal"), `max_time_in_seconds` is not set at all and CP-SAT runs until it proves the optimal gap is 0%. The result dict includes solver quality fields: `solverStatus` (string: "Optimal" / "Feasible (time limit reached)" / "No solution"), `isOptimal` (bool), `objectiveValue` (int), `bestBound` (int), `optimalityGapPct` (float 0–100), `wallTime` (float seconds). These flow through `optimizerCPSAT.js` → `App.jsx` → `scheduleProgress.analytics.solverInfo`.
- `backend/requirements.txt` — fastapi, uvicorn[standard], ortools, pydantic.

**Streaming SSE endpoint (`/api/optimize/stream`):** Runs the solver in a background thread. A `ProgressCallback` fires each time CP-SAT finds an improved solution, pushing `{ type: 'progress', message, scheduled, total, elapsed }` events onto a queue. The async generator reads from the queue and streams SSE lines to the frontend. Ends with a `{ type: 'result', data: { scheduled, unscheduled } }` event. The frontend `optimizerCPSAT.js` parses these events and calls the `onProgress` callback for each progress event.

**Timeouts:** Solver time limit = `timeoutSeconds - 5` seconds (default `timeoutSeconds = 120` from the API, but the UI defaults to **180**); when `timeoutSeconds === 0`, no time limit is set. Frontend fetch timeout = `(timeoutSeconds + 300) * 1000` ms (generous buffer to cover the enumeration phase and streaming overhead); for `timeoutSeconds === 0` the fetch timeout is 5 days.

**Chrome Private Network Access:** When the React app at `localhost:5173` fetches `localhost:8000`, Chrome enforces a preflight check requiring `Access-Control-Allow-Private-Network: true`. This is handled by the HTTP middleware in `main.py` — do not remove it.

### Optimizer rules

Hard constraints enforced by the CP-SAT solver (`backend/solver.py`), drag/drop handlers, and ClassForm teacher dropdown in `SchedulePage.jsx` and `ClassForm.jsx`:

1. **Teacher genre match** — teacher's `genre` array must include the class's genre. Teachers with no genres set are never eligible for any class that has a genre.
2. **Teacher availability** — class must fall within the teacher's availability window (1-minute inset: class can start/end exactly at a boundary).
3. **Room availability** — class must fall within the room's availability window (same 1-minute inset).
4. **Teacher no-overlap** — a teacher cannot teach two classes at the same time on the same day.
5. **Room no-overlap** — two classes cannot occupy the same room at the same time on the same day.
6. **Skill level no-overlap** — two classes with the same non-empty skill level cannot overlap on the same day (across any rooms).
7. **Grid boundaries** — class must start and end within 3:30pm–9:30pm, snapped to 15-minute slots.
8. **Pre-assigned teacher respected** — if a class already has a `teacherId`, only that teacher is used (if their genre no longer matches, the class is skipped entirely by the optimizer).
9. **Pre-assigned room preferred** — if a class already has a `roomId`, that room is tried first before others.

Soft preferences (CP-SAT objective, in priority order): maximize classes scheduled (primary, `BIG_M`) → prefer teacher with class genre in their `specialties` (`PRIORITY_BONUS = 70`) → prefer earlier days Monday→Sunday → minimize distinct (teacher, day) working pairs (`TEACHER_DAY_WEIGHT = 1`).

### Tables (Classes, Students, Teachers, Rooms pages)

All tables support sortable columns via `sortKey`/`sortDir` state and a `SortTh` component that renders a clickable header with ▲/▼ indicators.

- **Classes:** columns are Class, Skill Level, Teacher, Day & Time, Room, Duration, Students (in that order). Sortable by all columns. Three multi-select filters: skill level, duration, and teacher (teacher includes "Unassigned" sentinel `'__unassigned__'`). State: `filterTeacherIds` (Set), `filterSkillLevels` (Set), `filterDurations` (Set). Duration filter options are derived dynamically from the current class data (sorted ascending). Skill level displayed as a color-coded badge using `SKILL_BADGE` (same mapping as Students page). Duration field in ClassForm is a `<select>` restricted to 15-minute increments between 30 and 120 minutes (30, 45, 60, 75, 90, 105, 120). **Save Classes / Load Classes** buttons in the page header via `exportClassesToFile` / `importClassesFromFile` (`classes-YYYY-MM-DD.json`).
- **Students:** sortable by all columns; skill level filter is a multi-select dropdown (checkbox list). State: `filterSkills` (Set). **Save Students / Load Students** buttons in the page header via `exportStudentsToFile` / `importStudentsFromFile` (`students-YYYY-MM-DD.json`).
- **Teachers:** sortable by Name, Genre, Specialty, Phone, Email, Classes (Availability column not sortable). Genre and Specialty columns display values sorted alphabetically. When adding a new teacher, the color picker pre-selects the first `PRESET_COLORS` entry not already used by another teacher. **Save Teachers / Load Teachers** buttons in the page header via `exportTeachersToFile` / `importTeachersFromFile` (`teachers-YYYY-MM-DD.json`).
- **Rooms:** sortable by Name, Capacity (Availability column not sortable). Delete uses `ConfirmDialog`. **Save Rooms / Load Rooms** buttons in the page header via `exportRoomsToFile` / `importRoomsFromFile` (`rooms-YYYY-MM-DD.json`).

Per-entity Save/Load functions are in `src/services/storage.js`. Export format: `{ version, exportedAt, <entity>: [...] }`. Import functions validate that the entity array is present, then resolve with the array — the caller (page component or `App.jsx` Sidebar handler) calls `crud.loadAll(records)` to update state without a page reload. The Sidebar Save/Load buttons also handle entity-specific save/load (see Sidebar section).

Unscheduled classes display "Unscheduled" instead of a time string. Always guard against empty `startTime` before calling `formatTime` or `addMinutes`.

### Shared UI components

- **`src/components/Modal.jsx`** — Generic modal wrapper with `title`, `onClose`, and optional `size` prop (`"lg"` = 660px default, `"xl"` = 980px). `modal-xl` class is defined in `Modal.css`.
- **`src/components/ConfirmDialog.jsx`** — Confirmation prompt with `message`, `onConfirm`, `onCancel`, `title` (default `'Confirm Delete'`), and `confirmLabel` (default `'Delete'`). Used for destructive actions (deleting rooms, unscheduling classes, clearing the schedule). Pass custom `title` and `confirmLabel` to override the defaults.

### Class detail panel (`src/pages/SchedulePage/ClassDetailPanel.jsx`)

Read-only overlay triggered by clicking a `ClassBlock`. Displays class name, genre, day, time range, duration, teacher, room (with capacity), and a list of enrolled students. Props: `cls`, `teacher`, `room`, `students`, `onClose`. Clicking the backdrop (`.detail-overlay`) or the × button closes it.

### Availability editor (`src/components/AvailabilityEditor.jsx`)

Same grid layout as the Schedule page but interactive — click/drag to paint 30-minute cells. Internally converts between the `[{dayOfWeek, startTime, endTime}]` slot format and a `Set` of `"DayName:slotIndex"` keys. Adjacent painted cells are merged back into contiguous slots on mouseup. Accepts a `color` prop (teachers pass their chosen hex color; rooms use the default `#6c5ce7`). Used in both `TeacherForm` and `RoomForm`.

The editor defines its own local constants **independent of `timeHelpers.js`**:
- `GRID_START_HOUR = 15`, `GRID_START_MIN = 30` (3:30pm)
- `SLOT_MINUTES = 30` (30-minute increments — coarser than the schedule grid's 15-min slots)
- `TOTAL_SLOTS = 12` (6 hours × 2 slots/hr, 3:30pm–9:30pm). Imports `GRID_END_HOUR` and `GRID_END_MIN` from `timeHelpers.js` to compute this.

All time labels show every slot (every 30 min) in consistent `H:MMp` format (e.g. `3:30p`, `4:00p`).

**If `TOTAL_SLOTS` changes, the CSS in `AvailabilityEditor.css` must be updated to match** — specifically `grid-template-rows: 28px repeat(12, 16px)` where the repeated count equals `TOTAL_SLOTS`.

**React anti-pattern to avoid:** Do not call a parent `onChange` prop inside a `setCells` functional state updater. React 18 treats state updaters as part of the render phase; calling another component's state setter there triggers "Cannot update a component while rendering a different component". The fix: maintain a `cellsRef` that mirrors `cells` state, and call `onChange(setToSlots(cellsRef.current))` directly in the `mouseup` handler — outside any state updater.

### Sidebar (`src/components/Sidebar.jsx`)

Maroon background (`#500000`). White text throughout. Width: `--sidebar-width: 290px` (set in `App.css`). Displays the studio logo/name at the top, nav links in the middle (Schedule, Classes, Teachers, Students, Rooms, Help), the TDC logo image (`src/assets/TDC.jpg`, 75% width, centered) below the nav, then a spacer, then **Save Data / Load Data buttons**, then a footer showing "The Dance Collective McKinney" at the bottom.

**Collapsible sidebar:** A **‹** toggle button sits in the top-right of the sidebar logo area. Clicking it sets `sidebarOpen` state (in `App.jsx`) to `false`, which adds `.sidebar-hidden` to the `<aside>` (CSS `transform: translateX(-100%)`) and `.sidebar-collapsed` to `.app-layout` (shifts `app-main` `margin-left` to `0`). Both transitions use `0.22s ease`. When hidden, a fixed-position **›** button (`.sidebar-show-btn`) is rendered in `App.jsx` (outside the sidebar) at the left viewport edge — clicking it restores the sidebar. The show button must live in `App.jsx`, not inside `<aside>`, so it remains visible after the sidebar slides off-screen.

Nav item icons use `color: initial` inline to prevent the parent's `rgba(255,255,255,0.65)` from washing out emoji colors.

**Save / Load buttons** — context-aware, dispatched from `App.jsx` (`handleExport` / `handleImport`). Button labels update to match the active page ("Save Classes", "Save Teachers", etc. — "Save Data" only on Schedule/Help). Behavior:

| Active page | Save | Load |
|---|---|---|
| Classes | `exportClassesToFile()` → `classes-YYYY-MM-DD.json` | `importClassesFromFile` → `classCrud.loadAll` (no reload) |
| Students | `exportStudentsToFile()` → `students-YYYY-MM-DD.json` | `importStudentsFromFile` → `studentCrud.loadAll` (no reload) |
| Teachers | `exportTeachersToFile()` → `teachers-YYYY-MM-DD.json` | `importTeachersFromFile` → `teacherCrud.loadAll` (no reload) |
| Rooms | `exportRoomsToFile()` → `rooms-YYYY-MM-DD.json` | `importRoomsFromFile` → `roomCrud.loadAll` (no reload) |
| Schedule / Help | `exportDataToFile()` → `dance-studio-YYYY-MM-DD.json` (all four entities) | `importDataFromFile` → `window.location.reload()` |

- Entity-specific imports use `dataRef.current` to access current CRUD methods (avoids stale closure in the async handler).
- Import error (bad JSON or missing array key) shows an `alert`. File input value is reset after each pick.
- Entity-specific Load buttons also appear in each page's own header (same functions, redundant for discoverability).

### CSS conventions

Global custom properties in `src/App.css` (`:root`). Each component/page has a co-located `.css` file. No CSS Modules, no CSS-in-JS, no Tailwind.

**Theme:** TAMU maroon. Key variables:
- `--color-primary: #500000` (maroon)
- `--color-primary-dark: #3c0000`
- `--color-primary-light: #732f2f`
- `--color-primary-subtle: #f9f0f0`
- Font: Work Sans (Google Fonts)

**Sidebar** (`src/components/Sidebar.css`): maroon background matching the primary button color. White text, `rgba(255,255,255,0.10)` hover, `--color-primary-dark` active state.

### Known pitfalls

- **Batch updates:** Never call `classCrud.update()` in a loop — each call reads stale React state and only the last write survives. Use `classCrud.updateMany(updatedList)` instead.
- **Empty startTime:** Classes without a schedule have `startTime: ''`. Always guard: `cls.startTime ? formatTime(cls.startTime) : 'Unscheduled'` before formatting.
- **Genre matching:** Teacher `genre` is an array; use `teacher.genre.some(s => s.toLowerCase() === style.toLowerCase())` for eligibility checks. Legacy data may have `genre` as a string — handle both. Teachers with an empty `genre` array are **never** eligible for classes with a genre (no wildcard behavior). `teachersService.getAll()` migrates old `specialty`/`priorityGenres` field names automatically.
- **PDF clipping:** Always pass the inner `.weekly-grid` element to `html2canvas`, not the `.grid-wrapper`. The wrapper has `overflow-x: auto` which clips the canvas to the visible scroll area.
- **PDF gradients:** html2canvas does not reliably render `repeating-linear-gradient`. Use solid `background-color` for any fills that must appear in the PDF export.
- **Excel merge conflicts:** Overlapping classes in the same room column will attempt to merge already-merged cells. Wrap `ws.mergeCells()` in `try/catch` to render without merge rather than throwing.
- **Zoom and slot height:** `RoomColumn` must receive `slotHeight` as a prop (not use the module-level constant) so class block top/height positions scale correctly when zoom changes.
- **Per-day column layout:** `getCol` in both `SchedulePage.jsx` and `exportSchedule.js` uses a `dayColStart` map rather than a fixed `dayIdx * numRooms` formula, because different days can have different numbers of available rooms. Never assume uniform room counts across days.
- **timeHelpers vs AvailabilityEditor constants:** `timeHelpers.js` uses `SLOT_MINUTES = 15` (schedule grid granularity). `AvailabilityEditor.jsx` defines its own local `SLOT_MINUTES = 30` (availability painting granularity). `exportSchedule.js` also defines its own local constants matching `timeHelpers.js`. Keep these in sync intentionally — they are meant to be independent.
- **AvailabilityEditor onChange in state updater:** Never call `onChange` inside a `setCells(prev => ...)` updater — this triggers the React 18 "Cannot update during render" warning. Use a `cellsRef` to track current cells and call `onChange` directly in the event handler instead.
- **Auto-unschedule on availability edit:** `teacherCrud.update` and `roomCrud.update` in `useStudioData.js` automatically unschedule any classes that no longer fall within the updated availability (`isWithinAvailability` check). This resets `dayOfWeek`, `startTime`, `roomId`, and `teacherId` to `''` for affected classes. This happens silently — no toast or confirmation.
- **1-minute availability inset:** `isWithinAvailability` checks `classStart+1` through `classEnd-1` against the availability window. This means a class can start or end exactly at an availability boundary (e.g. a class ending at 9:30pm is valid when availability ends at 9:30pm). All scheduling paths (drag/drop, Auto Schedule, ClassForm warnings) use this function and inherit the inset.
- **Drag/drop availability gating:** Drop validation checks: (1) `isWithinAvailability` for room and teacher availability windows, (2) `isRoomFreeForSlot` to prevent two classes sharing a room at the same time, (3) `hasSkillLevelConflict` to prevent same-skill-level classes overlapping on the same day, (4) teacher free/eligible checks. `isRoomSlotAvailable` is used only for visual slot coloring, not drop validation.
