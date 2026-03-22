"""
CP-SAT solver for dance studio scheduling.
Uses optional interval variables + AddNoOverlap for efficiency.
Returns {"scheduled": [...], "unscheduled": [...id strings]}.
"""

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
    specs = teacher.get("specialty", [])
    if isinstance(specs, str):
        specs = [specs] if specs else []
    if not specs:
        return True
    return any(s.lower() == style.lower() for s in specs)


def intervals_overlap(s1: int, d1: int, s2: int, d2: int) -> bool:
    """Open-interval overlap: touching boundaries do NOT conflict."""
    return s1 < s2 + d2 and s2 < s1 + d1


def solve(data: dict) -> dict:
    all_classes  = data["classes"]
    all_teachers = data["teachers"]
    all_rooms    = data["rooms"]

    teacher_by_id = {t["id"]: t for t in all_teachers}
    room_by_id    = {r["id"]: r for r in all_rooms}

    already_scheduled = [c for c in all_classes if c.get("dayOfWeek") and c.get("startTime")]
    unscheduled       = [c for c in all_classes if not c.get("dayOfWeek") or not c.get("startTime")]

    if not unscheduled:
        return {"scheduled": [], "unscheduled": []}

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
                            })
                start += SLOT_MINUTES

    if not assignments:
        return {"scheduled": [], "unscheduled": [c["id"] for c in unscheduled]}

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
    # Objective: maximise classes scheduled (primary), prefer earlier days (secondary)
    # ------------------------------------------------------------------ #
    # Day weights: Monday=6 … Sunday=0. big_M ensures more classes always beats day preference.
    DAY_WEIGHT = {"Monday": 6, "Tuesday": 5, "Wednesday": 4,
                  "Thursday": 3, "Friday": 2, "Saturday": 1, "Sunday": 0}
    BIG_M = len(unscheduled) * max(DAY_WEIGHT.values()) + 1  # > max possible day score

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
    model.maximize(sum(class_scheduled_vars) * BIG_M + day_score)

    # ------------------------------------------------------------------ #
    # Solve
    # ------------------------------------------------------------------ #
    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = 115.0

    status = solver.solve(model)

    if status not in (cp_model.OPTIMAL, cp_model.FEASIBLE):
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
