import type { FollowedVesselSummary } from '~/types/myboat'

function toSortableTimestamp(value: string) {
  const timestamp = Date.parse(value)
  return Number.isNaN(timestamp) ? 0 : timestamp
}

function sortFollowedVessels(items: FollowedVesselSummary[]) {
  return [...items].sort((left, right) => {
    const updatedDelta = toSortableTimestamp(right.updatedAt) - toSortableTimestamp(left.updatedAt)

    if (updatedDelta !== 0) {
      return updatedDelta
    }

    return toSortableTimestamp(right.createdAt) - toSortableTimestamp(left.createdAt)
  })
}

export function useFollowedVesselsState() {
  const items = shallowRef<FollowedVesselSummary[]>([])

  function mergeItems(nextItems: FollowedVesselSummary[]) {
    return [ ...nextItems, ...items.value ].filter(
      (item, index, collection) =>
        collection.findIndex(
          (candidate) => candidate.id === item.id || candidate.mmsi === item.mmsi,
        ) === index,
    )
  }

  function setItems(nextItems: FollowedVesselSummary[]) {
    items.value = sortFollowedVessels(nextItems)
  }

  function upsertItem(nextItem: FollowedVesselSummary) {
    setItems(mergeItems([nextItem]))
  }

  function upsertItems(nextItems: FollowedVesselSummary[]) {
    setItems(mergeItems(nextItems))
  }

  function removeItem(id: string) {
    items.value = items.value.filter((item) => item.id !== id)
  }

  return {
    items,
    removeItem,
    setItems,
    upsertItem,
    upsertItems,
  }
}
