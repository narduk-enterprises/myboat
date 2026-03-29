<script setup lang="ts">
import { z } from 'zod'
import type {
  AisHubSearchResult,
  AisHubSearchResponse,
  FollowedVesselRefreshResponse,
  FollowedVesselSummary,
} from '~/types/myboat'

const props = defineProps<{
  captainUsername?: string | null
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

const searchSchema = z.object({
  query: z.string().trim().min(1, 'Type something to search.').max(80),
})

const state = reactive({
  query: '',
})

const results = shallowRef<AisHubSearchResult[]>([])
const searchSource = shallowRef<AisHubSearchResponse['source'] | null>(null)
const searchCachedAt = shallowRef<AisHubSearchResponse['cachedAt']>(null)
const activeAddMmsi = shallowRef<string | null>(null)
const activeRemoveId = shallowRef<string | null>(null)
const selectedSearchMmsi = shallowRef<string | null>(null)
const visibleSearchMmsis = shallowRef<string[]>([])
const errorMessage = shallowRef<string | null>(null)
const emptyMessage = shallowRef<string | null>(null)

function hasMappedCoordinates(result: AisHubSearchResult) {
  return (
    result.positionLat !== null &&
    result.positionLat !== undefined &&
    result.positionLng !== null &&
    result.positionLng !== undefined
  )
}

const followedMmsis = computed(() => new Set(props.items.map((item) => item.mmsi)))
const mappedResults = computed(() => results.value.filter(hasMappedCoordinates))
const unmappedResults = computed(() =>
  results.value.filter((result) => !hasMappedCoordinates(result)),
)
const visibleSearchResults = computed(() => {
  const visibleSet = new Set(visibleSearchMmsis.value)
  return mappedResults.value.filter((result) => visibleSet.has(result.mmsi))
})
const hasSearched = computed(
  () =>
    searchSource.value !== null ||
    errorMessage.value !== null ||
    emptyMessage.value !== null ||
    results.value.length > 0,
)
const statusChips = computed(() => [
  { label: `${props.items.length} saved`, color: 'primary' as const },
  {
    label: props.captainUsername ? `@${props.captainUsername}` : 'Profile pending',
    color: props.captainUsername ? ('neutral' as const) : ('warning' as const),
  },
  {
    label:
      searchSource.value === 'upstream'
        ? 'Live AIS Hub'
        : searchSource.value === 'cache'
          ? 'AIS cache'
          : searchSource.value === 'local'
            ? 'Local library'
            : 'Local-first search',
    color:
      searchSource.value === 'upstream'
        ? ('primary' as const)
        : searchSource.value === 'local'
          ? ('warning' as const)
          : ('neutral' as const),
  },
])

watch(
  () => mappedResults.value.map((result) => result.mmsi).join('|'),
  () => {
    visibleSearchMmsis.value = mappedResults.value.map((result) => result.mmsi)

    if (!mappedResults.value.length) {
      selectedSearchMmsi.value = null
      return
    }

    if (
      !selectedSearchMmsi.value ||
      !mappedResults.value.some((result) => result.mmsi === selectedSearchMmsi.value)
    ) {
      selectedSearchMmsi.value = mappedResults.value[0]?.mmsi ?? null
    }
  },
  { immediate: true },
)

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

function canQueryUpstream(query: string) {
  const trimmed = query.trim()
  const compactDigits = trimmed.replaceAll(/\s+/g, '')
  return /^\d{9}$/.test(compactDigits) || trimmed.length >= 3
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

function buildEmptyMessage(query: string, source: AisHubSearchResponse['source']) {
  if (source === 'local' && !canQueryUpstream(query)) {
    return 'No local matches yet. Keep typing until you have at least 3 characters, or enter an exact 9-digit MMSI to pull from AIS Hub.'
  }

  if (source === 'local') {
    return 'No matches in the local AIS library yet.'
  }

  return 'AIS Hub returned no boats for that query.'
}

async function onSearch() {
  errorMessage.value = null
  emptyMessage.value = null

  try {
    const response = await search(state.query)
    results.value = response.results
    searchSource.value = response.source
    searchCachedAt.value = response.cachedAt
    emptyMessage.value = response.results.length
      ? null
      : buildEmptyMessage(state.query, response.source)
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

function handleViewportChange(mmsis: string[]) {
  visibleSearchMmsis.value = mmsis
}
</script>

<template>
  <div class="space-y-6">
    <UCard class="border-default/80 bg-default/90 shadow-card">
      <div class="space-y-5">
        <div class="flex flex-wrap items-center gap-2">
          <UBadge v-for="chip in statusChips" :key="chip.label" :color="chip.color" variant="soft">
            {{ chip.label }}
          </UBadge>
        </div>

        <UForm :schema="searchSchema" :state="state" @submit.prevent="onSearch">
          <div class="flex flex-col gap-3 sm:flex-row">
            <UFormField name="query" label="Search" class="w-full">
              <UInput
                v-model="state.query"
                class="w-full"
                size="xl"
                icon="i-lucide-search"
                placeholder="Search MMSI, name, call sign, destination, or IMO"
              />
            </UFormField>

            <UButton
              type="submit"
              color="primary"
              icon="i-lucide-search"
              size="xl"
              :loading="searchPending"
              :disabled="!state.query.trim()"
            >
              Search
            </UButton>
          </div>
        </UForm>
      </div>
    </UCard>

    <BuddyBoatImportPanel @imported="emit('imported', $event)" />

    <div class="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(22rem,30rem)]">
      <FleetFriendSearchMap
        v-model:selected-mmsi="selectedSearchMmsi"
        :active-add-mmsi="activeAddMmsi"
        :followed-mmsis="followedMmsis"
        :follow-pending="followPending"
        :results="results"
        @add="onAdd"
        @viewport-change="handleViewportChange"
      />

      <FleetFriendSearchResults
        :active-add-mmsi="activeAddMmsi"
        :empty-message="emptyMessage"
        :error-message="errorMessage"
        :followed-mmsis="followedMmsis"
        :follow-pending="followPending"
        :has-searched="hasSearched"
        :mapped-result-count="mappedResults.length"
        :results="visibleSearchResults"
        :search-cached-at="searchCachedAt"
        :search-source="searchSource"
        :selected-mmsi="selectedSearchMmsi"
        :total-result-count="results.length"
        :unmapped-result-count="unmappedResults.length"
        @add="onAdd"
        @select="selectedSearchMmsi = $event"
      />
    </div>

    <UCard class="border-default/80 bg-default/90 shadow-card">
      <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p class="font-medium text-default">Saved buddy boats</p>
          <p class="mt-1 text-sm text-muted">
            Pull a direct MMSI refresh when you want the latest stored AISHub positions.
          </p>
        </div>

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
      </div>
    </UCard>

    <div class="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(22rem,28rem)]">
      <BuddyBoatsMap
        :vessels="items"
        title="Saved boats map"
        description="A zoomed-out chart view of the buddy boats already pinned to this captain."
        height-class="h-[18rem] sm:h-[20rem] lg:h-[22rem]"
      />

      <FleetFriendSavedList
        :active-remove-id="activeRemoveId"
        :items="items"
        :remove-pending="removePending"
        @remove="onRemove"
      />
    </div>
  </div>
</template>
