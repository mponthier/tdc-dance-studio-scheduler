"""
CP-SAT solver for dance studio scheduling.
Uses optional interval variables + AddNoOverlap for efficiency.
Returns {"scheduled": [...], "unscheduled": [...id strings]}.
"""

import time
from collections import defaultdict
from ortools.sat.python import cp_model

DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
GRID_START_MINS = 15 * 60 + 30   # 15:30 = 930
GRID_END_MINS   = 21 * 60 + 30   # 21:30 = 1290
SLOT_MINUTES    = 15


def to_mins(time_str: str) -> int:
    h, m = time_str.split(":")
    return int(h) * 60 + int(m)


def mins_to_time(total_mins: int) -> str:
    h = total_mins // 60
    m = total_mins % 60
    return f"{h:02d}:{m:02d}"


def is_within_availability(availability: list, day: str, start_mins: int, duration: int) -> bool:
    """1-minute inset: class can start/end exactly at an availability boundary."""
    if not availability:
        return True
    class_start = start_mins + 1
    class_end   = start_mins + duration - 1
    for slot in availability:
        if slot["dayOfWeek"] == day:
            if to_mins(slot["startTime"]) <= class_start and to_mins(slot["endTime"]) >= class_end:
                return True
    return False


def teacher_eligible(teacher: dict, cls: dict) -> bool:
    style = (cls.get("style") or "").strip()
    if not style:
        return True
    specs = teacher.get("genre", [])
    if isinstance(specs, str):
        specs = [specs] if specs else []
    return any(s.lower() == style.lower() for s in specs)


def intervals_overlap(s1: int, d1: int, s2: int, d2: int) -> bool:
    """Open-interval overlap: touching boundaries do NOT conflict."""
    return s1 < s2 + d2 and s2 < s1 + d1


def _emit(queue, message, scheduled=None, total=None, elapsed=None):
    if queue is not None:
        queue.put({"message": message, "scheduled": scheduled, "total": total, "elapsed": elapsed})


class ProgressCallback(cp_model.CpSolverSolutionCallback):
    """Fires each time CP-SAT finds an improved solution; pushes progress to a queue."""
    def __init__(self, assign_vars, by_class, total, progress_queue, start_time):
        super().__init__()
        self._vars = assign_vars
        self._by_class = by_class
        self._total = total
        self._queue = progress_queue
        self._start = start_time
        self._prev_count = 0

    def on_solution_callback(self):
        count = sum(
            1 for idxs in self._by_class.values()
            if any(self.boolean_value(self._vars[i]) for i in idxs)
        )
        elapsed = round(time.time() - self._start, 1)
        improvement = f" (+{count - self._prev_count})" if self._prev_count > 0 else ""
        self._prev_count = count
        _emit(
            self._queue,
            f"Solution found: {count}/{self._total} classes{improvement} — {elapsed}s elapsed",
            scheduled=count,
            total=self._total,
            elapsed=elapsed,
        )


def solve(data: dict, progress_queue=None, timeout_seconds: float = 120.0) -> dict:
    all_classes  = data["classes"]
    all_teachers = data["teachers"]
    all_rooms    = data["rooms"]

    teacher_by_id = {t["id"]: t for t in all_teachers}
    room_by_id    = {r["id"]: r for r in all_rooms}

    already_scheduled = [c for c in all_classes if c.get("dayOfWeek") and c.get("startTime")]
    unscheduled       = [c for c in all_classes if not c.get("dayOfWeek") or not c.get("startTime")]

    if not unscheduled:
        return {"scheduled": [], "unscheduled": []}

    _emit(progress_queue, f"Enumerating feasible slots for {len(unscheduled)} classes…",
          total=len(unscheduled))

    # ------------------------------------------------------------------ #
    # Enumerate feasible assignments
    # Each entry: (cls_id, day, start_mins, room_id, teacher_id, duration, skill_level)
    # ------------------------------------------------------------------ #
    assignments = []

    for cls in unscheduled:
        cls_id            = cls["id"]
        duration          = cls.get("durationMinutes", 60)
        fixed_teacher_id  = cls.get("teacherId") or ""
        preferred_room_id = cls.get("roomId") or ""

        if fixed_teacher_id:
            t = teacher_by_id.get(fixed_teacher_id)
            if t is None or not teacher_eligible(t, cls):
                continue
            candidate_teachers = [t]
        else:
            candidate_teachers = [t for t in all_teachers if teacher_eligible(t, cls)]
            if not candidate_teachers:
                continue

        if preferred_room_id and preferred_room_id in room_by_id:
            room_order = [room_by_id[preferred_room_id]] + [r for r in all_rooms if r["id"] != preferred_room_id]
        else:
            room_order = list(all_rooms)

        for day in DAYS:
            start = GRID_START_MINS
            while start + duration <= GRID_END_MINS:
                for teacher in candidate_teachers:
                    if not is_within_availability(teacher.get("availability", []), day, start, duration):
                        continue
                    for room in room_order:
                        if not is_within_availability(room.get("availability", []), day, start, duration):
                            continue
                        # Pre-filter: block if conflicts with already-scheduled classes
                        blocked = False
                        for ex in already_scheduled:
                            if ex.get("dayOfWeek") != day or not ex.get("startTime"):
                                continue
                            ex_start = to_mins(ex["startTime"])
                            ex_dur   = ex.get("durationMinutes", 60)
                            if not intervals_overlap(start, duration, ex_start, ex_dur):
                                continue
                            if (ex.get("roomId") == room["id"] or
                                ex.get("teacherId") == teacher["id"] or
                                (cls.get("skillLevel") and ex.get("skillLevel") == cls.get("skillLevel"))):
                                blocked = True
                                break
                        if not blocked:
                            assignments.append({
                                "cls_id":     cls_id,
                                "day":        day,
                                "start_mins": start,
                                "room_id":    room["id"],
                                "teacher_id": teacher["id"],
                                "duration":   duration,
                                "skill_level": cls.get("skillLevel") or "",
                                "style":      (cls.get("style") or "").lower(),
                            })
                start += SLOT_MINUTES

    if not assignments:
        _emit(progress_queue, "No feasible assignments found — cannot schedule any classes.",
              scheduled=0, total=len(unscheduled))
        return {"scheduled": [], "unscheduled": [c["id"] for c in unscheduled]}

    _emit(progress_queue, f"Found {len(assignments):,} feasible assignments. Building model…",
          total=len(unscheduled))

    # ------------------------------------------------------------------ #
    # Build CP-SAT model
    # ------------------------------------------------------------------ #
    model = cp_model.CpModel()

    # One BoolVar per feasible assignment
    assign_vars = [model.new_bool_var(f"a_{i}") for i in range(len(assignments))]

    # Each class gets at most one assignment
    by_class = defaultdict(list)
    for i, a in enumerate(assignments):
        by_class[a["cls_id"]].append(i)
    for cls_id, idxs in by_class.items():
        model.add_at_most_one(assign_vars[i] for i in idxs)

    # ------------------------------------------------------------------ #
    # No-overlap via optional interval variables (much more efficient than pairwise)
    # ------------------------------------------------------------------ #
    # Group by (day, resource_key); resource_key = room_id, teacher_id, or skill_level
    room_intervals    = defaultdict(list)   # (day, room_id)    -> list of intervals
    teacher_intervals = defaultdict(list)   # (day, teacher_id) -> list of intervals
    skill_intervals   = defaultdict(list)   # (day, skill_level) -> list of intervals

    for i, a in enumerate(assignments):
        presence = assign_vars[i]
        start    = model.new_int_var(a["start_mins"], a["start_mins"], f"s_{i}")
        dur      = model.new_int_var(a["duration"],   a["duration"],   f"d_{i}")
        end      = model.new_int_var(a["start_mins"] + a["duration"],
                                     a["start_mins"] + a["duration"],  f"e_{i}")
        interval = model.new_optional_interval_var(start, dur, end, presence, f"iv_{i}")

        room_intervals   [(a["day"], a["room_id"])   ].append(interval)
        teacher_intervals[(a["day"], a["teacher_id"])].append(interval)
        if a["skill_level"]:
            skill_intervals[(a["day"], a["skill_level"])].append(interval)

    for intervals in room_intervals.values():
        model.add_no_overlap(intervals)
    for intervals in teacher_intervals.values():
        model.add_no_overlap(intervals)
    for intervals in skill_intervals.values():
        model.add_no_overlap(intervals)

    # ------------------------------------------------------------------ #
    # Objective: maximise classes scheduled (primary), prefer priority-genre
    # teacher assignments (secondary), prefer earlier days (tertiary)
    # ------------------------------------------------------------------ #
    # Day weights: Monday=6 … Sunday=0.
    DAY_WEIGHT = {"Monday": 6, "Tuesday": 5, "Wednesday": 4,
                  "Thursday": 3, "Friday": 2, "Saturday": 1, "Sunday": 0}
    # PRIORITY_BONUS sits above max day score so priority beats day preference,
    # but BIG_M >> PRIORITY_BONUS so total classes always dominates.
    PRIORITY_BONUS = max(DAY_WEIGHT.values()) + 1   # 7
    BIG_M = len(unscheduled) * (PRIORITY_BONUS + max(DAY_WEIGHT.values())) + 1

    # Per-teacher priority genre sets (lower-cased for case-insensitive match)
    teacher_priority = {
        t["id"]: {g.lower() for g in (t.get("specialties") or [])}
        for t in all_teachers
    }

    class_scheduled_vars = []
    for cls_id, idxs in by_class.items():
        if len(idxs) == 1:
            class_scheduled_vars.append(assign_vars[idxs[0]])
        else:
            b = model.new_bool_var(f"sched_{cls_id}")
            model.add_bool_or([assign_vars[i] for i in idxs] + [b.negated()])
            for i in idxs:
                model.add(assign_vars[i] <= b)
            class_scheduled_vars.append(b)

    day_score = sum(
        assign_vars[i] * DAY_WEIGHT.get(assignments[i]["day"], 0)
        for i in range(len(assignments))
    )
    priority_score = sum(
        assign_vars[i]
        for i, a in enumerate(assignments)
        if a["style"] and a["style"] in teacher_priority.get(a["teacher_id"], set())
    )
    model.maximize(sum(class_scheduled_vars) * BIG_M + priority_score * PRIORITY_BONUS + day_score)

    # ------------------------------------------------------------------ #
    # Solve
    # ------------------------------------------------------------------ #
    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = float(timeout_seconds)

    _emit(progress_queue,
          f"Model built ({len(assign_vars):,} variables, {len(assignments):,} assignments). Solver running…",
          total=len(unscheduled))

    if progress_queue is not None:
        cb = ProgressCallback(assign_vars, by_class, len(unscheduled), progress_queue, time.time())
        status = solver.solve(model, cb)
    else:
        status = solver.solve(model)

    status_label = {cp_model.OPTIMAL: "optimal", cp_model.FEASIBLE: "feasible (time limit reached)"}.get(status, "no solution")
    elapsed_total = round(solver.wall_time, 1)
    _emit(progress_queue, f"Solver finished: {status_label} — {elapsed_total}s", total=len(unscheduled))

    if status not in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        _emit(progress_queue, "No feasible schedule found.", scheduled=0, total=len(unscheduled))
        return {"scheduled": [], "unscheduled": [c["id"] for c in unscheduled]}

    # ------------------------------------------------------------------ #
    # Collect results
    # ------------------------------------------------------------------ #
    scheduled_ids = set()
    scheduled_out = []

    for i, a in enumerate(assignments):
        if solver.value(assign_vars[i]) == 1:
            cls_id = a["cls_id"]
            if cls_id in scheduled_ids:
                continue
            scheduled_ids.add(cls_id)
            scheduled_out.append({
                "id":        cls_id,
                "dayOfWeek": a["day"],
                "startTime": mins_to_time(a["start_mins"]),
                "roomId":    a["room_id"],
                "teacherId": a["teacher_id"],
            })

    unscheduled_ids = [c["id"] for c in unscheduled if c["id"] not in scheduled_ids]
    return {"scheduled": scheduled_out, "unscheduled": unscheduled_ids}
