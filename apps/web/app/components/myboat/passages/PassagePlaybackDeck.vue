<script setup lang="ts">
import type { PlaybackSelectionEvent } from '~/types/playbackViewer'
import type {
  MediaItemSummary,
  PassageSummary,
  VesselCardSummary,
  WaypointSummary,
} from '~/types/myboat'
import type { MyBoatMapSelectionDetail } from '~/components/myboat/maps/map-support'
import { storeToRefs } from 'pinia'
import { usePassagePlaybackBundle } from '~/composables/usePassagePlayback'
import { usePlaybackStore } from '~/stores/playback'
import { buildPassageDisplayRoute, buildPassageDisplayTitle } from '~/utils/passage-display'

interface MapContainerHandle {
  focusRoute?: () => void
  toggleFullscreen?: () => void
}

const props = withDefaults(
  defineProps<{
    selectedPassage: PassageSummary | null
    mapPassages: PassageSummary[]
    vessel: VesselCardSummary | null
    waypoints?: WaypointSummary[]
    media?: MediaItemSummary[]
    mapPersistKey?: string | null
    accessScope?: 'auth' | 'public'
    publicUsername?: string | null
    publicVesselSlug?: string | null
    showHeader?: boolean
    totalPassageCount?: number
  }>(),
  {
    waypoints: () => [],
    media: () => [],
    mapPersistKey: null,
    accessScope: 'auth',
    publicUsername: null,
    publicVesselSlug: null,
    showHeader: true,
    totalPassageCount: 0,
  },
)

const toast = useToast()
const route = useRoute()
const router = useRouter()
const mapContainer = useTemplateRef<MapContainerHandle>('mapContainer')

const playbackScope = computed(() =>
  props.accessScope === 'public'
    ? {
        access: 'public' as const,
        username: props.publicUsername,
        vesselSlug: props.publicVesselSlug,
      }
    : {
        access: 'auth' as const,
      },
)

const selectedPassageId = computed(() =>
  props.selectedPassage?.playbackAvailable ? props.selectedPassage.id : null,
)

const {
  data: bundle,
  error,
  pending,
} = await usePassagePlaybackBundle(selectedPassageId, playbackScope)

const playbackStore = usePlaybackStore()
const {
  aisContacts,
  displayMode,
  endTime,
  featuredMedia,
  hasPlayback,
  hoverMetrics,
  isPlaying,
  metrics,
  progressRatio,
  selectedEvent,
  speedMultiplier,
  speedOptions,
  startTime,
  subtitle,
  timelineMarkers,
  title,
} = storeToRefs(playbackStore)

const stageWaypoints = computed(() => {
  if (!props.selectedPassage) {
    return props.waypoints
  }

  const matchingItems = props.waypoints.filter(
    (item) => item.passageId === props.selectedPassage?.id,
  )
  return matchingItems.length ? matchingItems : props.waypoints
})

const stageMedia = computed(() => {
  if (!props.selectedPassage) {
    return props.media
  }

  const matchingItems = props.media.filter((item) => item.passageId === props.selectedPassage?.id)
  return matchingItems.length ? matchingItems : props.media
})

const effectivePassageCount = computed(
  () => props.totalPassageCount || props.mapPassages.length || 0,
)
const playbackReady = computed(() => Boolean(props.selectedPassage?.playbackAvailable))
const viewerTitle = computed(() => buildPassageDisplayTitle(props.selectedPassage))
const viewerSubtitle = computed(() => buildPassageDisplayRoute(props.selectedPassage))
const mapVessel = computed(() => playbackStore.playbackVessel || props.vessel)

const timelineStatusText = computed(() => {
  if (pending.value) {
    return 'Loading playback timeline.'
  }

  if (error.value) {
    return error.value.message
  }

  if (!playbackReady.value) {
    return 'Replay is not stored for this passage yet.'
  }

  return null
})

const hoveredLabel = computed(() => {
  const hover = hoverMetrics.value
  if (!hover) {
    return null
  }

  return hover.sog != null
    ? `${hover.timestampLabel} · ${hover.sog.toFixed(1)} kts`
    : hover.timestampLabel
})

watch(
  [
    () => bundle.value,
    () => props.selectedPassage,
    () => props.vessel,
    () => stageMedia.value,
    () => stageWaypoints.value,
  ],
  ([nextBundle, nextPassage, nextVessel, nextMedia, nextWaypoints]) => {
    playbackStore.hydrate({
      bundle: nextBundle,
      media: nextMedia,
      passage: nextPassage,
      vessel: nextVessel,
      waypoints: nextWaypoints,
    })
  },
  { immediate: true },
)

onBeforeUnmount(() => {
  playbackStore.resetPlayback()
  playbackStore.clearSelection()
  playbackStore.hydrate({
    bundle: null,
    media: [],
    passage: null,
    vessel: null,
    waypoints: [],
  })
})

function toSelectionEvent(selection: MyBoatMapSelectionDetail): PlaybackSelectionEvent {
  const parsedTime = selection.timestamp ? Date.parse(selection.timestamp) : Number.NaN

  return {
    id:
      selection.pinKind === 'media'
        ? `photo:${selection.id}`
        : selection.pinKind === 'waypoint'
          ? `waypoint:${selection.id}`
          : `ais:${selection.id}`,
    kind:
      selection.pinKind === 'media'
        ? 'photo'
        : selection.pinKind === 'waypoint'
          ? 'waypoint'
          : 'ais',
    title: selection.title,
    shortLabel:
      selection.pinKind === 'media' ? 'Photo' : selection.pinKind === 'waypoint' ? 'Mark' : 'AIS',
    ms: Number.isFinite(parsedTime) ? parsedTime : null,
    timestamp: selection.timestamp || null,
    note: selection.description,
    meta: selection.meta,
    imageUrl: selection.imageUrl,
    lat: selection.lat,
    lng: selection.lng,
    sog: selection.sog,
    heading: selection.heading,
  }
}

function handleMapSelection(selection: MyBoatMapSelectionDetail | null) {
  if (!selection) {
    return
  }

  playbackStore.selectEvent(toSelectionEvent(selection))
}

function handleFocus() {
  playbackStore.clearSelection()
  mapContainer.value?.focusRoute?.()
}

function handleFullscreen() {
  mapContainer.value?.toggleFullscreen?.()
}

function handleHoveredRatio(ratio: number | null) {
  if (ratio == null) {
    playbackStore.setHoveredTime(null)
    return
  }

  playbackStore.setHoveredTime(startTime.value + (endTime.value - startTime.value) * ratio)
}

async function handleShare() {
  if (!props.selectedPassage || !import.meta.client) {
    return
  }

  const resolved = router.resolve({
    path: route.path,
    query: {
      ...route.query,
      p: props.selectedPassage.id,
    },
  })
  const shareUrl = new URL(resolved.fullPath, window.location.origin).toString()
  await navigator.clipboard.writeText(shareUrl)
  toast.add({
    title: 'Passage link copied',
    description: 'The focused route link is ready to paste.',
    color: 'success',
  })
}
</script>

<template>
  <div class="space-y-4" data-testid="passage-playback-deck">
    <HeaderBar
      v-if="showHeader"
      :title="title || viewerTitle"
      :subtitle="subtitle || viewerSubtitle"
      :passage-count="effectivePassageCount"
      :photo-count="stageMedia.length"
      :playback-ready="playbackReady"
      :summary="selectedPassage?.summary"
      @focus="handleFocus"
      @fullscreen="handleFullscreen"
      @share="handleShare"
    />

    <div class="grid gap-4 xl:grid-cols-[minmax(0,1fr)_21rem] xl:items-start">
      <MapContainer
        ref="mapContainer"
        :vessel="mapVessel"
        :passages="mapPassages"
        :waypoints="stageWaypoints"
        :media="stageMedia"
        :ais-contacts="aisContacts"
        :persist-key="mapPersistKey"
        :auto-fit-key="selectedPassage?.id || mapPassages[0]?.id || 'passage-viewer'"
        :has-playback="hasPlayback"
        :is-playing="isPlaying"
        :speed-multiplier="speedMultiplier"
        :speed-options="speedOptions"
        :progress-ratio="progressRatio"
        :start-time="startTime"
        :end-time="endTime"
        :markers="timelineMarkers"
        :selected-event-id="selectedEvent?.id || null"
        :hovered-label="hoveredLabel"
        :status-text="timelineStatusText"
        @selection-change="handleMapSelection"
        @select-event="playbackStore.selectEvent($event)"
        @set-hovered-ratio="handleHoveredRatio"
        @set-speed="playbackStore.setSpeed($event)"
        @seek-ratio="playbackStore.seekToRatio($event)"
        @toggle-playback="playbackStore.togglePlayback()"
      />

      <ContextPanel
        :mode="displayMode"
        :metrics="metrics"
        :event="selectedEvent"
        :featured-media="featuredMedia"
        :has-playback="hasPlayback"
        :passage="selectedPassage"
        :pending="pending"
        :status-text="timelineStatusText"
        :traffic-count="aisContacts.length"
      />
    </div>
  </div>
</template>
