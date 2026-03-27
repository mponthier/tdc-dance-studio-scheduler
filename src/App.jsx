import { useState, useEffect, useRef } from 'react'
import Sidebar from './components/Sidebar'
import SchedulePage from './pages/SchedulePage/SchedulePage'
import StudentsPage from './pages/StudentsPage/StudentsPage'
import TeachersPage from './pages/TeachersPage/TeachersPage'
import RoomsPage from './pages/RoomsPage/RoomsPage'
import ClassesPage from './pages/ClassesPage/ClassesPage'
import DocsPage from './pages/DocsPage/DocsPage'
import { useStudioData } from './hooks/useStudioData'
import { seedDemoData, exportDataToFile, importDataFromFile } from './services/storage'
import { optimizeWithCPSAT } from './utils/optimizerCPSAT'

export default function App() {
  const [activeView, setActiveView] = useState('schedule')
  const data = useStudioData()

  const [optimizing, setOptimizing] = useState(false)
  const [stopwatchSecs, setStopwatchSecs] = useState(0)
  const [scheduleProgress, setScheduleProgress] = useState({ messages: [], scheduled: null, total: null })

  useEffect(() => {
    if (!optimizing) return
    const id = setInterval(() => setStopwatchSecs((s) => s + 1), 1000)
    return () => clearInterval(id)
  }, [optimizing])

  // Keep a ref to latest data so the async handler always sees current state
  const dataRef = useRef(data)
  useEffect(() => { dataRef.current = data }, [data])

  async function handleAutoSchedule(solverTimeout) {
    setOptimizing(true)
    setStopwatchSecs(0)
    setScheduleProgress({ messages: [], scheduled: null, total: null })
    const { classes, teachers, rooms, classCrud } = dataRef.current
    const t0 = Date.now()
    try {
      const result = await optimizeWithCPSAT(classes, teachers, rooms, (p) => {
        setScheduleProgress((prev) => ({
          messages: [...prev.messages, p.message],
          scheduled: p.scheduled ?? prev.scheduled,
          total: p.total ?? prev.total,
        }))
      }, solverTimeout)
      const elapsed = ((Date.now() - t0) / 1000).toFixed(1)
      const { scheduled, unscheduledIds } = result
      if (scheduled.length > 0) dataRef.current.classCrud.updateMany(scheduled)
      const unscheduledNames = unscheduledIds
        .map((id) => dataRef.current.classes.find((c) => c.id === id)?.name)
        .filter(Boolean)
      const specialtyCount = scheduled.filter((cls) => {
        const teacher = dataRef.current.teachers.find((t) => t.id === cls.teacherId)
        return teacher && teacher.specialties?.some((s) => s.toLowerCase() === cls.style?.toLowerCase())
      }).length
      let summary = scheduled.length > 0
        ? `Scheduled ${scheduled.length} class${scheduled.length !== 1 ? 'es' : ''}.`
        : 'No classes could be scheduled.'
      if (scheduled.length > 0) summary += ` ${specialtyCount} assigned to a specialty teacher.`
      if (unscheduledNames.length > 0) summary += ` Could not place: ${unscheduledNames.join(', ')}.`
      summary += ` (CP-SAT, ${elapsed}s)`
      setScheduleProgress((prev) => ({ ...prev, messages: [...prev.messages, summary] }))
    } catch (err) {
      setScheduleProgress((prev) => ({ ...prev, messages: [...prev.messages, `Error: ${err.message}`] }))
    } finally {
      setOptimizing(false)
    }
  }

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
            optimizing={optimizing}
            stopwatchSecs={stopwatchSecs}
            scheduleProgress={scheduleProgress}
            setScheduleProgress={setScheduleProgress}
            onAutoSchedule={handleAutoSchedule}
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
      case 'docs':
        return <DocsPage />
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
