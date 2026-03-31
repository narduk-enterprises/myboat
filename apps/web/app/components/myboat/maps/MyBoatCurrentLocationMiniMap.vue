<script setup lang="ts">
import type { VesselCardSummary } from '~/types/myboat'
import { buildVesselPins, createVesselPinElement } from './map-support'

defineOptions({ inheritAttrs: false })

const props = withDefaults(
  defineProps<{
    vessel: VesselCardSummary | null
    heightClass?: string
    /** When true, show controls to expand the chart to the full browser viewport. */
    allowViewportFullscreen?: boolean
  }>(),
  {
    heightClass: 'h-[20rem] sm:h-[24rem] lg:h-[28rem]',
    allowViewportFullscreen: true,
  },
)

const isCompactViewport = useCompactViewport()

const vesselPins = computed(() => (props.vessel ? buildVesselPins([props.vessel]) : []))
const fallbackCenter = computed(() => {
  const snapshot = props.vessel?.liveSnapshot
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

function renderVesselPin(item: (typeof vesselPins.value)[number], isSelected: boolean) {
  return createVesselPinElement(item, isSelected, {
    alwaysShowLabel: !isCompactViewport.value,
    isCompactViewport: isCompactViewport.value,
    showsDenseLabels: true,
  })
}

function renderMapPin(item: unknown, isSelected: boolean) {
  return renderVesselPin(item as (typeof vesselPins.value)[number], isSelected)
}
</script>

<template>
  <MyBoatMap
    v-if="vesselPins.length"
    :items="vesselPins"
    :create-pin-element="renderMapPin"
    :fallback-center="fallbackCenter"
    :annotation-size="{ width: 116, height: 78 }"
    :zoom-span="{ lat: 0.018, lng: 0.022 }"
    :bounding-padding="0.22"
    :height-class="heightClass"
    :allow-fullscreen="allowViewportFullscreen"
  >
    <template v-if="allowViewportFullscreen" #overlay="{ isFullscreen, toggleFullscreen }">
      <div class="absolute right-3 top-3 z-20 hidden lg:block">
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
      </div>
    </template>

    <template v-if="allowViewportFullscreen" #footer="{ isFullscreen, toggleFullscreen }">
      <div class="border-t border-default/70 px-3 py-2 lg:hidden">
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
    </template>
  </MyBoatMap>

  <AppEmptyState
    v-else
    icon="i-lucide-map"
    title="Current location map is ready"
    description="The mini chart will anchor to the vessel as soon as the first live position is stored."
    compact
  />
</template>
