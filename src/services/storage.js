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
    { dayOfWeek: 'Monday',    startTime: '15:30', endTime: '21:30' },
    { dayOfWeek: 'Tuesday',   startTime: '15:30', endTime: '21:30' },
    { dayOfWeek: 'Wednesday', startTime: '15:30', endTime: '21:30' },
    { dayOfWeek: 'Thursday',  startTime: '15:30', endTime: '21:30' },
    { dayOfWeek: 'Friday',    startTime: '15:30', endTime: '21:30' },
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
    { dayOfWeek: 'Monday',    startTime: '15:30', endTime: '21:30' },
    { dayOfWeek: 'Tuesday',   startTime: '15:30', endTime: '21:30' },
    { dayOfWeek: 'Wednesday', startTime: '15:30', endTime: '21:30' },
    { dayOfWeek: 'Thursday',  startTime: '15:30', endTime: '21:30' },
    { dayOfWeek: 'Friday',    startTime: '15:30', endTime: '21:30' },
  ]

  const rooms = [
    { id: crypto.randomUUID(), name: 'Tots',  capacity: 25, availability: defaultRoomAvailability },
    { id: crypto.randomUUID(), name: 'Pink',  capacity: 25, availability: defaultRoomAvailability },
    { id: crypto.randomUUID(), name: 'Green', capacity: 25, availability: defaultRoomAvailability },
    { id: crypto.randomUUID(), name: 'Blue',  capacity: 25, availability: defaultRoomAvailability },
  ]
  roomsService.save(rooms)

  const students = [
    { id: crypto.randomUUID(), name: 'Emma Johnson',    age: 12, skillLevel: 'Beg/Int (10+)' },
    { id: crypto.randomUUID(), name: 'Liam Park',       age: 14, skillLevel: 'Int/Adv (10+)' },
    { id: crypto.randomUUID(), name: 'Sofia Rivera',    age: 16, skillLevel: 'Int/Adv (10+)' },
    { id: crypto.randomUUID(), name: 'Noah Chen',       age: 11, skillLevel: 'Beg/Int (6-10)' },
    { id: crypto.randomUUID(), name: 'Olivia Williams', age: 15, skillLevel: 'Int/Adv (10+)' },
    { id: crypto.randomUUID(), name: 'Ava Martinez',    age:  9, skillLevel: 'Int/Adv (6-10)' },
  ]
  studentsService.save(students)

  const mk = (name, style, mins, skillLevel = '') => ({
    id: crypto.randomUUID(), name, style, skillLevel,
    teacherId: '', roomId: '', dayOfWeek: '', startTime: '',
    durationMinutes: mins, enrolledStudentIds: [],
  })

  const BI6  = 'Beg/Int (6-10)'
  const BI10 = 'Beg/Int (10+)'
  const IA6  = 'Int/Adv (6-10)'
  const IA10 = 'Int/Adv (10+)'

  const classes = [
    // Ballet (5)
    mk('Mini Ballet',          'Ballet',           30, BI6),   // 30m
    mk('Ballet Basics',        'Ballet',           60, BI10),  // 60m
    mk('Ballet II',            'Ballet',           60, BI10),  // 60m
    mk('Ballet III',           'Ballet',           60, IA6),   // 60m
    mk('Ballet Advanced',      'Ballet',          105, IA10),  // 105m
    // Contemporary (3)
    mk('Contemporary I',       'Contemporary',     60, BI10),  // 60m
    mk('Contemporary II',      'Contemporary',     60, IA6),   // 60m
    mk('Teen Contemporary',    'Contemporary',     90, IA10),  // 90m
    // Lyrical (3)
    mk('Lyrical I',            'Lyrical',          45, BI6),   // 45m
    mk('Lyrical II',           'Lyrical',          60, IA6),   // 60m
    mk('Teen Lyrical',         'Lyrical',          60, IA10),  // 60m
    // Pointe (2)
    mk('Pointe I',             'Pointe',           75, BI10),  // 75m
    mk('Pointe Advanced',      'Pointe',          120, IA10),  // 120m
    // Musical Theater (2)
    mk('Musical Theater',      'Musical Theater',  60, BI10),  // 60m
    mk('Teen Musical Theater', 'Musical Theater',  60, IA10),  // 60m
    // Hip Hop (4)
    mk('Mini Hip Hop',         'Hip Hop',          30, BI6),   // 30m
    mk('Hip Hop Foundations',  'Hip Hop',          60, BI10),  // 60m
    mk('Hip Hop II',           'Hip Hop',          75, IA6),   // 75m
    mk('Hip Hop Advanced',     'Hip Hop',         120, IA10),  // 120m
    // Jazz (4)
    mk('Jazz Beginners',       'Jazz',             45, BI6),   // 45m
    mk('Jazz II',              'Jazz',             60, IA6),   // 60m
    mk('Jazz Funk',            'Jazz',             60, IA6),   // 60m
    mk('Teen Jazz',            'Jazz',             90, IA10),  // 90m
    // Drill (2)
    mk('Drill Team Prep',      'Drill',            60, BI10),  // 60m
    mk('Drill Advanced',       'Drill',           105, IA10),  // 105m
    // All-Star (2)
    mk('All-Star Junior',      'All-Star',         60, BI6),   // 60m
    mk('All-Star Company',     'All-Star',         90, IA10),  // 90m
    // Tap (3)
    mk('Mini Tap',             'Tap',              30, BI6),   // 30m
    mk('Tap Beginners',        'Tap',              60, BI10),  // 60m
    mk('Tap Advanced',         'Tap',             120, IA10),  // 120m
  ]
  classesService.save(classes)
}
