<script setup lang="ts">
import { formatCoordinate, formatRelativeTime, formatTimestamp } from '~/utils/marine'

definePageMeta({ layout: 'dashboard', middleware: ['auth'] })

const route = useRoute()
const vesselSlug = computed(() => String(route.params.vesselSlug || ''))

const { data, pending } = await useVesselDetail(vesselSlug.value)

const detail = computed(() => data.value)
const vesselTabs = [
  { label: 'Overview', value: 'overview', icon: 'i-lucide-layout-dashboard', slot: 'overview' },
  { label: 'Telemetry', value: 'telemetry', icon: 'i-lucide-gauge', slot: 'telemetry' },
  { label: 'Passages', value: 'passages', icon: 'i-lucide-route', slot: 'passages' },
  { label: 'Media', value: 'media', icon: 'i-lucide-images', slot: 'media' },
  { label: 'Installs', value: 'installs', icon: 'i-lucide-cpu', slot: 'installs' },
]

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
  <div class="space-y-8">
    <template v-if="pending">
      <USkeleton class="h-44 rounded-[2rem]" />
      <USkeleton class="h-12 rounded-[1.25rem]" />
      <div class="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <USkeleton class="h-[44rem] rounded-[1.75rem]" />
        <USkeleton class="h-[44rem] rounded-[1.75rem]" />
      </div>
    </template>

    <template v-else-if="detail">
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
            :to="`/${detail.profile.username}/${detail.vessel.slug}`"
            color="neutral"
            variant="soft"
            icon="i-lucide-share-2"
          >
            Public vessel page
          </UButton>
        </template>
      </UPageHero>

      <AppTabs
        :items="vesselTabs"
        persist-key="myboat-vessel-detail"
        query-key="tab"
        color="neutral"
        variant="link"
        class="space-y-6"
      >
        <template #overview>
          <div class="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
            <div class="space-y-6">
              <div data-testid="vessel-detail-map">
                <MarineTrackMap
                  :vessels="[detail.vessel]"
                  :passages="detail.passages"
                  :waypoints="detail.waypoints"
                  height-class="h-[30rem]"
                />
              </div>

              <div
                data-testid="vessel-detail-snapshot-grid"
                class="grid gap-4 md:grid-cols-2 xl:grid-cols-4"
              >
                <MarineMetricCard
                  label="Observed"
                  :value="formatRelativeTime(detail.vessel.liveSnapshot?.observedAt)"
                  icon="i-lucide-radio"
                />
                <MarineMetricCard
                  label="Speed over ground"
                  :value="
                    detail.vessel.liveSnapshot?.speedOverGround
                      ? detail.vessel.liveSnapshot.speedOverGround.toFixed(1)
                      : '--'
                  "
                  unit="kts"
                  icon="i-lucide-gauge"
                />
                <MarineMetricCard
                  label="Apparent wind"
                  :value="
                    detail.vessel.liveSnapshot?.windSpeedApparent
                      ? detail.vessel.liveSnapshot.windSpeedApparent.toFixed(1)
                      : '--'
                  "
                  unit="kts"
                  icon="i-lucide-wind"
                />
                <MarineMetricCard
                  label="Depth"
                  :value="
                    detail.vessel.liveSnapshot?.depthBelowTransducer
                      ? detail.vessel.liveSnapshot.depthBelowTransducer.toFixed(1)
                      : '--'
                  "
                  unit="m"
                  icon="i-lucide-waves"
                />
              </div>

              <div data-testid="vessel-detail-passage-timeline">
                <PassageTimeline :passages="detail.passages.slice(0, 3)" />
              </div>
            </div>

            <div class="space-y-6">
              <UCard class="border-default/80 bg-default/90 shadow-card">
                <template #header>
                  <div>
                    <h3 class="font-display text-xl text-default">Live position</h3>
                    <p class="mt-1 text-sm text-muted">
                      Last reported fix, operating status, and public vessel link.
                    </p>
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

                  <div class="rounded-2xl border border-default bg-elevated/60 px-4 py-4">
                    <p class="text-xs uppercase tracking-wide text-muted">Public route</p>
                    <p class="mt-2 font-medium text-default">
                      /{{ detail.profile.username }}/{{ detail.vessel.slug }}
                    </p>
                  </div>
                </div>
              </UCard>

              <UCard
                data-testid="vessel-detail-install-links"
                class="border-default/80 bg-default/90 shadow-card"
              >
                <template #header>
                  <div>
                    <h3 class="font-display text-xl text-default">Install posture</h3>
                    <p class="mt-1 text-sm text-muted">
                      Primary and secondary ingest paths currently mapped to this vessel.
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
                        <div class="flex items-center gap-2">
                          <p class="font-medium text-default">{{ installation.label }}</p>
                          <UBadge v-if="installation.isPrimary" color="primary" variant="soft">
                            Primary
                          </UBadge>
                        </div>
                        <p class="mt-1 text-xs text-muted">
                          {{
                            installation.edgeHostname ||
                            installation.signalKUrl ||
                            'Connector details pending'
                          }}
                        </p>
                      </div>

                      <UBadge color="neutral" variant="subtle">
                        {{ installation.connectionState }}
                      </UBadge>
                    </div>
                  </div>
                </div>

                <MarineEmptyState
                  v-else
                  icon="i-lucide-cpu"
                  title="No installs linked yet"
                  description="Create or finish onboarding to attach a live device install to this vessel."
                  compact
                />
              </UCard>
            </div>
          </div>
        </template>

        <template #telemetry>
          <div class="space-y-6">
            <MarineSnapshotGrid :snapshot="detail.vessel.liveSnapshot" />

            <div class="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
              <UCard class="border-default/80 bg-default/90 shadow-card">
                <template #header>
                  <div>
                    <h3 class="font-display text-xl text-default">Telemetry source</h3>
                    <p class="mt-1 text-sm text-muted">
                      Current live-source posture and the freshest observed data.
                    </p>
                  </div>
                </template>

                <div class="space-y-3 text-sm">
                  <div class="rounded-2xl border border-default bg-elevated/60 px-4 py-4">
                    <p class="text-xs uppercase tracking-wide text-muted">Source</p>
                    <p class="mt-2 font-medium text-default">
                      {{
                        detail.vessel.liveSnapshot?.statusNote ||
                        detail.vessel.liveSnapshot?.observedAt
                          ? 'Primary vessel stream'
                          : 'Awaiting telemetry'
                      }}
                    </p>
                  </div>
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
                    <p class="text-xs uppercase tracking-wide text-muted">Position</p>
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
                    <h3 class="font-display text-xl text-default">Telemetry explorer</h3>
                    <p class="mt-1 text-sm text-muted">
                      Current vessel metrics, route-backed history, and the operational context
                      around the latest snapshot.
                    </p>
                  </div>
                </template>

                <div class="grid gap-3 md:grid-cols-2">
                  <div class="rounded-2xl border border-default bg-elevated/60 px-4 py-4">
                    <p class="text-xs uppercase tracking-wide text-muted">Latest passage</p>
                    <p class="mt-2 font-medium text-default">
                      {{ detail.vessel.latestPassage?.title || 'No passage yet' }}
                    </p>
                    <p class="mt-1 text-xs text-muted">
                      {{
                        detail.vessel.latestPassage?.startedAt
                          ? formatTimestamp(detail.vessel.latestPassage.startedAt)
                          : 'Telemetry-backed route history will appear here once a passage is logged.'
                      }}
                    </p>
                  </div>
                  <div class="rounded-2xl border border-default bg-elevated/60 px-4 py-4">
                    <p class="text-xs uppercase tracking-wide text-muted">Track memory</p>
                    <p class="mt-2 font-medium text-default">
                      {{
                        detail.passages.length
                          ? `${detail.passages.length} recorded passage${detail.passages.length === 1 ? '' : 's'}`
                          : 'No track history yet'
                      }}
                    </p>
                    <p class="mt-1 text-xs text-muted">
                      Use the passages tab for the narrative view and this telemetry tab for live
                      state.
                    </p>
                  </div>
                  <div class="rounded-2xl border border-default bg-elevated/60 px-4 py-4">
                    <p class="text-xs uppercase tracking-wide text-muted">Media-linked moments</p>
                    <p class="mt-2 font-medium text-default">{{ detail.media.length }} attached</p>
                    <p class="mt-1 text-xs text-muted">
                      Visual observations stay connected to the telemetry timeline.
                    </p>
                  </div>
                  <div class="rounded-2xl border border-default bg-elevated/60 px-4 py-4">
                    <p class="text-xs uppercase tracking-wide text-muted">Waypoints</p>
                    <p class="mt-2 font-medium text-default">{{ detail.waypoints.length }}</p>
                    <p class="mt-1 text-xs text-muted">
                      Anchorages, arrivals, and notable places linked to this vessel.
                    </p>
                  </div>
                </div>
              </UCard>
            </div>
          </div>
        </template>

        <template #passages>
          <PassageTimeline :passages="detail.passages" />
        </template>

        <template #media>
          <MediaStrip :media="detail.media" />
        </template>

        <template #installs>
          <UCard class="border-default/80 bg-default/90 shadow-card">
            <template #header>
              <div>
                <h3 class="font-display text-xl text-default">Installations</h3>
                <p class="mt-1 text-sm text-muted">
                  Manage primary and secondary ingest paths for this vessel.
                </p>
              </div>
            </template>

            <div v-if="detail.installations.length" class="space-y-3">
              <div
                v-for="installation in detail.installations"
                :key="installation.id"
                class="rounded-2xl border border-default bg-elevated/60 px-4 py-4"
              >
                <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div class="flex flex-wrap items-center gap-2">
                      <p class="font-medium text-default">{{ installation.label }}</p>
                      <UBadge v-if="installation.isPrimary" color="primary" variant="soft">
                        Primary
                      </UBadge>
                      <UBadge color="neutral" variant="subtle">
                        {{ installation.installationType }}
                      </UBadge>
                      <UBadge color="neutral" variant="subtle">
                        {{ installation.connectionState }}
                      </UBadge>
                    </div>
                    <p class="mt-2 text-sm text-muted">
                      {{
                        installation.edgeHostname ||
                        installation.signalKUrl ||
                        'Install details pending'
                      }}
                    </p>
                    <p class="mt-1 text-xs text-muted">
                      {{
                        installation.lastSeenAt
                          ? `Last seen ${formatRelativeTime(installation.lastSeenAt)}`
                          : 'No telemetry observed yet'
                      }}
                    </p>
                  </div>

                  <UButton
                    :to="`/dashboard/installations/${installation.id}`"
                    color="primary"
                    variant="soft"
                    icon="i-lucide-arrow-right"
                  >
                    Manage install
                  </UButton>
                </div>
              </div>
            </div>

            <MarineEmptyState
              v-else
              icon="i-lucide-cpu"
              title="No installs linked yet"
              description="Create or finish onboarding to attach a live device install to this vessel."
              compact
            />
          </UCard>
        </template>
      </AppTabs>
    </template>

    <UAlert
      v-else
      color="error"
      variant="soft"
      title="Vessel unavailable"
      description="We could not load this vessel surface right now."
    />
  </div>
</template>
