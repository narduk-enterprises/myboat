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
      <section
        class="rounded-[2rem] border border-default bg-default/90 px-6 py-10 shadow-card sm:px-10"
      >
        <div class="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
          <div class="space-y-4">
            <p class="text-sm uppercase tracking-[0.3em] text-primary">Captain profile</p>
            <div>
              <h1 class="font-display text-5xl text-default">@{{ profile.profile.username }}</h1>
              <p class="mt-3 text-lg text-muted">
                {{
                  profile.profile.headline ||
                  'Public window into the vessel, passages, and live status.'
                }}
              </p>
            </div>
            <p v-if="profile.profile.bio" class="max-w-2xl text-sm text-muted">
              {{ profile.profile.bio }}
            </p>
          </div>

          <UCard class="border-default/80 bg-elevated/70 shadow-card">
            <div class="space-y-3">
              <div class="flex items-center justify-between">
                <p class="text-sm text-muted">Captain</p>
                <p class="font-medium text-default">{{ profile.profile.captainName }}</p>
              </div>
              <div class="flex items-center justify-between">
                <p class="text-sm text-muted">Home port</p>
                <p class="font-medium text-default">
                  {{ profile.profile.homePort || 'Undisclosed' }}
                </p>
              </div>
              <div class="flex items-center justify-between">
                <p class="text-sm text-muted">Tracked vessels</p>
                <p class="font-medium text-default">{{ profile.vessels.length }}</p>
              </div>
              <div class="flex items-center justify-between">
                <p class="text-sm text-muted">Live installs</p>
                <p class="font-medium text-default">
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

      <UCard class="border-default/80 bg-default/90 shadow-card">
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
            class="rounded-2xl border border-default bg-elevated/60 px-4 py-4"
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

        <AppEmptyState
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
