<script setup lang="ts">
import type { TrafficContactDetailSummary } from '~/types/traffic'
import { formatRelativeTime } from '~/utils/marine'
import { formatTrafficContactDimensions, formatTrafficMovement } from '~/utils/traffic'
import type { MyBoatAisPin } from './map-support'
import { formatDistanceNm, getAisCategory } from './map-support'

const props = defineProps<{
  contact: MyBoatAisPin | TrafficContactDetailSummary
  detailPath?: string | null
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

    <div v-if="detailPath" class="mt-4 flex flex-wrap gap-2">
      <UButton :to="detailPath" color="primary" size="sm" icon="i-lucide-ship-wheel">
        Open boat detail
      </UButton>
    </div>
  </div>
</template>
