const BACKEND_URL = 'http://localhost:8000'

function mergeResults(classes, data) {
  const { scheduled, unscheduled, solverStatus, isOptimal, objectiveValue, bestBound, optimalityGapPct, wallTime } = data
  const classById = Object.fromEntries(classes.map((c) => [c.id, c]))
  const updatedClasses = (scheduled || []).map((s) => ({
    ...classById[s.id],
    dayOfWeek: s.dayOfWeek,
    startTime: s.startTime,
    roomId: s.roomId,
    teacherId: s.teacherId,
  }))
  return {
    scheduled: updatedClasses,
    unscheduledIds: unscheduled || [],
    solverInfo: { solverStatus, isOptimal, objectiveValue, bestBound, optimalityGapPct, wallTime },
  }
}

/**
 * Calls the CP-SAT backend to optimally schedule unscheduled classes.
 * onProgress(({ scheduled, total, elapsed })) is called each time CP-SAT finds
 * an improved solution. When provided, uses the streaming SSE endpoint.
 * Returns { scheduled: [...updatedClasses], unscheduledIds: [...ids] }
 * or throws if the backend is unreachable (caller should fall back to greedy).
 */
function makeSignal(fetchTimeout, externalSignal) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(new DOMException('Timeout', 'TimeoutError')), fetchTimeout)
  const cleanup = () => clearTimeout(timer)
  controller.signal.addEventListener('abort', cleanup, { once: true })
  if (externalSignal) {
    if (externalSignal.aborted) { controller.abort(externalSignal.reason); return controller.signal }
    externalSignal.addEventListener('abort', () => controller.abort(externalSignal.reason), { once: true })
  }
  return controller.signal
}

export async function optimizeWithCPSAT(classes, teachers, rooms, onProgress, timeoutSeconds = 120, externalSignal) {
  const fetchTimeout = timeoutSeconds === 0 ? 12 * 60 * 60 * 1000 : (timeoutSeconds + 300) * 1000  // 12h cap for "until optimal"; else 5-min buffer
  const body = JSON.stringify({ classes, teachers, rooms, timeoutSeconds })

  if (!onProgress) {
    const response = await fetch(`${BACKEND_URL}/api/optimize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      signal: makeSignal(fetchTimeout, externalSignal),
    })
    if (!response.ok) throw new Error(`CP-SAT backend error ${response.status}: ${await response.text()}`)
    return mergeResults(classes, await response.json())
  }

  // Streaming SSE path
  const response = await fetch(`${BACKEND_URL}/api/optimize/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
    signal: makeSignal(fetchTimeout, externalSignal),
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
        finalResult = mergeResults(classes, event.data)
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
