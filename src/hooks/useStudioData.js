import { useState } from 'react'
import {
  studentsService,
  teachersService,
  roomsService,
  classesService,
} from '../services/storage'
import { isWithinAvailability } from '../utils/availability'

function makeCrud(getState, setState, service) {
  return {
    add(record) {
      const next = [...getState(), { ...record, id: crypto.randomUUID() }]
      setState(next)
      service.save(next)
    },
    update(updated) {
      const next = getState().map((r) => (r.id === updated.id ? updated : r))
      setState(next)
      service.save(next)
    },
    updateMany(updatedList) {
      const map = Object.fromEntries(updatedList.map((r) => [r.id, r]))
      const next = getState().map((r) => map[r.id] ?? r)
      setState(next)
      service.save(next)
    },
    remove(id) {
      const next = getState().filter((r) => r.id !== id)
      setState(next)
      service.save(next)
    },
  }
}

export function useStudioData() {
  const [students, setStudents] = useState(() => studentsService.getAll())
  const [teachers, setTeachers] = useState(() => teachersService.getAll())
  const [rooms, setRooms] = useState(() => roomsService.getAll())
  const [classes, setClasses] = useState(() => classesService.getAll())

  const studentCrud = makeCrud(() => students, setStudents, studentsService)

  function unscheduleInvalidClasses(affectedClasses) {
    const invalid = affectedClasses.filter((c) => c.dayOfWeek && c.startTime)
    if (invalid.length === 0) return
    const invalidIds = new Set(invalid.map((c) => c.id))
    const next = classes.map((c) =>
      invalidIds.has(c.id) ? { ...c, dayOfWeek: '', startTime: '', roomId: '', teacherId: '' } : c
    )
    setClasses(next)
    classesService.save(next)
  }

  const teacherCrud = {
    ...makeCrud(() => teachers, setTeachers, teachersService),
    update(updated) {
      const next = teachers.map((t) => (t.id === updated.id ? updated : t))
      setTeachers(next)
      teachersService.save(next)
      const affected = classes.filter(
        (c) => c.teacherId === updated.id &&
          !isWithinAvailability(updated.availability, c.dayOfWeek, c.startTime, c.durationMinutes)
      )
      unscheduleInvalidClasses(affected)
    },
  }

  const roomCrud = {
    ...makeCrud(() => rooms, setRooms, roomsService),
    update(updated) {
      const next = rooms.map((r) => (r.id === updated.id ? updated : r))
      setRooms(next)
      roomsService.save(next)
      const affected = classes.filter(
        (c) => c.roomId === updated.id &&
          !isWithinAvailability(updated.availability, c.dayOfWeek, c.startTime, c.durationMinutes)
      )
      unscheduleInvalidClasses(affected)
    },
  }

  const classCrud = {
    ...makeCrud(() => classes, setClasses, classesService),
    enroll(classId, studentId) {
      const next = classes.map((c) => {
        if (c.id !== classId) return c
        if (c.enrolledStudentIds.includes(studentId)) return c
        return { ...c, enrolledStudentIds: [...c.enrolledStudentIds, studentId] }
      })
      setClasses(next)
      classesService.save(next)
    },
    unenroll(classId, studentId) {
      const next = classes.map((c) => {
        if (c.id !== classId) return c
        return { ...c, enrolledStudentIds: c.enrolledStudentIds.filter((id) => id !== studentId) }
      })
      setClasses(next)
      classesService.save(next)
    },
  }

  const sortedRooms = [...rooms].sort((a, b) => a.name.localeCompare(b.name))

  return { students, teachers, rooms: sortedRooms, classes, studentCrud, teacherCrud, roomCrud, classCrud }
}
