<script setup lang="ts">
import type { InstallationSummary, PassageSummary, VesselSnapshotSummary } from '~/types/myboat'
import { formatCoordinate, formatRelativeTime, getConnectionTone } from '~/utils/marine'

const { convertAngle, convertDepth, convertSpeed, depthUnitLabel, speedUnitLabel } =
  useMarineUnits()

function toRoundedText(value: number | null | undefined, digits = 1) {
  if (value === null || value === undefined) {
    return '—'
  }

  return value.toFixed(digits)
}

const store = useMyBoatVesselStore()
const isCompactViewport = useCompactViewport()
useMyBoatLiveDemand({
  namespace: 'auth',
  consumerId: 'dashboard-overview',
  demand: computed(() => ({
    selfLevel: 'summary',
    ais: false,
  })),
})

const primaryEntry = computed(() => store.authActiveEntry.value)
const primaryVessel = computed(() => primaryEntry.value?.vessel || null)
const primaryInstallation = computed<InstallationSummary | null>(
  () =>
    (primaryEntry.value?.installations.find((installation) => installation.isPrimary) ||
      primaryEntry.value?.installations[0] ||
      null) as InstallationSummary | null,
)
const primarySnapshot = computed<VesselSnapshotSummary | null>(
  () => primaryVessel.value?.liveSnapshot ?? null,
)
const observedIdentity = computed(
  () =>
    primaryVessel.value?.observedIdentity || primaryInstallation.value?.observedIdentity || null,
)
const latestPassage = computed<PassageSummary | null>(
  () => primaryEntry.value?.passages[0] || primaryVessel.value?.latestPassage || null,
)
const vesselMmsi = computed(() => observedIdentity.value?.mmsi || 'Pending')
const vesselLatitude = computed(() =>
  formatCoordinate(primarySnapshot.value?.positionLat ?? null, true),
)
const vesselLongitude = computed(() =>
  formatCoordinate(primarySnapshot.value?.positionLng ?? null, false),
)
const apparentWind = computed(() =>
  toRoundedText(convertSpeed(primarySnapshot.value?.windSpeedApparent)),
)
const speedOverGround = computed(() =>
  toRoundedText(convertSpeed(primarySnapshot.value?.speedOverGround)),
)
const heading = computed(() =>
  toRoundedText(convertAngle(primarySnapshot.value?.headingMagnetic), 0),
)
const depth = computed(() =>
  toRoundedText(convertDepth(primarySnapshot.value?.depthBelowTransducer)),
)
const headerMetrics = computed(() => {
  const metrics = [
    { label: 'MMSI', value: vesselMmsi.value },
    { label: 'Lat', value: vesselLatitude.value },
    { label: 'Lng', value: vesselLongitude.value },
    { label: 'AWS', value: `${apparentWind.value} ${speedUnitLabel.value}` },
    { label: 'SOG', value: `${speedOverGround.value} ${speedUnitLabel.value}` },
    { label: 'Heading', value: `${heading.value}°` },
    { label: 'Depth', value: `${depth.value} ${depthUnitLabel.value}` },
  ]

  if (!isCompactViewport.value) {
    return metrics
  }

  return metrics.filter((metric) => ['Lat', 'Lng', 'SOG', 'Depth'].includes(metric.label))
})
const statsCards = computed(() => [
  {
    hint: primaryVessel.value?.vesselType || 'Primary launch vessel',
    label: 'Vessel name',
    value: primaryVessel.value?.name || 'Pending',
  },
  {
    hint: observedIdentity.value?.observedAt
      ? `Observed ${formatRelativeTime(observedIdentity.value.observedAt)} from the collector path.`
      : 'Waiting for observed vessel identity from the collector path.',
    label: 'MMSI',
    value: vesselMmsi.value,
  },
  {
    hint: primarySnapshot.value?.observedAt
      ? `Observed ${formatRelativeTime(primarySnapshot.value.observedAt)}`
      : 'No live fix yet',
    label: 'Latitude',
    value: vesselLatitude.value,
  },
  {
    hint: latestPassage.value?.title || 'No passage pinned yet',
    label: 'Longitude',
    value: vesselLongitude.value,
  },
  {
    hint: 'Apparent wind speed from the active feed.',
    label: 'Apparent wind',
    unit: speedUnitLabel.value,
    value: apparentWind.value,
  },
  {
    hint: 'Speed over ground from the active feed.',
    label: 'SOG',
    unit: speedUnitLabel.value,
    value: speedOverGround.value,
  },
  {
    hint: 'Magnetic heading from the current snapshot.',
    label: 'Heading',
    unit: '°',
    value: heading.value,
  },
  {
    hint: 'Current sounding at the transducer.',
    label: 'Depth',
    unit: depthUnitLabel.value,
    value: depth.value,
  },
])
const setupAlert = computed(() => {
  if (!store.authState.value.profile) {
    return {
      description:
        'Finish onboarding to attach the captain identity, primary vessel, and first collector install.',
      to: '/dashboard/onboarding',
      title: 'Captain setup is still incomplete',
    }
  }

  if (!primaryVessel.value) {
    return {
      description:
        'Add the primary vessel so the dashboard has a real boat to anchor the map and bridge stats.',
      to: '/dashboard/onboarding',
      title: 'No primary vessel yet',
    }
  }

  if (!primaryInstallation.value) {
    return {
      description:
        'Link one collector install for the vessel so the dashboard can fill in the bridge stats.',
      to: '/dashboard/settings',
      title: 'No collector install linked',
    }
  }

  if (!primarySnapshot.value?.observedAt) {
    return {
      description:
        'The source is saved, but telemetry has not landed yet. Open the source detail and start sending data.',
      to: primaryInstallation.value
        ? `/dashboard/installations/${primaryInstallation.value.id}`
        : '/dashboard/settings',
      title: 'Waiting for the first live fix',
    }
  }

  return null
})
const sourceTone = computed(() =>
  getConnectionTone(
    primaryInstallation.value?.connectionState || 'idle',
    primaryInstallation.value?.lastSeenAt,
  ),
)
</script>

<template>
  <div class="space-y-6">
    <section class="lg:sticky lg:top-4 lg:z-20">
      <div
        class="rounded-[1.35rem] border border-default/70 bg-default/92 px-4 py-4 shadow-card backdrop-blur sm:rounded-[1.5rem] sm:px-5"
      >
        <div class="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div class="min-w-0">
            <p class="text-xs uppercase tracking-[0.24em] text-muted">Live details</p>
            <div class="mt-2 flex flex-wrap items-center gap-3">
              <h1 class="truncate font-display text-2xl text-default sm:text-3xl">
                {{ primaryVessel?.name || 'Primary vessel pending' }}
              </h1>
              <UBadge :color="sourceTone" variant="soft">
                {{ primaryInstallation?.connectionState || 'setup pending' }}
              </UBadge>
            </div>
          </div>

          <div class="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-7">
            <div
              v-for="metric in headerMetrics"
              :key="metric.label"
              class="rounded-[1rem] border border-default bg-elevated/70 px-3 py-2.5"
            >
              <p class="text-[0.65rem] uppercase tracking-[0.2em] text-muted">{{ metric.label }}</p>
              <p class="mt-1 text-sm font-medium text-default">{{ metric.value }}</p>
            </div>
          </div>
        </div>
      </div>
    </section>

    <UAlert
      v-if="setupAlert"
      color="warning"
      variant="soft"
      :title="setupAlert.title"
      :description="setupAlert.description"
    >
      <template #actions>
        <UButton :to="setupAlert.to" color="warning" variant="soft" icon="i-lucide-anchor">
          Resolve
        </UButton>
      </template>
    </UAlert>

    <section
      class="overflow-hidden rounded-[1.75rem] border border-default/80 bg-default/90 shadow-card"
    >
      <div data-testid="dashboard-current-location-map">
        <MyBoatCurrentLocationMiniMap
          :vessel="primaryVessel"
          height-class="h-[20rem] sm:h-[24rem] lg:h-[28rem]"
        />
      </div>
    </section>

    <UCard class="border-default/80 bg-default/90 shadow-card">
      <template #header>
        <div>
          <h2 class="font-display text-2xl text-default">Boat stats</h2>
          <p class="mt-1 text-sm text-muted">
            Fixed launch layout for the operator board. This panel is not configurable yet.
          </p>
        </div>
      </template>

      <div class="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <MarineMetricCard
          v-for="card in statsCards"
          :key="card.label"
          :label="card.label"
          :value="card.value"
          :unit="card.unit || ''"
          :hint="card.hint"
        />
      </div>
    </UCard>
  </div>
</template>
