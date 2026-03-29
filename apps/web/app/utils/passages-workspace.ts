import type { LocationQuery, LocationQueryRaw, LocationQueryValueRaw } from 'vue-router'
import type { PassageSummary } from '~/types/myboat'
import { buildPassageDisplayRoute, buildPassageDisplayTitle } from './passage-display'

export type PassageWorkspaceSortMode = 'date' | 'distance'

export function buildPassageSearchText(passage: PassageSummary) {
  return [
    passage.title,
    passage.summary,
    passage.departureName,
    passage.arrivalName,
    passage.startPlaceLabel,
    passage.endPlaceLabel,
    buildPassageDisplayTitle(passage),
    buildPassageDisplayRoute(passage),
    passage.distanceNm !== null && passage.distanceNm !== undefined
      ? `${passage.distanceNm.toFixed(1)} nm`
      : null,
  ]
    .filter((value): value is string => Boolean(value))
    .join(' ')
    .toLowerCase()
}

export function filterPassages(passages: PassageSummary[], query: string) {
  const normalizedQuery = query.trim().toLowerCase()
  if (!normalizedQuery) {
    return passages
  }

  return passages.filter((passage) => buildPassageSearchText(passage).includes(normalizedQuery))
}

export function sortPassages(passages: PassageSummary[], sortMode: PassageWorkspaceSortMode) {
  return [...passages].sort((left, right) => {
    if (sortMode === 'distance') {
      const distanceDelta = (right.distanceNm || 0) - (left.distanceNm || 0)
      if (distanceDelta !== 0) {
        return distanceDelta
      }
    }

    const startedDelta = Date.parse(right.startedAt) - Date.parse(left.startedAt)
    if (startedDelta !== 0) {
      return startedDelta
    }

    return left.title.localeCompare(right.title)
  })
}

export function resolveSelectedPassageId(
  passages: PassageSummary[],
  selectedPassageId: string | null | undefined,
) {
  if (!selectedPassageId) {
    return null
  }

  return passages.some((passage) => passage.id === selectedPassageId) ? selectedPassageId : null
}

export function buildPassageSelectionQuery(
  query: LocationQuery | LocationQueryRaw,
  selectedPassageId: string | null,
  queryKey = 'p',
) {
  const entries = Object.entries(query)
    .filter(([key]) => key !== queryKey)
    .map(([key, value]) => [key, value as LocationQueryValueRaw | LocationQueryValueRaw[]] as const)

  if (selectedPassageId) {
    entries.push([queryKey, selectedPassageId])
  }

  return Object.fromEntries(entries) as LocationQueryRaw
}
