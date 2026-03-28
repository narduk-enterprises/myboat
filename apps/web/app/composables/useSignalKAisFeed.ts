import type { Ref } from 'vue'
import type { AisContactSummary, VesselSnapshotSummary } from '~/types/myboat'

type SignalKSubscriptionPath = {
  path: string
  policy: 'instant'
}

type SignalKSubscriptionCommand = {
  context: string
  subscribe: SignalKSubscriptionPath[]
}

type SignalKDeltaValue = {
  path?: string
  value?: unknown
}

type SignalKDeltaUpdate = {
  timestamp?: string
  values?: SignalKDeltaValue[]
}

type SignalKDelta = {
  context?: string
  updates?: SignalKDeltaUpdate[]
}

type SignalKHelloMessage = {
  self?: string
}

const AIS_RECONNECT_DELAY_MS = 4_000
const AIS_STALE_TIMEOUT_MS = 15 * 60 * 1000
const AIS_STALE_SWEEP_MS = 60_000

const SIGNALK_AIS_SUBSCRIPTION_COMMAND: SignalKSubscriptionCommand = {
  context: 'vessels.*',
  subscribe: [
    { path: 'navigation.position', policy: 'instant' },
    { path: 'navigation.courseOverGroundTrue', policy: 'instant' },
    { path: 'navigation.speedOverGround', policy: 'instant' },
    { path: 'navigation.headingTrue', policy: 'instant' },
    { path: 'navigation.headingMagnetic', policy: 'instant' },
    { path: 'name', policy: 'instant' },
    { path: 'design.aisShipType', policy: 'instant' },
    { path: 'navigation.destination.commonName', policy: 'instant' },
    { path: 'communication.callsignVhf', policy: 'instant' },
    { path: 'design.length.overall', policy: 'instant' },
    { path: 'design.beam', policy: 'instant' },
    { path: 'design.draft.current', policy: 'instant' },
    { path: 'navigation.state', policy: 'instant' },
  ],
}

const SIGNALK_SELF_SUBSCRIPTION_PATHS: SignalKSubscriptionPath[] = [
  { path: 'navigation.position', policy: 'instant' },
  { path: 'navigation.position.latitude', policy: 'instant' },
  { path: 'navigation.position.longitude', policy: 'instant' },
  { path: 'navigation.headingMagnetic', policy: 'instant' },
  { path: 'navigation.speedOverGround', policy: 'instant' },
  { path: 'navigation.speedThroughWater', policy: 'instant' },
  { path: 'environment.wind.speedApparent', policy: 'instant' },
  { path: 'environment.wind.angleApparent', policy: 'instant' },
  { path: 'environment.depth.belowTransducer', policy: 'instant' },
  { path: 'environment.water.temperature', policy: 'instant' },
  { path: 'electrical.batteries.*.voltage', policy: 'instant' },
  { path: 'propulsion.*.revolutions', policy: 'instant' },
]

function createSelfSubscriptionCommand(context: string): SignalKSubscriptionCommand {
  return {
    context,
    subscribe: SIGNALK_SELF_SUBSCRIPTION_PATHS,
  }
}

function createEmptyAisContact(id: string): AisContactSummary {
  return {
    id,
    name: null,
    mmsi: extractMmsi(id),
    shipType: null,
    lat: null,
    lng: null,
    cog: null,
    sog: null,
    heading: null,
    destination: null,
    callSign: null,
    length: null,
    beam: null,
    draft: null,
    navState: null,
    lastUpdateAt: Date.now(),
  }
}

function createEmptySelfSnapshot(): VesselSnapshotSummary {
  return {
    observedAt: null,
    positionLat: null,
    positionLng: null,
    headingMagnetic: null,
    speedOverGround: null,
    speedThroughWater: null,
    windSpeedApparent: null,
    windAngleApparent: null,
    depthBelowTransducer: null,
    waterTemperatureKelvin: null,
    batteryVoltage: null,
    engineRpm: null,
    statusNote: null,
  }
}

function extractMmsi(contextId: string) {
  const match = contextId.match(/mmsi[:-]?(\d{6,})/i)
  return match?.[1] ?? null
}

function normalizeSelfContext(value: unknown) {
  if (typeof value !== 'string') {
    return null
  }

  const normalized = value.trim()
  return normalized || null
}

function asNumber(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  if (typeof value === 'string') {
    const numericValue = Number(value)
    return Number.isFinite(numericValue) ? numericValue : null
  }

  return null
}

function asText(value: unknown) {
  if (typeof value === 'string') {
    const normalized = value.trim()
    return normalized ? normalized : null
  }

  return null
}

function asDegrees(value: unknown) {
  const numericValue = asNumber(value)
  if (numericValue === null) {
    return null
  }

  return Math.abs(numericValue) > Math.PI * 2 ? numericValue : (numericValue * 180) / Math.PI
}

function asKnots(value: unknown) {
  const numericValue = asNumber(value)
  return numericValue === null ? null : numericValue * 1.94384
}

function extractNumberField(
  value: unknown,
  fields: string[],
): number | null {
  if (!value || typeof value !== 'object') {
    return asNumber(value)
  }

  let cursor: unknown = value
  for (const field of fields) {
    if (!cursor || typeof cursor !== 'object' || !(field in cursor)) {
      return null
    }
    cursor = (cursor as Record<string, unknown>)[field]
  }

  return asNumber(cursor)
}

function extractTextField(
  value: unknown,
  fields: string[],
): string | null {
  if (!value || typeof value !== 'object') {
    return asText(value)
  }

  let cursor: unknown = value
  for (const field of fields) {
    if (!cursor || typeof cursor !== 'object' || !(field in cursor)) {
      return null
    }
    cursor = (cursor as Record<string, unknown>)[field]
  }

  return asText(cursor)
}

async function decodeMessageData(data: string | ArrayBuffer | Blob) {
  if (typeof data === 'string') {
    return data
  }

  if (data instanceof ArrayBuffer) {
    return new TextDecoder().decode(data)
  }

  return await data.text()
}

function asIsoTimestamp(value: unknown) {
  if (typeof value !== 'string') {
    return null
  }

  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString()
}

function resolveSelfContextFromMessage(payload: unknown) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return null
  }

  const hello = payload as SignalKHelloMessage
  return normalizeSelfContext(hello.self)
}

export function useSignalKAisFeed(options: {
  enabled: Readonly<Ref<boolean>>
  urls: Readonly<Ref<string[]>>
}) {
  const contactsById = shallowRef<Map<string, AisContactSummary>>(new Map())
  const selfSnapshot = shallowRef<VesselSnapshotSummary | null>(null)
  const connectionState = shallowRef<'idle' | 'connecting' | 'connected' | 'error'>('idle')
  const activeUrl = shallowRef<string | null>(null)
  const lastDeltaAt = shallowRef<number | null>(null)
  const lastError = shallowRef<string | null>(null)

  const contacts = computed(() =>
    Array.from(contactsById.value.values()).sort(
      (left, right) => right.lastUpdateAt - left.lastUpdateAt,
    ),
  )

  let socket: WebSocket | null = null
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null
  let staleSweepTimer: ReturnType<typeof setInterval> | null = null
  let disposed = false
  let nextUrlIndex = 0
  let resolvedSelfContext: string | null = null
  let resolvedSelfMmsi: string | null = null
  let subscribedSelfContext: string | null = null

  function isSelfContext(context: string | null | undefined) {
    if (!context) {
      return false
    }

    if (context === 'vessels.self') {
      return true
    }

    if (resolvedSelfContext && context === resolvedSelfContext) {
      return true
    }

    return Boolean(resolvedSelfMmsi && context.includes(resolvedSelfMmsi))
  }

  function subscribeToResolvedSelfContext(target: WebSocket, context: string) {
    if (!context || context === 'vessels.self' || subscribedSelfContext === context) {
      return
    }

    target.send(JSON.stringify(createSelfSubscriptionCommand(context)))
    subscribedSelfContext = context
  }

  function updateResolvedSelfContext(target: WebSocket, context: string | null) {
    if (!context) {
      return
    }

    resolvedSelfContext = context
    resolvedSelfMmsi = extractMmsi(context)
    subscribeToResolvedSelfContext(target, context)
  }

  function clearReconnectTimer() {
    if (!reconnectTimer) return
    clearTimeout(reconnectTimer)
    reconnectTimer = null
  }

  function clearStaleSweepTimer() {
    if (!staleSweepTimer) return
    clearInterval(staleSweepTimer)
    staleSweepTimer = null
  }

  function pruneStaleContacts() {
    const now = Date.now()
    const next = new Map(contactsById.value)
    let removedAny = false

    for (const [id, contact] of next) {
      if (now - contact.lastUpdateAt > AIS_STALE_TIMEOUT_MS) {
        next.delete(id)
        removedAny = true
      }
    }

    if (removedAny) {
      contactsById.value = next
    }
  }

  function ensureStaleSweepTimer() {
    if (staleSweepTimer || !import.meta.client) return
    staleSweepTimer = setInterval(pruneStaleContacts, AIS_STALE_SWEEP_MS)
  }

  function resetFeedState() {
    contactsById.value = new Map()
    selfSnapshot.value = null
    lastDeltaAt.value = null
    lastError.value = null
    activeUrl.value = null
    nextUrlIndex = 0
    resolvedSelfContext = null
    resolvedSelfMmsi = null
    subscribedSelfContext = null
  }

  function disconnect() {
    clearReconnectTimer()

    if (socket) {
      const currentSocket = socket
      socket = null
      currentSocket.close()
    }
  }

  function scheduleReconnect() {
    clearReconnectTimer()

    if (
      disposed ||
      !import.meta.client ||
      !options.enabled.value ||
      options.urls.value.length === 0
    ) {
      connectionState.value = 'idle'
      activeUrl.value = null
      return
    }

    reconnectTimer = setTimeout(() => {
      reconnectTimer = null
      void connect()
    }, AIS_RECONNECT_DELAY_MS)
  }

  function updateContactFromDelta(delta: SignalKDelta) {
    const context = delta.context?.trim()
    if (!context || !context.startsWith('vessels.') || isSelfContext(context)) {
      return
    }

    const contactId = context.slice('vessels.'.length)
    if (!contactId) {
      return
    }

    const nextContacts = new Map(contactsById.value)
    const existing = nextContacts.get(contactId)
    const contact = existing ? { ...existing } : createEmptyAisContact(contactId)

    for (const update of delta.updates ?? []) {
      for (const entry of update.values ?? []) {
        const path = entry.path ?? ''

        switch (path) {
          case 'navigation.position': {
            const latitude = extractNumberField(entry.value, ['latitude'])
            const longitude = extractNumberField(entry.value, ['longitude'])

            if (latitude !== null && longitude !== null) {
              contact.lat = latitude
              contact.lng = longitude
            }
            break
          }
          case 'navigation.courseOverGroundTrue':
            contact.cog = asDegrees(entry.value)
            break
          case 'navigation.speedOverGround':
            contact.sog = asKnots(entry.value)
            break
          case 'navigation.headingTrue':
          case 'navigation.headingMagnetic':
            contact.heading = asDegrees(entry.value)
            break
          case 'name':
            contact.name = asText(entry.value)
            break
          case 'design.aisShipType':
            contact.shipType = extractNumberField(entry.value, ['id']) ?? asNumber(entry.value)
            break
          case 'navigation.destination.commonName':
            contact.destination = asText(entry.value)
            break
          case 'communication.callsignVhf':
            contact.callSign = asText(entry.value)
            break
          case 'design.length.overall':
            contact.length = asNumber(entry.value)
            break
          case 'design.beam':
            contact.beam = asNumber(entry.value)
            break
          case 'design.draft.current':
            contact.draft = asNumber(entry.value)
            break
          case 'navigation.state':
            contact.navState =
              asText(entry.value) ??
              extractTextField(entry.value, ['value']) ??
              extractTextField(entry.value, ['name']) ??
              extractTextField(entry.value, ['description'])
            break
        }
      }
    }

    contact.mmsi = contact.mmsi ?? extractMmsi(contactId)
    contact.lastUpdateAt = Date.now()
    nextContacts.set(contactId, contact)
    contactsById.value = nextContacts
    lastDeltaAt.value = contact.lastUpdateAt
  }

  function updateSelfSnapshotFromDelta(delta: SignalKDelta) {
    const context = delta.context?.trim()
    if (!isSelfContext(context)) {
      return
    }

    const nextSnapshot = {
      ...(selfSnapshot.value ?? createEmptySelfSnapshot()),
    }
    let observedAt = nextSnapshot.observedAt
    let sawValue = false

    for (const update of delta.updates ?? []) {
      observedAt = asIsoTimestamp(update.timestamp) ?? observedAt

      for (const entry of update.values ?? []) {
        sawValue = true

        const path = entry.path ?? ''

        switch (path) {
          case 'navigation.position': {
            const latitude = extractNumberField(entry.value, ['latitude'])
            const longitude = extractNumberField(entry.value, ['longitude'])

            if (latitude !== null) {
              nextSnapshot.positionLat = latitude
            }

            if (longitude !== null) {
              nextSnapshot.positionLng = longitude
            }
            break
          }
          case 'navigation.position.latitude': {
            const latitude = asNumber(entry.value)
            if (latitude !== null) {
              nextSnapshot.positionLat = latitude
            }
            break
          }
          case 'navigation.position.longitude': {
            const longitude = asNumber(entry.value)
            if (longitude !== null) {
              nextSnapshot.positionLng = longitude
            }
            break
          }
          case 'navigation.headingMagnetic': {
            const headingMagnetic = asDegrees(entry.value)
            if (headingMagnetic !== null) {
              nextSnapshot.headingMagnetic = headingMagnetic
            }
            break
          }
          case 'navigation.speedOverGround': {
            const speedOverGround = asNumber(entry.value)
            if (speedOverGround !== null) {
              nextSnapshot.speedOverGround = speedOverGround
            }
            break
          }
          case 'navigation.speedThroughWater': {
            const speedThroughWater = asNumber(entry.value)
            if (speedThroughWater !== null) {
              nextSnapshot.speedThroughWater = speedThroughWater
            }
            break
          }
          case 'environment.wind.speedApparent': {
            const windSpeedApparent = asNumber(entry.value)
            if (windSpeedApparent !== null) {
              nextSnapshot.windSpeedApparent = windSpeedApparent
            }
            break
          }
          case 'environment.wind.angleApparent': {
            const windAngleApparent = asDegrees(entry.value)
            if (windAngleApparent !== null) {
              nextSnapshot.windAngleApparent = windAngleApparent
            }
            break
          }
          case 'environment.depth.belowTransducer': {
            const depthBelowTransducer = asNumber(entry.value)
            if (depthBelowTransducer !== null) {
              nextSnapshot.depthBelowTransducer = depthBelowTransducer
            }
            break
          }
          case 'environment.water.temperature': {
            const waterTemperatureKelvin = asNumber(entry.value)
            if (waterTemperatureKelvin !== null) {
              nextSnapshot.waterTemperatureKelvin = waterTemperatureKelvin
            }
            break
          }
          default: {
            if (path.startsWith('electrical.batteries.') && path.endsWith('.voltage')) {
              const batteryVoltage = asNumber(entry.value)
              if (batteryVoltage !== null) {
                nextSnapshot.batteryVoltage = batteryVoltage
              }
              break
            }

            if (path.startsWith('propulsion.') && path.endsWith('.revolutions')) {
              const revolutionsPerSecond = asNumber(entry.value)
              if (revolutionsPerSecond !== null) {
                nextSnapshot.engineRpm = revolutionsPerSecond * 60
              }
            }
          }
        }
      }
    }

    if (!sawValue) {
      return
    }

    nextSnapshot.observedAt = observedAt ?? new Date().toISOString()
    nextSnapshot.statusNote = 'Live Tideye Signal K telemetry'
    selfSnapshot.value = nextSnapshot
    lastDeltaAt.value = Date.now()
  }

  function applyPayload(payload: unknown) {
    if (Array.isArray(payload)) {
      for (const item of payload) {
        applyPayload(item)
      }
      return
    }

    if (!payload || typeof payload !== 'object') {
      return
    }

    const delta = payload as SignalKDelta
    if (!delta.context || !Array.isArray(delta.updates)) {
      return
    }

    updateContactFromDelta(delta)
    updateSelfSnapshotFromDelta(delta)
  }

  async function handleMessage(data: string | ArrayBuffer | Blob, target: WebSocket) {
    try {
      const raw = await decodeMessageData(data)
      const payload = JSON.parse(raw) as unknown
      updateResolvedSelfContext(target, resolveSelfContextFromMessage(payload))
      applyPayload(payload)
    } catch {
      // Ignore non-delta frames and malformed payloads from upstreams we do not control.
    }
  }

  function sendSubscriptions(target: WebSocket) {
    for (const command of [
      SIGNALK_AIS_SUBSCRIPTION_COMMAND,
      createSelfSubscriptionCommand('vessels.self'),
    ]) {
      target.send(JSON.stringify(command))
    }

    if (resolvedSelfContext) {
      subscribeToResolvedSelfContext(target, resolvedSelfContext)
    }
  }

  async function connect() {
    if (!import.meta.client) {
      return
    }

    const candidateUrls = options.urls.value
    if (!options.enabled.value || candidateUrls.length === 0) {
      disconnect()
      resetFeedState()
      connectionState.value = 'idle'
      return
    }

    clearReconnectTimer()
    disconnect()
    ensureStaleSweepTimer()

    const resolvedIndex = nextUrlIndex % candidateUrls.length
    const nextUrl = candidateUrls[resolvedIndex]!
    connectionState.value = 'connecting'
    activeUrl.value = nextUrl
    lastError.value = null

    const nextSocket = new WebSocket(nextUrl)
    socket = nextSocket

    nextSocket.addEventListener('open', () => {
      if (socket !== nextSocket) {
        nextSocket.close()
        return
      }

      connectionState.value = 'connected'
      lastError.value = null
      nextUrlIndex = resolvedIndex
      sendSubscriptions(nextSocket)
    })

    nextSocket.addEventListener('message', (event) => {
      if (socket !== nextSocket) {
        return
      }

      void handleMessage(event.data, nextSocket)
    })

    nextSocket.addEventListener('error', () => {
      if (socket !== nextSocket) {
        return
      }

      connectionState.value = 'error'
      lastError.value = 'Signal K feed unavailable'
    })

    nextSocket.addEventListener('close', () => {
      if (socket !== nextSocket) {
        return
      }

      socket = null

      if (disposed || !options.enabled.value) {
        connectionState.value = 'idle'
        activeUrl.value = null
        return
      }

      connectionState.value = 'error'
      lastError.value = lastError.value || 'Signal K feed disconnected'
      nextUrlIndex = candidateUrls.length > 1 ? (resolvedIndex + 1) % candidateUrls.length : 0
      scheduleReconnect()
    })
  }

  watch(
    [options.enabled, options.urls],
    ([enabled, urls], [previousEnabled, previousUrls]) => {
      const urlsChanged = JSON.stringify(urls) !== JSON.stringify(previousUrls)

      if (!enabled) {
        disconnect()
        resetFeedState()
        clearStaleSweepTimer()
        connectionState.value = 'idle'
        return
      }

      if (!urls.length) {
        disconnect()
        resetFeedState()
        connectionState.value = 'error'
        lastError.value = 'No Signal K endpoint available'
        return
      }

      if (!previousEnabled || urlsChanged) {
        nextUrlIndex = 0
        void connect()
      }
    },
    { immediate: true },
  )

  onScopeDispose(() => {
    disposed = true
    clearReconnectTimer()
    clearStaleSweepTimer()
    disconnect()
  })

  return {
    contacts,
    selfSnapshot: readonly(selfSnapshot),
    connectionState: readonly(connectionState),
    activeUrl: readonly(activeUrl),
    lastDeltaAt: readonly(lastDeltaAt),
    lastError: readonly(lastError),
  }
}
