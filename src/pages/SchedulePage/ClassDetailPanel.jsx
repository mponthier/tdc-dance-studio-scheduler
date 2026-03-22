import { formatTime, addMinutes } from '../../utils/timeHelpers'

export default function ClassDetailPanel({ cls, teacher, room, students, onClose }) {
  const enrolled = students.filter((s) => cls.enrolledStudentIds.includes(s.id))
  const endTime = cls.startTime ? addMinutes(cls.startTime, cls.durationMinutes) : null

  return (
    <div className="detail-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="detail-panel">
        <div className="detail-header">
          <div>
            <h2>{cls.name}</h2>
            {cls.style && <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>{cls.style}</span>}
          </div>
          <button className="detail-close" onClick={onClose} aria-label="Close">×</button>
        </div>
        <div className="detail-body">
          <div className="detail-row">
            <span className="detail-label">Day</span>
            <span className="detail-value">{cls.dayOfWeek || <em style={{ color: 'var(--color-text-muted)' }}>Unscheduled</em>}</span>
          </div>
          <div className="detail-row">
            <span className="detail-label">Time</span>
            <span className="detail-value">
              {cls.startTime && endTime
                ? `${formatTime(cls.startTime)} – ${formatTime(endTime)}`
                : <em style={{ color: 'var(--color-text-muted)' }}>Unscheduled</em>}
            </span>
          </div>
          <div className="detail-row">
            <span className="detail-label">Duration</span>
            <span className="detail-value">{cls.durationMinutes} min</span>
          </div>
          <div className="detail-row">
            <span className="detail-label">Teacher</span>
            <span className="detail-value">{teacher?.name || <em style={{ color: 'var(--color-text-muted)' }}>Unassigned</em>}</span>
          </div>
          <div className="detail-row">
            <span className="detail-label">Room</span>
            <span className="detail-value">
              {room ? `${room.name} (cap. ${room.capacity})` : <em style={{ color: 'var(--color-text-muted)' }}>Unassigned</em>}
            </span>
          </div>
          <div className="detail-row">
            <span className="detail-label" style={{ paddingTop: '6px' }}>Students</span>
            <div className="detail-value" style={{ flex: 1 }}>
              {enrolled.length === 0 ? (
                <em style={{ color: 'var(--color-text-muted)', fontSize: '13px' }}>None enrolled</em>
              ) : (
                <ul className="student-list">
                  {enrolled.map((s) => (
                    <li key={s.id}>{s.name} <span style={{ color: 'var(--color-text-muted)', fontSize: '11px' }}>({s.skillLevel})</span></li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
