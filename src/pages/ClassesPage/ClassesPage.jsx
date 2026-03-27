import { useState, useEffect, useRef } from 'react'
import Modal from '../../components/Modal'
import ConfirmDialog from '../../components/ConfirmDialog'
import ClassForm from './ClassForm'
import EnrollmentPanel from './EnrollmentPanel'
import { findAllConflictingIds } from '../../utils/conflicts'
import { formatTime, addMinutes, DAYS } from '../../utils/timeHelpers'
import { exportClassesToFile, importClassesFromFile } from '../../services/storage'

const DAY_ORDER = Object.fromEntries(DAYS.map((d, i) => [d, i]))
const SKILL_BADGE = {
  'Beg/Int (6-10)': 'badge-skill-1',
  'Beg/Int (10+)':  'badge-skill-2',
  'Int/Adv (6-10)': 'badge-skill-3',
  'Int/Adv (10+)':  'badge-skill-4',
}
const SKILL_LEVELS = Object.keys(SKILL_BADGE)
const UNASSIGNED = '__unassigned__'

function sortClasses(classes, key, dir, teachers, rooms) {
  const mul = dir === 'asc' ? 1 : -1
  return [...classes].sort((a, b) => {
    let av, bv
    if (key === 'name') {
      av = a.name.toLowerCase(); bv = b.name.toLowerCase()
    } else if (key === 'schedule') {
      av = (DAY_ORDER[a.dayOfWeek] ?? 99) * 10000 + (a.startTime ? parseInt(a.startTime.replace(':', ''), 10) : 9999)
      bv = (DAY_ORDER[b.dayOfWeek] ?? 99) * 10000 + (b.startTime ? parseInt(b.startTime.replace(':', ''), 10) : 9999)
    } else if (key === 'teacher') {
      av = (teachers.find((t) => t.id === a.teacherId)?.name || '').toLowerCase()
      bv = (teachers.find((t) => t.id === b.teacherId)?.name || '').toLowerCase()
    } else if (key === 'room') {
      av = (rooms.find((r) => r.id === a.roomId)?.name || '').toLowerCase()
      bv = (rooms.find((r) => r.id === b.roomId)?.name || '').toLowerCase()
    } else if (key === 'skillLevel') {
      av = (a.skillLevel || '').toLowerCase(); bv = (b.skillLevel || '').toLowerCase()
    } else if (key === 'duration') {
      av = a.durationMinutes; bv = b.durationMinutes
    } else if (key === 'students') {
      av = a.enrolledStudentIds.length; bv = b.enrolledStudentIds.length
    }
    return av < bv ? -mul : av > bv ? mul : 0
  })
}

export default function ClassesPage({ classes, teachers, rooms, students, classCrud }) {
  const [modal, setModal] = useState(null)
  const [enrollClass, setEnrollClass] = useState(null)
  const [confirmId, setConfirmId] = useState(null)
  const [confirmClear, setConfirmClear] = useState(false)
  const [sortKey, setSortKey] = useState('name')
  const [sortDir, setSortDir] = useState('asc')
  const [filterTeacherIds, setFilterTeacherIds] = useState(new Set())
  const [filterSkillLevels, setFilterSkillLevels] = useState(new Set())
  const [filterDurations, setFilterDurations] = useState(new Set())
  const [dropOpen, setDropOpen] = useState(false)
  const [skillDropOpen, setSkillDropOpen] = useState(false)
  const [durationDropOpen, setDurationDropOpen] = useState(false)
  const fileInputRef = useRef(null)

  function handleLoadClasses(file) {
    if (!file) return
    if (!window.confirm('Replace all class data with the contents of this file?')) return
    importClassesFromFile(file)
      .then((records) => classCrud.loadAll(records))
      .catch((err) => alert(`Import failed: ${err.message}`))
  }

  useEffect(() => {
    if (!dropOpen && !skillDropOpen && !durationDropOpen) return
    function close() { setDropOpen(false); setSkillDropOpen(false); setDurationDropOpen(false) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [dropOpen, skillDropOpen, durationDropOpen])

  const conflictIds = findAllConflictingIds(classes)

  function handleSave(data) {
    if (modal === 'add') {
      classCrud.add(data)
    } else {
      classCrud.update({ ...modal, ...data })
    }
    setModal(null)
  }

  function getTeacher(id) {
    return teachers.find((t) => t.id === id)?.name || '—'
  }
  function getRoom(id) {
    return rooms.find((r) => r.id === id)?.name || '—'
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

  const allDurations = [...new Set(classes.map((c) => c.durationMinutes))].sort((a, b) => a - b)

  const filtered = classes.filter((c) => {
    if (filterTeacherIds.size > 0) {
      if (!c.teacherId && filterTeacherIds.has(UNASSIGNED)) { /* pass */ }
      else if (!filterTeacherIds.has(c.teacherId)) return false
    }
    if (filterSkillLevels.size > 0 && !filterSkillLevels.has(c.skillLevel || '')) return false
    if (filterDurations.size > 0 && !filterDurations.has(c.durationMinutes)) return false
    return true
  })
  const sorted = sortClasses(filtered, sortKey, sortDir, teachers, rooms)

  return (
    <div>
      <div className="page-header">
        <h1>Classes</h1>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div className="filter-dropdown-wrap">
            <button
              type="button"
              className={`schedule-filter-btn${filterSkillLevels.size > 0 ? ' active' : ''}`}
              onClick={() => { setSkillDropOpen((o) => !o); setDropOpen(false); setDurationDropOpen(false) }}
            >
              {filterSkillLevels.size === 0
                ? 'All skill levels'
                : filterSkillLevels.size === 1
                  ? [...filterSkillLevels][0]
                  : `${filterSkillLevels.size} skill levels`}
              <span className="filter-caret">▾</span>
            </button>
            {skillDropOpen && (
              <div className="filter-dropdown" onMouseDown={(e) => e.stopPropagation()}>
                {filterSkillLevels.size > 0 && (
                  <button type="button" className="filter-dropdown-clear" onClick={() => setFilterSkillLevels(new Set())}>
                    Clear selection
                  </button>
                )}
                {SKILL_LEVELS.map((s) => (
                  <label key={s} className="filter-dropdown-item">
                    <input
                      type="checkbox"
                      checked={filterSkillLevels.has(s)}
                      onChange={(e) => setFilterSkillLevels((prev) => {
                        const next = new Set(prev)
                        e.target.checked ? next.add(s) : next.delete(s)
                        return next
                      })}
                    />
                    {s}
                  </label>
                ))}
              </div>
            )}
          </div>
          <div className="filter-dropdown-wrap">
            <button
              type="button"
              className={`schedule-filter-btn${filterDurations.size > 0 ? ' active' : ''}`}
              onClick={() => { setDurationDropOpen((o) => !o); setDropOpen(false); setSkillDropOpen(false) }}
            >
              {filterDurations.size === 0
                ? 'All durations'
                : filterDurations.size === 1
                  ? `${[...filterDurations][0]} min`
                  : `${filterDurations.size} durations`}
              <span className="filter-caret">▾</span>
            </button>
            {durationDropOpen && (
              <div className="filter-dropdown" onMouseDown={(e) => e.stopPropagation()}>
                {filterDurations.size > 0 && (
                  <button type="button" className="filter-dropdown-clear" onClick={() => setFilterDurations(new Set())}>
                    Clear selection
                  </button>
                )}
                {allDurations.map((m) => (
                  <label key={m} className="filter-dropdown-item">
                    <input
                      type="checkbox"
                      checked={filterDurations.has(m)}
                      onChange={(e) => setFilterDurations((prev) => {
                        const next = new Set(prev)
                        e.target.checked ? next.add(m) : next.delete(m)
                        return next
                      })}
                    />
                    {m} min
                  </label>
                ))}
              </div>
            )}
          </div>
          <div className="filter-dropdown-wrap">
            <button
              type="button"
              className={`schedule-filter-btn${filterTeacherIds.size > 0 ? ' active' : ''}`}
              onClick={() => { setDropOpen((o) => !o); setSkillDropOpen(false); setDurationDropOpen(false) }}
            >
              {filterTeacherIds.size === 0
                ? 'All teachers'
                : filterTeacherIds.size === 1
                  ? filterTeacherIds.has(UNASSIGNED)
                    ? 'Unassigned'
                    : (teachers.find((t) => filterTeacherIds.has(t.id))?.name ?? 'Teacher')
                  : `${filterTeacherIds.size} selected`}
              <span className="filter-caret">▾</span>
            </button>
            {dropOpen && (
              <div className="filter-dropdown" onMouseDown={(e) => e.stopPropagation()}>
                {filterTeacherIds.size > 0 && (
                  <button type="button" className="filter-dropdown-clear" onClick={() => setFilterTeacherIds(new Set())}>
                    Clear selection
                  </button>
                )}
                <label className="filter-dropdown-item">
                  <input
                    type="checkbox"
                    checked={filterTeacherIds.has(UNASSIGNED)}
                    onChange={(e) => setFilterTeacherIds((prev) => {
                      const next = new Set(prev)
                      e.target.checked ? next.add(UNASSIGNED) : next.delete(UNASSIGNED)
                      return next
                    })}
                  />
                  <span className="filter-color-dot" style={{ background: '#ccc' }} />
                  Unassigned
                </label>
                <div style={{ borderTop: '1px solid var(--color-border)', margin: '4px 0' }} />
                {teachers.map((t) => (
                  <label key={t.id} className="filter-dropdown-item">
                    <input
                      type="checkbox"
                      checked={filterTeacherIds.has(t.id)}
                      onChange={(e) => setFilterTeacherIds((prev) => {
                        const next = new Set(prev)
                        e.target.checked ? next.add(t.id) : next.delete(t.id)
                        return next
                      })}
                    />
                    <span className="filter-color-dot" style={{ background: t.color || '#888' }} />
                    {t.name}
                  </label>
                ))}
              </div>
            )}
          </div>
          <button className="btn btn-ghost" onClick={exportClassesToFile}>Save Classes</button>
          <button className="btn btn-ghost" onClick={() => fileInputRef.current.click()}>Load Classes</button>
          <button className="btn btn-danger" onClick={() => setConfirmClear(true)}>Clear Classes</button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            style={{ display: 'none' }}
            onChange={(e) => { handleLoadClasses(e.target.files[0]); e.target.value = '' }}
          />
          <button className="btn btn-primary" onClick={() => setModal('add')}>
            + Add Class
          </button>
        </div>
      </div>

      <div className="card" style={{ padding: 0 }}>
        {classes.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">🎓</div>
            <p>No classes yet. Create a class and assign a teacher and room.</p>
            <button className="btn btn-primary" onClick={() => setModal('add')}>+ Add Class</button>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <SortTh col="name">Class</SortTh>
                <SortTh col="skillLevel">Skill Level</SortTh>
                <SortTh col="teacher">Teacher</SortTh>
                <SortTh col="schedule">Day & Time</SortTh>
                <SortTh col="room">Room</SortTh>
                <SortTh col="duration">Duration</SortTh>
                <SortTh col="students">Students</SortTh>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((c) => {
                const room = rooms.find((r) => r.id === c.roomId)
                const capacity = room?.capacity
                const enrolled = c.enrolledStudentIds.length
                const atCapacity = capacity && enrolled >= capacity
                const hasConflict = conflictIds.has(c.id)
                const endTime = c.startTime ? addMinutes(c.startTime, c.durationMinutes) : null

                return (
                  <tr key={c.id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{c.name}</div>
                      {c.style && <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>{c.style}</div>}
                      {hasConflict && <span className="badge badge-conflict" style={{ marginTop: 4 }}>Conflict</span>}
                    </td>
                    <td>
                      {c.skillLevel
                        ? <span className={`badge ${SKILL_BADGE[c.skillLevel]}`}>{c.skillLevel}</span>
                        : <em style={{ color: 'var(--color-text-muted)', fontSize: '13px' }}>—</em>}
                    </td>
                    <td>{getTeacher(c.teacherId)}</td>
                    <td>
                      {c.dayOfWeek && endTime ? (
                        <>
                          {c.dayOfWeek}<br />
                          <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
                            {formatTime(c.startTime)} – {formatTime(endTime)}
                          </span>
                        </>
                      ) : (
                        <em style={{ color: 'var(--color-text-muted)', fontSize: '13px' }}>Unscheduled</em>
                      )}
                    </td>
                    <td>{getRoom(c.roomId)}</td>
                    <td>{c.durationMinutes} min</td>
                    <td>
                      <span style={{ color: atCapacity ? 'var(--color-danger)' : 'inherit', fontWeight: atCapacity ? 600 : 400 }}>
                        {enrolled}{capacity ? `/${capacity}` : ''}
                      </span>
                      {' '}
                      <button
                        className="btn btn-ghost btn-sm"
                        style={{ marginLeft: 4 }}
                        onClick={() => setEnrollClass(c)}
                      >
                        Manage
                      </button>
                    </td>
                    <td>
                      <div className="table-actions">
                        <button className="btn btn-ghost btn-sm" onClick={() => setModal(c)}>Edit</button>
                        <button className="btn btn-danger btn-sm" onClick={() => setConfirmId(c.id)}>Delete</button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {modal && (
        <Modal
          title={modal === 'add' ? 'Add Class' : 'Edit Class'}
          onClose={() => setModal(null)}
          size="lg"
        >
          <ClassForm
            initial={modal === 'add' ? null : modal}
            teachers={teachers}
            rooms={rooms}
            allClasses={classes}
            onSave={handleSave}
            onClose={() => setModal(null)}
          />
        </Modal>
      )}

      {enrollClass && (
        <EnrollmentPanel
          cls={enrollClass}
          students={students}
          rooms={rooms}
          classCrud={classCrud}
          onClose={() => setEnrollClass(null)}
        />
      )}

      {confirmId && (
        <ConfirmDialog
          message="Delete this class? All enrollments will be lost."
          onConfirm={() => { classCrud.remove(confirmId); setConfirmId(null) }}
          onCancel={() => setConfirmId(null)}
        />
      )}

      {confirmClear && (
        <ConfirmDialog
          title="Clear All Classes"
          message="Delete all classes? This cannot be undone."
          confirmLabel="Clear"
          onConfirm={() => { classCrud.clearAll(); setConfirmClear(false) }}
          onCancel={() => setConfirmClear(false)}
        />
      )}
    </div>
  )
}
