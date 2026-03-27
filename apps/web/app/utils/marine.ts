import type { PassageSummary, VesselCardSummary, WaypointSummary } from '~/types/myboat'

export function formatCoordinate(value: number | null | undefined, isLatitude: boolean) {
  if (value === null || value === undefined) {
    return '--'
  }

  const absolute = Math.abs(value)
  const degrees = Math.floor(absolute)
  const minutesFloat = (absolute - degrees) * 60
  const minutes = Math.floor(minutesFloat)
  const seconds = (minutesFloat - minutes) * 60
  const suffix = isLatitude ? (value >= 0 ? 'N' : 'S') : value >= 0 ? 'E' : 'W'

  return `${degrees}°${minutes}'${seconds.toFixed(1)}"${suffix}`
}

export function formatTimestamp(
  value: string | null | undefined,
  options?: Intl.DateTimeFormatOptions,
) {
  if (!value) {
    return 'Unavailable'
  }

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    ...options,
  }).format(new Date(value))
}

export function formatRelativeTime(value: string | null | undefined) {
  if (!value) {
    return 'No telemetry yet'
  }

  const diffMs = new Date(value).getTime() - Date.now()
  const absMinutes = Math.round(Math.abs(diffMs) / 60000)

  if (absMinutes < 1) {
    return 'just now'
  }

  if (absMinutes < 60) {
    return `${absMinutes}m ${diffMs < 0 ? 'ago' : 'from now'}`
  }

  const absHours = Math.round(absMinutes / 60)
  if (absHours < 24) {
    return `${absHours}h ${diffMs < 0 ? 'ago' : 'from now'}`
  }

  const absDays = Math.round(absHours / 24)
  return `${absDays}d ${diffMs < 0 ? 'ago' : 'from now'}`
}

export function getConnectionTone(connectionState: string, lastSeenAt: string | null | undefined) {
  if (connectionState === 'live') {
    return 'success'
  }

  if (!lastSeenAt) {
    return 'neutral'
  }

  const ageMs = Date.now() - new Date(lastSeenAt).getTime()
  return ageMs < 1000 * 60 * 20 ? 'warning' : 'neutral'
}

export function buildTrackFeatureCollection(passages: PassageSummary[]) {
  const features = passages
    .filter((passage) => Boolean(passage.trackGeojson))
    .map((passage) => {
      try {
        const geometry = JSON.parse(passage.trackGeojson || '') as {
          type: string
          coordinates: unknown
        }

        return {
          type: 'Feature' as const,
          geometry,
          properties: {
            name: passage.title,
            departure: passage.departureName,
            arrival: passage.arrivalName,
          },
        }
      } catch {
        return null
      }
    })
    .filter(
      (
        feature,
      ): feature is {
        type: 'Feature'
        geometry: { type: string; coordinates: unknown }
        properties: {
          name: string
          departure: string | null
          arrival: string | null
        }
      } => feature !== null,
    )

  return {
    type: 'FeatureCollection' as const,
    features,
  }
}

export function buildWaypointPins(waypoints: WaypointSummary[]) {
  return waypoints.map((waypoint) => ({
    id: waypoint.id,
    lat: waypoint.lat,
    lng: waypoint.lng,
    title: waypoint.title,
    kind: waypoint.kind,
  }))
}

export function buildVesselPins(vessels: VesselCardSummary[]) {
  return vessels
    .filter(
      (vessel) =>
        vessel.liveSnapshot?.positionLat !== null &&
        vessel.liveSnapshot?.positionLat !== undefined &&
        vessel.liveSnapshot?.positionLng !== null &&
        vessel.liveSnapshot?.positionLng !== undefined,
    )
    .map((vessel) => ({
      id: vessel.id,
      lat: vessel.liveSnapshot!.positionLat!,
      lng: vessel.liveSnapshot!.positionLng!,
      title: vessel.name,
      kind: vessel.isPrimary ? 'primary' : 'fleet',
    }))
}
