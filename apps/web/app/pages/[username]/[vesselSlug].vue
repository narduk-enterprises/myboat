<script setup lang="ts">
import { formatCoordinate, formatRelativeTime, formatTimestamp } from '~/utils/marine'

definePageMeta({ layout: 'landing' })

const route = useRoute()
const username = computed(() => String(route.params.username || ''))
const vesselSlug = computed(() => String(route.params.vesselSlug || ''))

const { data, error } = await usePublicVesselDetail(username.value, vesselSlug.value)

const detail = computed(() => data.value ?? null)
const safeSnapshot = computed(() => detail.value?.vessel.liveSnapshot ?? null)

useSeo({
  title: detail.value ? `${detail.value.vessel.name} · @${detail.value.profile.username}` : 'Public vessel',
  description:
    detail.value?.vessel.summary ||
    'Public MyBoat vessel detail with live status, route memory, and captain-approved sharing.',
})

useWebPageSchema({
  name: 'Public vessel',
  description:
    'Public MyBoat vessel detail with live status, route memory, and captain-approved sharing.',
  type: 'WebPage',
})
</script>

<template>
  <div class="space-y-8">
    <template v-if="detail">
      <section class="public-hero px-6 py-10 shadow-overlay sm:px-10">
        <div class="relative z-10 grid gap-8 lg:grid-cols-[1.05fr_0.95fr]">
          <div class="space-y-4">
            <div class="marine-kicker w-fit">Public vessel</div>
            <div>
              <h1 class="font-display text-5xl text-default sm:text-6xl">
                {{ detail.vessel.name }}
              </h1>
              <p class="mt-3 max-w-2xl text-lg text-muted">
                {{
                  detail.vessel.summary ||
                  'Live vessel surface with current position, public-ready route memory, and public install posture.'
                }}
              </p>
            </div>
            <div class="flex flex-wrap gap-3 text-sm text-muted">
              <span class="rounded-full border border-default/60 px-4 py-2">
                @{{ detail.profile.username }}
              </span>
              <span v-if="detail.vessel.homePort" class="rounded-full border border-default/60 px-4 py-2">
                {{ detail.vessel.homePort }}
              </span>
              <span class="rounded-full border border-default/60 px-4 py-2">
                {{ detail.freshnessState }}
              </span>
            </div>
          </div>

          <UCard class="chart-surface rounded-[1.75rem]">
            <div class="grid gap-3 sm:grid-cols-2">
              <div class="metric-shell rounded-[1.35rem] p-4">
                <p class="text-xs uppercase tracking-[0.24em] text-muted">Observed</p>
                <p class="mt-3 font-display text-xl text-default">
                  {{ formatRelativeTime(safeSnapshot?.observedAt) }}
                </p>
                <p class="mt-2 text-xs text-muted">
                  {{ formatTimestamp(safeSnapshot?.observedAt) }}
                </p>
              </div>
              <div class="metric-shell rounded-[1.35rem] p-4">
                <p class="text-xs uppercase tracking-[0.24em] text-muted">Speed</p>
                <p class="mt-3 font-display text-xl text-default">
                  {{
                    safeSnapshot?.speedOverGround
                      ? `${safeSnapshot.speedOverGround.toFixed(1)} kts`
                      : 'Unavailable'
                  }}
                </p>
              </div>
              <div class="metric-shell rounded-[1.35rem] p-4">
                <p class="text-xs uppercase tracking-[0.24em] text-muted">Heading</p>
                <p class="mt-3 font-display text-xl text-default">
                  {{
                    safeSnapshot?.headingMagnetic
                      ? `${Math.round(safeSnapshot.headingMagnetic)}°`
                      : 'Unavailable'
                  }}
                </p>
              </div>
              <div class="metric-shell rounded-[1.35rem] p-4">
                <p class="text-xs uppercase tracking-[0.24em] text-muted">Coordinates</p>
                <p class="mt-3 text-sm font-medium text-default">
                  {{ formatCoordinate(safeSnapshot?.positionLat, true) }}
                </p>
                <p class="mt-1 text-sm font-medium text-default">
                  {{ formatCoordinate(safeSnapshot?.positionLng, false) }}
                </p>
              </div>
            </div>
          </UCard>
        </div>
      </section>

      <MarineTrackMap
        :vessels="[detail.vessel]"
        :passages="detail.passages"
        :waypoints="detail.waypoints"
        height-class="h-[30rem]"
      />

      <section class="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <div class="space-y-6">
          <PassageTimeline :passages="detail.passages" />
          <MediaStrip :media="detail.media" />
        </div>

        <div class="space-y-6">
          <UCard class="chart-surface rounded-[1.75rem] shadow-card">
            <template #header>
              <div>
                <h2 class="font-display text-2xl text-default">Live summary</h2>
                <p class="mt-1 text-sm text-muted">
                  Core public navigation state chosen for this vessel surface.
                </p>
              </div>
            </template>

            <div class="grid gap-3 text-sm">
              <div class="rounded-2xl border border-default bg-elevated/70 px-4 py-4">
                <p class="text-xs uppercase tracking-wide text-muted">Freshness</p>
                <p class="mt-2 font-medium text-default">{{ detail.freshnessState }}</p>
              </div>
              <div class="rounded-2xl border border-default bg-elevated/70 px-4 py-4">
                <p class="text-xs uppercase tracking-wide text-muted">Latest passage</p>
                <p class="mt-2 font-medium text-default">
                  {{ detail.vessel.latestPassage?.title || 'No public passage yet' }}
                </p>
              </div>
              <div class="rounded-2xl border border-default bg-elevated/70 px-4 py-4">
                <p class="text-xs uppercase tracking-wide text-muted">Home port</p>
                <p class="mt-2 font-medium text-default">
                  {{ detail.vessel.homePort || detail.profile.homePort || 'Undisclosed' }}
                </p>
              </div>
            </div>
          </UCard>

          <UCard class="chart-surface rounded-[1.75rem] shadow-card">
            <template #header>
              <div>
                <h2 class="font-display text-2xl text-default">Public install posture</h2>
                <p class="mt-1 text-sm text-muted">
                  Only safe operational posture is shown on the public surface.
                </p>
              </div>
            </template>

            <div v-if="detail.installations.length" class="space-y-3">
              <div
                v-for="installation in detail.installations"
                :key="installation.id"
                class="rounded-2xl border border-default bg-elevated/70 px-4 py-4"
              >
                <div class="flex items-center justify-between gap-3">
                  <div>
                    <p class="font-medium text-default">{{ installation.label }}</p>
                    <p class="mt-1 text-xs text-muted">
                      {{ installation.lastSeenAt ? formatRelativeTime(installation.lastSeenAt) : 'No public telemetry yet' }}
                    </p>
                  </div>
                  <UBadge color="neutral" variant="soft">
                    {{ installation.connectionState }}
                  </UBadge>
                </div>
              </div>
            </div>

            <MarineEmptyState
              v-else
              icon="i-lucide-radio-tower"
              title="No public install posture"
              description="This vessel has a public page, but no installation status is currently exposed."
              compact
            />
          </UCard>

          <UCard class="chart-surface rounded-[1.75rem] shadow-card">
            <template #header>
              <div>
                <h2 class="font-display text-2xl text-default">Captain</h2>
                <p class="mt-1 text-sm text-muted">
                  Public captain context for this vessel.
                </p>
              </div>
            </template>

            <div class="space-y-3">
              <p class="font-medium text-default">{{ detail.profile.captainName }}</p>
              <p v-if="detail.profile.headline" class="text-sm text-muted">
                {{ detail.profile.headline }}
              </p>
              <div class="flex justify-end">
                <UButton
                  :to="`/${detail.profile.username}`"
                  color="primary"
                  variant="soft"
                  icon="i-lucide-user-round"
                >
                  Open captain page
                </UButton>
              </div>
            </div>
          </UCard>
        </div>
      </section>
    </template>

    <UAlert
      v-else-if="error"
      color="error"
      variant="soft"
      title="Public vessel unavailable"
      description="The requested vessel could not be found or is not currently shared."
    />
  </div>
</template>
