import { useState, useEffect, useRef } from 'react'
import Sidebar from './components/Sidebar'
import SchedulePage from './pages/SchedulePage/SchedulePage'
import StudentsPage from './pages/StudentsPage/StudentsPage'
import TeachersPage from './pages/TeachersPage/TeachersPage'
import RoomsPage from './pages/RoomsPage/RoomsPage'
import ClassesPage from './pages/ClassesPage/ClassesPage'
import DocsPage from './pages/DocsPage/DocsPage'
import { useStudioData } from './hooks/useStudioData'
import {
  seedDemoData,
  exportDataToFile, importDataFromFile,
  exportClassesToFile,  importClassesFromFile,
  exportStudentsToFile, importStudentsFromFile,
  exportTeachersToFile, importTeachersFromFile,
  exportRoomsToFile,    importRoomsFromFile,
} from './services/storage'
import { optimizeWithCPSAT } from './utils/optimizerCPSAT'

export default function App() {
  const [activeView, setActiveView] = useState('schedule')
  const data = useStudioData()

  const [optimizing, setOptimizing] = useState(false)
  const [stopwatchSecs, setStopwatchSecs] = useState(0)
  const [scheduleProgress, setScheduleProgress] = useState(() => {
    try {
      const saved = localStorage.getItem('dss_schedule_progress')
      return saved ? JSON.parse(saved) : { messages: [], scheduled: null, total: null, analytics: null }
    } catch {
      return { messages: [], scheduled: null, total: null, analytics: null }
    }
  })

  useEffect(() => {
    try { localStorage.setItem('dss_schedule_progress', JSON.stringify(scheduleProgress)) } catch { /* quota */ }
  }, [scheduleProgress])

  useEffect(() => {
    if (!optimizing) return
    const id = setInterval(() => setStopwatchSecs((s) => s + 1), 1000)
    return () => clearInterval(id)
  }, [optimizing])

  // Keep a ref to latest data so the async handler always sees current state
  const dataRef = useRef(data)
  useEffect(() => { dataRef.current = data }, [data])

  const abortControllerRef = useRef(null)
  function handleAbort() {
    abortControllerRef.current?.abort()
  }

  async function handleAutoSchedule(solverTimeout) {
    abortControllerRef.current = new AbortController()
    setOptimizing(true)
    setStopwatchSecs(0)
    setScheduleProgress({ messages: [], scheduled: null, total: null, analytics: null })
    const { classes, teachers, rooms, classCrud } = dataRef.current
    const t0 = Date.now()
    try {
      const result = await optimizeWithCPSAT(classes, teachers, rooms, (p) => {
        setScheduleProgress((prev) => ({
          messages: [...prev.messages, p.message],
          scheduled: p.scheduled ?? prev.scheduled,
          total: p.total ?? prev.total,
        }))
      }, solverTimeout, abortControllerRef.current.signal)
      const elapsed = ((Date.now() - t0) / 1000).toFixed(1)
      const { scheduled, unscheduledIds, solverInfo } = result
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

      // ── Compute analytics ──────────────────────────────────────────────────
      const teacherMap = Object.fromEntries(dataRef.current.teachers.map((t) => [t.id, t]))
      const roomMap    = Object.fromEntries(dataRef.current.rooms.map((r) => [r.id, r]))
      const DAY_ORDER  = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

      const teacherStats = {}
      scheduled.forEach((cls) => {
        if (!cls.teacherId) return
        if (!teacherStats[cls.teacherId]) {
          const t = teacherMap[cls.teacherId]
          teacherStats[cls.teacherId] = { id: cls.teacherId, name: t?.name ?? 'Unknown', color: t?.color ?? '#888', classCount: 0, totalMinutes: 0, days: new Set() }
        }
        teacherStats[cls.teacherId].classCount++
        teacherStats[cls.teacherId].totalMinutes += cls.durationMinutes
        teacherStats[cls.teacherId].days.add(cls.dayOfWeek)
      })
      const byTeacher = Object.values(teacherStats)
        .map((t) => ({ ...t, days: [...t.days].sort((a, b) => DAY_ORDER.indexOf(a) - DAY_ORDER.indexOf(b)) }))
        .sort((a, b) => b.classCount - a.classCount)

      const roomStats = {}
      scheduled.forEach((cls) => {
        if (!cls.roomId) return
        if (!roomStats[cls.roomId]) {
          const r = roomMap[cls.roomId]
          roomStats[cls.roomId] = { id: cls.roomId, name: r?.name ?? 'Unknown', classCount: 0, totalMinutes: 0 }
        }
        roomStats[cls.roomId].classCount++
        roomStats[cls.roomId].totalMinutes += cls.durationMinutes
      })
      const byRoom = Object.values(roomStats).sort((a, b) => b.classCount - a.classCount)

      const dayStats = Object.fromEntries(DAY_ORDER.map((d) => [d, { day: d, classCount: 0, totalMinutes: 0 }]))
      scheduled.forEach((cls) => {
        if (cls.dayOfWeek && dayStats[cls.dayOfWeek]) {
          dayStats[cls.dayOfWeek].classCount++
          dayStats[cls.dayOfWeek].totalMinutes += cls.durationMinutes
        }
      })
      const byDay = DAY_ORDER.map((d) => dayStats[d])

      const genreStats = {}
      scheduled.forEach((cls) => { const g = cls.style || 'Unknown'; genreStats[g] = (genreStats[g] || 0) + 1 })
      const byGenre = Object.entries(genreStats)
        .map(([genre, classCount]) => ({ genre, classCount }))
        .sort((a, b) => b.classCount - a.classCount)

      const SKILL_ORDER = ['Beg/Int (6-10)', 'Beg/Int (10+)', 'Int/Adv (6-10)', 'Int/Adv (10+)']
      const skillStats = {}
      scheduled.forEach((cls) => { if (cls.skillLevel) skillStats[cls.skillLevel] = (skillStats[cls.skillLevel] || 0) + 1 })
      const bySkillLevel = SKILL_ORDER.filter((s) => skillStats[s]).map((s) => ({ skillLevel: s, classCount: skillStats[s] }))

      const analytics = {
        scheduledCount: scheduled.length,
        unscheduledCount: unscheduledIds.length,
        totalClasses: classes.length,
        specialtyCount,
        elapsedSecs: elapsed,
        byTeacher, byRoom, byDay, byGenre, bySkillLevel,
        solverInfo: solverInfo ?? null,
      }

      setScheduleProgress((prev) => ({ ...prev, messages: [...prev.messages, summary], analytics }))
    } catch (err) {
      if (err.name === 'AbortError') {
        setScheduleProgress((prev) => ({ ...prev, messages: [...prev.messages, 'Scheduling aborted.'] }))
      } else {
        setScheduleProgress((prev) => ({ ...prev, messages: [...prev.messages, `Error: ${err.message}`] }))
      }
    } finally {
      abortControllerRef.current = null
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

  function handleExport() {
    switch (activeView) {
      case 'classes':  exportClassesToFile();  break
      case 'students': exportStudentsToFile(); break
      case 'teachers': exportTeachersToFile(); break
      case 'rooms':    exportRoomsToFile();    break
      default:         exportDataToFile();     break
    }
  }

  async function handleImport(file) {
    if (!file) return
    const { classCrud, studentCrud, teacherCrud, roomCrud } = dataRef.current
    try {
      switch (activeView) {
        case 'classes':
          if (!window.confirm('Replace all class data with the contents of this file?')) return
          classCrud.loadAll(await importClassesFromFile(file))
          break
        case 'students':
          if (!window.confirm('Replace all student data with the contents of this file?')) return
          studentCrud.loadAll(await importStudentsFromFile(file))
          break
        case 'teachers':
          if (!window.confirm('Replace all teacher data with the contents of this file?')) return
          teacherCrud.loadAll(await importTeachersFromFile(file))
          break
        case 'rooms':
          if (!window.confirm('Replace all room data with the contents of this file?')) return
          roomCrud.loadAll(await importRoomsFromFile(file))
          break
        default:
          if (!window.confirm('This will replace all current data. Continue?')) return
          await importDataFromFile(file)
          window.location.reload()
      }
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
            onAbort={handleAbort}
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

  const [sidebarOpen, setSidebarOpen] = useState(true)

  return (
    <div className={`app-layout${sidebarOpen ? '' : ' sidebar-collapsed'}`}>
      <Sidebar
        activeView={activeView}
        onNavigate={setActiveView}
        onExport={handleExport}
        onImport={handleImport}
        open={sidebarOpen}
        onToggle={() => setSidebarOpen((v) => !v)}
      />
      {!sidebarOpen && (
        <button className="sidebar-show-btn" onClick={() => setSidebarOpen(true)} title="Show sidebar">&#8250;</button>
      )}
      <main className="app-main">{renderPage()}</main>
    </div>
  )
}
