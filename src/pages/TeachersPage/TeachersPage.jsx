import { useState, useRef } from 'react'
import Modal from '../../components/Modal'
import ConfirmDialog from '../../components/ConfirmDialog'
import TeacherForm from './TeacherForm'
import { exportTeachersToFile, importTeachersFromFile } from '../../services/storage'

export default function TeachersPage({ teachers, teacherCrud, classes }) {
  const [modal, setModal] = useState(null)
  const [confirmId, setConfirmId] = useState(null)
  const [confirmClear, setConfirmClear] = useState(false)
  const [sortKey, setSortKey] = useState('name')
  const [sortDir, setSortDir] = useState('asc')
  const fileInputRef = useRef(null)

  function handleLoadTeachers(file) {
    if (!file) return
    if (!window.confirm('Replace all teacher data with the contents of this file?')) return
    importTeachersFromFile(file)
      .then((records) => teacherCrud.loadAll(records))
      .catch((err) => alert(`Import failed: ${err.message}`))
  }

  function handleSave(data) {
    if (modal === 'add') {
      teacherCrud.add(data)
    } else {
      teacherCrud.update({ ...modal, ...data })
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

  const classCountMap = {}
  ;(classes || []).forEach((c) => { if (c.teacherId) classCountMap[c.teacherId] = (classCountMap[c.teacherId] || 0) + 1 })

  const mul = sortDir === 'asc' ? 1 : -1
  const sorted = [...teachers].sort((a, b) => {
    let av, bv
    if (sortKey === 'name')      { av = a.name.toLowerCase();  bv = b.name.toLowerCase() }
    else if (sortKey === 'genre') {
      av = (Array.isArray(a.genre) ? a.genre.join(', ') : (a.genre || '')).toLowerCase()
      bv = (Array.isArray(b.genre) ? b.genre.join(', ') : (b.genre || '')).toLowerCase()
    }
    else if (sortKey === 'phone') { av = a.phone || ''; bv = b.phone || '' }
    else if (sortKey === 'email') { av = a.email || ''; bv = b.email || '' }
    else if (sortKey === 'specialties') {
      av = (Array.isArray(a.specialties) ? a.specialties.join(', ') : '').toLowerCase()
      bv = (Array.isArray(b.specialties) ? b.specialties.join(', ') : '').toLowerCase()
    }
    else if (sortKey === 'classCount') { av = classCountMap[a.id] || 0; bv = classCountMap[b.id] || 0 }
    return av < bv ? -mul : av > bv ? mul : 0
  })

  return (
    <div>
      <div className="page-header">
        <h1>Teachers</h1>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn btn-ghost" onClick={exportTeachersToFile}>Save Teachers</button>
          <button className="btn btn-ghost" onClick={() => fileInputRef.current.click()}>Load Teachers</button>
          <button className="btn btn-danger" onClick={() => setConfirmClear(true)}>Clear Teachers</button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            style={{ display: 'none' }}
            onChange={(e) => { handleLoadTeachers(e.target.files[0]); e.target.value = '' }}
          />
          <button className="btn btn-primary" onClick={() => setModal('add')}>+ Add Teacher</button>
        </div>
      </div>

      <div className="card" style={{ padding: 0 }}>
        {teachers.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">🎤</div>
            <p>No teachers yet. Add a teacher to assign them to classes.</p>
            <button className="btn btn-primary" onClick={() => setModal('add')}>+ Add Teacher</button>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <SortTh col="name">Name</SortTh>
                <SortTh col="genre">Genre</SortTh>
                <SortTh col="specialties">Specialty</SortTh>
                <SortTh col="phone">Phone</SortTh>
                <SortTh col="email">Email</SortTh>
                <SortTh col="classCount">Classes</SortTh>
                <th>Availability</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((t) => (
                <tr key={t.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span
                        style={{
                          display: 'inline-block',
                          width: 12,
                          height: 12,
                          borderRadius: '50%',
                          background: t.color || '#6c5ce7',
                          flexShrink: 0,
                          border: '1px solid rgba(0,0,0,0.15)',
                        }}
                      />
                      {t.name}
                    </div>
                  </td>
                  <td>{Array.isArray(t.genre) ? ([...t.genre].sort().join(', ') || '—') : (t.genre || '—')}</td>
                  <td>{Array.isArray(t.specialties) && t.specialties.length > 0 ? [...t.specialties].sort().join(', ') : '—'}</td>
                  <td>{t.phone || '—'}</td>
                  <td>{t.email || '—'}</td>
                  <td>{classCountMap[t.id] || 0}</td>
                  <td style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
                    {!t.availability || t.availability.length === 0
                      ? 'Any time'
                      : `${t.availability.length} slot${t.availability.length !== 1 ? 's' : ''}`}
                  </td>
                  <td>
                    <div className="table-actions">
                      <button className="btn btn-ghost btn-sm" onClick={() => setModal(t)}>Edit</button>
                      <button className="btn btn-danger btn-sm" onClick={() => setConfirmId(t.id)}>Delete</button>
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
          title={modal === 'add' ? 'Add Teacher' : 'Edit Teacher'}
          onClose={() => setModal(null)}
          size="lg"
        >
          <TeacherForm
            initial={modal === 'add' ? null : modal}
            teachers={teachers}
            onSave={handleSave}
            onClose={() => setModal(null)}
          />
        </Modal>
      )}

      {confirmId && (
        <ConfirmDialog
          message="Delete this teacher? Classes assigned to them will show as unassigned."
          onConfirm={() => { teacherCrud.remove(confirmId); setConfirmId(null) }}
          onCancel={() => setConfirmId(null)}
        />
      )}

      {confirmClear && (
        <ConfirmDialog
          title="Clear All Teachers"
          message="Delete all teachers? Classes assigned to them will show as unassigned."
          confirmLabel="Clear"
          onConfirm={() => { teacherCrud.clearAll(); setConfirmClear(false) }}
          onCancel={() => setConfirmClear(false)}
        />
      )}
    </div>
  )
}
