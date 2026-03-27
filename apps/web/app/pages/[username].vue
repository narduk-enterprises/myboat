<script setup lang="ts">
import { formatRelativeTime } from '~/utils/marine'

const route = useRoute()
const username = computed(() => String(route.params.username || ''))

const { data, error } = await usePublicProfile(username.value)

const profile = computed(() => data.value ?? null)

useSeo({
  title: profile.value ? `@${profile.value.profile.username}` : 'Captain profile',
  description:
    'Public MyBoat profile surface with the captain handle, vessel summaries, and current marine status.',
})

useWebPageSchema({
  name: 'Captain profile',
  description:
    'Public MyBoat profile surface with the captain handle, vessel summaries, and current marine status.',
  type: 'CollectionPage',
})
</script>

<template>
  <div class="space-y-8">
    <template v-if="profile">
      <section class="public-hero px-6 py-10 shadow-overlay sm:px-10">
        <div class="relative z-10 grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
          <div class="space-y-4">
            <div class="marine-kicker w-fit">Public captain log</div>
            <div>
              <h1 class="font-display text-5xl text-default">@{{ profile.profile.username }}</h1>
              <p class="mt-3 max-w-2xl text-lg text-muted">
                {{
                  profile.profile.headline ||
                  'Public window into the vessel, passages, and current reporting posture.'
                }}
              </p>
            </div>
            <p v-if="profile.profile.bio" class="max-w-2xl text-sm text-muted">
              {{ profile.profile.bio }}
            </p>
          </div>

          <UCard class="chart-surface rounded-[1.75rem]">
            <div class="grid gap-3 sm:grid-cols-2">
              <div class="metric-shell rounded-[1.35rem] p-4">
                <p class="text-xs uppercase tracking-[0.24em] text-muted">Captain</p>
                <p class="mt-3 font-display text-xl text-default">
                  {{ profile.profile.captainName }}
                </p>
              </div>
              <div class="metric-shell rounded-[1.35rem] p-4">
                <p class="text-xs uppercase tracking-[0.24em] text-muted">Home port</p>
                <p class="mt-3 font-display text-xl text-default">
                  {{ profile.profile.homePort || 'Undisclosed' }}
                </p>
              </div>
              <div class="metric-shell rounded-[1.35rem] p-4">
                <p class="text-xs uppercase tracking-[0.24em] text-muted">Tracked vessels</p>
                <p class="mt-3 font-display text-xl text-default">{{ profile.vessels.length }}</p>
              </div>
              <div class="metric-shell rounded-[1.35rem] p-4">
                <p class="text-xs uppercase tracking-[0.24em] text-muted">Live installs</p>
                <p class="mt-3 font-display text-xl text-default">
                  {{
                    profile.installations.filter(
                      (installation) => installation.connectionState === 'live',
                    ).length
                  }}
                </p>
              </div>
            </div>
          </UCard>
        </div>
      </section>

      <MarineTrackMap
        :vessels="profile.vessels"
        :passages="profile.vessels.map((vessel) => vessel.latestPassage).filter(Boolean)"
        height-class="h-[28rem]"
      />

      <section class="grid gap-5 lg:grid-cols-2">
        <VesselSummaryCard v-for="vessel in profile.vessels" :key="vessel.id" :vessel="vessel" />
      </section>

      <UCard class="chart-surface rounded-[1.75rem] shadow-card">
        <template #header>
          <div>
            <h2 class="font-display text-2xl text-default">Live readiness</h2>
            <p class="mt-1 text-sm text-muted">
              Public view of install presence and current reporting posture.
            </p>
          </div>
        </template>

        <div v-if="profile.installations.length" class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <div
            v-for="installation in profile.installations"
            :key="installation.id"
            class="rounded-2xl border border-default bg-elevated/70 px-4 py-4"
          >
            <p class="font-medium text-default">{{ installation.label }}</p>
            <p class="mt-1 text-sm text-muted">{{ installation.vesselName }}</p>
            <p class="mt-3 text-xs text-muted">
              {{
                installation.lastSeenAt
                  ? `Last seen ${formatRelativeTime(installation.lastSeenAt)}`
                  : 'No public telemetry yet'
              }}
            </p>
          </div>
        </div>

        <MarineEmptyState
          v-else
          icon="i-lucide-radio-tower"
          title="No public install surface yet"
          description="This captain profile is live, but no installations are currently exposed for public status."
          compact
        />
      </UCard>
    </template>

    <UAlert
      v-else-if="error"
      color="error"
      variant="soft"
      title="Profile unavailable"
      description="The public profile could not be found or is not currently shared."
    />
  </div>
</template>
