# TDC Dance Studio Scheduler

A scheduling application for **The Dance Collective McKinney** that manages teachers, rooms, students, and classes — and produces an optimized weekly schedule.

## Overview

The app is a React single-page application backed by an optional Python/FastAPI CP-SAT scheduling engine. All data is persisted in the browser's `localStorage`. The CP-SAT backend is required for Auto Schedule; if it is unreachable, an error is shown.

### Pages

| Page | Description |
|---|---|
| **Schedule** | Interactive weekly grid. Drag & drop classes, auto-schedule via CP-SAT, export to Excel or PDF. |
| **Classes** | Manage class definitions (genre, skill level, duration, enrolled students). Save/Load/Clear. |
| **Teachers** | Manage teachers (genre, specialties, availability, color). Save/Load/Clear. |
| **Students** | Manage students (name, age, skill level). Save/Load/Clear. |
| **Rooms** | Manage rooms (name, capacity, availability). Save/Load/Clear. |

### Key Features

- **Auto Schedule** — CP-SAT optimizer assigns teachers, rooms, and time slots to all unscheduled classes while respecting availability, genre eligibility, and conflict constraints. A live HH:MM:SS stopwatch and an **Abort** button appear while the solver is running. The **Timeout** dropdown (1m–10m, default 3m) includes an **"Until Optimal"** option that runs the solver until it proves no better schedule exists (fetch timeout: 5 days).
- **Schedule Analytics** — After Auto Schedule completes, a View Analytics button opens a modal showing stat cards (Classes Scheduled, Not Placed, Specialty Matches, Solve Time), a **Solver Quality** strip (Status, Optimality Gap, Objective Value, Best Bound), Teacher Workload, Room Utilization, Day Distribution, Genre Breakdown, and Skill Level Breakdown tables.
- **Drag & Drop** — Classes can be dragged from the unscheduled panel or rescheduled directly on the grid.
- **Conflict detection** — Real-time warnings for teacher/room/skill-level overlaps.
- **Export** — Weekly schedule exports to Excel (room-subdivided grid, respects Teacher/Skill Level color mode; unscheduled classes always appear on Sheet 2) or PDF (html2canvas capture; a second page lists unscheduled classes when any exist).
- **Per-entity Save/Load/Clear** — Each data page can independently export, import, or clear its records as `.json` files.
- **Full data Save/Load** — Sidebar buttons export or import all four entities at once when on the Schedule or Help page.
- **Collapsible sidebar** — The sidebar can be hidden with the **‹** button and restored with the **›** tab that appears at the left edge.
- **Print User Guide** — A Print button on the Help page prints the active document (README or User Guide) with the sidebar and navigation hidden.

---

## Running the App

### Prerequisites

- [Node.js](https://nodejs.org/) (v18+)
- [Python 3.9+](https://www.python.org/) (for the CP-SAT backend)

### 1. Frontend

```powershell
# If npm is not in PATH, prepend the Node.js install directory
$env:Path = 'C:\Program Files\nodejs\;' + $env:Path

npm install       # first time only
npm run dev       # starts Vite dev server at http://localhost:5173
```

Other frontend commands:

```powershell
npm run build     # production build → dist/
npm run preview   # serve the dist/ build locally
```

> **Stale UI?** A previous Node process may still own port 5173 and Vite silently moved to 5174. Kill all Node processes before restarting:
> ```powershell
> Get-Process -Name 'node' -ErrorAction SilentlyContinue | Stop-Process -Force
> ```

### 2. CP-SAT Backend (required for Auto Schedule)

```bash
cd backend
py -3 -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --port 8000
```

The backend exposes two endpoints:
- `POST /api/optimize` — runs the CP-SAT solver
- `GET /api/health` — health check

The frontend at `localhost:5173` communicates with the backend at `localhost:8000`. Chrome requires the `Access-Control-Allow-Private-Network: true` header for cross-port localhost requests — this is handled automatically by the backend middleware.

---

## Optimizer Rules

### Hard Constraints

Enforced by the CP-SAT solver, drag & drop handlers, and the ClassForm teacher dropdown:

1. **Teacher genre match** — the teacher's `genre` array must include the class's genre. Teachers with no genres set are never eligible for any class that has a genre.
2. **Teacher availability** — the class must fall within the teacher's availability window (1-minute inset: a class may start or end exactly at a boundary).
3. **Room availability** — the class must fall within the room's availability window (same 1-minute inset).
4. **Teacher no-overlap** — a teacher cannot teach two classes at the same time on the same day.
5. **Room no-overlap** — two classes cannot occupy the same room at the same time on the same day.
6. **Skill level no-overlap** — two classes with the same non-empty skill level cannot overlap on the same day (across any rooms).
7. **Grid boundaries** — classes must start and end within 3:30 PM – 9:30 PM, snapped to 15-minute slots.
8. **Pre-assigned teacher respected** — if a class already has a `teacherId`, only that teacher is used; if their genre no longer matches, the class is skipped entirely by the optimizer.
9. **Pre-assigned room preferred** — if a class already has a `roomId`, that room is tried first before others.

### Soft Preferences (CP-SAT objective, in priority order)

1. **Maximize classes scheduled** (primary, weighted `BIG_M`)
2. **Prefer specialty-matched teacher** — prefer assigning a teacher who has the class genre in their `specialties` (`PRIORITY_BONUS = 70`)
3. **Prefer earlier days** — Monday is preferred over Tuesday, and so on
4. **Minimize teacher-day pairs** — reduce the number of distinct (teacher, day) combinations (`TEACHER_DAY_WEIGHT = 1`)

---

## Resetting Demo Data

Seed data loads automatically on first launch (when `dss_students` is absent from `localStorage`). To re-seed after changing `storage.js`, clear `localStorage` in the browser DevTools console and refresh:

```js
localStorage.clear()
```
