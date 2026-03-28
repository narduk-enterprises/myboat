<script setup lang="ts">
import type { InstallationSummary, VesselDetailResponse, VesselSnapshotSummary } from '~/types/myboat'
import {
  formatCoordinate,
  formatRelativeTime,
  formatTimestamp,
  getConnectionTone,
} from '~/utils/marine'

const props = defineProps<{
  detail: VesselDetailResponse
}>()

const {
  convertDepth,
  convertSpeed,
  depthUnitLabel,
  speedUnitLabel,
} = useMarineUnits()

function toRoundedText(value: number | null | undefined, digits = 1) {
  if (value === null || value === undefined) {
    return null
  }

  return value.toFixed(digits)
}

const primaryInstallation = computed<InstallationSummary | null>(
  () =>
    props.detail.installations.find((installation) => installation.isPrimary) ||
    props.detail.installations[0] ||
    null,
)
const liveSnapshot = computed<VesselSnapshotSummary | null>(
  () => props.detail.vessel.liveSnapshot ?? null,
)
const installationDetailPath = computed(() =>
  primaryInstallation.value ? `/dashboard/installations/${primaryInstallation.value.id}` : null,
)
const sourceTone = computed(() =>
  getConnectionTone(
    primaryInstallation.value?.connectionState || 'idle',
    primaryInstallation.value?.lastSeenAt,
  ),
)
const publicVesselPath = computed(
  () => `/${props.detail.profile.username}/${props.detail.vessel.slug}`,
)
const diagnostics = computed(() => {
  const items: Array<{
    color: 'primary' | 'success' | 'warning' | 'neutral'
    description: string
    title: string
  }> = []

  if (!primaryInstallation.value) {
    items.push({
      color: 'warning',
      description: 'Add a live-data source so the chart can anchor to one canonical feed for the vessel.',
      title: 'No live-data source is linked yet',
    })
  } else if (primaryInstallation.value.connectionState !== 'live') {
    items.push({
      color: sourceTone.value === 'success' ? 'success' : 'warning',
      description: primaryInstallation.value.lastSeenAt
        ? `Primary source last seen ${formatRelativeTime(primaryInstallation.value.lastSeenAt)}.`
        : 'The primary source has not reported telemetry yet.',
      title: `${primaryInstallation.value.label} is not fully live`,
    })
  }

  if (!liveSnapshot.value?.observedAt) {
    items.push({
      color: 'warning',
      description: 'The vessel has not stored a recent live fix yet. Check the primary source and send telemetry.',
      title: 'No current live fix',
    })
  }

  if (liveSnapshot.value?.statusNote) {
    items.push({
      color: 'primary',
      description: liveSnapshot.value.statusNote,
      title: 'Status note from the live feed',
    })
  }

  if (!items.length) {
    items.push({
      color: 'success',
      description: 'The primary vessel and live-data source are reporting normally.',
      title: 'No active issues right now',
    })
  }

  return items
})
const metricCards = computed(() => [
  {
    hint: formatTimestamp(liveSnapshot.value?.observedAt),
    icon: 'i-lucide-clock-3',
    label: 'Observed',
    unit: '',
    value: liveSnapshot.value?.observedAt ? formatRelativeTime(liveSnapshot.value.observedAt) : '--',
  },
  {
    hint: 'Speed over ground from the current vessel feed.',
    icon: 'i-lucide-gauge',
    label: 'Speed over ground',
    unit: speedUnitLabel.value,
    value: toRoundedText(convertSpeed(liveSnapshot.value?.speedOverGround)) || '--',
  },
  {
    hint: 'Apparent wind speed from the active feed.',
    icon: 'i-lucide-wind',
    label: 'Apparent wind',
    unit: speedUnitLabel.value,
    value: toRoundedText(convertSpeed(liveSnapshot.value?.windSpeedApparent)) || '--',
  },
  {
    hint: 'Current sounding at the transducer.',
    icon: 'i-lucide-waves',
    label: 'Depth',
    unit: depthUnitLabel.value,
    value: toRoundedText(convertDepth(liveSnapshot.value?.depthBelowTransducer)) || '--',
  },
])
</script>

<template>
  <div class="space-y-8">
    <section class="chart-surface-strong rounded-[2rem] px-6 py-8 sm:px-8">
      <div class="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div class="space-y-4">
          <div class="marine-kicker w-fit">Live operations map</div>
          <div>
            <h1 class="font-display text-4xl tracking-tight text-default sm:text-5xl">
              {{ props.detail.vessel.name }}
            </h1>
            <p class="mt-3 max-w-3xl text-base text-muted sm:text-lg">
              A deeper chart for AIS traffic, selected-contact detail, and the small set of diagnostics that matter when something feels off.
            </p>
          </div>
          <div class="flex flex-wrap gap-2">
            <UBadge :color="sourceTone" variant="soft">
              {{ primaryInstallation?.connectionState || 'setup pending' }}
            </UBadge>
            <UBadge color="neutral" variant="soft">
              {{ primaryInstallation?.label || 'No live source' }}
            </UBadge>
          </div>
        </div>

        <div class="flex flex-wrap gap-3">
          <UButton to="/dashboard" color="neutral" variant="soft" icon="i-lucide-arrow-left">
            Dashboard
          </UButton>
          <UButton to="/dashboard/settings" color="neutral" variant="soft" icon="i-lucide-sliders-horizontal">
            Settings
          </UButton>
          <UButton :to="publicVesselPath" color="primary" icon="i-lucide-share-2">
            Public vessel page
          </UButton>
        </div>
      </div>
    </section>

    <section class="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(20rem,0.8fr)]">
      <UCard class="border-default/80 bg-default/90 shadow-card">
        <template #header>
          <div>
            <h2 class="font-display text-2xl text-default">Operational chart</h2>
            <p class="mt-1 text-sm text-muted">
              AIS traffic is on here by default. Select a contact on the map to inspect the nearby picture without leaving the route.
            </p>
          </div>
        </template>

        <div data-testid="dashboard-live-map">
          <MarineTrackMap
            :vessels="[props.detail.vessel]"
            :passages="props.detail.passages"
            :waypoints="props.detail.waypoints"
            :installations="props.detail.installations"
            height-class="h-[24rem] sm:h-[30rem] lg:h-[38rem] xl:h-[44rem]"
            traffic-mode="auto"
          />
        </div>
      </UCard>

      <div class="space-y-6">
        <UCard class="border-default/80 bg-default/90 shadow-card">
          <template #header>
            <div>
              <h2 class="font-display text-2xl text-default">What needs attention</h2>
              <p class="mt-1 text-sm text-muted">Compact issue context, not another crowded dashboard column.</p>
            </div>
          </template>

          <div class="space-y-3">
            <UAlert
              v-for="item in diagnostics"
              :key="item.title"
              :color="item.color"
              variant="soft"
              :title="item.title"
              :description="item.description"
            />
          </div>
        </UCard>

        <UCard class="border-default/80 bg-default/90 shadow-card">
          <template #header>
            <div>
              <h2 class="font-display text-2xl text-default">Map context</h2>
              <p class="mt-1 text-sm text-muted">Source, public path, and quick exits into the contextual legacy routes.</p>
            </div>
          </template>

          <div class="space-y-4 text-sm text-muted">
            <div class="rounded-2xl border border-default bg-elevated/60 px-4 py-4">
              <p class="text-xs uppercase tracking-wide text-muted">Current fix</p>
              <p class="mt-2 font-medium text-default">
                {{
                  liveSnapshot?.positionLat !== null && liveSnapshot?.positionLat !== undefined
                    ? formatCoordinate(liveSnapshot.positionLat, true)
                    : 'No live fix yet'
                }}
              </p>
              <p
                v-if="liveSnapshot?.positionLng !== null && liveSnapshot?.positionLng !== undefined"
                class="mt-1 font-medium text-default"
              >
                {{ formatCoordinate(liveSnapshot.positionLng, false) }}
              </p>
              <p class="mt-2 text-xs text-muted">
                {{
                  liveSnapshot?.observedAt
                    ? `Observed ${formatRelativeTime(liveSnapshot.observedAt)}`
                    : 'Waiting for the first stored position update.'
                }}
              </p>
            </div>

            <div class="rounded-2xl border border-default bg-elevated/60 px-4 py-4">
              <p class="text-xs uppercase tracking-wide text-muted">Primary source</p>
              <p class="mt-2 font-medium text-default">{{ primaryInstallation?.label || 'Pending' }}</p>
              <p class="mt-1 text-xs text-muted">
                {{
                  primaryInstallation?.lastSeenAt
                    ? `Last seen ${formatRelativeTime(primaryInstallation.lastSeenAt)}`
                    : 'No heartbeat observed from the source.'
                }}
              </p>
            </div>

            <div class="rounded-2xl border border-default bg-elevated/60 px-4 py-4">
              <p class="text-xs uppercase tracking-wide text-muted">Public path</p>
              <p class="mt-2 font-medium text-default">{{ publicVesselPath }}</p>
            </div>

            <div class="flex flex-wrap gap-3">
              <UButton
                :to="`/dashboard/vessels/${props.detail.vessel.slug}`"
                color="neutral"
                variant="soft"
                icon="i-lucide-ship"
              >
                Vessel detail
              </UButton>
              <UButton
                v-if="installationDetailPath"
                :to="installationDetailPath"
                color="neutral"
                variant="soft"
                icon="i-lucide-cpu"
              >
                Live source
              </UButton>
            </div>
          </div>
        </UCard>
      </div>
    </section>

    <section class="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(22rem,0.92fr)]">
      <UCard class="border-default/80 bg-default/90 shadow-card">
        <template #header>
          <div>
            <h2 class="font-display text-2xl text-default">Live bridge metrics</h2>
            <p class="mt-1 text-sm text-muted">The full metric board lives under the chart so the map stays dominant.</p>
          </div>
        </template>

        <MarineSnapshotGrid :snapshot="liveSnapshot" />
      </UCard>

      <UCard class="border-default/80 bg-default/90 shadow-card">
        <template #header>
          <div>
            <h2 class="font-display text-2xl text-default">Fast read</h2>
            <p class="mt-1 text-sm text-muted">The shortest way to understand the vessel state before drilling into details.</p>
          </div>
        </template>

        <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-1">
          <MarineMetricCard
            v-for="metric in metricCards"
            :key="metric.label"
            :label="metric.label"
            :value="metric.value"
            :unit="metric.unit"
            :hint="metric.hint"
            :icon="metric.icon"
          />
        </div>
      </UCard>
    </section>
  </div>
</template>
