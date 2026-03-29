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
import type { MyBoatMapHandle, MyBoatMapInstallation } from './map-support'
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
    vessels?: VesselCardSummary[]
    passages?: PassageSummary[]
    waypoints?: WaypointSummary[]
    media?: MediaItemSummary[]
    installations?: MyBoatMapInstallation[]
    aisContacts?: AisContactSummary[]
    liveConnectionState?: 'idle' | 'connecting' | 'connected' | 'error'
    liveLastDeltaAt?: number | null
    hasSignalKSource?: boolean
    heightClass?: string
    persistKey?: string | null
    allowTraffic?: boolean
    defaultTrafficVisible?: boolean
    showFocusPanel?: boolean
    showLayerToggles?: boolean
    showStatsRail?: boolean
    showPinLabels?: boolean
  }>(),
  {
    vessels: () => [],
    passages: () => [],
    waypoints: () => [],
    media: () => [],
    installations: () => [],
    aisContacts: () => [],
    liveConnectionState: 'idle',
    liveLastDeltaAt: null,
    hasSignalKSource: false,
    heightClass: 'h-[22rem] sm:h-[24rem] lg:h-[28rem]',
    persistKey: null,
    allowTraffic: false,
    defaultTrafficVisible: false,
    showFocusPanel: true,
    showLayerToggles: true,
    showStatsRail: true,
    showPinLabels: true,
  },
)

const mapRef = useTemplateRef<MyBoatMapHandle>('mapRoot')
const selectedId = shallowRef<string | null>(null)
const showRoutes = shallowRef(true)
const showWaypoints = shallowRef(true)
const showMedia = shallowRef(true)
const showTraffic = shallowRef(props.defaultTrafficVisible)
const showTrafficVectors = shallowRef(false)
const showPointsOfInterest = shallowRef(true)
const isCompactViewport = useCompactViewport()
const mapInstance = shallowRef<MapKitMapSurface | null>(null)

const primaryVessel = computed(
  () => props.vessels.find((vessel) => vessel.isPrimary) || props.vessels[0] || null,
)
const focusSnapshot = computed(() => primaryVessel.value?.liveSnapshot ?? null)
const vesselPins = computed(() => buildVesselPins(props.vessels))
const waypointPins = computed(() => buildWaypointPins(props.waypoints))
const mediaPins = computed(() => buildMediaPins(props.media))
const aisPins = computed(() =>
  props.allowTraffic
    ? buildNearbyAisPins({
        contacts: props.aisContacts,
        focusSnapshot: focusSnapshot.value,
        primaryVesselName: primaryVessel.value?.name || null,
      })
    : [],
)

const mapItems = computed(() => [
  ...vesselPins.value,
  ...(showWaypoints.value ? waypointPins.value : []),
  ...(showMedia.value ? mediaPins.value : []),
])
const baseGeojson = computed(() => buildPassageFeatureCollection(props.passages))
const trafficVectorGeojson = computed(() => buildAisVectorFeatureCollection(aisPins.value))
const geojson = computed(() => ({
  type: 'FeatureCollection' as const,
  features: [
    ...(showRoutes.value ? baseGeojson.value.features : []),
    ...(props.allowTraffic && showTraffic.value && showTrafficVectors.value
      ? trafficVectorGeojson.value.features
      : []),
  ],
}))
const allPins = computed(() => [
  ...mapItems.value,
  ...(props.allowTraffic && showTraffic.value ? aisPins.value : []),
])
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
  if (!selected || selected.pinKind !== 'vessel') {
    return null
  }

  return props.vessels.find((vessel) => vessel.id === selected.vesselId) || null
})
const selectedAisPin = computed(() => {
  const selected = selectedPin.value
  return selected?.pinKind === 'ais' ? selected : null
})
const selectedMediaPin = computed(() => {
  const selected = selectedPin.value
  return selected?.pinKind === 'media' ? selected : null
})
const focusVessel = computed(() => selectedVessel.value || primaryVessel.value)
const showsDenseLabels = computed(() => mapItems.value.length <= 3)
const clusteringIdentifier = computed(() =>
  mapItems.value.length >= 8 ? 'myboat-surface-map' : undefined,
)
const annotationSize = computed(() =>
  mapItems.value.length > 10
    ? { width: 92, height: 72 }
    : showsDenseLabels.value
      ? { width: 116, height: 78 }
      : { width: 84, height: 68 },
)
const fallbackCenter = computed(() => {
  if (
    focusSnapshot.value?.positionLat !== null &&
    focusSnapshot.value?.positionLat !== undefined &&
    focusSnapshot.value.positionLng !== null &&
    focusSnapshot.value.positionLng !== undefined
  ) {
    return {
      lat: focusSnapshot.value.positionLat,
      lng: focusSnapshot.value.positionLng,
    }
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
  if (!props.allowTraffic) {
    return 'AIS unavailable'
  }

  if (!props.hasSignalKSource) {
    return 'No feed'
  }

  if (!showTraffic.value) {
    return 'AIS off'
  }

  switch (props.liveConnectionState) {
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
        'Attached media pinned from stored capture coordinates so passage photos stay visible on the route map.',
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
      eyebrow: props.vessels.length === 1 ? 'Primary vessel' : 'Fleet focus',
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
    title: 'Route surface',
    description: 'Saved passages, waypoints, and live vessel fixes render here when available.',
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

  if (props.allowTraffic && props.liveLastDeltaAt) {
    return `${trafficStatus.value} · Feed ${formatRelativeTime(new Date(props.liveLastDeltaAt).toISOString())}`
  }

  if (props.allowTraffic) {
    return trafficStatus.value
  }

  return null
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
            : `${selectedAisPin.value.sog.toFixed(1)} kts`,
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

  if (focusSnapshot.value) {
    return [
      {
        label: 'Observed',
        value: focusSnapshot.value.observedAt
          ? formatRelativeTime(focusSnapshot.value.observedAt)
          : '--',
      },
      {
        label: 'SOG',
        value:
          focusSnapshot.value.speedOverGround === null ||
          focusSnapshot.value.speedOverGround === undefined
            ? '--'
            : `${focusSnapshot.value.speedOverGround.toFixed(1)} kts`,
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
        label: props.allowTraffic ? 'Traffic' : 'Depth',
        value: props.allowTraffic
          ? trafficStatus.value
          : focusSnapshot.value.depthBelowTransducer === null ||
              focusSnapshot.value.depthBelowTransducer === undefined
            ? '--'
            : `${focusSnapshot.value.depthBelowTransducer.toFixed(1)} m`,
      },
    ]
  }

  return [
    { label: 'Vessels', value: String(vesselPins.value.length) },
    { label: 'Routes', value: String(baseGeojson.value.features.length) },
    { label: 'Waypoints', value: String(waypointPins.value.length) },
    { label: 'Photos', value: String(mediaPins.value.length) },
    {
      label: props.allowTraffic ? 'Traffic' : 'Scope',
      value: props.allowTraffic
        ? trafficStatus.value
        : props.vessels.length === 1
          ? 'Single vessel'
          : 'Fleet',
    },
  ]
})

function renderVesselPin(item: (typeof vesselPins.value)[number], isSelected: boolean) {
  return createVesselPinElement(item, isSelected, {
    alwaysShowLabel: props.showPinLabels ? undefined : false,
    isCompactViewport: isCompactViewport.value,
    showPrimaryLabel: props.showPinLabels,
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

function centerOnFocusVessel() {
  if (
    !focusSnapshot.value ||
    focusSnapshot.value.positionLat === null ||
    focusSnapshot.value.positionLat === undefined ||
    focusSnapshot.value.positionLng === null ||
    focusSnapshot.value.positionLng === undefined
  ) {
    mapRef.value?.zoomToFit(0)
    return
  }

  mapRef.value?.setRegion(
    { lat: focusSnapshot.value.positionLat, lng: focusSnapshot.value.positionLng },
    { lat: 0.018, lng: 0.022 },
  )
}

function handleMapReady() {
  mapInstance.value = mapRef.value?.getMap() ?? null
}

watch(showTraffic, (enabled) => {
  if (!enabled) {
    showTrafficVectors.value = false
  }
})

watch([showWaypoints, showMedia, showTraffic], () => {
  if (!selectedId.value) {
    return
  }

  if (allPins.value.some((item) => item.id === selectedId.value)) {
    return
  }

  selectedId.value = null
})

watch(
  () => props.hasSignalKSource,
  (available) => {
    if (!available) {
      showTraffic.value = false
      showTrafficVectors.value = false
    }
  },
  { immediate: true },
)

useMarineAisOverlay({
  map: mapInstance,
  pins: aisPins,
  enabled: computed(() => props.allowTraffic && showTraffic.value && props.hasSignalKSource),
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
      allow-fullscreen
      preserve-region
      :shows-points-of-interest="showPointsOfInterest"
      :clustering-identifier="clusteringIdentifier"
      @map-ready="handleMapReady"
    >
      <template
        v-if="showFocusPanel"
        #header="{ clearRememberedView, fitToContent, isFullscreen, savedRegion, toggleFullscreen }"
      >
        <div class="space-y-3 border-b border-default/70 px-4 py-3 lg:hidden">
          <div
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
              @click="centerOnFocusVessel"
            >
              Center vessel
            </UButton>
            <UButton
              :icon="showPointsOfInterest ? 'i-lucide-map' : 'i-lucide-map-off'"
              :color="showPointsOfInterest ? 'primary' : 'neutral'"
              :variant="showPointsOfInterest ? 'soft' : 'outline'"
              size="xs"
              @click="showPointsOfInterest = !showPointsOfInterest"
            >
              {{ showPointsOfInterest ? 'Labels on' : 'Labels off' }}
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

        <div class="absolute right-4 top-4 hidden flex-wrap justify-end gap-2 lg:flex">
          <UButton
            class="pointer-events-auto"
            icon="i-lucide-scan-search"
            color="neutral"
            variant="soft"
            size="sm"
            @click="fitToContent(0)"
          />
          <UButton
            class="pointer-events-auto"
            icon="i-lucide-crosshair"
            color="neutral"
            variant="soft"
            size="sm"
            @click="centerOnFocusVessel"
          />
          <UButton
            class="pointer-events-auto"
            :icon="showPointsOfInterest ? 'i-lucide-map' : 'i-lucide-map-off'"
            :color="showPointsOfInterest ? 'primary' : 'neutral'"
            :variant="showPointsOfInterest ? 'soft' : 'outline'"
            size="sm"
            @click="showPointsOfInterest = !showPointsOfInterest"
          />
          <UButton
            v-if="savedRegion"
            class="pointer-events-auto"
            icon="i-lucide-rotate-ccw"
            color="neutral"
            variant="soft"
            size="sm"
            @click="clearRememberedView"
          />
          <UButton
            class="pointer-events-auto"
            :icon="isFullscreen ? 'i-lucide-minimize' : 'i-lucide-maximize'"
            color="neutral"
            variant="soft"
            size="sm"
            @click="toggleFullscreen"
          />
        </div>

        <div
          v-if="showLayerToggles || showStatsRail"
          class="absolute inset-x-4 bottom-4 hidden items-end justify-between gap-3 lg:flex"
        >
          <div v-if="showLayerToggles" class="flex flex-wrap gap-2">
            <UButton
              class="pointer-events-auto"
              icon="i-lucide-ship"
              color="primary"
              variant="soft"
              size="xs"
              disabled
            >
              Vessels {{ vesselPins.length ? `(${vesselPins.length})` : '' }}
            </UButton>
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
              v-if="allowTraffic"
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
              v-if="allowTraffic && showTraffic"
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

      <template v-if="showLayerToggles || showStatsRail" #footer>
        <div class="space-y-3 border-t border-default/70 px-4 py-3 lg:hidden">
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
              icon="i-lucide-map-pinned"
              :color="showWaypoints ? 'primary' : 'neutral'"
              :variant="showWaypoints ? 'soft' : 'outline'"
              size="xs"
              @click="showWaypoints = !showWaypoints"
            >
              Waypoints {{ waypointPins.length ? `(${waypointPins.length})` : '' }}
            </UButton>
            <UButton
              icon="i-lucide-camera"
              :color="showMedia ? 'primary' : 'neutral'"
              :variant="showMedia ? 'soft' : 'outline'"
              size="xs"
              @click="showMedia = !showMedia"
            >
              Photos {{ mediaPins.length ? `(${mediaPins.length})` : '' }}
            </UButton>
            <UButton
              v-if="allowTraffic"
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
              v-if="allowTraffic && showTraffic"
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
    title="Map surface is ready"
    description="Saved passages, route markers, and live vessel fixes render here when available."
    compact
  />
</template>
