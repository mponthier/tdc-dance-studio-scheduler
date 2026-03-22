function toMins(timeStr) {
  const [h, m] = timeStr.split(':').map(Number)
  return h * 60 + m
}

function timesOverlap(startA, durA, startB, durB) {
  const aStart = toMins(startA)
  const aEnd = aStart + durA
  const bStart = toMins(startB)
  const bEnd = bStart + durB
  return aStart < bEnd && bStart < aEnd
}

export function detectConflicts(candidate, allClasses) {
  const conflicts = []
  const peers = allClasses.filter(
    (c) => c.id !== candidate.id && c.dayOfWeek === candidate.dayOfWeek,
  )

  for (const peer of peers) {
    if (
      !timesOverlap(
        candidate.startTime,
        candidate.durationMinutes,
        peer.startTime,
        peer.durationMinutes,
      )
    )
      continue

    if (peer.teacherId && peer.teacherId === candidate.teacherId) {
      conflicts.push({
        type: 'teacher',
        conflictingClassId: peer.id,
        message: `Teacher is already teaching "${peer.name}" at this time.`,
      })
    }
    if (peer.roomId && peer.roomId === candidate.roomId) {
      conflicts.push({
        type: 'room',
        conflictingClassId: peer.id,
        message: `Room is already booked for "${peer.name}" at this time.`,
      })
    }
  }

  return conflicts
}

export function findAllConflictingIds(allClasses) {
  const conflictIds = new Set()
  for (let i = 0; i < allClasses.length; i++) {
    for (let j = i + 1; j < allClasses.length; j++) {
      const a = allClasses[i]
      const b = allClasses[j]
      if (a.dayOfWeek !== b.dayOfWeek) continue
      if (!timesOverlap(a.startTime, a.durationMinutes, b.startTime, b.durationMinutes)) continue
      if (a.teacherId === b.teacherId || a.roomId === b.roomId) {
        conflictIds.add(a.id)
        conflictIds.add(b.id)
      }
    }
  }
  return conflictIds
}
