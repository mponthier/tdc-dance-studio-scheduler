import ExcelJS from 'exceljs'

const GRID_START_HOUR = 15
const GRID_START_MIN  = 30
const SLOT_MINUTES    = 15
const TOTAL_SLOTS     = ((21 * 60 + 30) - (GRID_START_HOUR * 60 + GRID_START_MIN)) / SLOT_MINUTES // 24
const DAY_ORDER = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

// Colours matching the UI
const MAROON_EVEN   = 'FF500000' // deep maroon  — even days
const MAROON_ODD    = 'FF732F2F' // lighter maroon — odd days
const DARK_MAROON   = 'FF3C0000'
const ROOM_HDR_EVEN = 'FFF9F0F0' // maroon-subtle
const ROOM_HDR_ODD  = 'FFEDE8E8'
const SLOT_EVEN     = 'FFFFFFFF' // white
const SLOT_ODD      = 'FFFDF6F6' // warm blush
const TIME_COL_BG   = 'FFF5F5F5'

// ── Colour helpers ─────────────────────────────────────────────────────────────

function lightenArgb(hex, ratio = 0.78) {
  const h = (hex || '#CCCCCC').replace('#', '')
  const ch = (s) => parseInt(h.slice(s, s + 2), 16)
  const blend = (c) => Math.round(c + (255 - c) * ratio)
  return 'FF' + [ch(0), ch(2), ch(4)].map((c) => blend(c).toString(16).padStart(2, '0').toUpperCase()).join('')
}

function toArgb(hex) {
  return 'FF' + (hex || '#888888').replace('#', '').toUpperCase()
}

// ── Time helpers ───────────────────────────────────────────────────────────────

function toMins(timeStr) {
  const [h, m] = timeStr.split(':').map(Number)
  return h * 60 + m
}

function timeToSlot(timeStr) {
  const [h, m] = timeStr.split(':').map(Number)
  return Math.floor((h * 60 + m - (GRID_START_HOUR * 60 + GRID_START_MIN)) / SLOT_MINUTES)
}

function isRoomSlotAvailable(room, day, slot) {
  if (!room.availability || room.availability.length === 0) return true
  const slotMins = GRID_START_HOUR * 60 + GRID_START_MIN + slot * SLOT_MINUTES
  return room.availability.some(
    (s) => s.dayOfWeek === day && toMins(s.startTime) <= slotMins && toMins(s.endTime) > slotMins
  )
}

function slotToLabel(slot) {
  if (slot % 2 !== 0) return ''
  const totalMins = GRID_START_HOUR * 60 + GRID_START_MIN + slot * SLOT_MINUTES
  const h = Math.floor(totalMins / 60)
  const m = totalMins % 60
  const suffix = h >= 12 ? 'PM' : 'AM'
  const hour = h % 12 || 12
  return m === 0 ? `${hour} ${suffix}` : `${hour}:${String(m).padStart(2, '0')} ${suffix}`
}

// ── Main export ────────────────────────────────────────────────────────────────

export async function exportScheduleToExcel(classes, teachers, rooms, students, visibleDays, visibleRooms) {
  const teacherMap = Object.fromEntries(teachers.map((t) => [t.id, t]))
  const roomMap    = Object.fromEntries(rooms.map((r)    => [r.id, r]))

  const allDays = (visibleDays  && visibleDays.length  > 0) ? visibleDays  : DAY_ORDER.slice()
  const rms     = (visibleRooms && visibleRooms.length > 0) ? visibleRooms : rooms

  // Per-day room lists — rooms with no availability on a given day are omitted
  function isRoomAvailableOnDay(room, day) {
    if (!room.availability || room.availability.length === 0) return true
    return room.availability.some((s) => s.dayOfWeek === day)
  }
  const roomsByDay = Object.fromEntries(
    allDays.map((day) => [day, rms.filter((r) => isRoomAvailableOnDay(r, day))])
  )
  // Drop days that have no available rooms
  const days = allDays.filter((day) => roomsByDay[day].length > 0)

  // Cumulative column start per day
  const dayColStart = {}
  let colCursor = 2
  days.forEach((day) => { dayColStart[day] = colCursor; colCursor += roomsByDay[day].length })

  const scheduled   = classes.filter((c) => c.dayOfWeek && c.startTime)
  const unscheduled = classes.filter((c) => !c.dayOfWeek || !c.startTime)

  // Column index for a given (day, roomIndex within that day)
  function getCol(day, ri) { return dayColStart[day] + ri }

  const wb = new ExcelJS.Workbook()
  wb.creator = 'The Dance Collective McKinney'

  // ── Sheet 1: Weekly Schedule ───────────────────────────────────────────────
  const ws = wb.addWorksheet('Weekly Schedule')

  // Column widths: time label + room sub-columns per day
  const maxRooms = Math.max(...days.map((d) => roomsByDay[d].length))
  ws.columns = [
    { width: 9 },
    ...days.flatMap((day) => roomsByDay[day].map(() => ({ width: maxRooms > 2 ? 16 : 22 }))),
  ]

  // ── Row 1: Corner + Day headers ───────────────────────────────────────────
  ws.getRow(1).height = 22
  ws.getRow(2).height = 18

  // Corner spans both header rows
  ws.mergeCells(1, 1, 2, 1)
  const corner = ws.getCell(1, 1)
  corner.fill   = { type: 'pattern', pattern: 'solid', fgColor: { argb: MAROON_EVEN } }
  corner.border = { right: { style: 'medium', color: { argb: DARK_MAROON } }, bottom: { style: 'medium', color: { argb: DARK_MAROON } } }

  days.forEach((day, di) => {
    const dayRooms   = roomsByDay[day]
    const startCol   = getCol(day, 0)
    const isOdd      = di % 2 === 1
    const isDayStart = di > 0

    // Merge day header across all room sub-columns
    if (dayRooms.length > 1) ws.mergeCells(1, startCol, 1, startCol + dayRooms.length - 1)
    const dayCell = ws.getCell(1, startCol)
    dayCell.value = day.toUpperCase()
    dayCell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: isOdd ? MAROON_ODD : MAROON_EVEN } }
    dayCell.font  = { bold: true, color: { argb: 'FFFFFFFF' }, size: 12 }
    dayCell.alignment = { horizontal: 'center', vertical: 'middle' }
    dayCell.border = {
      left:   isDayStart ? { style: 'medium', color: { argb: DARK_MAROON } } : undefined,
      bottom: { style: 'thin', color: { argb: DARK_MAROON } },
      right:  { style: 'thin', color: { argb: DARK_MAROON } },
    }

    // ── Row 2: Room sub-headers ──────────────────────────────────────────
    dayRooms.forEach((room, ri) => {
      const col = getCol(day, ri)
      const cell = ws.getCell(2, col)
      cell.value = room.name
      cell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: isOdd ? ROOM_HDR_ODD : ROOM_HDR_EVEN } }
      cell.font  = { bold: true, color: { argb: isOdd ? 'FF5A3535' : 'FF500000' }, size: 9 }
      cell.alignment = { horizontal: 'center', vertical: 'middle' }
      cell.border = {
        left:   (ri === 0 && isDayStart) ? { style: 'medium', color: { argb: 'FFC0B0B0' } } : { style: 'thin', color: { argb: 'FFFF4444' } },
        right:  { style: 'thin', color: { argb: 'FFFF4444' } },
        bottom: { style: 'medium', color: { argb: 'FFB0A0A0' } },
      }
    })
  })

  // ── Rows 3+: Time slots ────────────────────────────────────────────────────
  for (let slot = 0; slot < TOTAL_SLOTS; slot++) {
    const rowNum = slot + 3
    ws.getRow(rowNum).height = 24
    const isHourBoundary = (GRID_START_MIN + slot * SLOT_MINUTES) % 60 === 0
    const is30min        = slot % 2 === 0  // label rows (every 30 min)

    // Time label
    const timeCell = ws.getCell(rowNum, 1)
    timeCell.value = slotToLabel(slot)
    timeCell.font  = { size: 9, color: { argb: 'FF888888' } }
    timeCell.alignment = { horizontal: 'right', vertical: 'top' }
    timeCell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: TIME_COL_BG } }
    timeCell.border = {
      top:    isHourBoundary ? { style: 'dashed', color: { argb: 'FFB0A0A0' } } : undefined,
      right:  { style: 'thin', color: { argb: 'FFFF4444' } },
      bottom: { style: 'thin', color: { argb: is30min ? 'FFFF4444' : 'FFF0EFE8' } },
    }

    // Slot cells per day × room
    days.forEach((day, di) => {
      const isDayStart = di > 0
      roomsByDay[day].forEach((room, ri) => {
        const col  = getCol(day, ri)
        const cell = ws.getCell(rowNum, col)
        const unavailable = !isRoomSlotAvailable(room, day, slot)
        cell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: unavailable ? 'FFFF4444' : SLOT_EVEN } }
        cell.border = {
          top:    isHourBoundary ? { style: 'dashed', color: { argb: 'FFB0A0A0' } } : undefined,
          left:   (ri === 0 && isDayStart) ? { style: 'medium', color: { argb: 'FFC0B0B0' } } : { style: 'thin', color: { argb: 'FFE8E8E8' } },
          right:  { style: 'thin', color: { argb: 'FFE8E8E8' } },
          bottom: { style: 'thin', color: { argb: is30min ? 'FFFF4444' : 'FFF0EFE8' } },
        }
      })
    })
  }

  // ── Place class blocks ─────────────────────────────────────────────────────
  scheduled
    .sort((a, b) => {
      const d = DAY_ORDER.indexOf(a.dayOfWeek) - DAY_ORDER.indexOf(b.dayOfWeek)
      return d !== 0 ? d : a.startTime.localeCompare(b.startTime)
    })
    .forEach((cls) => {
      const day = cls.dayOfWeek
      if (!roomsByDay[day]) return
      const ri = roomsByDay[day].findIndex((r) => r.id === cls.roomId)
      if (ri === -1) return

      const col       = getCol(day, ri)
      const slotStart = timeToSlot(cls.startTime)
      const slotSpan  = Math.max(1, Math.ceil(cls.durationMinutes / SLOT_MINUTES))
      const slotEnd   = Math.min(slotStart + slotSpan - 1, TOTAL_SLOTS - 1)
      const rowStart  = slotStart + 3
      const rowEnd    = slotEnd   + 3

      const teacher  = teacherMap[cls.teacherId]
      const room     = roomMap[cls.roomId]
      const bgArgb   = lightenArgb(teacher?.color, 0.78)
      const fgArgb   = toArgb(teacher?.color)

      try {
        if (rowStart < rowEnd) ws.mergeCells(rowStart, col, rowEnd, col)
      } catch (_) { /* conflict — render without merge */ }

      const cell = ws.getCell(rowStart, col)
      const teacherRoom = [teacher?.name, room?.name].filter(Boolean).join(' · ')
      cell.value     = [cls.name, teacherRoom].filter(Boolean).join('\n')
      cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgArgb } }
      cell.font      = { size: 10, color: { argb: fgArgb }, bold: true }
      cell.alignment = { vertical: 'top', horizontal: 'left', wrapText: true }
      cell.border    = {
        top:    { style: 'medium', color: { argb: fgArgb } },
        left:   { style: 'medium', color: { argb: fgArgb } },
        bottom: { style: 'medium', color: { argb: fgArgb } },
        right:  { style: 'thin',   color: { argb: 'FFFF4444' } },
      }
    })

  // ── Sheet 2: Unscheduled ──────────────────────────────────────────────────
  if (unscheduled.length > 0) {
    const ws2 = wb.addWorksheet('Unscheduled')
    ws2.columns = [
      { header: 'Class',          key: 'name',     width: 26 },
      { header: 'Genre',          key: 'genre',    width: 18 },
      { header: 'Teacher',        key: 'teacher',  width: 24 },
      { header: 'Room',           key: 'room',     width: 14 },
      { header: 'Duration (min)', key: 'duration', width: 16 },
    ]
    const hrow = ws2.getRow(1)
    hrow.height = 20
    hrow.eachCell((cell) => {
      cell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: MAROON_EVEN } }
      cell.font  = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 }
      cell.alignment = { vertical: 'middle', horizontal: 'left' }
    })
    unscheduled.forEach((cls) => {
      const teacher = teacherMap[cls.teacherId]
      const room    = roomMap[cls.roomId]
      const row = ws2.addRow({
        name:     cls.name,
        genre:    cls.style || '',
        teacher:  teacher?.name || '',
        room:     room?.name || '',
        duration: cls.durationMinutes,
      })
      row.height = 18
      row.eachCell({ includeEmpty: true }, (cell) => {
        cell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: lightenArgb(teacher?.color, 0.82) } }
        cell.font  = { size: 11, color: { argb: toArgb(teacher?.color) } }
        cell.alignment = { vertical: 'middle', horizontal: 'left' }
        cell.border = { bottom: { style: 'thin', color: { argb: 'FFDDDDDD' } } }
      })
    })
  }

  // ── Download ───────────────────────────────────────────────────────────────
  const buffer = await wb.xlsx.writeBuffer()
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = `dance-schedule-${new Date().toISOString().slice(0, 10)}.xlsx`
  a.click()
  URL.revokeObjectURL(url)
}
