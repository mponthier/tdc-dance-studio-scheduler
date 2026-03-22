const BACKEND_URL = 'http://localhost:8000'

/**
 * Calls the CP-SAT backend to optimally schedule unscheduled classes.
 * Returns { scheduled: [...updatedClasses], unscheduledIds: [...ids] }
 * on success, or throws if the backend is unreachable (caller should fall back to greedy).
 */
export async function optimizeWithCPSAT(classes, teachers, rooms) {
  const response = await fetch(`${BACKEND_URL}/api/optimize`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ classes, teachers, rooms }),
    signal: AbortSignal.timeout(120000),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`CP-SAT backend error ${response.status}: ${text}`)
  }

  const { scheduled, unscheduled } = await response.json()

  // Merge CP-SAT assignments back onto original class objects
  const classById = Object.fromEntries(classes.map((c) => [c.id, c]))
  const updatedClasses = scheduled.map((s) => ({
    ...classById[s.id],
    dayOfWeek: s.dayOfWeek,
    startTime: s.startTime,
    roomId: s.roomId,
    teacherId: s.teacherId,
  }))

  return { scheduled: updatedClasses, unscheduledIds: unscheduled }
}

export async function isCPSATAvailable() {
  try {
    const res = await fetch(`${BACKEND_URL}/api/health`, { signal: AbortSignal.timeout(2000) })
    return res.ok
  } catch {
    return false
  }
}
