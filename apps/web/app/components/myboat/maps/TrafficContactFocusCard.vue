<script setup lang="ts">
import type { TrafficContactDetailSummary } from '~/types/traffic'
import { formatRelativeTime } from '~/utils/marine'
import {
  formatTrafficContactDimensions,
  formatTrafficMovement,
  isTrafficMoving,
} from '~/utils/traffic'
import {
  AIS_VECTOR_LOOKAHEAD_MINUTES,
  type MyBoatAisPin,
  formatDistanceNm,
  getAisCategory,
} from './map-support'

const props = withDefaults(
  defineProps<{
    contact: MyBoatAisPin | TrafficContactDetailSummary
    detailPath?: string | null
    /** COG prediction line is visible for this contact (global or per-vessel). */
    vectorLineEnabled?: boolean
    /** Show per-contact vector toggle (moving target with course). */
    showVectorControls?: boolean
  }>(),
  {
    detailPath: null,
    vectorLineEnabled: false,
    showVectorControls: true,
  },
)

const emit = defineEmits<{
  'toggle-vector': []
}>()

const category = computed(() => getAisCategory(props.contact.shipType, props.contact.sog))
const liveState = computed(() =>
  'liveState' in props.contact && props.contact.liveState ? props.contact.liveState : 'live',
)
const lastUpdatedLabel = computed(() =>
  formatRelativeTime(new Date(props.contact.lastUpdateAt).toISOString()),
)
const movementLabel = computed(() => formatTrafficMovement(props.contact))
const dimensionsLabel = computed(() => formatTrafficContactDimensions(props.contact))

const canPlotCourseVector = computed(() => {
  if (!isTrafficMoving(props.contact.sog)) {
    return false
  }

  const course = props.contact.cog ?? props.contact.heading
  return course !== null && course !== undefined
})

function openMarineTraffic() {
  const mmsi = props.contact.mmsi?.trim()
  if (!mmsi || !import.meta.client) {
    return
  }

  window.open(
    `https://www.marinetraffic.com/en/ais/details/ships/mmsi:${encodeURIComponent(mmsi)}`,
    '_blank',
    'noopener,noreferrer',
  )
}
</script>

<template>
  <div
    class="pointer-events-auto rounded-[1.25rem] border border-default/70 bg-default/92 p-3 shadow-card backdrop-blur-xl"
  >
    <div class="flex flex-wrap items-center gap-2">
      <UBadge color="primary" variant="soft">{{ category.label }}</UBadge>
      <UBadge :color="liveState === 'live' ? 'success' : 'warning'" variant="soft">
        {{ liveState === 'live' ? 'Live contact' : 'Catalog fallback' }}
      </UBadge>
      <UBadge v-if="contact.mmsi" color="neutral" variant="soft">MMSI {{ contact.mmsi }}</UBadge>
    </div>

    <div class="mt-3 grid gap-2 sm:grid-cols-2">
      <div class="rounded-xl border border-default/70 bg-elevated/60 px-3 py-2">
        <p class="text-[10px] uppercase tracking-[0.18em] text-muted">Range</p>
        <p class="mt-1 text-sm font-semibold text-default">
          {{ formatDistanceNm(contact.distanceNm) }}
        </p>
      </div>

      <div class="rounded-xl border border-default/70 bg-elevated/60 px-3 py-2">
        <p class="text-[10px] uppercase tracking-[0.18em] text-muted">Movement</p>
        <p class="mt-1 text-sm font-semibold text-default">{{ movementLabel }}</p>
      </div>
    </div>

    <div class="mt-3 space-y-1 text-sm text-muted">
      <p>{{ contact.callSign ? `Call sign ${contact.callSign}` : 'Call sign unavailable' }}</p>
      <p>
        {{ contact.destination ? `Destination ${contact.destination}` : 'Destination unavailable' }}
      </p>
      <p>
        {{ contact.navState ? `Nav state ${contact.navState}` : 'Navigation state unavailable' }}
      </p>
      <p>{{ dimensionsLabel }}</p>
      <p>Updated {{ lastUpdatedLabel }}</p>
    </div>

    <div
      v-if="showVectorControls && canPlotCourseVector"
      class="mt-4 flex flex-wrap gap-2 border-t border-default/60 pt-3"
    >
      <UButton
        :color="vectorLineEnabled ? 'primary' : 'neutral'"
        :variant="vectorLineEnabled ? 'soft' : 'outline'"
        size="sm"
        class="min-w-0 flex-1"
        icon="i-lucide-navigation-2"
        @click="emit('toggle-vector')"
      >
        {{ AIS_VECTOR_LOOKAHEAD_MINUTES }} min vector
      </UButton>
      <UButton
        v-if="contact.mmsi"
        color="neutral"
        variant="outline"
        size="sm"
        class="min-w-0 flex-1"
        icon="i-lucide-external-link"
        @click="openMarineTraffic"
      >
        MarineTraffic
      </UButton>
    </div>

    <div v-else-if="contact.mmsi" class="mt-4 flex flex-wrap gap-2 border-t border-default/60 pt-3">
      <UButton
        color="neutral"
        variant="outline"
        size="sm"
        icon="i-lucide-external-link"
        @click="openMarineTraffic"
      >
        MarineTraffic
      </UButton>
    </div>

    <div v-if="detailPath" class="mt-4 flex flex-wrap gap-2">
      <UButton :to="detailPath" color="primary" size="sm" icon="i-lucide-ship-wheel">
        Open boat detail
      </UButton>
    </div>
  </div>
</template>
