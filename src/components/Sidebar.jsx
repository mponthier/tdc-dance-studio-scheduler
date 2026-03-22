import { useRef } from 'react'
import './Sidebar.css'
import suzanImg from '../assets/Suzan.jpeg'

const NAV_ITEMS = [
  { id: 'schedule', label: 'Schedule', icon: '📅' },
  { id: 'classes', label: 'Classes', icon: '🎓' },
  { id: 'students', label: 'Students', icon: '👤' },
  { id: 'teachers', label: 'Teachers', icon: '🎤' },
  { id: 'rooms', label: 'Rooms', icon: '🏠' },
]

export default function Sidebar({ activeView, onNavigate, onExport, onImport }) {
  const fileInputRef = useRef(null)

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <h2>The Dance Collective</h2>
        <span>McKinney</span>
      </div>
      <nav className="sidebar-nav">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            className={`nav-item${activeView === item.id ? ' active' : ''}`}
            onClick={() => onNavigate(item.id)}
          >
            <span className="nav-icon" style={{ color: 'initial' }}>{item.icon}</span>
            {item.label}
          </button>
        ))}
      </nav>
      <div className="sidebar-portrait">
        <img src={suzanImg} alt="Suzan Ponthier" className="sidebar-portrait-img" />
      </div>
      <div className="sidebar-spacer" />
      <div className="sidebar-data-actions">
        <button className="sidebar-data-btn" onClick={onExport}>Save Data</button>
        <button className="sidebar-data-btn" onClick={() => fileInputRef.current.click()}>Load Data</button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          style={{ display: 'none' }}
          onChange={(e) => { onImport(e.target.files[0]); e.target.value = '' }}
        />
      </div>
      <div className="sidebar-footer">The Dance Collective McKinney</div>
    </aside>
  )
}
