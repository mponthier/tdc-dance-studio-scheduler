import { useState } from 'react'
import AvailabilityEditor from '../../components/AvailabilityEditor'

const DEFAULTS = { name: '', capacity: '', availability: [] }

export default function RoomForm({ initial, onSave, onClose }) {
  const [form, setForm] = useState(
    initial
      ? { ...initial, capacity: String(initial.capacity), availability: initial.availability || [] }
      : DEFAULTS,
  )

  function set(field, value) {
    setForm((f) => ({ ...f, [field]: value }))
  }

  function handleSubmit(e) {
    e.preventDefault()
    if (!form.name.trim()) return
    onSave({ ...form, capacity: parseInt(form.capacity, 10) || 0 })
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="modal-body">
        <div className="form-group">
          <label>Room Name *</label>
          <input
            value={form.name}
            onChange={(e) => set('name', e.target.value)}
            placeholder="e.g. Studio A, Main Hall"
            required
            autoFocus
          />
        </div>
        <div className="form-group">
          <label>Capacity (max students)</label>
          <input
            type="number"
            value={form.capacity}
            onChange={(e) => set('capacity', e.target.value)}
            placeholder="e.g. 20"
            min="1"
            max="999"
          />
        </div>

        <div className="form-group" style={{ marginBottom: 0 }}>
          <AvailabilityEditor
            value={form.availability}
            onChange={(v) => set('availability', v)}
          />
        </div>
      </div>
      <div className="modal-footer">
        <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
        <button type="submit" className="btn btn-primary">
          {initial ? 'Save Changes' : 'Add Room'}
        </button>
      </div>
    </form>
  )
}
