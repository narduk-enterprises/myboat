export const TELEMETRY_SOURCE_POLICY_VERSION = '2026-03-29'

export type PublisherRole = 'primary' | 'shadow'
export type SignalKSourceFamily =
  | 'defaults'
  | 'engine_hours_plugin'
  | 'leopard_plugin'
  | 'nmea0183'
  | 'nmea2000'
  | 'plugin'
  | 'signalk_server'
  | 'speed_wind_plugin'
  | 'unknown'
  | 'venus'

export type DuplicateDropReason =
  | 'debug_only_path'
  | 'lower_priority_source'
  | 'shadow_source_suppressed'
  | 'sticky_winner_retained'

export type SignalKUpdateSource = {
  label?: string
  pgn?: number
  sentence?: string
  src?: string
  talker?: string
  type?: string
  [key: string]: unknown
}

export type TelemetryValue = {
  path: string
  value: unknown
}

export type SourceAwareTelemetryUpdate = {
  $source?: string
  dropReason?: DuplicateDropReason
  receivedAt?: string
  source?: SignalKUpdateSource | null
  timestamp?: string
  values: TelemetryValue[]
}

export type SourceAwareTelemetryDelta = {
  context?: string
  publisherRole?: PublisherRole
  self?: string
  updates: SourceAwareTelemetryUpdate[]
}

export type TelemetrySourceCandidate = {
  canonicalPath: string
  context: string
  groupKey: string
  observedAt?: string
  originalPath: string
  publisherRole: PublisherRole
  receivedAt: string
  self: string
  source?: SignalKUpdateSource | null
  sourceFamily: SignalKSourceFamily
  sourceId: string
  updateTimestamp?: string
  value: unknown
}

export type TelemetrySelectionDrop = {
  candidate: TelemetrySourceCandidate
  reason: DuplicateDropReason
}

export type TelemetrySelectionResult = {
  debugOnly: boolean
  dropped: TelemetrySelectionDrop[]
  fallbackToLowerPriority: boolean
  key: string
  shadowSourceSuppressed: boolean
  winner: TelemetrySourceCandidate | null
}

export type TelemetryStickyWinner = {
  precedenceRank?: number
  publisherRole: PublisherRole
  receivedAt: string
  sourceId: string
}

export type NormalizedSourceInventoryEntry = {
  family: SignalKSourceFamily
  label: string
  metadata: Record<string, boolean | number | string | null>
  sourceId: string
}

export type SourceInventorySnapshot = {
  observedAt: string
  publisherRole: PublisherRole
  selfContext: string | null
  sourceCount: number
  sources: NormalizedSourceInventoryEntry[]
}

type RankedCandidate = TelemetrySourceCandidate & {
  receivedAtMs: number
  rank: number
}

const FAST_PATH_MATCHERS = [
  /^navigation\./,
  /^environment\.wind\./,
  /^environment\.current\./,
  /^environment\.depth\./,
]

const SYSTEM_PATH_MATCHERS = [/^electrical\./, /^tanks\./, /^propulsion\./, /^steering\./]

const AVERAGE_PLUGIN_PATHS = new Set([
  'environment.wind.speedMaxPeriodAverage',
  'environment.wind.speedPeriodAverage',
  'navigation.speedMaxPeriodAverage',
  'navigation.speedPeriodAverage',
])

const SELF_CONTEXTS = new Set(['', 'self', 'vessels.self'])

function normalizeText(value: string | undefined | null) {
  return value?.trim() || ''
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function isSelfContext(context: string, self: string) {
  if (SELF_CONTEXTS.has(context)) {
    return true
  }

  return Boolean(context && self && context === self)
}

function isStaticDefaultsPath(path: string) {
  return (
    path === 'name' ||
    path.startsWith('communication.') ||
    path.startsWith('design.') ||
    path.startsWith('registrations.') ||
    path.includes('.offset') ||
    path.includes('.offsets.')
  )
}

function isDebugOnlyPath(path: string) {
  return path.startsWith('electrical.switches.bank.')
}

function isFastPath(path: string) {
  return FAST_PATH_MATCHERS.some((matcher) => matcher.test(path))
}

function isSystemPath(path: string) {
  return SYSTEM_PATH_MATCHERS.some((matcher) => matcher.test(path))
}

function isVictronPath(path: string) {
  return (
    path.startsWith('electrical.batteries.tideyeBmv.') ||
    path.startsWith('electrical.chargers.') ||
    path.startsWith('electrical.inverters.') ||
    path.startsWith('electrical.solar.') ||
    path.startsWith('electrical.venus.')
  )
}

function isNavigationPrimaryPath(path: string) {
  return (
    path === 'navigation.position.latitude' ||
    path === 'navigation.position.longitude' ||
    path === 'navigation.speedOverGround' ||
    path === 'navigation.courseOverGroundTrue'
  )
}

function isWindPath(path: string) {
  return path.startsWith('environment.wind.')
}

function isCurrentPath(path: string) {
  return path.startsWith('environment.current.')
}

function isDepthTankBatteryPath(path: string) {
  return (
    path.startsWith('environment.depth.') ||
    path.startsWith('tanks.') ||
    /^electrical\.batteries\.[^.]+\./.test(path)
  )
}

function getPathFreshnessWindowMs(path: string) {
  if (isFastPath(path)) {
    return 15_000
  }

  if (isSystemPath(path)) {
    return 60_000
  }

  return 6 * 60 * 60 * 1000
}

function getNormalizedReceivedAtMs(receivedAt: string) {
  const receivedAtMs = Date.parse(receivedAt)
  return Number.isFinite(receivedAtMs) ? receivedAtMs : 0
}

function getSourceRank(input: {
  canonicalPath: string
  context: string
  publisherRole: PublisherRole
  self: string
  sourceFamily: SignalKSourceFamily
  sourceId: string
}) {
  const { canonicalPath, context, publisherRole, self, sourceFamily, sourceId } = input
  const normalizedSourceId = normalizeText(sourceId)
  const primaryPenalty = publisherRole === 'shadow' ? 10_000 : 0

  if (isDebugOnlyPath(canonicalPath)) {
    return 50_000 + primaryPenalty
  }

  if (canonicalPath.startsWith('electrical.switches.leopard.')) {
    return (normalizedSourceId === 'signalk-leopard-empirbus-switches' ? 0 : 100) + primaryPenalty
  }

  if (
    /^propulsion\.[^.]+\.(runTime|runTimeTrip)/.test(canonicalPath) &&
    normalizedSourceId.startsWith('signalk-engine-hours.')
  ) {
    return primaryPenalty
  }

  if (
    AVERAGE_PLUGIN_PATHS.has(canonicalPath) &&
    normalizedSourceId === 'signalk-speed-wind-averaging'
  ) {
    return primaryPenalty
  }

  if (canonicalPath.startsWith('notifications.server.')) {
    return (normalizedSourceId === 'signalk-server' ? 0 : 100) + primaryPenalty
  }

  if (isVictronPath(canonicalPath)) {
    if (sourceFamily === 'venus') {
      return primaryPenalty
    }

    if (sourceFamily === 'nmea2000') {
      return 10 + primaryPenalty
    }

    if (sourceFamily === 'nmea0183') {
      return 20 + primaryPenalty
    }

    return 50 + primaryPenalty
  }

  if (isNavigationPrimaryPath(canonicalPath)) {
    if (isSelfContext(context, self)) {
      if (normalizedSourceId === 'ydg-nmea-2000.74') {
        return primaryPenalty
      }

      if (sourceFamily === 'nmea2000') {
        return 10 + primaryPenalty
      }

      if (normalizedSourceId.startsWith('venus.com.victronenergy.gps.')) {
        return 20 + primaryPenalty
      }

      if (normalizedSourceId === 'ydg-nmea-0183.YD') {
        return 30 + primaryPenalty
      }

      if (normalizedSourceId === 'ydg-nmea-0183.AI') {
        return 40 + primaryPenalty
      }
    } else {
      if (normalizedSourceId === 'ydg-nmea-2000.2') {
        return primaryPenalty
      }

      if (normalizedSourceId === 'ydg-nmea-0183.AI') {
        return 10 + primaryPenalty
      }

      if (sourceFamily === 'nmea2000') {
        return 20 + primaryPenalty
      }

      if (sourceFamily === 'nmea0183') {
        return 30 + primaryPenalty
      }
    }
  }

  if (isWindPath(canonicalPath)) {
    if (normalizedSourceId === 'ydg-nmea-2000.105') {
      return primaryPenalty
    }

    if (sourceFamily === 'nmea2000') {
      return 10 + primaryPenalty
    }

    if (normalizedSourceId === 'ydg-nmea-0183.YD') {
      return 20 + primaryPenalty
    }
  }

  if (isCurrentPath(canonicalPath)) {
    if (normalizedSourceId === 'ydg-nmea-2000.4') {
      return primaryPenalty
    }

    if (sourceFamily === 'nmea2000') {
      return 10 + primaryPenalty
    }

    if (normalizedSourceId === 'ydg-nmea-0183.YD') {
      return 20 + primaryPenalty
    }
  }

  if (isDepthTankBatteryPath(canonicalPath)) {
    if (sourceFamily === 'nmea2000') {
      return primaryPenalty
    }

    if (sourceFamily === 'nmea0183') {
      return 10 + primaryPenalty
    }
  }

  if (isStaticDefaultsPath(canonicalPath)) {
    if (sourceFamily === 'defaults') {
      return 200 + primaryPenalty
    }

    if (sourceFamily === 'plugin') {
      return 20 + primaryPenalty
    }

    if (sourceFamily === 'venus') {
      return 30 + primaryPenalty
    }

    if (sourceFamily === 'nmea2000') {
      return 40 + primaryPenalty
    }

    if (sourceFamily === 'nmea0183') {
      return 50 + primaryPenalty
    }
  }

  if (sourceFamily === 'plugin') {
    return 60 + primaryPenalty
  }

  if (sourceFamily === 'venus') {
    return 70 + primaryPenalty
  }

  if (sourceFamily === 'nmea2000') {
    return 80 + primaryPenalty
  }

  if (sourceFamily === 'nmea0183') {
    return 90 + primaryPenalty
  }

  if (sourceFamily === 'defaults') {
    return 200 + primaryPenalty
  }

  return 500 + primaryPenalty
}

function compareRankedCandidates(
  left: RankedCandidate,
  right: RankedCandidate,
  stickyWinner: TelemetryStickyWinner | null,
) {
  if (left.rank !== right.rank) {
    return left.rank - right.rank
  }

  if (stickyWinner) {
    const leftSticky =
      left.sourceId === stickyWinner.sourceId && left.publisherRole === stickyWinner.publisherRole
        ? 0
        : 1
    const rightSticky =
      right.sourceId === stickyWinner.sourceId && right.publisherRole === stickyWinner.publisherRole
        ? 0
        : 1
    if (leftSticky !== rightSticky) {
      return leftSticky - rightSticky
    }
  }

  if (left.receivedAtMs !== right.receivedAtMs) {
    return right.receivedAtMs - left.receivedAtMs
  }

  return left.sourceId.localeCompare(right.sourceId)
}

function toRankedCandidate(candidate: TelemetrySourceCandidate): RankedCandidate {
  return {
    ...candidate,
    receivedAtMs: getNormalizedReceivedAtMs(candidate.receivedAt),
    rank: getSourceRank(candidate),
  }
}

function getStickyRank(
  stickyWinner: TelemetryStickyWinner,
  groupCandidate: TelemetrySourceCandidate,
) {
  return (
    stickyWinner.precedenceRank ??
    getSourceRank({
      canonicalPath: groupCandidate.canonicalPath,
      context: groupCandidate.context,
      publisherRole: stickyWinner.publisherRole,
      self: groupCandidate.self,
      sourceFamily: classifySignalKSourceFamily(stickyWinner.sourceId),
      sourceId: stickyWinner.sourceId,
    })
  )
}

function buildGroupKey(context: string, canonicalPath: string) {
  return `${context}\u0000${canonicalPath}`
}

function addExpandedLeaf(
  leaves: Array<{ canonicalPath: string; originalPath: string; value: unknown }>,
  originalPath: string,
  canonicalPath: string,
  value: unknown,
) {
  const normalizedPath = normalizeText(canonicalPath)
  if (!normalizedPath) {
    return
  }

  leaves.push({
    canonicalPath: normalizedPath,
    originalPath: normalizeText(originalPath) || normalizedPath,
    value,
  })
}

function expandObjectValue(
  originalPath: string,
  currentPath: string,
  value: unknown,
  leaves: Array<{ canonicalPath: string; originalPath: string; value: unknown }>,
) {
  if (!isRecord(value)) {
    addExpandedLeaf(leaves, originalPath || currentPath, currentPath, value)
    return
  }

  const entries = Object.entries(value)
  if (!entries.length) {
    addExpandedLeaf(leaves, originalPath || currentPath, currentPath, value)
    return
  }

  for (const [segment, childValue] of entries) {
    const nextPath = currentPath ? `${currentPath}.${segment}` : segment
    expandObjectValue(originalPath || nextPath, nextPath, childValue, leaves)
  }
}

export function classifySignalKSourceFamily(sourceId: string) {
  const normalized = normalizeText(sourceId)

  if (normalized === 'defaults') {
    return 'defaults'
  }

  if (normalized === 'signalk-leopard-empirbus-switches') {
    return 'leopard_plugin'
  }

  if (normalized === 'signalk-server') {
    return 'signalk_server'
  }

  if (normalized.startsWith('signalk-engine-hours.')) {
    return 'engine_hours_plugin'
  }

  if (normalized === 'signalk-speed-wind-averaging') {
    return 'speed_wind_plugin'
  }

  if (normalized.startsWith('ydg-nmea-2000.')) {
    return 'nmea2000'
  }

  if (normalized.startsWith('ydg-nmea-0183.')) {
    return 'nmea0183'
  }

  if (normalized.startsWith('venus.') || normalized.startsWith('venus.com.victronenergy.')) {
    return 'venus'
  }

  if (normalized.startsWith('signalk-') || normalized.startsWith('signalk.')) {
    return 'plugin'
  }

  return 'unknown'
}

export function expandTelemetryValueLeaves(input: TelemetryValue) {
  const leaves: Array<{ canonicalPath: string; originalPath: string; value: unknown }> = []
  expandObjectValue(normalizeText(input.path), normalizeText(input.path), input.value, leaves)
  if (!normalizeText(input.path)) {
    return leaves.map((leaf) => ({
      ...leaf,
      originalPath: leaf.canonicalPath,
    }))
  }

  return leaves
}

export function expandSignalKLeafValues(path: string, value: unknown) {
  return expandTelemetryValueLeaves({ path, value }).map((leaf) => ({
    canonicalPath: leaf.canonicalPath,
    value: leaf.value,
  }))
}

export function expandDeltaToSourceCandidates(input: {
  delta: SourceAwareTelemetryDelta
  publisherRole?: PublisherRole
}) {
  const publisherRole = input.publisherRole || 'primary'
  const context = normalizeText(input.delta.context)
  const self = normalizeText(input.delta.self)
  const candidates: TelemetrySourceCandidate[] = []

  for (const update of input.delta.updates) {
    const receivedAt = normalizeText(update.receivedAt) || new Date().toISOString()
    const sourceId = normalizeText(update.$source) || 'unknown'
    const sourceFamily = classifySignalKSourceFamily(sourceId)

    for (const value of update.values) {
      for (const leaf of expandTelemetryValueLeaves(value)) {
        candidates.push({
          canonicalPath: leaf.canonicalPath,
          context,
          groupKey: buildGroupKey(context, leaf.canonicalPath),
          ...(update.timestamp ? { observedAt: update.timestamp } : {}),
          originalPath: leaf.originalPath,
          publisherRole,
          receivedAt,
          self,
          source: update.source || null,
          sourceFamily,
          sourceId,
          ...(update.timestamp ? { updateTimestamp: update.timestamp } : {}),
          value: leaf.value,
        })
      }
    }
  }

  return candidates
}

export function selectCanonicalTelemetry(input: {
  candidates: TelemetrySourceCandidate[]
  now?: number
  stickyWinners?: Map<string, TelemetryStickyWinner> | Record<string, TelemetryStickyWinner>
}) {
  const grouped = new Map<string, TelemetrySourceCandidate[]>()
  for (const candidate of input.candidates) {
    const existing = grouped.get(candidate.groupKey)
    if (existing) {
      existing.push(candidate)
    } else {
      grouped.set(candidate.groupKey, [candidate])
    }
  }

  const stickyMap =
    input.stickyWinners instanceof Map
      ? input.stickyWinners
      : new Map(Object.entries(input.stickyWinners || {}))
  const now = input.now ?? Date.now()
  const results: TelemetrySelectionResult[] = []

  for (const [key, group] of grouped.entries()) {
    const firstCandidate = group[0]
    if (!firstCandidate) {
      continue
    }

    if (group.every((candidate) => isDebugOnlyPath(candidate.canonicalPath))) {
      results.push({
        debugOnly: true,
        dropped: group.map((candidate) => ({ candidate, reason: 'debug_only_path' })),
        fallbackToLowerPriority: false,
        key,
        shadowSourceSuppressed: false,
        winner: null,
      })
      continue
    }

    const stickyWinner = stickyMap.get(key) || null
    const freshnessWindowMs = getPathFreshnessWindowMs(firstCandidate.canonicalPath)
    const stickyFresh =
      stickyWinner && now - getNormalizedReceivedAtMs(stickyWinner.receivedAt) <= freshnessWindowMs
        ? stickyWinner
        : null

    const ranked = group
      .map(toRankedCandidate)
      .sort((left, right) => compareRankedCandidates(left, right, stickyFresh))
    const winner = ranked[0] || null

    if (!winner) {
      results.push({
        debugOnly: false,
        dropped: [],
        fallbackToLowerPriority: false,
        key,
        shadowSourceSuppressed: false,
        winner: null,
      })
      continue
    }

    if (stickyFresh) {
      const stickyRank = getStickyRank(stickyFresh, winner)
      const shouldRetainSticky =
        stickyRank < winner.rank ||
        (stickyRank === winner.rank &&
          (stickyFresh.sourceId !== winner.sourceId ||
            stickyFresh.publisherRole !== winner.publisherRole))

      if (shouldRetainSticky) {
        const shadowSuppressed =
          stickyFresh.publisherRole === 'primary' &&
          ranked.every((candidate) => candidate.publisherRole === 'shadow')
        const reason: DuplicateDropReason = shadowSuppressed
          ? 'shadow_source_suppressed'
          : 'sticky_winner_retained'
        results.push({
          debugOnly: false,
          dropped: ranked.map((candidate) => ({ candidate, reason })),
          fallbackToLowerPriority: false,
          key,
          shadowSourceSuppressed: shadowSuppressed,
          winner: null,
        })
        continue
      }
    }

    results.push({
      debugOnly: false,
      dropped: ranked.slice(1).map((candidate) => ({
        candidate,
        reason:
          winner.publisherRole === 'primary' && candidate.publisherRole === 'shadow'
            ? 'shadow_source_suppressed'
            : 'lower_priority_source',
      })),
      fallbackToLowerPriority: Boolean(
        stickyWinner &&
        stickyWinner.sourceId !== winner.sourceId &&
        getStickyRank(stickyWinner, winner) < winner.rank,
      ),
      key,
      shadowSourceSuppressed:
        winner.publisherRole === 'primary' &&
        ranked.slice(1).some((candidate) => candidate.publisherRole === 'shadow'),
      winner,
    })
  }

  return results
}

type CompatibleSelectionResult = {
  canonicalPath: string
  kept?: TelemetrySourceCandidate | null
  rejected?: Array<{
    candidate: TelemetrySourceCandidate
    reason: DuplicateDropReason | 'sticky_winner_fresh'
    sourceId: string
  }>
  winnerPublisherRole?: PublisherRole | null
  winnerSourceId?: string | null
}

export function buildStickyWinnerMap(
  results: Array<TelemetrySelectionResult | CompatibleSelectionResult>,
) {
  const stickyWinners = new Map<string, TelemetryStickyWinner>()

  for (const result of results) {
    const winner = 'winner' in result ? result.winner : (result.kept ?? null)
    if (!winner) {
      continue
    }

    const key =
      'key' in result && typeof result.key === 'string'
        ? result.key
        : buildGroupKey(winner.context, winner.canonicalPath)

    stickyWinners.set(key, {
      precedenceRank: getSourceRank(winner),
      publisherRole: winner.publisherRole,
      receivedAt: winner.receivedAt,
      sourceId: winner.sourceId,
    })
  }

  return stickyWinners
}

export function createTelemetrySourceCandidates(input: {
  context: string
  observedAt?: string
  originalPath: string
  publisherRole: PublisherRole
  receivedAt: string
  self?: string
  source?: SignalKUpdateSource | null
  sourceId: string
  timestamp?: string
  value: unknown
}) {
  return expandDeltaToSourceCandidates({
    delta: {
      context: input.context,
      ...(input.self ? { self: input.self } : {}),
      updates: [
        {
          $source: input.sourceId,
          receivedAt: input.receivedAt,
          source: input.source || null,
          ...(input.timestamp || input.observedAt
            ? { timestamp: input.timestamp || input.observedAt }
            : {}),
          values: [{ path: input.originalPath, value: input.value }],
        },
      ],
    },
    publisherRole: input.publisherRole,
  })
}

export function buildDeltaFromCandidates(input: {
  candidates: TelemetrySourceCandidate[]
  context?: string
  dropReason?: DuplicateDropReason
  publisherRole?: PublisherRole
  self?: string
}) {
  if (!input.candidates.length) {
    return null
  }

  const updates = Array.from(
    input.candidates.reduce<Map<string, SourceAwareTelemetryUpdate>>((groups, candidate) => {
      const groupKey = [
        candidate.sourceId,
        candidate.receivedAt,
        candidate.updateTimestamp || '',
        JSON.stringify(candidate.source || null),
      ].join('\u0000')
      const existing = groups.get(groupKey)

      if (existing) {
        existing.values.push({
          path: candidate.canonicalPath,
          value: candidate.value,
        })
        return groups
      }

      groups.set(groupKey, {
        $source: candidate.sourceId,
        ...(input.dropReason ? { dropReason: input.dropReason } : {}),
        receivedAt: candidate.receivedAt,
        source: candidate.source || null,
        ...(candidate.updateTimestamp ? { timestamp: candidate.updateTimestamp } : {}),
        values: [
          {
            path: candidate.canonicalPath,
            value: candidate.value,
          },
        ],
      })
      return groups
    }, new Map()),
  ).map(([, update]) => update)

  return {
    ...(input.context ? { context: input.context } : {}),
    ...(input.publisherRole ? { publisherRole: input.publisherRole } : {}),
    ...(input.self ? { self: input.self } : {}),
    updates,
  } satisfies SourceAwareTelemetryDelta
}

export function normalizeSourceInventorySnapshot(input: {
  observedAt?: string
  publisherRole?: PublisherRole
  selfContext?: string | null
  sources: unknown
}) {
  const entries = isRecord(input.sources) ? Object.entries(input.sources) : []

  const sources = entries
    .map(([sourceId, rawDetails]) => {
      const detailsRecord = isRecord(rawDetails) ? rawDetails : {}
      const metadata: Record<string, boolean | number | string | null> = {}

      for (const [key, value] of Object.entries(detailsRecord)) {
        if (
          typeof value === 'boolean' ||
          typeof value === 'number' ||
          typeof value === 'string' ||
          value === null
        ) {
          metadata[key] = value
        }
      }

      const label =
        (typeof metadata.label === 'string' && metadata.label) ||
        (typeof metadata.src === 'string' && metadata.src) ||
        sourceId

      return {
        family: classifySignalKSourceFamily(sourceId),
        label,
        metadata,
        sourceId,
      } satisfies NormalizedSourceInventoryEntry
    })
    .sort((left, right) => left.sourceId.localeCompare(right.sourceId))

  return {
    observedAt: normalizeText(input.observedAt) || new Date().toISOString(),
    publisherRole: input.publisherRole || 'primary',
    selfContext: normalizeText(input.selfContext) || null,
    sourceCount: sources.length,
    sources,
  } satisfies SourceInventorySnapshot
}

export function normalizeSignalKSourceInventory(input: {
  observedAt?: string
  publisherRole?: PublisherRole
  selfContext?: string | null
  raw: unknown
}) {
  return normalizeSourceInventorySnapshot({
    observedAt: input.observedAt,
    publisherRole: input.publisherRole,
    selfContext: input.selfContext,
    sources: input.raw,
  })
}

export function normalizeTelemetryPathFamily(path: string) {
  if (path.startsWith('navigation.position.')) {
    return 'navigation.position'
  }

  if (path.startsWith('environment.wind.')) {
    return 'environment.wind'
  }

  if (path.startsWith('environment.current.')) {
    return 'environment.current'
  }

  if (path.startsWith('environment.depth.')) {
    return 'environment.depth'
  }

  if (path.startsWith('electrical.switches.leopard.')) {
    return 'electrical.switches.leopard'
  }

  if (path.startsWith('electrical.switches.bank.')) {
    return 'electrical.switches.bank'
  }

  if (/^electrical\.batteries\.[^.]+\./.test(path)) {
    return 'electrical.batteries.{bank}'
  }

  if (/^propulsion\.[^.]+\./.test(path)) {
    return 'propulsion.{engine}'
  }

  if (/^tanks\.[^.]+\.[^.]+\./.test(path)) {
    return 'tanks.{kind}.{tank}'
  }

  const parts = path.split('.')
  if (parts.length >= 3) {
    return parts.slice(0, 3).join('.')
  }

  return path
}

export function getSelectionPolicySummary(results: TelemetrySelectionResult[]) {
  return results.reduce(
    (summary, result) => {
      if (result.winner) {
        summary.winnersKept += 1
      }

      if (result.fallbackToLowerPriority) {
        summary.fallbackToLowerPriority += 1
      }

      if (result.shadowSourceSuppressed) {
        summary.shadowSourceSuppressed += 1
      }

      summary.losersDropped += result.dropped.length
      return summary
    },
    {
      fallbackToLowerPriority: 0,
      losersDropped: 0,
      winnersKept: 0,
      shadowSourceSuppressed: 0,
    },
  )
}

export function selectTelemetryCandidates(input: {
  candidates: TelemetrySourceCandidate[]
  now?: number | string
  stickyWinners?: Map<string, TelemetryStickyWinner> | Record<string, TelemetryStickyWinner>
}) {
  const now =
    typeof input.now === 'string' ? getNormalizedReceivedAtMs(input.now) : (input.now ?? Date.now())

  return selectCanonicalTelemetry({
    candidates: input.candidates,
    now,
    stickyWinners: input.stickyWinners,
  }).map((result) => {
    const rejected: NonNullable<CompatibleSelectionResult['rejected']> = result.dropped.map(
      ({ candidate, reason }) => ({
        candidate,
        reason: reason === 'sticky_winner_retained' ? 'sticky_winner_fresh' : reason,
        sourceId: candidate.sourceId,
      }),
    )

    return {
      canonicalPath:
        result.winner?.canonicalPath || result.dropped[0]?.candidate.canonicalPath || '',
      debugOnly: result.debugOnly,
      dropped: result.dropped,
      fallbackToLowerPriority: result.fallbackToLowerPriority,
      kept: result.winner,
      key: result.key,
      rejected,
      shadowSourceSuppressed: result.shadowSourceSuppressed,
      winner: result.winner,
      winnerPublisherRole: result.winner?.publisherRole || null,
      winnerSourceId: result.winner?.sourceId || null,
    }
  })
}
