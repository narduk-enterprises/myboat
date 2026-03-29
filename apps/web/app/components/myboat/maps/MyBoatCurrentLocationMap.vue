<script setup lang="ts">
import type { MapKitMapSurface } from '~/composables/useMarineAisOverlay'
import type { MyBoatMapHandle, MyBoatMapInstallation } from './map-support'
import type { AisContactSummary, VesselCardSummary } from '~/types/myboat'
import {
  buildAisVectorFeatureCollection,
  buildNearbyAisPins,
  buildVesselPins,
  createAisPinElement,
  createAisPinFingerprint,
  createVesselPinElement,
  routeOverlayStyle,
} from './map-support'
import { buildTrafficContactPath } from '~/utils/traffic'

defineOptions({ inheritAttrs: false })

const props = withDefaults(
  defineProps<{
    vessel: VesselCardSummary | null
    installations?: MyBoatMapInstallation[]
    aisContacts?: AisContactSummary[]
    hasSignalKSource?: boolean
    trafficEnabled?: boolean
    trafficDetailBasePath?: string | null
    heightClass?: string
  }>(),
  {
    installations: () => [],
    aisContacts: undefined,
    hasSignalKSource: undefined,
    trafficEnabled: undefined,
    trafficDetailBasePath: null,
    heightClass: 'h-[22rem] sm:h-[28rem] lg:h-[32rem]',
  },
)

const emit = defineEmits<{
  'update:trafficEnabled': [value: boolean]
}>()

const mapRef = useTemplateRef<MyBoatMapHandle>('mapRoot')
const isCompactViewport = useCompactViewport()
const selectedId = shallowRef<string | null>(null)
const localTrafficEnabled = shallowRef(true)
const showTrafficVectors = shallowRef(true)
const trafficInitialized = shallowRef(false)
const mapInstance = shallowRef<MapKitMapSurface | null>(null)

const primaryVessel = computed(() => props.vessel)
const focusSnapshot = computed(() => props.vessel?.liveSnapshot ?? null)
const vesselPins = computed(() => (props.vessel ? buildVesselPins([props.vessel]) : []))
const showTraffic = computed({
  get: () => props.trafficEnabled ?? localTrafficEnabled.value,
  set: (value: boolean) => {
    localTrafficEnabled.value = value
    emit('update:trafficEnabled', value)
  },
})
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

  return { lat: 29.3043, lng: -94.7977 }
})

const aisPins = computed(() =>
  buildNearbyAisPins({
    contacts: props.aisContacts || [],
    focusSnapshot: focusSnapshot.value,
    primaryVessel: primaryVessel.value,
  }),
)
const trafficVectorGeojson = computed(() => buildAisVectorFeatureCollection(aisPins.value))
const geojson = computed(() => ({
  type: 'FeatureCollection' as const,
  features: showTraffic.value && showTrafficVectors.value ? trafficVectorGeojson.value.features : [],
}))
const hasSignalKSource = computed(() => Boolean(props.hasSignalKSource))
const selectedAisPin = computed(() => aisPins.value.find((pin) => pin.id === selectedId.value) || null)
const selectedAisDetailPath = computed(() =>
  buildTrafficContactPath(props.trafficDetailBasePath, selectedAisPin.value?.contactId),
)

function renderVesselPin(item: (typeof vesselPins.value)[number], isSelected: boolean) {
  return createVesselPinElement(item, isSelected, {
    isCompactViewport: isCompactViewport.value,
    showPrimaryLabel: false,
    showsDenseLabels: false,
  })
}

function renderMapPin(item: unknown, isSelected: boolean) {
  return renderVesselPin(item as (typeof vesselPins.value)[number], isSelected)
}

function renderAisPin(item: (typeof aisPins.value)[number], isSelected: boolean) {
  return createAisPinElement(item, isSelected, {
    isCompactViewport: isCompactViewport.value,
    pinCount: aisPins.value.length,
  })
}

function renderAisFingerprint(item: (typeof aisPins.value)[number], isSelected: boolean) {
  return createAisPinFingerprint(item, isSelected, {
    isCompactViewport: isCompactViewport.value,
    pinCount: aisPins.value.length,
  })
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
    }
  },
  { immediate: true },
)

watch(showTraffic, (enabled) => {
  if (!enabled) {
    showTrafficVectors.value = false

    if (selectedId.value?.startsWith('ais:')) {
      selectedId.value = null
    }
  }
})

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

const toggleTrafficLabel = computed(() => {
  if (!hasSignalKSource.value) {
    return 'Other vessels unavailable'
  }

  return showTraffic.value ? 'Other vessels on' : 'Other vessels off'
})

const toggleTrafficColor = computed(() => (showTraffic.value ? 'primary' : 'neutral'))
const toggleTrafficVariant = computed(() => (showTraffic.value ? 'soft' : 'outline'))
</script>

<template>
  <div
    v-if="vesselPins.length"
    class="overflow-hidden rounded-[1.75rem] border border-default/80 bg-default/90 shadow-card"
  >
    <MyBoatMap
      ref="mapRoot"
      v-model:selected-id="selectedId"
      :items="vesselPins"
      :geojson="geojson"
      :create-pin-element="renderMapPin"
      :overlay-style-fn="routeOverlayStyle"
      :fallback-center="fallbackCenter"
      :annotation-size="{ width: 92, height: 72 }"
      :zoom-span="{ lat: 0.018, lng: 0.022 }"
      :bounding-padding="0.22"
      :height-class="heightClass"
      @map-ready="handleMapReady"
    >
      <template #overlay>
        <div class="absolute right-4 top-4 flex max-w-[calc(100%-2rem)] flex-col gap-2 sm:flex-row">
          <UButton
            class="pointer-events-auto"
            color="neutral"
            variant="soft"
            icon="i-lucide-crosshair"
            @click="centerOnVessel"
          >
            Center vessel
          </UButton>
          <UButton
            class="pointer-events-auto"
            :color="toggleTrafficColor"
            :variant="toggleTrafficVariant"
            icon="i-lucide-radar"
            :disabled="!hasSignalKSource"
            @click="showTraffic = !showTraffic"
          >
            {{ toggleTrafficLabel }}
          </UButton>
          <UButton
            v-if="showTraffic"
            class="pointer-events-auto"
            :color="showTrafficVectors ? 'primary' : 'neutral'"
            :variant="showTrafficVectors ? 'soft' : 'outline'"
            icon="i-lucide-navigation-2"
            @click="showTrafficVectors = !showTrafficVectors"
          >
            Vectors
          </UButton>
        </div>
      </template>

      <template #footer>
        <div v-if="selectedAisPin" class="border-t border-default/70 px-4 py-3">
          <TrafficContactFocusCard
            :contact="selectedAisPin"
            :detail-path="selectedAisDetailPath"
          />
        </div>
      </template>
    </MyBoatMap>
  </div>

  <AppEmptyState
    v-else
    icon="i-lucide-map"
    title="Current location map is ready"
    description="This clean chart will appear once the vessel stores a live position fix."
    compact
  />
</template>
