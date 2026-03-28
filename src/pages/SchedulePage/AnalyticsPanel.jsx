import Modal from '../../components/Modal'
import './AnalyticsPanel.css'

const SKILL_COLORS = {
  'Beg/Int (6-10)': '#e67e22',
  'Beg/Int (10+)':  '#2980b9',
  'Int/Adv (6-10)': '#27ae60',
  'Int/Adv (10+)':  '#8e44ad',
}

function fmtHours(minutes) {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m}m`
  return m === 0 ? `${h}h` : `${h}h ${m}m`
}

function GapBar({ pct }) {
  const capped = Math.min(pct, 100)
  const color = pct === 0 ? '#27ae60' : pct < 5 ? '#2ecc71' : pct < 20 ? '#f39c12' : '#c0392b'
  return (
    <div className="analytics-gap-bar-wrap">
      <div className="analytics-gap-bar-track">
        <div className="analytics-gap-bar-fill" style={{ width: `${capped}%`, background: color }} />
      </div>
      <span className="analytics-gap-bar-pct" style={{ color }}>{pct}%</span>
    </div>
  )
}

export default function AnalyticsPanel({ analytics, onClose }) {
  const {
    scheduledCount, unscheduledCount, totalClasses, specialtyCount, elapsedSecs,
    byTeacher, byRoom, byDay, byGenre, bySkillLevel, solverInfo,
  } = analytics

  return (
    <Modal title="Schedule Analytics" onClose={onClose} size="xl">
      <div className="analytics-body">

        {/* ── Row 1: Summary stat cards ──────────────────────────────── */}
        <div className="analytics-cards">
          <div className="analytics-card">
            <div className="analytics-card-value">{scheduledCount}<span className="analytics-card-denom">/{totalClasses}</span></div>
            <div className="analytics-card-label">Classes Scheduled</div>
          </div>
          <div className="analytics-card">
            <div className="analytics-card-value" style={unscheduledCount > 0 ? { color: '#c0392b' } : {}}>
              {unscheduledCount}
            </div>
            <div className="analytics-card-label">Not Placed</div>
          </div>
          <div className="analytics-card">
            <div className="analytics-card-value">{specialtyCount}</div>
            <div className="analytics-card-label">Specialty Matches</div>
          </div>
          <div className="analytics-card">
            <div className="analytics-card-value">{elapsedSecs}<span className="analytics-card-denom">s</span></div>
            <div className="analytics-card-label">Solve Time</div>
          </div>
        </div>

        {/* ── Row 2: Solver Quality strip ────────────────────────────── */}
        {solverInfo && (
          <div className="analytics-solver-strip">
            <div className="analytics-solver-cell">
              <div className="analytics-solver-label">Status</div>
              <span className="analytics-status-badge" style={{ background: solverInfo.isOptimal ? '#27ae60' : '#f39c12' }}>
                {solverInfo.solverStatus ?? '—'}
              </span>
            </div>
            <div className="analytics-solver-cell analytics-solver-cell-gap">
              <div className="analytics-solver-label">Optimality Gap</div>
              <GapBar pct={solverInfo.optimalityGapPct ?? 0} />
              <div className="analytics-solver-hint">
                {solverInfo.optimalityGapPct === 0
                  ? '✓ Provably optimal'
                  : 'Increase timeout for a better result'}
              </div>
            </div>
            <div className="analytics-solver-cell">
              <div className="analytics-solver-label">Objective Value</div>
              <div className="analytics-solver-mono">{(solverInfo.objectiveValue ?? 0).toLocaleString()}</div>
            </div>
            <div className="analytics-solver-cell">
              <div className="analytics-solver-label">Best Bound</div>
              <div className="analytics-solver-mono">{(solverInfo.bestBound ?? 0).toLocaleString()}</div>
            </div>
          </div>
        )}

        {/* ── Row 3: Three-column detail grid ────────────────────────── */}
        <div className="analytics-main-grid">

          {/* Col 1: Teacher Workload */}
          <div className="analytics-section">
            <h3 className="analytics-section-title">Teacher Workload</h3>
            <table className="analytics-table">
              <thead>
                <tr>
                  <th>Teacher</th>
                  <th className="analytics-num">Classes</th>
                  <th className="analytics-num">Hours</th>
                  <th>Days</th>
                </tr>
              </thead>
              <tbody>
                {byTeacher.map((t) => (
                  <tr key={t.id}>
                    <td><span className="analytics-dot" style={{ background: t.color }} />{t.name}</td>
                    <td className="analytics-num">{t.classCount}</td>
                    <td className="analytics-num">{fmtHours(t.totalMinutes)}</td>
                    <td className="analytics-days">{t.days.map((d) => d.slice(0, 2)).join(' ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Col 2: Room Utilization + Day Distribution */}
          <div className="analytics-section">
            <h3 className="analytics-section-title">Room Utilization</h3>
            <table className="analytics-table">
              <thead>
                <tr>
                  <th>Room</th>
                  <th className="analytics-num">Classes</th>
                  <th className="analytics-num">Hours</th>
                </tr>
              </thead>
              <tbody>
                {byRoom.map((r) => (
                  <tr key={r.id}>
                    <td>{r.name}</td>
                    <td className="analytics-num">{r.classCount}</td>
                    <td className="analytics-num">{fmtHours(r.totalMinutes)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <h3 className="analytics-section-title" style={{ marginTop: 16 }}>Day Distribution</h3>
            <table className="analytics-table">
              <thead>
                <tr>
                  <th>Day</th>
                  <th className="analytics-num">Classes</th>
                  <th className="analytics-num">Hours</th>
                </tr>
              </thead>
              <tbody>
                {byDay.map((d) => (
                  <tr key={d.day} style={d.classCount === 0 ? { color: '#aaa' } : {}}>
                    <td>{d.day}</td>
                    <td className="analytics-num">{d.classCount || '—'}</td>
                    <td className="analytics-num">{d.classCount > 0 ? fmtHours(d.totalMinutes) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Col 3: Genre + Skill Level */}
          <div className="analytics-section">
            <h3 className="analytics-section-title">Genre Breakdown</h3>
            <table className="analytics-table">
              <thead>
                <tr>
                  <th>Genre</th>
                  <th className="analytics-num">Classes</th>
                </tr>
              </thead>
              <tbody>
                {byGenre.map((g) => (
                  <tr key={g.genre}>
                    <td>{g.genre}</td>
                    <td className="analytics-num">{g.classCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <h3 className="analytics-section-title" style={{ marginTop: 16 }}>Skill Level Breakdown</h3>
            <table className="analytics-table">
              <thead>
                <tr>
                  <th>Skill Level</th>
                  <th className="analytics-num">Classes</th>
                </tr>
              </thead>
              <tbody>
                {bySkillLevel.map((s) => (
                  <tr key={s.skillLevel}>
                    <td>
                      <span className="analytics-skill-badge" style={{ background: SKILL_COLORS[s.skillLevel] ?? '#888' }}>
                        {s.skillLevel}
                      </span>
                    </td>
                    <td className="analytics-num">{s.classCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

        </div>
      </div>
    </Modal>
  )
}
