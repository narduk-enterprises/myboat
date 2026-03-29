<script setup lang="ts">
import type {
  AisHubSearchResponse,
  AisHubSearchResult,
  FollowedVesselRefreshResponse,
  FollowedVesselSummary,
} from '~/types/myboat'
import { formatRelativeTime, formatTimestamp } from '~/utils/marine'

const props = defineProps<{
  items: FollowedVesselSummary[]
}>()

const emit = defineEmits<{
  imported: [vessels: FollowedVesselSummary[]]
  removed: [id: string]
  refreshed: [vessels: FollowedVesselSummary[]]
  saved: [vessel: FollowedVesselSummary]
}>()

const toast = useToast()
const { followVessel, pending: followPending } = useFollowVessel()
const { refreshFollowedVessels, pending: refreshPending } = useRefreshFollowedVessels()
const { removeFollowedVessel, pending: removePending } = useRemoveFollowedVessel()
const { search, pending: searchPending } = useSearchAisHubVessels()

const query = shallowRef('')
const results = shallowRef<AisHubSearchResult[]>([])
const searchSource = shallowRef<AisHubSearchResponse['source'] | null>(null)
const searchCachedAt = shallowRef<AisHubSearchResponse['cachedAt']>(null)
const activeAddMmsi = shallowRef<string | null>(null)
const activeRemoveId = shallowRef<string | null>(null)
const errorMessage = shallowRef<string | null>(null)
const emptyMessage = shallowRef<string | null>(null)

const trimmedQuery = computed(() => query.value.trim())
const followedMmsis = computed(() => new Set(props.items.map((item) => item.mmsi)))
const hasSearched = computed(
  () =>
    searchSource.value !== null ||
    errorMessage.value !== null ||
    emptyMessage.value !== null ||
    results.value.length > 0,
)

const currentColumns = [
  { accessorKey: 'name', header: 'Buddy boat' },
  { accessorKey: 'destination', header: 'Destination' },
  { accessorKey: 'lastReportAt', header: 'Last report' },
  { accessorKey: 'sourceStations', header: 'Source' },
  { id: 'actions', header: '' },
]

const resultColumns = [
  { accessorKey: 'name', header: 'Search result' },
  { accessorKey: 'matchMode', header: 'Match' },
  { accessorKey: 'destination', header: 'Destination' },
  { accessorKey: 'lastReportAt', header: 'Last report' },
  { id: 'actions', header: '' },
]

const sourceTone = computed(() => {
  if (searchSource.value === 'upstream') return 'primary'
  if (searchSource.value === 'cache') return 'neutral'
  return 'warning'
})

const sourceLabel = computed(() => {
  if (searchSource.value === 'upstream') return 'Live AIS Hub'
  if (searchSource.value === 'cache') return 'AIS Hub cache'
  if (searchSource.value === 'local') return 'Local library'
  return 'Ready'
})

const sourceDescription = computed(() => {
  if (!searchSource.value) {
    return 'Search MMSI, name, call sign, destination, or IMO, then add the boats you want inline.'
  }

  if (searchSource.value === 'local') {
    return searchCachedAt.value
      ? `Matched locally · stored ${formatTimestamp(searchCachedAt.value)}`
      : 'Matched locally across stored AIS fields.'
  }

  if (searchSource.value === 'cache') {
    return `Served from query cache · ${formatTimestamp(searchCachedAt.value)}`
  }

  return `Pulled from AIS Hub and stored locally · ${formatTimestamp(searchCachedAt.value)}`
})

function getErrorMessage(error: unknown) {
  if (error && typeof error === 'object') {
    const maybeError = error as {
      data?: { statusMessage?: string; message?: string }
      message?: string
      statusMessage?: string
    }

    return (
      maybeError.data?.statusMessage ||
      maybeError.statusMessage ||
      maybeError.data?.message ||
      maybeError.message ||
      'Request failed.'
    )
  }

  return 'Request failed.'
}

function canQueryUpstream(value: string) {
  const compactDigits = value.replaceAll(/\s+/g, '')
  return /^\d{9}$/.test(compactDigits) || value.length >= 3
}

function countMappedVessels(items: FollowedVesselSummary[]) {
  return items.filter((item) => item.positionLat !== null && item.positionLng !== null).length
}

function describeRefresh(response: FollowedVesselRefreshResponse) {
  if (response.source === 'cooldown') {
    const retryAfterSeconds = Math.max(1, Math.ceil((response.retryAfterMs || 0) / 1000))
    return {
      color: 'warning' as const,
      description: `AIS Hub only allows one lookup per minute. Try again in ${retryAfterSeconds}s.`,
      title: 'Refresh cooling down',
    }
  }

  if (response.source === 'local') {
    return {
      color: 'neutral' as const,
      description: 'Stored AIS data is still in use. No fresh upstream lookup ran this time.',
      title: 'No new AIS data yet',
    }
  }

  const mappedCount = countMappedVessels(response.followedVessels)
  return {
    color: 'success' as const,
    description: `${mappedCount} saved buddy boats currently have positions after the refresh.`,
    title: `Refreshed ${response.resolvedCount} of ${response.requestedCount} saved boats`,
  }
}

function buildEmptyMessage(value: string, source: AisHubSearchResponse['source']) {
  if (source === 'local' && !canQueryUpstream(value)) {
    return 'No local matches yet. Keep typing until you have at least 3 characters, or enter an exact 9-digit MMSI to pull from AIS Hub.'
  }

  if (source === 'local') {
    return 'No matches in the local AIS library yet.'
  }

  return 'AIS Hub returned no boats for that query.'
}

async function onSearch() {
  if (!trimmedQuery.value) {
    return
  }

  errorMessage.value = null
  emptyMessage.value = null

  try {
    const response = await search(trimmedQuery.value)
    results.value = response.results
    searchSource.value = response.source
    searchCachedAt.value = response.cachedAt
    emptyMessage.value = response.results.length
      ? null
      : buildEmptyMessage(trimmedQuery.value, response.source)
  } catch (error) {
    errorMessage.value = getErrorMessage(error)
    results.value = []
    searchSource.value = null
    searchCachedAt.value = null
  }
}

async function onAdd(result: AisHubSearchResult) {
  activeAddMmsi.value = result.mmsi

  try {
    const response = await followVessel(result)
    toast.add({
      title: 'Buddy boat saved',
      description: `${result.name} now appears on the captain page.`,
      color: 'success',
    })
    emit('saved', response.followedVessel)
  } catch (error) {
    toast.add({
      title: 'Unable to save buddy boat',
      description: getErrorMessage(error),
      color: 'error',
    })
  } finally {
    activeAddMmsi.value = null
  }
}

async function onRemove(id: string) {
  activeRemoveId.value = id

  try {
    await removeFollowedVessel({ id })
    toast.add({
      title: 'Buddy boat removed',
      description: 'The captain page no longer surfaces that boat.',
      color: 'success',
    })
    emit('removed', id)
  } catch (error) {
    toast.add({
      title: 'Unable to remove buddy boat',
      description: getErrorMessage(error),
      color: 'error',
    })
  } finally {
    activeRemoveId.value = null
  }
}

async function onRefresh() {
  try {
    const response = await refreshFollowedVessels()
    emit('refreshed', response.followedVessels)

    const toastConfig = describeRefresh(response)
    toast.add(toastConfig)
  } catch (error) {
    toast.add({
      title: 'Unable to refresh AIS data',
      description: getErrorMessage(error),
      color: 'error',
    })
  }
}
</script>

<template>
  <div class="space-y-6">
    <section class="space-y-3">
      <div>
        <p class="text-sm font-medium text-default">Search AIS Hub</p>
        <p class="mt-1 text-sm text-muted">
          Find more buddy boats and add them inline without leaving the chart page.
        </p>
      </div>

      <div class="flex flex-col gap-3 sm:flex-row">
        <UInput
          v-model="query"
          class="w-full"
          size="xl"
          icon="i-lucide-search"
          placeholder="Search MMSI, name, call sign, destination, or IMO"
          :loading="searchPending"
          @keydown.enter.prevent="onSearch"
        />

        <UButton
          color="primary"
          icon="i-lucide-search"
          size="xl"
          :loading="searchPending"
          :disabled="!trimmedQuery"
          @click="onSearch"
        >
          Search
        </UButton>
      </div>
    </section>

    <UCard class="border-default/80 bg-default/90 shadow-card">
      <template #header>
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 class="font-display text-xl text-default">Search results</h3>
            <p class="mt-1 text-sm text-muted">
              {{ sourceDescription }}
            </p>
          </div>

          <div class="flex flex-wrap items-center gap-2">
            <UBadge :color="sourceTone" variant="soft">{{ sourceLabel }}</UBadge>
            <UBadge color="neutral" variant="soft">{{ results.length }} results</UBadge>
          </div>
        </div>
      </template>

      <div class="space-y-4">
        <UAlert
          v-if="errorMessage"
          color="error"
          variant="soft"
          title="Search unavailable"
          :description="errorMessage"
        />

        <UAlert
          v-else-if="emptyMessage"
          color="warning"
          variant="soft"
          title="No matches"
          :description="emptyMessage"
        />

        <UTable
          v-else-if="results.length || searchPending"
          :data="results"
          :columns="resultColumns"
          :loading="searchPending"
          sticky="header"
        >
          <template #name-cell="{ row }">
            <div class="min-w-0">
              <p class="font-medium text-default">{{ row.original.name }}</p>
              <p class="mt-1 text-xs text-muted">
                MMSI {{ row.original.mmsi }}
                <span v-if="row.original.callSign"> · {{ row.original.callSign }}</span>
                <span v-if="row.original.imo"> · IMO {{ row.original.imo }}</span>
              </p>
            </div>
          </template>

          <template #matchMode-cell="{ row }">
            <div class="flex flex-wrap gap-2">
              <UBadge
                :color="row.original.matchMode === 'mmsi' ? 'primary' : 'neutral'"
                variant="soft"
              >
                {{ row.original.matchMode === 'mmsi' ? 'Exact MMSI' : 'Text match' }}
              </UBadge>
              <UBadge v-if="row.original.sourceStations.length" color="neutral" variant="soft">
                {{ row.original.sourceStations.length }} stations
              </UBadge>
            </div>
          </template>

          <template #destination-cell="{ row }">
            <span class="text-sm text-muted">
              {{ row.original.destination || 'No destination published' }}
            </span>
          </template>

          <template #lastReportAt-cell="{ row }">
            <div class="text-sm">
              <p class="font-medium text-default">
                {{ formatRelativeTime(row.original.lastReportAt) }}
              </p>
              <p class="mt-1 text-xs text-muted">
                {{ formatTimestamp(row.original.lastReportAt) }}
              </p>
            </div>
          </template>

          <template #actions-cell="{ row }">
            <div class="flex justify-end">
              <UButton
                type="button"
                color="primary"
                icon="i-lucide-user-round-plus"
                :disabled="followedMmsis.has(row.original.mmsi)"
                :loading="followPending && activeAddMmsi === row.original.mmsi"
                @click="onAdd(row.original)"
              >
                {{ followedMmsis.has(row.original.mmsi) ? 'Saved' : 'Add' }}
              </UButton>
            </div>
          </template>

          <template #empty>
            <div class="flex items-center justify-center px-4 py-10 text-center">
              <div class="space-y-2">
                <p class="font-medium text-default">No search results yet</p>
                <p class="text-sm text-muted">
                  Run a search above to find more buddy boats to add.
                </p>
              </div>
            </div>
          </template>
        </UTable>

        <div
          v-else-if="!hasSearched"
          class="rounded-[1.35rem] border border-dashed border-default bg-elevated/50 px-4 py-5 text-sm text-muted"
        >
          Search the local AIS library first. If nothing matches and the query is an exact MMSI or
          at least three characters, the app will use one AIS Hub lookup and store the results
          locally.
        </div>
      </div>
    </UCard>

    <UCard class="border-default/80 bg-default/90 shadow-card">
      <template #header>
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 class="font-display text-xl text-default">Current buddies</h3>
            <p class="mt-1 text-sm text-muted">
              Remove boats inline and keep the captain page list clean.
            </p>
          </div>

          <div class="flex flex-wrap items-center gap-2">
            <UButton
              color="neutral"
              variant="soft"
              icon="i-lucide-refresh-cw"
              :disabled="!props.items.length"
              :loading="refreshPending"
              @click="onRefresh"
            >
              Refresh AIS data
            </UButton>
            <UBadge color="primary" variant="soft">{{ props.items.length }} saved</UBadge>
          </div>
        </div>
      </template>

      <UTable :data="props.items" :columns="currentColumns" sticky="header">
        <template #name-cell="{ row }">
          <div class="min-w-0">
            <p class="font-medium text-default">{{ row.original.name }}</p>
            <p class="mt-1 text-xs text-muted">
              MMSI {{ row.original.mmsi }}
              <span v-if="row.original.callSign"> · {{ row.original.callSign }}</span>
              <span v-if="row.original.imo"> · IMO {{ row.original.imo }}</span>
            </p>
          </div>
        </template>

        <template #destination-cell="{ row }">
          <span class="text-sm text-muted">
            {{ row.original.destination || 'No destination published' }}
          </span>
        </template>

        <template #lastReportAt-cell="{ row }">
          <div class="text-sm">
            <p class="font-medium text-default">
              {{ formatRelativeTime(row.original.lastReportAt) }}
            </p>
            <p class="mt-1 text-xs text-muted">
              {{ formatTimestamp(row.original.lastReportAt) }}
            </p>
          </div>
        </template>

        <template #sourceStations-cell="{ row }">
          <div class="text-sm">
            <p class="font-medium text-default">
              {{
                row.original.sourceStations.length
                  ? `${row.original.sourceStations.length} stations`
                  : 'API lookup'
              }}
            </p>
            <p class="mt-1 text-xs text-muted">
              {{
                row.original.matchMode === 'name'
                  ? 'Saved from the public finder.'
                  : 'Saved from MMSI lookup.'
              }}
            </p>
          </div>
        </template>

        <template #actions-cell="{ row }">
          <div class="flex justify-end">
            <UButton
              type="button"
              color="error"
              variant="ghost"
              icon="i-lucide-user-round-minus"
              :loading="removePending && activeRemoveId === row.original.id"
              @click="onRemove(row.original.id)"
            >
              Remove
            </UButton>
          </div>
        </template>

        <template #empty>
          <div class="flex items-center justify-center px-4 py-10 text-center">
            <div class="space-y-2">
              <p class="font-medium text-default">No buddy boats saved yet</p>
              <p class="text-sm text-muted">
                Search AIS Hub above and add the boats you want to keep on this page.
              </p>
            </div>
          </div>
        </template>
      </UTable>
    </UCard>

    <BuddyBoatImportPanel @imported="emit('imported', $event)" />
  </div>
</template>
