import type { PassageSummary } from '~/types/myboat'
import { resolvePassageStopLabel, buildPassageDisplayTitle } from './passage-display'

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

/**
 * Node (ICU) often formats en-US datetime as "Dec 5, 2023, 6:10 AM" while WebKit uses
 * "Dec 5, 2023 at 6:10 AM". Normalizing avoids SSR/client hydration text mismatches.
 */
function normalizeEnUsDateTimeCommaBeforeTime(formatted: string) {
  return formatted.replace(/,\s+(\d{1,2}:\d{2}(?::\d{2})?\s*(?:AM|PM))$/i, ' at $1')
}

export function formatTimestamp(
  value: string | null | undefined,
  options?: Intl.DateTimeFormatOptions,
) {
  if (!value) {
    return 'Unavailable'
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return 'Unavailable'
  }

  const formatted = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    ...options,
  }).format(date)

  return normalizeEnUsDateTimeCommaBeforeTime(formatted)
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
    .map((passage, index) => {
      try {
        const parsed = JSON.parse(passage.trackGeojson || '') as {
          type: string
          coordinates?: unknown
          geometry?: {
            type: string
            coordinates: unknown
          }
          features?: Array<{
            type: 'Feature'
            geometry?: {
              type: string
              coordinates: unknown
            }
          }>
        } | null

        const geometry =
          parsed?.type === 'FeatureCollection'
            ? parsed.features?.find((feature) => feature.geometry)?.geometry
            : parsed?.type === 'Feature'
              ? parsed.geometry
              : parsed && 'coordinates' in parsed
                ? {
                    type: parsed.type,
                    coordinates: parsed.coordinates,
                  }
                : null

        if (!geometry?.type || geometry.coordinates === undefined) {
          return null
        }

        return {
          type: 'Feature' as const,
          geometry,
          properties: {
            id: passage.id,
            name: buildPassageDisplayTitle(passage),
            departure: resolvePassageStopLabel(passage, 'start'),
            arrival: resolvePassageStopLabel(passage, 'end'),
            startedAt: passage.startedAt,
            endedAt: passage.endedAt,
            distanceNm: passage.distanceNm,
            rank: index,
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
          id: string
          name: string
          departure: string | null
          arrival: string | null
          startedAt: string
          endedAt: string | null
          distanceNm: number | null
          rank: number
        }
      } => feature !== null,
    )

  return {
    type: 'FeatureCollection' as const,
    features,
  }
}
