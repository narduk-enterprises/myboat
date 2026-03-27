import process from 'node:process'

type SignalKValue = {
  path: string
  value: unknown
}

type SignalKUpdate = {
  timestamp?: string
  values: SignalKValue[]
}

type SignalKDeltaMessage = {
  context?: string
  updates: SignalKUpdate[]
  self?: string
}

type BatchItem = {
  timestamp: string
  delta: SignalKDeltaMessage
}

type CollectorConfig = {
  signalkWsUrl: string
  ingestUrl: string
  ingestKey: string
  batchSize: number
  flushIntervalMs: number
  minPostIntervalMs: number
  rateLimitBackoffMs: number
  reconnectDelayMs: number
  requestTimeoutMs: number
  userAgent: string
  xRequestedWith: string
}

let socket: WebSocket | null = null
let reconnectTimer: ReturnType<typeof setTimeout> | null = null
let flushTimer: ReturnType<typeof setTimeout> | null = null
let isFlushing = false
let hasLoggedServerHello = false
let isShuttingDown = false
let batch: BatchItem[] = []
let lastPostStartedAt = 0
let nextPostNotBefore = 0

class IngestHttpError extends Error {
  readonly status: number
  readonly retryAfterMs?: number

  constructor(message: string, status: number, retryAfterMs?: number) {
    super(message)
    this.name = 'IngestHttpError'
    this.status = status
    this.retryAfterMs = retryAfterMs
  }
}

function parsePositiveInteger(name: string, fallback: number) {
  const raw = process.env[name]?.trim()
  if (!raw) return fallback

  const parsed = Number.parseInt(raw, 10)
  if (Number.isFinite(parsed) && parsed > 0) {
    return parsed
  }

  throw new Error(`${name} must be a positive integer.`)
}

function withDefaultSignalKSubscription(rawUrl: string) {
  const url = new URL(rawUrl)
  if (!url.searchParams.has('subscribe')) {
    url.searchParams.set('subscribe', 'all')
  }
  return url.toString()
}

function loadConfig(): CollectorConfig {
  const signalkWsUrl = withDefaultSignalKSubscription(
    process.env.SIGNALK_WS_URL?.trim() || 'ws://localhost:3000/signalk/v1/stream',
  )
  const ingestUrl = process.env.MYBOAT_INGEST_URL?.trim() || 'https://mybo.at/api/ingest/v1/delta'
  const ingestKey = process.env.MYBOAT_INGEST_KEY?.trim()

  if (!ingestKey) {
    throw new Error('MYBOAT_INGEST_KEY is required.')
  }

  return {
    signalkWsUrl,
    ingestUrl,
    ingestKey,
    // Larger batches + spacing keep ingest POSTs well under authApiKeys (60/min).
    batchSize: parsePositiveInteger('COLLECTOR_BATCH_SIZE', 100),
    flushIntervalMs: parsePositiveInteger('COLLECTOR_FLUSH_INTERVAL_MS', 3000),
    minPostIntervalMs: parsePositiveInteger('COLLECTOR_MIN_POST_INTERVAL_MS', 2000),
    rateLimitBackoffMs: parsePositiveInteger('COLLECTOR_429_BACKOFF_MS', 10_000),
    reconnectDelayMs: parsePositiveInteger('COLLECTOR_RECONNECT_DELAY_MS', 5000),
    requestTimeoutMs: parsePositiveInteger('COLLECTOR_REQUEST_TIMEOUT_MS', 15000),
    userAgent: process.env.COLLECTOR_USER_AGENT?.trim() || 'myboat-edge-collector/0.1.0',
    xRequestedWith: process.env.MYBOAT_X_REQUESTED_WITH?.trim() || 'XMLHttpRequest',
  }
}

const config = loadConfig()

function log(message: string, detail?: unknown) {
  const prefix = `[edge-collector ${new Date().toISOString()}]`
  if (detail === undefined) {
    console.log(prefix, message)
    return
  }

  console.log(prefix, message, detail)
}

function warn(message: string, detail?: unknown) {
  const prefix = `[edge-collector ${new Date().toISOString()}]`
  if (detail === undefined) {
    console.warn(prefix, message)
    return
  }

  console.warn(prefix, message, detail)
}

function isSignalKDeltaMessage(value: unknown): value is SignalKDeltaMessage {
  if (!value || typeof value !== 'object') return false

  const candidate = value as { updates?: unknown }
  if (!Array.isArray(candidate.updates)) return false

  return candidate.updates.every((update) => {
    if (!update || typeof update !== 'object') return false
    const typedUpdate = update as { values?: unknown }
    if (!Array.isArray(typedUpdate.values)) return false

    return typedUpdate.values.every((item) => {
      if (!item || typeof item !== 'object') return false
      const typedItem = item as { path?: unknown }
      return typeof typedItem.path === 'string'
    })
  })
}

function clearReconnectTimer() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer)
    reconnectTimer = null
  }
}

function clearFlushTimer() {
  if (flushTimer) {
    clearTimeout(flushTimer)
    flushTimer = null
  }
}

function scheduleReconnect(reason: string) {
  if (isShuttingDown || reconnectTimer) return

  warn(`SignalK websocket disconnected; reconnecting in ${config.reconnectDelayMs}ms`, reason)
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null
    connect()
  }, config.reconnectDelayMs)
}

function scheduleFlush(delayMs = config.flushIntervalMs) {
  if (flushTimer) return

  flushTimer = setTimeout(() => {
    flushTimer = null
    void flushBatch()
  }, delayMs)
}

function parseRetryAfterMs(header: string | null): number | undefined {
  if (!header) return undefined

  const asSeconds = Number.parseInt(header, 10)
  if (Number.isFinite(asSeconds) && asSeconds >= 0) {
    return asSeconds * 1000
  }

  const asDate = Date.parse(header)
  if (Number.isFinite(asDate)) {
    return Math.max(0, asDate - Date.now())
  }

  return undefined
}

function msUntilMinPostInterval(): number {
  if (!lastPostStartedAt) return 0

  const elapsed = Date.now() - lastPostStartedAt
  return Math.max(0, config.minPostIntervalMs - elapsed)
}

function msUntilPostAllowed(): number {
  return Math.max(msUntilMinPostInterval(), Math.max(0, nextPostNotBefore - Date.now()))
}

function connect() {
  clearReconnectTimer()
  log(`Connecting to SignalK`, config.signalkWsUrl)

  socket = new WebSocket(config.signalkWsUrl)

  socket.addEventListener('open', () => {
    log('Connected to SignalK')
  })

  socket.addEventListener('message', (event) => {
    void handleSocketMessage(event.data)
  })

  socket.addEventListener('error', (event) => {
    warn('SignalK websocket error', event.type)
  })

  socket.addEventListener('close', (event) => {
    socket = null
    if (isShuttingDown) {
      log(`SignalK websocket closed`, `${event.code} ${event.reason || ''}`.trim())
      return
    }

    scheduleReconnect(`${event.code} ${event.reason || ''}`.trim())
  })
}

async function handleSocketMessage(data: unknown) {
  const raw = typeof data === 'string' ? data : String(data)

  try {
    const parsed = JSON.parse(raw) as unknown

    if (isSignalKDeltaMessage(parsed)) {
      enqueueDelta(parsed)
      return
    }

    if (!hasLoggedServerHello && parsed && typeof parsed === 'object') {
      const hello = parsed as { name?: unknown; version?: unknown; self?: unknown }
      hasLoggedServerHello = true
      log('Received non-delta SignalK message', {
        name: typeof hello.name === 'string' ? hello.name : undefined,
        version: typeof hello.version === 'string' ? hello.version : undefined,
        self: typeof hello.self === 'string' ? hello.self : undefined,
      })
    }
  } catch (error) {
    warn('Failed to parse SignalK message', error instanceof Error ? error.message : error)
  }
}

function enqueueDelta(delta: SignalKDeltaMessage) {
  batch.push({
    timestamp: new Date().toISOString(),
    delta,
  })

  scheduleFlush()
}

function mergeBatchItems(items: BatchItem[]) {
  const latestTimestamp = items[items.length - 1]?.timestamp || new Date().toISOString()
  const context = items.find((item) => item.delta.context)?.delta.context

  return {
    timestamp: latestTimestamp,
    delta: {
      ...(context ? { context } : {}),
      updates: items.flatMap((item) => item.delta.updates),
    },
  }
}

async function postDeltaBatch(items: BatchItem[]) {
  const payload = mergeBatchItems(items)
  const response = await fetch(config.ingestUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.ingestKey}`,
      'Content-Type': 'application/json',
      'User-Agent': config.userAgent,
      'X-Requested-With': config.xRequestedWith,
    },
    body: JSON.stringify({
      timestamp: payload.timestamp,
      delta: payload.delta,
    }),
    signal: AbortSignal.timeout(config.requestTimeoutMs),
  })

  const bodyText = await response.text()

  if (response.status === 429) {
    const retryAfterMs = parseRetryAfterMs(response.headers.get('retry-after'))
    throw new IngestHttpError(`429 ${bodyText}`.trim(), 429, retryAfterMs)
  }

  if (!response.ok) {
    throw new Error(`${response.status} ${bodyText}`)
  }
}

async function flushBatch() {
  if (isFlushing || batch.length === 0) {
    return
  }

  const throttleMs = msUntilPostAllowed()
  if (throttleMs > 0) {
    scheduleFlush(throttleMs)
    return
  }

  isFlushing = true
  clearFlushTimer()

  const pending = batch
  batch = []

  try {
    lastPostStartedAt = Date.now()
    await postDeltaBatch(pending)
    nextPostNotBefore = 0
    log(`Forwarded ${pending.length} SignalK delta message(s) to MyBoat in one ingest request`)
  } catch (error) {
    batch = [...pending, ...batch]

    if (error instanceof IngestHttpError && error.status === 429) {
      const fromHeader = error.retryAfterMs
      const backoffMs = Math.max(fromHeader ?? 0, config.rateLimitBackoffMs)
      nextPostNotBefore = Date.now() + backoffMs
      warn(
        `Ingest rate limited (429); backing off before retry`,
        `${backoffMs}ms${fromHeader !== undefined ? ' (includes Retry-After)' : ''}`,
      )
      scheduleFlush(backoffMs)
    } else {
      warn('Failed to ingest SignalK delta batch', error instanceof Error ? error.message : error)
      scheduleFlush(config.reconnectDelayMs)
    }
  } finally {
    isFlushing = false

    if (batch.length > 0 && !flushTimer) {
      scheduleFlush()
    }
  }
}

async function shutdown(signal: string) {
  if (isShuttingDown) return
  isShuttingDown = true

  log(`Shutting down after ${signal}`)
  clearReconnectTimer()
  clearFlushTimer()

  if (socket && socket.readyState < WebSocket.CLOSING) {
    socket.close(1000, 'shutdown')
  }

  await flushBatch()
}

process.on('SIGINT', () => {
  void shutdown('SIGINT').finally(() => process.exit(0))
})

process.on('SIGTERM', () => {
  void shutdown('SIGTERM').finally(() => process.exit(0))
})

connect()
