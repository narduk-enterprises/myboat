<script setup lang="ts">
import type { AisHubSearchResult } from '~/types/myboat'
import { formatCoordinate, formatRelativeTime, formatTimestamp } from '~/utils/marine'

interface SearchMapHandle {
  zoomToFit: (zoomOutLevels?: number) => void
}

interface SearchResultPin {
  id: string
  lat: number
  lng: number
  title: string
  mmsi: string
  callSign: string | null
  destination: string | null
  lastReportAt: string | null
  sourceStations: string[]
}

const props = defineProps<{
  activeAddMmsi: string | null
  followedMmsis: Set<string>
  followPending: boolean
  results: AisHubSearchResult[]
}>()

const emit = defineEmits<{
  add: [result: AisHubSearchResult]
  viewportChange: [mmsis: string[]]
}>()

const selectedMmsi = defineModel<string | null>('selectedMmsi', { default: null })

const mapRef = useTemplateRef<SearchMapHandle>('mapSurface')
const hasViewport = shallowRef(false)
const visibleMmsis = shallowRef<string[]>([])
const isCompactViewport = useCompactViewport()

function hasCoordinates(result: AisHubSearchResult) {
  return (
    result.positionLat !== null &&
    result.positionLat !== undefined &&
    result.positionLng !== null &&
    result.positionLng !== undefined
  )
}

const mappedResults = computed(() => props.results.filter(hasCoordinates))
const pins = computed<SearchResultPin[]>(() =>
  mappedResults.value.map((result) => ({
    id: result.mmsi,
    lat: result.positionLat!,
    lng: result.positionLng!,
    title: result.name,
    mmsi: result.mmsi,
    callSign: result.callSign,
    destination: result.destination,
    lastReportAt: result.lastReportAt,
    sourceStations: result.sourceStations,
  })),
)

const selectedResult = computed(
  () => mappedResults.value.find((result) => result.mmsi === selectedMmsi.value) || null,
)
const fallbackResult = computed(() => selectedResult.value || mappedResults.value[0] || null)
const inViewCount = computed(() =>
  hasViewport.value ? visibleMmsis.value.length : pins.value.length,
)
const offChartCount = computed(() => props.results.length - mappedResults.value.length)
const focusDestination = computed(() => fallbackResult.value?.destination || 'Unavailable')
const focusCallSign = computed(() =>
  fallbackResult.value?.callSign
    ? `Call sign ${fallbackResult.value.callSign}`
    : 'No call sign published.',
)
const latitudeLabel = computed(() =>
  formatCoordinate(fallbackResult.value?.positionLat ?? null, true),
)
const longitudeLabel = computed(() =>
  formatCoordinate(fallbackResult.value?.positionLng ?? null, false),
)
const stationLabel = computed(() => {
  const stationCount = fallbackResult.value?.sourceStations.length || 0
  if (stationCount) {
    return `${stationCount} station${stationCount === 1 ? '' : 's'} reported this boat.`
  }

  return 'Served from the latest AIS Hub lookup.'
})

watch(
  () => pins.value.map((pin) => `${pin.id}:${pin.lat}:${pin.lng}`).join('|'),
  () => {
    const nextVisible = pins.value.map((pin) => pin.id)
    hasViewport.value = false
    visibleMmsis.value = nextVisible
    emit('viewportChange', nextVisible)

    if (!pins.value.length) {
      selectedMmsi.value = null
      return
    }

    if (!selectedMmsi.value || !pins.value.some((pin) => pin.id === selectedMmsi.value)) {
      selectedMmsi.value = pins.value[0]?.id ?? null
    }
  },
  { immediate: true },
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

function createPinElement(item: SearchResultPin, isSelected: boolean) {
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

  const shouldShowLabel = isSelected || (!isCompactViewport.value && pins.value.length <= 8)

  if (shouldShowLabel) {
    const label = document.createElement('div')
    label.style.cssText = [
      'max-width:164px',
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

function fitResults() {
  mapRef.value?.zoomToFit(0)
}

function handleMapReady() {
  mapRef.value?.zoomToFit(0)
}

function handleRegionChange(region: {
  latDelta: number
  lngDelta: number
  centerLat: number
  centerLng: number
}) {
  const latMin = region.centerLat - region.latDelta / 2
  const latMax = region.centerLat + region.latDelta / 2
  const lngMin = region.centerLng - region.lngDelta / 2
  const lngMax = region.centerLng + region.lngDelta / 2

  const nextVisible = pins.value
    .filter(
      (pin) => pin.lat >= latMin && pin.lat <= latMax && pin.lng >= lngMin && pin.lng <= lngMax,
    )
    .map((pin) => pin.id)

  hasViewport.value = true
  visibleMmsis.value = nextVisible
  emit('viewportChange', nextVisible)
}
</script>

<template>
  <UCard class="chart-surface rounded-[1.75rem] shadow-card">
    <template #header>
      <div class="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 class="font-display text-2xl text-default">Map search</h2>
          <p class="mt-1 text-sm text-muted">
            Search results with chart positions appear here. Pan or zoom the map and the add list
            updates to the boats inside the current window.
          </p>
        </div>

        <div
          class="-mx-1 flex items-center gap-2 overflow-x-auto px-1 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0"
        >
          <UBadge color="primary" variant="soft">{{ pins.length }} mapped</UBadge>
          <UBadge color="neutral" variant="soft">{{ inViewCount }} in view</UBadge>
          <UBadge v-if="offChartCount" color="warning" variant="soft">
            {{ offChartCount }} without coordinates
          </UBadge>
          <UButton
            v-if="pins.length"
            color="neutral"
            variant="soft"
            icon="i-lucide-scan-search"
            @click="fitResults"
          >
            Fit results
          </UButton>
        </div>
      </div>
    </template>

    <div v-if="pins.length" class="space-y-4">
      <div class="overflow-hidden rounded-[1.5rem] border border-default/70">
        <div class="h-[22rem] sm:h-[28rem] lg:h-[32rem]">
          <ClientOnly>
            <AppMapKit
              ref="mapSurface"
              v-model:selected-id="selectedMmsi"
              class="h-full"
              :items="pins"
              :create-pin-element="createPinElement"
              :annotation-size="{ width: 116, height: 80 }"
              :zoom-span="{ lat: 0.05, lng: 0.07 }"
              :bounding-padding="0.28"
              :min-span-delta="0.12"
              :fallback-center="{ lat: 29.3043, lng: -94.7977 }"
              :suppress-selection-zoom="true"
              @map-ready="handleMapReady"
              @region-change="handleRegionChange"
            />
          </ClientOnly>
        </div>
      </div>

      <div v-if="fallbackResult" class="grid gap-3 sm:hidden">
        <div class="rounded-[1.25rem] border border-default bg-elevated/70 px-4 py-3">
          <p class="text-xs uppercase tracking-[0.22em] text-muted">Focus boat</p>
          <div class="mt-2 flex flex-wrap items-center gap-2">
            <p class="font-display text-lg text-default">{{ fallbackResult.name }}</p>
            <UBadge color="neutral" variant="soft">MMSI {{ fallbackResult.mmsi }}</UBadge>
          </div>
          <p class="mt-3 text-sm text-default">{{ focusDestination }}</p>
          <p class="mt-1 text-xs text-muted">{{ focusCallSign }}</p>

          <div class="mt-3 flex flex-wrap gap-2">
            <UButton
              color="primary"
              icon="i-lucide-user-round-plus"
              :disabled="followedMmsis.has(fallbackResult.mmsi)"
              :loading="followPending && activeAddMmsi === fallbackResult.mmsi"
              @click="emit('add', fallbackResult)"
            >
              {{ followedMmsis.has(fallbackResult.mmsi) ? 'Saved' : 'Add buddy boat' }}
            </UButton>
            <UBadge
              :color="followedMmsis.has(fallbackResult.mmsi) ? 'primary' : 'neutral'"
              variant="soft"
            >
              {{ followedMmsis.has(fallbackResult.mmsi) ? 'Already saved' : 'Ready to add' }}
            </UBadge>
          </div>
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div class="rounded-[1.25rem] border border-default bg-elevated/70 px-4 py-3">
            <p class="text-xs uppercase tracking-[0.22em] text-muted">Last report</p>
            <p class="mt-2 text-sm font-medium text-default">
              {{ formatRelativeTime(fallbackResult.lastReportAt) }}
            </p>
            <p class="mt-1 text-xs text-muted">
              {{ formatTimestamp(fallbackResult.lastReportAt) }}
            </p>
          </div>

          <div class="rounded-[1.25rem] border border-default bg-elevated/70 px-4 py-3">
            <p class="text-xs uppercase tracking-[0.22em] text-muted">Coverage</p>
            <p class="mt-2 text-sm font-medium text-default">
              {{ fallbackResult.matchMode === 'mmsi' ? 'Exact MMSI match' : 'Name search match' }}
            </p>
            <p class="mt-1 text-xs text-muted">{{ stationLabel }}</p>
          </div>

          <div class="rounded-[1.25rem] border border-default bg-elevated/70 px-4 py-3">
            <p class="text-xs uppercase tracking-[0.22em] text-muted">Latitude</p>
            <p class="mt-2 text-sm font-medium text-default">{{ latitudeLabel }}</p>
          </div>

          <div class="rounded-[1.25rem] border border-default bg-elevated/70 px-4 py-3">
            <p class="text-xs uppercase tracking-[0.22em] text-muted">Longitude</p>
            <p class="mt-2 text-sm font-medium text-default">{{ longitudeLabel }}</p>
          </div>
        </div>
      </div>

      <div
        v-if="fallbackResult"
        class="hidden gap-3 sm:grid sm:grid-cols-2 xl:grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(0,1fr))]"
      >
        <div class="rounded-[1.25rem] border border-default bg-elevated/70 px-4 py-3">
          <p class="text-xs uppercase tracking-[0.22em] text-muted">Focus boat</p>
          <div class="mt-2 flex flex-wrap items-center gap-2">
            <p class="font-display text-lg text-default">{{ fallbackResult.name }}</p>
            <UBadge color="neutral" variant="soft">MMSI {{ fallbackResult.mmsi }}</UBadge>
          </div>
          <p class="mt-2 text-sm text-default">{{ focusDestination }}</p>
          <p class="mt-1 text-xs text-muted">{{ focusCallSign }}</p>

          <div class="mt-3 flex flex-wrap gap-2">
            <UButton
              color="primary"
              icon="i-lucide-user-round-plus"
              :disabled="followedMmsis.has(fallbackResult.mmsi)"
              :loading="followPending && activeAddMmsi === fallbackResult.mmsi"
              @click="emit('add', fallbackResult)"
            >
              {{ followedMmsis.has(fallbackResult.mmsi) ? 'Saved' : 'Add buddy boat' }}
            </UButton>
            <UBadge
              :color="followedMmsis.has(fallbackResult.mmsi) ? 'primary' : 'neutral'"
              variant="soft"
            >
              {{ followedMmsis.has(fallbackResult.mmsi) ? 'Already saved' : 'Ready to add' }}
            </UBadge>
          </div>
        </div>

        <div class="rounded-[1.25rem] border border-default bg-elevated/70 px-4 py-3">
          <p class="text-xs uppercase tracking-[0.22em] text-muted">Last known position report</p>
          <p class="mt-2 font-medium text-default">
            {{ formatRelativeTime(fallbackResult.lastReportAt) }}
          </p>
          <p class="mt-1 text-xs text-muted">
            {{ formatTimestamp(fallbackResult.lastReportAt) }}
          </p>
        </div>

        <div class="rounded-[1.25rem] border border-default bg-elevated/70 px-4 py-3">
          <p class="text-xs uppercase tracking-[0.22em] text-muted">Coordinates</p>
          <p class="mt-2 font-medium text-default">{{ latitudeLabel }}</p>
          <p class="mt-1 text-xs text-muted">{{ longitudeLabel }}</p>
        </div>

        <div class="rounded-[1.25rem] border border-default bg-elevated/70 px-4 py-3">
          <p class="text-xs uppercase tracking-[0.22em] text-muted">Source coverage</p>
          <p class="mt-2 font-medium text-default">
            {{ fallbackResult.matchMode === 'mmsi' ? 'Exact MMSI match' : 'Name search match' }}
          </p>
          <p class="mt-1 text-xs text-muted">{{ stationLabel }}</p>
        </div>
      </div>

      <UAlert
        v-if="offChartCount"
        color="warning"
        variant="soft"
        title="Some matches are missing a chart position"
        :description="`${offChartCount} search result${offChartCount === 1 ? '' : 's'} did not include coordinates in the latest AIS report, so they cannot be filtered by the map window.`"
      />
    </div>

    <MarineEmptyState
      v-else
      icon="i-lucide-map-pinned"
      title="Search results appear on the map"
      description="Run a buddy boat search to see chartable matches, then pan the map and add boats from the current window."
      compact
    />
  </UCard>
</template>
