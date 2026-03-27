# TDC Dance Studio Scheduler — User Guide

## Starting the App

### Frontend

Open a PowerShell window and run:

```powershell
$env:Path = 'C:\Program Files
odejs\;' + $env:Path
cd "path	o	dc-dance-studio-scheduler"
npm install       # first time only
npm run dev
```

Open your browser to **http://localhost:5173**.

> If the page looks stale, another Node process may have pushed Vite to port 5174. Kill all Node processes and restart:
> ```powershell
> Get-Process -Name node -ErrorAction SilentlyContinue | Stop-Process -Force
> ```

### CP-SAT Backend (required for Auto Schedule)

Open a second PowerShell window and run:

```powershell
cd "path	o	dc-dance-studio-schedulerackend"
py -3 -m venv venv
venv\Scriptsctivate
pip install -r requirements.txt
uvicorn main:app --port 8000
```

The backend must be running before using the **Auto Schedule** button. You can confirm it is healthy by visiting http://localhost:8000/api/health.

---

## Navigation

The sidebar on the left contains links to all five sections of the app:

| Section | Purpose |
|---|---|
| **Schedule** | View and edit the weekly schedule grid |
| **Classes** | Manage class definitions |
| **Teachers** | Manage teacher profiles |
| **Students** | Manage student records |
| **Rooms** | Manage room configurations |

The **Save Data** and **Load Data** buttons at the bottom of the sidebar export or import all four entity types at once as a single JSON file.

---

## Classes Page

Each class definition holds a name, genre, skill level, duration, and list of enrolled students. Classes start with no teacher, room, or time assigned — those are set on the Schedule page.

- **Add Class** — opens a form. The teacher dropdown only shows teachers whose genre list includes the selected genre.
- **Edit Class** — click the pencil icon on any row.
- **Delete Class** — click the trash icon (requires confirmation).
- **Filters** — filter by skill level, duration, or teacher using the dropdowns in the header.
- **Save Classes / Load Classes** — export or import just the classes data as JSON.
- **Clear** — removes all class records (requires confirmation).

---

## Teachers Page

Teacher records include name, genre(s), scheduling specialties, phone, email, color, and availability windows.

- **Genre** — the list of dance styles a teacher is eligible to teach.
- **Specialty for Scheduling** — a subset of their genres. The optimizer prefers assigning specialty-matched teachers. Their name appears bold and underlined on scheduled class blocks.
- **Availability** — painted on an interactive grid (click/drag to mark 30-minute windows). Editing availability automatically unschedules any classes that no longer fit.
- **Save Teachers / Load Teachers / Clear** — export, import, or clear teacher records.

---

## Students Page

Student records include name, age, and skill level. Skill level determines which classes a student can be enrolled in.

Skill levels:
- Beg/Int (6-10)
- Beg/Int (10+)
- Int/Adv (6-10)
- Int/Adv (10+)

- **Save Students / Load Students / Clear** — export, import, or clear student records.

---

## Rooms Page

Room records include name, capacity, and availability windows. Editing availability automatically unschedules any classes in that room that no longer fit.

- **Save Rooms / Load Rooms / Clear** — export, import, or clear room records.

---

## Schedule Page

### Reading the Grid

- Columns are grouped by day, then subdivided by room.
- Rows represent 15-minute time slots from 3:30 PM to 9:30 PM.
- Grey "N/A" cells indicate slots outside a room's availability.
- Class blocks show the class name, teacher (bold & underlined if the teacher holds a specialty in that genre), skill level, and time range.

### Scheduling a Class

**Drag from the unscheduled panel** (shown below the grid when unscheduled classes exist) and drop onto any valid grid slot. A teacher-picker dialog appears if more than one eligible teacher is available.

**Drag an existing class block** to move it to a new slot. The system automatically verifies the teacher is still eligible and free.

### Right-Click Menu

Right-clicking a class block shows an **Unschedule class** option, which removes it from the grid and returns it to the unscheduled panel.

### Clicking a Class Block

Left-clicking opens a read-only **Class Detail Panel** showing genre, time range, teacher, room, and enrolled students.

### Auto Schedule

Click **Auto Schedule** to run the CP-SAT optimizer. A confirmation dialog appears before the solver starts. The process may take up to 2 minutes. When complete, a result message shows how many classes were scheduled, how many were assigned to a specialty teacher, and the elapsed time.

The solver respects the following rules:

**Hard constraints** (all must be satisfied):

| # | Rule |
|---|---|
| 1 | **Teacher genre match** — the teacher's genre list must include the class genre. Teachers with no genres are never eligible. |
| 2 | **Teacher availability** — the class must fall within the teacher's availability window (a class may start or end exactly at the boundary). |
| 3 | **Room availability** — the class must fall within the room's availability window (same rule). |
| 4 | **Teacher no-overlap** — a teacher cannot teach two classes at the same time on the same day. |
| 5 | **Room no-overlap** — two classes cannot share a room at the same time on the same day. |
| 6 | **Skill level no-overlap** — two classes at the same skill level cannot overlap on the same day (in any room). |
| 7 | **Grid boundaries** — all classes must start and end within 3:30 PM – 9:30 PM, snapped to 15-minute slots. |
| 8 | **Pre-assigned teacher respected** — if a class already has a teacher, only that teacher is used; if their genre no longer matches, the class is skipped. |
| 9 | **Pre-assigned room preferred** — if a class already has a room, that room is tried first. |

**Soft preferences** (optimizer tries to satisfy in this priority order):

1. Maximize the number of classes scheduled
2. Prefer assigning teachers who have the class genre listed as a Specialty for Scheduling (shown bold & underlined on the block)
3. Prefer scheduling classes earlier in the week (Monday before Tuesday, etc.)
4. Minimize the number of distinct teacher–day combinations

### Clear Schedule

Click **Clear Schedule** to unschedule all classes. This does not delete any class definitions.

### Filters and Display Options

- **Teacher / Room / Skill Level filters** — multi-select dropdowns in the page header narrow which blocks are visible.
- **Day toggles** — chips above the grid hide or show individual days.
- **Zoom** — `+` / `−` / `↺` buttons in the top-right scale the grid.
- **Color mode** — toggle between coloring blocks by Teacher or by Skill Level.

### Exporting

- **Export to Excel** — downloads a `.xlsx` file mirroring the grid, including room columns, time slots, and class blocks with teacher colors.
- **Export to PDF** — captures the full grid as a PDF.

Both export buttons are disabled when no classes are scheduled.

---

## Data Management

### Resetting to Demo Data

Demo data (6 teachers, 4 rooms, 6 students, 60 classes) loads automatically the first time the app is opened. To reload it, clear localStorage from the browser DevTools console and refresh:

```js
localStorage.clear()
```

### Saving and Loading All Data

The **Save Data** and **Load Data** buttons in the sidebar export and import all four entity types (teachers, rooms, students, classes including schedule assignments) in a single `dance-studio-YYYY-MM-DD.json` file. Loading prompts for confirmation before overwriting existing data.
