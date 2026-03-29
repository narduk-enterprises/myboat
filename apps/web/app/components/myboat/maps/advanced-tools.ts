import type { VesselSnapshotSummary } from '~/types/myboat'
import type { MyBoatMapGeoJsonFeatureCollection } from './map-support'

export type MyBoatMapStyle = 'standard' | 'muted' | 'satellite' | 'hybrid'
export type MyBoatMapToolsProfile = 'none' | 'viewer' | 'navigation'

export interface MyBoatMapToolCapabilities {
  basemap: boolean
  measure: boolean
  rangeRings: boolean
  headingLine: boolean
}

export interface MyBoatMapMeasurePoint {
  lat: number
  lng: number
}

export interface MyBoatMapMeasureResult {
  bearing: number
  cardinal: string
  distNm: number
}

const EMPTY_FEATURE_COLLECTION: MyBoatMapGeoJsonFeatureCollection = {
  type: 'FeatureCollection',
  features: [],
}

const MAP_STYLE_ORDER: MyBoatMapStyle[] = ['standard', 'muted', 'satellite', 'hybrid']
const RANGE_RING_RADII_NM = [0.5, 1, 2, 5] as const

export function resolveMyBoatMapToolCapabilities(
  profile: MyBoatMapToolsProfile,
): MyBoatMapToolCapabilities {
  switch (profile) {
    case 'navigation':
      return {
        basemap: true,
        measure: true,
        rangeRings: true,
        headingLine: true,
      }
    case 'viewer':
      return {
        basemap: true,
        measure: true,
        rangeRings: false,
        headingLine: false,
      }
    default:
      return {
        basemap: false,
        measure: false,
        rangeRings: false,
        headingLine: false,
      }
  }
}

export function mapStyleLabel(style: MyBoatMapStyle) {
  switch (style) {
    case 'muted':
      return 'Muted'
    case 'satellite':
      return 'Satellite'
    case 'hybrid':
      return 'Hybrid'
    default:
      return 'Standard'
  }
}

export function nextMapStyle(style: MyBoatMapStyle): MyBoatMapStyle {
  const index = MAP_STYLE_ORDER.indexOf(style)
  return MAP_STYLE_ORDER[(index + 1) % MAP_STYLE_ORDER.length] ?? 'standard'
}

export function mapStyleFromSurfaceDefaults(showsPointsOfInterest: boolean): MyBoatMapStyle {
  return showsPointsOfInterest ? 'standard' : 'muted'
}

export function cardinalLabel(deg: number) {
  const directions = [
    'N',
    'NNE',
    'NE',
    'ENE',
    'E',
    'ESE',
    'SE',
    'SSE',
    'S',
    'SSW',
    'SW',
    'WSW',
    'W',
    'WNW',
    'NW',
    'NNW',
  ]

  return directions[Math.round(deg / 22.5) % 16] ?? 'N'
}

export function haversineNm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const earthRadiusMeters = 6_371_000
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2

  return (earthRadiusMeters * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))) / 1852
}

export function bearingTo(lat1: number, lng1: number, lat2: number, lng2: number) {
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const y = Math.sin(dLng) * Math.cos((lat2 * Math.PI) / 180)
  const x =
    Math.cos((lat1 * Math.PI) / 180) * Math.sin((lat2 * Math.PI) / 180) -
    Math.sin((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.cos(dLng)

  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360
}

export function projectPointFromLatLng(
  lat: number,
  lng: number,
  bearingDeg: number,
  distanceNm: number,
) {
  const earthRadiusNm = 3440.065
  const angularDistance = distanceNm / earthRadiusNm
  const bearing = (bearingDeg * Math.PI) / 180
  const lat1 = (lat * Math.PI) / 180
  const lng1 = (lng * Math.PI) / 180

  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(angularDistance) +
      Math.cos(lat1) * Math.sin(angularDistance) * Math.cos(bearing),
  )

  const lng2 =
    lng1 +
    Math.atan2(
      Math.sin(bearing) * Math.sin(angularDistance) * Math.cos(lat1),
      Math.cos(angularDistance) - Math.sin(lat1) * Math.sin(lat2),
    )

  return [(lng2 * 180) / Math.PI, (lat2 * 180) / Math.PI] as const
}

export function buildMeasureResult(points: MyBoatMapMeasurePoint[]): MyBoatMapMeasureResult | null {
  if (points.length < 2) {
    return null
  }

  const [start, end] = points
  if (!start || !end) {
    return null
  }

  const bearing = bearingTo(start.lat, start.lng, end.lat, end.lng)
  return {
    bearing,
    cardinal: cardinalLabel(bearing),
    distNm: haversineNm(start.lat, start.lng, end.lat, end.lng),
  }
}

export function mergeFeatureCollections(
  ...collections: Array<MyBoatMapGeoJsonFeatureCollection | null | undefined>
): MyBoatMapGeoJsonFeatureCollection {
  return {
    type: 'FeatureCollection',
    features: collections.flatMap((collection) => collection?.features ?? []),
  }
}

export function buildMeasureFeatureCollection(
  points: MyBoatMapMeasurePoint[],
): MyBoatMapGeoJsonFeatureCollection {
  if (points.length < 2) {
    return EMPTY_FEATURE_COLLECTION
  }

  const [start, end] = points
  if (!start || !end) {
    return EMPTY_FEATURE_COLLECTION
  }

  return {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: {
          featureKind: 'measure-line',
        },
        geometry: {
          type: 'LineString',
          coordinates: [
            [start.lng, start.lat],
            [end.lng, end.lat],
          ],
        },
      },
    ],
  }
}

export function buildRangeRingFeatureCollection(
  snapshot: Pick<VesselSnapshotSummary, 'positionLat' | 'positionLng'> | null | undefined,
): MyBoatMapGeoJsonFeatureCollection {
  if (
    !snapshot ||
    snapshot.positionLat === null ||
    snapshot.positionLat === undefined ||
    snapshot.positionLng === null ||
    snapshot.positionLng === undefined
  ) {
    return EMPTY_FEATURE_COLLECTION
  }

  return {
    type: 'FeatureCollection',
    features: RANGE_RING_RADII_NM.map((radiusNm) => {
      const ringCoordinates: Array<readonly [number, number]> = []
      const pointCount = 72

      for (let index = 0; index <= pointCount; index += 1) {
        const angle = (360 / pointCount) * index
        ringCoordinates.push(
          projectPointFromLatLng(snapshot.positionLat!, snapshot.positionLng!, angle, radiusNm),
        )
      }

      return {
        type: 'Feature' as const,
        properties: {
          featureKind: 'range-ring',
          radiusNm,
        },
        geometry: {
          type: 'LineString' as const,
          coordinates: ringCoordinates,
        },
      }
    }),
  }
}

function angleDifference(left: number, right: number) {
  return Math.abs(((((left - right) % 360) + 540) % 360) - 180)
}

export function buildHeadingAidFeatureCollection(
  snapshot:
    | (Pick<
        VesselSnapshotSummary,
        'headingMagnetic' | 'positionLat' | 'positionLng' | 'speedOverGround'
      > & { courseOverGround?: number | null })
    | null
    | undefined,
): MyBoatMapGeoJsonFeatureCollection {
  if (
    !snapshot ||
    snapshot.positionLat === null ||
    snapshot.positionLat === undefined ||
    snapshot.positionLng === null ||
    snapshot.positionLng === undefined ||
    snapshot.headingMagnetic === null ||
    snapshot.headingMagnetic === undefined
  ) {
    return EMPTY_FEATURE_COLLECTION
  }

  const speedOverGround = snapshot.speedOverGround ?? 0
  const distanceNm = Math.max(speedOverGround * 0.5, 0.5)
  const [headingLng, headingLat] = projectPointFromLatLng(
    snapshot.positionLat,
    snapshot.positionLng,
    snapshot.headingMagnetic,
    distanceNm,
  )

  const features: MyBoatMapGeoJsonFeatureCollection['features'] = [
    {
      type: 'Feature',
      properties: {
        aidKind: 'heading',
        featureKind: 'heading-aid',
      },
      geometry: {
        type: 'LineString',
        coordinates: [
          [snapshot.positionLng, snapshot.positionLat],
          [headingLng, headingLat],
        ],
      },
    },
  ]

  if (
    snapshot.courseOverGround !== null &&
    snapshot.courseOverGround !== undefined &&
    angleDifference(snapshot.courseOverGround, snapshot.headingMagnetic) > 3
  ) {
    const [courseLng, courseLat] = projectPointFromLatLng(
      snapshot.positionLat,
      snapshot.positionLng,
      snapshot.courseOverGround,
      distanceNm,
    )

    features.push({
      type: 'Feature',
      properties: {
        aidKind: 'course',
        featureKind: 'heading-aid',
      },
      geometry: {
        type: 'LineString',
        coordinates: [
          [snapshot.positionLng, snapshot.positionLat],
          [courseLng, courseLat],
        ],
      },
    })
  }

  return {
    type: 'FeatureCollection',
    features,
  }
}
