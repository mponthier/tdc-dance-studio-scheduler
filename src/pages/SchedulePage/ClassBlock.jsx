import { formatTime, addMinutes } from '../../utils/timeHelpers'

// Fallback palette when teacher has no color assigned (keyed by dance style)
const STYLE_COLORS = {
  Ballet:       { bg: '#e8d5f7', text: '#6c2d9e' },
  'Hip-Hop':    { bg: '#d5e8f7', text: '#1a6fa3' },
  Jazz:         { bg: '#fce8c4', text: '#a05e00' },
  Contemporary: { bg: '#d5f7e8', text: '#1a7a52' },
  Tap:          { bg: '#f7d5e8', text: '#9e2d6c' },
  Ballroom:     { bg: '#f7eed5', text: '#8a6500' },
  Salsa:        { bg: '#ffd5d5', text: '#a03030' },
  Swing:        { bg: '#d5f7f7', text: '#1a7a7a' },
}

// Colors keyed by skill level
const SKILL_COLORS = {
  'Beg/Int (6-10)': '#e67e22',
  'Beg/Int (10+)':  '#2980b9',
  'Int/Adv (6-10)': '#27ae60',
  'Int/Adv (10+)':  '#8e44ad',
}

/** Derive a readable text color (dark or white) from a hex background. */
function getTextColor(hex) {
  if (!hex || hex.length < 7) return '#2d3436'
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance > 0.55 ? '#2d3436' : '#ffffff'
}

/** Lighten a hex color by mixing it toward white. ratio 0=original, 1=white. */
function lightenHex(hex, ratio = 0.72) {
  if (!hex || hex.length < 7) return '#e2e4f0'
  const r = Math.round(parseInt(hex.slice(1, 3), 16) + (255 - parseInt(hex.slice(1, 3), 16)) * ratio)
  const g = Math.round(parseInt(hex.slice(3, 5), 16) + (255 - parseInt(hex.slice(3, 5), 16)) * ratio)
  const b = Math.round(parseInt(hex.slice(5, 7), 16) + (255 - parseInt(hex.slice(5, 7), 16)) * ratio)
  return `rgb(${r},${g},${b})`
}

function getColors(teacher, style, skillLevel, colorMode) {
  if (colorMode === 'skillLevel') {
    const hex = SKILL_COLORS[skillLevel]
    if (hex) return { bg: lightenHex(hex, 0.72), border: hex }
    return { bg: '#e2e4f0', border: '#888' }
  }
  if (teacher?.color) {
    return { bg: lightenHex(teacher.color, 0.72), border: teacher.color }
  }
  return STYLE_COLORS[style] || { bg: '#e2e4f0', border: '#4a4f6a' }
}

export default function ClassBlock({ cls, teacher, room, hasConflict, colorMode = 'teacher', style: gridStyle, onClick, onContextMenu, onDragStart, onDragEnd }) {
  const colors = getColors(teacher, cls.style, cls.skillLevel, colorMode)
  const isPriority = cls.style && Array.isArray(teacher?.specialties) &&
    teacher.specialties.some((g) => g.toLowerCase() === cls.style.toLowerCase())

  function handleDragStart(e) {
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', cls.id)
    onDragStart?.(cls.id)
  }

  return (
    <div
      draggable
      className={`class-block${hasConflict ? ' has-conflict' : ''}`}
      style={{
        ...gridStyle,
        background: colors.bg,
        color: colors.text || colors.border,
        borderLeft: hasConflict ? `3px solid var(--color-danger)` : `3px solid ${colors.border}`,
        pointerEvents: 'auto',
        cursor: 'grab',
      }}
      onClick={onClick}
      onContextMenu={(e) => { e.preventDefault(); onContextMenu?.(e, cls) }}
      onDragStart={handleDragStart}
      onDragEnd={() => onDragEnd?.()}
      title={[cls.name, teacher?.name, cls.skillLevel, cls.startTime ? `${formatTime(cls.startTime)}–${formatTime(addMinutes(cls.startTime, cls.durationMinutes))}` : null].filter(Boolean).join('\n')}
    >
      <div className="class-block-name">{cls.name}</div>
      {teacher && <div className="class-block-meta" style={isPriority ? { fontWeight: 'bold' } : undefined}>{teacher.name}</div>}
      {cls.skillLevel && <div className="class-block-meta">{cls.skillLevel}</div>}
      {cls.startTime && (
        <div className="class-block-meta">
          {formatTime(cls.startTime)}–{formatTime(addMinutes(cls.startTime, cls.durationMinutes))}
        </div>
      )}
    </div>
  )
}
