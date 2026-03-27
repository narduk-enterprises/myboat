<script setup lang="ts">
import type { PassageSummary } from '~/types/myboat'
import { formatTimestamp } from '~/utils/marine'

defineProps<{
  passages: PassageSummary[]
}>()
</script>

<template>
  <UCard class="chart-surface rounded-[1.75rem] shadow-card">
    <template #header>
      <div>
        <h3 class="font-display text-xl text-default">Passages</h3>
        <p class="mt-1 text-sm text-muted">Recent moves, route history, and historical context.</p>
      </div>
    </template>

    <div v-if="passages.length" class="space-y-4">
      <article
        v-for="passage in passages"
        :key="passage.id"
        class="rounded-2xl border border-default bg-elevated/70 px-4 py-4"
      >
        <div class="flex items-center justify-between gap-3">
          <div>
            <p class="font-medium text-default">{{ passage.title }}</p>
            <p class="mt-1 text-sm text-muted">
              {{ passage.departureName || 'Departure' }}
              <span class="text-dimmed">→</span>
              {{ passage.arrivalName || 'Arrival pending' }}
            </p>
          </div>
          <UBadge color="neutral" variant="subtle">
            {{ passage.distanceNm ? `${passage.distanceNm.toFixed(0)} nm` : 'Draft route' }}
          </UBadge>
        </div>

        <p v-if="passage.summary" class="mt-3 text-sm text-muted">{{ passage.summary }}</p>
        <p class="mt-3 text-xs text-muted">
          {{ formatTimestamp(passage.startedAt) }}
          <span v-if="passage.endedAt"> · Arrived {{ formatTimestamp(passage.endedAt) }}</span>
        </p>
      </article>
    </div>

    <MarineEmptyState
      v-else
      icon="i-lucide-route"
      title="No passages logged yet"
      description="The route history surface is ready for telemetry-backed passages, imported tracks, and retrospective voyage notes."
      compact
    />
  </UCard>
</template>
