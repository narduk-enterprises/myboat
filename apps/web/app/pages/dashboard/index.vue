<script setup lang="ts">
import { formatRelativeTime, formatTimestamp } from '~/utils/marine'

definePageMeta({ middleware: ['auth'] })

useSeo({
  title: 'Dashboard',
  description: 'Monitor vessel identity, installations, telemetry readiness, and sharing surfaces.',
  robots: 'noindex, nofollow',
})

useWebPageSchema({
  name: 'MyBoat dashboard',
  description: 'Monitor vessel identity, installations, telemetry readiness, and sharing surfaces.',
})

const { data } = await useDashboardOverview()

const overview = computed(() => data.value)

watchEffect(() => {
  if (overview.value && !overview.value.profile) {
    void navigateTo('/dashboard/onboarding', { replace: true })
  }
})
</script>

<template>
  <div v-if="overview" class="space-y-8">
    <UPageHero
      :title="
        overview.profile
          ? `Welcome aboard, ${overview.profile.captainName}`
          : 'Set up your boat profile'
      "
      :description="
        overview.profile
          ? `Public handle @${overview.profile.username} · ${overview.vessels.length} vessel${overview.vessels.length === 1 ? '' : 's'} under management`
          : 'Finish the captain profile, vessel profile, and first install before inviting the public or issuing ingest keys.'
      "
    >
      <template #links>
        <UButton
          v-if="overview.profile"
          to="/dashboard/onboarding"
          color="neutral"
          variant="soft"
          icon="i-lucide-settings-2"
        >
          Edit profile
        </UButton>
        <UButton
          v-if="overview.profile"
          :to="`/${overview.profile.username}`"
          color="primary"
          variant="soft"
          icon="i-lucide-share-2"
        >
          View public profile
        </UButton>
      </template>
    </UPageHero>

    <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
      <MarineMetricCard
        label="Vessels"
        :value="String(overview.stats.vesselCount)"
        icon="i-lucide-ship"
      />
      <MarineMetricCard
        label="Installs"
        :value="String(overview.stats.installationCount)"
        icon="i-lucide-cpu"
      />
      <MarineMetricCard
        label="Live installs"
        :value="String(overview.stats.liveInstallationCount)"
        icon="i-lucide-radio"
      />
      <MarineMetricCard
        label="Passages"
        :value="String(overview.stats.passageCount)"
        icon="i-lucide-route"
      />
      <MarineMetricCard
        label="Media items"
        :value="String(overview.stats.mediaCount)"
        icon="i-lucide-camera"
      />
    </div>

    <section class="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
      <div class="space-y-6">
        <div class="grid gap-5 lg:grid-cols-2">
          <VesselSummaryCard
            v-for="vessel in overview.vessels"
            :key="vessel.id"
            :vessel="vessel"
            :to="`/dashboard/vessels/${vessel.slug}`"
          />
        </div>

        <MarineTrackMap
          :vessels="overview.vessels"
          :passages="overview.recentPassages"
          height-class="h-[28rem]"
        />

        <PassageTimeline :passages="overview.recentPassages" />
      </div>

      <div class="space-y-6">
        <UCard class="border-default/80 bg-default/90 shadow-card">
          <template #header>
            <div>
              <h3 class="font-display text-xl text-default">Install readiness</h3>
              <p class="mt-1 text-sm text-muted">
                Edge installs, SignalK streams, and ingest posture.
              </p>
            </div>
          </template>

          <div v-if="overview.installations.length" class="space-y-4">
            <div
              v-for="installation in overview.installations"
              :key="installation.id"
              class="rounded-2xl border border-default bg-elevated/60 px-4 py-4"
            >
              <div class="flex items-center justify-between gap-4">
                <div>
                  <p class="font-medium text-default">{{ installation.label }}</p>
                  <p class="mt-1 text-sm text-muted">
                    {{ installation.vesselName }} ·
                    {{ installation.edgeHostname || 'Hostname pending' }}
                  </p>
                </div>
                <UBadge
                  :color="installation.connectionState === 'live' ? 'success' : 'warning'"
                  variant="soft"
                >
                  {{ installation.connectionState }}
                </UBadge>
              </div>
              <p class="mt-2 text-xs text-muted">
                {{
                  installation.lastSeenAt
                    ? `Last seen ${formatRelativeTime(installation.lastSeenAt)}`
                    : 'No telemetry observed yet'
                }}
              </p>
              <div class="mt-3 flex justify-end">
                <UButton
                  :to="`/dashboard/installations/${installation.id}`"
                  color="neutral"
                  variant="soft"
                  icon="i-lucide-key-round"
                >
                  Manage install
                </UButton>
              </div>
            </div>
          </div>

          <AppEmptyState
            v-else
            icon="i-lucide-cpu"
            title="No installs defined"
            description="Create the first boat install in onboarding to start issuing ingest keys."
            compact
          >
            <UButton to="/dashboard/onboarding" color="primary" variant="soft">
              Complete onboarding
            </UButton>
          </AppEmptyState>
        </UCard>

        <UCard class="border-default/80 bg-default/90 shadow-card">
          <template #header>
            <div>
              <h3 class="font-display text-xl text-default">Recent public moments</h3>
              <p class="mt-1 text-sm text-muted">
                The media layer for public memory and passage storytelling.
              </p>
            </div>
          </template>

          <div v-if="overview.recentMedia.length" class="space-y-4">
            <article
              v-for="item in overview.recentMedia.slice(0, 3)"
              :key="item.id"
              class="rounded-2xl border border-default bg-elevated/60 px-4 py-4"
            >
              <p class="font-medium text-default">{{ item.title }}</p>
              <p v-if="item.caption" class="mt-2 text-sm text-muted">{{ item.caption }}</p>
              <p class="mt-2 text-xs text-muted">{{ formatTimestamp(item.capturedAt) }}</p>
            </article>
          </div>

          <AppEmptyState
            v-else
            icon="i-lucide-images"
            title="No media attached yet"
            description="The gallery is ready for geo-linked photos and notes from anchorages, crossings, and harbor entries."
            compact
          />
        </UCard>
      </div>
    </section>
  </div>
</template>
