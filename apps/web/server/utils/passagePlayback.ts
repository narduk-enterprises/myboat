import type { H3Event } from 'h3'
import { and, eq } from 'drizzle-orm'
import { passageAisVessels, passages } from '#server/database/app-schema'
import { useAppDatabase } from '#server/utils/database'
import type {
  PassagePlaybackBundle,
  PassagePlaybackGeojson,
  PassagePlaybackSelfSample,
  PassagePlaybackSummary,
  PassagePlaybackTrafficVessel,
} from '~/types/passagePlayback'
import type { PassageAisProfileV1, PassageAisSample } from '~/types/passageTraffic'

function safeJsonParse<T>(value: string | null | undefined): T | null {
  if (!value?.trim()) {
    return null
  }

  try {
    return JSON.parse(value) as T
  } catch {
    return null
  }
}

function toNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
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

function calculateBearingDegrees(lat1: number, lon1: number, lat2: number, lon2: number) {
  const toRadians = Math.PI / 180
  const toDegrees = 180 / Math.PI
  const y = Math.sin((lon2 - lon1) * toRadians) * Math.cos(lat2 * toRadians)
  const x =
    Math.cos(lat1 * toRadians) * Math.sin(lat2 * toRadians) -
    Math.sin(lat1 * toRadians) * Math.cos(lat2 * toRadians) * Math.cos((lon2 - lon1) * toRadians)

  return (Math.atan2(y, x) * toDegrees + 360) % 360
}

function normalizeGeojson(value: string | null | undefined): PassagePlaybackGeojson | null {
  const parsed = safeJsonParse<Record<string, unknown>>(value)
  if (!parsed || typeof parsed.type !== 'string') {
    return null
  }

  if (parsed.type === 'FeatureCollection' && Array.isArray(parsed.features)) {
    return parsed as unknown as PassagePlaybackGeojson
  }

  if (parsed.type === 'Feature' && parsed.geometry && typeof parsed.geometry === 'object') {
    return {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: parsed.geometry as PassagePlaybackGeojson['features'][number]['geometry'],
          properties:
            parsed.properties && typeof parsed.properties === 'object'
              ? (parsed.properties as Record<string, unknown>)
              : {},
        },
      ],
    }
  }

  if ('coordinates' in parsed) {
    return {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: {
            type: parsed.type,
            coordinates: parsed.coordinates,
          } as PassagePlaybackGeojson['features'][number]['geometry'],
          properties: { kind: 'voyage-track' },
        },
      ],
    }
  }

  return null
}

function extractLineCoordinates(track: PassagePlaybackGeojson | null) {
  const coordinates = track?.features.find((feature) => feature.geometry.type === 'LineString')
    ?.geometry.coordinates

  if (!Array.isArray(coordinates)) {
    return []
  }

  return coordinates
    .map((value) => {
      if (!Array.isArray(value) || value.length < 2) {
        return null
      }

      const lon = toNumber(value[0])
      const lat = toNumber(value[1])
      if (lat == null || lon == null) {
        return null
      }

      return { lat, lon }
    })
    .filter((value): value is { lat: number; lon: number } => Boolean(value))
}

function readWindowValue(value: unknown) {
  return typeof value === 'string' && value.trim().length > 0 ? value : null
}

function normalizeSelfSamples(value: unknown): PassagePlaybackSelfSample[] {
  if (!Array.isArray(value)) {
    return []
  }

  const out: PassagePlaybackSelfSample[] = []

  for (const sample of value) {
    if (!sample || typeof sample !== 'object') {
      continue
    }

    const record = sample as Record<string, unknown>
    if (typeof record.t !== 'string') {
      continue
    }

    const lat = toNumber(record.lat)
    const lon = toNumber(record.lon)
    if (lat == null || lon == null) {
      continue
    }

    out.push({
      t: record.t,
      lat,
      lon,
      sog: toNumber(record.sog),
      cog: toNumber(record.cog),
      headingTrue: toNumber(record.headingTrue) ?? toNumber(record.hdg),
      speedThroughWater: toNumber(record.speedThroughWater) ?? toNumber(record.stw),
      depth: toNumber(record.depth),
      waterTempC: toNumber(record.waterTempC),
      airTempC: toNumber(record.airTempC),
      windAppSpeedKts: toNumber(record.windAppSpeedKts),
      windAppAngleDeg: toNumber(record.windAppAngleDeg),
      windTrueSpeedKts: toNumber(record.windTrueSpeedKts) ?? toNumber(record.windKts),
      windTrueDirectionDeg: toNumber(record.windTrueDirectionDeg) ?? toNumber(record.windDir),
      portRpm: toNumber(record.portRpm),
      starboardRpm: toNumber(record.starboardRpm),
      barometerHpa: toNumber(record.barometerHpa),
    })
  }

  out.sort((left, right) => left.t.localeCompare(right.t))
  return out
}

function buildSyntheticSelfSamples(row: {
  startedAt: string
  endedAt: string | null
  trackGeojson: string | null
}) {
  const track = normalizeGeojson(row.trackGeojson)
  const points = extractLineCoordinates(track)
  if (!points.length) {
    return []
  }

  const startedMs = Date.parse(row.startedAt)
  const baseMs = Number.isFinite(startedMs) ? startedMs : Date.now()
  const endedMs = row.endedAt ? Date.parse(row.endedAt) : Number.NaN
  const fallbackDurationMs = Math.max((points.length - 1) * 300_000, 0)
  const durationMs =
    Number.isFinite(endedMs) && endedMs > baseMs ? endedMs - baseMs : fallbackDurationMs
  const stepMs = points.length > 1 ? durationMs / (points.length - 1) : 0
  const stepHours = stepMs > 0 ? stepMs / 3_600_000 : 0

  return points.map((point, index) => {
    const previous = points[index - 1] || null
    const next = points[index + 1] || null
    const distanceNm = next
      ? haversineNm(point.lat, point.lon, next.lat, next.lon)
      : previous
        ? haversineNm(previous.lat, previous.lon, point.lat, point.lon)
        : 0
    const course = next
      ? calculateBearingDegrees(point.lat, point.lon, next.lat, next.lon)
      : previous
        ? calculateBearingDegrees(previous.lat, previous.lon, point.lat, point.lon)
        : null
    const sog = stepHours > 0 ? distanceNm / stepHours : 0

    return {
      t: new Date(baseMs + stepMs * index).toISOString(),
      lat: point.lat,
      lon: point.lon,
      sog,
      cog: course,
      headingTrue: course,
      speedThroughWater: sog,
      depth: null,
      waterTempC: null,
      airTempC: null,
      windAppSpeedKts: null,
      windAppAngleDeg: null,
      windTrueSpeedKts: null,
      windTrueDirectionDeg: null,
      portRpm: null,
      starboardRpm: null,
      barometerHpa: null,
    } satisfies PassagePlaybackSelfSample
  })
}

function normalizeTrafficProfile(value: unknown): PassageAisProfileV1 | null {
  if (!value || typeof value !== 'object') {
    return null
  }

  const record = value as Record<string, unknown>
  if (typeof record.mmsi !== 'string') {
    return null
  }

  return {
    v: 1,
    contextUrn: typeof record.contextUrn === 'string' ? record.contextUrn : '',
    mmsi: record.mmsi,
    name: typeof record.name === 'string' ? record.name : null,
    shipTypeId: toNumber(record.shipTypeId),
    shipTypeName: typeof record.shipTypeName === 'string' ? record.shipTypeName : null,
    lengthM: toNumber(record.lengthM),
    beamM: toNumber(record.beamM),
    draftM: toNumber(record.draftM),
    destination: typeof record.destination === 'string' ? record.destination : null,
    aisClass: typeof record.aisClass === 'string' ? record.aisClass : null,
    note: typeof record.note === 'string' ? record.note : undefined,
  }
}

function normalizeTrafficSamples(value: unknown): PassageAisSample[] {
  if (!Array.isArray(value)) {
    return []
  }

  const out: PassageAisSample[] = []

  for (const sample of value) {
    if (!sample || typeof sample !== 'object') {
      continue
    }

    const record = sample as Record<string, unknown>
    if (typeof record.t !== 'string') {
      continue
    }

    const lat = toNumber(record.lat)
    const lon = toNumber(record.lon)
    if (lat == null || lon == null) {
      continue
    }

    out.push({
      t: record.t,
      lat,
      lon,
      sog: toNumber(record.sog),
      cog: toNumber(record.cog),
      hdg: toNumber(record.hdg) ?? toNumber(record.headingTrue),
    })
  }

  out.sort((left, right) => left.t.localeCompare(right.t))
  return out
}

function normalizeTrafficVessels(value: unknown): PassagePlaybackTrafficVessel[] {
  if (!Array.isArray(value)) {
    return []
  }

  const out: PassagePlaybackTrafficVessel[] = []

  for (const vessel of value) {
    if (!vessel || typeof vessel !== 'object') {
      continue
    }

    const record = vessel as Record<string, unknown>
    const profile = normalizeTrafficProfile(record.profile)
    if (!profile) {
      continue
    }

    out.push({
      profile,
      samples: normalizeTrafficSamples(record.samples),
    })
  }

  return out
}

function computeAverage(values: number[]) {
  if (!values.length) {
    return null
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function normalizeSummary(
  row: {
    startedAt: string
    endedAt: string | null
    distanceNm: number | null
  },
  rawSummary: Record<string, unknown> | null,
  samples: PassagePlaybackSelfSample[],
): PassagePlaybackSummary {
  const sogValues = samples
    .map((sample) => sample.sog)
    .filter((value): value is number => value != null)

  const durationMs = (() => {
    const startedMs = Date.parse(row.startedAt)
    const endedMs = row.endedAt ? Date.parse(row.endedAt) : Number.NaN
    if (Number.isFinite(startedMs) && Number.isFinite(endedMs) && endedMs > startedMs) {
      return endedMs - startedMs
    }

    const sampleStartedMs = samples[0] ? Date.parse(samples[0].t) : Number.NaN
    const sampleEndedMs = samples.at(-1) ? Date.parse(samples.at(-1)!.t) : Number.NaN
    if (
      Number.isFinite(sampleStartedMs) &&
      Number.isFinite(sampleEndedMs) &&
      sampleEndedMs > sampleStartedMs
    ) {
      return sampleEndedMs - sampleStartedMs
    }

    return 0
  })()

  return {
    distanceNm: toNumber(rawSummary?.distanceNm) ?? row.distanceNm ?? 0,
    durationHours: toNumber(rawSummary?.durationHours) ?? durationMs / 3_600_000,
    avgSog: toNumber(rawSummary?.avgSog) ?? computeAverage(sogValues),
    maxSog: toNumber(rawSummary?.maxSog) ?? (sogValues.length ? Math.max(...sogValues) : null),
    startBearing: toNumber(rawSummary?.startBearing),
    endBearing: toNumber(rawSummary?.endBearing),
  }
}

function extractEndpoints(
  track: PassagePlaybackGeojson | null,
  samples: PassagePlaybackSelfSample[],
): { startLat: number; startLon: number; endLat: number; endLon: number } | null {
  const firstSample = samples[0]
  const lastSample = samples.at(-1)
  if (firstSample && lastSample) {
    return {
      startLat: firstSample.lat,
      startLon: firstSample.lon,
      endLat: lastSample.lat,
      endLon: lastSample.lon,
    }
  }

  const lineCoordinates = track?.features.find((feature) => feature.geometry.type === 'LineString')
    ?.geometry.coordinates as Array<[number, number]> | undefined

  const firstPoint = lineCoordinates?.[0]
  const lastPoint = lineCoordinates?.at(-1)
  if (firstPoint && lastPoint) {
    return {
      startLat: firstPoint[1],
      startLon: firstPoint[0],
      endLat: lastPoint[1],
      endLon: lastPoint[0],
    }
  }

  return null
}

export async function getPassagePlaybackBundleForVessel(
  event: H3Event,
  vesselId: string,
  passageId: string,
): Promise<PassagePlaybackBundle | null> {
  const db = useAppDatabase(event)
  const row = await db
    .select({
      id: passages.id,
      vesselId: passages.vesselId,
      title: passages.title,
      startedAt: passages.startedAt,
      endedAt: passages.endedAt,
      distanceNm: passages.distanceNm,
      departureName: passages.departureName,
      arrivalName: passages.arrivalName,
      startPlaceLabel: passages.startPlaceLabel,
      endPlaceLabel: passages.endPlaceLabel,
      trackGeojson: passages.trackGeojson,
      playbackJson: passages.playbackJson,
    })
    .from(passages)
    .where(and(eq(passages.id, passageId), eq(passages.vesselId, vesselId)))
    .get()

  if (!row) {
    return null
  }

  const rawPlayback = safeJsonParse<Record<string, unknown>>(row.playbackJson)
  const overviewTrackGeojson = normalizeGeojson(row.trackGeojson)
  const rawSamples =
    rawPlayback?.self && typeof rawPlayback.self === 'object'
      ? (rawPlayback.self as Record<string, unknown>).samples
      : rawPlayback?.samples
  const normalizedSamples = normalizeSelfSamples(rawSamples)
  const selfSamples = normalizedSamples.length
    ? normalizedSamples
    : buildSyntheticSelfSamples({
        startedAt: row.startedAt,
        endedAt: row.endedAt,
        trackGeojson: row.trackGeojson,
      })
  const rawTraffic =
    rawPlayback?.traffic && typeof rawPlayback.traffic === 'object'
      ? (rawPlayback.traffic as Record<string, unknown>).vessels
      : rawPlayback?.vessels

  const trafficRows = await db
    .select({
      passageId: passageAisVessels.passageId,
      mmsi: passageAisVessels.mmsi,
      profileJson: passageAisVessels.profileJson,
      samplesJson: passageAisVessels.samplesJson,
    })
    .from(passageAisVessels)
    .where(eq(passageAisVessels.passageId, passageId))
    .all()

  const storedTraffic = trafficRows.flatMap((trafficRow) => {
    const profile = normalizeTrafficProfile(safeJsonParse(trafficRow.profileJson))
    if (!profile) {
      return []
    }

    return [
      {
        profile,
        samples: normalizeTrafficSamples(safeJsonParse(trafficRow.samplesJson)),
      },
    ]
  })

  const trafficVessels =
    storedTraffic.length > 0 ? storedTraffic : normalizeTrafficVessels(rawTraffic)

  if (!rawPlayback && selfSamples.length === 0 && trafficVessels.length === 0) {
    return null
  }
  const endpoints = extractEndpoints(overviewTrackGeojson, selfSamples)
  const rawSummary =
    rawPlayback?.summary && typeof rawPlayback.summary === 'object'
      ? (rawPlayback.summary as Record<string, unknown>)
      : null

  return {
    v: Number(rawPlayback?.v || 1),
    id: row.id,
    title: row.title,
    startedAt: row.startedAt,
    endedAt: row.endedAt || row.startedAt,
    startLat: endpoints?.startLat ?? 0,
    startLon: endpoints?.startLon ?? 0,
    endLat: endpoints?.endLat ?? endpoints?.startLat ?? 0,
    endLon: endpoints?.endLon ?? endpoints?.startLon ?? 0,
    startPlaceLabel: row.startPlaceLabel || row.departureName,
    endPlaceLabel: row.endPlaceLabel || row.arrivalName,
    overviewTrackGeojson,
    summary: normalizeSummary(row, rawSummary, selfSamples),
    self: {
      window:
        readWindowValue(
          rawPlayback?.self && typeof rawPlayback.self === 'object'
            ? (rawPlayback.self as Record<string, unknown>).window
            : null,
        ) ||
        readWindowValue(rawPlayback?.selfWindow) ||
        readWindowValue(rawPlayback?.trackWindow) ||
        (normalizedSamples.length ? null : 'synthetic-track'),
      samples: selfSamples,
    },
    traffic: {
      window:
        readWindowValue(
          rawPlayback?.traffic && typeof rawPlayback.traffic === 'object'
            ? (rawPlayback.traffic as Record<string, unknown>).window
            : null,
        ) || readWindowValue(rawPlayback?.trackWindow),
      vessels: trafficVessels,
    },
    source: 'd1-compact',
    note: typeof rawPlayback?.note === 'string' ? rawPlayback.note : null,
  }
}
