<script setup lang="ts">
import type { MediaItemSummary, PassageSummary } from '~/types/myboat'
import type { PassagePlaybackMetrics } from '~/composables/usePassagePlayback'
import type { PlaybackSelectionEvent } from '~/types/playbackViewer'
import { formatTimestamp } from '~/utils/marine'

const props = withDefaults(
  defineProps<{
    event?: PlaybackSelectionEvent | null
    featuredMedia?: MediaItemSummary | null
    hasPlayback?: boolean
    metrics?: PassagePlaybackMetrics | null
    mode: 'event' | 'live' | 'scrubbed'
    passage?: PassageSummary | null
    pending?: boolean
    statusText?: string | null
    trafficCount?: number
  }>(),
  {
    event: null,
    featuredMedia: null,
    hasPlayback: false,
    metrics: null,
    passage: null,
    pending: false,
    statusText: null,
    trafficCount: 0,
  },
)

const modeLabel = computed(() => {
  if (props.mode === 'event') {
    return 'Event mode'
  }

  return props.mode === 'live' ? 'Live mode' : 'Scrubbed mode'
})

const metricRows = computed(() => {
  const metrics = props.metrics
  if (!metrics) {
    return []
  }

  return [
    {
      label: 'Time',
      value: metrics.timestampLabel,
    },
    metrics.sog != null
      ? {
          label: 'SOG',
          value: `${metrics.sog.toFixed(1)} kts`,
        }
      : null,
    metrics.speedThroughWater != null
      ? {
          label: 'STW',
          value: `${metrics.speedThroughWater.toFixed(1)} kts`,
        }
      : null,
    metrics.windTrueSpeedKts != null
      ? {
          label: 'Wind',
          value:
            metrics.windTrueDirectionDeg != null
              ? `${metrics.windTrueSpeedKts.toFixed(1)} kts · ${Math.round(metrics.windTrueDirectionDeg)}°`
              : `${metrics.windTrueSpeedKts.toFixed(1)} kts`,
        }
      : null,
    metrics.heading != null
      ? {
          label: 'Heading',
          value: `${Math.round(metrics.heading)}°`,
        }
      : null,
    metrics.depth != null
      ? {
          label: 'Depth',
          value: `${metrics.depth.toFixed(1)}`,
        }
      : null,
    metrics.distanceRemainingNm > 0
      ? {
          label: 'Remaining',
          value: `${metrics.distanceRemainingNm.toFixed(1)} nm`,
        }
      : null,
  ].filter((row): row is { label: string; value: string } => Boolean(row))
})

const eventMeta = computed(() => {
  if (!props.event) {
    return null
  }

  return [
    props.event.timestamp ? formatTimestamp(props.event.timestamp) : null,
    props.event.meta || null,
  ]
    .filter(Boolean)
    .join(' · ')
})

const mediaLead = computed(() => {
  if (props.event?.kind === 'photo') {
    if (!props.event.imageUrl) {
      return null
    }

    return {
      imageUrl: props.event.imageUrl,
      title: props.event.title,
      note: props.event.note,
      timestamp: props.event.timestamp,
    }
  }

  if (!props.featuredMedia) {
    return null
  }

  return {
    imageUrl: props.featuredMedia.imageUrl,
    title: props.featuredMedia.title,
    note: props.featuredMedia.caption,
    timestamp: props.featuredMedia.capturedAt,
  }
})
</script>

<template>
  <aside
    class="h-full rounded-[1.75rem] border border-default/70 bg-white/78 p-5 shadow-card backdrop-blur-xl"
  >
    <div class="space-y-5">
      <div>
        <p class="text-xs uppercase tracking-[0.24em] text-muted">{{ modeLabel }}</p>
        <p class="mt-2 text-sm leading-6 text-muted">
          {{
            statusText ||
            (hasPlayback
              ? 'The panel follows the active playback sample and expands when you inspect an event.'
              : 'This passage is in static route mode until replay data lands.')
          }}
        </p>
      </div>

      <div v-if="pending" class="space-y-3">
        <USkeleton class="h-6 w-28 rounded-full" />
        <USkeleton class="h-20 rounded-2xl" />
        <USkeleton class="h-20 rounded-2xl" />
      </div>

      <template v-else>
        <div
          v-if="event"
          class="space-y-2 rounded-[1.25rem] border border-default/70 bg-white/65 p-4"
        >
          <p class="text-xs uppercase tracking-[0.24em] text-muted">Selected event</p>
          <h3 class="text-lg font-semibold text-default">{{ event.title }}</h3>
          <p v-if="eventMeta" class="text-sm text-muted">{{ eventMeta }}</p>
          <p v-if="event.note" class="text-sm leading-6 text-default/80">{{ event.note }}</p>
        </div>

        <div
          class="divide-y divide-default/70 rounded-[1.25rem] border border-default/70 bg-white/65"
        >
          <div
            v-for="row in metricRows"
            :key="row.label"
            class="flex items-center justify-between gap-4 px-4 py-3"
          >
            <span class="text-xs uppercase tracking-[0.2em] text-muted">{{ row.label }}</span>
            <span class="text-sm font-medium text-default">{{ row.value }}</span>
          </div>

          <div v-if="!metricRows.length" class="px-4 py-3 text-sm text-muted">
            No playback metrics are available for this passage yet.
          </div>
        </div>

        <div
          v-if="mediaLead"
          class="overflow-hidden rounded-[1.25rem] border border-default/70 bg-white/65"
        >
          <NuxtImg
            :src="mediaLead.imageUrl"
            :alt="mediaLead.title"
            width="720"
            height="480"
            class="h-44 w-full object-cover"
          />

          <div class="space-y-2 p-4">
            <p class="text-xs uppercase tracking-[0.24em] text-muted">Photo sync</p>
            <h3 class="text-base font-semibold text-default">{{ mediaLead.title }}</h3>
            <p v-if="mediaLead.timestamp" class="text-sm text-muted">
              {{ formatTimestamp(mediaLead.timestamp) }}
            </p>
            <p v-if="mediaLead.note" class="text-sm leading-6 text-default/80">
              {{ mediaLead.note }}
            </p>
          </div>
        </div>

        <div
          v-if="trafficCount"
          class="rounded-[1.25rem] border border-default/70 bg-white/65 px-4 py-3"
        >
          <p class="text-xs uppercase tracking-[0.24em] text-muted">Nearby traffic</p>
          <p class="mt-2 text-sm text-default">
            {{ trafficCount }} live contact{{ trafficCount === 1 ? '' : 's' }} aligned with the
            current playback sample.
          </p>
        </div>

        <div
          v-if="passage?.summary && !event"
          class="rounded-[1.25rem] border border-default/70 bg-white/65 px-4 py-3"
        >
          <p class="text-xs uppercase tracking-[0.24em] text-muted">Route note</p>
          <p class="mt-2 text-sm leading-6 text-default/80">{{ passage.summary }}</p>
        </div>
      </template>
    </div>
  </aside>
</template>
