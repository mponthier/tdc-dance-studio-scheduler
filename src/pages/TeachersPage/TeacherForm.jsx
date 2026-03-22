import { useState } from 'react'
import AvailabilityEditor from '../../components/AvailabilityEditor'

const SPECIALTIES = ['All-Star', 'Ballet', 'Contemporary', 'Drill', 'Hip Hop', 'Jazz', 'Lyrical', 'Musical Theater', 'Pointe', 'Tap']

const PRESET_COLORS = [
  '#6c5ce7', '#0984e3', '#00b894', '#e17055', '#fd79a8',
  '#fdcb6e', '#00cec9', '#e84393', '#a29bfe', '#55efc4',
  '#d63031', '#e67e22', '#2d3436', '#74b9ff', '#b2bec3',
]

const DEFAULTS = { name: '', specialty: [], phone: '', email: '', color: '#6c5ce7', availability: [] }

export default function TeacherForm({ initial, teachers = [], onSave, onClose }) {
  const [form, setForm] = useState(
    initial
      ? {
          ...initial,
          color: initial.color || '#6c5ce7',
          availability: initial.availability || [],
          specialty: Array.isArray(initial.specialty)
            ? initial.specialty
            : initial.specialty ? [initial.specialty] : [],
        }
      : DEFAULTS,
  )

  function set(field, value) {
    setForm((f) => ({ ...f, [field]: value }))
  }

  const takenColors = new Set(
    teachers.filter((t) => t.id !== initial?.id).map((t) => t.color?.toLowerCase())
  )
  const colorTaken = takenColors.has(form.color?.toLowerCase())

  function handleSubmit(e) {
    e.preventDefault()
    if (!form.name.trim()) return
    if (colorTaken) return
    onSave(form)
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="modal-body">
        <div className="form-group">
          <label>Name *</label>
          <input
            value={form.name}
            onChange={(e) => set('name', e.target.value)}
            placeholder="Teacher name"
            required
            autoFocus
          />
        </div>
        <div className="form-group">
          <label>Genre</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 16px', marginTop: 4 }}>
            {SPECIALTIES.map((s) => (
              <label key={s} style={{ display: 'flex', alignItems: 'center', gap: 5, fontWeight: 'normal', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                <input
                  type="checkbox"
                  checked={form.specialty.includes(s)}
                  onChange={(e) =>
                    set('specialty', e.target.checked
                      ? [...form.specialty, s]
                      : form.specialty.filter((x) => x !== s))
                  }
                />
                {s}
              </label>
            ))}
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label>Phone</label>
            <input
              value={form.phone}
              onChange={(e) => {
                const digits = e.target.value.replace(/\D/g, '').slice(0, 10)
                let formatted = digits
                if (digits.length > 6) formatted = `${digits.slice(0,3)}-${digits.slice(3,6)}-${digits.slice(6)}`
                else if (digits.length > 3) formatted = `${digits.slice(0,3)}-${digits.slice(3)}`
                set('phone', formatted)
              }}
              placeholder="555-867-5309"
              type="tel"
            />
          </div>
          <div className="form-group">
            <label>Email</label>
            <input
              value={form.email}
              onChange={(e) => set('email', e.target.value)}
              placeholder="teacher@studio.com"
              type="email"
            />
          </div>
        </div>

        <div className="form-group">
          <label>Schedule Color</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <input
              type="color"
              value={form.color}
              onChange={(e) => set('color', e.target.value)}
              style={{ width: 36, height: 36, padding: 2, border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', background: 'none' }}
            />
            <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
              {PRESET_COLORS.map((c) => {
                const taken = takenColors.has(c.toLowerCase())
                return (
                  <button
                    key={c}
                    type="button"
                    title={taken ? `${c} (already in use)` : c}
                    onClick={() => { if (!taken) set('color', c) }}
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: '50%',
                      background: taken ? '#ccc' : c,
                      border: form.color === c ? '2px solid var(--color-text)' : '2px solid transparent',
                      cursor: taken ? 'not-allowed' : 'pointer',
                      padding: 0,
                      outline: 'none',
                      opacity: taken ? 0.4 : 1,
                    }}
                  />
                )
              })}
            </div>
          </div>
          {colorTaken && (
            <p style={{ marginTop: 6, fontSize: 12, color: 'var(--color-danger, #d63031)' }}>
              This color is already assigned to another teacher. Please choose a different color.
            </p>
          )}
        </div>

        <div className="form-group" style={{ marginBottom: 0 }}>
          <AvailabilityEditor
            value={form.availability}
            onChange={(v) => set('availability', v)}
            color={form.color}
          />
        </div>
      </div>
      <div className="modal-footer">
        <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
        <button type="submit" className="btn btn-primary">
          {initial ? 'Save Changes' : 'Add Teacher'}
        </button>
      </div>
    </form>
  )
}
