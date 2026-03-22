import { useState, useEffect, useRef, useMemo } from 'react'
import { DAYS, GRID_END_HOUR, GRID_END_MIN } from '../utils/timeHelpers'
import './AvailabilityEditor.css'

const GRID_START_HOUR = 15  // 3:30 pm
const GRID_START_MIN  = 30
const SLOT_MINUTES = 30
const TOTAL_SLOTS = ((GRID_END_HOUR * 60 + GRID_END_MIN) - (GRID_START_HOUR * 60 + GRID_START_MIN)) / SLOT_MINUTES // 12

// ── Data helpers ──────────────────────────────────────────────

function toMins(timeStr) {
  const [h, m] = timeStr.split(':').map(Number)
  return h * 60 + m
}

function minsToTime(mins) {
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

function slotKey(day, slotIndex) {
  return `${day}:${slotIndex}`
}

/** Convert availability slots array → Set of slot keys */
function slotsToSet(availability) {
  const set = new Set()
  for (const slot of availability || []) {
    const start = toMins(slot.startTime)
    const end = toMins(slot.endTime)
    const gridStart = GRID_START_HOUR * 60 + GRID_START_MIN
    for (let m = start; m < end; m += SLOT_MINUTES) {
      const slotIndex = (m - gridStart) / SLOT_MINUTES
      if (slotIndex >= 0 && slotIndex < TOTAL_SLOTS) {
        set.add(slotKey(slot.dayOfWeek, slotIndex))
      }
    }
  }
  return set
}

/** Convert Set of slot keys → merged availability slots array */
function setToSlots(cellSet) {
  // Group slot indices by day
  const byDay = {}
  for (const key of cellSet) {
    const colonIdx = key.indexOf(':')
    const day = key.slice(0, colonIdx)
    const idx = parseInt(key.slice(colonIdx + 1), 10)
    if (!byDay[day]) byDay[day] = []
    byDay[day].push(idx)
  }

  const slots = []
  const gridStartMins = GRID_START_HOUR * 60 + GRID_START_MIN

  for (const day of DAYS) {
    const indices = byDay[day]
    if (!indices || indices.length === 0) continue
    indices.sort((a, b) => a - b)

    // Merge consecutive indices into ranges
    let rangeStart = indices[0]
    let prev = indices[0]
    for (let i = 1; i < indices.length; i++) {
      if (indices[i] === prev + 1) {
        prev = indices[i]
      } else {
        slots.push({
          dayOfWeek: day,
          startTime: minsToTime(gridStartMins + rangeStart * SLOT_MINUTES),
          endTime: minsToTime(gridStartMins + (prev + 1) * SLOT_MINUTES),
        })
        rangeStart = indices[i]
        prev = indices[i]
      }
    }
    slots.push({
      dayOfWeek: day,
      startTime: minsToTime(gridStartMins + rangeStart * SLOT_MINUTES),
      endTime: minsToTime(gridStartMins + (prev + 1) * SLOT_MINUTES),
    })
  }

  return slots
}

/** Lighten a hex color toward white */
function lightenHex(hex, ratio = 0.65) {
  if (!hex || hex.length < 7) return '#c8d6ff'
  const r = Math.round(parseInt(hex.slice(1, 3), 16) + (255 - parseInt(hex.slice(1, 3), 16)) * ratio)
  const g = Math.round(parseInt(hex.slice(3, 5), 16) + (255 - parseInt(hex.slice(3, 5), 16)) * ratio)
  const b = Math.round(parseInt(hex.slice(5, 7), 16) + (255 - parseInt(hex.slice(5, 7), 16)) * ratio)
  return `rgb(${r},${g},${b})`
}

// ── Component ─────────────────────────────────────────────────

export default function AvailabilityEditor({ value = [], onChange, color = '#6c5ce7' }) {
  const [cells, setCells] = useState(() => slotsToSet(value))
  const cellsRef = useRef(cells)

  // Sync from props when value changes externally (e.g. initial load)
  const isPainting = useRef(false)
  useEffect(() => {
    if (!isPainting.current) {
      const next = slotsToSet(value)
      setCells(next)
      cellsRef.current = next
    }
  }, [value])

  const addMode = useRef(true)
  const activeColor = lightenHex(color, 0.6)
  const activeBorder = color

  // Stop painting on mouseup anywhere
  useEffect(() => {
    function stopPaint() {
      if (!isPainting.current) return
      isPainting.current = false
      onChange(setToSlots(cellsRef.current))
    }
    document.addEventListener('mouseup', stopPaint)
    return () => document.removeEventListener('mouseup', stopPaint)
  }, [onChange])

  function handleCellMouseDown(day, slotIndex) {
    isPainting.current = true
    const key = slotKey(day, slotIndex)
    setCells((prev) => {
      const adding = !prev.has(key)
      addMode.current = adding
      const next = new Set(prev)
      adding ? next.add(key) : next.delete(key)
      cellsRef.current = next
      return next
    })
  }

  function handleCellMouseEnter(day, slotIndex) {
    if (!isPainting.current) return
    const key = slotKey(day, slotIndex)
    setCells((prev) => {
      const next = new Set(prev)
      addMode.current ? next.add(key) : next.delete(key)
      cellsRef.current = next
      return next
    })
  }

  function clearAll() {
    setCells(new Set())
    onChange([])
  }

  function selectAll() {
    const next = new Set()
    for (const day of DAYS) {
      for (let i = 0; i < TOTAL_SLOTS; i++) {
        next.add(slotKey(day, i))
      }
    }
    setCells(next)
    onChange(setToSlots(next))
  }

  // Build time label for a slot index (every slot = 30 min granularity)
  function getTimeLabel(slotIndex) {
    const totalMins = GRID_START_HOUR * 60 + GRID_START_MIN + slotIndex * SLOT_MINUTES
    const h = Math.floor(totalMins / 60)
    const m = totalMins % 60
    const suffix = h >= 12 ? 'p' : 'a'
    const hour = h % 12 || 12
    return `${hour}:${String(m).padStart(2, '0')}${suffix}`
  }

  return (
    <div className="avail-grid-section">
      <div className="avail-grid-header">
        <span className="avail-grid-label">Available Hours</span>
        <div className="avail-grid-actions">
          <button type="button" className="btn btn-ghost btn-sm" onClick={clearAll}>Clear</button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={selectAll}>Select All</button>
        </div>
      </div>
      <p className="avail-grid-hint">Click or drag to mark available time slots. Empty = no restrictions.</p>

      <div className="avail-grid-wrapper" onMouseLeave={() => { /* keep painting across day cols */ }}>
        <div className="avail-grid">
          {/* Corner */}
          <div className="avail-corner" />

          {/* Day headers */}
          {DAYS.map((day, i) => (
            <div
              key={day}
              className="avail-day-header"
              style={{ gridColumn: i + 2, gridRow: 1 }}
            >
              {day.slice(0, 3)}
            </div>
          ))}

          {/* Time labels + cells */}
          {Array.from({ length: TOTAL_SLOTS }, (_, slotIndex) => {
            const isHourStart = slotIndex % 2 === 0
            return [
              // Time label
              <div
                key={`label-${slotIndex}`}
                className="avail-time-label"
                style={{ gridColumn: 1, gridRow: slotIndex + 2 }}
              >
                {getTimeLabel(slotIndex)}
              </div>,
              // One cell per day
              ...DAYS.map((day, dayIndex) => {
                const key = slotKey(day, slotIndex)
                const isActive = cells.has(key)
                return (
                  <div
                    key={key}
                    className={`avail-cell${isHourStart ? ' hour-start' : ''}${isActive ? ' active' : ''}`}
                    style={{
                      gridColumn: dayIndex + 2,
                      gridRow: slotIndex + 2,
                      background: isActive ? activeColor : undefined,
                      borderLeft: isActive ? `2px solid ${activeBorder}` : undefined,
                    }}
                    onMouseDown={() => handleCellMouseDown(day, slotIndex)}
                    onMouseEnter={() => handleCellMouseEnter(day, slotIndex)}
                  />
                )
              }),
            ]
          })}
        </div>
      </div>
    </div>
  )
}
