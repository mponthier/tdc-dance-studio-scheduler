export const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
export const GRID_START_HOUR = 15
export const GRID_END_HOUR = 22
export const SLOT_MINUTES = 15
export const TOTAL_SLOTS = ((GRID_END_HOUR - GRID_START_HOUR) * 60) / SLOT_MINUTES // 28

// col 1 = time labels, col 2 = Monday ... col 8 = Sunday
export function dayToColumn(dayName) {
  return DAYS.indexOf(dayName) + 2
}

// row 1 = header, rows 2..33 = time slots
export function timeToRow(timeStr) {
  const [h, m] = timeStr.split(':').map(Number)
  const minutesFromStart = (h - GRID_START_HOUR) * 60 + m
  return Math.floor(minutesFromStart / SLOT_MINUTES) + 2
}

export function durationToRowSpan(durationMinutes) {
  return Math.max(1, Math.ceil(durationMinutes / SLOT_MINUTES))
}

export function formatTime(timeStr) {
  const [h, m] = timeStr.split(':').map(Number)
  const suffix = h >= 12 ? 'pm' : 'am'
  const hour = h % 12 || 12
  return `${hour}:${String(m).padStart(2, '0')}${suffix}`
}

export function addMinutes(timeStr, minutes) {
  const [h, m] = timeStr.split(':').map(Number)
  const total = h * 60 + m + minutes
  const nh = Math.floor(total / 60) % 24
  const nm = total % 60
  return `${String(nh).padStart(2, '0')}:${String(nm).padStart(2, '0')}`
}
