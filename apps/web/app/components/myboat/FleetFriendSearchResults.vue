<script setup lang="ts">
import type { AisHubSearchResult, AisHubSearchResponse } from '~/types/myboat'
import { formatCoordinate, formatTimestamp } from '~/utils/marine'

const props = defineProps<{
  activeAddMmsi: string | null
  emptyMessage: string | null
  errorMessage: string | null
  followedMmsis: Set<string>
  followPending: boolean
  hasSearched: boolean
  mappedResultCount: number
  results: AisHubSearchResult[]
  searchCachedAt: AisHubSearchResponse['cachedAt']
  searchSource: AisHubSearchResponse['source'] | null
  selectedMmsi: string | null
  totalResultCount: number
  unmappedResultCount: number
}>()

const emit = defineEmits<{
  add: [result: AisHubSearchResult]
  select: [mmsi: string]
}>()

const sourceTone = computed(() => {
  if (props.searchSource === 'upstream') return 'primary'
  if (props.searchSource === 'cache') return 'neutral'
  return 'warning'
})

const sourceLabel = computed(() => {
  if (props.searchSource === 'upstream') return 'Live AIS Hub'
  if (props.searchSource === 'cache') return 'AIS Hub cache'
  if (props.searchSource === 'local') return 'Local library'
  return 'Idle'
})

const sourceDescription = computed(() => {
  if (!props.searchSource) {
    return 'Search MMSI, name, call sign, destination, or IMO, then use the chart window to narrow the add list.'
  }

  if (props.searchSource === 'local') {
    return props.searchCachedAt
      ? `Matched locally · stored ${formatTimestamp(props.searchCachedAt)} · pan the chart to refine the window`
      : 'Matched locally across stored AIS fields. Pan the chart to refine the window.'
  }

  if (props.searchSource === 'cache') {
    return `Served from query cache · ${formatTimestamp(props.searchCachedAt)}`
  }

  return `Pulled from AIS Hub and stored locally · ${formatTimestamp(props.searchCachedAt)}`
})
</script>

<template>
  <UCard class="border-default/80 bg-default/90 shadow-card">
    <template #header>
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 class="font-display text-xl text-default">Results in view</h2>
          <p class="mt-1 text-sm text-muted">
            {{ sourceDescription }}
          </p>
        </div>

        <div class="flex flex-wrap items-center gap-2">
          <UBadge v-if="searchSource" :color="sourceTone" variant="soft">
            {{ sourceLabel }}
          </UBadge>
          <UBadge color="primary" variant="soft">{{ results.length }} in view</UBadge>
          <UBadge color="neutral" variant="soft">{{ totalResultCount }} total</UBadge>
          <UBadge v-if="unmappedResultCount" color="warning" variant="soft">
            {{ unmappedResultCount }} off-chart
          </UBadge>
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

      <div v-else-if="results.length" class="space-y-3">
        <UCard
          v-for="result in results"
          :key="`${result.mmsi}-${result.name}`"
          :class="
            selectedMmsi === result.mmsi
              ? 'border-primary/60 bg-primary/5 shadow-card'
              : 'border-default/80 bg-default/90 shadow-card'
          "
        >
          <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div class="min-w-0 space-y-2">
              <div class="flex flex-wrap items-center gap-2">
                <p class="font-display text-xl text-default">{{ result.name }}</p>
                <UBadge color="neutral" variant="soft">MMSI {{ result.mmsi }}</UBadge>
                <UBadge v-if="result.imo" color="neutral" variant="soft">
                  IMO {{ result.imo }}
                </UBadge>
              </div>

              <div class="flex flex-wrap gap-x-3 gap-y-1 text-sm text-muted">
                <span v-if="result.callSign">Call sign {{ result.callSign }}</span>
                <span v-if="result.destination">Destination {{ result.destination }}</span>
                <span>Last report {{ formatTimestamp(result.lastReportAt) }}</span>
                <span>
                  {{ formatCoordinate(result.positionLat, true) }} ·
                  {{ formatCoordinate(result.positionLng, false) }}
                </span>
              </div>

              <div class="flex flex-wrap gap-2">
                <UBadge :color="result.matchMode === 'mmsi' ? 'primary' : 'neutral'" variant="soft">
                  {{ result.matchMode === 'mmsi' ? 'Exact MMSI' : 'Text match' }}
                </UBadge>
                <UBadge
                  v-if="result.positionLat !== null && result.positionLng !== null"
                  color="primary"
                  variant="soft"
                >
                  Live position
                </UBadge>
                <UBadge v-if="result.sourceStations.length" color="neutral" variant="soft">
                  {{ result.sourceStations.length }} stations
                </UBadge>
              </div>
            </div>

            <div class="flex shrink-0 items-start gap-2">
              <UButton
                color="neutral"
                :variant="selectedMmsi === result.mmsi ? 'soft' : 'outline'"
                icon="i-lucide-map-pinned"
                @click="emit('select', result.mmsi)"
              >
                {{ selectedMmsi === result.mmsi ? 'Selected' : 'Inspect' }}
              </UButton>
              <UButton
                color="primary"
                icon="i-lucide-user-round-plus"
                :disabled="followedMmsis.has(result.mmsi)"
                :loading="followPending && activeAddMmsi === result.mmsi"
                @click="emit('add', result)"
              >
                {{ followedMmsis.has(result.mmsi) ? 'Saved' : 'Add buddy boat' }}
              </UButton>
            </div>
          </div>
        </UCard>
      </div>

      <UAlert
        v-else-if="hasSearched && totalResultCount > 0 && mappedResultCount > 0"
        color="neutral"
        variant="soft"
        title="No boats in the current map window"
        description="Pan or zoom the chart to bring more search results into view, or use Fit results to reset the map."
      />

      <UAlert
        v-else-if="hasSearched && totalResultCount > 0"
        color="warning"
        variant="soft"
        title="No chartable position reports"
        description="These matches do not include coordinates in the latest AIS response, so they cannot appear in the map-based search window."
      />

      <div
        v-else-if="!hasSearched"
        class="rounded-[1.35rem] border border-dashed border-default bg-elevated/50 px-4 py-5 text-sm text-muted"
      >
        Search the local AIS library first. If nothing matches and the query is an exact MMSI or at
        least three characters, the app will use one AIS Hub lookup, store the results locally, and
        place chartable matches on the map.
      </div>
    </div>
  </UCard>
</template>
