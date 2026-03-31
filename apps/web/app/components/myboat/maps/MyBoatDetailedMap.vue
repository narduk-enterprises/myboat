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
import { buildTrafficContactPath } from '~/utils/traffic'
import { mergeFeatureCollections, type MyBoatMapToolsProfile } from './advanced-tools'
import TrafficContactFocusCard from './TrafficContactFocusCard.vue'
import {
  type AisVesselCategoryKey,
  type MyBoatAisPin,
  type MyBoatMapGeoJsonFeature,
  type MyBoatMapHandle,
  type MyBoatMapInstallation,
  type MyBoatMapSelectionDetail,
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
    showRoutes?: boolean
    showWaypointsLayer?: boolean
    showMediaLayer?: boolean
    showPinLabels?: boolean
    showAdvancedTools?: boolean
    /** When false, AIS vector overlay stays off until toggles are shown again */
    defaultTrafficVectors?: boolean
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
    showRoutes: undefined,
    showWaypointsLayer: undefined,
    showMediaLayer: undefined,
    showPinLabels: true,
    showAdvancedTools: true,
    defaultTrafficVectors: true,
    autoFitKey: null,
  },
)

const emit = defineEmits<{
  'selection-change': [value: MyBoatMapSelectionDetail | null]
  'update:showMediaLayer': [value: boolean]
  'update:showRoutes': [value: boolean]
  'update:showWaypointsLayer': [value: boolean]
  'update:trafficEnabled': [value: boolean]
}>()

const mapRef = useTemplateRef<MyBoatMapHandle>('mapRoot')
const selectedId = shallowRef<string | null>(null)
const localShowRoutes = shallowRef(true)
const localShowWaypoints = shallowRef(true)
const localShowMedia = shallowRef(true)
const localTrafficEnabled = shallowRef(true)
const showTrafficVectors = shallowRef(props.defaultTrafficVectors)
/** Per-contact COG lines when global vectors are off (Tideye-style). */
const aisPerContactVectorIds = shallowRef<Set<string>>(new Set())
const aisHiddenCategoryKeys = ref<AisVesselCategoryKey[]>([])
const aisHiddenCategorySet = computed(() => new Set(aisHiddenCategoryKeys.value))
const trafficInitialized = shallowRef(false)
const isCompactViewport = useCompactViewport()
const mapInstance = shallowRef<MapKitMapSurface | null>(null)

/** Debounced visible span (lat/lng delta) for AIS pin scaling */
const mapSpanForAisScale = shallowRef({ latDelta: 0.018, lngDelta: 0.022 })
let aisScaleDebounceTimer: ReturnType<typeof setTimeout> | null = null

function handleMapRegionChange(region: {
  latDelta: number
  lngDelta: number
  centerLat: number
  centerLng: number
}) {
  if (aisScaleDebounceTimer) {
    clearTimeout(aisScaleDebounceTimer)
  }

  aisScaleDebounceTimer = setTimeout(() => {
    mapSpanForAisScale.value = {
      latDelta: region.latDelta,
      lngDelta: region.lngDelta,
    }
    aisScaleDebounceTimer = null
  }, 150)
}

const aisPinDisplayScale = computed(() => {
  const span = Math.max(mapSpanForAisScale.value.latDelta, mapSpanForAisScale.value.lngDelta)
  if (span <= 0.06) return 1
  if (span <= 0.25) return 0.85
  if (span <= 0.8) return 0.65
  return 0.45
})

const aisAnnotationSize = computed(() => {
  const dim = Math.round(34 * aisPinDisplayScale.value)
  return { width: dim, height: dim }
})

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
const showRoutes = computed({
  get: () => props.showRoutes ?? localShowRoutes.value,
  set: (value: boolean) => {
    localShowRoutes.value = value
    emit('update:showRoutes', value)
  },
})
const showWaypoints = computed({
  get: () => props.showWaypointsLayer ?? localShowWaypoints.value,
  set: (value: boolean) => {
    localShowWaypoints.value = value
    emit('update:showWaypointsLayer', value)
  },
})
const showMedia = computed({
  get: () => props.showMediaLayer ?? localShowMedia.value,
  set: (value: boolean) => {
    localShowMedia.value = value
    emit('update:showMediaLayer', value)
  },
})
const showTraffic = computed({
  get: () => props.trafficEnabled ?? localTrafficEnabled.value,
  set: (value: boolean) => {
    localTrafficEnabled.value = value
    emit('update:trafficEnabled', value)
  },
})
const nearbyAisPinsRaw = computed(() =>
  buildNearbyAisPins({
    contacts: props.aisContacts || [],
    focusSnapshot: focusSnapshot.value,
    primaryVessel: primaryVessel.value,
  }),
)
const visibleAisPins = computed(() =>
  filterAisPinsByHiddenCategories(nearbyAisPinsRaw.value, aisHiddenCategorySet.value),
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
const showAnyAisVector = computed(
  () => showTraffic.value && (showTrafficVectors.value || aisPerContactVectorIds.value.size > 0),
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
  ...(showTraffic.value ? visibleAisPins.value : []),
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
const selectedAisVectorLineEnabled = computed(() => {
  const pin = selectedAisPin.value
  if (!pin) {
    return false
  }

  return showTrafficVectors.value || aisPerContactVectorIds.value.has(pin.contactId)
})
const selectedMapSelection = computed<MyBoatMapSelectionDetail | null>(() => {
  if (selectedMediaPin.value) {
    return {
      id: selectedMediaPin.value.id,
      pinKind: 'media',
      title: selectedMediaPin.value.title,
      description: selectedMediaPin.value.caption,
      meta: selectedMediaPin.value.sharePublic ? 'Public photo' : 'Owner-only photo',
      timestamp: selectedMediaPin.value.capturedAt,
      imageUrl: selectedMediaPin.value.imageUrl,
      lat: selectedMediaPin.value.lat,
      lng: selectedMediaPin.value.lng,
    }
  }

  if (selectedPin.value?.pinKind === 'waypoint') {
    return {
      id: selectedPin.value.id,
      pinKind: 'waypoint',
      title: selectedPin.value.title,
      description: selectedPin.value.kind.replaceAll('_', ' '),
      meta: selectedPin.value.visitedAt ? 'Waypoint logged' : null,
      timestamp: selectedPin.value.visitedAt,
      lat: selectedPin.value.lat,
      lng: selectedPin.value.lng,
    }
  }

  if (selectedAisPin.value) {
    return {
      id: selectedAisPin.value.id,
      pinKind: 'ais',
      title: selectedAisPin.value.title,
      description: selectedAisPin.value.navState,
      meta: selectedAisPin.value.callSign || selectedAisPin.value.destination,
      timestamp: new Date(selectedAisPin.value.lastUpdateAt).toISOString(),
      lat: selectedAisPin.value.lat,
      lng: selectedAisPin.value.lng,
      sog: selectedAisPin.value.sog,
      heading: selectedAisPin.value.heading,
      mmsi: selectedAisPin.value.mmsi,
      destination: selectedAisPin.value.destination,
    }
  }

  return null
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
      detailPath: buildTrafficContactPath(props.trafficDetailBasePath, pin.contactId),
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
    displayScale: aisPinDisplayScale.value,
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
      aisPerContactVectorIds.value = new Set()
    }
  },
  { immediate: true },
)

watch(showTraffic, (enabled) => {
  if (!enabled) {
    showTrafficVectors.value = false
    aisPerContactVectorIds.value = new Set()
  }
})

watch(
  selectedMapSelection,
  (value) => {
    emit('selection-change', value)
  },
  { immediate: true },
)

watch([showWaypoints, showMedia, showTraffic, aisHiddenCategoryKeys], () => {
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
  pins: visibleAisPins,
  enabled: computed(() => showTraffic.value && hasSignalKSource.value),
  selectedId,
  createPinElement: renderAisPin,
  createCalloutElement: createTrafficCalloutElement,
  renderFingerprint: renderAisFingerprint,
  renderKey: computed(() => (isCompactViewport.value ? 'compact' : 'full')),
  annotationSize: aisAnnotationSize,
})

onBeforeUnmount(() => {
  if (aisScaleDebounceTimer) {
    clearTimeout(aisScaleDebounceTimer)
  }

  mapInstance.value = null
})

defineExpose({
  clearRememberedView: () => mapRef.value?.clearRememberedView?.(),
  centerOnVessel,
  isFullscreen: () => mapRef.value?.isFullscreen?.() ?? false,
  toggleFullscreen: () => mapRef.value?.toggleFullscreen?.(),
  zoomToFit: (zoomOutLevels = 0) => mapRef.value?.zoomToFit(zoomOutLevels),
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
      @region-change="handleMapRegionChange"
      @feature-select="handleMapFeatureSelect"
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
              title="Fill the browser viewport with the map"
              aria-label="Fill the browser viewport with the map"
              @click="toggleFullscreen"
            >
              {{ isFullscreen ? 'Exit full view' : 'Full view' }}
            </UButton>
            <MyBoatMapAdvancedTools
              v-if="showAdvancedTools"
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
            title="Fill the browser viewport with the map"
            aria-label="Fill the browser viewport with the map"
            @click="toggleFullscreen"
          />
          <MyBoatAisVesselTypeFilterPopover
            v-if="showTraffic && hasSignalKSource"
            v-model:hidden-keys="aisHiddenCategoryKeys"
            size="sm"
          />
          <MyBoatMapAdvancedTools
            v-if="showAdvancedTools"
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
              icon="i-lucide-route"
              color="neutral"
              :variant="showRoutes ? 'solid' : 'outline'"
              size="xs"
              @click="showRoutes = !showRoutes"
            >
              Routes {{ baseGeojson.features.length ? `(${baseGeojson.features.length})` : '' }}
            </UButton>
            <UButton
              v-if="waypointPins.length"
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
              v-if="mediaPins.length"
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
              class="pointer-events-auto"
              icon="i-lucide-radar"
              :color="showTraffic ? 'primary' : 'neutral'"
              :variant="showTraffic ? 'solid' : 'outline'"
              size="xs"
              :disabled="!hasSignalKSource"
              @click="showTraffic = !showTraffic"
            >
              AIS {{ visibleAisPins.length ? `(${visibleAisPins.length})` : '' }}
            </UButton>
            <UButton
              v-if="showTraffic"
              class="pointer-events-auto"
              icon="i-lucide-navigation-2"
              :color="showTrafficVectors ? 'primary' : 'neutral'"
              :variant="showTrafficVectors ? 'solid' : 'outline'"
              size="xs"
              @click="showTrafficVectors = !showTrafficVectors"
            >
              Vectors
            </UButton>
            <MyBoatAisVesselTypeFilterPopover
              v-if="showTraffic && hasSignalKSource"
              v-model:hidden-keys="aisHiddenCategoryKeys"
              size="xs"
            />
          </div>
        </div>
      </template>

      <template
        #footer="{ clearRememberedView, fitToContent, isFullscreen, savedRegion, toggleFullscreen }"
      >
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
              v-if="waypointPins.length"
              icon="i-lucide-map-pinned"
              color="neutral"
              :variant="showWaypoints ? 'solid' : 'outline'"
              size="xs"
              @click="showWaypoints = !showWaypoints"
            >
              Waypoints {{ waypointPins.length ? `(${waypointPins.length})` : '' }}
            </UButton>
            <UButton
              v-if="mediaPins.length"
              icon="i-lucide-camera"
              color="neutral"
              :variant="showMedia ? 'solid' : 'outline'"
              size="xs"
              @click="showMedia = !showMedia"
            >
              Photos {{ mediaPins.length ? `(${mediaPins.length})` : '' }}
            </UButton>
            <UButton
              icon="i-lucide-radar"
              :color="showTraffic ? 'primary' : 'neutral'"
              :variant="showTraffic ? 'solid' : 'outline'"
              size="xs"
              :disabled="!hasSignalKSource"
              @click="showTraffic = !showTraffic"
            >
              AIS {{ visibleAisPins.length ? `(${visibleAisPins.length})` : '' }}
            </UButton>
            <UButton
              v-if="showTraffic"
              icon="i-lucide-navigation-2"
              :color="showTrafficVectors ? 'primary' : 'neutral'"
              :variant="showTrafficVectors ? 'solid' : 'outline'"
              size="xs"
              @click="showTrafficVectors = !showTrafficVectors"
            >
              Vectors
            </UButton>
            <MyBoatAisVesselTypeFilterPopover
              v-if="showTraffic && hasSignalKSource"
              v-model:hidden-keys="aisHiddenCategoryKeys"
              size="xs"
            />
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
          </div>

          <div v-else class="flex flex-wrap gap-2">
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
              title="Fill the browser viewport with the map"
              aria-label="Fill the browser viewport with the map"
              @click="toggleFullscreen"
            >
              {{ isFullscreen ? 'Exit full view' : 'Full view' }}
            </UButton>
            <MyBoatMapAdvancedTools
              v-if="showAdvancedTools"
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
