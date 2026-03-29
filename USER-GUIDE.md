# TDC Dance Studio Scheduler - User Guide

## Starting the App

### Frontend

Open a PowerShell window and run:

```powershell
$env:Path = 'C:\Program Files\nodejs\;' + $env:Path
cd "path\to\tdc-dance-studio-scheduler"
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
cd "path\to\tdc-dance-studio-scheduler\backend"
py -3 -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --port 8000
```

The backend must be running before using the **Auto Schedule** button. You can confirm it is healthy by visiting http://localhost:8000/api/health.

---

## Navigation

The sidebar on the left contains links to all six sections of the app:

| Section | Purpose |
|---|---|
| **Schedule** | View and edit the weekly schedule grid |
| **Classes** | Manage class definitions |
| **Teachers** | Manage teacher profiles |
| **Students** | Manage student records |
| **Rooms** | Manage room configurations |
| **Help** | User guide and README |

The **Save Data** and **Load Data** buttons at the bottom of the sidebar are context-aware. On the Schedule or Help page they export/import all four entity types at once as a single JSON file. On an entity page (Classes, Teachers, Students, Rooms) they save or load only that page's data.

The sidebar can be hidden by clicking the **<** button in the top-right corner of the sidebar. When hidden, a **>** tab appears at the left edge of the screen - click it to show the sidebar again.

---

## Classes Page

Each class definition holds a name, genre, skill level, duration, and list of enrolled students. Classes start with no teacher, room, or time assigned - those are set on the Schedule page.

<img src="/src/assets/Classes.png" alt="Classes page" style="border: 1px solid #888; width: 90%;" />

- **Add Class** - opens a form. The teacher dropdown only shows teachers whose genre list includes the selected genre.
- **Edit Class** - click the pencil icon on any row.
- **Delete Class** - click the trash icon (requires confirmation).
- **Filters** - filter by skill level, duration, or teacher using the dropdowns in the header.
- **Save Classes / Load Classes** - export or import just the classes data as JSON.
- **Clear** - removes all class records (requires confirmation).

<img src="/src/assets/Classes%20-%20Edit.png" alt="Edit class form" style="border: 1px solid #888;" />

---

## Teachers Page

Teacher records include name, genre(s), scheduling specialties, phone, email, color, and availability windows.

<img src="/src/assets/Teachers.png" alt="Teachers page" style="border: 1px solid #888; width: 90%;" />

- **Genre** - the list of dance styles a teacher is eligible to teach.
- **Specialty for Scheduling** - a subset of their genres. The optimizer prefers assigning specialty-matched teachers. Their name appears bold and underlined on scheduled class blocks.
- **Availability** - painted on an interactive grid (click/drag to mark 30-minute windows). Editing availability automatically unschedules any classes that no longer fit.
- **Save Teachers / Load Teachers / Clear** - export, import, or clear teacher records.

<img src="/src/assets/Teachers%20-%20Edit.png" alt="Edit teacher form" style="border: 1px solid #888;" />

---

## Students Page

Student records include name, age, and skill level. Skill level determines which classes a student can be enrolled in.

<img src="/src/assets/Students.png" alt="Students page" style="border: 1px solid #888; width: 90%;" />

Skill levels:
- Beg/Int (6-10)
- Beg/Int (10+)
- Int/Adv (6-10)
- Int/Adv (10+)

- **Save Students / Load Students / Clear** - export, import, or clear student records.

<img src="/src/assets/Students%20-%20Edit.png" alt="Edit student form" style="border: 1px solid #888;" />

---

## Rooms Page

Room records include name, capacity, and availability windows. Editing availability automatically unschedules any classes in that room that no longer fit.

<img src="/src/assets/Rooms.png" alt="Rooms page" style="border: 1px solid #888; width: 90%;" />

- **Save Rooms / Load Rooms / Clear** - export, import, or clear room records.

<img src="/src/assets/Rooms%20-%20Edit.png" alt="Edit room form" style="border: 1px solid #888;" />

---

## Schedule Page

### Reading the Grid

- Columns are grouped by day, then subdivided by room.
- Rows represent 15-minute time slots from 3:30 PM to 9:30 PM.
- Grey "N/A" cells indicate slots outside a room's availability.
- Class blocks show the class name, teacher (bold & underlined if the teacher holds a specialty in that genre), skill level, and time range. Text is always black.
- Unscheduled class chips below the grid are sorted alphabetically by class name and color-coded by skill level: orange (Beg/Int 6-10), blue (Beg/Int 10+), green (Int/Adv 6-10), purple (Int/Adv 10+). Falls back to the teacher's color if no skill level is assigned.

### Scheduling a Class

**Drag from the unscheduled panel** (shown below the grid when unscheduled classes exist) and drop onto any valid grid slot. A teacher-picker dialog appears if more than one eligible teacher is available.

**Drag an existing class block** to move it to a new slot. The system automatically verifies the teacher is still eligible and free.

### Right-Click Menu

Right-clicking a class block shows an **Unschedule class** option, which removes it from the grid and returns it to the unscheduled panel.

### Clicking a Class Block

Left-clicking opens a read-only **Class Detail Panel** showing genre, time range, teacher, room, and enrolled students.

### Auto Schedule

Click **Auto Schedule** to run the CP-SAT optimizer. A confirmation dialog appears before the solver starts. The **Timeout** dropdown in the toolbar controls the solver time limit (default 3 minutes). It also includes an **"Until Optimal"** option - selecting it tells the solver to keep running until it can prove no better schedule is possible (optimality gap = 0%). This may take a long time; use the **Abort** button to stop early. Progress messages appear in real time as the solver finds improved solutions. These messages and the final analytics **persist across page navigation, browser tab switches, and page reloads** - they remain visible until you click Clear or start a new Auto Schedule.

While the solver is running, an **Abort** button appears next to the "Scheduling..." label. Clicking it immediately cancels the solver and shows "Scheduling aborted." in the progress area.

When complete, a result message shows how many classes were scheduled, how many were assigned to a specialty teacher, and the elapsed time.

<img src="/src/assets/Scheduling%20-%20Complete.png" alt="Scheduling complete" style="border: 1px solid #888; width: 90%;" />

A **View Analytics** button also appears - clicking it opens a modal with:

- **Stat cards** - Classes Scheduled, Not Placed, Specialty Matches, Solve Time
- **Solver Quality** - Status badge (Optimal or Feasible), Optimality Gap progress bar (0% = provably optimal - no better schedule exists), Objective Value, Best Bound
- **Teacher Workload** - classes, hours, and days taught per teacher
- **Room Utilization** - classes and hours per room
- **Day Distribution** - classes and hours per day of the week
- **Genre Breakdown** - class count per genre
- **Skill Level Breakdown** - class count per skill level

<img src="/src/assets/Scheduling%20-%20Analytics.png" alt="Schedule analytics" style="border: 1px solid #888; width: 45%;" />

Click **Clear** in the results area to dismiss the messages and close the analytics modal.

The solver respects the following rules:

**Hard constraints** (all must be satisfied):

| # | Rule |
|---|---|
| 1 | **Teacher genre match** - the teacher's genre list must include the class genre. Teachers with no genres are never eligible. |
| 2 | **Teacher availability** - the class must fall within the teacher's availability window (a class may start or end exactly at the boundary). |
| 3 | **Room availability** - the class must fall within the room's availability window (same rule). |
| 4 | **Teacher no-overlap** - a teacher cannot teach two classes at the same time on the same day. |
| 5 | **Room no-overlap** - two classes cannot share a room at the same time on the same day. |
| 6 | **Skill level no-overlap** - two classes at the same skill level cannot overlap on the same day (in any room). |
| 7 | **Grid boundaries** - all classes must start and end within 3:30 PM - 9:30 PM, snapped to 15-minute slots. |
| 8 | **Pre-assigned teacher respected** - if a class already has a teacher, only that teacher is used; if their genre no longer matches, the class is skipped. |
| 9 | **Pre-assigned room preferred** - if a class already has a room, that room is tried first. |

**Soft preferences** (optimizer tries to satisfy in this priority order):

1. Maximize the number of classes scheduled
2. Prefer assigning teachers who have the class genre listed as a Specialty for Scheduling (shown bold & underlined on the block)
3. Prefer scheduling classes earlier in the week (Monday before Tuesday, etc.)
4. Minimize the number of distinct teacher-day combinations

### Clear Schedule

Click **Clear Schedule** to unschedule all classes. This does not delete any class definitions.

### Filters and Display Options

- **Teacher / Room / Skill Level filters** - multi-select dropdowns in the page header narrow which blocks are visible.
- **Day toggles** - chips above the grid hide or show individual days.
- **Zoom** - `+` / `-` / reset buttons in the top-right scale the grid.
- **Color mode** - toggle between coloring blocks by Teacher or by Skill Level.

### Exporting

- **Export to Excel** - downloads a `.xlsx` file mirroring the grid, including room columns, time slots, and class blocks colored according to the current Teacher / Skill Level color mode. Unscheduled classes are always included on a separate Sheet 2 regardless of any active filters.

<img src="/src/assets/Export%20-%20Excel.png" alt="Export to Excel" style="border: 1px solid #888; width: 90%;" />

- **Export to PDF** - captures the full grid as a PDF. If any unscheduled classes exist, a second page is added listing them in a table (Class, Genre, Skill Level, Duration, Teacher), colored to match the current color mode.

<img src="/src/assets/Export%20-%20PDF.png" alt="Export to PDF" style="border: 1px solid #888; width: 90%;" />

Both export buttons are disabled when no classes exist at all, and also while Auto Schedule is running.

---

## Help Page

The Help page contains two tabs: **README** (project overview, setup instructions, optimizer rules) and **User Guide** (this document). Use it as a quick reference without leaving the app.

<img src="/src/assets/Help.png" alt="Help page" style="border: 1px solid #888; width: 90%;" />

---

## Data Management

### Resetting to Demo Data

Demo data (6 teachers, 4 rooms, 6 students, 60 classes) loads automatically the first time the app is opened. To reload it, clear localStorage from the browser DevTools console and refresh:

```js
localStorage.clear()
```

### Saving and Loading All Data

The **Save Data** and **Load Data** buttons in the sidebar export and import all four entity types (teachers, rooms, students, classes including schedule assignments) in a single `dance-studio-YYYY-MM-DD.json` file. Loading prompts for confirmation before overwriting existing data.
