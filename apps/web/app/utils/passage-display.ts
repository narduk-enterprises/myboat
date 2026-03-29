import type { PassageSummary } from '~/types/myboat'

interface PassageEndpoint {
  lat: number
  lng: number
}

interface CruisingStop {
  name: string
  lat: [number, number]
  lng: [number, number]
}

const CRUISING_STOPS: CruisingStop[] = [
  { name: 'Charleston', lat: [32.7, 32.85], lng: [-80.05, -79.8] },
  { name: 'Beaufort', lat: [31.95, 32.25], lng: [-80.9, -80.55] },
  { name: 'St. Augustine', lat: [29.8, 29.95], lng: [-81.4, -81.2] },
  { name: 'Palm Beach', lat: [26.68, 26.82], lng: [-80.12, -79.95] },
  { name: 'Fort Lauderdale', lat: [25.95, 26.12], lng: [-80.22, -80.0] },
  { name: 'Great Sale Cay', lat: [26.64, 26.74], lng: [-79.1, -78.9] },
  { name: 'Green Turtle Cay', lat: [26.93, 27.03], lng: [-78.3, -78.15] },
  { name: 'Marsh Harbour', lat: [26.9, 27.0], lng: [-77.62, -77.45] },
  { name: 'Hope Town', lat: [26.72, 26.82], lng: [-77.39, -77.25] },
  { name: 'Little Harbour', lat: [26.5, 26.7], lng: [-77.15, -76.9] },
  { name: 'Spanish Wells', lat: [26.3, 26.42], lng: [-77.1, -76.9] },
  { name: 'George Town', lat: [23.45, 23.58], lng: [-75.84, -75.68] },
  { name: 'Highbourne Cay', lat: [24.15, 24.25], lng: [-76.55, -76.35] },
  { name: 'Nassau', lat: [25.0, 25.15], lng: [-77.38, -77.18] },
  { name: 'Long Island', lat: [22.15, 22.45], lng: [-75.9, -75.65] },
  { name: 'Conception Island', lat: [23.28, 23.42], lng: [-75.22, -75.02] },
  { name: 'Rum Cay', lat: [23.58, 23.72], lng: [-75.42, -75.22] },
  { name: 'Cat Island', lat: [24.2, 24.4], lng: [-75.6, -75.3] },
  { name: 'North Eleuthera', lat: [25.48, 25.6], lng: [-76.85, -76.62] },
  { name: 'South Exuma', lat: [22.95, 23.1], lng: [-75.82, -75.6] },
  { name: 'Galveston', lat: [29.45, 29.65], lng: [-95.2, -94.85] },
  { name: 'Sabine Lake', lat: [30.12, 30.3], lng: [-93.35, -93.0] },
]

function parseTrackEndpoints(trackGeojson: string | null | undefined) {
  if (!trackGeojson) {
    return null
  }

  try {
    const parsed = JSON.parse(trackGeojson) as
      | {
          type?: string
          coordinates?: unknown
          geometry?: {
            type?: string
            coordinates?: unknown
          }
          features?: Array<{
            geometry?: {
              type?: string
              coordinates?: unknown
            }
          }>
        }
      | null

    const geometry =
      parsed?.type === 'FeatureCollection'
        ? parsed.features?.find((feature) => feature.geometry?.type === 'LineString')?.geometry
        : parsed?.type === 'Feature'
          ? parsed.geometry
          : parsed?.type === 'LineString'
            ? parsed
            : null

    if (geometry?.type !== 'LineString' || !Array.isArray(geometry.coordinates)) {
      return null
    }

    const coordinates = geometry.coordinates as Array<[number, number]>
    const start = coordinates[0]
    const end = coordinates.at(-1)

    if (!start || !end) {
      return null
    }

    return {
      start: { lat: start[1], lng: start[0] },
      end: { lat: end[1], lng: end[0] },
    }
  } catch {
    return null
  }
}

function withinRange(value: number, range: [number, number]) {
  return value >= Math.min(...range) && value <= Math.max(...range)
}

function lookupCruisingStop(lat: number, lng: number) {
  return (
    CRUISING_STOPS.find(
      (stop) => withinRange(lat, stop.lat) && withinRange(lng, stop.lng),
    )?.name || null
  )
}

function formatFallbackCoordinate(endpoint: PassageEndpoint | null) {
  if (!endpoint) {
    return null
  }

  const latSuffix = endpoint.lat >= 0 ? 'N' : 'S'
  const lngSuffix = endpoint.lng >= 0 ? 'E' : 'W'
  return `${Math.abs(endpoint.lat).toFixed(2)}°${latSuffix} ${Math.abs(endpoint.lng).toFixed(2)}°${lngSuffix}`
}

function getPassageEndpoint(passage: PassageSummary, edge: 'start' | 'end') {
  return parseTrackEndpoints(passage.trackGeojson)?.[edge] || null
}

export function resolvePassageStopLabel(
  passage: PassageSummary,
  edge: 'start' | 'end',
) {
  const explicit =
    edge === 'start'
      ? passage.startPlaceLabel || passage.departureName
      : passage.endPlaceLabel || passage.arrivalName

  if (explicit?.trim()) {
    return explicit.trim()
  }

  const endpoint = getPassageEndpoint(passage, edge)
  if (endpoint) {
    return lookupCruisingStop(endpoint.lat, endpoint.lng) || formatFallbackCoordinate(endpoint)
  }

  return edge === 'start' ? 'Departure' : 'Arrival'
}

export function buildPassageDisplayTitle(passage: PassageSummary | null) {
  if (!passage) {
    return 'No tracked passage yet'
  }

  const departure = resolvePassageStopLabel(passage, 'start')
  const arrival = resolvePassageStopLabel(passage, 'end')
  return `${departure} to ${arrival}`
}

export function buildPassageDisplayRoute(passage: PassageSummary | null) {
  if (!passage) {
    return 'Awaiting first logged route'
  }

  return `${resolvePassageStopLabel(passage, 'start')} → ${resolvePassageStopLabel(passage, 'end')}`
}
