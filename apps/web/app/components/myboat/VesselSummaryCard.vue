<script setup lang="ts">
import type { VesselCardSummary } from '~/types/myboat'
import { formatRelativeTime, formatTimestamp } from '~/utils/marine'

defineProps<{
  vessel: VesselCardSummary
  to?: string
}>()
</script>

<template>
  <UCard class="h-full border-default/80 bg-default/90 shadow-card">
    <template #header>
      <div class="flex items-start justify-between gap-4">
        <div>
          <div class="flex items-center gap-2">
            <h3 class="font-display text-xl text-default">{{ vessel.name }}</h3>
            <UBadge v-if="vessel.isPrimary" color="primary" variant="soft">Primary</UBadge>
          </div>
          <p class="mt-1 text-sm text-muted">
            {{ vessel.vesselType || 'Cruising profile pending' }}
            <span v-if="vessel.homePort"> · {{ vessel.homePort }}</span>
          </p>
        </div>

        <div class="flex items-center gap-2 text-xs text-muted">
          <span
            class="inline-flex size-2.5 rounded-full"
            :class="vessel.liveSnapshot?.observedAt ? 'bg-success animate-pulse-glow' : 'bg-muted'"
          />
          {{ formatRelativeTime(vessel.liveSnapshot?.observedAt) }}
        </div>
      </div>
    </template>

    <div class="space-y-4">
      <p class="text-sm text-muted">
        {{
          vessel.summary ||
          'No vessel summary yet. Use onboarding to define the boat and share context for crew, family, and public followers.'
        }}
      </p>

      <div class="grid grid-cols-3 gap-3 text-sm">
        <div class="rounded-2xl bg-elevated px-3 py-2">
          <p class="text-xs uppercase tracking-wide text-muted">Passages</p>
          <p class="mt-1 font-semibold text-default">{{ vessel.latestPassage ? '1+' : '0' }}</p>
        </div>
        <div class="rounded-2xl bg-elevated px-3 py-2">
          <p class="text-xs uppercase tracking-wide text-muted">Media</p>
          <p class="mt-1 font-semibold text-default">{{ vessel.mediaCount }}</p>
        </div>
        <div class="rounded-2xl bg-elevated px-3 py-2">
          <p class="text-xs uppercase tracking-wide text-muted">Places</p>
          <p class="mt-1 font-semibold text-default">{{ vessel.waypointCount }}</p>
        </div>
      </div>

      <div
        v-if="vessel.latestPassage"
        class="rounded-2xl border border-default bg-elevated/60 px-4 py-3"
      >
        <p class="text-xs uppercase tracking-wide text-muted">Latest passage</p>
        <p class="mt-1 font-medium text-default">{{ vessel.latestPassage.title }}</p>
        <p class="mt-1 text-sm text-muted">
          {{ vessel.latestPassage.departureName || 'Departure' }}
          <span class="text-dimmed">→</span>
          {{ vessel.latestPassage.arrivalName || 'Arrival pending' }}
        </p>
        <p class="mt-1 text-xs text-muted">
          Started
          {{ formatTimestamp(vessel.latestPassage.startedAt, { month: 'short', day: 'numeric' }) }}
        </p>
      </div>

      <div class="flex items-center justify-between">
        <p class="text-xs text-muted">
          Public sharing {{ vessel.sharePublic ? 'enabled' : 'disabled' }}
        </p>

        <UButton v-if="to" :to="to" color="primary" variant="soft" icon="i-lucide-arrow-right">
          Open vessel
        </UButton>
      </div>
    </div>
  </UCard>
</template>
