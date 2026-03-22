import { useState } from 'react'
import Modal from '../../components/Modal'
import ConfirmDialog from '../../components/ConfirmDialog'
import RoomForm from './RoomForm'

export default function RoomsPage({ rooms, roomCrud }) {
  const [modal, setModal] = useState(null)
  const [confirmId, setConfirmId] = useState(null)
  const [sortKey, setSortKey] = useState('name')
  const [sortDir, setSortDir] = useState('asc')

  function handleSave(data) {
    if (modal === 'add') {
      roomCrud.add(data)
    } else {
      roomCrud.update({ ...modal, ...data })
    }
    setModal(null)
  }

  function handleSort(key) {
    if (sortKey === key) setSortDir((d) => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
  }

  function SortTh({ col, children }) {
    const active = sortKey === col
    return (
      <th onClick={() => handleSort(col)} style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}>
        {children} {active ? (sortDir === 'asc' ? '▲' : '▼') : <span style={{ opacity: 0.3 }}>▲</span>}
      </th>
    )
  }

  const mul = sortDir === 'asc' ? 1 : -1
  const sorted = [...rooms].sort((a, b) => {
    let av, bv
    if (sortKey === 'name')     { av = a.name.toLowerCase(); bv = b.name.toLowerCase() }
    else if (sortKey === 'capacity') { av = a.capacity || 0; bv = b.capacity || 0 }
    return av < bv ? -mul : av > bv ? mul : 0
  })

  return (
    <div>
      <div className="page-header">
        <h1>Rooms</h1>
        <button className="btn btn-primary" onClick={() => setModal('add')}>
          + Add Room
        </button>
      </div>

      <div className="card" style={{ padding: 0 }}>
        {rooms.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">🏠</div>
            <p>No rooms yet. Add a room to start scheduling classes.</p>
            <button className="btn btn-primary" onClick={() => setModal('add')}>+ Add Room</button>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <SortTh col="name">Room Name</SortTh>
                <SortTh col="capacity">Capacity</SortTh>
                <th>Availability</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((r) => (
                <tr key={r.id}>
                  <td>{r.name}</td>
                  <td>{r.capacity ? `${r.capacity} students` : '—'}</td>
                  <td style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
                    {!r.availability || r.availability.length === 0
                      ? 'Any time'
                      : `${r.availability.length} slot${r.availability.length !== 1 ? 's' : ''}`}
                  </td>
                  <td>
                    <div className="table-actions">
                      <button className="btn btn-ghost btn-sm" onClick={() => setModal(r)}>Edit</button>
                      <button className="btn btn-danger btn-sm" onClick={() => setConfirmId(r.id)}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {modal && (
        <Modal
          title={modal === 'add' ? 'Add Room' : 'Edit Room'}
          onClose={() => setModal(null)}
          size="lg"
        >
          <RoomForm
            initial={modal === 'add' ? null : modal}
            onSave={handleSave}
            onClose={() => setModal(null)}
          />
        </Modal>
      )}

      {confirmId && (
        <ConfirmDialog
          message="Delete this room? Classes assigned to it will show as unassigned."
          onConfirm={() => { roomCrud.remove(confirmId); setConfirmId(null) }}
          onCancel={() => setConfirmId(null)}
        />
      )}
    </div>
  )
}
