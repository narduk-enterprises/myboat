<script setup lang="ts">
import type {
  MediaItemSummary,
  PassageSummary,
  VesselCardSummary,
  WaypointSummary,
} from '~/types/myboat'
import { formatTimestamp } from '~/utils/marine'
import { buildPassageDisplayRoute, buildPassageDisplayTitle } from '~/utils/passage-display'

const props = withDefaults(
  defineProps<{
    vessel: VesselCardSummary | null
    passages: PassageSummary[]
    waypoints?: WaypointSummary[]
    media?: MediaItemSummary[]
    accessScope?: 'auth' | 'public'
    publicUsername?: string | null
    publicVesselSlug?: string | null
    title?: string
    description?: string
    emptyTitle?: string
    emptyDescription?: string
    mapPersistKey?: string | null
  }>(),
  {
    waypoints: () => [],
    media: () => [],
    accessScope: 'auth',
    publicUsername: null,
    publicVesselSlug: null,
    title: 'Passage log',
    description:
      'Search saved tracks, focus a route on the chart, and keep the historical log readable.',
    emptyTitle: 'No passages logged yet',
    emptyDescription:
      'The route history surface is ready for telemetry-backed passages, imported tracks, and retrospective voyage notes.',
    mapPersistKey: null,
  },
)

const {
  allPassages,
  clearSelectedPassage,
  displayedPassages,
  mapPassages,
  searchQuery,
  selectedPassage,
  selectedPassageId,
  sortMode,
  toggleSelectedPassage,
} = usePassagesWorkspace({
  passages: toRef(props, 'passages'),
})

const latestPassage = computed(() => props.passages[0] || null)
const focusedPassage = computed(() => selectedPassage.value || latestPassage.value)
const totalDistanceNm = computed(() =>
  props.passages.reduce((sum, passage) => sum + (passage.distanceNm || 0), 0),
)
const trackCount = computed(
  () => props.passages.filter((passage) => Boolean(passage.trackGeojson)).length,
)
const playbackReadyCount = computed(
  () => props.passages.filter((passage) => passage.playbackAvailable).length,
)
const linkedMedia = computed(() => {
  if (!selectedPassage.value) {
    return props.media
  }

  const selectedItems = props.media.filter((item) => item.passageId === selectedPassage.value?.id)
  return selectedItems.length ? selectedItems : props.media
})
const linkedWaypointCount = computed(() => {
  if (!selectedPassage.value) {
    return props.waypoints.length
  }

  const count = props.waypoints.filter(
    (waypoint) => waypoint.passageId === selectedPassage.value?.id,
  ).length
  return count || props.waypoints.length
})

function buildRouteLabel(passage: PassageSummary | null) {
  return buildPassageDisplayRoute(passage)
}

function buildPassageTitle(passage: PassageSummary | null) {
  return buildPassageDisplayTitle(passage)
}

function buildPassageWindow(passage: PassageSummary | null) {
  if (!passage) {
    return 'Add the first route to unlock the full workspace.'
  }

  const startedLabel = formatTimestamp(passage.startedAt)
  if (!passage.endedAt) {
    return `Started ${startedLabel}`
  }

  return `${startedLabel} · Arrived ${formatTimestamp(passage.endedAt)}`
}

const metricCards = computed(() => [
  {
    hint: latestPassage.value ? buildPassageTitle(latestPassage.value) : 'The latest recorded route appears here.',
    icon: 'i-lucide-route',
    label: 'Recorded passages',
    value: String(props.passages.length),
  },
  {
    hint: trackCount.value
      ? `${trackCount.value} stored track${trackCount.value === 1 ? '' : 's'} available on the chart.`
      : 'This vessel does not have stored route geometry yet.',
    icon: 'i-lucide-map',
    label: 'Tracks with geometry',
    value: String(trackCount.value),
  },
  {
    hint: playbackReadyCount.value
      ? `${playbackReadyCount.value} stored replay${playbackReadyCount.value === 1 ? '' : 's'} can be opened from the chart.`
      : 'Playback becomes available when a passage has stored replay data.',
    icon: 'i-lucide-clapperboard',
    label: 'Playback ready',
    value: String(playbackReadyCount.value),
  },
  {
    hint: focusedPassage.value ? buildPassageTitle(focusedPassage.value) : 'Distance rolls up as passages are logged.',
    icon: 'i-lucide-gauge',
    label: 'Distance logged',
    unit: 'nm',
    value: totalDistanceNm.value ? totalDistanceNm.value.toFixed(0) : '0',
  },
  {
    hint: `${linkedWaypointCount.value} waypoint${linkedWaypointCount.value === 1 ? '' : 's'} · ${linkedMedia.value.length} media item${linkedMedia.value.length === 1 ? '' : 's'} in the current focus context.`,
    icon: 'i-lucide-map-pinned',
    label: 'Linked context',
    value: `${linkedWaypointCount.value}/${linkedMedia.value.length}`,
  },
])
</script>

<template>
  <div data-testid="passages-workspace" class="space-y-6">
    <section class="grid gap-6 xl:grid-cols-[23rem_minmax(0,1fr)]">
      <div class="space-y-6 xl:order-2">
        <section class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 class="font-display text-2xl text-default">{{ title }}</h2>
            <p class="mt-1 text-sm text-muted">{{ description }}</p>
          </div>

          <div class="flex flex-wrap gap-2">
            <slot name="toolbar" />
            <UButton
              v-if="selectedPassage"
              color="neutral"
              variant="soft"
              icon="i-lucide-undo-2"
              @click="clearSelectedPassage"
            >
              Clear focus
            </UButton>
          </div>
        </section>

        <PassagePlaybackDeck
          :selected-passage="selectedPassage"
          :map-passages="mapPassages"
          :vessel="vessel"
          :waypoints="waypoints"
          :map-persist-key="mapPersistKey"
          :access-scope="accessScope"
          :public-username="publicUsername"
          :public-vessel-slug="publicVesselSlug"
        />

        <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MarineMetricCard
            v-for="card in metricCards"
            :key="card.label"
            :label="card.label"
            :value="card.value"
            :unit="card.unit"
            :hint="card.hint"
            :icon="card.icon"
          />
        </div>

        <div class="grid gap-4 md:grid-cols-2">
          <UCard class="chart-surface rounded-[1.75rem] shadow-card">
            <template #header>
              <div>
                <p class="text-xs uppercase tracking-[0.24em] text-muted">
                  {{ selectedPassage ? 'Focused passage' : 'Latest passage' }}
                </p>
                <h3 class="mt-2 font-display text-2xl text-default">
                  {{ buildPassageTitle(focusedPassage) }}
                </h3>
                <p class="mt-1 text-sm text-muted">{{ buildRouteLabel(focusedPassage) }}</p>
              </div>
            </template>

            <div class="space-y-3 text-sm text-muted">
              <p>
                {{
                  selectedPassage
                    ? 'Playback and chart focus are locked to the selected leg.'
                    : 'Choose a passage from the rail to load playback details or keep the chart on the full archive.'
                }}
              </p>
              <p>{{ buildPassageWindow(focusedPassage) }}</p>
            </div>
          </UCard>

          <UCard class="chart-surface rounded-[1.75rem] shadow-card">
            <template #header>
              <div>
                <p class="text-xs uppercase tracking-[0.24em] text-muted">Playback coverage</p>
                <h3 class="mt-2 font-display text-2xl text-default">
                  {{
                    selectedPassage?.playbackAvailable
                      ? 'Playback ready'
                      : playbackReadyCount
                        ? `${playbackReadyCount} replays stored`
                        : 'No playback stored yet'
                  }}
                </h3>
                <p class="mt-1 text-sm text-muted">
                  Replay data is stored directly in MyBoat and tied to the same route archive shown
                  on this chart.
                </p>
              </div>
            </template>

            <div class="space-y-3 text-sm text-muted">
              <p v-if="selectedPassage?.playbackAvailable">
                The selected passage can replay stored vessel telemetry on its own chart window.
              </p>
              <p v-else>
                Every stored route with track geometry can open into a replay-ready passage view.
              </p>
              <p>
                {{ linkedWaypointCount }} waypoint{{ linkedWaypointCount === 1 ? '' : 's' }} and
                {{ linkedMedia.length }} media item{{ linkedMedia.length === 1 ? '' : 's' }} are
                attached to the current workspace context.
              </p>
            </div>
          </UCard>
        </div>
      </div>

      <UCard class="chart-surface rounded-[1.75rem] shadow-card xl:order-1 xl:sticky xl:top-24 h-fit">
        <template #header>
          <div class="space-y-4">
            <div>
              <h2 class="font-display text-2xl text-default">Passage rail</h2>
              <p class="mt-1 text-sm text-muted">
                Search the route log, pick a leg, and jump the chart directly into that passage.
              </p>
            </div>

            <div class="grid gap-3">
              <UInput
                v-model="searchQuery"
                icon="i-lucide-search"
                placeholder="Search route or stop"
              />

              <div class="flex flex-wrap items-center justify-between gap-2">
                <span class="text-xs uppercase tracking-[0.22em] text-muted">Sort</span>

                <div class="inline-flex rounded-full border border-default/70 bg-elevated/60 p-1">
                  <UButton
                    :color="sortMode === 'date' ? 'primary' : 'neutral'"
                    :variant="sortMode === 'date' ? 'soft' : 'ghost'"
                    size="xs"
                    @click="sortMode = 'date'"
                  >
                    Latest
                  </UButton>
                  <UButton
                    :color="sortMode === 'distance' ? 'primary' : 'neutral'"
                    :variant="sortMode === 'distance' ? 'soft' : 'ghost'"
                    size="xs"
                    @click="sortMode = 'distance'"
                  >
                    Distance
                  </UButton>
                </div>
              </div>
            </div>
          </div>
        </template>

        <div v-if="displayedPassages.length" class="space-y-3">
          <div class="text-xs uppercase tracking-[0.22em] text-muted">
            {{ displayedPassages.length }} of {{ allPassages.length }} shown
          </div>

          <div class="max-h-[36rem] space-y-3 overflow-y-auto pr-1">
            <UButton
              v-for="passage in displayedPassages"
              :key="passage.id"
              :data-passage-id="passage.id"
              data-testid="passage-workspace-row"
              color="neutral"
              class="w-full justify-start rounded-[1.35rem] border px-4 py-4 text-left transition"
              :class="
                selectedPassageId === passage.id
                  ? 'border-primary/20 bg-primary/10 shadow-card'
                  : 'border-default/70 bg-default/70 hover:border-primary/15 hover:bg-default/90'
              "
              :aria-pressed="selectedPassageId === passage.id"
              :variant="selectedPassageId === passage.id ? 'soft' : 'ghost'"
              @click="toggleSelectedPassage(passage.id)"
            >
              <div class="w-full">
                <div class="flex items-start justify-between gap-3">
                  <div>
                    <p class="font-medium text-default">{{ buildPassageTitle(passage) }}</p>
                    <p class="mt-1 text-xs uppercase tracking-[0.18em] text-muted">
                      {{ buildRouteLabel(passage) }}
                    </p>
                  </div>

                  <UBadge color="neutral" variant="soft">
                    {{
                      passage.distanceNm !== null && passage.distanceNm !== undefined
                        ? `${passage.distanceNm.toFixed(0)} nm`
                        : 'Pending'
                    }}
                  </UBadge>
                </div>

                <div class="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted">
                  <span>{{ buildPassageWindow(passage) }}</span>
                  <span
                    v-if="passage.trackGeojson"
                    class="rounded-full border border-default/70 px-2 py-1"
                  >
                    Track ready
                  </span>
                  <span
                    v-if="passage.playbackAvailable"
                    class="rounded-full border border-primary/30 bg-primary/10 px-2 py-1 text-primary"
                  >
                    Playback
                  </span>
                </div>
              </div>
            </UButton>
          </div>
        </div>

        <MarineEmptyState
          v-else
          :title="searchQuery ? 'No passages match this search' : emptyTitle"
          :description="
            searchQuery
              ? 'Try a broader route name or clear the search field.'
              : emptyDescription
          "
          icon="i-lucide-route"
          compact
        />
      </UCard>
    </section>

    <MediaStrip v-if="linkedMedia.length" :media="linkedMedia" />
  </div>
</template>
