<script setup lang="ts">
import type { PublicInstallationSummary } from '~/types/myboat'
import {
  formatCoordinate,
  formatRelativeTime,
  formatTimestamp,
  getConnectionTone,
} from '~/utils/marine'

const props = withDefaults(
  defineProps<{
    refreshing?: boolean
    lastRefreshCompletedAt?: string | null
    refreshIntervalMs?: number
  }>(),
  {
    refreshing: false,
    lastRefreshCompletedAt: null,
    refreshIntervalMs: 10_000,
  },
)

const emit = defineEmits<{
  refresh: []
}>()

const route = useRoute()
const username = computed(() => String(route.params.username || ''))
const vesselSlug = computed(() => String(route.params.vesselSlug || ''))
const store = useMyBoatVesselStore()
const trafficEnabled = ref(true)
const { convertSpeed, speedUnitLabel } = useMarineUnits()
const detail = computed(() => store.getPublicDetail(username.value, vesselSlug.value))
const entry = computed(() => store.getPublicEntry(username.value, vesselSlug.value))
const rawAisContacts = computed(() => store.serializeAisContacts(entry.value))
const trafficDetailBasePath = computed(() =>
  detail.value ? `/${detail.value.profile.username}/${detail.value.vessel.slug}/traffic` : null,
)
const { contacts: aisContacts } = usePublicEnrichedTrafficContacts(
  username,
  vesselSlug,
  rawAisContacts,
)
usePublicNearbyTrafficHydrator(
  username,
  vesselSlug,
  computed(() => entry.value?.key),
  trafficEnabled,
)
const liveState = computed(() => entry.value?.live ?? null)

const primaryInstallation = computed<PublicInstallationSummary | null>(
  () =>
    detail.value?.installations.find((installation) => installation.isPrimary) ||
    detail.value?.installations[0] ||
    null,
)
const liveSnapshot = computed(() => detail.value?.vessel.liveSnapshot ?? null)
const recentPassages = computed(() => detail.value?.passages.slice(0, 3) ?? [])
const recentPassageIds = computed(() => new Set(recentPassages.value.map((passage) => passage.id)))
const recentPassageMedia = computed(() =>
  (detail.value?.media ?? []).filter(
    (item) =>
      item.matchStatus === 'attached' &&
      Boolean(item.passageId) &&
      recentPassageIds.value.has(item.passageId!),
  ),
)
const mapMedia = computed(() =>
  (detail.value?.media ?? []).filter(
    (item) =>
      item.matchStatus === 'attached' &&
      Boolean(item.passageId) &&
      item.lat !== null &&
      item.lng !== null,
  ),
)
const generalMedia = computed(() =>
  (detail.value?.media ?? []).filter((item) => item.matchStatus === 'attached' && !item.passageId),
)
const latestPassage = computed(
  () => detail.value?.vessel.latestPassage || detail.value?.passages[0] || null,
)
const publicPath = computed(() =>
  detail.value ? `/${detail.value.profile.username}/${detail.value.vessel.slug}` : null,
)
const publicLiveFeedAvailable = computed(() => Boolean(liveState.value?.hasSignalKSource))
useMyBoatLiveDemand({
  namespace: 'public',
  consumerId: 'public-vessel-live',
  demand: computed(() => ({
    selfLevel: 'detail',
    ais: trafficEnabled.value,
  })),
})

const liveFeedLabel = computed(() => {
  if (!publicLiveFeedAvailable.value) {
    return 'Public API refresh'
  }

  return 'MyBoat live feed'
})

const liveFeedStatus = computed(() => {
  switch (liveState.value?.connectionState) {
    case 'connected':
      return liveState.value?.lastDeltaAt
        ? `MyBoat live feed connected · delta ${formatRelativeTime(new Date(liveState.value.lastDeltaAt).toISOString())}`
        : 'MyBoat live feed connected.'
    case 'connecting':
      return 'Connecting to the public live feed.'
    case 'error':
      return 'Public live feed unavailable. Showing the freshest stored vessel snapshot.'
    default:
      return publicLiveFeedAvailable.value
        ? 'Public live feed standing by.'
        : `Refreshing the public vessel API every ${Math.round(props.refreshIntervalMs / 1000)}s.`
  }
})

const liveSourceBadgeTone = computed(() =>
  getConnectionTone(
    primaryInstallation.value?.connectionState || 'idle',
    primaryInstallation.value?.lastSeenAt,
  ),
)
const liveSourceBadgeLabel = computed(
  () => primaryInstallation.value?.connectionState || 'refreshing',
)
const publicRefreshStatus = computed(() =>
  props.lastRefreshCompletedAt
    ? `Public API refreshed ${formatRelativeTime(props.lastRefreshCompletedAt)}`
    : `Public API cadence ${Math.round(props.refreshIntervalMs / 1000)}s`,
)

const heroMetrics = computed(() => [
  {
    label: 'Observed',
    value: formatRelativeTime(liveSnapshot.value?.observedAt),
    hint: formatTimestamp(liveSnapshot.value?.observedAt),
    icon: 'i-lucide-clock-3',
  },
  {
    label: 'Speed over ground',
    value: toRoundedText(convertSpeed(liveSnapshot.value?.speedOverGround)),
    unit: speedUnitLabel.value,
    hint: 'Freshest movement over ground.',
    icon: 'i-lucide-gauge',
  },
  {
    label: 'Apparent wind',
    value: toRoundedText(convertSpeed(liveSnapshot.value?.windSpeedApparent)),
    unit: speedUnitLabel.value,
    hint: 'From the current public telemetry feed.',
    icon: 'i-lucide-wind',
  },
  {
    label: 'Depth below transducer',
    value: toRoundedText(liveSnapshot.value?.depthBelowTransducer),
    unit: 'm',
    hint: 'Latest stored or live depth reading.',
    icon: 'i-lucide-waves',
  },
])

const opsMetrics = computed(() => [
  {
    label: 'Passages logged',
    value: String(detail.value?.passages.length ?? 0),
    hint: latestPassage.value?.title || 'No public passage yet.',
    icon: 'i-lucide-route',
  },
  {
    label: 'Waypoints saved',
    value: String(detail.value?.waypoints.length ?? 0),
    hint: detail.value?.waypoints.length
      ? 'Saved route markers remain visible.'
      : 'No route markers yet.',
    icon: 'i-lucide-map-pinned',
  },
  {
    label: 'Media log',
    value: String(detail.value?.media.length ?? 0),
    hint: detail.value?.media.length
      ? 'Recent captured moments are attached below.'
      : 'No public media yet.',
    icon: 'i-lucide-camera',
  },
  {
    label: 'Install events',
    value: String(primaryInstallation.value?.eventCount || 0),
    hint: primaryInstallation.value?.label || 'No public installation exposed.',
    icon: 'i-lucide-waypoints',
  },
])

function toRoundedText(value: number | null | undefined, digits = 1) {
  if (value === null || value === undefined) {
    return '--'
  }

  return value.toFixed(digits)
}
</script>

<template>
  <div v-if="detail" class="space-y-8">
    <section class="public-hero px-6 py-10 shadow-overlay sm:px-10">
      <div class="relative z-10 grid gap-8 lg:grid-cols-[1.04fr_0.96fr]">
        <div class="space-y-5">
          <div class="marine-kicker w-fit">Public vessel live dashboard</div>

          <div>
            <h1 class="font-display text-5xl text-default sm:text-6xl">
              {{ detail.vessel.name }}
            </h1>
            <p class="mt-3 max-w-2xl text-lg text-muted">
              {{
                detail.vessel.summary ||
                'Live vessel telemetry, route memory, and public-facing installation posture in one chart-ready surface.'
              }}
            </p>
          </div>

          <div class="flex flex-wrap gap-3 text-sm text-muted">
            <span class="rounded-full border border-default/60 px-4 py-2">
              @{{ detail.profile.username }}
            </span>
            <span
              v-if="detail.vessel.homePort || detail.profile.homePort"
              class="rounded-full border border-default/60 px-4 py-2"
            >
              {{ detail.vessel.homePort || detail.profile.homePort }}
            </span>
            <span class="rounded-full border border-default/60 px-4 py-2">
              {{ detail.freshnessState }}
            </span>
            <span class="rounded-full border border-default/60 px-4 py-2">
              {{ liveFeedLabel }}
            </span>
          </div>

          <div class="flex flex-wrap gap-3">
            <UButton
              color="primary"
              icon="i-lucide-refresh-cw"
              :loading="refreshing"
              @click="emit('refresh')"
            >
              Refresh live data
            </UButton>
            <UButton
              :to="`/${detail.profile.username}`"
              color="neutral"
              variant="soft"
              icon="i-lucide-user-round"
            >
              Open captain page
            </UButton>
          </div>

          <div
            class="rounded-[1.75rem] border border-white/70 bg-white/86 px-5 py-5 shadow-card backdrop-blur"
          >
            <div class="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p class="text-xs uppercase tracking-[0.24em] text-muted">Live source</p>
                <p class="mt-2 font-display text-2xl text-default">{{ liveFeedLabel }}</p>
              </div>
              <UBadge :color="liveSourceBadgeTone" variant="soft">
                {{ liveSourceBadgeLabel }}
              </UBadge>
            </div>
            <p class="mt-3 text-sm text-muted">{{ liveFeedStatus }}</p>
            <p class="mt-2 text-xs text-muted">{{ publicRefreshStatus }}</p>
          </div>
        </div>

        <div class="grid gap-4 sm:grid-cols-2">
          <MarineMetricCard
            v-for="metric in heroMetrics"
            :key="metric.label"
            :label="metric.label"
            :value="metric.value"
            :unit="metric.unit"
            :hint="metric.hint"
            :icon="metric.icon"
          />
        </div>
      </div>
    </section>

    <div data-testid="public-vessel-live-map">
      <MyBoatDetailedMap
        :vessel="detail.vessel"
        :passages="detail.passages"
        :waypoints="detail.waypoints"
        :media="mapMedia"
        :installations="detail.installations"
        :ais-contacts="aisContacts"
        :live-connection-state="liveState?.connectionState"
        :live-last-delta-at="liveState?.lastDeltaAt"
        :has-signal-k-source="liveState?.hasSignalKSource"
        tools-profile="viewer"
        :traffic-detail-base-path="trafficDetailBasePath"
        v-model:traffic-enabled="trafficEnabled"
        height-class="h-[22rem] sm:h-[28rem] lg:h-[32rem]"
        :persist-key="`public-vessel:${detail.profile.username}/${detail.vessel.slug}`"
        :show-pin-labels="false"
      />
    </div>

    <section class="grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
      <div class="space-y-6">
        <UCard class="chart-surface rounded-[1.75rem] shadow-card">
          <template #header>
            <div>
              <h2 class="font-display text-2xl text-default">Live data board</h2>
              <p class="mt-1 text-sm text-muted">
                Public-ready live telemetry with latitude, longitude, SOG, STW, apparent wind,
                heading, depth, water temperature, power, and engine state.
              </p>
            </div>
          </template>

          <MarineSnapshotGrid :snapshot="liveSnapshot" />
        </UCard>

        <UCard class="chart-surface rounded-[1.75rem] shadow-card">
          <template #header>
            <div class="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <h2 class="font-display text-2xl text-default">Route memory</h2>
                <p class="mt-1 text-sm text-muted">
                  Recent public passages stay close to the live chart so followers can connect
                  present conditions with the boat&apos;s recent movement.
                </p>
              </div>
              <div class="flex flex-wrap items-center gap-3">
                <span
                  class="rounded-full border border-default/70 px-3 py-1 text-xs uppercase tracking-[0.18em] text-muted"
                >
                  {{ detail.passages.length }} passages
                </span>
                <UButton
                  :to="`/${detail.profile.username}/${detail.vessel.slug}/passages`"
                  color="neutral"
                  variant="soft"
                  icon="i-lucide-arrow-right"
                >
                  Open all passages
                </UButton>
              </div>
            </div>
          </template>

          <PassageTimeline :passages="recentPassages" :media="recentPassageMedia" />
        </UCard>

        <MediaStrip v-if="generalMedia.length" :media="generalMedia" />
      </div>

      <div class="space-y-6">
        <UCard class="chart-surface rounded-[1.75rem] shadow-card">
          <template #header>
            <div>
              <h2 class="font-display text-2xl text-default">Bridge watch</h2>
              <p class="mt-1 text-sm text-muted">
                Quick read on coordinates, feed state, and the latest public route context from the
                Narduk-side live feed.
              </p>
            </div>
          </template>

          <div class="grid gap-3 text-sm">
            <div class="rounded-2xl border border-default bg-elevated/70 px-4 py-4">
              <p class="text-xs uppercase tracking-wide text-muted">Coordinates</p>
              <p class="mt-2 font-medium text-default">
                {{ formatCoordinate(liveSnapshot?.positionLat, true) }}
              </p>
              <p class="mt-1 font-medium text-default">
                {{ formatCoordinate(liveSnapshot?.positionLng, false) }}
              </p>
            </div>

            <div class="rounded-2xl border border-default bg-elevated/70 px-4 py-4">
              <p class="text-xs uppercase tracking-wide text-muted">Public route</p>
              <p class="mt-2 font-medium text-default">{{ publicPath }}</p>
              <p class="mt-1 text-xs text-muted">
                {{
                  primaryInstallation?.label || 'Public live view with stored telemetry refresh.'
                }}
              </p>
            </div>

            <div class="rounded-2xl border border-default bg-elevated/70 px-4 py-4">
              <p class="text-xs uppercase tracking-wide text-muted">Status note</p>
              <p class="mt-2 font-medium text-default">
                {{
                  liveSnapshot?.statusNote ||
                  'No captain note published with the current live snapshot.'
                }}
              </p>
            </div>

            <div class="rounded-2xl border border-default bg-elevated/70 px-4 py-4">
              <p class="text-xs uppercase tracking-wide text-muted">Latest passage</p>
              <p class="mt-2 font-medium text-default">
                {{ latestPassage?.title || 'No public passage yet' }}
              </p>
              <p class="mt-1 text-xs text-muted">
                {{
                  latestPassage
                    ? `${formatTimestamp(latestPassage.startedAt)} · ${latestPassage.distanceNm ? `${latestPassage.distanceNm.toFixed(1)} nm` : 'distance pending'}`
                    : 'This vessel does not have a public passage record yet.'
                }}
              </p>
            </div>
          </div>
        </UCard>

        <div class="grid gap-4 md:grid-cols-2">
          <MarineMetricCard
            v-for="metric in opsMetrics"
            :key="metric.label"
            :label="metric.label"
            :value="metric.value"
            :hint="metric.hint"
            :icon="metric.icon"
          />
        </div>

        <UCard class="chart-surface rounded-[1.75rem] shadow-card">
          <template #header>
            <div>
              <h2 class="font-display text-2xl text-default">Install posture</h2>
              <p class="mt-1 text-sm text-muted">
                Public-safe view of the vessel&apos;s telemetry source, freshness, and event volume.
              </p>
            </div>
          </template>

          <div v-if="detail.installations.length" class="space-y-3">
            <div
              v-for="installation in detail.installations"
              :key="installation.id"
              class="rounded-2xl border border-default bg-elevated/70 px-4 py-4"
            >
              <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div class="flex flex-wrap items-center gap-2">
                    <p class="font-medium text-default">{{ installation.label }}</p>
                    <UBadge v-if="installation.isPrimary" color="primary" variant="soft">
                      Primary
                    </UBadge>
                    <UBadge
                      :color="
                        getConnectionTone(installation.connectionState, installation.lastSeenAt)
                      "
                      variant="soft"
                    >
                      {{ installation.connectionState }}
                    </UBadge>
                  </div>
                  <p class="mt-2 text-sm text-muted">
                    {{
                      installation.lastSeenAt
                        ? `Last seen ${formatRelativeTime(installation.lastSeenAt)}`
                        : 'No public telemetry observed yet'
                    }}
                  </p>
                </div>

                <div class="text-right">
                  <p class="font-display text-2xl text-default">{{ installation.eventCount }}</p>
                  <p class="mt-1 text-xs text-muted">events observed</p>
                </div>
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
      </div>
    </section>
  </div>
</template>
