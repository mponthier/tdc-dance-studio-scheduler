import { useState } from 'react'

const SKILL_LEVELS = [
  'Beg/Int (6-10)',
  'Beg/Int (10+)',
  'Int/Adv (6-10)',
  'Int/Adv (10+)',
]

const DEFAULTS = { name: '', age: '', skillLevel: SKILL_LEVELS[0] }

export default function StudentForm({ initial, onSave, onClose }) {
  const [form, setForm] = useState(initial ? { ...initial, age: String(initial.age) } : DEFAULTS)

  function set(field, value) {
    setForm((f) => ({ ...f, [field]: value }))
  }

  function handleSubmit(e) {
    e.preventDefault()
    if (!form.name.trim()) return
    onSave({ ...form, age: parseInt(form.age, 10) || 0 })
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="modal-body">
        <div className="form-group">
          <label>Name *</label>
          <input
            value={form.name}
            onChange={(e) => set('name', e.target.value)}
            placeholder="Student name"
            required
            autoFocus
          />
        </div>
        <div className="form-group">
          <label>Age</label>
          <input
            type="number"
            value={form.age}
            onChange={(e) => set('age', e.target.value)}
            placeholder="e.g. 14"
            min="1"
            max="99"
          />
        </div>
        <div className="form-group">
          <label>Skill Level</label>
          <select value={form.skillLevel} onChange={(e) => set('skillLevel', e.target.value)}>
            {SKILL_LEVELS.map((l) => <option key={l}>{l}</option>)}
          </select>
        </div>
      </div>
      <div className="modal-footer">
        <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
        <button type="submit" className="btn btn-primary">
          {initial ? 'Save Changes' : 'Add Student'}
        </button>
      </div>
    </form>
  )
}
