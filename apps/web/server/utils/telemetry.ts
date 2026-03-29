import type { AisContactSummary, VesselSnapshotSummary } from '../../app/types/myboat'
import type { VesselLivePublishMessage } from '../../shared/myboatLive'
import {
  type DuplicateDropReason,
  type PublisherRole,
  type SignalKUpdateSource,
  buildStickyWinnerMap,
  classifySignalKSourceFamily,
  createTelemetrySourceCandidates,
  selectTelemetryCandidates,
} from '@myboat/telemetry-source-policy'

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
  $source?: string
  dropReason?: DuplicateDropReason | 'sticky_winner_fresh'
  receivedAt?: string
  source?: SignalKUpdateSource | null
  timestamp?: string
  values: IngestDeltaValue[]
}

export type IngestDelta = {
  context?: string
  publisherRole?: PublisherRole
  self?: string
  updates: IngestDeltaUpdate[]
}

export type IngestSelectionOutcome = {
  debugDeltas: MaterializedIngestDelta[]
  results: ReturnType<typeof selectTelemetryCandidates>
  selectedDeltas: MaterializedIngestDelta[]
}

export type MaterializedIngestDelta = {
  delta: IngestDelta
  receivedAt: string
}

type CandidateWithDropReason = {
  candidate: ReturnType<typeof createTelemetrySourceCandidates>[number]
  dropReason: DuplicateDropReason | 'sticky_winner_fresh'
}

type SnapshotDraft = Omit<
  VesselSnapshotSummary,
  'observedAt' | 'source' | 'statusNote' | 'updatedAt' | 'vesselId'
>

const SNAPSHOT_METRIC_KEYS = [
  'positionLat',
  'positionLng',
  'headingMagnetic',
  'speedOverGround',
  'speedThroughWater',
  'windSpeedApparent',
  'windAngleApparent',
  'depthBelowTransducer',
  'waterTemperatureKelvin',
  'batteryVoltage',
  'engineRpm',
] as const

type SnapshotMetricKey = (typeof SNAPSHOT_METRIC_KEYS)[number]

export type SnapshotPatch = Partial<SnapshotDraft> & {
  observedAt: string
  source: string
  statusNote: string | null
  updatedAt?: string | null
  vesselId: string
}

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

function applyDeltaValues(snapshot: Partial<SnapshotDraft>, values: IngestDeltaValue[]) {
  for (const item of values) {
    const { path, value } = item

    if (path === 'navigation.position' && value && typeof value === 'object') {
      const position = value as { latitude?: unknown; longitude?: unknown }
      if ('latitude' in position) {
        snapshot.positionLat = typeof position.latitude === 'number' ? position.latitude : null
      }
      if ('longitude' in position) {
        snapshot.positionLng = typeof position.longitude === 'number' ? position.longitude : null
      }
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

function normalizePublisherRole(publisherRole: PublisherRole | string | undefined) {
  return publisherRole === 'shadow' ? 'shadow' : 'primary'
}

function groupSourceCandidatesByDelta(
  candidates: ReturnType<typeof createTelemetrySourceCandidates>,
  input: {
    publisherRole: PublisherRole
    selfByContext?: Map<string, string>
  },
) {
  return Array.from(
    candidates.reduce<
      Map<
        string,
        {
          context: string
          publisherRole: PublisherRole
          receivedAt: string
          self?: string
          updates: IngestDeltaUpdate[]
        }
      >
    >((groups, candidate) => {
      const groupKey = `${candidate.context}\u0000${candidate.receivedAt}`
      const existing = groups.get(groupKey)

      if (!existing) {
        groups.set(groupKey, {
          context: candidate.context,
          publisherRole: input.publisherRole,
          receivedAt: candidate.receivedAt,
          ...(input.selfByContext?.get(candidate.context)
            ? { self: input.selfByContext.get(candidate.context) }
            : {}),
          updates: [
            {
              ...(candidate.observedAt ? { timestamp: candidate.observedAt } : {}),
              receivedAt: candidate.receivedAt,
              $source: candidate.sourceId,
              ...(candidate.source ? { source: candidate.source } : {}),
              values: [
                {
                  path: candidate.canonicalPath,
                  value: candidate.value,
                },
              ],
            },
          ],
        })
        return groups
      }

      const updateKey = `${candidate.observedAt || ''}\u0000${candidate.sourceId}\u0000${JSON.stringify(candidate.source || null)}`
      const existingUpdate =
        existing.updates.find((update) => {
          const currentKey = `${update.timestamp || ''}\u0000${update.$source || ''}\u0000${JSON.stringify(update.source || null)}`
          return currentKey === updateKey
        }) || null

      if (existingUpdate) {
        existingUpdate.values.push({
          path: candidate.canonicalPath,
          value: candidate.value,
        })
        return groups
      }

      existing.updates.push({
        ...(candidate.observedAt ? { timestamp: candidate.observedAt } : {}),
        receivedAt: candidate.receivedAt,
        $source: candidate.sourceId,
        ...(candidate.source ? { source: candidate.source } : {}),
        values: [
          {
            path: candidate.canonicalPath,
            value: candidate.value,
          },
        ],
      })
      return groups
    }, new Map()),
  ).map(([, delta]) => ({
    delta: {
      context: delta.context,
      publisherRole: delta.publisherRole,
      ...(delta.self ? { self: delta.self } : {}),
      updates: delta.updates,
    },
    receivedAt: delta.receivedAt,
  }))
}

function groupDebugCandidatesByDelta(
  candidates: CandidateWithDropReason[],
  input: {
    publisherRole: PublisherRole
    selfByContext?: Map<string, string>
  },
) {
  return Array.from(
    candidates.reduce<
      Map<
        string,
        {
          context: string
          publisherRole: PublisherRole
          receivedAt: string
          self?: string
          updates: IngestDeltaUpdate[]
        }
      >
    >((groups, item) => {
      const groupKey = `${item.candidate.context}\u0000${item.candidate.receivedAt}`
      const existing = groups.get(groupKey)
      const updateKey = `${item.candidate.observedAt || ''}\u0000${item.candidate.sourceId}\u0000${item.dropReason}`

      if (!existing) {
        groups.set(groupKey, {
          context: item.candidate.context,
          publisherRole: input.publisherRole,
          receivedAt: item.candidate.receivedAt,
          ...(input.selfByContext?.get(item.candidate.context)
            ? { self: input.selfByContext.get(item.candidate.context) }
            : {}),
          updates: [
            {
              ...(item.candidate.observedAt ? { timestamp: item.candidate.observedAt } : {}),
              receivedAt: item.candidate.receivedAt,
              $source: item.candidate.sourceId,
              ...(item.candidate.source ? { source: item.candidate.source } : {}),
              dropReason: item.dropReason,
              values: [
                {
                  path: item.candidate.canonicalPath,
                  value: item.candidate.value,
                },
              ],
            },
          ],
        })
        return groups
      }

      const existingUpdate =
        existing.updates.find((update) => {
          const currentKey = `${update.timestamp || ''}\u0000${update.$source || ''}\u0000${update.dropReason || ''}`
          return currentKey === updateKey
        }) || null

      if (existingUpdate) {
        existingUpdate.values.push({
          path: item.candidate.canonicalPath,
          value: item.candidate.value,
        })
        return groups
      }

      existing.updates.push({
        ...(item.candidate.observedAt ? { timestamp: item.candidate.observedAt } : {}),
        receivedAt: item.candidate.receivedAt,
        $source: item.candidate.sourceId,
        ...(item.candidate.source ? { source: item.candidate.source } : {}),
        dropReason: item.dropReason,
        values: [
          {
            path: item.candidate.canonicalPath,
            value: item.candidate.value,
          },
        ],
      })
      return groups
    }, new Map()),
  ).map(([, delta]) => ({
    delta: {
      context: delta.context,
      publisherRole: delta.publisherRole,
      ...(delta.self ? { self: delta.self } : {}),
      updates: delta.updates,
    },
    receivedAt: delta.receivedAt,
  }))
}

export function createTelemetryCandidatesFromDelta(input: {
  delta: IngestDelta
  receivedAt: string
}) {
  const publisherRole = normalizePublisherRole(input.delta.publisherRole)

  return input.delta.updates.flatMap((update) =>
    update.values.flatMap((item) =>
      createTelemetrySourceCandidates({
        context: input.delta.context || 'vessels.self',
        timestamp: update.timestamp,
        originalPath: item.path,
        publisherRole,
        receivedAt: update.receivedAt || input.receivedAt,
        source: update.source || null,
        sourceId: update.$source || 'unknown',
        value: item.value,
      }),
    ),
  )
}

export function selectTelemetryDelta(input: {
  delta: IngestDelta
  receivedAt: string
  stickyWinners?: Parameters<typeof selectTelemetryCandidates>[0]['stickyWinners']
}) {
  const publisherRole = normalizePublisherRole(input.delta.publisherRole)
  const candidates = createTelemetryCandidatesFromDelta({
    delta: input.delta,
    receivedAt: input.receivedAt,
  })
  const results = selectTelemetryCandidates({
    candidates,
    now: input.receivedAt,
    stickyWinners: input.stickyWinners,
  })
  const selectedCandidates = results.flatMap((result) => (result.kept ? [result.kept] : []))
  const rejectedCandidates = results.flatMap((result) =>
    result.rejected.map((rejected) => ({
      candidate: rejected.candidate,
      dropReason: rejected.reason as DuplicateDropReason | 'sticky_winner_fresh',
    })),
  )

  return {
    debugDeltas: groupDebugCandidatesByDelta(rejectedCandidates, {
      publisherRole,
      selfByContext:
        input.delta.self && input.delta.self.trim()
          ? new Map([[normalizeContext(input.delta.context) || 'vessels.self', input.delta.self]])
          : new Map(),
    }),
    results,
    selectedDeltas: groupSourceCandidatesByDelta(selectedCandidates, {
      publisherRole,
      selfByContext:
        input.delta.self && input.delta.self.trim()
          ? new Map([[normalizeContext(input.delta.context) || 'vessels.self', input.delta.self]])
          : new Map(),
    }),
    stickyWinners: buildStickyWinnerMap(results),
  } satisfies IngestSelectionOutcome & {
    stickyWinners: ReturnType<typeof buildStickyWinnerMap>
  }
}

export function materializeTelemetrySelections(input: {
  publisherRole?: PublisherRole | string
  results: ReturnType<typeof selectTelemetryCandidates>
  selfByContext?: Map<string, string>
}) {
  const publisherRole = normalizePublisherRole(input.publisherRole)
  const selectedCandidates = input.results.flatMap((result) => (result.kept ? [result.kept] : []))
  const rejectedCandidates = input.results.flatMap((result) =>
    result.rejected.map((rejected) => ({
      candidate: rejected.candidate,
      dropReason: rejected.reason as DuplicateDropReason | 'sticky_winner_fresh',
    })),
  )

  return {
    debugDeltas: groupDebugCandidatesByDelta(rejectedCandidates, {
      publisherRole,
      selfByContext: input.selfByContext,
    }),
    selectedDeltas: groupSourceCandidatesByDelta(selectedCandidates, {
      publisherRole,
      selfByContext: input.selfByContext,
    }),
  }
}

function isSelfContext(context: string | undefined, selfContext?: string | undefined) {
  const normalizedContext = normalizeContext(context)

  if (TELEMETRY_SELF_CONTEXTS.has(normalizedContext)) {
    return true
  }

  const normalizedSelfContext = normalizeContext(selfContext)
  return Boolean(
    normalizedContext && normalizedSelfContext && normalizedContext === normalizedSelfContext,
  )
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
  return (
    timestamp ||
    delta.updates.find((update) => update.timestamp)?.timestamp ||
    new Date().toISOString()
  )
}

export function buildSnapshotFromDelta(input: {
  delta: IngestDelta
  observedAt: string
  source: string
  vesselId: string
}) {
  return materializeSnapshot(
    buildSnapshotPatchFromDelta({
      delta: input.delta,
      observedAt: input.observedAt,
      source: input.source,
      vesselId: input.vesselId,
    }),
  )
}

function hasSnapshotMetric(patch: Partial<SnapshotDraft>, key: SnapshotMetricKey) {
  return Object.prototype.hasOwnProperty.call(patch, key)
}

function materializeSnapshot(patch: SnapshotPatch): VesselSnapshotSummary {
  const snapshot = baseSnapshot()

  for (const key of SNAPSHOT_METRIC_KEYS) {
    if (hasSnapshotMetric(patch, key)) {
      snapshot[key] = patch[key] ?? null
    }
  }

  return {
    vesselId: patch.vesselId,
    source: patch.source,
    observedAt: patch.observedAt,
    ...snapshot,
    statusNote: patch.statusNote,
    updatedAt: patch.updatedAt ?? null,
  } satisfies VesselSnapshotSummary
}

export function mergeSnapshotPatch(
  previous: VesselSnapshotSummary | null,
  patch: SnapshotPatch,
): VesselSnapshotSummary {
  const merged: VesselSnapshotSummary = {
    vesselId: patch.vesselId || previous?.vesselId,
    source: patch.source ?? previous?.source ?? null,
    observedAt: patch.observedAt,
    positionLat: previous?.positionLat ?? null,
    positionLng: previous?.positionLng ?? null,
    headingMagnetic: previous?.headingMagnetic ?? null,
    speedOverGround: previous?.speedOverGround ?? null,
    speedThroughWater: previous?.speedThroughWater ?? null,
    windSpeedApparent: previous?.windSpeedApparent ?? null,
    windAngleApparent: previous?.windAngleApparent ?? null,
    depthBelowTransducer: previous?.depthBelowTransducer ?? null,
    waterTemperatureKelvin: previous?.waterTemperatureKelvin ?? null,
    batteryVoltage: previous?.batteryVoltage ?? null,
    engineRpm: previous?.engineRpm ?? null,
    statusNote: patch.statusNote ?? previous?.statusNote ?? null,
    updatedAt: patch.updatedAt ?? previous?.updatedAt ?? null,
  }

  for (const key of SNAPSHOT_METRIC_KEYS) {
    if (hasSnapshotMetric(patch, key)) {
      merged[key] = patch[key] ?? null
    }
  }

  return merged
}

export function buildSnapshotPatchFromDelta(input: {
  delta: IngestDelta
  observedAt: string
  source: string
  vesselId: string
}) {
  const snapshotPatch: Partial<SnapshotDraft> = {}

  for (const update of input.delta.updates) {
    applyDeltaValues(snapshotPatch, update.values)
  }

  return {
    vesselId: input.vesselId,
    source: input.source,
    observedAt: input.observedAt,
    ...snapshotPatch,
    statusNote: null,
  } satisfies SnapshotPatch
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
  const publisherRole = normalizePublisherRole(input.delta.publisherRole)

  for (const update of input.delta.updates) {
    for (const item of update.values) {
      const pathTag = escapeTagValue(item.path)
      const sourceId = update.$source?.trim() || ''
      const sourceFamily = sourceId ? classifySignalKSourceFamily(sourceId) : 'unknown'
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

      if (update.source) {
        fields.source_json = JSON.stringify(update.source)
      }

      lines.push(
        encodeInfluxLine({
          measurement: 'myboat_signalk',
          tags: {
            vessel_id: input.vesselId,
            installation_id: input.installationId,
            context: contextTag,
            path: pathTag,
            publisher_role: publisherRole,
            ...(sourceId ? { source_id: sourceId } : {}),
            ...(sourceId ? { source_family: sourceFamily } : {}),
            ...(update.dropReason ? { drop_reason: update.dropReason } : {}),
          },
          fields,
          timestampMs,
        }),
      )
    }
  }

  return lines
}
