import { useState, useEffect } from 'react'
import { DAYS } from '../../utils/timeHelpers'

const STYLES = ['Ballet', 'Contemporary', 'Hip Hop', 'Jazz', 'Lyrical', 'Musical Theater', 'Pointe', 'Tap', 'Drill', 'All-Star']
import { detectConflicts } from '../../utils/conflicts'
import { detectAvailabilityWarnings } from '../../utils/availability'

const DEFAULTS = {
  name: '',
  style: '',
  teacherId: '',
  roomId: '',
  dayOfWeek: '',
  startTime: '',
  durationMinutes: '60',
}

export default function ClassForm({ initial, teachers, rooms, allClasses, onSave, onClose }) {
  const [form, setForm] = useState(
    initial
      ? { ...initial, durationMinutes: String(initial.durationMinutes) }
      : DEFAULTS,
  )
  const [conflicts, setConflicts] = useState([])
  const [availWarnings, setAvailWarnings] = useState([])

  function set(field, value) {
    setForm((f) => ({ ...f, [field]: value }))
  }

  useEffect(() => {
    if (!form.dayOfWeek || !form.startTime || !form.durationMinutes) {
      setConflicts([])
      setAvailWarnings([])
      return
    }
    const candidate = {
      ...form,
      id: initial?.id || '__new__',
      durationMinutes: parseInt(form.durationMinutes, 10) || 0,
    }
    setConflicts(detectConflicts(candidate, allClasses))

    const teacher = teachers.find((t) => t.id === form.teacherId)
    const room = rooms.find((r) => r.id === form.roomId)
    setAvailWarnings(detectAvailabilityWarnings(candidate, teacher, room))
  }, [form.teacherId, form.roomId, form.dayOfWeek, form.startTime, form.durationMinutes])

  function handleSubmit(e) {
    e.preventDefault()
    if (!form.name.trim()) return
    onSave({
      ...form,
      durationMinutes: parseInt(form.durationMinutes, 10) || 60,
      enrolledStudentIds: initial?.enrolledStudentIds || [],
    })
  }

  const allWarnings = [...conflicts, ...availWarnings]

  return (
    <form onSubmit={handleSubmit}>
      <div className="modal-body">
        {allWarnings.length > 0 && (
          <div>
            {allWarnings.map((w, i) => (
              <div key={i} className="alert alert-warning">
                ⚠️ {w.message}
              </div>
            ))}
          </div>
        )}

        <div className="form-row">
          <div className="form-group">
            <label>Class Name *</label>
            <input
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              placeholder="e.g. Ballet Basics"
              required
              autoFocus
            />
          </div>
          <div className="form-group">
            <label>Genre</label>
            <select
              value={form.style}
              onChange={(e) => {
                const newStyle = e.target.value
                setForm((f) => {
                  if (!f.teacherId) return { ...f, style: newStyle }
                  const teacher = teachers.find((t) => t.id === f.teacherId)
                  const specs = Array.isArray(teacher?.specialty) ? teacher.specialty : (teacher?.specialty ? [teacher.specialty] : [])
                  const stillValid = specs.length === 0 || specs.some((s) => s.toLowerCase() === newStyle.toLowerCase())
                  return { ...f, style: newStyle, teacherId: stillValid ? f.teacherId : '' }
                })
              }}
            >
              <option value="">— Select genre —</option>
              {STYLES.map((s) => <option key={s}>{s}</option>)}
            </select>
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>Teacher</label>
            <select value={form.teacherId} onChange={(e) => set('teacherId', e.target.value)}>
              <option value="">— Select teacher —</option>
              {teachers
                .filter((t) => {
                  if (!form.style) return true
                  const specs = Array.isArray(t.specialty) ? t.specialty : (t.specialty ? [t.specialty] : [])
                  if (specs.length === 0) return true
                  return specs.some((s) => s.toLowerCase() === form.style.toLowerCase())
                })
                .map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
            </select>
          </div>
          <div className="form-group">
            <label>Room</label>
            <select value={form.roomId} onChange={(e) => set('roomId', e.target.value)}>
              <option value="">— Select room —</option>
              {rooms.map((r) => (
                <option key={r.id} value={r.id}>{r.name} (cap. {r.capacity})</option>
              ))}
            </select>
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>Day of Week</label>
            <select value={form.dayOfWeek} onChange={(e) => set('dayOfWeek', e.target.value)}>
              <option value="">— Select day —</option>
              {DAYS.map((d) => <option key={d}>{d}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Start Time</label>
            <input
              type="time"
              value={form.startTime}
              onChange={(e) => set('startTime', e.target.value)}
            />
          </div>
        </div>

        <div className="form-group">
          <label>Duration (minutes)</label>
          <input
            type="number"
            value={form.durationMinutes}
            onChange={(e) => set('durationMinutes', e.target.value)}
            min="15"
            max="480"
            step="15"
          />
        </div>
      </div>
      <div className="modal-footer">
        <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
        <button type="submit" className="btn btn-primary">
          {initial ? 'Save Changes' : 'Add Class'}
        </button>
      </div>
    </form>
  )
}
