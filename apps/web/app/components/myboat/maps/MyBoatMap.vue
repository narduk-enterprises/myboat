<script setup lang="ts">
import type {
  MyBoatMapGeoJsonFeatureCollection,
  MyBoatMapHandle,
  MyBoatMapOverlayStyle,
} from './map-support'

interface MyBoatMapItem {
  id: string
  lat: number
  lng: number
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
    fallbackCenter?: { lat: number; lng: number }
    annotationSize?: { width: number; height: number }
    zoomSpan?: { lat: number; lng: number }
    boundingPadding?: number
    minSpanDelta?: number
    heightClass?: string
    persistKey?: string | null
    allowFullscreen?: boolean
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
    fallbackCenter: () => ({ lat: 29.3043, lng: -94.7977 }),
    annotationSize: () => ({ width: 100, height: 56 }),
    zoomSpan: () => ({ lat: 0.018, lng: 0.022 }),
    boundingPadding: 0.22,
    minSpanDelta: 0,
    heightClass: 'h-[22rem] sm:h-[24rem]',
    persistKey: null,
    allowFullscreen: false,
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

function syncFullscreenState() {
  if (!import.meta.client || !props.allowFullscreen) {
    return
  }

  isFullscreen.value = document.fullscreenElement === mapHost.value
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

defineExpose({
  getMap: () => mapRef.value?.getMap() ?? null,
  setRegion: (center: { lat: number; lng: number }, span?: { lat: number; lng: number }) => {
    mapRef.value?.setRegion(center, span)
  },
  zoomToFit: (zoomOutLevels = 0) => {
    mapRef.value?.zoomToFit(zoomOutLevels)
  },
})
</script>

<template>
  <div class="space-y-3">
    <slot name="header" v-bind="slotBindings" />

    <div ref="mapHost" class="relative">
      <div class="pointer-events-none absolute inset-0 z-10">
        <slot name="overlay" v-bind="slotBindings" />
      </div>

      <div :class="[heightClass, isFullscreen ? '!h-screen' : '']">
        <ClientOnly>
          <AppMapKit
            ref="mapSurface"
            v-model:selected-id="selectedId"
            class="h-full"
            :items="items"
            :geojson="geojson"
            :create-pin-element="createPinElement"
            :overlay-style-fn="overlayStyleFn"
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
            @region-change="handleRegionChange"
          />
        </ClientOnly>
      </div>
    </div>

    <slot name="footer" v-bind="slotBindings" />
  </div>
</template>
