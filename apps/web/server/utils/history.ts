import type { H3Event } from 'h3'
import type {
  VesselHistoryAccessTier,
  VesselHistoryAggregator,
  VesselHistoryCatalogResponse,
  VesselHistoryPoint,
  VesselHistoryResolution,
  VesselHistoryResponse,
  VesselHistorySeries,
  VesselHistorySeriesDescriptor,
  VesselHistorySeriesFamily,
  VesselHistoryStorageMode,
  VesselHistoryTrackPoint,
  VesselHistoryVisibility,
} from '~/types/myboat'
import { TELEMETRY_SELF_CONTEXTS, type IngestDelta } from '#server/utils/telemetry'
import {
  encodeInfluxLine,
  getInfluxConfig,
  resolveInfluxHistoryBucket,
  runInfluxCsvQuery,
} from '#server/utils/influx'

type HistoryAggregator = VesselHistoryAggregator
type HistorySeriesTier = 'core' | 'detail'
type HistoryRouteMode = 'owner' | 'public'

type HistorySeriesDefinition = {
  id: string
  label: string
  unit: string | null
  visibility: VesselHistoryVisibility
  tier: HistorySeriesTier
  aggregator: HistoryAggregator
}

type HistoryPatternDefinition = Omit<HistorySeriesDefinition, 'id' | 'label'> & {
  familyId: string
  familyLabel: string
  matcher: RegExp
  label?: (id: string) => string
}

type HistorySample = {
  id: string
  value: number
  definition: HistorySeriesDefinition
}

type HistoryLineSet = {
  coreLines: string[]
  detailLines: string[]
}

type HistoryBucketMode = {
  accessTier: VesselHistoryAccessTier
  storageMode: VesselHistoryStorageMode
  maxDays: number
}

const TRACK_LAT_SERIES_ID = 'navigation.position.latitude'
const TRACK_LNG_SERIES_ID = 'navigation.position.longitude'
const MAX_TRACK_POINTS = 1000
const MAX_SERIES_POINTS = 1500
export const HISTORY_CATALOG_VERSION = '2026-03-29'

const EXACT_HISTORY_SERIES: Record<string, HistorySeriesDefinition> = {
  [TRACK_LAT_SERIES_ID]: {
    id: TRACK_LAT_SERIES_ID,
    label: 'Latitude',
    unit: 'deg',
    visibility: 'public',
    tier: 'core',
    aggregator: 'last',
  },
  [TRACK_LNG_SERIES_ID]: {
    id: TRACK_LNG_SERIES_ID,
    label: 'Longitude',
    unit: 'deg',
    visibility: 'public',
    tier: 'core',
    aggregator: 'last',
  },
  'navigation.headingMagnetic': {
    id: 'navigation.headingMagnetic',
    label: 'Heading magnetic',
    unit: 'deg',
    visibility: 'public',
    tier: 'core',
    aggregator: 'last',
  },
  'navigation.headingTrue': {
    id: 'navigation.headingTrue',
    label: 'Heading true',
    unit: 'deg',
    visibility: 'public',
    tier: 'core',
    aggregator: 'last',
  },
  'navigation.courseOverGroundTrue': {
    id: 'navigation.courseOverGroundTrue',
    label: 'Course over ground true',
    unit: 'deg',
    visibility: 'public',
    tier: 'core',
    aggregator: 'last',
  },
  'navigation.courseOverGroundMagnetic': {
    id: 'navigation.courseOverGroundMagnetic',
    label: 'Course over ground magnetic',
    unit: 'deg',
    visibility: 'public',
    tier: 'core',
    aggregator: 'last',
  },
  'navigation.speedOverGround': {
    id: 'navigation.speedOverGround',
    label: 'Speed over ground',
    unit: 'm/s',
    visibility: 'public',
    tier: 'core',
    aggregator: 'mean',
  },
  'navigation.speedThroughWater': {
    id: 'navigation.speedThroughWater',
    label: 'Speed through water',
    unit: 'm/s',
    visibility: 'public',
    tier: 'core',
    aggregator: 'mean',
  },
  'navigation.rateOfTurn': {
    id: 'navigation.rateOfTurn',
    label: 'Rate of turn',
    unit: 'deg/s',
    visibility: 'public',
    tier: 'core',
    aggregator: 'last',
  },
  'navigation.attitude.roll': {
    id: 'navigation.attitude.roll',
    label: 'Roll',
    unit: 'deg',
    visibility: 'owner',
    tier: 'core',
    aggregator: 'last',
  },
  'navigation.attitude.pitch': {
    id: 'navigation.attitude.pitch',
    label: 'Pitch',
    unit: 'deg',
    visibility: 'owner',
    tier: 'core',
    aggregator: 'last',
  },
  'navigation.attitude.yaw': {
    id: 'navigation.attitude.yaw',
    label: 'Yaw',
    unit: 'deg',
    visibility: 'owner',
    tier: 'core',
    aggregator: 'last',
  },
  'environment.wind.speedApparent': {
    id: 'environment.wind.speedApparent',
    label: 'Apparent wind speed',
    unit: 'm/s',
    visibility: 'public',
    tier: 'core',
    aggregator: 'mean',
  },
  'environment.wind.speedTrue': {
    id: 'environment.wind.speedTrue',
    label: 'True wind speed',
    unit: 'm/s',
    visibility: 'public',
    tier: 'core',
    aggregator: 'mean',
  },
  'environment.wind.angleApparent': {
    id: 'environment.wind.angleApparent',
    label: 'Apparent wind angle',
    unit: 'deg',
    visibility: 'public',
    tier: 'core',
    aggregator: 'last',
  },
  'environment.wind.directionTrue': {
    id: 'environment.wind.directionTrue',
    label: 'True wind direction',
    unit: 'deg',
    visibility: 'public',
    tier: 'core',
    aggregator: 'last',
  },
  'environment.wind.directionMagnetic': {
    id: 'environment.wind.directionMagnetic',
    label: 'Magnetic wind direction',
    unit: 'deg',
    visibility: 'public',
    tier: 'core',
    aggregator: 'last',
  },
  'environment.depth.belowTransducer': {
    id: 'environment.depth.belowTransducer',
    label: 'Depth below transducer',
    unit: 'm',
    visibility: 'public',
    tier: 'core',
    aggregator: 'last',
  },
  'environment.depth.belowSurface': {
    id: 'environment.depth.belowSurface',
    label: 'Depth below surface',
    unit: 'm',
    visibility: 'public',
    tier: 'core',
    aggregator: 'last',
  },
  'environment.depth.surfaceToTransducer': {
    id: 'environment.depth.surfaceToTransducer',
    label: 'Surface to transducer',
    unit: 'm',
    visibility: 'public',
    tier: 'core',
    aggregator: 'last',
  },
  'environment.current.drift': {
    id: 'environment.current.drift',
    label: 'Current drift',
    unit: 'm/s',
    visibility: 'public',
    tier: 'core',
    aggregator: 'mean',
  },
  'environment.current.setTrue': {
    id: 'environment.current.setTrue',
    label: 'Current set true',
    unit: 'deg',
    visibility: 'public',
    tier: 'core',
    aggregator: 'last',
  },
  'environment.water.temperature': {
    id: 'environment.water.temperature',
    label: 'Water temperature',
    unit: 'K',
    visibility: 'public',
    tier: 'core',
    aggregator: 'mean',
  },
  'electrical.batteries.tideyeBmv.voltage': {
    id: 'electrical.batteries.tideyeBmv.voltage',
    label: 'House battery voltage',
    unit: 'V',
    visibility: 'owner',
    tier: 'core',
    aggregator: 'mean',
  },
  'electrical.batteries.tideyeBmv.current': {
    id: 'electrical.batteries.tideyeBmv.current',
    label: 'House battery current',
    unit: 'A',
    visibility: 'owner',
    tier: 'core',
    aggregator: 'mean',
  },
  'electrical.batteries.tideyeBmv.power': {
    id: 'electrical.batteries.tideyeBmv.power',
    label: 'House battery power',
    unit: 'W',
    visibility: 'owner',
    tier: 'core',
    aggregator: 'mean',
  },
  'electrical.batteries.tideyeBmv.capacity.stateOfCharge': {
    id: 'electrical.batteries.tideyeBmv.capacity.stateOfCharge',
    label: 'House battery state of charge',
    unit: null,
    visibility: 'owner',
    tier: 'core',
    aggregator: 'mean',
  },
  'electrical.batteries.tideyeBmv.capacity.timeRemaining': {
    id: 'electrical.batteries.tideyeBmv.capacity.timeRemaining',
    label: 'House battery time remaining',
    unit: 's',
    visibility: 'owner',
    tier: 'core',
    aggregator: 'last',
  },
}

const PATTERN_HISTORY_SERIES: HistoryPatternDefinition[] = [
  {
    familyId: 'environment.inside.{zone}.temperature',
    familyLabel: 'Interior temperature',
    matcher: /^environment\.inside\.[^.]+\.temperature$/,
    unit: 'K',
    visibility: 'owner',
    tier: 'core',
    aggregator: 'mean',
  },
  {
    familyId: 'environment.inside.{zone}.humidity',
    familyLabel: 'Interior humidity',
    matcher: /^environment\.inside\.[^.]+\.(humidity|relativeHumidity)$/,
    unit: null,
    visibility: 'owner',
    tier: 'core',
    aggregator: 'mean',
  },
  {
    familyId: 'electrical.batteries.{bank}.voltage',
    familyLabel: 'Battery voltage',
    matcher: /^electrical\.batteries\.[^.]+\.voltage$/,
    unit: 'V',
    visibility: 'owner',
    tier: 'detail',
    aggregator: 'mean',
  },
  {
    familyId: 'electrical.batteries.{bank}.current',
    familyLabel: 'Battery current',
    matcher: /^electrical\.batteries\.[^.]+\.current$/,
    unit: 'A',
    visibility: 'owner',
    tier: 'detail',
    aggregator: 'mean',
  },
  {
    familyId: 'electrical.batteries.{bank}.temperature',
    familyLabel: 'Battery temperature',
    matcher: /^electrical\.batteries\.[^.]+\.temperature$/,
    unit: 'K',
    visibility: 'owner',
    tier: 'detail',
    aggregator: 'mean',
  },
  {
    familyId: 'electrical.batteries.{bank}.capacity.*',
    familyLabel: 'Battery capacity metrics',
    matcher:
      /^electrical\.batteries\.[^.]+\.capacity\.(stateOfCharge|timeRemaining|consumedCharge|dischargeSinceFull|dischargedEnergy)$/,
    unit: null,
    visibility: 'owner',
    tier: 'detail',
    aggregator: 'mean',
  },
  {
    familyId: 'electrical.batteries.{bank}.power',
    familyLabel: 'Battery power',
    matcher: /^electrical\.batteries\.[^.]+\.power$/,
    unit: 'W',
    visibility: 'owner',
    tier: 'detail',
    aggregator: 'mean',
  },
  {
    familyId: 'electrical.solar.{controller}.*',
    familyLabel: 'Solar controller metrics',
    matcher:
      /^electrical\.solar\.[^.]+\.(current|voltage|panelPower|panelVoltage|systemYield|yieldToday|yieldYesterday)$/,
    unit: null,
    visibility: 'owner',
    tier: 'detail',
    aggregator: 'mean',
  },
  {
    familyId: 'electrical.chargers.{charger}.*',
    familyLabel: 'Charger metrics',
    matcher: /^electrical\.chargers\.[^.]+\.(current|voltage|power)$/,
    unit: null,
    visibility: 'owner',
    tier: 'detail',
    aggregator: 'mean',
  },
  {
    familyId: 'electrical.chargers.{charger}.capacity.stateOfCharge',
    familyLabel: 'Charger state of charge',
    matcher: /^electrical\.chargers\.[^.]+\.capacity\.stateOfCharge$/,
    unit: null,
    visibility: 'owner',
    tier: 'detail',
    aggregator: 'mean',
  },
  {
    familyId: 'electrical.inverters.{inverter}.ac{in|out}.*',
    familyLabel: 'Inverter AC metrics',
    matcher: /^electrical\.inverters\.[^.]+\.(acin|acout)\.(current|voltage|frequency|power)$/,
    unit: null,
    visibility: 'owner',
    tier: 'detail',
    aggregator: 'mean',
  },
  {
    familyId: 'electrical.inverters.{inverter}.acin.currentLimit',
    familyLabel: 'Inverter AC input current limit',
    matcher: /^electrical\.inverters\.[^.]+\.(acin\.[12]\.currentLimit|acin\.currentLimit)$/,
    unit: 'A',
    visibility: 'owner',
    tier: 'detail',
    aggregator: 'last',
  },
  {
    familyId: 'electrical.venus.*',
    familyLabel: 'Venus power summary metrics',
    matcher: /^electrical\.venus\.(dcPower|totalPanelPower|totalPanelCurrent|vebusDcPower)$/,
    unit: null,
    visibility: 'owner',
    tier: 'detail',
    aggregator: 'mean',
  },
  {
    familyId: 'tanks.{kind}.{tank}.currentLevel',
    familyLabel: 'Tank level',
    matcher: /^tanks\.[^.]+\.[^.]+\.currentLevel$/,
    unit: null,
    visibility: 'owner',
    tier: 'core',
    aggregator: 'mean',
  },
  {
    familyId: 'propulsion.{engine}.runTime',
    familyLabel: 'Engine runtime',
    matcher: /^propulsion\.[^.]+\.(runTime|runTimeTrip)$/,
    unit: 's',
    visibility: 'owner',
    tier: 'core',
    aggregator: 'last',
  },
  {
    familyId: 'propulsion.{engine}.revolutions',
    familyLabel: 'Engine revolutions',
    matcher: /^propulsion\.[^.]+\.revolutions$/,
    unit: 'Hz',
    visibility: 'owner',
    tier: 'core',
    aggregator: 'mean',
  },
  {
    familyId: 'propulsion.{engine}.operating.*',
    familyLabel: 'Engine operating metrics',
    matcher:
      /^propulsion\.[^.]+\.(alternatorVoltage|boostPressure|coolantTemperature|exhaustTemperature|load|oilPressure|oilTemperature|temperature)$/,
    unit: null,
    visibility: 'owner',
    tier: 'detail',
    aggregator: 'mean',
  },
  {
    familyId: 'steering.{system}.rudderAngle',
    familyLabel: 'Rudder angle',
    matcher: /^steering\.[^.]+\.rudderAngle$/,
    unit: 'deg',
    visibility: 'owner',
    tier: 'core',
    aggregator: 'last',
  },
]

function normalizeAngleDegrees(value: unknown) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return null
  }

  return Math.abs(value) > Math.PI * 2 ? value : (value * 180) / Math.PI
}

function normalizeNumericValue(path: string, value: unknown) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return null
  }

  if (
    path.includes('heading') ||
    path.includes('courseOverGround') ||
    path.includes('wind.angle') ||
    path.includes('wind.direction') ||
    path.includes('current.setTrue') ||
    path.includes('rateOfTurn')
  ) {
    return normalizeAngleDegrees(value)
  }

  return value
}

function prettifyHistorySeriesId(id: string) {
  const tail = id.split('.').slice(-2).join(' ')
  return tail.replaceAll(/([a-z])([A-Z])/g, '$1 $2')
}

function normalizeTelemetryContext(context: string | undefined) {
  return context?.trim() || ''
}

function isSelfTelemetryContext(delta: IngestDelta) {
  const normalizedContext = normalizeTelemetryContext(delta.context)
  if (TELEMETRY_SELF_CONTEXTS.has(normalizedContext)) {
    return true
  }

  const normalizedSelf = normalizeTelemetryContext(delta.self)
  return Boolean(normalizedContext && normalizedSelf && normalizedContext === normalizedSelf)
}

function isVisibleInMode(visibility: VesselHistoryVisibility, mode: HistoryRouteMode) {
  return mode === 'owner' || visibility === 'public'
}

function getPatternSeriesDefinition(id: string) {
  const match = PATTERN_HISTORY_SERIES.find((candidate) => candidate.matcher.test(id))
  if (!match) {
    return null
  }

  return {
    id,
    label: match.label?.(id) || prettifyHistorySeriesId(id),
    unit: match.unit,
    visibility: match.visibility,
    tier: match.tier,
    aggregator: match.aggregator,
  } satisfies HistorySeriesDefinition
}

export function getHistorySeriesDefinition(id: string) {
  return EXACT_HISTORY_SERIES[id] || getPatternSeriesDefinition(id)
}

function toHistorySeriesDescriptor(
  definition: HistorySeriesDefinition,
): VesselHistorySeriesDescriptor {
  return {
    aggregator: definition.aggregator,
    id: definition.id,
    label: definition.label,
    tier: definition.tier,
    unit: definition.unit,
    visibility: definition.visibility,
  }
}

export function getHistorySeriesCatalog(mode: HistoryRouteMode = 'owner') {
  return Object.values(EXACT_HISTORY_SERIES)
    .filter((definition) => isVisibleInMode(definition.visibility, mode))
    .map((definition) => toHistorySeriesDescriptor(definition))
}

export function getHistorySeriesFamilies(
  mode: HistoryRouteMode = 'owner',
): VesselHistorySeriesFamily[] {
  return PATTERN_HISTORY_SERIES.filter((family) => isVisibleInMode(family.visibility, mode)).map(
    (family) => ({
      aggregator: family.aggregator,
      id: family.familyId,
      label: family.familyLabel,
      matcher: family.matcher.source,
      tier: family.tier,
      unit: family.unit,
      visibility: family.visibility,
    }),
  )
}

export function getHistoryCatalog(mode: HistoryRouteMode): VesselHistoryCatalogResponse {
  return {
    catalogVersion: HISTORY_CATALOG_VERSION,
    families: getHistorySeriesFamilies(mode),
    series: getHistorySeriesCatalog(mode),
  }
}

function addSample(
  samples: Map<string, HistorySample>,
  id: string,
  value: number | null,
  definition: HistorySeriesDefinition | null,
) {
  if (!definition || value === null) {
    return
  }

  samples.set(id, { id, value, definition })
}

function collectHistorySamples(delta: IngestDelta) {
  const samples = new Map<string, HistorySample>()

  for (const update of delta.updates) {
    for (const item of update.values) {
      if (item.path === 'navigation.position' && item.value && typeof item.value === 'object') {
        const position = item.value as { latitude?: unknown; longitude?: unknown }
        addSample(
          samples,
          TRACK_LAT_SERIES_ID,
          normalizeNumericValue(TRACK_LAT_SERIES_ID, position.latitude),
          getHistorySeriesDefinition(TRACK_LAT_SERIES_ID),
        )
        addSample(
          samples,
          TRACK_LNG_SERIES_ID,
          normalizeNumericValue(TRACK_LNG_SERIES_ID, position.longitude),
          getHistorySeriesDefinition(TRACK_LNG_SERIES_ID),
        )
        continue
      }

      if (item.path === 'environment.current' && item.value && typeof item.value === 'object') {
        const current = item.value as { drift?: unknown; setTrue?: unknown }
        addSample(
          samples,
          'environment.current.drift',
          normalizeNumericValue('environment.current.drift', current.drift),
          getHistorySeriesDefinition('environment.current.drift'),
        )
        addSample(
          samples,
          'environment.current.setTrue',
          normalizeNumericValue('environment.current.setTrue', current.setTrue),
          getHistorySeriesDefinition('environment.current.setTrue'),
        )
        continue
      }

      if (item.path === 'navigation.attitude' && item.value && typeof item.value === 'object') {
        const attitude = item.value as { pitch?: unknown; roll?: unknown; yaw?: unknown }
        addSample(
          samples,
          'navigation.attitude.roll',
          normalizeNumericValue('navigation.attitude.roll', attitude.roll),
          getHistorySeriesDefinition('navigation.attitude.roll'),
        )
        addSample(
          samples,
          'navigation.attitude.pitch',
          normalizeNumericValue('navigation.attitude.pitch', attitude.pitch),
          getHistorySeriesDefinition('navigation.attitude.pitch'),
        )
        addSample(
          samples,
          'navigation.attitude.yaw',
          normalizeNumericValue('navigation.attitude.yaw', attitude.yaw),
          getHistorySeriesDefinition('navigation.attitude.yaw'),
        )
        continue
      }

      const definition = getHistorySeriesDefinition(item.path)
      addSample(samples, item.path, normalizeNumericValue(item.path, item.value), definition)
    }
  }

  return samples
}

function buildHistoryMeasurementLine(
  measurement: 'myboat_history_core' | 'myboat_history_detail',
  sample: HistorySample,
  vesselId: string,
  installationId: string,
  timestampMs: number,
) {
  return encodeInfluxLine({
    measurement,
    tags: {
      installation_id: installationId,
      series_id: sample.id,
      vessel_id: vesselId,
    },
    fields: {
      numeric_value: sample.value,
    },
    timestampMs,
  })
}

export function buildHistoryLines(input: {
  delta: IngestDelta
  installationId: string
  observedAt: string
  vesselId: string
}): HistoryLineSet {
  if (!isSelfTelemetryContext(input.delta)) {
    return { coreLines: [], detailLines: [] }
  }

  const timestampMs = Date.parse(input.observedAt)
  if (!Number.isFinite(timestampMs)) {
    return { coreLines: [], detailLines: [] }
  }

  const samples = collectHistorySamples(input.delta)
  const coreLines: string[] = []
  const detailLines: string[] = []

  for (const sample of samples.values()) {
    if (sample.definition.tier === 'core') {
      coreLines.push(
        buildHistoryMeasurementLine(
          'myboat_history_core',
          sample,
          input.vesselId,
          input.installationId,
          timestampMs,
        ),
      )
      continue
    }

    detailLines.push(
      buildHistoryMeasurementLine(
        'myboat_history_detail',
        sample,
        input.vesselId,
        input.installationId,
        timestampMs,
      ),
    )
  }

  return { coreLines, detailLines }
}

function parsePaidUserIds(raw: string | null | undefined) {
  return new Set(
    (raw || '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean),
  )
}

export function resolveHistoryAccessTier(event: H3Event, userId: string) {
  const config = useRuntimeConfig(event)
  return parsePaidUserIds(config.historyPaidUserIds).has(userId) ? 'paid' : 'free'
}

export function buildHistoryInfluxTargets(
  event: H3Event,
  input: {
    accessTier: VesselHistoryAccessTier
    coreLines: string[]
    detailLines: string[]
    rawLines: string[]
  },
) {
  const config = getInfluxConfig(event)
  if (!config) {
    return []
  }

  const targets: Array<{ bucket: string; lines: string[] }> = []

  const debugBucket = resolveInfluxHistoryBucket(config, {
    accessTier: input.accessTier,
    kind: 'debug',
    storageMode: 'raw',
  })
  if (debugBucket && input.rawLines.length) {
    targets.push({ bucket: debugBucket, lines: input.rawLines })
  }

  const coreBucket = resolveInfluxHistoryBucket(config, {
    accessTier: input.accessTier,
    kind: 'core',
    storageMode: 'raw',
  })
  if (coreBucket && input.coreLines.length) {
    targets.push({ bucket: coreBucket, lines: input.coreLines })
  }

  const detailBucket = resolveInfluxHistoryBucket(config, {
    accessTier: input.accessTier,
    kind: 'detail',
    storageMode: 'raw',
  })
  if (detailBucket && input.detailLines.length) {
    targets.push({ bucket: detailBucket, lines: input.detailLines })
  }

  return targets
}

function resolveRequestedSeries(requestedIds: string[], mode: HistoryRouteMode) {
  const definitions = requestedIds.map((id) => getHistorySeriesDefinition(id))

  const missingId = definitions.findIndex((definition) => !definition)
  if (missingId >= 0) {
    throw createError({
      statusCode: 400,
      statusMessage: `Unsupported history series: ${requestedIds[missingId]}`,
    })
  }

  const seriesDefinitions = definitions as HistorySeriesDefinition[]
  const forbidden = seriesDefinitions.find(
    (definition) => mode === 'public' && definition.visibility !== 'public',
  )

  if (forbidden) {
    throw createError({
      statusCode: 403,
      statusMessage: `Series ${forbidden.id} is not public.`,
    })
  }

  return seriesDefinitions
}

function resolveResolution(input: {
  end: string
  requestedResolution: VesselHistoryResolution | 'auto'
  start: string
}) {
  if (input.requestedResolution !== 'auto') {
    return input.requestedResolution
  }

  const rangeMs = Math.max(0, Date.parse(input.end) - Date.parse(input.start))
  const rangeHours = rangeMs / 3_600_000

  if (rangeHours <= 6) return '1m'
  if (rangeHours <= 24) return '5m'
  if (rangeHours <= 24 * 7) return '15m'
  return '1h'
}

function resolutionToWindow(resolution: VesselHistoryResolution) {
  if (resolution === 'raw') {
    return null
  }

  return resolution
}

function shouldUseRollupBucket(resolution: VesselHistoryResolution, rangeDays: number) {
  return resolution === '1h' && rangeDays > 7
}

function buildSourceWindow(input: {
  accessTier: VesselHistoryAccessTier
  maxDays: number
  resolution: VesselHistoryResolution
  requestedRangeDays: number
}) {
  const storageMode: VesselHistoryStorageMode = shouldUseRollupBucket(
    input.resolution,
    input.requestedRangeDays,
  )
    ? 'rollup'
    : 'raw'

  return {
    accessTier: input.accessTier,
    maxDays: input.maxDays,
    storageMode,
  } satisfies HistoryBucketMode
}

function csvEscape(value: string) {
  return JSON.stringify(value)
}

export function buildHistoryFluxQuery(input: {
  aggregator: HistoryAggregator
  bucket: string
  end: string
  measurement: 'myboat_history_core' | 'myboat_history_detail'
  resolution: VesselHistoryResolution
  seriesIds: string[]
  start: string
  vesselId: string
}) {
  const window = resolutionToWindow(input.resolution)
  const seriesFilter = input.seriesIds.map((id) => `r.series_id == ${csvEscape(id)}`).join(' or ')
  const aggregateLine = window
    ? `  |> aggregateWindow(every: ${window}, fn: ${input.aggregator}, createEmpty: false)\n`
    : ''

  return `from(bucket: ${csvEscape(input.bucket)})
  |> range(start: time(v: ${csvEscape(input.start)}), stop: time(v: ${csvEscape(input.end)}))
  |> filter(fn: (r) => r._measurement == ${csvEscape(input.measurement)})
  |> filter(fn: (r) => r.vessel_id == ${csvEscape(input.vesselId)})
  |> filter(fn: (r) => r._field == "numeric_value")
  |> filter(fn: (r) => ${seriesFilter})
${aggregateLine}  |> keep(columns: ["_time", "_value", "series_id"])
  |> sort(columns: ["_time"])`
}

type InfluxHistoryRow = {
  _time: string
  _value: string
  series_id: string
}

function selectBucketForDefinitions(
  event: H3Event,
  definitions: HistorySeriesDefinition[],
  input: HistoryBucketMode,
) {
  const config = getInfluxConfig(event)
  if (!config) {
    throw createError({
      statusCode: 503,
      statusMessage: 'Influx history is not configured.',
    })
  }

  const bucketByTier = new Map<HistorySeriesTier, string>()
  for (const tier of new Set(definitions.map((definition) => definition.tier))) {
    const bucket = resolveInfluxHistoryBucket(config, {
      accessTier: input.accessTier,
      kind: tier,
      storageMode: input.storageMode,
    })

    if (!bucket) {
      throw createError({
        statusCode: 503,
        statusMessage: `Influx ${tier} history bucket is not configured.`,
      })
    }

    bucketByTier.set(tier, bucket)
  }

  return bucketByTier
}

function buildTrack(pointsBySeries: Map<string, VesselHistoryPoint[]>) {
  const latPoints = pointsBySeries.get(TRACK_LAT_SERIES_ID) || []
  const lngPoints = pointsBySeries.get(TRACK_LNG_SERIES_ID) || []
  const merged = new Map<string, Partial<VesselHistoryTrackPoint>>()

  for (const point of latPoints) {
    const current = merged.get(point.t) || { t: point.t }
    current.lat = point.v
    merged.set(point.t, current)
  }

  for (const point of lngPoints) {
    const current = merged.get(point.t) || { t: point.t }
    current.lng = point.v
    merged.set(point.t, current)
  }

  return Array.from(merged.values())
    .filter(
      (point): point is VesselHistoryTrackPoint =>
        typeof point.lat === 'number' &&
        typeof point.lng === 'number' &&
        typeof point.t === 'string',
    )
    .sort((left, right) => left.t.localeCompare(right.t))
    .slice(-MAX_TRACK_POINTS)
}

function trimSeriesPoints(points: VesselHistoryPoint[]) {
  if (points.length <= MAX_SERIES_POINTS) {
    return points
  }

  return points.slice(-MAX_SERIES_POINTS)
}

async function querySeriesGroup(
  event: H3Event,
  input: {
    aggregator: HistoryAggregator
    bucket: string
    definitions: HistorySeriesDefinition[]
    end: string
    resolution: VesselHistoryResolution
    start: string
    vesselId: string
  },
) {
  const measurement =
    input.definitions[0]!.tier === 'core' ? 'myboat_history_core' : 'myboat_history_detail'
  const flux = buildHistoryFluxQuery({
    aggregator: input.aggregator,
    bucket: input.bucket,
    end: input.end,
    measurement,
    resolution: input.resolution,
    seriesIds: input.definitions.map((definition) => definition.id),
    start: input.start,
    vesselId: input.vesselId,
  })

  return await runInfluxCsvQuery<InfluxHistoryRow>(event, flux)
}

export async function getVesselHistory(input: {
  accessTier: VesselHistoryAccessTier
  end: string
  event: H3Event
  maxDays: number
  mode: HistoryRouteMode
  requestedResolution: VesselHistoryResolution | 'auto'
  seriesIds: string[]
  start: string
  vesselId: string
}): Promise<VesselHistoryResponse> {
  const requestedIds = [...new Set(input.seriesIds)]
  const definitions = resolveRequestedSeries(requestedIds, input.mode)
  const trackIds = [TRACK_LAT_SERIES_ID, TRACK_LNG_SERIES_ID].filter(
    (id) => !requestedIds.includes(id),
  )
  const trackDefinitions = resolveRequestedSeries(trackIds, 'public')
  const resolution = resolveResolution({
    end: input.end,
    requestedResolution: input.requestedResolution,
    start: input.start,
  })

  const rangeDays = Math.max(0, Date.parse(input.end) - Date.parse(input.start)) / 86_400_000
  if (rangeDays > input.maxDays) {
    throw createError({
      statusCode: 400,
      statusMessage: `History window exceeds the ${input.maxDays}-day limit.`,
    })
  }

  const sourceWindow = buildSourceWindow({
    accessTier: input.accessTier,
    maxDays: input.maxDays,
    requestedRangeDays: rangeDays,
    resolution,
  })

  const allDefinitions = [...definitions, ...trackDefinitions]
  const bucketByTier = selectBucketForDefinitions(input.event, allDefinitions, sourceWindow)
  const rowsBySeries = new Map<string, VesselHistoryPoint[]>()

  for (const tier of ['core', 'detail'] as const) {
    const tierDefinitions = allDefinitions.filter((definition) => definition.tier === tier)
    if (!tierDefinitions.length) {
      continue
    }

    const bucket = bucketByTier.get(tier)
    if (!bucket) {
      continue
    }

    for (const aggregator of ['last', 'mean'] as const) {
      const aggregatorDefinitions = tierDefinitions.filter(
        (definition) => definition.aggregator === aggregator,
      )
      if (!aggregatorDefinitions.length) {
        continue
      }

      const rows = await querySeriesGroup(input.event, {
        aggregator,
        bucket,
        definitions: aggregatorDefinitions,
        end: input.end,
        resolution,
        start: input.start,
        vesselId: input.vesselId,
      })

      for (const row of rows) {
        const value = Number(row._value)
        if (!Number.isFinite(value) || !row.series_id || !row._time) {
          continue
        }

        rowsBySeries.set(row.series_id, [
          ...(rowsBySeries.get(row.series_id) || []),
          { t: row._time, v: value },
        ])
      }
    }
  }

  const responseSeries: VesselHistorySeries[] = definitions.map((definition) => ({
    aggregator: definition.aggregator,
    id: definition.id,
    label: definition.label,
    unit: definition.unit,
    visibility: definition.visibility,
    tier: definition.tier,
    points: trimSeriesPoints(rowsBySeries.get(definition.id) || []),
  }))

  return {
    catalogVersion: HISTORY_CATALOG_VERSION,
    range: {
      end: input.end,
      start: input.start,
    },
    resolution,
    series: responseSeries,
    sourceWindow,
    track: buildTrack(rowsBySeries),
  }
}
