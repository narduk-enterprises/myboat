<script setup lang="ts">
import { formatCoordinate, formatRelativeTime, formatTimestamp } from '~/utils/marine'

definePageMeta({ middleware: ['auth'] })

const route = useRoute()
const vesselSlug = computed(() => String(route.params.vesselSlug || ''))

const { data } = await useVesselDetail(vesselSlug.value)

const detail = computed(() => data.value)

useSeo({
  title: detail.value?.vessel.name || 'Vessel',
  description: 'Vessel detail including live telemetry, passages, media, and install context.',
  robots: 'noindex, nofollow',
})

useWebPageSchema({
  name: 'Vessel detail',
  description: 'Vessel detail including live telemetry, passages, media, and install context.',
})
</script>

<template>
  <div v-if="detail" class="space-y-8">
    <UPageHero
      :title="detail.vessel.name"
      :description="
        detail.vessel.summary ||
        'The canonical vessel surface for live state, historical context, and install management.'
      "
    >
      <template #links>
        <UButton
          v-if="detail.profile.username"
          :to="`/${detail.profile.username}`"
          color="neutral"
          variant="soft"
          icon="i-lucide-share-2"
        >
          Public profile
        </UButton>
      </template>
    </UPageHero>

    <div class="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
      <div class="space-y-6">
        <MarineTrackMap
          :vessels="[detail.vessel]"
          :passages="detail.passages"
          :waypoints="detail.waypoints"
          height-class="h-[30rem]"
        />

        <MarineSnapshotGrid :snapshot="detail.vessel.liveSnapshot" />

        <PassageTimeline :passages="detail.passages" />

        <MediaStrip :media="detail.media" />
      </div>

      <div class="space-y-6">
        <UCard class="border-default/80 bg-default/90 shadow-card">
          <template #header>
            <div>
              <h3 class="font-display text-xl text-default">Live position</h3>
              <p class="mt-1 text-sm text-muted">Last reported fix and operational context.</p>
            </div>
          </template>

          <div class="space-y-4 text-sm text-muted">
            <div class="rounded-2xl border border-default bg-elevated/60 px-4 py-4">
              <p class="text-xs uppercase tracking-wide text-muted">Observed</p>
              <p class="mt-2 font-medium text-default">
                {{ formatRelativeTime(detail.vessel.liveSnapshot?.observedAt) }}
              </p>
              <p class="mt-1 text-xs text-muted">
                {{ formatTimestamp(detail.vessel.liveSnapshot?.observedAt) }}
              </p>
            </div>

            <div class="rounded-2xl border border-default bg-elevated/60 px-4 py-4">
              <p class="text-xs uppercase tracking-wide text-muted">Coordinates</p>
              <p class="mt-2 font-medium text-default">
                {{ formatCoordinate(detail.vessel.liveSnapshot?.positionLat, true) }}
              </p>
              <p class="mt-1 font-medium text-default">
                {{ formatCoordinate(detail.vessel.liveSnapshot?.positionLng, false) }}
              </p>
            </div>
          </div>
        </UCard>

        <UCard class="border-default/80 bg-default/90 shadow-card">
          <template #header>
            <div>
              <h3 class="font-display text-xl text-default">Install links</h3>
              <p class="mt-1 text-sm text-muted">
                Device installs currently mapped to this vessel.
              </p>
            </div>
          </template>

          <div v-if="detail.installations.length" class="space-y-3">
            <div
              v-for="installation in detail.installations"
              :key="installation.id"
              class="rounded-2xl border border-default bg-elevated/60 px-4 py-4"
            >
              <div class="flex items-center justify-between gap-3">
                <div>
                  <p class="font-medium text-default">{{ installation.label }}</p>
                  <p class="mt-1 text-xs text-muted">
                    {{ installation.edgeHostname || 'Hostname pending' }}
                  </p>
                </div>

                <UButton
                  :to="`/dashboard/installations/${installation.id}`"
                  color="neutral"
                  variant="soft"
                >
                  Open
                </UButton>
              </div>
            </div>
          </div>

          <AppEmptyState
            v-else
            icon="i-lucide-cpu"
            title="No installs linked yet"
            description="Create or finish onboarding to attach a live device install to this vessel."
            compact
          />
        </UCard>
      </div>
    </div>
  </div>
</template>
