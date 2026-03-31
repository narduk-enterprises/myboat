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
const hasWorkspaceHeader = computed(() => props.showHeader || Boolean(slots.toolbar))
const focusDescription = computed(() =>
  selectedPassage.value
    ? 'Playback and map focus stay locked to the selected leg until you clear the selection.'
    : 'The archive is showing the latest route until you choose a specific leg from the rail.',
)
const focusBadges = computed(() => {
  const passage = focusedPassage.value
  if (!passage) {
    return []
  }

  return [
    passage.trackGeojson
      ? {
          color: 'neutral' as const,
          label: 'Track ready',
        }
      : {
          color: 'neutral' as const,
          label: 'Track pending',
        },
    passage.playbackAvailable
      ? {
          color: 'primary' as const,
          label: 'Playback ready',
        }
      : null,
    passage.distanceNm !== null && passage.distanceNm !== undefined
      ? {
          color: 'neutral' as const,
          label: `${passage.distanceNm.toFixed(0)} nm`,
        }
      : null,
  ].filter((badge): badge is { color: 'neutral' | 'primary'; label: string } => Boolean(badge))
})
const archiveSummaryCards = computed(() => [
  {
    label: 'Recorded passages',
    note: latestPassage.value
      ? buildPassageTitle(latestPassage.value)
      : 'The latest recorded route appears here.',
    value: String(props.passages.length),
  },
  {
    label: 'Track geometry',
    note: trackCount.value
      ? `${trackCount.value} stored track${trackCount.value === 1 ? '' : 's'} available on the chart.`
      : 'Stored geometry has not landed in the archive yet.',
    value: String(trackCount.value),
  },
  {
    label: 'Playback ready',
    note: playbackReadyCount.value
      ? `${playbackReadyCount.value} replay${playbackReadyCount.value === 1 ? '' : 's'} can open in the playback stage.`
      : 'Replay becomes available when a passage has a stored playback bundle.',
    value: String(playbackReadyCount.value),
  },
  {
    label: 'Linked context',
    note: `${linkedWaypointCount.value} waypoint${linkedWaypointCount.value === 1 ? '' : 's'} and ${linkedMedia.value.length} media item${linkedMedia.value.length === 1 ? '' : 's'} remain tied to the current focus context.`,
    value: `${linkedWaypointCount.value} / ${linkedMedia.value.length}`,
  },
])

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

    <section class="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(19rem,23rem)] xl:items-start">
      <div class="space-y-4">
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
      </div>

      <div class="space-y-4 xl:sticky xl:top-24">
        <UCard class="chart-surface rounded-[1.75rem] shadow-card">
          <div class="space-y-4">
            <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p class="text-xs uppercase tracking-[0.24em] text-muted">
                  {{ selectedPassage ? 'Focused passage' : 'Latest passage' }}
                </p>
                <h3 class="mt-2 font-display text-2xl text-default">
                  {{ buildPassageTitle(focusedPassage) }}
                </h3>
                <p class="mt-1 text-sm text-muted">{{ buildRouteLabel(focusedPassage) }}</p>
              </div>

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

            <div class="flex flex-wrap gap-2">
              <UBadge
                v-for="badge in focusBadges"
                :key="badge.label"
                :color="badge.color"
                variant="soft"
              >
                {{ badge.label }}
              </UBadge>
            </div>

            <div class="space-y-2 text-sm text-muted">
              <p>{{ buildPassageWindow(focusedPassage) }}</p>
              <p>{{ focusDescription }}</p>
            </div>
          </div>
        </UCard>

        <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
          <div
            v-for="card in archiveSummaryCards"
            :key="card.label"
            class="rounded-[1.25rem] border border-default bg-elevated/70 px-4 py-4"
          >
            <p class="text-xs uppercase tracking-[0.22em] text-muted">{{ card.label }}</p>
            <p class="mt-2 font-display text-xl text-default">{{ card.value }}</p>
            <p class="mt-2 text-xs leading-5 text-muted">{{ card.note }}</p>
          </div>
        </div>

        <UCard class="chart-surface rounded-[1.75rem] shadow-card">
          <template #header>
            <div class="space-y-4">
              <div class="flex items-start justify-between gap-3">
                <div>
                  <h2 class="font-display text-2xl text-default">Passage rail</h2>
                  <p class="mt-1 text-sm text-muted">
                    Search the archive, switch focus, and keep the playback stage nearby.
                  </p>
                </div>

                <div class="rounded-full border border-default/70 bg-elevated/60 px-3 py-1">
                  <span class="text-xs uppercase tracking-[0.2em] text-muted">
                    {{ displayedPassages.length }} / {{ allPassages.length }}
                  </span>
                </div>
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
            <div class="max-h-[32rem] space-y-3 overflow-y-auto pr-1">
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
              searchQuery ? 'Try a broader route name or clear the search field.' : emptyDescription
            "
            icon="i-lucide-route"
            compact
          />
        </UCard>
      </div>
    </section>

    <MediaStrip v-if="showMediaStrip && linkedMedia.length" :media="linkedMedia" />
  </div>
</template>
