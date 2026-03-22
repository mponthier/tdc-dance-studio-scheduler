import { useState, useEffect } from 'react'
import Modal from '../../components/Modal'
import ConfirmDialog from '../../components/ConfirmDialog'
import StudentForm from './StudentForm'

const SKILL_BADGE = {
  'Beg/Int (6-10)': 'badge-skill-1',
  'Beg/Int (10+)':  'badge-skill-2',
  'Int/Adv (6-10)': 'badge-skill-3',
  'Int/Adv (10+)':  'badge-skill-4',
}

const SKILL_LEVELS = Object.keys(SKILL_BADGE)

export default function StudentsPage({ students, studentCrud }) {
  const [modal, setModal] = useState(null)
  const [confirmId, setConfirmId] = useState(null)
  const [sortKey, setSortKey] = useState('name')
  const [sortDir, setSortDir] = useState('asc')
  const [filterSkills, setFilterSkills] = useState(new Set())
  const [dropOpen, setDropOpen] = useState(false)

  useEffect(() => {
    if (!dropOpen) return
    function close() { setDropOpen(false) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [dropOpen])

  function handleSave(data) {
    if (modal === 'add') {
      studentCrud.add(data)
    } else {
      studentCrud.update({ ...modal, ...data })
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
  const filtered = filterSkills.size > 0 ? students.filter((s) => filterSkills.has(s.skillLevel)) : students
  const sorted = [...filtered].sort((a, b) => {
    let av, bv
    if (sortKey === 'name') { av = a.name.toLowerCase(); bv = b.name.toLowerCase() }
    else if (sortKey === 'age') { av = a.age || 0; bv = b.age || 0 }
    else if (sortKey === 'skillLevel') {
      av = SKILL_LEVELS.indexOf(a.skillLevel)
      bv = SKILL_LEVELS.indexOf(b.skillLevel)
    }
    return av < bv ? -mul : av > bv ? mul : 0
  })

  return (
    <div>
      <div className="page-header">
        <h1>Students</h1>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div className="filter-dropdown-wrap">
            <button
              type="button"
              className={`schedule-filter-btn${filterSkills.size > 0 ? ' active' : ''}`}
              onClick={() => setDropOpen((o) => !o)}
            >
              {filterSkills.size === 0
                ? 'All skill levels'
                : filterSkills.size === 1
                  ? [...filterSkills][0]
                  : `${filterSkills.size} skill levels`}
              <span className="filter-caret">▾</span>
            </button>
            {dropOpen && (
              <div className="filter-dropdown" onMouseDown={(e) => e.stopPropagation()}>
                {filterSkills.size > 0 && (
                  <button type="button" className="filter-dropdown-clear" onClick={() => setFilterSkills(new Set())}>
                    Clear selection
                  </button>
                )}
                {SKILL_LEVELS.map((l) => (
                  <label key={l} className="filter-dropdown-item">
                    <input
                      type="checkbox"
                      checked={filterSkills.has(l)}
                      onChange={(e) => setFilterSkills((prev) => {
                        const next = new Set(prev)
                        e.target.checked ? next.add(l) : next.delete(l)
                        return next
                      })}
                    />
                    {l}
                  </label>
                ))}
              </div>
            )}
          </div>
          <button className="btn btn-primary" onClick={() => setModal('add')}>
            + Add Student
          </button>
        </div>
      </div>

      <div className="card" style={{ padding: 0 }}>
        {students.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">👤</div>
            <p>No students yet. Add your first student to get started.</p>
            <button className="btn btn-primary" onClick={() => setModal('add')}>+ Add Student</button>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <SortTh col="name">Name</SortTh>
                <SortTh col="age">Age</SortTh>
                <SortTh col="skillLevel">Skill Level</SortTh>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((s) => (
                <tr key={s.id}>
                  <td>{s.name}</td>
                  <td>{s.age || '—'}</td>
                  <td>
                    <span className={`badge ${SKILL_BADGE[s.skillLevel]}`}>{s.skillLevel}</span>
                  </td>
                  <td>
                    <div className="table-actions">
                      <button className="btn btn-ghost btn-sm" onClick={() => setModal(s)}>Edit</button>
                      <button className="btn btn-danger btn-sm" onClick={() => setConfirmId(s.id)}>Delete</button>
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
          title={modal === 'add' ? 'Add Student' : 'Edit Student'}
          onClose={() => setModal(null)}
        >
          <StudentForm
            initial={modal === 'add' ? null : modal}
            onSave={handleSave}
            onClose={() => setModal(null)}
          />
        </Modal>
      )}

      {confirmId && (
        <ConfirmDialog
          message="Delete this student? They will also be unenrolled from all classes."
          onConfirm={() => { studentCrud.remove(confirmId); setConfirmId(null) }}
          onCancel={() => setConfirmId(null)}
        />
      )}
    </div>
  )
}
