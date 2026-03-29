<script setup lang="ts">
import type { MapKitMapSurface } from '~/composables/useMarineAisOverlay'
import type {
  AisContactSummary,
  MediaItemSummary,
  PassageSummary,
  VesselCardSummary,
  WaypointSummary,
} from '~/types/myboat'
import { formatRelativeTime, formatTimestamp } from '~/utils/marine'
import { buildTrafficContactPath, formatTrafficSpeed } from '~/utils/traffic'
import type { MyBoatMapHandle, MyBoatMapInstallation } from './map-support'
import { mergeFeatureCollections, type MyBoatMapToolsProfile } from './advanced-tools'
import {
  buildAisVectorFeatureCollection,
  buildNearbyAisPins,
  buildMediaPins,
  buildPassageFeatureCollection,
  buildVesselPins,
  buildWaypointPins,
  createAisPinElement,
  createAisPinFingerprint,
  createMediaPinElement,
  createVesselPinElement,
  createWaypointPinElement,
  formatDistanceNm,
  getAisCategory,
  routeOverlayStyle,
} from './map-support'

defineOptions({ inheritAttrs: false })

const props = withDefaults(
  defineProps<{
    vessel: VesselCardSummary | null
    passages?: PassageSummary[]
    waypoints?: WaypointSummary[]
    media?: MediaItemSummary[]
    installations?: MyBoatMapInstallation[]
    aisContacts?: AisContactSummary[]
    liveConnectionState?: 'idle' | 'connecting' | 'connected' | 'error'
    liveLastDeltaAt?: number | null
    hasSignalKSource?: boolean
    trafficEnabled?: boolean
    trafficDetailBasePath?: string | null
    toolsProfile?: MyBoatMapToolsProfile
    heightClass?: string
    persistKey?: string | null
    showFocusPanel?: boolean
    showLayerToggles?: boolean
    showPinLabels?: boolean
    showStatsRail?: boolean
    autoFitKey?: string | null
  }>(),
  {
    passages: () => [],
    waypoints: () => [],
    media: () => [],
    installations: () => [],
    aisContacts: undefined,
    liveConnectionState: undefined,
    liveLastDeltaAt: null,
    hasSignalKSource: undefined,
    trafficEnabled: undefined,
    trafficDetailBasePath: null,
    toolsProfile: 'viewer',
    heightClass: 'h-[24rem] sm:h-[30rem] lg:h-[38rem] xl:h-[44rem]',
    persistKey: null,
    showFocusPanel: true,
    showLayerToggles: true,
    showPinLabels: true,
    showStatsRail: true,
    autoFitKey: null,
  },
)

const emit = defineEmits<{
  'update:trafficEnabled': [value: boolean]
}>()

const mapRef = useTemplateRef<MyBoatMapHandle>('mapRoot')
const selectedId = shallowRef<string | null>(null)
const showRoutes = shallowRef(true)
const showWaypoints = shallowRef(true)
const showMedia = shallowRef(true)
const localTrafficEnabled = shallowRef(true)
const showTrafficVectors = shallowRef(true)
const trafficInitialized = shallowRef(false)
const isCompactViewport = useCompactViewport()
const mapInstance = shallowRef<MapKitMapSurface | null>(null)

const primaryVessel = computed(() => props.vessel)
const focusSnapshot = computed(() => props.vessel?.liveSnapshot ?? null)
const {
  capabilities: toolCapabilities,
  canShowHeadingLine,
  canShowRangeRings,
  handleMapClick: handleToolMapClick,
  hasActiveIndicator,
  mapStyle,
  measureMode,
  measureResult,
  setMapStyle,
  showHeadingLine,
  showRangeRings,
  toggleHeadingLine,
  toggleMeasureMode,
  toggleRangeRings,
  toolGeojson,
} = useMyBoatAdvancedMapTools({
  defaultShowsPointsOfInterest: true,
  focusSnapshot,
  profile: computed(() => props.toolsProfile),
})
const vesselPins = computed(() => (props.vessel ? buildVesselPins([props.vessel]) : []))
const waypointPins = computed(() => buildWaypointPins(props.waypoints))
const mediaPins = computed(() => buildMediaPins(props.media))
const showTraffic = computed({
  get: () => props.trafficEnabled ?? localTrafficEnabled.value,
  set: (value: boolean) => {
    localTrafficEnabled.value = value
    emit('update:trafficEnabled', value)
  },
})
const aisPins = computed(() =>
  buildNearbyAisPins({
    contacts: props.aisContacts || [],
    focusSnapshot: focusSnapshot.value,
    primaryVessel: primaryVessel.value,
  }),
)
const connectionState = computed(() => props.liveConnectionState || 'idle')
const hasSignalKSource = computed(() => Boolean(props.hasSignalKSource))
const lastDeltaAt = computed(() => props.liveLastDeltaAt ?? null)

const mapItems = computed(() => [
  ...vesselPins.value,
  ...(showWaypoints.value ? waypointPins.value : []),
  ...(showMedia.value ? mediaPins.value : []),
])
const baseGeojson = computed(() => buildPassageFeatureCollection(props.passages))
const trafficVectorGeojson = computed(() => buildAisVectorFeatureCollection(aisPins.value))
const geojson = computed(() =>
  mergeFeatureCollections(
    showRoutes.value ? baseGeojson.value : null,
    showTraffic.value && showTrafficVectors.value ? trafficVectorGeojson.value : null,
    toolGeojson.value,
  ),
)
const allPins = computed(() => [...mapItems.value, ...(showTraffic.value ? aisPins.value : [])])
const hasMapData = computed(
  () =>
    mapItems.value.length > 0 ||
    baseGeojson.value.features.length > 0 ||
    trafficVectorGeojson.value.features.length > 0 ||
    mediaPins.value.length > 0,
)

const selectedPin = computed(
  () => allPins.value.find((item) => item.id === selectedId.value) || null,
)
const selectedVessel = computed(() => {
  const selected = selectedPin.value
  if (!selected || selected.pinKind !== 'vessel') return null
  return props.vessel && selected.vesselId === props.vessel.id ? props.vessel : null
})
const selectedAisPin = computed(() => {
  const selected = selectedPin.value
  return selected?.pinKind === 'ais' ? selected : null
})
const selectedMediaPin = computed(() => {
  const selected = selectedPin.value
  return selected?.pinKind === 'media' ? selected : null
})
const selectedAisDetailPath = computed(() =>
  buildTrafficContactPath(props.trafficDetailBasePath, selectedAisPin.value?.contactId),
)
const focusVessel = computed(() => selectedVessel.value || primaryVessel.value)

const showsDenseLabels = computed(() => mapItems.value.length <= 3)
const clusteringIdentifier = computed(() =>
  mapItems.value.length >= 8 ? 'myboat-detailed-map' : undefined,
)
const annotationSize = computed(() =>
  mapItems.value.length > 10
    ? { width: 92, height: 72 }
    : showsDenseLabels.value
      ? { width: 116, height: 78 }
      : { width: 84, height: 68 },
)
const fallbackCenter = computed(() => {
  const snapshot = focusSnapshot.value
  if (
    snapshot?.positionLat !== null &&
    snapshot?.positionLat !== undefined &&
    snapshot.positionLng !== null &&
    snapshot.positionLng !== undefined
  ) {
    return { lat: snapshot.positionLat, lng: snapshot.positionLng }
  }

  const firstWaypoint = props.waypoints[0]
  if (firstWaypoint) {
    return { lat: firstWaypoint.lat, lng: firstWaypoint.lng }
  }

  const firstMedia = mediaPins.value[0]
  if (firstMedia) {
    return { lat: firstMedia.lat, lng: firstMedia.lng }
  }

  return { lat: 29.3043, lng: -94.7977 }
})

const trafficStatus = computed(() => {
  if (!hasSignalKSource.value) return 'AIS unavailable'
  if (!showTraffic.value) return 'AIS off'

  switch (connectionState.value) {
    case 'connected':
      return aisPins.value.length ? `${aisPins.value.length} nearby` : 'No contacts nearby'
    case 'connecting':
      return 'Connecting'
    case 'error':
      return 'Feed unavailable'
    default:
      return 'Standby'
  }
})

const focusedSummary = computed(() => {
  if (selectedMediaPin.value) {
    return {
      eyebrow: 'Geo-tagged photo',
      title: selectedMediaPin.value.title,
      description:
        selectedMediaPin.value.caption ||
        'Attached media pinned from stored capture coordinates so the chart can show passage photos where they were taken.',
    }
  }

  if (selectedPin.value?.pinKind === 'waypoint') {
    return {
      eyebrow: 'Waypoint selected',
      title: selectedPin.value.title,
      description:
        selectedPin.value.kind === 'anchorage'
          ? 'Anchorage marker saved on this vessel route.'
          : `${selectedPin.value.kind.replaceAll('_', ' ')} marker saved on this vessel route.`,
    }
  }

  if (selectedAisPin.value) {
    const shipCategory = getAisCategory(selectedAisPin.value.shipType, selectedAisPin.value.sog)
    const destination = selectedAisPin.value.destination
      ? ` Destination ${selectedAisPin.value.destination}.`
      : ''

    return {
      eyebrow: 'AIS contact',
      title: selectedAisPin.value.title,
      description: `${shipCategory.label} contact ${formatDistanceNm(selectedAisPin.value.distanceNm)} from ${focusVessel.value?.name || 'the focus vessel'}.${destination}`,
    }
  }

  if (focusVessel.value) {
    return {
      eyebrow: 'Primary vessel',
      title: focusVessel.value.name,
      description: focusSnapshot.value?.observedAt
        ? `Last observed ${formatRelativeTime(focusSnapshot.value.observedAt)}${
            focusVessel.value.homePort ? ` near ${focusVessel.value.homePort}` : ''
          }.`
        : focusVessel.value.homePort
          ? `No fresh position fix yet. Home port is ${focusVessel.value.homePort}.`
          : 'No fresh position fix yet. Route memory and saved markers remain available.',
    }
  }

  return {
    eyebrow: 'Map view',
    title: 'Operational chart',
    description:
      'Saved passages, waypoints, live vessel fixes, and nearby AIS traffic render here when available.',
  }
})

const focusPanelLabel = computed(() => {
  if (selectedPin.value?.pinKind === 'media') return 'Photo focus'
  if (selectedPin.value?.pinKind === 'waypoint') return 'Waypoint focus'
  if (selectedPin.value?.pinKind === 'ais') return 'AIS contact'
  return 'Map focus'
})

const focusPanelMeta = computed(() => {
  if (selectedMediaPin.value) {
    const capturedLabel = selectedMediaPin.value.capturedAt
      ? `Captured ${formatTimestamp(selectedMediaPin.value.capturedAt)}`
      : 'Capture time unavailable'
    const visibilityLabel = selectedMediaPin.value.sharePublic ? 'Public photo' : 'Owner-only photo'

    return selectedMediaPin.value.isCover
      ? `${capturedLabel} · ${visibilityLabel} · Cover image`
      : `${capturedLabel} · ${visibilityLabel}`
  }

  if (selectedPin.value?.pinKind === 'waypoint' && selectedPin.value.visitedAt) {
    return `Logged ${formatTimestamp(selectedPin.value.visitedAt)}`
  }

  if (selectedPin.value?.pinKind === 'ais') {
    const relativeUpdate = formatRelativeTime(
      new Date(selectedPin.value.lastUpdateAt).toISOString(),
    )
    return selectedPin.value.callSign
      ? `Updated ${relativeUpdate} · ${selectedPin.value.callSign}`
      : `Updated ${relativeUpdate}`
  }

  if (lastDeltaAt.value) {
    return `${trafficStatus.value} · Feed ${formatRelativeTime(new Date(lastDeltaAt.value).toISOString())}`
  }

  return trafficStatus.value
})

const stats = computed(() => {
  if (selectedMediaPin.value) {
    return [
      {
        label: 'Captured',
        value: selectedMediaPin.value.capturedAt
          ? formatRelativeTime(selectedMediaPin.value.capturedAt)
          : '--',
      },
      {
        label: 'Visibility',
        value: selectedMediaPin.value.sharePublic ? 'Public' : 'Owner only',
      },
      {
        label: 'Type',
        value: selectedMediaPin.value.isCover ? 'Cover photo' : 'Photo',
      },
      {
        label: 'Position',
        value: `${selectedMediaPin.value.lat.toFixed(3)}, ${selectedMediaPin.value.lng.toFixed(3)}`,
      },
    ]
  }

  if (selectedAisPin.value) {
    return [
      {
        label: 'Observed',
        value: formatRelativeTime(new Date(selectedAisPin.value.lastUpdateAt).toISOString()),
      },
      {
        label: 'Range',
        value: formatDistanceNm(selectedAisPin.value.distanceNm),
      },
      {
        label: 'SOG',
        value:
          selectedAisPin.value.sog === null || selectedAisPin.value.sog === undefined
            ? '--'
            : formatTrafficSpeed(selectedAisPin.value.sog),
      },
      {
        label: 'Heading',
        value:
          selectedAisPin.value.heading === null || selectedAisPin.value.heading === undefined
            ? '--'
            : `${Math.round(selectedAisPin.value.heading)}°`,
      },
    ]
  }

  if (focusVessel.value && focusSnapshot.value) {
    return [
      {
        label: 'Observed',
        value: formatRelativeTime(focusSnapshot.value.observedAt),
      },
      {
        label: 'SOG',
        value:
          focusSnapshot.value.speedOverGround === null ||
          focusSnapshot.value.speedOverGround === undefined
            ? '--'
            : formatTrafficSpeed(focusSnapshot.value.speedOverGround),
      },
      {
        label: 'Heading',
        value:
          focusSnapshot.value.headingMagnetic === null ||
          focusSnapshot.value.headingMagnetic === undefined
            ? '--'
            : `${Math.round(focusSnapshot.value.headingMagnetic)}°`,
      },
      {
        label: 'Traffic',
        value: trafficStatus.value,
      },
    ]
  }

  return [
    { label: 'Routes', value: String(baseGeojson.value.features.length) },
    { label: 'Waypoints', value: String(waypointPins.value.length) },
    { label: 'Photos', value: String(mediaPins.value.length) },
    { label: 'Traffic', value: trafficStatus.value },
    { label: 'AIS', value: String(aisPins.value.length) },
  ]
})

function renderVesselPin(item: (typeof vesselPins.value)[number], isSelected: boolean) {
  return createVesselPinElement(item, isSelected, {
    isCompactViewport: isCompactViewport.value,
    showLabel: props.showPinLabels,
    showsDenseLabels: showsDenseLabels.value,
  })
}

function renderWaypointPin(item: (typeof waypointPins.value)[number], isSelected: boolean) {
  return createWaypointPinElement(item, isSelected, {
    isCompactViewport: isCompactViewport.value,
    showLabel: props.showPinLabels,
  })
}

function renderMediaPin(item: (typeof mediaPins.value)[number], isSelected: boolean) {
  return createMediaPinElement(item, isSelected, {
    isCompactViewport: isCompactViewport.value,
    showLabel: props.showPinLabels,
  })
}

function renderAisPin(item: (typeof aisPins.value)[number], isSelected: boolean) {
  return createAisPinElement(item, isSelected, {
    isCompactViewport: isCompactViewport.value,
    pinCount: aisPins.value.length,
    showLabel: props.showPinLabels,
  })
}

function renderAisFingerprint(item: (typeof aisPins.value)[number], isSelected: boolean) {
  return createAisPinFingerprint(item, isSelected, {
    isCompactViewport: isCompactViewport.value,
    pinCount: aisPins.value.length,
    showLabel: props.showPinLabels,
  })
}

function createPinElement(item: (typeof mapItems.value)[number], isSelected: boolean) {
  if (item.pinKind === 'vessel') {
    return renderVesselPin(item, isSelected)
  }

  if (item.pinKind === 'media') {
    return renderMediaPin(item, isSelected)
  }

  return renderWaypointPin(item, isSelected)
}

function createMapPinElement(item: unknown, isSelected: boolean) {
  return createPinElement(item as (typeof mapItems.value)[number], isSelected)
}

function centerOnVessel() {
  const snapshot = focusSnapshot.value

  if (
    !snapshot ||
    snapshot.positionLat === null ||
    snapshot.positionLat === undefined ||
    snapshot.positionLng === null ||
    snapshot.positionLng === undefined
  ) {
    mapRef.value?.zoomToFit(0)
    return
  }

  mapRef.value?.setRegion(
    { lat: snapshot.positionLat, lng: snapshot.positionLng },
    { lat: 0.018, lng: 0.022 },
  )
}

function handleMapReady() {
  mapInstance.value = mapRef.value?.getMap() ?? null
}

watch(
  hasSignalKSource,
  (available) => {
    if (!trafficInitialized.value) {
      showTraffic.value = available
      trafficInitialized.value = true
      return
    }

    if (!available) {
      showTraffic.value = false
      showTrafficVectors.value = false
    }
  },
  { immediate: true },
)

watch(showTraffic, (enabled) => {
  if (!enabled) {
    showTrafficVectors.value = false
  }
})

watch([showWaypoints, showMedia, showTraffic], () => {
  if (!selectedId.value) return
  if (allPins.value.some((item) => item.id === selectedId.value)) return
  selectedId.value = null
})

watch(
  () => props.autoFitKey,
  async (value, previousValue) => {
    if (!value || value === previousValue) {
      return
    }

    await nextTick()
    mapRef.value?.zoomToFit(0)
  },
)

useMarineAisOverlay({
  map: mapInstance,
  pins: aisPins,
  enabled: computed(() => showTraffic.value && hasSignalKSource.value),
  selectedId,
  createPinElement: renderAisPin,
  renderFingerprint: renderAisFingerprint,
  renderKey: computed(() => (isCompactViewport.value ? 'compact' : 'full')),
})

onBeforeUnmount(() => {
  mapInstance.value = null
})
</script>

<template>
  <div
    v-if="hasMapData"
    class="overflow-hidden rounded-[1.5rem] border border-default/70 bg-default/90"
  >
    <MyBoatMap
      ref="mapRoot"
      v-model:selected-id="selectedId"
      :items="mapItems"
      :geojson="geojson"
      :create-pin-element="createMapPinElement"
      :overlay-style-fn="routeOverlayStyle"
      :fallback-center="fallbackCenter"
      :annotation-size="annotationSize"
      :zoom-span="{ lat: 0.018, lng: 0.022 }"
      :bounding-padding="0.22"
      :height-class="heightClass"
      :persist-key="persistKey"
      :map-style="mapStyle"
      allow-fullscreen
      preserve-region
      :shows-points-of-interest="true"
      :clustering-identifier="clusteringIdentifier"
      @map-click="handleToolMapClick"
      @map-ready="handleMapReady"
    >
      <template
        #header="{ clearRememberedView, fitToContent, isFullscreen, savedRegion, toggleFullscreen }"
      >
        <div class="space-y-3 border-b border-default/70 px-4 py-3 lg:hidden">
          <div
            v-if="showFocusPanel"
            class="rounded-[1.25rem] border border-default/70 bg-default/82 px-4 py-3 shadow-card backdrop-blur-xl"
          >
            <NuxtImg
              v-if="selectedMediaPin"
              :src="selectedMediaPin.imageUrl"
              :alt="selectedMediaPin.title"
              width="640"
              height="360"
              class="mb-3 h-28 w-full rounded-[1rem] object-cover"
            />
            <p class="text-[11px] uppercase tracking-[0.22em] text-muted">{{ focusPanelLabel }}</p>
            <p class="mt-2 font-display text-lg text-default">{{ focusedSummary.title }}</p>
            <p class="mt-2 text-sm text-muted">{{ focusedSummary.description }}</p>
            <p v-if="focusPanelMeta" class="mt-3 text-xs text-muted">{{ focusPanelMeta }}</p>
          </div>

          <TrafficContactFocusCard
            v-if="selectedAisPin"
            :contact="selectedAisPin"
            :detail-path="selectedAisDetailPath"
          />

          <div class="flex flex-wrap gap-2">
            <UButton
              icon="i-lucide-scan-search"
              color="neutral"
              variant="soft"
              size="xs"
              @click="fitToContent(0)"
            >
              Fit map
            </UButton>
            <UButton
              icon="i-lucide-crosshair"
              color="neutral"
              variant="soft"
              size="xs"
              @click="centerOnVessel"
            >
              Center vessel
            </UButton>
            <UButton
              v-if="savedRegion"
              icon="i-lucide-rotate-ccw"
              color="neutral"
              variant="soft"
              size="xs"
              @click="clearRememberedView"
            >
              Reset view
            </UButton>
            <UButton
              :icon="isFullscreen ? 'i-lucide-minimize' : 'i-lucide-maximize'"
              color="neutral"
              variant="soft"
              size="xs"
              @click="toggleFullscreen"
            >
              {{ isFullscreen ? 'Exit full screen' : 'Full screen' }}
            </UButton>
            <MyBoatMapAdvancedTools
              :capabilities="toolCapabilities"
              :can-reset-view="Boolean(savedRegion)"
              :can-show-heading-line="canShowHeadingLine"
              :can-show-range-rings="canShowRangeRings"
              :has-active-indicator="hasActiveIndicator"
              :map-style="mapStyle"
              :measure-mode="measureMode"
              :measure-result="measureResult"
              :show-heading-line="showHeadingLine"
              :show-label="true"
              :show-range-rings="showRangeRings"
              size="xs"
              @reset-view="clearRememberedView"
              @set-map-style="setMapStyle"
              @toggle-heading-line="toggleHeadingLine"
              @toggle-measure="toggleMeasureMode"
              @toggle-range-rings="toggleRangeRings"
            />
          </div>
        </div>
      </template>

      <template
        #overlay="{
          clearRememberedView,
          fitToContent,
          isFullscreen,
          savedRegion,
          toggleFullscreen,
        }"
      >
        <div
          v-if="showFocusPanel"
          class="absolute left-4 top-4 hidden max-w-[18rem] rounded-[1.5rem] border border-default/70 bg-default/88 p-4 shadow-card backdrop-blur-xl lg:block"
        >
          <NuxtImg
            v-if="selectedMediaPin"
            :src="selectedMediaPin.imageUrl"
            :alt="selectedMediaPin.title"
            width="640"
            height="360"
            class="mb-3 h-28 w-full rounded-[1rem] object-cover"
          />
          <p class="text-[11px] uppercase tracking-[0.22em] text-muted">{{ focusPanelLabel }}</p>
          <p class="mt-2 font-display text-lg text-default">{{ focusedSummary.title }}</p>
          <p class="mt-2 text-sm text-muted">{{ focusedSummary.description }}</p>
          <p v-if="focusPanelMeta" class="mt-3 text-xs text-muted">{{ focusPanelMeta }}</p>
        </div>

        <div v-if="selectedAisPin" class="absolute bottom-24 left-4 hidden max-w-[20rem] lg:block">
          <TrafficContactFocusCard :contact="selectedAisPin" :detail-path="selectedAisDetailPath" />
        </div>

        <div class="absolute right-4 top-4 hidden flex-wrap justify-end gap-2 lg:flex">
          <UButton
            class="pointer-events-auto"
            icon="i-lucide-scan-search"
            color="neutral"
            variant="soft"
            size="sm"
            title="Fit map to all visible content"
            aria-label="Fit map to all visible content"
            @click="fitToContent(0)"
          />
          <UButton
            class="pointer-events-auto"
            icon="i-lucide-crosshair"
            color="neutral"
            variant="soft"
            size="sm"
            title="Center on the focused vessel"
            aria-label="Center on the focused vessel"
            @click="centerOnVessel"
          />
          <UButton
            class="pointer-events-auto"
            :icon="isFullscreen ? 'i-lucide-minimize' : 'i-lucide-maximize'"
            color="neutral"
            variant="soft"
            size="sm"
            title="Toggle fullscreen map"
            aria-label="Toggle fullscreen map"
            @click="toggleFullscreen"
          />
          <MyBoatMapAdvancedTools
            :capabilities="toolCapabilities"
            :can-reset-view="Boolean(savedRegion)"
            :can-show-heading-line="canShowHeadingLine"
            :can-show-range-rings="canShowRangeRings"
            :has-active-indicator="hasActiveIndicator"
            :map-style="mapStyle"
            :measure-mode="measureMode"
            :measure-result="measureResult"
            :show-heading-line="showHeadingLine"
            :show-range-rings="showRangeRings"
            size="sm"
            @reset-view="clearRememberedView"
            @set-map-style="setMapStyle"
            @toggle-heading-line="toggleHeadingLine"
            @toggle-measure="toggleMeasureMode"
            @toggle-range-rings="toggleRangeRings"
          />
        </div>

        <div
          v-if="showLayerToggles || showStatsRail"
          class="absolute inset-x-4 bottom-4 hidden items-end justify-between gap-3 lg:flex"
        >
          <div v-if="showLayerToggles" class="flex flex-wrap gap-2">
            <UButton
              class="pointer-events-auto"
              icon="i-lucide-route"
              :color="showRoutes ? 'primary' : 'neutral'"
              :variant="showRoutes ? 'soft' : 'outline'"
              size="xs"
              @click="showRoutes = !showRoutes"
            >
              Routes {{ baseGeojson.features.length ? `(${baseGeojson.features.length})` : '' }}
            </UButton>
            <UButton
              v-if="waypointPins.length"
              class="pointer-events-auto"
              icon="i-lucide-map-pinned"
              :color="showWaypoints ? 'primary' : 'neutral'"
              :variant="showWaypoints ? 'soft' : 'outline'"
              size="xs"
              @click="showWaypoints = !showWaypoints"
            >
              Waypoints {{ waypointPins.length ? `(${waypointPins.length})` : '' }}
            </UButton>
            <UButton
              v-if="mediaPins.length"
              class="pointer-events-auto"
              icon="i-lucide-camera"
              :color="showMedia ? 'primary' : 'neutral'"
              :variant="showMedia ? 'soft' : 'outline'"
              size="xs"
              @click="showMedia = !showMedia"
            >
              Photos {{ mediaPins.length ? `(${mediaPins.length})` : '' }}
            </UButton>
            <UButton
              class="pointer-events-auto"
              icon="i-lucide-radar"
              :color="showTraffic ? 'primary' : 'neutral'"
              :variant="showTraffic ? 'soft' : 'outline'"
              size="xs"
              :disabled="!hasSignalKSource"
              @click="showTraffic = !showTraffic"
            >
              AIS {{ aisPins.length ? `(${aisPins.length})` : '' }}
            </UButton>
            <UButton
              v-if="showTraffic"
              class="pointer-events-auto"
              icon="i-lucide-navigation-2"
              :color="showTrafficVectors ? 'primary' : 'neutral'"
              :variant="showTrafficVectors ? 'soft' : 'outline'"
              size="xs"
              @click="showTrafficVectors = !showTrafficVectors"
            >
              Vectors
            </UButton>
          </div>

          <div v-if="showStatsRail" class="grid flex-1 gap-2 sm:grid-cols-4 xl:max-w-3xl">
            <div
              v-for="stat in stats"
              :key="stat.label"
              class="rounded-[1.15rem] border border-default/70 bg-default/84 px-3 py-2 shadow-card backdrop-blur-xl"
            >
              <p class="text-[10px] uppercase tracking-[0.2em] text-muted">{{ stat.label }}</p>
              <p class="mt-1 text-sm font-semibold text-default">{{ stat.value }}</p>
            </div>
          </div>
        </div>
      </template>

      <template #footer>
        <div
          v-if="showLayerToggles || showStatsRail"
          class="space-y-3 border-t border-default/70 px-4 py-3 lg:hidden"
        >
          <div v-if="showLayerToggles" class="flex flex-wrap gap-2">
            <UButton
              icon="i-lucide-route"
              :color="showRoutes ? 'primary' : 'neutral'"
              :variant="showRoutes ? 'soft' : 'outline'"
              size="xs"
              @click="showRoutes = !showRoutes"
            >
              Routes {{ baseGeojson.features.length ? `(${baseGeojson.features.length})` : '' }}
            </UButton>
            <UButton
              v-if="waypointPins.length"
              icon="i-lucide-map-pinned"
              :color="showWaypoints ? 'primary' : 'neutral'"
              :variant="showWaypoints ? 'soft' : 'outline'"
              size="xs"
              @click="showWaypoints = !showWaypoints"
            >
              Waypoints {{ waypointPins.length ? `(${waypointPins.length})` : '' }}
            </UButton>
            <UButton
              v-if="mediaPins.length"
              icon="i-lucide-camera"
              :color="showMedia ? 'primary' : 'neutral'"
              :variant="showMedia ? 'soft' : 'outline'"
              size="xs"
              @click="showMedia = !showMedia"
            >
              Photos {{ mediaPins.length ? `(${mediaPins.length})` : '' }}
            </UButton>
            <UButton
              icon="i-lucide-radar"
              :color="showTraffic ? 'primary' : 'neutral'"
              :variant="showTraffic ? 'soft' : 'outline'"
              size="xs"
              :disabled="!hasSignalKSource"
              @click="showTraffic = !showTraffic"
            >
              AIS {{ aisPins.length ? `(${aisPins.length})` : '' }}
            </UButton>
            <UButton
              v-if="showTraffic"
              icon="i-lucide-navigation-2"
              :color="showTrafficVectors ? 'primary' : 'neutral'"
              :variant="showTrafficVectors ? 'soft' : 'outline'"
              size="xs"
              @click="showTrafficVectors = !showTrafficVectors"
            >
              Vectors
            </UButton>
          </div>

          <div v-if="showStatsRail" class="grid grid-cols-2 gap-2">
            <div
              v-for="stat in stats"
              :key="stat.label"
              class="rounded-[1.15rem] border border-default/70 bg-default/84 px-3 py-2 shadow-card backdrop-blur-xl"
            >
              <p class="text-[10px] uppercase tracking-[0.2em] text-muted">{{ stat.label }}</p>
              <p class="mt-1 text-sm font-semibold text-default">{{ stat.value }}</p>
            </div>
          </div>
        </div>
      </template>
    </MyBoatMap>
  </div>

  <AppEmptyState
    v-else
    icon="i-lucide-map"
    title="Map surfaces are ready"
    description="Saved passages, waypoints, live vessel fixes, and nearby AIS traffic render here when available."
    compact
  />
</template>
