import type { AisContactSummary, VesselCardSummary, VesselSnapshotSummary } from '~/types/myboat'
import type {
  PassagePlaybackBundle,
  PassagePlaybackSelfSample,
  PassagePlaybackTrafficVessel,
} from '~/types/passagePlayback'

export interface PassagePlaybackScope {
  access: 'auth' | 'public'
  username?: string | null
  vesselSlug?: string | null
}

export interface PassagePlaybackEventMarker {
  id: string
  label: string
  shortLabel: string
  ms: number
}

export interface PassagePlaybackMetrics {
  timestampLabel: string
  elapsedLabel: string
  sog: number | null
  speedThroughWater: number | null
  cog: number | null
  heading: number | null
  windTrueSpeedKts: number | null
  windTrueDirectionDeg: number | null
  depth: number | null
  distanceRemainingNm: number
  avgSogSoFar: number | null
  maxSogSoFar: number | null
}

interface PreparedSelfSample extends PassagePlaybackSelfSample {
  ms: number
  cumulativeDistanceNm: number
  prefixMaxSog: number | null
  prefixSogSum: number
  prefixSogCount: number
}

interface InterpolatedPlaybackSample extends PassagePlaybackSelfSample {
  ms: number
  cumulativeDistanceNm: number
  avgSogSoFar: number | null
  maxSogSoFar: number | null
}

const PLAYBACK_SPEED_OPTIONS = [1, 10, 30, 120]
const DEFAULT_TRAFFIC_FRESHNESS_MS = 20 * 60_000

function buildPlaybackPath(passageId: string, scope: PassagePlaybackScope) {
  if (scope.access === 'public') {
    return `/api/public/${scope.username}/${scope.vesselSlug}/passages/${passageId}/playback`
  }

  return `/api/app/passages/${passageId}/playback`
}

function haversineNm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const earthRadiusNm = 3440.065
  const toRadians = Math.PI / 180
  const dLat = (lat2 - lat1) * toRadians
  const dLon = (lon2 - lon1) * toRadians
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * toRadians) * Math.cos(lat2 * toRadians) * Math.sin(dLon / 2) ** 2

  return 2 * earthRadiusNm * Math.asin(Math.min(1, Math.sqrt(a)))
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function interpolateNumber(
  left: number | null | undefined,
  right: number | null | undefined,
  ratio: number,
) {
  if (left == null && right == null) {
    return null
  }

  if (left == null) {
    return right ?? null
  }

  if (right == null) {
    return left
  }

  return left + (right - left) * ratio
}

function normalizeDegrees(value: number) {
  const normalized = value % 360
  return normalized < 0 ? normalized + 360 : normalized
}

function shortestAngleDelta(left: number, right: number) {
  return ((right - left + 540) % 360) - 180
}

function interpolateHeading(
  left: number | null | undefined,
  right: number | null | undefined,
  ratio: number,
) {
  if (left == null && right == null) {
    return null
  }

  if (left == null) {
    return right ?? null
  }

  if (right == null) {
    return left
  }

  return normalizeDegrees(left + shortestAngleDelta(left, right) * ratio)
}

function parseWindowMs(windowValue: string | null | undefined) {
  if (!windowValue) {
    return DEFAULT_TRAFFIC_FRESHNESS_MS
  }

  const match = windowValue.trim().match(/^(\d+)(ms|[smh])$/i)
  if (!match) {
    return DEFAULT_TRAFFIC_FRESHNESS_MS
  }

  const count = Number(match[1])
  const unit = match[2]?.toLowerCase()
  if (!Number.isFinite(count) || !unit) {
    return DEFAULT_TRAFFIC_FRESHNESS_MS
  }

  if (unit === 'ms') {
    return count
  }
  if (unit === 's') {
    return count * 1000
  }
  if (unit === 'm') {
    return count * 60_000
  }
  if (unit === 'h') {
    return count * 3_600_000
  }

  return DEFAULT_TRAFFIC_FRESHNESS_MS
}

function formatElapsed(ms: number) {
  const totalSeconds = Math.max(0, Math.round(ms / 1000))
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  if (hours > 0) {
    return `${hours}h ${String(minutes).padStart(2, '0')}m`
  }

  return `${minutes}m ${String(seconds).padStart(2, '0')}s`
}

function findFloorIndexByMs<T extends { ms: number }>(rows: T[], ms: number) {
  if (!rows.length) {
    return -1
  }

  let low = 0
  let high = rows.length - 1
  let best = 0

  while (low <= high) {
    const mid = (low + high) >> 1
    if (rows[mid]!.ms <= ms) {
      best = mid
      low = mid + 1
    } else {
      high = mid - 1
    }
  }

  return best
}

function findNearestTrafficSample(
  vessel: PassagePlaybackTrafficVessel,
  currentMs: number,
  maxAgeMs: number,
) {
  const samples = vessel.samples
  if (!samples.length) {
    return null
  }

  let nearest = samples[0]!
  let nearestDelta = Math.abs(Date.parse(nearest.t) - currentMs)

  for (const sample of samples) {
    const delta = Math.abs(Date.parse(sample.t) - currentMs)
    if (delta < nearestDelta) {
      nearest = sample
      nearestDelta = delta
    }
  }

  return nearestDelta <= maxAgeMs ? nearest : null
}

function prepareSelfSamples(samples: PassagePlaybackSelfSample[]) {
  const prepared: PreparedSelfSample[] = []
  let cumulativeDistanceNm = 0
  let prefixMaxSog: number | null = null
  let prefixSogSum = 0
  let prefixSogCount = 0

  for (const sample of samples) {
    const ms = Date.parse(sample.t)
    if (!Number.isFinite(ms)) {
      continue
    }

    const previous = prepared.at(-1)
    if (previous) {
      cumulativeDistanceNm += haversineNm(previous.lat, previous.lon, sample.lat, sample.lon)
    }

    if (sample.sog != null) {
      prefixSogSum += sample.sog
      prefixSogCount += 1
      prefixMaxSog = prefixMaxSog == null ? sample.sog : Math.max(prefixMaxSog, sample.sog)
    }

    prepared.push({
      ...sample,
      ms,
      cumulativeDistanceNm,
      prefixMaxSog,
      prefixSogSum,
      prefixSogCount,
    })
  }

  return prepared
}

function buildPlaybackEvents(samples: PreparedSelfSample[]) {
  if (!samples.length) {
    return []
  }

  const events: PassagePlaybackEventMarker[] = [
    {
      id: 'departure',
      label: 'Departure',
      shortLabel: 'Depart',
      ms: samples[0]!.ms,
    },
  ]

  const peakSpeedSample = [...samples]
    .filter((sample) => sample.sog != null)
    .sort((left, right) => (right.sog || 0) - (left.sog || 0))[0]

  if (peakSpeedSample && peakSpeedSample.ms !== samples[0]!.ms) {
    events.push({
      id: 'peak-speed',
      label: `Peak speed ${peakSpeedSample.sog?.toFixed(1)} kts`,
      shortLabel: 'Peak',
      ms: peakSpeedSample.ms,
    })
  }

  const peakWindSample = [...samples]
    .filter((sample) => sample.windTrueSpeedKts != null)
    .sort((left, right) => (right.windTrueSpeedKts || 0) - (left.windTrueSpeedKts || 0))[0]

  if (
    peakWindSample &&
    peakWindSample.ms !== samples[0]!.ms &&
    peakWindSample.ms !== samples.at(-1)!.ms
  ) {
    events.push({
      id: 'peak-wind',
      label: `Peak wind ${peakWindSample.windTrueSpeedKts?.toFixed(1)} kts`,
      shortLabel: 'Wind',
      ms: peakWindSample.ms,
    })
  }

  events.push({
    id: 'arrival',
    label: 'Arrival',
    shortLabel: 'Arrive',
    ms: samples.at(-1)!.ms,
  })

  return events
}

function interpolateSample(
  samples: PreparedSelfSample[],
  currentMs: number,
): InterpolatedPlaybackSample | null {
  if (!samples.length) {
    return null
  }

  const floorIndex = findFloorIndexByMs(samples, currentMs)
  if (floorIndex < 0) {
    return null
  }

  const floor = samples[floorIndex]!
  const next = samples[floorIndex + 1]
  if (!next || next.ms <= floor.ms) {
    return {
      ...floor,
      avgSogSoFar: floor.prefixSogCount ? floor.prefixSogSum / floor.prefixSogCount : null,
      maxSogSoFar: floor.prefixMaxSog,
    }
  }

  const ratio = clamp((currentMs - floor.ms) / (next.ms - floor.ms), 0, 1)

  return {
    t: new Date(currentMs).toISOString(),
    ms: currentMs,
    lat: interpolateNumber(floor.lat, next.lat, ratio) ?? floor.lat,
    lon: interpolateNumber(floor.lon, next.lon, ratio) ?? floor.lon,
    sog: interpolateNumber(floor.sog, next.sog, ratio),
    cog: interpolateHeading(floor.cog, next.cog, ratio),
    headingTrue: interpolateHeading(floor.headingTrue, next.headingTrue, ratio),
    speedThroughWater: interpolateNumber(floor.speedThroughWater, next.speedThroughWater, ratio),
    depth: interpolateNumber(floor.depth, next.depth, ratio),
    waterTempC: interpolateNumber(floor.waterTempC, next.waterTempC, ratio),
    airTempC: interpolateNumber(floor.airTempC, next.airTempC, ratio),
    windAppSpeedKts: interpolateNumber(floor.windAppSpeedKts, next.windAppSpeedKts, ratio),
    windAppAngleDeg: interpolateHeading(floor.windAppAngleDeg, next.windAppAngleDeg, ratio),
    windTrueSpeedKts: interpolateNumber(floor.windTrueSpeedKts, next.windTrueSpeedKts, ratio),
    windTrueDirectionDeg: interpolateHeading(
      floor.windTrueDirectionDeg,
      next.windTrueDirectionDeg,
      ratio,
    ),
    portRpm: interpolateNumber(floor.portRpm, next.portRpm, ratio),
    starboardRpm: interpolateNumber(floor.starboardRpm, next.starboardRpm, ratio),
    barometerHpa: interpolateNumber(floor.barometerHpa, next.barometerHpa, ratio),
    cumulativeDistanceNm:
      interpolateNumber(floor.cumulativeDistanceNm, next.cumulativeDistanceNm, ratio) ??
      floor.cumulativeDistanceNm,
    avgSogSoFar: floor.prefixSogCount ? floor.prefixSogSum / floor.prefixSogCount : null,
    maxSogSoFar: floor.prefixMaxSog,
  }
}

export function usePassagePlaybackBundle(
  passageId: Ref<string | null> | ComputedRef<string | null>,
  scope: Ref<PassagePlaybackScope> | ComputedRef<PassagePlaybackScope>,
) {
  const appFetch = useAppFetch()

  return useAsyncData(
    () => {
      const id = passageId.value || 'none'
      const value = scope.value
      return `myboat-passage-playback:${value.access}:${value.username || 'auth'}:${value.vesselSlug || 'direct'}:${id}`
    },
    async () => {
      const id = passageId.value
      if (!id) {
        return null
      }

      return await appFetch<PassagePlaybackBundle>(buildPlaybackPath(id, scope.value))
    },
    {
      watch: [passageId, scope],
      default: () => null,
    },
  )
}

export function usePassagePlaybackController(
  bundle: Ref<PassagePlaybackBundle | null> | ComputedRef<PassagePlaybackBundle | null>,
) {
  const isPlaying = shallowRef(false)
  const playbackRate = shallowRef(PLAYBACK_SPEED_OPTIONS[1]!)
  const currentMs = shallowRef(0)
  let frameHandle: number | null = null
  let lastFrameAt = 0

  const preparedSamples = computed(() => prepareSelfSamples(bundle.value?.self.samples || []))
  const startedMs = computed(() => preparedSamples.value[0]?.ms ?? 0)
  const endedMs = computed(() => preparedSamples.value.at(-1)?.ms ?? startedMs.value)
  const durationMs = computed(() => Math.max(0, endedMs.value - startedMs.value))
  const events = computed(() => buildPlaybackEvents(preparedSamples.value))

  const activeSample = computed(() => interpolateSample(preparedSamples.value, currentMs.value))
  const progressRatio = computed(() =>
    durationMs.value <= 0 ? 0 : clamp((currentMs.value - startedMs.value) / durationMs.value, 0, 1),
  )

  const trafficFreshnessMs = computed(() =>
    Math.max(
      parseWindowMs(bundle.value?.traffic.window),
      parseWindowMs(bundle.value?.self.window),
      DEFAULT_TRAFFIC_FRESHNESS_MS,
    ),
  )

  const playbackSnapshot = computed<VesselSnapshotSummary | null>(() => {
    const sample = activeSample.value
    if (!sample) {
      return null
    }

    return {
      observedAt: sample.t,
      positionLat: sample.lat,
      positionLng: sample.lon,
      headingMagnetic: sample.headingTrue,
      speedOverGround: sample.sog,
      speedThroughWater: sample.speedThroughWater ?? null,
      windSpeedApparent: sample.windAppSpeedKts ?? sample.windTrueSpeedKts ?? null,
      windAngleApparent: sample.windAppAngleDeg ?? null,
      depthBelowTransducer: sample.depth ?? null,
      waterTemperatureKelvin: sample.waterTempC != null ? sample.waterTempC + 273.15 : null,
      batteryVoltage: null,
      engineRpm: sample.portRpm ?? sample.starboardRpm ?? null,
      statusNote: 'Playback sample from stored passage archive.',
      source: 'passage_playback',
      vesselId: undefined,
      updatedAt: sample.t,
    }
  })

  const aisContacts = computed<AisContactSummary[]>(() => {
    const sample = activeSample.value
    if (!sample || !bundle.value) {
      return []
    }

    const contacts: AisContactSummary[] = []

    for (const vessel of bundle.value.traffic.vessels) {
      const nearest = findNearestTrafficSample(vessel, currentMs.value, trafficFreshnessMs.value)
      if (!nearest) {
        continue
      }

      const displayName =
        vessel.profile.name ||
        vessel.profile.shipTypeName ||
        `MMSI ${vessel.profile.mmsi.slice(-4)}`

      contacts.push({
        id: `traffic:${vessel.profile.mmsi}`,
        name: displayName,
        mmsi: vessel.profile.mmsi,
        shipType: vessel.profile.shipTypeId,
        lat: nearest.lat,
        lng: nearest.lon,
        cog: nearest.cog,
        sog: nearest.sog,
        heading: nearest.hdg,
        destination: vessel.profile.destination,
        callSign: null,
        length: vessel.profile.lengthM,
        beam: vessel.profile.beamM,
        draft: vessel.profile.draftM,
        navState: vessel.profile.shipTypeName,
        lastUpdateAt: Date.parse(nearest.t),
      })
    }

    return contacts
      .sort((left, right) => {
        const leftDistance = haversineNm(sample.lat, sample.lon, left.lat || 0, left.lng || 0)
        const rightDistance = haversineNm(sample.lat, sample.lon, right.lat || 0, right.lng || 0)
        return leftDistance - rightDistance
      })
      .slice(0, 16)
  })

  const nearbyTraffic = computed(() => aisContacts.value.slice(0, 5))

  const metrics = computed<PassagePlaybackMetrics | null>(() => {
    const sample = activeSample.value
    const currentBundle = bundle.value
    if (!sample || !currentBundle) {
      return null
    }

    return {
      timestampLabel: new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      }).format(new Date(sample.t)),
      elapsedLabel: formatElapsed(sample.ms - startedMs.value),
      sog: sample.sog,
      speedThroughWater: sample.speedThroughWater ?? null,
      cog: sample.cog,
      heading: sample.headingTrue,
      windTrueSpeedKts: sample.windTrueSpeedKts ?? null,
      windTrueDirectionDeg: sample.windTrueDirectionDeg ?? null,
      depth: sample.depth ?? null,
      distanceRemainingNm: Math.max(
        0,
        (currentBundle.summary.distanceNm || 0) - sample.cumulativeDistanceNm,
      ),
      avgSogSoFar: sample.avgSogSoFar,
      maxSogSoFar: sample.maxSogSoFar,
    }
  })

  function setCurrentMs(nextMs: number) {
    currentMs.value = clamp(nextMs, startedMs.value, endedMs.value)
  }

  function seekToRatio(ratio: number) {
    setCurrentMs(startedMs.value + durationMs.value * clamp(ratio, 0, 1))
  }

  function seekToEvent(eventMs: number) {
    setCurrentMs(eventMs)
  }

  function resetPlayback() {
    isPlaying.value = false
    setCurrentMs(startedMs.value)
  }

  function togglePlayback() {
    if (!preparedSamples.value.length) {
      return
    }

    if (currentMs.value >= endedMs.value) {
      currentMs.value = startedMs.value
    }

    isPlaying.value = !isPlaying.value
  }

  function setPlaybackRate(nextRate: number) {
    playbackRate.value = nextRate
  }

  function stopFrameLoop() {
    if (frameHandle != null && import.meta.client) {
      window.cancelAnimationFrame(frameHandle)
    }

    frameHandle = null
    lastFrameAt = 0
  }

  function scheduleFrame() {
    if (!import.meta.client || !isPlaying.value || frameHandle != null) {
      return
    }

    frameHandle = window.requestAnimationFrame(onFrame)
  }

  function onFrame(timestamp: number) {
    frameHandle = null
    if (!isPlaying.value) {
      return
    }

    if (!lastFrameAt) {
      lastFrameAt = timestamp
    }

    const deltaMs = timestamp - lastFrameAt
    lastFrameAt = timestamp
    const nextMs = currentMs.value + deltaMs * playbackRate.value

    if (nextMs >= endedMs.value) {
      currentMs.value = endedMs.value
      isPlaying.value = false
      stopFrameLoop()
      return
    }

    currentMs.value = nextMs
    scheduleFrame()
  }

  watch(
    preparedSamples,
    (samples) => {
      if (!samples.length) {
        currentMs.value = 0
        isPlaying.value = false
        stopFrameLoop()
        return
      }

      if (
        !currentMs.value ||
        currentMs.value < samples[0]!.ms ||
        currentMs.value > samples.at(-1)!.ms
      ) {
        currentMs.value = samples[0]!.ms
      }
    },
    { immediate: true },
  )

  watch(isPlaying, (playing) => {
    if (!playing) {
      stopFrameLoop()
      return
    }

    scheduleFrame()
  })

  onBeforeUnmount(() => {
    stopFrameLoop()
  })

  return {
    activeSample,
    aisContacts,
    currentMs,
    events,
    isPlaying,
    metrics,
    nearbyTraffic,
    playbackRate,
    playbackRateOptions: PLAYBACK_SPEED_OPTIONS,
    playbackSnapshot,
    progressRatio,
    resetPlayback,
    seekToEvent,
    seekToRatio,
    setPlaybackRate,
    togglePlayback,
  }
}

export function usePlaybackVessel(
  vessel: VesselCardSummary | null,
  snapshot: VesselSnapshotSummary | null,
) {
  if (!vessel || !snapshot) {
    return vessel
  }

  return {
    ...vessel,
    liveSnapshot: {
      ...snapshot,
      vesselId: vessel.id,
    },
    latestPassage: vessel.latestPassage,
  } satisfies VesselCardSummary
}
