import { isWithinAvailability } from './availability'
import { detectConflicts } from './conflicts'
import { DAYS, GRID_START_HOUR, GRID_START_MIN, GRID_END_HOUR, GRID_END_MIN, SLOT_MINUTES } from './timeHelpers'

function minsToTime(totalMins) {
  const h = Math.floor(totalMins / 60)
  const m = totalMins % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

function toMins(timeStr) {
  const [h, m] = timeStr.split(':').map(Number)
  return h * 60 + m
}

function hasSkillLevelConflict(candidate, placedClasses) {
  if (!candidate.skillLevel) return false
  const candStart = toMins(candidate.startTime)
  const candEnd   = candStart + candidate.durationMinutes
  return placedClasses.some((p) =>
    p.skillLevel === candidate.skillLevel &&
    p.dayOfWeek  === candidate.dayOfWeek &&
    p.startTime  &&
    toMins(p.startTime) < candEnd &&
    toMins(p.startTime) + p.durationMinutes > candStart
  )
}

function eligibleTeachers(cls, teachers) {
  return teachers.filter((t) => {
    if (!cls.style) return true
    const specs = Array.isArray(t.specialty) ? t.specialty : (t.specialty ? [t.specialty] : [])
    return specs.length === 0 || specs.some((s) => s.toLowerCase() === cls.style.toLowerCase())
  })
}

/**
 * Greedily assigns dayOfWeek, startTime, roomId, and (if unset) teacherId to unscheduled classes.
 * Respects teacher/room availability and avoids scheduling conflicts.
 * Returns only the classes that were changed.
 */
export function optimizeSchedule(classes, teachers, rooms) {
  const alreadyScheduled = classes.filter((c) => c.dayOfWeek && c.startTime)
  const unscheduled = classes
    .filter((c) => !c.dayOfWeek || !c.startTime)
    .sort((a, b) => b.durationMinutes - a.durationMinutes)

  const placed = [...alreadyScheduled]
  const updated = []

  const gridStartMins = GRID_START_HOUR * 60 + GRID_START_MIN
  const gridEndMins   = GRID_END_HOUR * 60 + GRID_END_MIN

  for (const cls of unscheduled) {
    // Determine which teachers to try
    let teachersToTry
    if (cls.teacherId) {
      const teacher = teachers.find((t) => t.id === cls.teacherId)
      if (!teacher) continue
      // Validate specialty match
      if (cls.style) {
        const specs = Array.isArray(teacher.specialty) ? teacher.specialty : (teacher.specialty ? [teacher.specialty] : [])
        if (specs.length > 0 && !specs.some((s) => s.toLowerCase() === cls.style.toLowerCase())) continue
      }
      teachersToTry = [teacher]
    } else {
      teachersToTry = eligibleTeachers(cls, teachers)
      if (teachersToTry.length === 0) continue
    }

    let assigned = false

    outer: for (const day of DAYS) {
      for (let mins = gridStartMins; mins + cls.durationMinutes <= gridEndMins; mins += SLOT_MINUTES) {
        const startTime = minsToTime(mins)

        for (const teacher of teachersToTry) {
          if (!isWithinAvailability(teacher.availability, day, startTime, cls.durationMinutes)) continue

          const roomsToTry = cls.roomId
            ? [rooms.find((r) => r.id === cls.roomId), ...rooms.filter((r) => r.id !== cls.roomId)].filter(Boolean)
            : rooms

          for (const room of roomsToTry) {
            if (!isWithinAvailability(room.availability, day, startTime, cls.durationMinutes)) continue

            const candidate = { ...cls, dayOfWeek: day, startTime, roomId: room.id, teacherId: teacher.id }
            if (hasSkillLevelConflict(candidate, placed)) continue
            if (detectConflicts(candidate, placed).length === 0) {
              placed.push(candidate)
              updated.push(candidate)
              assigned = true
              break outer
            }
          }
        }
      }
    }

    if (!assigned) {
      // Could not place this class — leave it unscheduled
    }
  }

  return updated
}
