const KEYS = {
  students: 'dss_students',
  teachers: 'dss_teachers',
  rooms: 'dss_rooms',
  classes: 'dss_classes',
}

function load(key) {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function save(key, data) {
  localStorage.setItem(key, JSON.stringify(data))
}

export const studentsService = {
  getAll: () => load(KEYS.students),
  save: (records) => save(KEYS.students, records),
}

export const teachersService = {
  getAll: () => load(KEYS.teachers),
  save: (records) => save(KEYS.teachers, records),
}

export const roomsService = {
  getAll: () => load(KEYS.rooms),
  save: (records) => save(KEYS.rooms, records),
}

export const classesService = {
  getAll: () => load(KEYS.classes),
  save: (records) => save(KEYS.classes, records),
}

export function exportDataToFile() {
  const date = new Date().toISOString().slice(0, 10)
  const payload = {
    version: 1,
    exportedAt: new Date().toISOString(),
    students: studentsService.getAll(),
    teachers: teachersService.getAll(),
    rooms: roomsService.getAll(),
    classes: classesService.getAll(),
  }
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `dance-studio-${date}.json`
  a.click()
  URL.revokeObjectURL(url)
}

export function importDataFromFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result)
        const { students, teachers, rooms, classes } = data
        if (!Array.isArray(students) || !Array.isArray(teachers) || !Array.isArray(rooms) || !Array.isArray(classes)) {
          throw new Error('File is missing one or more required sections (students, teachers, rooms, classes).')
        }
        studentsService.save(students)
        teachersService.save(teachers)
        roomsService.save(rooms)
        classesService.save(classes)
        resolve(true)
      } catch (err) {
        reject(err)
      }
    }
    reader.onerror = () => reject(new Error('Could not read file.'))
    reader.readAsText(file)
  })
}

export function seedDemoData() {
  if (studentsService.getAll().length > 0) return

  const defaultAvailability = [
    { dayOfWeek: 'Monday',    startTime: '15:30', endTime: '22:00' },
    { dayOfWeek: 'Tuesday',   startTime: '15:30', endTime: '22:00' },
    { dayOfWeek: 'Wednesday', startTime: '15:30', endTime: '22:00' },
    { dayOfWeek: 'Thursday',  startTime: '15:30', endTime: '22:00' },
    { dayOfWeek: 'Friday',    startTime: '15:30', endTime: '22:00' },
  ]

  const teachers = [
    {
      id: crypto.randomUUID(), name: 'Suzan Ponthier',
      specialty: ['Ballet', 'Contemporary', 'Lyrical', 'Pointe', 'Musical Theater', 'Jazz'],
      phone: '469-450-6955', email: 'suzanponthier@gmail.com', color: '#0984e3',
      availability: defaultAvailability,
    },
    {
      id: crypto.randomUUID(), name: 'Mark Ponthier',
      specialty: ['Hip Hop', 'Jazz', 'Drill', 'All-Star', 'Contemporary'],
      phone: '214-578-3676', email: 'mponthier@gmail.com', color: '#6c5ce7',
      availability: defaultAvailability,
    },
    {
      id: crypto.randomUUID(), name: 'Virginia Nuckolls',
      specialty: ['Tap', 'Jazz', 'Musical Theater', 'Lyrical'],
      phone: '469-450-6954', email: 'virginia.nuckolls@gmail.com', color: '#00b894',
      availability: defaultAvailability,
    },
    {
      id: crypto.randomUUID(), name: 'Julia Ponthier',
      specialty: ['Ballet', 'Lyrical', 'Contemporary', 'Pointe'],
      phone: '469-555-0101', email: 'julia.ponthier@gmail.com', color: '#e17055',
      availability: defaultAvailability,
    },
    {
      id: crypto.randomUUID(), name: 'Jake Ponthier',
      specialty: ['Hip Hop', 'All-Star', 'Drill', 'Jazz'],
      phone: '214-555-0102', email: 'jake.ponthier@gmail.com', color: '#d63031',
      availability: defaultAvailability,
    },
    {
      id: crypto.randomUUID(), name: 'Doc Nuckolls',
      specialty: ['Tap', 'Musical Theater', 'Jazz', 'Contemporary'],
      phone: '469-555-0103', email: 'doc.nuckolls@gmail.com', color: '#fd79a8',
      availability: defaultAvailability,
    },
  ]
  teachersService.save(teachers)

  const defaultRoomAvailability = [
    { dayOfWeek: 'Monday',    startTime: '15:30', endTime: '22:00' },
    { dayOfWeek: 'Tuesday',   startTime: '15:30', endTime: '22:00' },
    { dayOfWeek: 'Wednesday', startTime: '15:30', endTime: '22:00' },
    { dayOfWeek: 'Thursday',  startTime: '15:30', endTime: '22:00' },
    { dayOfWeek: 'Friday',    startTime: '15:30', endTime: '22:00' },
  ]

  const rooms = [
    { id: crypto.randomUUID(), name: 'Tots',  capacity: 25, availability: defaultRoomAvailability },
    { id: crypto.randomUUID(), name: 'Pink',  capacity: 25, availability: defaultRoomAvailability },
    { id: crypto.randomUUID(), name: 'Green', capacity: 25, availability: defaultRoomAvailability },
    { id: crypto.randomUUID(), name: 'Blue',  capacity: 25, availability: defaultRoomAvailability },
  ]
  roomsService.save(rooms)

  const students = [
    { id: crypto.randomUUID(), name: 'Emma Johnson',    age: 12, skillLevel: 'Beginner/Intermediate (10+)' },
    { id: crypto.randomUUID(), name: 'Liam Park',       age: 14, skillLevel: 'Intermediate/Advanced (10+)' },
    { id: crypto.randomUUID(), name: 'Sofia Rivera',    age: 16, skillLevel: 'Intermediate/Advanced (10+)' },
    { id: crypto.randomUUID(), name: 'Noah Chen',       age: 11, skillLevel: 'Beginner/Intermediate (6-10)' },
    { id: crypto.randomUUID(), name: 'Olivia Williams', age: 15, skillLevel: 'Intermediate/Advanced (10+)' },
    { id: crypto.randomUUID(), name: 'Ava Martinez',    age:  9, skillLevel: 'Intermediate/Advanced (6-10)' },
  ]
  studentsService.save(students)

  const mk = (name, style, mins) => ({
    id: crypto.randomUUID(), name, style,
    teacherId: '', roomId: '', dayOfWeek: '', startTime: '',
    durationMinutes: mins, enrolledStudentIds: [],
  })

  const classes = [
    // Ballet (5)
    mk('Mini Ballet',          'Ballet',          45),
    mk('Ballet Basics',        'Ballet',          60),
    mk('Ballet II',            'Ballet',          60),
    mk('Ballet III',           'Ballet',          60),
    mk('Ballet Advanced',      'Ballet',          90),
    // Contemporary (3)
    mk('Contemporary I',       'Contemporary',    60),
    mk('Contemporary II',      'Contemporary',    60),
    mk('Teen Contemporary',    'Contemporary',    45),
    // Lyrical (3)
    mk('Lyrical I',            'Lyrical',         45),
    mk('Lyrical II',           'Lyrical',         60),
    mk('Teen Lyrical',         'Lyrical',         60),
    // Pointe (2)
    mk('Pointe I',             'Pointe',          45),
    mk('Pointe Advanced',      'Pointe',          60),
    // Musical Theater (2)
    mk('Musical Theater',      'Musical Theater', 60),
    mk('Teen Musical Theater', 'Musical Theater', 60),
    // Hip Hop (4)
    mk('Mini Hip Hop',         'Hip Hop',         30),
    mk('Hip Hop Foundations',  'Hip Hop',         60),
    mk('Hip Hop II',           'Hip Hop',         45),
    mk('Hip Hop Advanced',     'Hip Hop',         60),
    // Jazz (4)
    mk('Jazz Beginners',       'Jazz',            45),
    mk('Jazz II',              'Jazz',            45),
    mk('Jazz Funk',            'Jazz',            60),
    mk('Teen Jazz',            'Jazz',            60),
    // Drill (2)
    mk('Drill Team Prep',      'Drill',           60),
    mk('Drill Advanced',       'Drill',           90),
    // All-Star (2)
    mk('All-Star Junior',      'All-Star',        60),
    mk('All-Star Company',     'All-Star',        90),
    // Tap (3)
    mk('Mini Tap',             'Tap',             30),
    mk('Tap Beginners',        'Tap',             60),
    mk('Tap Advanced',         'Tap',             60),
  ]
  classesService.save(classes)
}
