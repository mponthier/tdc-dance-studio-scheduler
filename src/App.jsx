import { useState, useEffect } from 'react'
import Sidebar from './components/Sidebar'
import SchedulePage from './pages/SchedulePage/SchedulePage'
import StudentsPage from './pages/StudentsPage/StudentsPage'
import TeachersPage from './pages/TeachersPage/TeachersPage'
import RoomsPage from './pages/RoomsPage/RoomsPage'
import ClassesPage from './pages/ClassesPage/ClassesPage'
import { useStudioData } from './hooks/useStudioData'
import { seedDemoData, exportDataToFile, importDataFromFile } from './services/storage'

export default function App() {
  const [activeView, setActiveView] = useState('schedule')
  const data = useStudioData()

  // Seed demo data on first load
  useEffect(() => {
    seedDemoData()
    // Re-read state from localStorage after seeding
    // (seedDemoData only runs when there are no students, so reload only when fresh)
    const students = JSON.parse(localStorage.getItem('dss_students') || '[]')
    if (students.length > 0 && data.students.length === 0) {
      window.location.reload()
    }
  }, [])

  async function handleImport(file) {
    if (!file) return
    if (!window.confirm('This will replace all current data. Continue?')) return
    try {
      await importDataFromFile(file)
      window.location.reload()
    } catch (err) {
      alert('Import failed: ' + err.message)
    }
  }

  function renderPage() {
    switch (activeView) {
      case 'schedule':
        return (
          <SchedulePage
            classes={data.classes}
            teachers={data.teachers}
            rooms={data.rooms}
            students={data.students}
            classCrud={data.classCrud}
          />
        )
      case 'classes':
        return (
          <ClassesPage
            classes={data.classes}
            teachers={data.teachers}
            rooms={data.rooms}
            students={data.students}
            classCrud={data.classCrud}
          />
        )
      case 'students':
        return <StudentsPage students={data.students} studentCrud={data.studentCrud} />
      case 'teachers':
        return <TeachersPage teachers={data.teachers} teacherCrud={data.teacherCrud} classes={data.classes} />
      case 'rooms':
        return <RoomsPage rooms={data.rooms} roomCrud={data.roomCrud} />
      default:
        return null
    }
  }

  return (
    <div className="app-layout">
      <Sidebar activeView={activeView} onNavigate={setActiveView} onExport={exportDataToFile} onImport={handleImport} />
      <main className="app-main">{renderPage()}</main>
    </div>
  )
}
