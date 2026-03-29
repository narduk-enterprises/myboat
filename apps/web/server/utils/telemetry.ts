import type { AisContactSummary, VesselSnapshotSummary } from '../../app/types/myboat'
import type { VesselLivePublishMessage } from '../../shared/myboatLive'

export const TELEMETRY_SELF_CONTEXTS = new Set(['vessels.self', 'self', ''])

function escapeInfluxKey(value: string) {
  return value.replaceAll(/([, =])/g, '\\$1')
}

function escapeInfluxString(value: string) {
  return value.replaceAll('\\', '\\\\').replaceAll('"', '\\"')
}

function encodeInfluxLine(input: {
  measurement: string
  tags?: Record<string, string | null | undefined>
  fields: Record<string, boolean | number | string>
  timestampMs: number
}) {
  const tags = Object.entries(input.tags || {})
    .filter(([, value]) => typeof value === 'string' && value.length > 0)
    .map(([key, value]) => `,${escapeInfluxKey(key)}=${escapeInfluxKey(value!)}`)
    .join('')

  const fields = Object.entries(input.fields)
    .map(([key, value]) => {
      if (typeof value === 'number') {
        return `${escapeInfluxKey(key)}=${Number.isFinite(value) ? value : 0}`
      }

      if (typeof value === 'boolean') {
        return `${escapeInfluxKey(key)}=${value ? 'true' : 'false'}`
      }

      return `${escapeInfluxKey(key)}="${escapeInfluxString(value)}"`
    })
    .join(',')

  return `${escapeInfluxKey(input.measurement)}${tags} ${fields} ${input.timestampMs}`
}

export type IngestDeltaValue = {
  path: string
  value: unknown
}

export type IngestDeltaUpdate = {
  timestamp?: string
  values: IngestDeltaValue[]
}

export type IngestDelta = {
  context?: string
  self?: string
  updates: IngestDeltaUpdate[]
}

type SnapshotDraft = Omit<
  VesselSnapshotSummary,
  'observedAt' | 'source' | 'statusNote' | 'updatedAt' | 'vesselId'
>

function baseSnapshot(): SnapshotDraft {
  return {
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
  }
}

function normalizeAngleDegrees(value: unknown) {
  if (typeof value !== 'number') {
    return null
  }

  return Math.abs(value) > Math.PI * 2 ? value : (value * 180) / Math.PI
}

function applyDeltaValues(snapshot: SnapshotDraft, values: IngestDeltaValue[]) {
  for (const item of values) {
    const { path, value } = item

    if (path === 'navigation.position' && value && typeof value === 'object') {
      const position = value as { latitude?: unknown; longitude?: unknown }
      snapshot.positionLat = typeof position.latitude === 'number' ? position.latitude : null
      snapshot.positionLng = typeof position.longitude === 'number' ? position.longitude : null
      continue
    }

    if (path === 'navigation.position.latitude') {
      snapshot.positionLat = typeof value === 'number' ? value : null
      continue
    }

    if (path === 'navigation.position.longitude') {
      snapshot.positionLng = typeof value === 'number' ? value : null
      continue
    }

    if (path === 'navigation.headingMagnetic') {
      snapshot.headingMagnetic = normalizeAngleDegrees(value)
      continue
    }

    if (path === 'navigation.speedOverGround') {
      snapshot.speedOverGround = typeof value === 'number' ? value : null
      continue
    }

    if (path === 'navigation.speedThroughWater') {
      snapshot.speedThroughWater = typeof value === 'number' ? value : null
      continue
    }

    if (path === 'environment.wind.speedApparent') {
      snapshot.windSpeedApparent = typeof value === 'number' ? value : null
      continue
    }

    if (path === 'environment.wind.angleApparent') {
      snapshot.windAngleApparent = normalizeAngleDegrees(value)
      continue
    }

    if (path === 'environment.depth.belowTransducer') {
      snapshot.depthBelowTransducer = typeof value === 'number' ? value : null
      continue
    }

    if (path === 'environment.water.temperature') {
      snapshot.waterTemperatureKelvin = typeof value === 'number' ? value : null
      continue
    }

    if (path.startsWith('electrical.batteries.') && path.endsWith('.voltage')) {
      snapshot.batteryVoltage = typeof value === 'number' ? value : null
      continue
    }

    if (path.startsWith('propulsion.') && path.endsWith('.revolutions')) {
      snapshot.engineRpm = typeof value === 'number' ? value * 60 : null
    }
  }
}

function normalizeContext(context: string | undefined) {
  return context?.trim() || ''
}

function isSelfContext(context: string | undefined, selfContext?: string | undefined) {
  const normalizedContext = normalizeContext(context)

  if (TELEMETRY_SELF_CONTEXTS.has(normalizedContext)) {
    return true
  }

  const normalizedSelfContext = normalizeContext(selfContext)
  return Boolean(normalizedContext && normalizedSelfContext && normalizedContext === normalizedSelfContext)
}

function escapeTagValue(value: string) {
  return value.replaceAll(/[^\w:-]+/g, '_')
}

function getContextIdentity(context: string | undefined) {
  const normalized = normalizeContext(context)

  if (!normalized) {
    return null
  }

  const mmsiMatch = normalized.match(/mmsi:(\d{6,})/i)
  if (mmsiMatch) {
    return {
      id: `mmsi:${mmsiMatch[1]}`,
      mmsi: mmsiMatch[1],
    }
  }

  const segments = normalized.split('.')
  const tail = segments.at(-1)

  if (!tail || tail === 'self') {
    return null
  }

  return {
    id: normalized,
    mmsi: null,
  }
}

export function resolveObservedAt(timestamp: string | undefined, delta: IngestDelta) {
  return timestamp || delta.updates.find((update) => update.timestamp)?.timestamp || new Date().toISOString()
}

export function buildSnapshotFromDelta(input: {
  delta: IngestDelta
  observedAt: string
  source: string
  vesselId: string
}) {
  const snapshot = baseSnapshot()

  for (const update of input.delta.updates) {
    applyDeltaValues(snapshot, update.values)
  }

  return {
    vesselId: input.vesselId,
    source: input.source,
    observedAt: input.observedAt,
    ...snapshot,
    statusNote: null,
  } satisfies VesselSnapshotSummary
}

export function buildAisContactFromDelta(input: {
  delta: IngestDelta
  observedAt: string
}): AisContactSummary | null {
  if (isSelfContext(input.delta.context, input.delta.self)) {
    return null
  }

  const identity = getContextIdentity(input.delta.context)
  if (!identity) {
    return null
  }

  const contact: AisContactSummary = {
    id: identity.id,
    name: null,
    mmsi: identity.mmsi || null,
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
    lastUpdateAt: new Date(input.observedAt).getTime(),
  }

  for (const update of input.delta.updates) {
    for (const item of update.values) {
      const { path, value } = item

      if (path === 'navigation.position' && value && typeof value === 'object') {
        const position = value as { latitude?: unknown; longitude?: unknown }
        contact.lat = typeof position.latitude === 'number' ? position.latitude : contact.lat
        contact.lng = typeof position.longitude === 'number' ? position.longitude : contact.lng
        continue
      }

      if (path === 'navigation.position.latitude') {
        contact.lat = typeof value === 'number' ? value : contact.lat
        continue
      }

      if (path === 'navigation.position.longitude') {
        contact.lng = typeof value === 'number' ? value : contact.lng
        continue
      }

      if (path === 'navigation.courseOverGroundTrue') {
        contact.cog = normalizeAngleDegrees(value)
        continue
      }

      if (path === 'navigation.speedOverGround') {
        contact.sog = typeof value === 'number' ? value : contact.sog
        continue
      }

      if (path === 'navigation.headingTrue' || path === 'navigation.headingMagnetic') {
        contact.heading = normalizeAngleDegrees(value)
        continue
      }

      if (path === 'name') {
        contact.name = typeof value === 'string' ? value : contact.name
        continue
      }

      if (path === 'design.aisShipType') {
        contact.shipType = typeof value === 'number' ? value : contact.shipType
        continue
      }

      if (path === 'navigation.destination.commonName') {
        contact.destination = typeof value === 'string' ? value : contact.destination
        continue
      }

      if (path === 'communication.callsignVhf') {
        contact.callSign = typeof value === 'string' ? value : contact.callSign
        continue
      }

      if (path === 'design.length.overall') {
        contact.length = typeof value === 'number' ? value : contact.length
        continue
      }

      if (path === 'design.beam') {
        contact.beam = typeof value === 'number' ? value : contact.beam
        continue
      }

      if (path === 'design.draft.current') {
        contact.draft = typeof value === 'number' ? value : contact.draft
        continue
      }

      if (path === 'navigation.state') {
        contact.navState = typeof value === 'string' ? value : contact.navState
      }
    }
  }

  return contact
}

export function buildLivePublishMessage(input: {
  delta: IngestDelta
  observedAt: string
  vesselId: string
  source: string
  connectionState?: VesselLivePublishMessage['connectionState']
}) {
  const payload: VesselLivePublishMessage = {
    type: 'telemetry',
    lastObservedAt: input.observedAt,
    connectionState: input.connectionState || 'live',
  }

  if (isSelfContext(input.delta.context, input.delta.self)) {
    payload.snapshot = buildSnapshotFromDelta({
      delta: input.delta,
      observedAt: input.observedAt,
      source: input.source,
      vesselId: input.vesselId,
    })
  }

  const contact = buildAisContactFromDelta({
    delta: input.delta,
    observedAt: input.observedAt,
  })

  if (contact) {
    payload.aisContacts = [contact]
  }

  return payload
}

export function buildInfluxLines(input: {
  delta: IngestDelta
  installationId: string
  vesselId: string
  observedAt: string
}) {
  const timestampMs = new Date(input.observedAt).getTime()
  if (!Number.isFinite(timestampMs)) {
    return []
  }

  const contextTag = escapeTagValue(normalizeContext(input.delta.context) || 'self')
  const lines: string[] = []

  for (const update of input.delta.updates) {
    for (const item of update.values) {
      const pathTag = escapeTagValue(item.path)
      let fields: Record<string, boolean | number | string>
      if (typeof item.value === 'number') {
        fields = { numeric_value: item.value }
      } else if (typeof item.value === 'boolean') {
        fields = { bool_value: item.value }
      } else if (typeof item.value === 'string') {
        fields = { string_value: item.value }
      } else {
        fields = { json_value: JSON.stringify(item.value ?? null) }
      }

      lines.push(
        encodeInfluxLine({
          measurement: 'myboat_signalk',
          tags: {
            vessel_id: input.vesselId,
            installation_id: input.installationId,
            context: contextTag,
            path: pathTag,
          },
          fields,
          timestampMs,
        }),
      )
    }
  }

  return lines
}
