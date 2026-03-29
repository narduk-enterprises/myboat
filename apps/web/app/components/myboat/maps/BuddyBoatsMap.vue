<script setup lang="ts">
import type { FollowedVesselSummary } from '~/types/myboat'
import { formatCoordinate, formatRelativeTime, formatTimestamp } from '~/utils/marine'
import type { MyBoatMapHandle } from './map-support'
import { routeOverlayStyle } from './map-support'

interface BuddyBoatPin {
  id: string
  lat: number
  lng: number
  title: string
  mmsi: string
  callSign: string | null
  destination: string | null
  lastReportAt: string | null
}

const props = withDefaults(
  defineProps<{
    vessels: FollowedVesselSummary[]
    title?: string
    description?: string
    heightClass?: string
    emptyTitle?: string
    emptyDescription?: string
  }>(),
  {
    title: 'Buddy boats map',
    description: 'A wider fleet view of the buddy boats that currently have AIS positions.',
    heightClass: 'h-[20rem] sm:h-[26rem] lg:h-[30rem]',
    emptyTitle: 'No mapped buddy boats yet',
    emptyDescription:
      'Saved buddy boats will appear here once AIS Hub returns a current position for them.',
  },
)

const mapRef = useTemplateRef<MyBoatMapHandle>('mapSurface')
const selectedId = shallowRef<string | null>(null)
const isCompactViewport = useCompactViewport()
const {
  capabilities: toolCapabilities,
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
  defaultShowsPointsOfInterest: false,
  focusSnapshot: computed(() => null),
  profile: 'viewer',
})

const pins = computed<BuddyBoatPin[]>(() =>
  props.vessels
    .filter(
      (vessel) =>
        vessel.positionLat !== null &&
        vessel.positionLat !== undefined &&
        vessel.positionLng !== null &&
        vessel.positionLng !== undefined,
    )
    .map((vessel) => ({
      id: vessel.id,
      lat: vessel.positionLat!,
      lng: vessel.positionLng!,
      title: vessel.name,
      mmsi: vessel.mmsi,
      callSign: vessel.callSign,
      destination: vessel.destination,
      lastReportAt: vessel.lastReportAt,
    })),
)

const hiddenCount = computed(() => props.vessels.length - pins.value.length)
const selectedPin = computed(
  () => pins.value.find((pin) => pin.id === selectedId.value) || pins.value[0] || null,
)
const freshestPin = computed(() => {
  return (
    [...pins.value]
      .filter((pin) => pin.lastReportAt)
      .sort((left, right) => {
        return (
          new Date(right.lastReportAt || 0).getTime() - new Date(left.lastReportAt || 0).getTime()
        )
      })[0] || null
  )
})
const focusTitle = computed(() => selectedPin.value?.title || 'Buddy fleet')
const focusSubtitle = computed(() =>
  selectedPin.value ? `MMSI ${selectedPin.value.mmsi}` : 'Select a boat on the map.',
)
const selectedReportAt = computed(
  () => selectedPin.value?.lastReportAt || freshestPin.value?.lastReportAt || null,
)
const destinationLabel = computed(() => selectedPin.value?.destination || 'Unavailable')
const callSignLabel = computed(() =>
  selectedPin.value?.callSign
    ? `Call sign ${selectedPin.value.callSign}`
    : 'No call sign published.',
)
const latitudeLabel = computed(() => formatCoordinate(selectedPin.value?.lat ?? null, true))
const longitudeLabel = computed(() => formatCoordinate(selectedPin.value?.lng ?? null, false))
const hiddenDescription = computed(
  () =>
    `${hiddenCount.value} saved buddy boat${hiddenCount.value === 1 ? '' : 's'} did not include a current AIS position in the latest result.`,
)

watch(
  () => pins.value.map((pin) => `${pin.id}:${pin.lat}:${pin.lng}`).join('|'),
  () => {
    if (!selectedId.value) {
      return
    }

    if (!pins.value.some((pin) => pin.id === selectedId.value)) {
      selectedId.value = null
    }
  },
)

function reportTone(value: string | null) {
  if (!value) {
    return 'rgb(148 163 184)'
  }

  const ageMinutes = (Date.now() - new Date(value).getTime()) / 60_000

  if (ageMinutes <= 20) return 'rgb(16 185 129)'
  if (ageMinutes <= 180) return 'rgb(245 158 11)'
  return 'rgb(148 163 184)'
}

function createPinElement(item: BuddyBoatPin, isSelected: boolean) {
  const shell = document.createElement('div')
  shell.style.cssText =
    'display:flex;min-width:0;flex-direction:column;align-items:center;gap:6px;pointer-events:none;'

  const marker = document.createElement('div')
  marker.style.cssText = [
    'position:relative',
    'display:flex',
    'height:42px',
    'width:42px',
    'align-items:center',
    'justify-content:center',
    'border-radius:999px',
    'border:1px solid rgb(255 255 255 / 0.84)',
    `background:${isSelected ? 'rgb(8 47 73 / 0.96)' : 'rgb(14 116 144 / 0.88)'}`,
    `box-shadow:${isSelected ? '0 14px 28px rgb(14 116 144 / 0.28)' : '0 10px 24px rgb(15 23 42 / 0.18)'}`,
    `transform:${isSelected ? 'scale(1.06)' : 'scale(1)'}`,
    'transition:transform 180ms ease, box-shadow 180ms ease',
  ].join(';')

  marker.innerHTML = `
    <svg viewBox="0 0 32 32" width="24" height="24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path
        d="M16 3 L22 23 Q22 28 16 28 Q10 28 10 23 Z"
        fill="${isSelected ? 'rgb(224 242 254)' : 'rgb(240 249 255)'}"
        stroke="rgb(255 255 255 / 0.92)"
        stroke-width="1.2"
        stroke-linejoin="round"
      />
      <circle cx="16" cy="17" r="2" fill="${isSelected ? 'rgb(8 47 73)' : 'rgb(14 116 144)'}" opacity="0.86" />
    </svg>
  `

  const tone = document.createElement('div')
  tone.style.cssText = [
    'position:absolute',
    'right:2px',
    'top:2px',
    'height:8px',
    'width:8px',
    'border-radius:999px',
    'border:1px solid rgb(255 255 255 / 0.82)',
    `background:${reportTone(item.lastReportAt)}`,
  ].join(';')

  marker.appendChild(tone)
  shell.appendChild(marker)

  const shouldShowLabel = isSelected || (!isCompactViewport.value && pins.value.length <= 6)

  if (shouldShowLabel) {
    const label = document.createElement('div')
    label.style.cssText = [
      'max-width:160px',
      'overflow:hidden',
      'text-overflow:ellipsis',
      'white-space:nowrap',
      'border-radius:999px',
      'border:1px solid rgb(255 255 255 / 0.72)',
      `background:${isSelected ? 'rgb(8 47 73 / 0.94)' : 'rgb(255 255 255 / 0.94)'}`,
      `color:${isSelected ? 'rgb(240 249 255)' : 'rgb(15 23 42)'}`,
      'padding:4px 10px',
      'font-size:11px',
      'font-weight:700',
      'letter-spacing:0.01em',
      'box-shadow:0 10px 24px rgb(15 23 42 / 0.14)',
      'backdrop-filter:blur(12px)',
    ].join(';')
    label.textContent = item.title
    shell.appendChild(label)
  }

  return { element: shell }
}

function createMapPinElement(item: unknown, isSelected: boolean) {
  return createPinElement(item as BuddyBoatPin, isSelected)
}

function fitFleet() {
  selectedId.value = null
  mapRef.value?.zoomToFit(0)
}

function handleMapReady() {
  mapRef.value?.zoomToFit(0)
}
</script>

<template>
  <UCard class="chart-surface rounded-[1.75rem] shadow-card">
    <template #header>
      <div class="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 class="font-display text-2xl text-default">{{ title }}</h2>
          <p class="mt-1 text-sm text-muted">
            {{ description }}
          </p>
        </div>

        <div
          class="-mx-1 flex items-center gap-2 overflow-x-auto px-1 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0"
        >
          <UBadge color="primary" variant="soft">{{ pins.length }} mapped</UBadge>
          <UBadge v-if="hiddenCount" color="warning" variant="soft">
            {{ hiddenCount }} without live coordinates
          </UBadge>
        </div>
      </div>
    </template>

    <div v-if="pins.length" class="space-y-4">
      <div class="overflow-hidden rounded-[1.5rem] border border-default/70">
        <MyBoatMap
          ref="mapSurface"
          v-model:selected-id="selectedId"
          :items="pins"
          :geojson="toolGeojson"
          :create-pin-element="createMapPinElement"
          :overlay-style-fn="routeOverlayStyle"
          :annotation-size="{ width: 110, height: 74 }"
          :zoom-span="{ lat: 0.08, lng: 0.1 }"
          :bounding-padding="0.3"
          :min-span-delta="0.16"
          :fallback-center="{ lat: 29.3043, lng: -94.7977 }"
          :height-class="heightClass"
          :map-style="mapStyle"
          :shows-points-of-interest="false"
          @map-click="handleToolMapClick"
          @map-ready="handleMapReady"
        >
          <template #overlay>
            <div class="absolute right-4 top-4 hidden flex-wrap justify-end gap-2 lg:flex">
              <UButton
                class="pointer-events-auto"
                color="neutral"
                variant="soft"
                size="sm"
                icon="i-lucide-scan-search"
                @click="fitFleet"
              >
                Fit fleet
              </UButton>
              <MyBoatMapAdvancedTools
                :capabilities="toolCapabilities"
                :has-active-indicator="hasActiveIndicator"
                :map-style="mapStyle"
                :measure-mode="measureMode"
                :measure-result="measureResult"
                :show-heading-line="showHeadingLine"
                :show-range-rings="showRangeRings"
                size="sm"
                @set-map-style="setMapStyle"
                @toggle-heading-line="toggleHeadingLine"
                @toggle-measure="toggleMeasureMode"
                @toggle-range-rings="toggleRangeRings"
              />
            </div>
          </template>

          <template #footer>
            <div class="border-t border-default/70 px-4 py-3 lg:hidden">
              <div class="flex flex-wrap gap-2">
                <UButton
                  color="neutral"
                  variant="soft"
                  size="xs"
                  icon="i-lucide-scan-search"
                  @click="fitFleet"
                >
                  Fit fleet
                </UButton>
                <MyBoatMapAdvancedTools
                  :capabilities="toolCapabilities"
                  :has-active-indicator="hasActiveIndicator"
                  :map-style="mapStyle"
                  :measure-mode="measureMode"
                  :measure-result="measureResult"
                  :show-heading-line="showHeadingLine"
                  :show-label="true"
                  :show-range-rings="showRangeRings"
                  size="xs"
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

      <div v-if="selectedPin" class="grid gap-3 sm:hidden">
        <div class="rounded-[1.25rem] border border-default bg-elevated/70 px-4 py-3">
          <p class="text-xs uppercase tracking-[0.22em] text-muted">Focus</p>
          <p class="mt-2 font-display text-lg text-default">{{ focusTitle }}</p>
          <p class="mt-1 text-xs text-muted">{{ focusSubtitle }}</p>
          <p class="mt-3 text-sm font-medium text-default">{{ destinationLabel }}</p>
          <p class="mt-1 text-xs text-muted">{{ callSignLabel }}</p>
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div class="rounded-[1.25rem] border border-default bg-elevated/70 px-4 py-3">
            <p class="text-xs uppercase tracking-[0.22em] text-muted">Last report</p>
            <p class="mt-2 text-sm font-medium text-default">
              {{ formatRelativeTime(selectedReportAt) }}
            </p>
            <p class="mt-1 text-xs text-muted">{{ formatTimestamp(selectedReportAt) }}</p>
          </div>

          <div class="rounded-[1.25rem] border border-default bg-elevated/70 px-4 py-3">
            <p class="text-xs uppercase tracking-[0.22em] text-muted">Coordinates</p>
            <p class="mt-2 text-sm font-medium text-default">{{ latitudeLabel }}</p>
            <p class="mt-1 text-xs text-muted">{{ longitudeLabel }}</p>
          </div>
        </div>
      </div>

      <div class="hidden gap-3 sm:grid sm:grid-cols-2 xl:grid-cols-4">
        <div class="rounded-[1.25rem] border border-default bg-elevated/70 px-4 py-3">
          <p class="text-xs uppercase tracking-[0.22em] text-muted">Focus</p>
          <p class="mt-2 font-display text-lg text-default">{{ focusTitle }}</p>
          <p class="mt-1 text-xs text-muted">{{ focusSubtitle }}</p>
        </div>

        <div class="rounded-[1.25rem] border border-default bg-elevated/70 px-4 py-3">
          <p class="text-xs uppercase tracking-[0.22em] text-muted">Last report</p>
          <p class="mt-2 font-medium text-default">{{ formatRelativeTime(selectedReportAt) }}</p>
          <p class="mt-1 text-xs text-muted">{{ formatTimestamp(selectedReportAt) }}</p>
        </div>

        <div class="rounded-[1.25rem] border border-default bg-elevated/70 px-4 py-3">
          <p class="text-xs uppercase tracking-[0.22em] text-muted">Destination</p>
          <p class="mt-2 font-medium text-default">{{ destinationLabel }}</p>
          <p class="mt-1 text-xs text-muted">{{ callSignLabel }}</p>
        </div>

        <div class="rounded-[1.25rem] border border-default bg-elevated/70 px-4 py-3">
          <p class="text-xs uppercase tracking-[0.22em] text-muted">Coordinates</p>
          <p class="mt-2 font-medium text-default">{{ latitudeLabel }}</p>
          <p class="mt-1 text-xs text-muted">{{ longitudeLabel }}</p>
        </div>
      </div>

      <UAlert
        v-if="hiddenCount"
        color="warning"
        variant="soft"
        title="Some buddy boats are off the map"
        :description="hiddenDescription"
      />

      <div
        class="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0"
      >
        <UButton
          v-for="pin in pins"
          :key="pin.id"
          size="xs"
          class="shrink-0"
          :color="selectedId === pin.id ? 'primary' : 'neutral'"
          :variant="selectedId === pin.id ? 'soft' : 'outline'"
          @click="selectedId = selectedId === pin.id ? null : pin.id"
        >
          {{ pin.title }}
        </UButton>
      </div>
    </div>

    <MarineEmptyState
      v-else
      icon="i-lucide-users"
      :title="emptyTitle"
      :description="emptyDescription"
      compact
    />
  </UCard>
</template>
