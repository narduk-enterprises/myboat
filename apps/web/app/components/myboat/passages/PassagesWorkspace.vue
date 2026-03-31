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
    showHeader?: boolean
    showMediaStrip?: boolean
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
    showHeader: true,
    showMediaStrip: true,
  },
)

const slots = useSlots()
const {
  allPassages,
  clearSelectedPassage,
  displayedPassages,
  searchQuery,
  selectedPassage,
  sortMode,
  toggleSelectedPassage,
} = usePassagesWorkspace({
  passages: toRef(props, 'passages'),
})

const latestPassage = computed(() => props.passages[0] || null)
const focusedPassage = computed(() => selectedPassage.value || latestPassage.value)
const focusedMedia = computed(() => {
  if (!focusedPassage.value) {
    return props.media
  }

  const matchingItems = props.media.filter((item) => item.passageId === focusedPassage.value?.id)
  return matchingItems.length ? matchingItems : props.media
})
const focusedWaypoints = computed(() => {
  if (!focusedPassage.value) {
    return props.waypoints
  }

  const matchingItems = props.waypoints.filter(
    (item) => item.passageId === focusedPassage.value?.id,
  )
  return matchingItems.length ? matchingItems : props.waypoints
})
const focusedMapPassages = computed(() =>
  focusedPassage.value ? [focusedPassage.value] : props.passages,
)
const hasWorkspaceHeader = computed(() => props.showHeader || Boolean(slots.toolbar))

function buildPassageWindow(passage: PassageSummary | null) {
  if (!passage) {
    return 'Awaiting first logged route'
  }

  const startedLabel = formatTimestamp(passage.startedAt)
  if (!passage.endedAt) {
    return `Started ${startedLabel}`
  }

  return `${startedLabel} · Arrived ${formatTimestamp(passage.endedAt)}`
}
</script>

<template>
  <div data-testid="passages-workspace" class="space-y-6">
    <section
      v-if="hasWorkspaceHeader"
      class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between"
    >
      <div v-if="showHeader">
        <h2 class="font-display text-2xl text-default">{{ title }}</h2>
        <p class="mt-1 text-sm text-muted">{{ description }}</p>
      </div>

      <div v-if="$slots.toolbar" class="flex flex-wrap gap-2">
        <slot name="toolbar" />
      </div>
    </section>

    <MarineEmptyState
      v-if="!allPassages.length"
      :title="emptyTitle"
      :description="emptyDescription"
      icon="i-lucide-route"
      compact
    />

    <template v-else>
      <PassagePlaybackDeck
        :selected-passage="focusedPassage"
        :map-passages="focusedMapPassages"
        :vessel="vessel"
        :waypoints="focusedWaypoints"
        :media="focusedMedia"
        :map-persist-key="mapPersistKey"
        :access-scope="accessScope"
        :public-username="publicUsername"
        :public-vessel-slug="publicVesselSlug"
        :total-passage-count="allPassages.length"
      />

      <section
        class="space-y-4 rounded-[1.75rem] border border-default/70 bg-white/72 p-4 shadow-card backdrop-blur-xl"
      >
        <div class="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p class="text-xs uppercase tracking-[0.24em] text-muted">Passage archive</p>
            <h3 class="mt-2 font-display text-2xl text-default">Switch the focused leg</h3>
            <p class="mt-1 text-sm text-muted">
              Search the archive, then move straight back into playback without leaving the map.
            </p>
          </div>

          <div class="flex flex-wrap items-center gap-2">
            <div class="rounded-full border border-default/70 bg-white/70 px-3 py-1">
              <span class="text-xs uppercase tracking-[0.2em] text-muted">
                {{ displayedPassages.length }} / {{ allPassages.length }}
              </span>
            </div>

            <UButton
              v-if="selectedPassage"
              color="neutral"
              variant="soft"
              icon="i-lucide-undo-2"
              @click="clearSelectedPassage"
            >
              Latest route
            </UButton>
          </div>
        </div>

        <div class="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <UInput
            v-model="searchQuery"
            icon="i-lucide-search"
            placeholder="Search route or stop"
            class="w-full lg:max-w-sm"
          />

          <div class="inline-flex rounded-full border border-default/70 bg-white/70 p-1">
            <UButton
              :color="sortMode === 'date' ? 'primary' : 'neutral'"
              :variant="sortMode === 'date' ? 'soft' : 'ghost'"
              size="xs"
              class="rounded-full"
              @click="sortMode = 'date'"
            >
              Latest
            </UButton>
            <UButton
              :color="sortMode === 'distance' ? 'primary' : 'neutral'"
              :variant="sortMode === 'distance' ? 'soft' : 'ghost'"
              size="xs"
              class="rounded-full"
              @click="sortMode = 'distance'"
            >
              Distance
            </UButton>
          </div>
        </div>

        <div v-if="displayedPassages.length" class="flex gap-3 overflow-x-auto pb-1">
          <UButton
            v-for="passage in displayedPassages"
            :key="passage.id"
            color="neutral"
            variant="ghost"
            class="min-w-[17rem] flex-none rounded-[1.4rem] border px-4 py-4 text-left transition"
            :class="
              focusedPassage?.id === passage.id
                ? 'border-primary/30 bg-primary/10 shadow-lg shadow-primary/5'
                : 'border-default/70 bg-white/70 hover:border-primary/20 hover:bg-white'
            "
            :aria-pressed="focusedPassage?.id === passage.id"
            @click="toggleSelectedPassage(passage.id)"
          >
            <div class="space-y-3">
              <div class="flex items-start justify-between gap-3">
                <div>
                  <p class="font-medium text-default">{{ buildPassageDisplayTitle(passage) }}</p>
                  <p class="mt-1 text-xs uppercase tracking-[0.18em] text-muted">
                    {{ buildPassageDisplayRoute(passage) }}
                  </p>
                </div>

                <UBadge color="neutral" variant="soft">
                  {{
                    passage.distanceNm != null ? `${passage.distanceNm.toFixed(0)} nm` : 'Pending'
                  }}
                </UBadge>
              </div>

              <p class="text-xs text-muted">{{ buildPassageWindow(passage) }}</p>

              <div class="flex flex-wrap gap-2">
                <UBadge v-if="passage.playbackAvailable" color="primary" variant="soft">
                  playback-ready
                </UBadge>
                <UBadge v-if="passage.trackGeojson" color="neutral" variant="soft"> track </UBadge>
              </div>
            </div>
          </UButton>
        </div>

        <MarineEmptyState
          v-else
          :title="searchQuery ? 'No passages match this search' : emptyTitle"
          :description="
            searchQuery ? 'Try a broader route name or clear the search field.' : emptyDescription
          "
          icon="i-lucide-route"
          compact
        />
      </section>
    </template>
  </div>
</template>
