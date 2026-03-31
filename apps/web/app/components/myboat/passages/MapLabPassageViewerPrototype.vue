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
    mapPersistKey?: string | null
    fullscreen?: boolean
    title?: string
    description?: string
  }>(),
  {
    waypoints: () => [],
    media: () => [],
    accessScope: 'auth',
    publicUsername: null,
    publicVesselSlug: null,
    mapPersistKey: null,
    fullscreen: false,
    title: 'Passage viewer prototype',
    description: 'Map-first playback prototype for the Tideye-inspired passage viewer direction.',
  },
)

defineEmits<{
  openFullscreen: []
  closeFullscreen: []
}>()

const selectedPassageId = defineModel<string | null>('selectedPassageId', {
  default: null,
})

const focusedPassage = computed(
  () =>
    props.passages.find((passage) => passage.id === selectedPassageId.value) ||
    props.passages[0] ||
    null,
)

const focusedWaypoints = computed(() => {
  if (!focusedPassage.value) {
    return props.waypoints
  }

  const matchingItems = props.waypoints.filter(
    (item) => item.passageId === focusedPassage.value?.id,
  )
  return matchingItems.length ? matchingItems : props.waypoints
})

const focusedMedia = computed(() => {
  if (!focusedPassage.value) {
    return props.media
  }

  const matchingItems = props.media.filter((item) => item.passageId === focusedPassage.value?.id)
  return matchingItems.length ? matchingItems : props.media
})

function selectPassage(id: string) {
  selectedPassageId.value = id
}
</script>

<template>
  <section data-testid="map-lab-passage-viewer-prototype" class="space-y-5">
    <div class="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <div class="flex flex-wrap gap-2">
          <UBadge color="primary" variant="soft" size="lg">prototype</UBadge>
          <UBadge color="neutral" variant="soft" size="lg">map-first viewer</UBadge>
        </div>

        <h2 class="mt-3 font-display text-3xl text-default">{{ title }}</h2>
        <p class="mt-2 max-w-3xl text-sm leading-6 text-muted">{{ description }}</p>
      </div>

      <p v-if="focusedPassage" class="text-sm text-muted">
        {{ buildPassageDisplayTitle(focusedPassage) }} ·
        {{ formatTimestamp(focusedPassage.startedAt) }}
      </p>
    </div>

    <PassagePlaybackDeck
      :selected-passage="focusedPassage"
      :map-passages="focusedPassage ? [focusedPassage] : passages"
      :vessel="vessel"
      :waypoints="focusedWaypoints"
      :media="focusedMedia"
      :map-persist-key="mapPersistKey"
      :access-scope="accessScope"
      :public-username="publicUsername"
      :public-vessel-slug="publicVesselSlug"
      :total-passage-count="passages.length"
    />

    <div class="flex gap-3 overflow-x-auto pb-1">
      <UButton
        v-for="passage in passages"
        :key="passage.id"
        color="neutral"
        variant="ghost"
        class="min-w-[16rem] flex-none rounded-[1.25rem] border px-4 py-4 text-left transition"
        :class="
          focusedPassage?.id === passage.id
            ? 'border-primary/30 bg-primary/10 shadow-lg shadow-primary/5'
            : 'border-default/70 bg-white/70 hover:border-primary/20 hover:bg-white'
        "
        @click="selectPassage(passage.id)"
      >
        <p class="font-medium text-default">{{ buildPassageDisplayTitle(passage) }}</p>
        <p class="mt-1 text-xs uppercase tracking-[0.18em] text-muted">
          {{ buildPassageDisplayRoute(passage) }}
        </p>
        <p class="mt-3 text-xs text-muted">
          {{ formatTimestamp(passage.startedAt) }}
        </p>
      </UButton>
    </div>
  </section>
</template>
