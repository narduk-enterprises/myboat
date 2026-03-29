import process from 'node:process'
import { createServer } from 'node:http'
import { WebSocketServer, type WebSocket as ServerWebSocket } from 'ws'

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

type ObservedIdentityPayload = {
  timestamp: string
  source: 'signalk_rest'
  selfContext?: string
  mmsi?: string
  observedName?: string
  callSign?: string
  shipType?: string
  shipTypeCode?: number
  lengthOverall?: number
  beam?: number
  draft?: number
  registrationNumber?: string
  imo?: string
}

type CollectorConfig = {
  signalkWsUrl: string
  signalkHttpUrl: string
  ingestUrl: string
  identityIngestUrl: string
  ingestKey: string
  streamPort: number
  streamPath: string
  batchSize: number
  flushIntervalMs: number
  identityRefreshIntervalMs: number
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
let identityRefreshTimer: ReturnType<typeof setTimeout> | null = null
let isFlushing = false
let isRefreshingIdentity = false
let hasLoggedServerHello = false
let isShuttingDown = false
let batch: BatchItem[] = []
let lastPostStartedAt = 0
let nextPostNotBefore = 0
let lastPublishedAt: string | null = null
let lastPublishedDeltaRaw: string | null = null
let signalkSelfContext: string | null = null

const liveClients = new Set<ServerWebSocket>()

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

function deriveSignalKHttpUrl(rawWsUrl: string) {
  const url = new URL(rawWsUrl)
  url.protocol = url.protocol === 'wss:' ? 'https:' : 'http:'
  url.search = ''
  url.pathname = url.pathname.replace(/\/stream$/, '/api')
  return url.toString()
}

function withTrailingSlash(rawUrl: string) {
  return rawUrl.endsWith('/') ? rawUrl : `${rawUrl}/`
}

function deriveIdentityIngestUrl(rawDeltaUrl: string) {
  const url = new URL(rawDeltaUrl)
  if (url.pathname.endsWith('/delta')) {
    url.pathname = `${url.pathname.slice(0, -'/delta'.length)}/identity`
    return url.toString()
  }

  url.pathname = `${url.pathname.replace(/\/+$/g, '')}/identity`
  return url.toString()
}

function normalizeStreamPath(rawPath: string | null | undefined) {
  const normalizedPath = rawPath?.trim()

  if (!normalizedPath) {
    return '/myboat/v1/stream'
  }

  return normalizedPath.startsWith('/') ? normalizedPath : `/${normalizedPath}`
}

function loadConfig(): CollectorConfig {
  const signalkWsUrl = withDefaultSignalKSubscription(
    process.env.SIGNALK_WS_URL?.trim() || 'ws://localhost:3000/signalk/v1/stream',
  )
  const signalkHttpUrl = process.env.SIGNALK_HTTP_URL?.trim() || deriveSignalKHttpUrl(signalkWsUrl)
  const ingestUrl = process.env.MYBOAT_INGEST_URL?.trim() || 'https://mybo.at/api/ingest/v1/delta'
  const identityIngestUrl =
    process.env.MYBOAT_IDENTITY_INGEST_URL?.trim() || deriveIdentityIngestUrl(ingestUrl)
  const ingestKey = process.env.MYBOAT_INGEST_KEY?.trim()

  if (!ingestKey) {
    throw new Error('MYBOAT_INGEST_KEY is required.')
  }

  return {
    signalkWsUrl,
    signalkHttpUrl,
    ingestUrl,
    identityIngestUrl,
    ingestKey,
    streamPort: parsePositiveInteger('MYBOAT_STREAM_PORT', 4011),
    streamPath: normalizeStreamPath(process.env.MYBOAT_STREAM_PATH),
    // Larger batches + spacing keep ingest POSTs well under authApiKeys (60/min).
    batchSize: parsePositiveInteger('COLLECTOR_BATCH_SIZE', 100),
    flushIntervalMs: parsePositiveInteger('COLLECTOR_FLUSH_INTERVAL_MS', 3000),
    identityRefreshIntervalMs: parsePositiveInteger(
      'COLLECTOR_IDENTITY_REFRESH_INTERVAL_MS',
      15 * 60 * 1000,
    ),
    minPostIntervalMs: parsePositiveInteger('COLLECTOR_MIN_POST_INTERVAL_MS', 2000),
    rateLimitBackoffMs: parsePositiveInteger('COLLECTOR_429_BACKOFF_MS', 10_000),
    reconnectDelayMs: parsePositiveInteger('COLLECTOR_RECONNECT_DELAY_MS', 5000),
    requestTimeoutMs: parsePositiveInteger('COLLECTOR_REQUEST_TIMEOUT_MS', 15000),
    userAgent: process.env.COLLECTOR_USER_AGENT?.trim() || 'myboat-edge-collector/0.1.0',
    xRequestedWith: process.env.MYBOAT_X_REQUESTED_WITH?.trim() || 'XMLHttpRequest',
  }
}

const config = loadConfig()
const streamServer = createServer((request, response) => {
  const host = request.headers.host || 'localhost'
  const url = new URL(request.url || '/', `http://${host}`)

  if (url.pathname === '/healthz') {
    response.writeHead(200, { 'content-type': 'application/json' })
    response.end(
      JSON.stringify({
        ok: true,
        connectedClients: liveClients.size,
        identityIngestUrl: config.identityIngestUrl,
        ingestUrl: config.ingestUrl,
        lastPublishedAt,
        signalkHttpUrl: config.signalkHttpUrl,
        signalkWsUrl: config.signalkWsUrl,
        streamPath: config.streamPath,
        streamPort: config.streamPort,
      }),
    )
    return
  }

  response.writeHead(404, { 'content-type': 'application/json' })
  response.end(JSON.stringify({ ok: false }))
})
const streamSocketServer = new WebSocketServer({ noServer: true })

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

function broadcastToLiveClients(message: string) {
  lastPublishedAt = new Date().toISOString()
  lastPublishedDeltaRaw = message

  for (const client of liveClients) {
    if (client.readyState !== client.OPEN) {
      liveClients.delete(client)
      continue
    }

    client.send(message)
  }
}

function maybeUpdateSignalKSelfContext(nextSelf: unknown) {
  if (typeof nextSelf !== 'string') {
    return
  }

  const normalized = nextSelf.trim()
  if (!normalized || normalized === signalkSelfContext) {
    return
  }

  signalkSelfContext = normalized
  void refreshObservedIdentity('self-context-update')

  const hello = buildCollectorHelloMessage()
  for (const client of liveClients) {
    if (client.readyState !== client.OPEN) {
      liveClients.delete(client)
      continue
    }

    client.send(hello)
  }
}

function normalizeDeltaForIngest(delta: SignalKDeltaMessage): SignalKDeltaMessage {
  const self =
    typeof delta.self === 'string' && delta.self.trim() ? delta.self.trim() : signalkSelfContext

  if (!self) {
    return delta
  }

  return {
    ...delta,
    self,
  }
}

function buildCollectorHelloMessage() {
  return JSON.stringify({
    name: 'myboat-edge-collector',
    self: signalkSelfContext || 'vessels.self',
    version: '0.1.0',
  })
}

function startMyBoatStreamServer() {
  streamSocketServer.on('connection', (client: ServerWebSocket) => {
    liveClients.add(client)
    client.send(buildCollectorHelloMessage())

    if (lastPublishedDeltaRaw) {
      client.send(lastPublishedDeltaRaw)
    }

    client.on('close', () => {
      liveClients.delete(client)
    })

    client.on('error', (error: Error) => {
      warn('MyBoat stream client error', error instanceof Error ? error.message : error)
      liveClients.delete(client)
    })
  })

  streamServer.on('upgrade', (request, socketHandle, head) => {
    const host = request.headers.host || 'localhost'
    const url = new URL(request.url || '/', `http://${host}`)

    if (url.pathname !== config.streamPath) {
      socketHandle.write('HTTP/1.1 404 Not Found\r\nConnection: close\r\n\r\n')
      socketHandle.destroy()
      return
    }

    streamSocketServer.handleUpgrade(request, socketHandle, head, (client: ServerWebSocket) => {
      streamSocketServer.emit('connection', client, request)
    })
  })

  streamServer.listen(config.streamPort, () => {
    log('Publishing MyBoat stream', `ws://0.0.0.0:${config.streamPort}${config.streamPath}`)
  })
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

function clearIdentityRefreshTimer() {
  if (identityRefreshTimer) {
    clearTimeout(identityRefreshTimer)
    identityRefreshTimer = null
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

function scheduleIdentityRefresh(delayMs = config.identityRefreshIntervalMs) {
  if (isShuttingDown || identityRefreshTimer) {
    return
  }

  identityRefreshTimer = setTimeout(() => {
    identityRefreshTimer = null
    void refreshObservedIdentity('scheduled-refresh')
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

function normalizeTrimmedString(value: unknown, maxLength: number) {
  if (typeof value === 'string') {
    const normalized = value.trim()
    return normalized ? normalized.slice(0, maxLength) : undefined
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value).slice(0, maxLength)
  }

  return undefined
}

function normalizeFiniteNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function normalizeMmsi(value: unknown) {
  const normalized = normalizeTrimmedString(value, 32)
  if (!normalized) {
    return undefined
  }

  const match = normalized.match(/\b(\d{9})\b/)
  return match?.[1]
}

function unwrapSignalKValue(value: unknown): unknown {
  if (
    value &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    'value' in value &&
    Object.keys(value).length <= 6
  ) {
    return (value as { value?: unknown }).value
  }

  return value
}

function readSignalKPathValue(model: unknown, path: string): unknown {
  const segments = path.split('.')
  let current = model

  for (const segment of segments) {
    if (!current || typeof current !== 'object' || Array.isArray(current)) {
      return undefined
    }

    current = (current as Record<string, unknown>)[segment]
  }

  return unwrapSignalKValue(current)
}

function looksLikeSignalKVesselModel(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false
  }

  const candidate = value as Record<string, unknown>
  return ['name', 'navigation', 'communication', 'design', 'registrations'].some(
    (key) => key in candidate,
  )
}

function unwrapSignalKVesselModel(model: unknown) {
  if (looksLikeSignalKVesselModel(model)) {
    return model
  }

  if (!model || typeof model !== 'object' || Array.isArray(model)) {
    return null
  }

  const values = Object.values(model as Record<string, unknown>)
  if (values.length === 1 && looksLikeSignalKVesselModel(values[0])) {
    return values[0]
  }

  return null
}

function extractMmsiFromContext(context: string | null) {
  const normalized = context?.trim() || ''
  if (!normalized) {
    return undefined
  }

  const match = normalized.match(/mmsi:(\d{9})/i)
  return match?.[1]
}

function buildObservedIdentityPayload(model: unknown): ObservedIdentityPayload | null {
  const vesselModel = unwrapSignalKVesselModel(model)
  if (!vesselModel) {
    return null
  }

  const payload: ObservedIdentityPayload = {
    timestamp: new Date().toISOString(),
    source: 'signalk_rest',
  }

  if (signalkSelfContext) {
    payload.selfContext = signalkSelfContext
    payload.mmsi = extractMmsiFromContext(signalkSelfContext)
  }

  payload.observedName = normalizeTrimmedString(readSignalKPathValue(vesselModel, 'name'), 120)
  payload.callSign = normalizeTrimmedString(
    readSignalKPathValue(vesselModel, 'communication.callsignVhf') ??
      readSignalKPathValue(vesselModel, 'communication.callsign'),
    40,
  )
  payload.shipType = normalizeTrimmedString(readSignalKPathValue(vesselModel, 'design.type'), 120)
  payload.shipTypeCode = normalizeFiniteNumber(
    readSignalKPathValue(vesselModel, 'design.aisShipType'),
  )
  payload.lengthOverall = normalizeFiniteNumber(
    readSignalKPathValue(vesselModel, 'design.length.overall'),
  )
  payload.beam = normalizeFiniteNumber(readSignalKPathValue(vesselModel, 'design.beam'))
  payload.draft =
    normalizeFiniteNumber(readSignalKPathValue(vesselModel, 'design.draft.current')) ??
    normalizeFiniteNumber(readSignalKPathValue(vesselModel, 'design.draft.maximum'))
  payload.registrationNumber = normalizeTrimmedString(
    readSignalKPathValue(vesselModel, 'registrations.national') ??
      readSignalKPathValue(vesselModel, 'registrations.other') ??
      readSignalKPathValue(vesselModel, 'registrations.registration'),
    80,
  )
  payload.imo = normalizeTrimmedString(readSignalKPathValue(vesselModel, 'registrations.imo'), 32)
  payload.mmsi =
    payload.mmsi ??
    normalizeMmsi(readSignalKPathValue(vesselModel, 'registrations.mmsi')) ??
    normalizeMmsi(readSignalKPathValue(vesselModel, 'mmsi'))

  const hasData = Object.entries(payload).some(
    ([key, value]) => key !== 'timestamp' && key !== 'source' && value !== undefined,
  )
  return hasData ? payload : null
}

async function fetchSignalKObservedIdentity() {
  const url = new URL('vessels/self', withTrailingSlash(config.signalkHttpUrl))
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      'User-Agent': config.userAgent,
      'X-Requested-With': config.xRequestedWith,
    },
    signal: AbortSignal.timeout(config.requestTimeoutMs),
  })

  if (!response.ok) {
    throw new Error(`SignalK identity fetch failed: ${response.status}`)
  }

  return buildObservedIdentityPayload(await response.json())
}

async function postObservedIdentity(payload: ObservedIdentityPayload) {
  const response = await fetch(config.identityIngestUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.ingestKey}`,
      'Content-Type': 'application/json',
      'User-Agent': config.userAgent,
      'X-Requested-With': config.xRequestedWith,
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(config.requestTimeoutMs),
  })

  const bodyText = await response.text()
  if (!response.ok) {
    throw new Error(`Identity ingest failed: ${response.status} ${bodyText}`.trim())
  }
}

async function refreshObservedIdentity(reason: string) {
  if (isRefreshingIdentity || isShuttingDown) {
    return
  }

  isRefreshingIdentity = true
  clearIdentityRefreshTimer()

  try {
    const payload = await fetchSignalKObservedIdentity()
    if (!payload) {
      log('No observed vessel identity found in SignalK self model', reason)
      return
    }

    await postObservedIdentity(payload)
    log('Forwarded observed vessel identity to MyBoat', {
      reason,
      mmsi: payload.mmsi,
      selfContext: payload.selfContext,
    })
  } catch (error) {
    warn(
      'Failed to refresh observed vessel identity',
      error instanceof Error ? error.message : error,
    )
  } finally {
    isRefreshingIdentity = false
    scheduleIdentityRefresh()
  }
}

function connect() {
  clearReconnectTimer()
  hasLoggedServerHello = false
  log(`Connecting to SignalK`, config.signalkWsUrl)

  socket = new WebSocket(config.signalkWsUrl)

  socket.addEventListener('open', () => {
    log('Connected to SignalK')
    void refreshObservedIdentity('socket-open')
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
      broadcastToLiveClients(raw)
      enqueueDelta(parsed)
      return
    }

    if (!hasLoggedServerHello && parsed && typeof parsed === 'object') {
      const hello = parsed as { name?: unknown; version?: unknown; self?: unknown }
      hasLoggedServerHello = true
      maybeUpdateSignalKSelfContext(hello.self)
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
    delta: normalizeDeltaForIngest(delta),
  })

  scheduleFlush()
}

function mergeBatchItems(items: BatchItem[]) {
  const latestTimestamp = items[items.length - 1]?.timestamp || new Date().toISOString()

  return {
    timestamp: latestTimestamp,
    deltas: Array.from(
      items
        .reduce<
          Map<
            string,
            {
              timestamp: string
              delta: SignalKDeltaMessage
            }
          >
        >((groups, item) => {
          const context = item.delta.context?.trim() || ''
          const self = item.delta.self?.trim() || ''
          const groupKey = `${context}\u0000${self}`
          const currentGroup = groups.get(groupKey)

          if (!currentGroup) {
            groups.set(groupKey, {
              timestamp: item.timestamp,
              delta: {
                ...(item.delta.context ? { context: item.delta.context } : {}),
                ...(item.delta.self ? { self: item.delta.self } : {}),
                updates: [...item.delta.updates],
              },
            })
            return groups
          }

          currentGroup.timestamp = item.timestamp
          currentGroup.delta.updates.push(...item.delta.updates)
          return groups
        }, new Map())
        .values(),
    ),
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
      deltas: payload.deltas,
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
  clearIdentityRefreshTimer()

  if (socket && socket.readyState < WebSocket.CLOSING) {
    socket.close(1000, 'shutdown')
  }

  for (const client of liveClients) {
    if (client.readyState < client.CLOSING) {
      client.close(1000, 'shutdown')
    }
  }

  await new Promise<void>((resolve) => {
    streamSocketServer.close(() => resolve())
  })

  await new Promise<void>((resolve) => {
    streamServer.close(() => resolve())
  })

  await flushBatch()
}

process.on('SIGINT', () => {
  void shutdown('SIGINT').finally(() => process.exit(0))
})

process.on('SIGTERM', () => {
  void shutdown('SIGTERM').finally(() => process.exit(0))
})

startMyBoatStreamServer()
connect()
