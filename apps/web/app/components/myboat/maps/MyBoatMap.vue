<script setup lang="ts">
import type {
  MyBoatMapGeoJsonFeature,
  MyBoatMapGeoJsonFeatureCollection,
  MyBoatMapHandle,
  MyBoatMapOverlayStyle,
} from './map-support'
import type { MyBoatMapStyle } from './advanced-tools'

interface MyBoatMapKitGlobal {
  Map?: {
    MapTypes?: {
      Hybrid?: unknown
      MutedStandard?: unknown
      Satellite?: unknown
      Standard?: unknown
    }
  }
  PointOfInterestFilter?: {
    excludingAllCategories?: unknown
  }
}

declare const mapkit: MyBoatMapKitGlobal

interface MyBoatMapItem {
  id: string
  lat: number
  lng: number
}

interface MyBoatMapCircleOverlay {
  lat: number
  lng: number
  radius: number
  color: string
  opacity?: number
}

interface MyBoatRuntimeMap {
  mapType?: unknown
  pointOfInterestFilter?: unknown
  showsPointsOfInterest?: boolean
}

const props = withDefaults(
  defineProps<{
    items?: MyBoatMapItem[]
    geojson?: MyBoatMapGeoJsonFeatureCollection | null
    createPinElement?: (
      item: unknown,
      isSelected: boolean,
    ) => { element: HTMLElement; cleanup?: () => void }
    overlayStyleFn?: (properties: Record<string, unknown>) => MyBoatMapOverlayStyle
    circles?: MyBoatMapCircleOverlay[]
    fallbackCenter?: { lat: number; lng: number }
    annotationSize?: { width: number; height: number }
    zoomSpan?: { lat: number; lng: number }
    boundingPadding?: number
    minSpanDelta?: number
    heightClass?: string
    persistKey?: string | null
    allowFullscreen?: boolean
    mapStyle?: MyBoatMapStyle
    preserveRegion?: boolean
    suppressSelectionZoom?: boolean
    showsPointsOfInterest?: boolean
    clusteringIdentifier?: string
  }>(),
  {
    items: () => [],
    geojson: null,
    createPinElement: undefined,
    overlayStyleFn: undefined,
    circles: () => [],
    fallbackCenter: () => ({ lat: 29.3043, lng: -94.7977 }),
    annotationSize: () => ({ width: 100, height: 56 }),
    zoomSpan: () => ({ lat: 0.018, lng: 0.022 }),
    boundingPadding: 0.22,
    minSpanDelta: 0,
    heightClass: 'h-[22rem] sm:h-[24rem]',
    persistKey: null,
    allowFullscreen: false,
    mapStyle: undefined,
    preserveRegion: false,
    suppressSelectionZoom: false,
    showsPointsOfInterest: true,
    clusteringIdentifier: undefined,
  },
)

const emit = defineEmits<{
  'map-ready': []
  'region-change': [
    region: { latDelta: number; lngDelta: number; centerLat: number; centerLng: number },
  ]
  'map-click': [coords: { lat: number; lng: number }]
  'feature-select': [feature: MyBoatMapGeoJsonFeature]
  'fullscreen-change': [value: boolean]
}>()

const selectedId = defineModel<string | null>('selectedId', { default: null })

const mapRef = useTemplateRef<MyBoatMapHandle>('mapSurface')
const mapHost = useTemplateRef<HTMLElement>('mapHost')
const isFullscreen = shallowRef(false)

const persistKey = computed(() => props.persistKey?.trim() || null)
const { savedRegion, clearSavedRegion, getSavedRegion, onRegionChange } = useMarineMapRegion(
  () => persistKey.value,
)

function fitToContent(zoomOutLevels = 0) {
  mapRef.value?.zoomToFit(zoomOutLevels)
}

function resolveEffectiveMapStyle() {
  return props.mapStyle ?? (props.showsPointsOfInterest ? 'standard' : 'muted')
}

function applyMapStyle() {
  if (!import.meta.client || typeof mapkit === 'undefined') {
    return
  }

  const map = mapRef.value?.getMap() as MyBoatRuntimeMap | null
  if (!map) {
    return
  }

  const style = resolveEffectiveMapStyle()
  const mapTypes = mapkit.Map?.MapTypes
  const excludeAllPoi = mapkit.PointOfInterestFilter?.excludingAllCategories

  if (!mapTypes) {
    return
  }

  switch (style) {
    case 'muted':
      map.mapType = mapTypes.MutedStandard
      map.showsPointsOfInterest = false
      if (excludeAllPoi) {
        map.pointOfInterestFilter = excludeAllPoi
      }
      break
    case 'satellite':
      map.mapType = mapTypes.Satellite
      map.showsPointsOfInterest = false
      if (excludeAllPoi) {
        map.pointOfInterestFilter = excludeAllPoi
      }
      break
    case 'hybrid':
      map.mapType = mapTypes.Hybrid
      map.showsPointsOfInterest = true
      if (excludeAllPoi && map.pointOfInterestFilter === excludeAllPoi) {
        map.pointOfInterestFilter = null
      }
      break
    default:
      map.mapType = mapTypes.Standard
      map.showsPointsOfInterest = true
      if (excludeAllPoi && map.pointOfInterestFilter === excludeAllPoi) {
        map.pointOfInterestFilter = null
      }
      break
  }
}

function clearRememberedView() {
  clearSavedRegion()
  fitToContent(0)
}

function handleMapReady() {
  const region = savedRegion.value || getSavedRegion()
  if (region) {
    mapRef.value?.setRegion(
      { lat: region.centerLat, lng: region.centerLng },
      { lat: region.latDelta, lng: region.lngDelta },
    )
  }

  applyMapStyle()
  emit('map-ready')
}

function handleRegionChange(region: {
  latDelta: number
  lngDelta: number
  centerLat: number
  centerLng: number
}) {
  if (persistKey.value) {
    onRegionChange(region)
  }

  emit('region-change', region)
}

function handleMapClick(coords: { lat: number; lng: number }) {
  emit('map-click', coords)
}

function handleFeatureSelect(feature: MyBoatMapGeoJsonFeature) {
  emit('feature-select', feature)
}

function syncFullscreenState() {
  if (!import.meta.client || !props.allowFullscreen) {
    return
  }

  isFullscreen.value = document.fullscreenElement === mapHost.value
  emit('fullscreen-change', isFullscreen.value)
}

function toggleFullscreen() {
  if (!import.meta.client || !props.allowFullscreen || !mapHost.value) {
    return
  }

  const ownerDocument = mapHost.value.ownerDocument
  if (ownerDocument.fullscreenElement === mapHost.value) {
    void ownerDocument.exitFullscreen?.()
    return
  }

  void mapHost.value.requestFullscreen?.()
}

const slotBindings = computed(() => ({
  clearRememberedView,
  fitToContent,
  isFullscreen: isFullscreen.value,
  savedRegion: savedRegion.value,
  toggleFullscreen,
}))

onMounted(() => {
  if (!import.meta.client || !props.allowFullscreen) {
    return
  }

  syncFullscreenState()
  document.addEventListener('fullscreenchange', syncFullscreenState)
})

onBeforeUnmount(() => {
  if (!import.meta.client || !props.allowFullscreen) {
    return
  }

  document.removeEventListener('fullscreenchange', syncFullscreenState)
})

watch(
  () => [props.mapStyle, props.showsPointsOfInterest],
  () => {
    applyMapStyle()
  },
)

watch(isFullscreen, async () => {
  if (!import.meta.client || !props.allowFullscreen) {
    return
  }

  await nextTick()
  applyMapStyle()
  window.dispatchEvent(new Event('resize'))
})

defineExpose({
  clearRememberedView,
  getMap: () => mapRef.value?.getMap() ?? null,
  isFullscreen: () => isFullscreen.value,
  setRegion: (center: { lat: number; lng: number }, span?: { lat: number; lng: number }) => {
    mapRef.value?.setRegion(center, span)
  },
  toggleFullscreen,
  zoomToFit: (zoomOutLevels = 0) => {
    mapRef.value?.zoomToFit(zoomOutLevels)
  },
})
</script>

<template>
  <div class="space-y-3">
    <slot name="header" v-bind="slotBindings" />

    <div
      ref="mapHost"
      :class="[
        allowFullscreen && isFullscreen
          ? 'relative z-[200] flex min-h-0 w-full flex-col bg-default min-h-[100dvh]'
          : 'relative',
      ]"
    >
      <div class="pointer-events-none absolute inset-0 z-10">
        <slot name="overlay" v-bind="slotBindings" />
      </div>

      <div :class="[allowFullscreen && isFullscreen ? 'min-h-0 w-full flex-1' : heightClass]">
        <ClientOnly>
          <AppMapKit
            ref="mapSurface"
            v-model:selected-id="selectedId"
            class="h-full"
            :items="items"
            :geojson="geojson"
            :create-pin-element="createPinElement"
            :overlay-style-fn="overlayStyleFn"
            :circles="circles"
            :fallback-center="fallbackCenter"
            :annotation-size="annotationSize"
            :zoom-span="zoomSpan"
            :bounding-padding="boundingPadding"
            :min-span-delta="minSpanDelta"
            :preserve-region="preserveRegion"
            :suppress-selection-zoom="suppressSelectionZoom"
            :shows-points-of-interest="showsPointsOfInterest"
            :clustering-identifier="clusteringIdentifier"
            @map-ready="handleMapReady"
            @map-click="handleMapClick"
            @region-change="handleRegionChange"
            @feature-select="handleFeatureSelect"
          />
        </ClientOnly>
      </div>
    </div>

    <slot name="footer" v-bind="slotBindings" />
  </div>
</template>
