<script setup lang="ts">
import type { FollowedVesselSummary } from '~/types/myboat'
import { formatRelativeTime, formatTimestamp } from '~/utils/marine'

const props = withDefaults(
  defineProps<{
    vessel: FollowedVesselSummary
    removable?: boolean
    removing?: boolean
  }>(),
  {
    removable: false,
    removing: false,
  },
)

const emit = defineEmits<{
  remove: [id: string]
}>()

const stationCount = computed(() => props.vessel.sourceStations.length)
</script>

<template>
  <UCard class="border-default/80 bg-default/90 shadow-card">
    <div class="space-y-4">
      <div class="flex items-start justify-between gap-3">
        <div>
          <div class="flex flex-wrap items-center gap-2">
            <p class="font-display text-xl text-default">{{ vessel.name }}</p>
            <UBadge color="primary" variant="soft">AIS Hub</UBadge>
          </div>
          <p class="mt-1 text-sm text-muted">
            MMSI {{ vessel.mmsi }}
            <span v-if="vessel.callSign"> · {{ vessel.callSign }}</span>
            <span v-if="vessel.imo"> · IMO {{ vessel.imo }}</span>
          </p>
        </div>

        <UButton
          v-if="removable"
          color="neutral"
          variant="ghost"
          icon="i-lucide-user-round-minus"
          :loading="removing"
          @click="emit('remove', vessel.id)"
        >
          Remove
        </UButton>
      </div>

      <p class="text-sm text-muted">
        {{
          vessel.destination
            ? `Destination ${vessel.destination}`
            : 'No destination was published in the latest AIS Hub result.'
        }}
      </p>

      <div class="grid gap-3 sm:grid-cols-2">
        <div class="rounded-2xl border border-default bg-elevated/70 px-4 py-3">
          <p class="text-xs uppercase tracking-[0.22em] text-muted">Last report</p>
          <p class="mt-2 font-medium text-default">
            {{ formatRelativeTime(vessel.lastReportAt) }}
          </p>
          <p class="mt-1 text-xs text-muted">
            {{ formatTimestamp(vessel.lastReportAt) }}
          </p>
        </div>

        <div class="rounded-2xl border border-default bg-elevated/70 px-4 py-3">
          <p class="text-xs uppercase tracking-[0.22em] text-muted">Source stations</p>
          <p class="mt-2 font-medium text-default">
            {{ stationCount ? `${stationCount} stations` : 'API lookup' }}
          </p>
          <p class="mt-1 text-xs text-muted">
            {{
              vessel.matchMode === 'name'
                ? 'Saved from the public AIS Hub vessel finder.'
                : 'Saved from the authenticated AIS Hub MMSI lookup.'
            }}
          </p>
        </div>
      </div>
    </div>
  </UCard>
</template>
