import type {
  PassagePlaybackSelfSample,
  PassagePlaybackTrafficVessel,
} from '~/types/passagePlayback'

export interface PassagePlaybackEventMarker {
  id: string
  label: string
  shortLabel: string
  ms: number
}

interface PreparedSelfSample extends PassagePlaybackSelfSample {
  ms: number
  cumulativeDistanceNm: number
  prefixMaxSog: number | null
  prefixSogSum: number
  prefixSogCount: number
}

export const PLAYBACK_SPEED_OPTIONS = [1, 10, 30, 120]
export const DEFAULT_TRAFFIC_FRESHNESS_MS = 20 * 60_000

export function haversineNm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const earthRadiusNm = 3440.065
  const toRadians = Math.PI / 180
  const dLat = (lat2 - lat1) * toRadians
  const dLon = (lon2 - lon1) * toRadians
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * toRadians) * Math.cos(lat2 * toRadians) * Math.sin(dLon / 2) ** 2

  return 2 * earthRadiusNm * Math.asin(Math.min(1, Math.sqrt(a)))
}

export function clamp(value: number, min: number, max: number) {
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

export function parseWindowMs(windowValue: string | null | undefined) {
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

export function formatElapsed(ms: number) {
  const totalSeconds = Math.max(0, Math.round(ms / 1000))
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  if (hours > 0) {
    return `${hours}h ${String(minutes).padStart(2, '0')}m`
  }

  return `${minutes}m ${String(seconds).padStart(2, '0')}s`
}

export function findFloorIndexByMs<T extends { ms: number }>(rows: T[], ms: number) {
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

export function findNearestTrafficSample(
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

export function prepareSelfSamples(samples: PassagePlaybackSelfSample[]) {
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

export function buildPlaybackEvents(samples: PreparedSelfSample[]) {
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

export function interpolateSample(samples: PreparedSelfSample[], currentMs: number) {
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
