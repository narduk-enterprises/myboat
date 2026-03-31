<script setup lang="ts">
import type {
  AisContactSummary,
  MediaItemSummary,
  PassageSummary,
  VesselCardSummary,
  WaypointSummary,
} from '~/types/myboat'
import type { MyBoatMapSelectionDetail } from '~/components/myboat/maps/map-support'
import type { PlaybackSelectionEvent } from '~/types/playbackViewer'

interface MapContainerHandle {
  clearRememberedView?: () => void
  toggleFullscreen?: () => void
  zoomToFit?: (zoomOutLevels?: number) => void
}

withDefaults(
  defineProps<{
    aisContacts?: AisContactSummary[]
    autoFitKey?: string | null
    endTime: number
    hasPlayback?: boolean
    hoveredLabel?: string | null
    isPlaying: boolean
    markers?: PlaybackSelectionEvent[]
    media?: MediaItemSummary[]
    passages: PassageSummary[]
    persistKey?: string | null
    progressRatio: number
    selectedEventId?: string | null
    speedMultiplier: number
    speedOptions: number[]
    startTime: number
    statusText?: string | null
    vessel: VesselCardSummary | null
    waypoints?: WaypointSummary[]
  }>(),
  {
    aisContacts: () => [],
    autoFitKey: null,
    hasPlayback: false,
    hoveredLabel: null,
    markers: () => [],
    media: () => [],
    persistKey: null,
    selectedEventId: null,
    statusText: null,
    waypoints: () => [],
  },
)

const emit = defineEmits<{
  'select-event': [event: PlaybackSelectionEvent]
  'selection-change': [selection: MyBoatMapSelectionDetail | null]
  'set-hovered-ratio': [ratio: number | null]
  'set-speed': [value: number]
  'seek-ratio': [value: number]
  'toggle-playback': []
}>()

const mapSurface = useTemplateRef<MapContainerHandle>('mapSurface')
const routeLayerVisible = shallowRef(true)
const waypointLayerVisible = shallowRef(true)
const photoLayerVisible = shallowRef(true)
const aisLayerVisible = shallowRef(true)

const layerState = computed(() => ({
  ais: aisLayerVisible.value,
  photos: photoLayerVisible.value,
  routes: routeLayerVisible.value,
  waypoints: waypointLayerVisible.value,
}))

function toggleLayer(layer: 'ais' | 'photos' | 'routes' | 'waypoints') {
  if (layer === 'ais') {
    aisLayerVisible.value = !aisLayerVisible.value
    return
  }

  if (layer === 'photos') {
    photoLayerVisible.value = !photoLayerVisible.value
    return
  }

  if (layer === 'routes') {
    routeLayerVisible.value = !routeLayerVisible.value
    return
  }

  waypointLayerVisible.value = !waypointLayerVisible.value
}

function focusRoute() {
  mapSurface.value?.zoomToFit?.(0)
}

function toggleFullscreen() {
  mapSurface.value?.toggleFullscreen?.()
}

function resetView() {
  mapSurface.value?.clearRememberedView?.()
}

defineExpose({
  focusRoute,
  resetView,
  toggleFullscreen,
})
</script>

<template>
  <section class="relative overflow-hidden rounded-[2rem] border border-default/70 bg-default/95">
    <MyBoatDetailedMap
      ref="mapSurface"
      :vessel="vessel"
      :passages="passages"
      :waypoints="waypoints"
      :media="media"
      :ais-contacts="aisLayerVisible ? aisContacts : []"
      :persist-key="persistKey"
      :auto-fit-key="autoFitKey"
      :traffic-enabled="aisLayerVisible"
      :show-routes="routeLayerVisible"
      :show-waypoints-layer="waypointLayerVisible"
      :show-media-layer="photoLayerVisible"
      height-class="h-[72vh] min-h-[30rem] max-h-[54rem]"
      :show-focus-panel="false"
      :show-layer-toggles="false"
      :show-pin-labels="false"
      :show-advanced-tools="false"
      :has-signal-k-source="hasPlayback"
      @selection-change="emit('selection-change', $event)"
    />

    <div class="pointer-events-none absolute inset-x-4 top-4 z-20 flex justify-end">
      <MapControlsOverlay
        :layers="layerState"
        :meta="{
          canToggleAis: hasPlayback,
          photoCount: media.length,
          waypointCount: waypoints.length,
        }"
        @fit-route="focusRoute"
        @reset-view="resetView"
        @toggle-layer="toggleLayer"
      />
    </div>

    <div class="pointer-events-none absolute inset-x-4 bottom-4 z-20">
      <PlaybackTimelineOverlay
        :end-time="endTime"
        :has-playback="hasPlayback"
        :hovered-label="hoveredLabel"
        :is-playing="isPlaying"
        :markers="markers"
        :progress-ratio="progressRatio"
        :selected-event-id="selectedEventId"
        :speed-multiplier="speedMultiplier"
        :speed-options="speedOptions"
        :start-time="startTime"
        :status-text="statusText"
        @select-event="emit('select-event', $event)"
        @set-hovered-ratio="emit('set-hovered-ratio', $event)"
        @set-speed="emit('set-speed', $event)"
        @seek-ratio="emit('seek-ratio', $event)"
        @toggle-playback="emit('toggle-playback')"
      />
    </div>
  </section>
</template>
