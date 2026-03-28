<script setup lang="ts">
import type {
  PublicInstallationSummary,
  PublicVesselDetailResponse,
  VesselSnapshotSummary,
} from '~/types/myboat'
import {
  formatCoordinate,
  formatRelativeTime,
  formatTimestamp,
  getConnectionTone,
} from '~/utils/marine'

const SELF_OVERLAY_MAX_DISTANCE_NM = 30

const props = withDefaults(
  defineProps<{
    detail: PublicVesselDetailResponse
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

const { convertSpeed, speedUnitLabel } = useMarineUnits()
const isClientMounted = shallowRef(false)

onMounted(() => {
  isClientMounted.value = true
})

function toRoundedText(value: number | null | undefined, digits = 1) {
  if (value === null || value === undefined) {
    return '--'
  }

  return value.toFixed(digits)
}

function haversineNm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const earthRadiusMeters = 6_371_000
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const lat1Rad = (lat1 * Math.PI) / 180
  const lat2Rad = (lat2 * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1Rad) * Math.cos(lat2Rad) * Math.sin(dLng / 2) * Math.sin(dLng / 2)

  const meters = 2 * earthRadiusMeters * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return meters / 1852
}

function canUseSelfOverlay(
  fallback: VesselSnapshotSummary | null,
  live: VesselSnapshotSummary | null,
) {
  if (!fallback || !live) {
    return false
  }

  if (
    fallback.positionLat === null ||
    fallback.positionLat === undefined ||
    fallback.positionLng === null ||
    fallback.positionLng === undefined ||
    live.positionLat === null ||
    live.positionLat === undefined ||
    live.positionLng === null ||
    live.positionLng === undefined
  ) {
    return false
  }

  return (
    haversineNm(fallback.positionLat, fallback.positionLng, live.positionLat, live.positionLng) <=
    SELF_OVERLAY_MAX_DISTANCE_NM
  )
}

function mergeSnapshots(
  fallback: VesselSnapshotSummary | null,
  live: VesselSnapshotSummary | null,
): VesselSnapshotSummary | null {
  if (!fallback && !live) {
    return null
  }

  return {
    vesselId: live?.vesselId || fallback?.vesselId,
    source: live?.source || fallback?.source || null,
    observedAt: live?.observedAt || fallback?.observedAt || null,
    positionLat: live?.positionLat ?? fallback?.positionLat ?? null,
    positionLng: live?.positionLng ?? fallback?.positionLng ?? null,
    headingMagnetic: live?.headingMagnetic ?? fallback?.headingMagnetic ?? null,
    speedOverGround: live?.speedOverGround ?? fallback?.speedOverGround ?? null,
    speedThroughWater: live?.speedThroughWater ?? fallback?.speedThroughWater ?? null,
    windSpeedApparent: live?.windSpeedApparent ?? fallback?.windSpeedApparent ?? null,
    windAngleApparent: live?.windAngleApparent ?? fallback?.windAngleApparent ?? null,
    depthBelowTransducer: live?.depthBelowTransducer ?? fallback?.depthBelowTransducer ?? null,
    waterTemperatureKelvin:
      live?.waterTemperatureKelvin ?? fallback?.waterTemperatureKelvin ?? null,
    batteryVoltage: live?.batteryVoltage ?? fallback?.batteryVoltage ?? null,
    engineRpm: live?.engineRpm ?? fallback?.engineRpm ?? null,
    statusNote: live?.statusNote || fallback?.statusNote || null,
    updatedAt: live?.updatedAt || fallback?.updatedAt || null,
  }
}

const primaryInstallation = computed<PublicInstallationSummary | null>(
  () =>
    props.detail.installations.find((installation) => installation.isPrimary) ||
    props.detail.installations[0] ||
    null,
)

const signalKUrlCandidates = computed(() => {
  const candidates = new Set<string>()

  for (const installation of props.detail.installations) {
    for (const rawUrl of [
      installation.collectorSignalKUrl,
      installation.relaySignalKUrl,
      installation.signalKUrl,
    ]) {
      const normalizedUrl = rawUrl?.trim()
      if (normalizedUrl) {
        candidates.add(normalizedUrl)
      }
    }
  }

  return Array.from(candidates)
})

const publicLiveFeedAvailable = computed(() => signalKUrlCandidates.value.length > 0)
const liveFeedEnabled = computed(() => isClientMounted.value && publicLiveFeedAvailable.value)

const {
  activeUrl: liveFeedActiveUrl,
  connectionState: liveFeedConnectionState,
  lastDeltaAt: liveFeedLastDeltaAt,
  selfSnapshot,
} = useSignalKAisFeed({
  enabled: liveFeedEnabled,
  urls: signalKUrlCandidates,
})

const liveOverlayCompatible = computed(() =>
  canUseSelfOverlay(props.detail.vessel.liveSnapshot, selfSnapshot.value),
)
const liveSnapshot = computed(() =>
  liveOverlayCompatible.value
    ? mergeSnapshots(props.detail.vessel.liveSnapshot, selfSnapshot.value)
    : props.detail.vessel.liveSnapshot,
)
const liveVessel = computed(() => ({
  ...props.detail.vessel,
  liveSnapshot: liveSnapshot.value,
}))
const recentPassages = computed(() => props.detail.passages.slice(0, 3))
const latestPassage = computed(
  () => props.detail.vessel.latestPassage || props.detail.passages[0] || null,
)
const publicPath = computed(() => `/${props.detail.profile.username}/${props.detail.vessel.slug}`)
const trafficMode = computed(() =>
  isClientMounted.value && publicLiveFeedAvailable.value ? 'auto' : 'off',
)
const mapSurfaceKey = computed(() => `${props.detail.vessel.id}:${trafficMode.value}`)

const liveFeedLabel = computed(() => {
  if (!publicLiveFeedAvailable.value) {
    return 'Public API refresh'
  }

  if (liveFeedActiveUrl.value || primaryInstallation.value?.signalKAccessMode === 'relay') {
    return 'Public Signal K relay'
  }

  return 'Public live feed'
})

const liveFeedStatus = computed(() => {
  switch (liveFeedConnectionState.value) {
    case 'connected':
      return liveOverlayCompatible.value
        ? liveFeedLastDeltaAt.value
          ? `Signal K live and merged into this vessel view · delta ${formatRelativeTime(new Date(liveFeedLastDeltaAt.value).toISOString())}`
          : 'Signal K live and merged into this vessel view.'
        : liveFeedLastDeltaAt.value
          ? `Nearby traffic live · delta ${formatRelativeTime(new Date(liveFeedLastDeltaAt.value).toISOString())}`
          : 'Nearby traffic live through the public feed.'
    case 'connecting':
      return 'Connecting to the public Signal K stream.'
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
    value: String(props.detail.passages.length),
    hint: latestPassage.value?.title || 'No public passage yet.',
    icon: 'i-lucide-route',
  },
  {
    label: 'Waypoints saved',
    value: String(props.detail.waypoints.length),
    hint: props.detail.waypoints.length
      ? 'Saved route markers remain visible.'
      : 'No route markers yet.',
    icon: 'i-lucide-map-pinned',
  },
  {
    label: 'Media log',
    value: String(props.detail.media.length),
    hint: props.detail.media.length
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
</script>

<template>
  <div class="space-y-8">
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
      <MarineTrackMap
        :key="mapSurfaceKey"
        :vessels="[liveVessel]"
        :passages="detail.passages"
        :waypoints="detail.waypoints"
        :installations="detail.installations"
        height-class="h-[32rem]"
        :traffic-mode="trafficMode"
      />
    </div>

    <section class="grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
      <div class="space-y-6">
        <UCard class="chart-surface rounded-[1.75rem] shadow-card">
          <template #header>
            <div>
              <h2 class="font-display text-2xl text-default">Environment board</h2>
              <p class="mt-1 text-sm text-muted">
                Public-ready vessel telemetry with speed, wind, heading, depth, water temperature,
                power, and engine state.
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
              <span
                class="rounded-full border border-default/70 px-3 py-1 text-xs uppercase tracking-[0.18em] text-muted"
              >
                {{ detail.passages.length }} passages
              </span>
            </div>
          </template>

          <PassageTimeline :passages="recentPassages" />
        </UCard>

        <MediaStrip v-if="detail.media.length" :media="detail.media" />
      </div>

      <div class="space-y-6">
        <UCard class="chart-surface rounded-[1.75rem] shadow-card">
          <template #header>
            <div>
              <h2 class="font-display text-2xl text-default">Bridge watch</h2>
              <p class="mt-1 text-sm text-muted">
                Quick read on coordinates, feed state, and the latest public route context.
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
