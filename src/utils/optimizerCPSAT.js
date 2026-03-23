const BACKEND_URL = 'http://localhost:8000'

function mergeResults(classes, scheduled, unscheduled) {
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

/**
 * Calls the CP-SAT backend to optimally schedule unscheduled classes.
 * onProgress(({ scheduled, total, elapsed })) is called each time CP-SAT finds
 * an improved solution. When provided, uses the streaming SSE endpoint.
 * Returns { scheduled: [...updatedClasses], unscheduledIds: [...ids] }
 * or throws if the backend is unreachable (caller should fall back to greedy).
 */
export async function optimizeWithCPSAT(classes, teachers, rooms, onProgress, timeoutSeconds = 120) {
  const fetchTimeout = (timeoutSeconds + 30) * 1000   // 30s buffer for enumeration + overhead
  const body = JSON.stringify({ classes, teachers, rooms, timeoutSeconds })

  if (!onProgress) {
    const response = await fetch(`${BACKEND_URL}/api/optimize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      signal: AbortSignal.timeout(fetchTimeout),
    })
    if (!response.ok) throw new Error(`CP-SAT backend error ${response.status}: ${await response.text()}`)
    const { scheduled, unscheduled } = await response.json()
    return mergeResults(classes, scheduled, unscheduled)
  }

  // Streaming SSE path
  const response = await fetch(`${BACKEND_URL}/api/optimize/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
    signal: AbortSignal.timeout(fetchTimeout),
  })
  if (!response.ok) throw new Error(`CP-SAT backend error ${response.status}: ${await response.text()}`)

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let finalResult = null
  let streamError = null

  while (true) {
    const { done, value } = await reader.read()
    if (value) buffer += decoder.decode(value, { stream: !done })
    const lines = buffer.split('\n')
    buffer = done ? '' : (lines.pop() ?? '')
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue
      const event = JSON.parse(line.slice(6))
      if (event.type === 'progress') {
        onProgress({ message: event.message, scheduled: event.scheduled, total: event.total, elapsed: event.elapsed })
      } else if (event.type === 'result') {
        finalResult = mergeResults(classes, event.data.scheduled, event.data.unscheduled)
      } else if (event.type === 'error') {
        streamError = new Error(event.message)
      }
    }
    if (done) break
  }
  reader.cancel().catch(() => {})
  if (streamError) throw streamError
  if (finalResult) return finalResult
  throw new Error('Stream ended without result')
}

export async function isCPSATAvailable() {
  try {
    const res = await fetch(`${BACKEND_URL}/api/health`, { signal: AbortSignal.timeout(2000) })
    return res.ok
  } catch {
    return false
  }
}
