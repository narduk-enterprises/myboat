<script setup lang="ts">
import { h, render } from 'vue'
import type { MapKitMapSurface } from '~/composables/useMarineAisOverlay'
import type {
  AisContactSummary,
  MediaItemSummary,
  PassageSummary,
  VesselCardSummary,
  WaypointSummary,
} from '~/types/myboat'
import { formatRelativeTime, formatTimestamp } from '~/utils/marine'
import { mergeFeatureCollections, type MyBoatMapToolsProfile } from './advanced-tools'
import TrafficContactFocusCard from './TrafficContactFocusCard.vue'
import {
  type AisVesselCategoryKey,
  type MyBoatAisPin,
  type MyBoatMapGeoJsonFeature,
  type MyBoatMapHandle,
  type MyBoatMapInstallation,
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
  filterAisPinsByHiddenCategories,
  formatDistanceNm,
  getAisCategory,
  routeOverlayStyle,
} from './map-support'

defineOptions({ inheritAttrs: false })

const emit = defineEmits<{
  'update:trafficEnabled': [value: boolean]
}>()

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
    toolsProfile?: MyBoatMapToolsProfile
    heightClass?: string
    persistKey?: string | null
    allowTraffic?: boolean
    /** When set, syncs with parent (e.g. live demand for AIS subscription) */
    trafficEnabled?: boolean
    defaultTrafficVisible?: boolean
    /** Show AIS / Vectors icon toggles in the map overlay (when allowTraffic) */
    showAisToggle?: boolean
    showFocusPanel?: boolean
    showLayerToggles?: boolean
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
    toolsProfile: 'viewer',
    heightClass: 'h-[22rem] sm:h-[24rem] lg:h-[28rem]',
    persistKey: null,
    allowTraffic: false,
    trafficEnabled: undefined,
    defaultTrafficVisible: false,
    showAisToggle: false,
    showFocusPanel: true,
    showLayerToggles: true,
    showPinLabels: true,
  },
)

const mapRef = useTemplateRef<MyBoatMapHandle>('mapRoot')
const selectedId = shallowRef<string | null>(null)
const showRoutes = shallowRef(true)
const showWaypoints = shallowRef(true)
const showMedia = shallowRef(true)
const localTrafficEnabled = shallowRef(props.defaultTrafficVisible)
const showTraffic = computed({
  get: () => props.trafficEnabled ?? localTrafficEnabled.value,
  set: (value: boolean) => {
    localTrafficEnabled.value = value
    emit('update:trafficEnabled', value)
  },
})
const showTrafficVectors = shallowRef(false)
const aisPerContactVectorIds = shallowRef<Set<string>>(new Set())
const aisHiddenCategoryKeys = ref<AisVesselCategoryKey[]>([])
const aisHiddenCategorySet = computed(() => new Set(aisHiddenCategoryKeys.value))

function toggleSurfaceTraffic() {
  showTraffic.value = !showTraffic.value
}

function toggleSurfaceTrafficVectors() {
  showTrafficVectors.value = !showTrafficVectors.value
}
const isCompactViewport = useCompactViewport()
const mapInstance = shallowRef<MapKitMapSurface | null>(null)

const primaryVessel = computed(
  () => props.vessels.find((vessel) => vessel.isPrimary) || props.vessels[0] || null,
)
const focusSnapshot = computed(() => primaryVessel.value?.liveSnapshot ?? null)
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
const vesselPins = computed(() => buildVesselPins(props.vessels))
const waypointPins = computed(() => buildWaypointPins(props.waypoints))
const mediaPins = computed(() => buildMediaPins(props.media))
const nearbyAisPinsRaw = computed(() =>
  props.allowTraffic
    ? buildNearbyAisPins({
        contacts: props.aisContacts,
        focusSnapshot: focusSnapshot.value,
        primaryVessel: primaryVessel.value,
      })
    : [],
)
const visibleAisPins = computed(() =>
  filterAisPinsByHiddenCategories(nearbyAisPinsRaw.value, aisHiddenCategorySet.value),
)

const mapItems = computed(() => [
  ...vesselPins.value,
  ...(showWaypoints.value ? waypointPins.value : []),
  ...(showMedia.value ? mediaPins.value : []),
])
const baseGeojson = computed(() => buildPassageFeatureCollection(props.passages))
const showAnyAisVector = computed(
  () =>
    props.allowTraffic &&
    showTraffic.value &&
    (showTrafficVectors.value || aisPerContactVectorIds.value.size > 0),
)
const trafficVectorGeojson = computed(() =>
  buildAisVectorFeatureCollection(visibleAisPins.value, {
    showAllMoving: showTrafficVectors.value,
    contactIds: aisPerContactVectorIds.value,
  }),
)
const geojson = computed(() =>
  mergeFeatureCollections(
    showRoutes.value ? baseGeojson.value : null,
    showAnyAisVector.value ? trafficVectorGeojson.value : null,
    toolGeojson.value,
  ),
)
const allPins = computed(() => [
  ...mapItems.value,
  ...(props.allowTraffic && showTraffic.value ? visibleAisPins.value : []),
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

const selectedAisVectorLineEnabled = computed(() => {
  const pin = selectedAisPin.value
  if (!pin) {
    return false
  }

  return showTrafficVectors.value || aisPerContactVectorIds.value.has(pin.contactId)
})

function isAisVectorEnabled(contactId: string) {
  return showTrafficVectors.value || aisPerContactVectorIds.value.has(contactId)
}

function toggleAisPerContactVector(contactId: string) {
  const next = new Set(aisPerContactVectorIds.value)
  if (next.has(contactId)) {
    next.delete(contactId)
  } else {
    next.add(contactId)
  }

  aisPerContactVectorIds.value = next
}

function toggleSelectedAisPerContactVector() {
  const id = selectedAisPin.value?.contactId
  if (!id) {
    return
  }

  toggleAisPerContactVector(id)
}

function createTrafficCalloutElement(pin: MyBoatAisPin) {
  const container = document.createElement('div')
  render(
    h(TrafficContactFocusCard, {
      contact: pin,
      vectorLineEnabled: isAisVectorEnabled(pin.contactId),
      showVectorControls: showTraffic.value,
      onToggleVector: () => toggleAisPerContactVector(pin.contactId),
    }),
    container,
  )

  return {
    element: container,
    cleanup: () => render(null, container),
  }
}

function handleMapFeatureSelect(feature: MyBoatMapGeoJsonFeature) {
  const properties = feature.properties
  if (properties.featureKind !== 'ais-vector') {
    return
  }

  const pinId = typeof properties.aisPinId === 'string' ? properties.aisPinId : null
  const contactId = typeof properties.aisContactId === 'string' ? properties.aisContactId : null
  selectedId.value = pinId ?? (contactId ? `ais:${contactId}` : null)
}
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
      return visibleAisPins.value.length
        ? `${visibleAisPins.value.length} nearby`
        : 'No contacts nearby'
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

function renderAisPin(item: (typeof visibleAisPins.value)[number], isSelected: boolean) {
  return createAisPinElement(item, isSelected, {
    isCompactViewport: isCompactViewport.value,
    pinCount: visibleAisPins.value.length,
    showLabel: props.showPinLabels,
  })
}

function renderAisFingerprint(item: (typeof visibleAisPins.value)[number], isSelected: boolean) {
  return createAisPinFingerprint(item, isSelected, {
    isCompactViewport: isCompactViewport.value,
    pinCount: visibleAisPins.value.length,
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

watch(
  () => showTraffic.value,
  (enabled) => {
    if (!enabled) {
      showTrafficVectors.value = false
      aisPerContactVectorIds.value = new Set()
    }
  },
)

watch([showWaypoints, showMedia, () => showTraffic.value, aisHiddenCategoryKeys], () => {
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
      aisPerContactVectorIds.value = new Set()
    }
  },
  { immediate: true },
)

watch(
  () => props.trafficEnabled,
  (next) => {
    if (next !== undefined) {
      localTrafficEnabled.value = next
    }
  },
  { immediate: true },
)

useMarineAisOverlay({
  map: mapInstance,
  pins: visibleAisPins,
  enabled: computed(() => props.allowTraffic && showTraffic.value && props.hasSignalKSource),
  selectedId,
  createPinElement: renderAisPin,
  createCalloutElement: createTrafficCalloutElement,
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
      @feature-select="handleMapFeatureSelect"
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

          <TrafficContactFocusCard
            v-if="allowTraffic && selectedAisPin"
            :contact="selectedAisPin"
            :vector-line-enabled="selectedAisVectorLineEnabled"
            :show-vector-controls="showTraffic"
            @toggle-vector="toggleSelectedAisPerContactVector"
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
              @click="centerOnFocusVessel"
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
              title="Fill the browser viewport with the map"
              aria-label="Fill the browser viewport with the map"
              @click="toggleFullscreen"
            >
              {{ isFullscreen ? 'Exit full view' : 'Full view' }}
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

        <div
          v-if="!showFocusPanel && allowTraffic && selectedAisPin"
          class="pointer-events-auto absolute bottom-4 left-4 right-4 z-20 max-h-[50vh] overflow-y-auto lg:hidden"
        >
          <TrafficContactFocusCard
            :contact="selectedAisPin"
            :vector-line-enabled="selectedAisVectorLineEnabled"
            :show-vector-controls="showTraffic"
            @toggle-vector="toggleSelectedAisPerContactVector"
          />
        </div>

        <div
          class="pointer-events-auto absolute right-4 top-4 z-20 flex flex-wrap justify-end gap-2"
        >
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
            :icon="isFullscreen ? 'i-lucide-minimize' : 'i-lucide-maximize'"
            color="neutral"
            variant="soft"
            size="sm"
            title="Fill the browser viewport with the map"
            aria-label="Fill the browser viewport with the map"
            @click="toggleFullscreen"
          />
          <template v-if="showAisToggle && allowTraffic">
            <UButton
              class="pointer-events-auto"
              icon="i-lucide-radar"
              :color="showTraffic ? 'primary' : 'neutral'"
              :variant="showTraffic ? 'solid' : 'outline'"
              size="sm"
              :disabled="!hasSignalKSource"
              @click="toggleSurfaceTraffic"
            >
              AIS {{ visibleAisPins.length ? `(${visibleAisPins.length})` : '' }}
            </UButton>
            <UButton
              v-if="showTraffic"
              class="pointer-events-auto"
              icon="i-lucide-navigation-2"
              :color="showTrafficVectors ? 'primary' : 'neutral'"
              :variant="showTrafficVectors ? 'solid' : 'outline'"
              size="sm"
              @click="toggleSurfaceTrafficVectors"
            >
              Vectors
            </UButton>
          </template>
          <MyBoatAisVesselTypeFilterPopover
            v-if="allowTraffic && showTraffic && hasSignalKSource"
            v-model:hidden-keys="aisHiddenCategoryKeys"
            size="sm"
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
          v-if="showLayerToggles"
          class="absolute inset-x-4 bottom-4 hidden items-end justify-between gap-3 lg:flex"
        >
          <div class="flex flex-wrap gap-2">
            <UButton
              class="pointer-events-auto"
              icon="i-lucide-ship"
              color="neutral"
              variant="soft"
              size="xs"
              disabled
            >
              Vessels {{ vesselPins.length ? `(${vesselPins.length})` : '' }}
            </UButton>
            <UButton
              class="pointer-events-auto"
              icon="i-lucide-route"
              color="neutral"
              :variant="showRoutes ? 'solid' : 'outline'"
              size="xs"
              @click="showRoutes = !showRoutes"
            >
              Routes {{ baseGeojson.features.length ? `(${baseGeojson.features.length})` : '' }}
            </UButton>
            <UButton
              class="pointer-events-auto"
              icon="i-lucide-map-pinned"
              color="neutral"
              :variant="showWaypoints ? 'solid' : 'outline'"
              size="xs"
              @click="showWaypoints = !showWaypoints"
            >
              Waypoints {{ waypointPins.length ? `(${waypointPins.length})` : '' }}
            </UButton>
            <UButton
              class="pointer-events-auto"
              icon="i-lucide-camera"
              color="neutral"
              :variant="showMedia ? 'solid' : 'outline'"
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
              :variant="showTraffic ? 'solid' : 'outline'"
              size="xs"
              :disabled="!hasSignalKSource"
              @click="toggleSurfaceTraffic"
            >
              AIS {{ visibleAisPins.length ? `(${visibleAisPins.length})` : '' }}
            </UButton>
            <UButton
              v-if="allowTraffic && showTraffic"
              class="pointer-events-auto"
              icon="i-lucide-navigation-2"
              :color="showTrafficVectors ? 'primary' : 'neutral'"
              :variant="showTrafficVectors ? 'solid' : 'outline'"
              size="xs"
              @click="toggleSurfaceTrafficVectors"
            >
              Vectors
            </UButton>
            <MyBoatAisVesselTypeFilterPopover
              v-if="allowTraffic && showTraffic && hasSignalKSource"
              v-model:hidden-keys="aisHiddenCategoryKeys"
              size="xs"
            />
          </div>
        </div>
      </template>

      <template v-if="showLayerToggles" #footer>
        <div class="space-y-3 border-t border-default/70 px-4 py-3 lg:hidden">
          <div v-if="showLayerToggles" class="flex flex-wrap gap-2">
            <UButton
              icon="i-lucide-route"
              color="neutral"
              :variant="showRoutes ? 'solid' : 'outline'"
              size="xs"
              @click="showRoutes = !showRoutes"
            >
              Routes {{ baseGeojson.features.length ? `(${baseGeojson.features.length})` : '' }}
            </UButton>
            <UButton
              icon="i-lucide-map-pinned"
              color="neutral"
              :variant="showWaypoints ? 'solid' : 'outline'"
              size="xs"
              @click="showWaypoints = !showWaypoints"
            >
              Waypoints {{ waypointPins.length ? `(${waypointPins.length})` : '' }}
            </UButton>
            <UButton
              icon="i-lucide-camera"
              color="neutral"
              :variant="showMedia ? 'solid' : 'outline'"
              size="xs"
              @click="showMedia = !showMedia"
            >
              Photos {{ mediaPins.length ? `(${mediaPins.length})` : '' }}
            </UButton>
            <UButton
              v-if="allowTraffic"
              icon="i-lucide-radar"
              :color="showTraffic ? 'primary' : 'neutral'"
              :variant="showTraffic ? 'solid' : 'outline'"
              size="xs"
              :disabled="!hasSignalKSource"
              @click="toggleSurfaceTraffic"
            >
              AIS {{ visibleAisPins.length ? `(${visibleAisPins.length})` : '' }}
            </UButton>
            <UButton
              v-if="allowTraffic && showTraffic"
              icon="i-lucide-navigation-2"
              :color="showTrafficVectors ? 'primary' : 'neutral'"
              :variant="showTrafficVectors ? 'solid' : 'outline'"
              size="xs"
              @click="toggleSurfaceTrafficVectors"
            >
              Vectors
            </UButton>
            <MyBoatAisVesselTypeFilterPopover
              v-if="allowTraffic && showTraffic && hasSignalKSource"
              v-model:hidden-keys="aisHiddenCategoryKeys"
              size="xs"
            />
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
