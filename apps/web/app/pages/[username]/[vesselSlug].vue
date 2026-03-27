<script setup lang="ts">
import { formatRelativeTime } from '~/utils/marine'

const route = useRoute()
const username = String(route.params.username || '')
const vesselSlug = String(route.params.vesselSlug || '')

const { data, error } = await usePublicVesselDetail(username, vesselSlug)

const detail = computed(() => data.value ?? null)

useSeo({
  title: detail.value ? detail.value.vessel.name : 'Vessel profile',
  description:
    detail.value?.vessel.summary ||
    'Public vessel page with live map, passage history, and onboard media.',
})

useWebPageSchema({
  name: detail.value ? detail.value.vessel.name : 'Vessel profile',
  description:
    detail.value?.vessel.summary ||
    'Public vessel page with live map, passage history, and onboard media.',
  type: 'WebPage',
})
</script>

<template>
  <div class="space-y-8">
    <template v-if="detail">
      <section class="public-hero px-6 py-10 shadow-overlay sm:px-10">
        <div class="relative z-10 space-y-4">
          <div>
            <UButton
              :to="`/${detail.profile.username}`"
              color="neutral"
              variant="ghost"
              size="sm"
              icon="i-lucide-arrow-left"
              class="-ml-2"
            >
              @{{ detail.profile.username }}
            </UButton>
          </div>

          <div>
            <h1 class="font-display text-5xl text-default">{{ detail.vessel.name }}</h1>
            <p class="mt-2 text-lg text-muted">
              {{ detail.vessel.vesselType || 'Vessel' }}
              <span v-if="detail.vessel.homePort"> · {{ detail.vessel.homePort }}</span>
            </p>
          </div>

          <p v-if="detail.vessel.summary" class="max-w-2xl text-sm text-muted">
            {{ detail.vessel.summary }}
          </p>

          <div class="flex items-center gap-2 text-sm text-muted">
            <span
              class="inline-flex size-2.5 rounded-full"
              :class="
                detail.vessel.liveSnapshot?.observedAt
                  ? 'animate-pulse-glow bg-success'
                  : 'bg-muted'
              "
            />
            {{ formatRelativeTime(detail.vessel.liveSnapshot?.observedAt) }}
          </div>
        </div>
      </section>

      <MarineTrackMap
        :vessels="[detail.vessel]"
        :passages="detail.passages"
        :waypoints="detail.waypoints"
        height-class="h-[28rem]"
      />

      <section>
        <h2 class="mb-4 font-display text-2xl text-default">Live telemetry</h2>
        <MarineSnapshotGrid :snapshot="detail.vessel.liveSnapshot" />
      </section>

      <PassageTimeline :passages="detail.passages" />

      <MediaStrip :media="detail.media" />
    </template>

    <UAlert
      v-else-if="error"
      color="error"
      variant="soft"
      title="Vessel unavailable"
      description="This vessel page could not be found or is not currently shared publicly."
    />
  </div>
</template>
