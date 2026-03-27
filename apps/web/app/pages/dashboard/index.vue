<script setup lang="ts">
import { formatRelativeTime, formatTimestamp } from '~/utils/marine'

definePageMeta({ layout: 'dashboard', middleware: ['auth'] })

useSeo({
  title: 'Dashboard',
  description: 'Monitor vessel identity, installations, telemetry readiness, and sharing surfaces.',
  robots: 'noindex, nofollow',
})

useWebPageSchema({
  name: 'MyBoat dashboard',
  description: 'Monitor vessel identity, installations, telemetry readiness, and sharing surfaces.',
})

const { data, pending } = await useDashboardOverview()

const overview = computed(() => data.value)

watchEffect(() => {
  if (overview.value && !overview.value.profile) {
    void navigateTo('/dashboard/onboarding', { replace: true })
  }
})
</script>

<template>
  <div class="space-y-8">
    <template v-if="pending">
      <section class="chart-surface-strong rounded-[2rem] px-6 py-8 sm:px-8">
        <div class="grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
          <div class="space-y-4">
            <USkeleton class="h-7 w-28 rounded-full" />
            <USkeleton class="h-14 w-full max-w-3xl rounded-[1.5rem]" />
            <USkeleton class="h-6 w-full max-w-2xl rounded-full" />
            <div class="flex gap-3">
              <USkeleton class="h-11 w-40 rounded-full" />
              <USkeleton class="h-11 w-40 rounded-full" />
            </div>
          </div>

          <div class="grid gap-3 sm:grid-cols-2">
            <USkeleton v-for="item in 4" :key="item" class="h-36 rounded-[1.5rem]" />
          </div>
        </div>
      </section>

      <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <USkeleton v-for="item in 5" :key="item" class="h-32 rounded-[1.5rem]" />
      </div>

      <div class="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <USkeleton class="h-[42rem] rounded-[1.75rem]" />
        <div class="space-y-6">
          <USkeleton class="h-80 rounded-[1.75rem]" />
          <USkeleton class="h-72 rounded-[1.75rem]" />
        </div>
      </div>
    </template>

    <template v-else-if="overview">
      <section
        data-testid="dashboard-hero"
        class="chart-surface-strong rounded-[2rem] px-6 py-8 sm:px-8"
      >
        <div class="relative z-10 grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
          <div class="space-y-5">
            <div class="marine-kicker w-fit">Owner dashboard</div>
            <div>
              <h1 class="font-display text-4xl tracking-tight text-default sm:text-5xl">
                {{
                  overview.profile
                    ? `Welcome aboard, ${overview.profile.captainName}`
                    : 'Set up your boat profile'
                }}
              </h1>
              <p class="mt-3 max-w-2xl text-base text-muted sm:text-lg">
                {{
                  overview.profile
                    ? `Public handle @${overview.profile.username} · ${overview.vessels.length} vessel${overview.vessels.length === 1 ? '' : 's'} under management`
                    : 'Finish the captain profile, vessel profile, and first install before inviting the public or issuing ingest keys.'
                }}
              </p>
            </div>

            <div class="flex flex-wrap gap-3">
              <UButton
                v-if="overview.profile"
                to="/dashboard/onboarding"
                color="neutral"
                variant="soft"
                icon="i-lucide-settings-2"
              >
                Edit boat setup
              </UButton>
              <UButton
                v-if="overview.profile"
                :to="`/${overview.profile.username}`"
                color="primary"
                icon="i-lucide-share-2"
              >
                View public profile
              </UButton>
            </div>
          </div>

          <div class="grid gap-3 sm:grid-cols-2">
            <div class="metric-shell rounded-[1.5rem] p-4 shadow-card">
              <p class="text-xs uppercase tracking-[0.24em] text-muted">Public sharing</p>
              <p class="mt-3 font-display text-2xl text-default">
                {{ overview.profile ? 'Ready' : 'Pending' }}
              </p>
              <p class="mt-2 text-xs text-muted">
                The captain route and public vessel surfaces follow the owner profile.
              </p>
            </div>
            <div class="metric-shell rounded-[1.5rem] p-4 shadow-card">
              <p class="text-xs uppercase tracking-[0.24em] text-muted">Live installs</p>
              <p class="mt-3 font-display text-2xl text-default">
                {{ overview.stats.liveInstallationCount }}
              </p>
              <p class="mt-2 text-xs text-muted">
                Installs currently reporting data through the ingest edge.
              </p>
            </div>
            <div class="metric-shell rounded-[1.5rem] p-4 shadow-card">
              <p class="text-xs uppercase tracking-[0.24em] text-muted">Primary vessel</p>
              <p class="mt-3 font-display text-2xl text-default">
                {{ overview.vessels[0]?.name || 'Pending' }}
              </p>
              <p class="mt-2 text-xs text-muted">
                The primary boat anchors the live map, passages, and public story.
              </p>
            </div>
            <div class="metric-shell rounded-[1.5rem] p-4 shadow-card">
              <p class="text-xs uppercase tracking-[0.24em] text-muted">Recent passages</p>
              <p class="mt-3 font-display text-2xl text-default">
                {{ overview.recentPassages.length }}
              </p>
              <p class="mt-2 text-xs text-muted">
                Route memory stays connected to current telemetry and vessel history.
              </p>
            </div>
          </div>
        </div>
      </section>

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
          <div data-testid="dashboard-vessel-grid" class="grid gap-5 lg:grid-cols-2">
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
          <UCard data-testid="dashboard-install-readiness" class="chart-surface rounded-[1.75rem]">
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
                class="rounded-2xl border border-default bg-elevated/70 px-4 py-4"
              >
                <div class="flex items-center justify-between gap-4">
                  <div>
                    <p class="font-medium text-default">{{ installation.label }}</p>
                    <p class="mt-1 text-sm text-muted">
                      {{ installation.vesselName }} ·
                      {{
                        installation.edgeHostname ||
                        installation.signalKUrl ||
                        'Connection target pending'
                      }}
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

            <MarineEmptyState
              v-else
              icon="i-lucide-cpu"
              title="No installs defined"
              description="Create the first boat install in onboarding to start issuing ingest keys."
              compact
            >
              <UButton to="/dashboard/onboarding" color="primary">Complete onboarding</UButton>
            </MarineEmptyState>
          </UCard>

          <UCard data-testid="dashboard-recent-moments" class="chart-surface rounded-[1.75rem]">
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
                class="rounded-2xl border border-default bg-elevated/70 px-4 py-4"
              >
                <p class="font-medium text-default">{{ item.title }}</p>
                <p v-if="item.caption" class="mt-2 text-sm text-muted">{{ item.caption }}</p>
                <p class="mt-2 text-xs text-muted">{{ formatTimestamp(item.capturedAt) }}</p>
              </article>
            </div>

            <MarineEmptyState
              v-else
              icon="i-lucide-images"
              title="No media attached yet"
              description="The gallery is ready for geo-linked photos and notes from anchorages, crossings, and harbor entries."
              compact
            />
          </UCard>
        </div>
      </section>
    </template>

    <UAlert
      v-else
      color="error"
      variant="soft"
      title="Dashboard unavailable"
      description="We could not load the owner dashboard right now."
    />
  </div>
</template>
