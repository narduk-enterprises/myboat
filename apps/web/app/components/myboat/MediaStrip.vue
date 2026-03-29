<script setup lang="ts">
import type { MediaItemSummary } from '~/types/myboat'
import { formatTimestamp } from '~/utils/marine'

defineProps<{
  media: MediaItemSummary[]
}>()
</script>

<template>
  <UCard class="chart-surface rounded-[1.75rem] shadow-card">
    <template #header>
      <div>
        <h3 class="font-display text-lg text-default sm:text-xl">Media & notes</h3>
        <p class="mt-1 text-sm text-muted">
          Photos, observations, and place-linked memory from the boat.
        </p>
      </div>
    </template>

    <div
      v-if="media.length"
      class="flex gap-3 overflow-x-auto pb-1 md:grid md:grid-cols-2 md:gap-4 md:overflow-visible xl:grid-cols-3"
    >
      <article
        v-for="item in media"
        :key="item.id"
        class="min-w-[16.5rem] shrink-0 overflow-hidden rounded-2xl border border-default bg-elevated/70 md:min-w-0"
      >
        <NuxtImg
          :src="item.imageUrl"
          :alt="item.title"
          class="h-36 w-full object-cover md:h-40"
          width="640"
          height="400"
        />
        <div class="space-y-2 px-4 py-4">
          <p class="font-medium text-default">{{ item.title }}</p>
          <p v-if="item.caption" class="text-sm text-muted">{{ item.caption }}</p>
          <p class="text-xs text-muted">{{ formatTimestamp(item.capturedAt) }}</p>
        </div>
      </article>
    </div>

    <MarineEmptyState
      v-else
      icon="i-lucide-camera"
      title="No media connected yet"
      description="Once images and notes are attached to passages or places, this strip becomes the visual memory of the boat."
      compact
    />
  </UCard>
</template>
