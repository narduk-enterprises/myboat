<script setup lang="ts">
import type { VesselDetailResponse } from '~/types/myboat'
import { formatTimestamp } from '~/utils/marine'

const props = defineProps<{
  detail: VesselDetailResponse
}>()

const latestPassage = computed(
  () => props.detail.passages[0] || props.detail.vessel.latestPassage || null,
)
const totalDistanceNm = computed(() =>
  props.detail.passages.reduce((sum, passage) => sum + (passage.distanceNm || 0), 0),
)
</script>

<template>
  <div class="space-y-6">
    <div class="grid gap-6 xl:grid-cols-[1.18fr_0.82fr]">
      <div data-testid="vessel-detail-passages-map">
        <MarineTrackMap
          :vessels="[detail.vessel]"
          :passages="detail.passages"
          :waypoints="detail.waypoints"
          height-class="h-[32rem]"
          traffic-mode="off"
        />
      </div>

      <UCard class="border-default/80 bg-default/90 shadow-card">
        <template #header>
          <div class="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h2 class="font-display text-2xl text-default">Passage overview</h2>
              <p class="mt-1 text-sm text-muted">
                Historical track memory, saved route geometry, and the media that belongs with it.
              </p>
            </div>

            <UButton
              :to="`/dashboard/vessels/${detail.vessel.slug}`"
              color="neutral"
              variant="soft"
              icon="i-lucide-radar"
            >
              Back to live view
            </UButton>
          </div>
        </template>

        <div class="space-y-4 text-sm text-muted">
          <div class="rounded-2xl border border-default bg-elevated/60 px-4 py-4">
            <p class="text-xs uppercase tracking-wide text-muted">Recorded passages</p>
            <p class="mt-2 font-medium text-default">
              {{ detail.passages.length }} voyage{{ detail.passages.length === 1 ? '' : 's' }}
            </p>
          </div>

          <div class="rounded-2xl border border-default bg-elevated/60 px-4 py-4">
            <p class="text-xs uppercase tracking-wide text-muted">Latest passage</p>
            <p class="mt-2 font-medium text-default">
              {{ latestPassage?.title || 'No tracked passage yet' }}
            </p>
            <p class="mt-1 text-xs text-muted">
              {{
                latestPassage?.startedAt
                  ? formatTimestamp(latestPassage.startedAt)
                  : 'Once the first trip is logged, the full route summary lands here.'
              }}
            </p>
          </div>

          <div class="rounded-2xl border border-default bg-elevated/60 px-4 py-4">
            <p class="text-xs uppercase tracking-wide text-muted">Distance logged</p>
            <p class="mt-2 font-medium text-default">
              {{ totalDistanceNm ? `${totalDistanceNm.toFixed(0)} nm` : 'Awaiting full tracks' }}
            </p>
          </div>

          <div class="rounded-2xl border border-default bg-elevated/60 px-4 py-4">
            <p class="text-xs uppercase tracking-wide text-muted">Linked context</p>
            <p class="mt-2 font-medium text-default">
              {{ detail.waypoints.length }} waypoints · {{ detail.media.length }} media items
            </p>
          </div>
        </div>
      </UCard>
    </div>

    <PassageTimeline :passages="detail.passages" />

    <MediaStrip v-if="detail.media.length" :media="detail.media" />
  </div>
</template>
