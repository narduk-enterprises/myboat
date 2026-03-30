<script setup lang="ts">
import type { InstallationSummary, VesselSnapshotSummary } from '~/types/myboat'
import { formatCoordinate, getConnectionTone } from '~/utils/marine'

defineOptions({ inheritAttrs: false })

const { convertAngle, convertDepth, convertSpeed, depthUnitLabel, speedUnitLabel } =
  useMarineUnits()

const isCompactViewport = useCompactViewport()
const store = useMyBoatVesselStore()
const { data, pending } = await useDashboardOverview('myboat-dashboard-shell')

if (data.value) {
  store.hydrateAuthOverview(data.value)
}

watch(
  data,
  (value) => {
    if (value) {
      store.hydrateAuthOverview(value)
    }
  },
  { immediate: false },
)

function toRoundedText(value: number | null | undefined, digits = 1) {
  if (value === null || value === undefined) {
    return '—'
  }

  return value.toFixed(digits)
}

const entry = computed(() => store.authActiveEntry.value)
const vessel = computed(() => entry.value?.vessel || null)
const liveSnapshot = computed<VesselSnapshotSummary | null>(
  () => entry.value?.mergedSnapshot || vessel.value?.liveSnapshot || null,
)
const primaryInstallation = computed<InstallationSummary | null>(
  () =>
    (entry.value?.installations.find((installation) => installation.isPrimary) ||
      entry.value?.installations[0] ||
      null) as InstallationSummary | null,
)
const observedIdentity = computed(
  () => vessel.value?.observedIdentity || primaryInstallation.value?.observedIdentity || null,
)
const connectionObservedAt = computed(() => {
  const lastSeenAt = primaryInstallation.value?.lastSeenAt

  if (typeof lastSeenAt === 'string') {
    return lastSeenAt
  }

  const lastDeltaAt = entry.value?.live.lastDeltaAt

  if (typeof lastDeltaAt === 'string') {
    return lastDeltaAt
  }

  return lastDeltaAt ? new Date(lastDeltaAt).toISOString() : null
})
const statusTone = computed(() =>
  getConnectionTone(
    entry.value?.live.connectionState || primaryInstallation.value?.connectionState || 'idle',
    connectionObservedAt.value,
  ),
)
const statusLabel = computed(() => {
  switch (entry.value?.live.connectionState) {
    case 'connected':
      return 'live'
    case 'connecting':
      return 'connecting'
    case 'error':
      return 'offline'
    default:
      return primaryInstallation.value ? 'standby' : 'setup pending'
  }
})
const metrics = computed(() => {
  const allMetrics = [
    { label: 'MMSI', value: observedIdentity.value?.mmsi || 'Pending' },
    { label: 'Lat', value: formatCoordinate(liveSnapshot.value?.positionLat ?? null, true) },
    { label: 'Lng', value: formatCoordinate(liveSnapshot.value?.positionLng ?? null, false) },
    {
      label: 'AWS',
      value: `${toRoundedText(convertSpeed(liveSnapshot.value?.windSpeedApparent))} ${speedUnitLabel.value}`,
    },
    {
      label: 'SOG',
      value: `${toRoundedText(convertSpeed(liveSnapshot.value?.speedOverGround))} ${speedUnitLabel.value}`,
    },
    {
      label: 'Heading',
      value: `${toRoundedText(convertAngle(liveSnapshot.value?.headingMagnetic), 0)}°`,
    },
    {
      label: 'Depth',
      value: `${toRoundedText(convertDepth(liveSnapshot.value?.depthBelowTransducer))} ${depthUnitLabel.value}`,
    },
  ]

  if (!isCompactViewport.value) {
    return allMetrics
  }

  return allMetrics.filter((metric) => ['Lat', 'Lng', 'SOG', 'Depth'].includes(metric.label))
})
</script>

<template>
  <div
    v-if="pending && !vessel"
    class="sticky top-[4.75rem] z-40 border-b border-default/60 bg-default/84 backdrop-blur-2xl sm:top-[5rem]"
  >
    <div class="mx-auto max-w-[96rem] px-4 py-3 sm:px-6 lg:px-8">
      <div class="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div class="space-y-2 lg:w-[16rem] lg:shrink-0">
          <USkeleton class="h-3 w-20 rounded-full" />
          <div class="flex items-center gap-2">
            <USkeleton class="h-9 w-40 rounded-full" />
            <USkeleton class="h-7 w-20 rounded-full" />
          </div>
        </div>

        <div class="flex gap-2 overflow-x-auto pb-1 lg:flex-1 lg:overflow-visible lg:pb-0">
          <USkeleton
            v-for="item in 4"
            :key="item"
            class="h-[4.25rem] min-w-[8.5rem] rounded-[1rem] lg:min-w-0 lg:flex-1"
          />
        </div>
      </div>
    </div>
  </div>

  <div
    v-else-if="vessel"
    class="sticky top-[4.75rem] z-40 border-b border-default/60 bg-default/84 backdrop-blur-2xl sm:top-[5rem]"
  >
    <div class="mx-auto max-w-[96rem] px-4 py-3 sm:px-6 lg:px-8">
      <div class="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div class="min-w-0 lg:w-[16rem] lg:shrink-0">
          <p class="text-[0.65rem] uppercase tracking-[0.26em] text-muted">Live details</p>
          <div class="mt-1.5 flex min-w-0 flex-wrap items-center gap-2">
            <h1 class="truncate font-display text-2xl text-default sm:text-[2.1rem]">
              {{ vessel.name }}
            </h1>
            <UBadge :color="statusTone" variant="soft">
              {{ statusLabel }}
            </UBadge>
          </div>
        </div>

        <div class="flex gap-2 overflow-x-auto pb-1 lg:flex-1 lg:overflow-visible lg:pb-0">
          <div
            v-for="metric in metrics"
            :key="metric.label"
            class="min-w-[8.5rem] rounded-[1rem] border border-default/80 bg-elevated/72 px-3 py-2.5 lg:min-w-0 lg:flex-1"
          >
            <p class="text-[0.62rem] uppercase tracking-[0.22em] text-muted">
              {{ metric.label }}
            </p>
            <p class="mt-1 text-sm font-medium text-default">
              {{ metric.value }}
            </p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
