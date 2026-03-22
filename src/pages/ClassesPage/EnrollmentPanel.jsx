import Modal from '../../components/Modal'

export default function EnrollmentPanel({ cls, students, rooms, classCrud, onClose }) {
  const room = rooms.find((r) => r.id === cls.roomId)
  const capacity = room?.capacity || Infinity
  const enrolled = students.filter((s) => cls.enrolledStudentIds.includes(s.id))
  const available = students.filter((s) => !cls.enrolledStudentIds.includes(s.id))
  const isFull = enrolled.length >= capacity

  return (
    <Modal title={`Enrollment — ${cls.name}`} onClose={onClose} size="lg">
      <div className="modal-body">
        {isFull && (
          <div className="alert alert-warning">
            ⚠️ Room is at capacity ({enrolled.length}/{capacity} students).
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          <div>
            <h3 style={{ fontSize: '13px', fontWeight: 700, marginBottom: '10px', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Enrolled ({enrolled.length}{capacity !== Infinity ? `/${capacity}` : ''})
            </h3>
            {enrolled.length === 0 ? (
              <p style={{ color: 'var(--color-text-muted)', fontSize: '13px' }}>No students enrolled yet.</p>
            ) : (
              <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {enrolled.map((s) => (
                  <li key={s.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 10px', background: 'var(--color-bg)', borderRadius: 'var(--radius-sm)' }}>
                    <span style={{ fontSize: '13px' }}>{s.name} <span style={{ color: 'var(--color-text-muted)', fontSize: '11px' }}>({s.skillLevel})</span></span>
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => classCrud.unenroll(cls.id, s.id)}
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <h3 style={{ fontSize: '13px', fontWeight: 700, marginBottom: '10px', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Available ({available.length})
            </h3>
            {available.length === 0 ? (
              <p style={{ color: 'var(--color-text-muted)', fontSize: '13px' }}>All students are enrolled.</p>
            ) : (
              <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {available.map((s) => (
                  <li key={s.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 10px', background: 'var(--color-bg)', borderRadius: 'var(--radius-sm)' }}>
                    <span style={{ fontSize: '13px' }}>{s.name} <span style={{ color: 'var(--color-text-muted)', fontSize: '11px' }}>({s.skillLevel})</span></span>
                    <button
                      className="btn btn-primary btn-sm"
                      disabled={isFull}
                      onClick={() => classCrud.enroll(cls.id, s.id)}
                    >
                      Enroll
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
      <div className="modal-footer">
        <button className="btn btn-ghost" onClick={onClose}>Close</button>
      </div>
    </Modal>
  )
}
