<script setup lang="ts">
import type { VesselDetailResponse } from '~/types/myboat'
import { formatTimestamp } from '~/utils/marine'

const props = defineProps<{
  detail: VesselDetailResponse
}>()

const isCompactViewport = useCompactViewport()
const latestPassage = computed(
  () => props.detail.passages[0] || props.detail.vessel.latestPassage || null,
)
const totalDistanceNm = computed(() =>
  props.detail.passages.reduce((sum, passage) => sum + (passage.distanceNm || 0), 0),
)
</script>

<template>
  <div class="space-y-5 sm:space-y-6">
    <div class="grid gap-5 xl:grid-cols-[1.18fr_0.82fr] xl:gap-6">
      <div
        data-testid="vessel-detail-passages-map"
        :class="isCompactViewport ? 'order-2' : 'order-1'"
      >
        <MyBoatSurfaceMap
          :vessels="[detail.vessel]"
          :passages="detail.passages"
          :waypoints="detail.waypoints"
          height-class="h-[16rem] sm:h-[24rem] lg:h-[32rem]"
          :show-pin-labels="false"
        />
      </div>

      <UCard class="order-1 border-default/80 bg-default/90 shadow-card xl:order-2">
        <template #header>
          <div class="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h2 class="font-display text-xl text-default sm:text-2xl">Passage overview</h2>
              <p class="mt-1 text-sm text-muted">
                Route memory, saved geometry, and the linked context that belongs with each run.
              </p>
            </div>

            <UButton
              :to="`/dashboard/vessels/${detail.vessel.slug}`"
              color="neutral"
              variant="soft"
              icon="i-lucide-radar"
              class="w-full justify-center sm:w-auto"
            >
              Back to live view
            </UButton>
          </div>
        </template>

        <div class="grid gap-3 text-sm text-muted sm:grid-cols-2">
          <div class="rounded-2xl border border-default bg-elevated/60 px-4 py-4">
            <p class="text-xs uppercase tracking-wide text-muted">Recorded passages</p>
            <p class="mt-2 font-medium text-default">
              {{ detail.passages.length }} voyage{{ detail.passages.length === 1 ? '' : 's' }}
            </p>
          </div>

          <div class="rounded-2xl border border-default bg-elevated/60 px-4 py-4">
            <p class="text-xs uppercase tracking-wide text-muted">Distance logged</p>
            <p class="mt-2 font-medium text-default">
              {{ totalDistanceNm ? `${totalDistanceNm.toFixed(0)} nm` : 'Awaiting full tracks' }}
            </p>
          </div>

          <div class="rounded-2xl border border-default bg-elevated/60 px-4 py-4 sm:col-span-2">
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

          <div class="rounded-2xl border border-default bg-elevated/60 px-4 py-4 sm:col-span-2">
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
