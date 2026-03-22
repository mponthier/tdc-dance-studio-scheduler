import { useState, useRef, useEffect } from 'react'
import ClassBlock from './ClassBlock'
import ClassDetailPanel from './ClassDetailPanel'
import { DAYS, GRID_START_HOUR, GRID_START_MIN, TOTAL_SLOTS, SLOT_MINUTES, durationToRowSpan, timeToRow } from '../../utils/timeHelpers'
import { findAllConflictingIds } from '../../utils/conflicts'
import { isWithinAvailability } from '../../utils/availability'
import { optimizeSchedule } from '../../utils/optimizer'
import { optimizeWithCPSAT } from '../../utils/optimizerCPSAT'
import { exportScheduleToExcel } from '../../utils/exportSchedule'
import { exportScheduleToPDF } from '../../utils/exportPDF'
import Modal from '../../components/Modal'
import ConfirmDialog from '../../components/ConfirmDialog'
import './SchedulePage.css'

const SKILL_LEVELS = ['Beg/Int (6-10)', 'Beg/Int (10+)', 'Int/Adv (6-10)', 'Int/Adv (10+)']

const BASE_DAY_HDR   = 52  // px — day header row base height
const BASE_ROOM_HDR  = 28  // px — room sub-header row base height
const BASE_SLOT      = 30  // px — half-hour slot base height
const BASE_TIME_COL  = 56  // px — time label column base width
const BASE_COL_MIN   = 90  // px — room column minimum base width
// Grid now has 2 header rows (day + room), so time slots start at CSS grid row 3
const TIME_ROW_OFFSET = 3

function toMins(timeStr) {
  const [h, m] = timeStr.split(':').map(Number)
  return h * 60 + m
}

function isRoomSlotAvailable(room, day, slotIndex) {
  if (!room.availability || room.availability.length === 0) return true
  const slotMins = GRID_START_HOUR * 60 + GRID_START_MIN + slotIndex * SLOT_MINUTES
  return room.availability.some(
    (slot) => slot.dayOfWeek === day && toMins(slot.startTime) <= slotMins && toMins(slot.endTime) > slotMins
  )
}

/** Returns the teacher to assign for a rescheduled (already-scheduled) drop, or null if none is available.
 *  - If cls already has a teacher, returns that teacher only if they are free.
 *  - If cls has no teacher, finds the first eligible (by style) free teacher. */
function findAvailableTeacher(cls, day, slotIndex, allTeachers, allClasses) {
  const startTime = slotIndexToTime(slotIndex)
  if (cls.teacherId) {
    const teacher = allTeachers.find((t) => t.id === cls.teacherId)
    if (!teacher) return null
    if (!isWithinAvailability(teacher.availability, day, startTime, cls.durationMinutes)) return null
    return isTeacherFreeForSlot(cls.teacherId, day, slotIndex, cls.durationMinutes, cls.id, allClasses) ? teacher : null
  }
  return allTeachers.find((t) => {
    const specs = Array.isArray(t.specialty) ? t.specialty : (t.specialty ? [t.specialty] : [])
    const matchesStyle = !cls.style || specs.length === 0 || specs.some((s) => s.toLowerCase() === cls.style.toLowerCase())
    return matchesStyle &&
      isWithinAvailability(t.availability, day, startTime, cls.durationMinutes) &&
      isTeacherFreeForSlot(t.id, day, slotIndex, cls.durationMinutes, cls.id, allClasses)
  }) || null
}

/** Returns all teachers eligible to teach cls at the given slot (genre match + availability + no conflict). */
function findEligibleTeachers(cls, day, slotIndex, allTeachers, allClasses) {
  const startTime = slotIndexToTime(slotIndex)
  return allTeachers.filter((t) => {
    const specs = Array.isArray(t.specialty) ? t.specialty : (t.specialty ? [t.specialty] : [])
    const matchesStyle = !cls.style || specs.length === 0 || specs.some((s) => s.toLowerCase() === cls.style.toLowerCase())
    return matchesStyle &&
      isWithinAvailability(t.availability, day, startTime, cls.durationMinutes) &&
      isTeacherFreeForSlot(t.id, day, slotIndex, cls.durationMinutes, cls.id, allClasses)
  })
}

function isTeacherFreeForSlot(teacherId, day, slotIndex, durationMinutes, excludeClassId, allClasses) {
  if (!teacherId) return true
  const propStart = GRID_START_HOUR * 60 + GRID_START_MIN + slotIndex * SLOT_MINUTES
  const propEnd   = propStart + durationMinutes
  return !allClasses.some(
    (cls) =>
      cls.id !== excludeClassId &&
      cls.teacherId === teacherId &&
      cls.dayOfWeek === day &&
      cls.startTime &&
      toMins(cls.startTime) < propEnd &&
      toMins(cls.startTime) + cls.durationMinutes > propStart
  )
}

function slotIndexToTime(slotIndex) {
  const totalMins = GRID_START_HOUR * 60 + GRID_START_MIN + slotIndex * SLOT_MINUTES
  const h = Math.floor(totalMins / 60)
  const m = totalMins % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

function assignLanes(colClasses) {
  const sorted = [...colClasses].sort((a, b) => toMins(a.startTime) - toMins(b.startTime))
  const laneEnds = []
  const laneMap = {}
  for (const cls of sorted) {
    const start = toMins(cls.startTime)
    const end   = start + cls.durationMinutes
    let lane = laneEnds.findIndex((e) => start >= e)
    if (lane === -1) { lane = laneEnds.length; laneEnds.push(end) }
    else { laneEnds[lane] = end }
    laneMap[cls.id] = lane
  }
  return { laneMap, totalLanes: Math.max(1, laneEnds.length) }
}

function RoomColumn({ col, colClasses, teachers, rooms, conflictIds, slotHeight, colorMode, onSelect, onContextMenu, onDragStart, onDragEnd }) {
  const { laneMap, totalLanes } = assignLanes(colClasses)
  return (
    <div style={{ gridColumn: col, gridRow: `${TIME_ROW_OFFSET} / span ${TOTAL_SLOTS}`, position: 'relative', pointerEvents: 'none' }}>
      {colClasses.map((cls) => {
        const lane    = laneMap[cls.id]
        const top     = (timeToRow(cls.startTime) - 2) * slotHeight + 1
        const height  = durationToRowSpan(cls.durationMinutes) * slotHeight - 2
        const teacher = teachers.find((t) => t.id === cls.teacherId)
        const room    = rooms.find((r) => r.id === cls.roomId)
        return (
          <ClassBlock
            key={cls.id}
            cls={cls}
            teacher={teacher}
            room={room}
            hasConflict={conflictIds.has(cls.id)}
            style={{
              position: 'absolute',
              top,
              height,
              left: `calc(${lane} * 100% / ${totalLanes} + 2px)`,
              width: `calc(100% / ${totalLanes} - 4px)`,
              margin: 0,
              boxSizing: 'border-box',
            }}
            colorMode={colorMode}
            onClick={() => onSelect(cls)}
            onContextMenu={onContextMenu}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
          />
        )
      })}
    </div>
  )
}

function UnscheduledChip({ cls, teacher, onDragStart, onDragEnd }) {
  const color = teacher?.color || '#888'
  return (
    <div
      draggable
      className="unscheduled-chip"
      style={{ borderLeft: `3px solid ${color}`, background: color + '22' }}
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = 'move'
        e.dataTransfer.setData('text/plain', cls.id)
        onDragStart(cls.id)
      }}
      onDragEnd={onDragEnd}
      title={`Drag to schedule\n${cls.name}${teacher ? ' · ' + teacher.name : ''}`}
    >
      <span className="unscheduled-chip-name">{cls.name}</span>
      {teacher && <span className="unscheduled-chip-meta">{teacher.name}</span>}
      <span className="unscheduled-chip-meta">{cls.durationMinutes} min</span>
    </div>
  )
}

function TimeLabel({ slotIndex }) {
  const totalMins = GRID_START_HOUR * 60 + GRID_START_MIN + slotIndex * SLOT_MINUTES
  const h = Math.floor(totalMins / 60)
  const m = totalMins % 60
  const isHourBoundary = (GRID_START_MIN + slotIndex * SLOT_MINUTES) % 60 === 0
  const cls = `time-label${isHourBoundary ? ' hour-boundary' : ''}`
  if (slotIndex % 2 !== 0) return <div className={cls} style={{ gridColumn: 1, gridRow: slotIndex + TIME_ROW_OFFSET }} />
  const suffix = h >= 12 ? 'pm' : 'am'
  const hour = h % 12 || 12
  const label = `${hour}:${String(m).padStart(2, '0')}${suffix}`
  return (
    <div className={cls} style={{ gridColumn: 1, gridRow: slotIndex + TIME_ROW_OFFSET }}>
      {label}
    </div>
  )
}

export default function SchedulePage({ classes, teachers, rooms, students, classCrud }) {
  const gridRef = useRef(null)
  const [selected, setSelected]           = useState(null)
  const [optimizeResult, setOptimizeResult] = useState(null)
  const [optimizing, setOptimizing] = useState(false)
  const [filterTeacherIds, setFilterTeacherIds] = useState(new Set())
  const [filterRoomIds, setFilterRoomIds]       = useState(new Set())
  const [teacherDropOpen, setTeacherDropOpen]   = useState(false)
  const [roomDropOpen, setRoomDropOpen]         = useState(false)
  const [hiddenDays, setHiddenDays]       = useState(new Set())
  const [draggingId, setDraggingId]       = useState(null)
  const [dragOverSlot, setDragOverSlot]   = useState(null) // { day, roomId, slotIndex }
  const [contextMenu, setContextMenu]     = useState(null) // { cls, x, y }
  const [confirmCls, setConfirmCls]       = useState(null)
  const [confirmClear, setConfirmClear]   = useState(false)
  const [confirmAutoSchedule, setConfirmAutoSchedule] = useState(false)
  const [teacherPickerDrop, setTeacherPickerDrop] = useState(null)
  const [colorMode, setColorMode]         = useState('teacher') // 'teacher' | 'skillLevel'
  const [filterSkillLevels, setFilterSkillLevels] = useState(new Set())
  const [skillDropOpen, setSkillDropOpen] = useState(false) // { cls, day, roomId, slotIndex, eligibleTeachers }
  const [zoom, setZoom]                   = useState(1.0)

  useEffect(() => {
    if (!contextMenu) return
    function close() { setContextMenu(null) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [contextMenu])

  useEffect(() => {
    if (!teacherDropOpen && !roomDropOpen && !skillDropOpen) return
    function close() { setTeacherDropOpen(false); setRoomDropOpen(false); setSkillDropOpen(false) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [teacherDropOpen, roomDropOpen, skillDropOpen])

  const slotHeight  = Math.round(BASE_SLOT     * zoom)
  const dayHdrH     = Math.round(BASE_DAY_HDR  * zoom)
  const roomHdrH    = Math.round(BASE_ROOM_HDR * zoom)
  const timeColW    = Math.round(BASE_TIME_COL * zoom)
  const colMinW     = Math.round(BASE_COL_MIN  * zoom)

  const conflictIds = findAllConflictingIds(classes)
  const todayName   = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][new Date().getDay()]
  const hasAnyClasses = classes.length > 0

  const visibleRooms = filterRoomIds.size > 0 ? rooms.filter((r) => filterRoomIds.has(r.id)) : rooms

  function isRoomAvailableOnDay(room, day) {
    if (!room.availability || room.availability.length === 0) return true
    return room.availability.some((slot) => slot.dayOfWeek === day)
  }

  // Days that have at least one room with availability — only these get toggle buttons
  const daysWithRooms = DAYS.filter((day) => visibleRooms.some((r) => isRoomAvailableOnDay(r, day)))
  const visibleDays  = daysWithRooms.filter((d) => !hiddenDays.has(d))

  // Per-day room lists — rooms with no availability on a given day are omitted
  const roomsByDay = {}
  visibleDays.forEach((day) => {
    roomsByDay[day] = visibleRooms.filter((r) => isRoomAvailableOnDay(r, day))
  })

  // Cumulative column start for each day (days with 0 rooms occupy 0 columns)
  const dayColStart = {}
  let _colCursor = 2
  visibleDays.forEach((day) => {
    dayColStart[day] = _colCursor
    _colCursor += roomsByDay[day].length
  })
  const totalGridCols = _colCursor - 2

  // Column index for a given (day, roomIndex) — 1-based, after time-label col
  function getCol(day, ri) {
    return dayColStart[day] + ri
  }

  function toggleDay(day) {
    setHiddenDays((prev) => {
      const next = new Set(prev)
      next.has(day) ? next.delete(day) : next.add(day)
      return next
    })
  }

  function handleClearSchedule() {
    classCrud.updateMany(classes.map((c) => ({ ...c, dayOfWeek: '', startTime: '', roomId: '', teacherId: '' })))
    setOptimizeResult(null)
  }

  async function handleAutoSchedule() {
    setOptimizing(true)
    setOptimizeResult(null)
    const t0 = Date.now()
    try {
      let scheduled, unscheduledIds, usedFallback = false
      try {
        const result = await optimizeWithCPSAT(classes, teachers, rooms)
        scheduled = result.scheduled
        unscheduledIds = result.unscheduledIds
      } catch (err) {
        // Backend unavailable — fall back to greedy
        console.warn('CP-SAT backend error, falling back to greedy:', err)
        usedFallback = true
        const updated = optimizeSchedule(classes, teachers, rooms)
        scheduled = updated
        unscheduledIds = classes
          .filter((c) => (!c.dayOfWeek || !c.startTime) && !updated.find((u) => u.id === c.id))
          .map((c) => c.id)
      }
      const elapsed = ((Date.now() - t0) / 1000).toFixed(1)
      if (scheduled.length > 0) classCrud.updateMany(scheduled)
      const unscheduledNames = unscheduledIds
        .map((id) => classes.find((c) => c.id === id)?.name)
        .filter(Boolean)
      const solver = usedFallback ? 'greedy fallback' : 'CP-SAT'
      setOptimizeResult({
        count: scheduled.length,
        unscheduled: unscheduledNames,
        solver,
        elapsed,
      })
    } finally {
      setOptimizing(false)
    }
  }

  function handleContextMenu(e, cls) {
    setContextMenu({ cls, x: e.clientX, y: e.clientY })
  }

  function handleUnscheduleConfirm() {
    classCrud.update({ ...confirmCls, dayOfWeek: '', startTime: '', roomId: '', teacherId: '' })
    setConfirmCls(null)
  }

  function handleSlotDragOver(e, day, roomId, slotIndex) {
    if (!draggingId) return
    const cls = classes.find((c) => c.id === draggingId)
    if (!cls) return
    const room = rooms.find((r) => r.id === roomId)
    if (!room) return
    if (!isWithinAvailability(room.availability, day, slotIndexToTime(slotIndex), cls.durationMinutes)) return
    const isUnscheduled = !cls.dayOfWeek || !cls.startTime
    if (isUnscheduled) {
      if (findEligibleTeachers(cls, day, slotIndex, teachers, classes).length === 0) return
    } else {
      if (!findAvailableTeacher(cls, day, slotIndex, teachers, classes)) return
    }
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (!dragOverSlot || dragOverSlot.day !== day || dragOverSlot.roomId !== roomId || dragOverSlot.slotIndex !== slotIndex) {
      setDragOverSlot({ day, roomId, slotIndex })
    }
  }

  function handleSlotDrop(e, day, roomId, slotIndex) {
    e.preventDefault()
    const classId = e.dataTransfer.getData('text/plain')
    const cls = classes.find((c) => c.id === classId)
    if (!cls) return
    const room = rooms.find((r) => r.id === roomId)
    if (!room) return
    if (!isWithinAvailability(room.availability, day, slotIndexToTime(slotIndex), cls.durationMinutes)) return
    const isUnscheduled = !cls.dayOfWeek || !cls.startTime
    if (isUnscheduled) {
      const eligible = findEligibleTeachers(cls, day, slotIndex, teachers, classes)
      if (eligible.length === 0) return
      setTeacherPickerDrop({ cls, day, roomId, slotIndex, eligibleTeachers: eligible })
    } else {
      const teacher = findAvailableTeacher(cls, day, slotIndex, teachers, classes)
      if (!teacher) return
      classCrud.update({ ...cls, dayOfWeek: day, startTime: slotIndexToTime(slotIndex), roomId, teacherId: teacher.id })
    }
    setDraggingId(null)
    setDragOverSlot(null)
  }

  function handleDragEnd() {
    setDraggingId(null)
    setDragOverSlot(null)
  }

  const unscheduledClasses = classes.filter((c) => !c.dayOfWeek || !c.startTime)
  const scheduledClasses   = classes.filter((c) => c.dayOfWeek && c.startTime)
  const visibleClasses     = scheduledClasses
    .filter((c) => filterTeacherIds.size  === 0 || filterTeacherIds.has(c.teacherId))
    .filter((c) => filterRoomIds.size     === 0 || filterRoomIds.has(c.roomId))
    .filter((c) => filterSkillLevels.size === 0 || filterSkillLevels.has(c.skillLevel || ''))

  // Group visible classes by (day, roomId) for each column
  const classesByCol = {}
  visibleDays.forEach((day) => {
    roomsByDay[day].forEach((room) => {
      classesByCol[`${day}-${room.id}`] = []
    })
  })
  visibleClasses.forEach((c) => {
    const key = `${c.dayOfWeek}-${c.roomId}`
    if (classesByCol[key]) classesByCol[key].push(c)
  })

  const draggingCls  = draggingId ? classes.find((c) => c.id === draggingId) : null
  const draggingSpan = draggingCls ? Math.ceil(draggingCls.durationMinutes / SLOT_MINUTES) : 0


  return (
    <div className="schedule-page" style={optimizing ? { cursor: 'wait' } : undefined}>
      <div className="schedule-header">
        <h1>Weekly Schedule</h1>
        {hasAnyClasses && (
          <div className="schedule-header-actions">
            <div className="filter-dropdown-wrap">
              <button
                type="button"
                className={`schedule-filter-btn${filterTeacherIds.size > 0 ? ' active' : ''}`}
                onClick={() => { setTeacherDropOpen((o) => !o); setRoomDropOpen(false); setSkillDropOpen(false) }}
              >
                {filterTeacherIds.size === 0
                  ? 'All teachers'
                  : filterTeacherIds.size === 1
                    ? teachers.find((t) => filterTeacherIds.has(t.id))?.name ?? 'Teacher'
                    : `${filterTeacherIds.size} teachers`}
                <span className="filter-caret">▾</span>
              </button>
              {teacherDropOpen && (
                <div className="filter-dropdown" onMouseDown={(e) => e.stopPropagation()}>
                  {filterTeacherIds.size > 0 && (
                    <button type="button" className="filter-dropdown-clear" onClick={() => setFilterTeacherIds(new Set())}>
                      Clear selection
                    </button>
                  )}
                  {teachers.map((t) => (
                    <label key={t.id} className="filter-dropdown-item">
                      <input
                        type="checkbox"
                        checked={filterTeacherIds.has(t.id)}
                        onChange={(e) => setFilterTeacherIds((prev) => {
                          const next = new Set(prev)
                          e.target.checked ? next.add(t.id) : next.delete(t.id)
                          return next
                        })}
                      />
                      <span className="filter-color-dot" style={{ background: t.color || '#888' }} />
                      {t.name}
                    </label>
                  ))}
                </div>
              )}
            </div>
            <div className="filter-dropdown-wrap">
              <button
                type="button"
                className={`schedule-filter-btn${filterRoomIds.size > 0 ? ' active' : ''}`}
                onClick={() => { setRoomDropOpen((o) => !o); setTeacherDropOpen(false); setSkillDropOpen(false) }}
              >
                {filterRoomIds.size === 0
                  ? 'All rooms'
                  : filterRoomIds.size === 1
                    ? rooms.find((r) => filterRoomIds.has(r.id))?.name ?? 'Room'
                    : `${filterRoomIds.size} rooms`}
                <span className="filter-caret">▾</span>
              </button>
              {roomDropOpen && (
                <div className="filter-dropdown" onMouseDown={(e) => e.stopPropagation()}>
                  {filterRoomIds.size > 0 && (
                    <button type="button" className="filter-dropdown-clear" onClick={() => setFilterRoomIds(new Set())}>
                      Clear selection
                    </button>
                  )}
                  {rooms.map((r) => (
                    <label key={r.id} className="filter-dropdown-item">
                      <input
                        type="checkbox"
                        checked={filterRoomIds.has(r.id)}
                        onChange={(e) => setFilterRoomIds((prev) => {
                          const next = new Set(prev)
                          e.target.checked ? next.add(r.id) : next.delete(r.id)
                          return next
                        })}
                      />
                      {r.name}
                    </label>
                  ))}
                </div>
              )}
            </div>
            <div className="filter-dropdown-wrap">
              <button
                type="button"
                className={`schedule-filter-btn${filterSkillLevels.size > 0 ? ' active' : ''}`}
                onClick={() => { setSkillDropOpen((o) => !o); setTeacherDropOpen(false); setRoomDropOpen(false) }}
              >
                {filterSkillLevels.size === 0
                  ? 'All skill levels'
                  : filterSkillLevels.size === 1
                    ? [...filterSkillLevels][0]
                    : `${filterSkillLevels.size} skill levels`}
                <span className="filter-caret">▾</span>
              </button>
              {skillDropOpen && (
                <div className="filter-dropdown" onMouseDown={(e) => e.stopPropagation()}>
                  {filterSkillLevels.size > 0 && (
                    <button type="button" className="filter-dropdown-clear" onClick={() => setFilterSkillLevels(new Set())}>
                      Clear selection
                    </button>
                  )}
                  {SKILL_LEVELS.map((s) => (
                    <label key={s} className="filter-dropdown-item">
                      <input
                        type="checkbox"
                        checked={filterSkillLevels.has(s)}
                        onChange={(e) => setFilterSkillLevels((prev) => {
                          const next = new Set(prev)
                          e.target.checked ? next.add(s) : next.delete(s)
                          return next
                        })}
                      />
                      {s}
                    </label>
                  ))}
                </div>
              )}
            </div>
            <button
              className="btn btn-primary"
              onClick={() => exportScheduleToExcel(visibleClasses.filter((c) => !hiddenDays.has(c.dayOfWeek)), teachers, rooms, students, visibleDays, visibleRooms)}
              disabled={scheduledClasses.length === 0}
            >
              Export to Excel
            </button>
            <button className="btn btn-primary" onClick={() => exportScheduleToPDF(gridRef.current)} disabled={scheduledClasses.length === 0}>
              Export to PDF
            </button>
            <button className="btn btn-primary" onClick={() => setConfirmClear(true)} disabled={scheduledClasses.length === 0}>
              Clear Schedule
            </button>
            <button className="btn btn-primary" onClick={() => setConfirmAutoSchedule(true)} disabled={optimizing || classes.length === 0}>
              {optimizing ? 'Scheduling…' : 'Auto Schedule'}
            </button>
          </div>
        )}
      </div>

      <div className="schedule-toolbar">
        <div className="day-toggles">
          {daysWithRooms.map((day) => (
            <button
              key={day}
              className={`day-toggle${hiddenDays.has(day) ? ' hidden' : ''}`}
              onClick={() => toggleDay(day)}
              title={hiddenDays.has(day) ? `Show ${day}` : `Hide ${day}`}
            >
              {day.slice(0, 3)}
            </button>
          ))}
        </div>
        <div className="toolbar-right">
          <div className="color-mode-toggle">
            <button
              className={`color-mode-btn${colorMode === 'teacher' ? ' active' : ''}`}
              onClick={() => setColorMode('teacher')}
              title="Color by teacher"
            >
              Teacher
            </button>
            <button
              className={`color-mode-btn${colorMode === 'skillLevel' ? ' active' : ''}`}
              onClick={() => setColorMode('skillLevel')}
              title="Color by skill level"
            >
              Skill Level
            </button>
          </div>
          <div className="zoom-controls">
            <button className="zoom-btn" onClick={() => setZoom((z) => Math.max(0.6, +(z - 0.1).toFixed(1)))} title="Zoom out">−</button>
            <span className="zoom-label">{Math.round(zoom * 100)}%</span>
            <button className="zoom-btn" onClick={() => setZoom((z) => Math.min(2.0, +(z + 0.1).toFixed(1)))} title="Zoom in">+</button>
            {zoom !== 1.0 && <button className="zoom-btn zoom-reset" onClick={() => setZoom(1.0)} title="Reset zoom">↺</button>}
          </div>
        </div>
      </div>

      {!hasAnyClasses ? (
        <div className="schedule-empty">
          <div className="empty-icon">📅</div>
          <p>No classes scheduled yet. Go to <strong>Classes</strong> to create your first class.</p>
        </div>
      ) : (
        <div className="grid-wrapper" ref={gridRef}>
          <div
            className="weekly-grid"
            style={{
              gridTemplateColumns: `${timeColW}px repeat(${totalGridCols}, minmax(${colMinW}px, 1fr))`,
              gridTemplateRows: `${dayHdrH}px ${roomHdrH}px repeat(${TOTAL_SLOTS}, ${slotHeight}px)`,
            }}
          >
            {/* Corner — spans both header rows */}
            <div className="grid-corner" style={{ gridRow: '1 / span 2' }} />

            {/* Day headers — each spans its available room columns */}
            {visibleDays.map((day, di) => {
              const dayRooms = roomsByDay[day]
              if (dayRooms.length === 0) return null
              return (
                <div
                  key={day}
                  className={`grid-day-header${day === todayName ? ' today' : ''}${di % 2 === 1 ? ' day-odd' : ''}${di > 0 ? ' day-start' : ''}`}
                  style={{
                    gridColumn: dayRooms.length > 1 ? `${getCol(day, 0)} / span ${dayRooms.length}` : getCol(day, 0),
                    gridRow: 1,
                  }}
                >
                  {day.slice(0, 3)}
                </div>
              )
            })}

            {/* Room sub-headers */}
            {visibleDays.map((day, di) =>
              roomsByDay[day].map((room, ri) => (
                <div
                  key={`${day}-${room.id}-header`}
                  className={`grid-room-header${day === todayName ? ' today' : ''}${di % 2 === 1 ? ' day-odd' : ''}${ri === 0 && di > 0 ? ' day-start' : ''}`}
                  style={{ gridColumn: getCol(day, ri), gridRow: 2 }}
                >
                  {room.name}
                </div>
              ))
            )}

            {/* Time labels */}
            {Array.from({ length: TOTAL_SLOTS }, (_, i) => <TimeLabel key={i} slotIndex={i} />)}

            {/* Grid slots (drop targets) */}
            {Array.from({ length: TOTAL_SLOTS }, (_, slotIdx) =>
              visibleDays.map((day, di) =>
                roomsByDay[day].map((room, ri) => {
                  const col = getCol(day, ri)
                  const isOver = dragOverSlot?.day === day &&
                    dragOverSlot?.roomId === room.id &&
                    slotIdx >= dragOverSlot.slotIndex &&
                    slotIdx < dragOverSlot.slotIndex + draggingSpan
                  const isDayEven = di % 2 === 0
                  const isDayStart = ri === 0 && di > 0
                  const isUnavailable = !isRoomSlotAvailable(room, day, slotIdx)
                  const isHourBoundary = (GRID_START_MIN + slotIdx * SLOT_MINUTES) % 60 === 0
                  return (
                    <div
                      key={`${day}-${room.id}-${slotIdx}`}
                      className={`grid-slot${isOver ? ' drag-over' : ''}${isDayEven ? ' day-even' : ' day-odd'}${isDayStart ? ' day-start' : ''}${isUnavailable ? ' slot-unavailable' : ''}${isHourBoundary ? ' hour-boundary' : ''}`}
                      style={{ gridColumn: col, gridRow: slotIdx + TIME_ROW_OFFSET }}
                      onDragOver={(e) => handleSlotDragOver(e, day, room.id, slotIdx)}
                      onDrop={(e) => handleSlotDrop(e, day, room.id, slotIdx)}
                      onDragLeave={() => setDragOverSlot(null)}
                    />
                  )
                })
              )
            )}

            {/* Class blocks per (day, room) column */}
            {visibleDays.map((day) =>
              roomsByDay[day].map((room, ri) => {
                const key      = `${day}-${room.id}`
                const colClasses = classesByCol[key] || []
                if (colClasses.length === 0) return null
                return (
                  <RoomColumn
                    key={key}
                    col={getCol(day, ri)}
                    colClasses={colClasses}
                    teachers={teachers}
                    rooms={rooms}
                    conflictIds={conflictIds}
                    slotHeight={slotHeight}
                    colorMode={colorMode}
                    onSelect={setSelected}
                    onContextMenu={handleContextMenu}
                    onDragStart={setDraggingId}
                    onDragEnd={handleDragEnd}
                  />
                )
              })
            )}
          </div>
        </div>
      )}

      {unscheduledClasses.length > 0 && (
        <div className="unscheduled-panel">
          <div className="unscheduled-panel-header">
            Unscheduled Classes — drag to the calendar to schedule
          </div>
          <div className="unscheduled-chips">
            {unscheduledClasses.map((cls) => (
              <UnscheduledChip
                key={cls.id}
                cls={cls}
                teacher={teachers.find((t) => t.id === cls.teacherId)}
                onDragStart={setDraggingId}
                onDragEnd={handleDragEnd}
              />
            ))}
          </div>
        </div>
      )}

      {optimizeResult && (
        <div className="optimize-messages">
          <span>
            {optimizeResult.count > 0
              ? `Scheduled ${optimizeResult.count} class${optimizeResult.count !== 1 ? 'es' : ''}.`
              : 'No classes could be scheduled.'}
            {optimizeResult.unscheduled.length > 0 && ` Could not place: ${optimizeResult.unscheduled.join(', ')}.`}
            {` (${optimizeResult.solver}, ${optimizeResult.elapsed}s)`}
          </span>
          <button className="btn btn-ghost btn-sm" onClick={() => setOptimizeResult(null)}>Clear</button>
        </div>
      )}

      {contextMenu && (
        <div
          className="context-menu"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <button
            className="context-menu-item context-menu-item-danger"
            onClick={() => { setConfirmCls(contextMenu.cls); setContextMenu(null) }}
          >
            Unschedule class
          </button>
        </div>
      )}

      {confirmAutoSchedule && (
        <ConfirmDialog
          title="Auto Schedule"
          message="Auto scheduling may take up to 2 minutes to complete. Proceed?"
          confirmLabel="Schedule"
          onConfirm={() => { setConfirmAutoSchedule(false); handleAutoSchedule() }}
          onCancel={() => setConfirmAutoSchedule(false)}
        />
      )}

      {confirmClear && (
        <ConfirmDialog
          title="Confirm Clear"
          message="Clear the entire schedule? All classes will be unscheduled. This cannot be undone."
          confirmLabel="Clear"
          onConfirm={() => { handleClearSchedule(); setConfirmClear(false) }}
          onCancel={() => setConfirmClear(false)}
        />
      )}

      {confirmCls && (
        <Modal title="Unschedule Class" onClose={() => setConfirmCls(null)}>
          <div className="modal-body">
            <p>Remove <strong>{confirmCls.name}</strong> from the schedule? The class will not be deleted.</p>
          </div>
          <div className="modal-footer">
            <button className="btn btn-ghost" onClick={() => setConfirmCls(null)}>Cancel</button>
            <button className="btn btn-danger" onClick={handleUnscheduleConfirm}>Unschedule</button>
          </div>
        </Modal>
      )}

      {teacherPickerDrop && (
        <Modal title={`Select Teacher — ${teacherPickerDrop.cls.name}`} onClose={() => setTeacherPickerDrop(null)}>
          <div className="modal-body">
            <div className="teacher-picker-list">
              {teacherPickerDrop.eligibleTeachers.map((t) => (
                <button
                  key={t.id}
                  className="teacher-picker-item"
                  onClick={() => {
                    const { cls, day, roomId, slotIndex } = teacherPickerDrop
                    classCrud.update({ ...cls, dayOfWeek: day, startTime: slotIndexToTime(slotIndex), roomId, teacherId: t.id })
                    setTeacherPickerDrop(null)
                  }}
                >
                  <span className="teacher-picker-dot" style={{ background: t.color || '#888' }} />
                  {t.name}
                </button>
              ))}
            </div>
          </div>
          <div className="modal-footer">
            <button className="btn btn-ghost" onClick={() => setTeacherPickerDrop(null)}>Cancel</button>
          </div>
        </Modal>
      )}

      {selected && (
        <ClassDetailPanel
          cls={selected}
          teacher={teachers.find((t) => t.id === selected.teacherId)}
          room={rooms.find((r) => r.id === selected.roomId)}
          students={students}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  )
}
