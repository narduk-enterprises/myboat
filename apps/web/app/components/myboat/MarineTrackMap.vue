<script setup lang="ts">
import type { PassageSummary, VesselCardSummary, WaypointSummary } from '~/types/myboat'
import { buildTrackFeatureCollection, buildVesselPins, buildWaypointPins } from '~/utils/marine'

const props = withDefaults(
  defineProps<{
    vessels?: VesselCardSummary[]
    passages?: PassageSummary[]
    waypoints?: WaypointSummary[]
    heightClass?: string
  }>(),
  {
    vessels: () => [],
    passages: () => [],
    waypoints: () => [],
    heightClass: 'h-[24rem]',
  },
)

const selectedId = shallowRef<string | null>(null)

const items = computed(() => [
  ...buildVesselPins(props.vessels),
  ...buildWaypointPins(props.waypoints),
])
const geojson = computed(() => buildTrackFeatureCollection(props.passages))

function createPinElement(item: { title: string; kind: string }, isSelected: boolean) {
  const element = document.createElement('div')
  element.className =
    'rounded-full border border-white/80 px-3 py-1.5 text-xs font-semibold shadow-lg backdrop-blur-sm'
  element.style.background = isSelected ? 'rgb(12 74 110 / 0.96)' : 'rgb(15 23 42 / 0.88)'
  element.style.color = 'white'
  element.textContent = item.kind === 'anchorage' ? `⚓ ${item.title}` : item.title
  return { element }
}
</script>

<template>
  <div class="card-base overflow-hidden">
    <div class="flex items-center justify-between border-b border-default px-4 py-3">
      <div>
        <p class="text-sm font-medium text-default">Map view</p>
        <p class="text-xs text-muted">Current position, anchorages, and recorded passage lines.</p>
      </div>
      <UBadge color="primary" variant="soft">{{ items.length }} points</UBadge>
    </div>

    <div v-if="items.length || geojson.features.length" :class="heightClass">
      <ClientOnly>
        <AppMapKit
          v-model:selected-id="selectedId"
          class="h-full"
          :items="items"
          :geojson="geojson"
          :create-pin-element="createPinElement"
          :fallback-center="{ lat: 29.3043, lng: -94.7977 }"
        />
      </ClientOnly>
    </div>

    <AppEmptyState
      v-else
      icon="i-lucide-map"
      title="Map surfaces are ready"
      description="Your map will render the current vessel fix, passage history, and saved places once telemetry and waypoints are attached to this vessel."
      compact
    />
  </div>
</template>
