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

**React SPA, no backend.** All state is persisted in `localStorage`. No routing library — active view is managed via `useState('schedule')` in `App.jsx`.

### Data flow

`App.jsx` calls `useStudioData()` (the single source of truth), then passes entity arrays and CRUD callbacks as props to each page. There is no context or global state.

### Key files

| File | Role |
|---|---|
| `src/services/storage.js` | Pure localStorage I/O. Four services (`studentsService`, `teachersService`, `roomsService`, `classesService`), each with `getAll()` and `save()`. Also contains `seedDemoData()` which runs once on first load. |
| `src/hooks/useStudioData.js` | Owns all React state. Exposes `students`, `teachers`, `rooms`, `classes` arrays plus `studentCrud`, `teacherCrud`, `roomCrud`, `classCrud` objects. Each crud object has `add`, `update`, `remove`; `classCrud` also has `enroll`, `unenroll`, and `updateMany`. |
| `src/utils/conflicts.js` | `detectConflicts(candidate, allClasses)` — used in `ClassForm` for real-time warnings. `findAllConflictingIds(allClasses)` — O(n²) scan used for conflict badges on the Classes list and `ClassBlock` tinting. |
| `src/utils/availability.js` | `detectAvailabilityWarnings(candidate, teacher, room)` — checks teacher/room availability slots against a class's day/time. Called alongside `detectConflicts` in `ClassForm`. |
| `src/utils/timeHelpers.js` | Grid positioning math: `timeToRow`, `durationToRowSpan`. Constants: `DAYS`, `GRID_START_HOUR` (15), `GRID_END_HOUR` (22), `SLOT_MINUTES` (15), `TOTAL_SLOTS` (28). |
| `src/utils/optimizer.js` | `optimizeSchedule(classes, teachers, rooms) → updatedClasses[]` — greedy scheduler that assigns day/time/room/teacher to unscheduled classes. If a class has no teacher, it finds the first eligible teacher (by genre/specialty) who is available and conflict-free at the chosen slot. Sorts by duration descending. Returns only newly scheduled classes. |
| `src/utils/exportSchedule.js` | `exportScheduleToExcel(classes, teachers, rooms, students, visibleDays, visibleRooms)` — ExcelJS-based export that mirrors the room-subdivided weekly grid. |
| `src/utils/exportPDF.js` | `exportScheduleToPDF(gridElement)` — html2canvas + jsPDF export. Captures the inner `.weekly-grid` element (not the overflow wrapper) to avoid clipping. Uses a custom page size wide enough to fit the full grid aspect ratio. |

### Data schema (localStorage)

```js
// dss_teachers
{ id, name, specialty: string[], phone, email, color: "#hex", availability: [{dayOfWeek, startTime, endTime}] }

// dss_rooms
{ id, name, capacity: number, availability: [{dayOfWeek, startTime, endTime}] }

// dss_students
{ id, name, age: number, skillLevel: "Beginner/Intermediate (6-10)" | "Beginner/Intermediate (10+)" | "Intermediate/Advanced (6-10)" | "Intermediate/Advanced (10+)" }

// dss_classes
{ id, name, style, teacherId, roomId, dayOfWeek, startTime: "HH:MM", durationMinutes: number, enrolledStudentIds: [] }
```

`availability` empty array = no restriction (always available).

`dayOfWeek` and `startTime` are empty strings `''` for unscheduled classes.

### Seed data defaults

- **Teachers:** Suzan Ponthier (`#0984e3` blue), Mark Ponthier (`#6c5ce7` purple), Virginia Nuckolls (`#00b894` green) — specialties span all 10 genres (see below)
- **Rooms:** Tots, Pink, Green, Blue — capacity 25 each
- **Availability (teachers & rooms):** Mon–Fri, 3:30pm–10:00pm
- **Classes:** 30 classes across all 10 genres, seeded with **no teacher, no day/time, no room** assigned
- **Students:** one per skill level — Emma Johnson (Beginner/Intermediate 10+), Liam Park (Intermediate/Advanced 10+), Sofia Rivera (Intermediate/Advanced 10+), Noah Chen (Beginner/Intermediate 6-10), Olivia Williams (Intermediate/Advanced 10+), Ava Martinez (Intermediate/Advanced 6-10)
- **Phone format:** `xxx-xxx-xxxx`

### Teacher specialties & class genres

`SPECIALTIES` (used as checkboxes in TeacherForm, dropdown in ClassForm):
`Ballet, Contemporary, Hip Hop, Jazz, Lyrical, Musical Theater, Pointe, Tap, Drill, All-Star`

The UI label is **Genre** everywhere (not "Specialty" or "Style"). Teacher `specialty` is stored as an array of strings. ClassForm filters the teacher dropdown to only show teachers whose specialty array includes the selected class genre (case-insensitive). Changing genre clears the teacher if they are no longer eligible.

### Weekly grid (Schedule page)

CSS Grid: time label column + variable data columns (per-day room counts), 3 header rows (corner/day headers, room sub-headers) + 28 fifteen-minute slot rows (3pm–10pm).

**Time range & granularity:** Grid runs 3:00pm–10:00pm (`GRID_START_HOUR = 15`, `GRID_END_HOUR = 22`). Slots are 15 minutes each (`SLOT_MINUTES = 15`), giving 28 total slots. Classes snap to 15-minute boundaries.

**Per-day room columns:** Each day shows only the rooms that have availability on that day (`isRoomAvailableOnDay` helper). Days with no available rooms render no columns. Column layout uses cumulative offsets (`dayColStart` map) rather than a fixed `numRooms * dayIdx` formula. `getCol(day, ri)` returns the CSS grid column for a given day name and room index within that day's available rooms.

**Unavailable slots:** Slots outside a room's availability window are rendered with a solid light grey background (`#e0e0e0`, CSS class `.slot-unavailable`). Drag-over and drop are blocked on these slots via `isRoomSlotAvailable(room, day, slotIndex)`.

**Lane-based overlap layout:** `RoomColumn` component (`position: relative`, `pointer-events: none`) spans all time rows for its (day, room) column. Class blocks inside are `position: absolute` with top/height computed from `slotHeight`. `assignLanes()` groups overlapping classes into side-by-side lanes. Class blocks have `pointer-events: auto`.

**Day visual distinction:** Alternating day bands — even days white, odd days warm blush (`#fdf6f6`). Thick left border (`border-left: 2px`) on the first room column of each day. Day headers: even = `#500000` (deep maroon), odd = `#732f2f` (lighter maroon), both with white text. Room sub-headers: even = `#f9f0f0`, odd = `#ede8e8`. These colors match the Excel export exactly.

**Day visibility toggles:** Row of day chips above the grid. Only days where at least one room has availability are shown (`daysWithRooms = DAYS.filter(...)`). Active days = filled maroon buttons; clicking a day hides its columns. Managed via `hiddenDays` Set in state. `visibleDays` is derived from `daysWithRooms` (not all `DAYS`) so the grid and toggles stay consistent.

**Zoom controls:** `+` / `−` / `↺` buttons shown to the right of the day toggles. Zoom range 60%–200%, default 100%. All grid dimensions (slot height, header heights, time label column width, room column min-width) are derived from base constants multiplied by the zoom factor. `slotHeight` is passed as a prop to `RoomColumn` so class block positioning scales correctly.

Base constants in `SchedulePage.jsx`:
```js
const BASE_DAY_HDR  = 52   // day header row height (px)
const BASE_ROOM_HDR = 28   // room sub-header row height (px)
const BASE_SLOT     = 30   // 15-min slot height (px)
const BASE_TIME_COL = 56   // time label column width (px)
const BASE_COL_MIN  = 90   // room column minimum width (px)
```

**Teacher & room filters:** Multi-select dropdown panels in the page header. Each filter is a button that opens a checkbox list. The button label shows "All teachers/rooms" when nothing is selected, the item name when exactly one is selected, or "N teachers/rooms" for multiple. A "Clear selection" link appears inside the dropdown when any items are chosen. Clicking outside closes the dropdown. Room filter also controls which room sub-columns are rendered (`visibleRooms`). State: `filterTeacherIds` and `filterRoomIds` are `Set` objects (not strings). Filter logic: `filterTeacherIds.size === 0 || filterTeacherIds.has(c.teacherId)`.

**Auto-Schedule button:** Calls `optimizeSchedule` (unscheduled classes only), then `classCrud.updateMany(updated)`. Shows inline result message with scheduled count and names of any that could not be placed.

**Clear Schedule button:** Resets all classes to `dayOfWeek: '', startTime: '', roomId: '', teacherId: ''`.

**Drag & drop rescheduling:** Class blocks are `draggable`. Grid slot divs are drop targets — each carries `day`, `roomId`, and `slotIndex`. On drop, `findAvailableTeacher(cls, day, slotIndex, teachers, classes)` is called: if the class already has a teacher it verifies they are free; if no teacher is set it finds the first eligible (by genre/specialty) free teacher. The drop is blocked if no valid teacher exists. `slotIndexToTime(slotIndex)` converts grid row back to `"HH:MM"`. Drops onto unavailable slots (`.slot-unavailable`) are also silently blocked.

**Unscheduled panel:** Shown below the grid when any classes lack a day/time. Draggable chips can be dropped onto the grid to schedule them into a specific day + room slot.

**Right-click context menu:** Right-clicking a class block shows a context menu with "Unschedule class". Selecting it opens a confirmation modal; confirming resets that class to `dayOfWeek: '', startTime: '', roomId: '', teacherId: ''`.

**Optimize result message:** Shown below the grid after Auto-Schedule. Persists until dismissed with a Clear button.

`ClassBlock` colors blocks using the teacher's `color` field (lightened) with a solid left border in the full color.

### Export to Excel (`src/utils/exportSchedule.js`)

Uses ExcelJS. Mirrors the room-subdivided weekly grid exactly, with per-day room filtering:

- **Row 1:** Corner cell (spans 2 rows) + day headers merged across that day's available room sub-columns. Even days `#500000`, odd days `#732F2F`, white bold text. Days with no available rooms are omitted entirely.
- **Row 2:** Room sub-headers (only rooms available on that day). Even days `#F9F0F0`, odd days `#EDE8E8`.
- **Rows 3+:** 28 time slot rows at 24pt height. Available slots: even day white, odd day `#FDF6F6`. Unavailable slots (outside room availability): solid `#E0E0E0`. Time label in column 1.
- **Class blocks:** Merged cells spanning slot rows, teacher color lightened 78% for fill, full color for font/border. Displays class name + `"Teacher · Room"` (no time range). `try/catch` around `mergeCells` handles overlapping classes gracefully.
- **Sheet 2:** Unscheduled classes as a styled flat list.
- Uses `dayColStart` map and `getCol(day, ri)` for per-day column offsets (days can have different room counts).
- Local constants match `timeHelpers.js`: `GRID_START_HOUR = 15`, `SLOT_MINUTES = 15`, `TOTAL_SLOTS = 28`.
- Accepts `visibleDays` and `visibleRooms` so filters applied in the UI are respected.
- Downloads via `Blob` + `URL.createObjectURL`.

### Export to PDF (`src/utils/exportPDF.js`)

Uses html2canvas + jsPDF.

- Captures the inner `.weekly-grid` element (not the `.grid-wrapper` overflow container) using `target.scrollWidth`/`scrollHeight` so the full grid is captured without clipping.
- Page size: at minimum A4 landscape (297×210mm); expands width proportionally if the grid aspect ratio requires it.
- Title ("The Dance Collective McKinney — Weekly Schedule") and generation date printed above the grid image.
- Grid image scaled with `Math.min(scaleByW, scaleByH)` to fit within available area.
- Unavailable slots render as solid `#E0E0E0` (CSS background-color), which html2canvas captures reliably. Do not use CSS gradients or patterns for unavailability — html2canvas does not render `repeating-linear-gradient` consistently.

### Tables (Classes, Students, Teachers pages)

All tables support sortable columns via `sortKey`/`sortDir` state and a `SortTh` component that renders a clickable header with ▲/▼ indicators.

- **Classes:** sortable by all columns; teacher filter is a multi-select dropdown (checkbox list). Includes an "Unassigned" option (sentinel value `'__unassigned__'` in the Set) that matches classes with no `teacherId`. Can be combined with specific teachers. State: `filterTeacherIds` (Set).
- **Students:** sortable by all columns; skill level filter is a multi-select dropdown (checkbox list). State: `filterSkills` (Set).
- **Teachers:** sortable by Name, Genre, Phone, Email, Classes (Availability column not sortable)

Unscheduled classes display "Unscheduled" instead of a time string. Always guard against empty `startTime` before calling `formatTime` or `addMinutes`.

### Availability editor (`src/components/AvailabilityEditor.jsx`)

Same grid layout as the Schedule page but interactive — click/drag to paint 30-minute cells. Internally converts between the `[{dayOfWeek, startTime, endTime}]` slot format and a `Set` of `"DayName:slotIndex"` keys. Adjacent painted cells are merged back into contiguous slots on mouseup. Accepts a `color` prop (teachers pass their chosen hex color; rooms use the default `#6c5ce7`). Used in both `TeacherForm` and `RoomForm`.

The editor defines its own local constants **independent of `timeHelpers.js`**:
- `GRID_START_HOUR = 15` (3:00pm)
- `SLOT_MINUTES = 30` (30-minute increments — coarser than the schedule grid's 15-min slots)
- `TOTAL_SLOTS = 14` (7 hours × 2 slots/hr)

**If `TOTAL_SLOTS` changes, the CSS in `AvailabilityEditor.css` must be updated to match** — specifically `grid-template-rows: 28px repeat(14, 16px)` where the repeated count equals `TOTAL_SLOTS`.

**React anti-pattern to avoid:** Do not call a parent `onChange` prop inside a `setCells` functional state updater. React 18 treats state updaters as part of the render phase; calling another component's state setter there triggers "Cannot update a component while rendering a different component". The fix: maintain a `cellsRef` that mirrors `cells` state, and call `onChange(setToSlots(cellsRef.current))` directly in the `mouseup` handler — outside any state updater.

### Sidebar (`src/components/Sidebar.jsx`)

Maroon background (`#500000`). White text throughout. Width: `--sidebar-width: 290px` (set in `App.css`). Displays the studio logo/name at the top, nav links in the middle, a portrait photo of Suzan Ponthier (`src/assets/Suzan.jpeg`, 75% width, centered) below the nav, then a spacer, then **Save Data / Load Data buttons**, then the footer version label at the bottom.

Nav item icons use `color: initial` inline to prevent the parent's `rgba(255,255,255,0.65)` from washing out emoji colors.

**Save Data / Load Data** (`src/services/storage.js` — `exportDataToFile`, `importDataFromFile`):
- **Save Data**: Exports all four entities (students, teachers, rooms, classes — including full schedule assignments) as `dance-studio-YYYY-MM-DD.json`. Uses `Blob` + `URL.createObjectURL`, same pattern as the Excel export.
- **Load Data**: Opens a hidden `<input type="file" accept=".json">`. After a `window.confirm()` prompt, calls `importDataFromFile(file)` which validates that all four arrays are present, saves them to localStorage, then `window.location.reload()`.
- Import error (bad JSON or missing arrays) shows an `alert`. The file input value is reset after each pick so the same file can be re-imported.
- JSON format: `{ version, exportedAt, students, teachers, rooms, classes }`

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
- **Specialty matching:** Teacher specialty is an array; use `teacher.specialty.some(s => s.toLowerCase() === style.toLowerCase())` for eligibility checks. Legacy data may have specialty as a string — handle both.
- **PDF clipping:** Always pass the inner `.weekly-grid` element to `html2canvas`, not the `.grid-wrapper`. The wrapper has `overflow-x: auto` which clips the canvas to the visible scroll area.
- **PDF gradients:** html2canvas does not reliably render `repeating-linear-gradient`. Use solid `background-color` for any fills that must appear in the PDF export.
- **Excel merge conflicts:** Overlapping classes in the same room column will attempt to merge already-merged cells. Wrap `ws.mergeCells()` in `try/catch` to render without merge rather than throwing.
- **Zoom and slot height:** `RoomColumn` must receive `slotHeight` as a prop (not use the module-level constant) so class block top/height positions scale correctly when zoom changes.
- **Per-day column layout:** `getCol` in both `SchedulePage.jsx` and `exportSchedule.js` uses a `dayColStart` map rather than a fixed `dayIdx * numRooms` formula, because different days can have different numbers of available rooms. Never assume uniform room counts across days.
- **timeHelpers vs AvailabilityEditor constants:** `timeHelpers.js` uses `SLOT_MINUTES = 15` (schedule grid granularity). `AvailabilityEditor.jsx` defines its own local `SLOT_MINUTES = 30` (availability painting granularity). `exportSchedule.js` also defines its own local constants matching `timeHelpers.js`. Keep these in sync intentionally — they are meant to be independent.
- **AvailabilityEditor onChange in state updater:** Never call `onChange` inside a `setCells(prev => ...)` updater — this triggers the React 18 "Cannot update during render" warning. Use a `cellsRef` to track current cells and call `onChange` directly in the event handler instead.
