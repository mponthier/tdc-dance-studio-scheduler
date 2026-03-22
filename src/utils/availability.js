function toMins(timeStr) {
  const [h, m] = timeStr.split(':').map(Number)
  return h * 60 + m
}

/**
 * Returns true if the class (day, startTime, durationMinutes) fits inside
 * at least one availability window. If availability is empty, always true.
 */
export function isWithinAvailability(availability, dayOfWeek, startTime, durationMinutes) {
  if (!availability || availability.length === 0) return true
  const classStart = toMins(startTime) + 1
  const classEnd = toMins(startTime) + durationMinutes - 1
  return availability.some(
    (slot) =>
      slot.dayOfWeek === dayOfWeek &&
      toMins(slot.startTime) <= classStart &&
      toMins(slot.endTime) >= classEnd,
  )
}

/**
 * Checks whether a teacher and room are available for a candidate class.
 * Returns an array of warning objects { type, message }.
 */
export function detectAvailabilityWarnings(candidate, teacher, room) {
  const warnings = []
  const { dayOfWeek, startTime, durationMinutes } = candidate
  if (!dayOfWeek || !startTime || !durationMinutes) return warnings

  if (teacher?.availability?.length > 0) {
    if (!isWithinAvailability(teacher.availability, dayOfWeek, startTime, durationMinutes)) {
      const daySlots = teacher.availability.filter((s) => s.dayOfWeek === dayOfWeek)
      if (daySlots.length === 0) {
        warnings.push({ type: 'teacher-avail', message: `${teacher.name} is not available on ${dayOfWeek}.` })
      } else {
        const ranges = daySlots.map((s) => `${fmt(s.startTime)}–${fmt(s.endTime)}`).join(', ')
        warnings.push({ type: 'teacher-avail', message: `${teacher.name}'s availability on ${dayOfWeek} is ${ranges}. The class falls outside this window.` })
      }
    }
  }

  if (room?.availability?.length > 0) {
    if (!isWithinAvailability(room.availability, dayOfWeek, startTime, durationMinutes)) {
      const daySlots = room.availability.filter((s) => s.dayOfWeek === dayOfWeek)
      if (daySlots.length === 0) {
        warnings.push({ type: 'room-avail', message: `${room.name} is not available on ${dayOfWeek}.` })
      } else {
        const ranges = daySlots.map((s) => `${fmt(s.startTime)}–${fmt(s.endTime)}`).join(', ')
        warnings.push({ type: 'room-avail', message: `${room.name}'s availability on ${dayOfWeek} is ${ranges}. The class falls outside this window.` })
      }
    }
  }

  return warnings
}

function fmt(timeStr) {
  const [h, m] = timeStr.split(':').map(Number)
  const suffix = h >= 12 ? 'pm' : 'am'
  const hour = h % 12 || 12
  return `${hour}:${String(m).padStart(2, '0')}${suffix}`
}
