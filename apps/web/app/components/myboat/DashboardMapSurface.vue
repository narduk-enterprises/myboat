<script setup lang="ts">
import type { InstallationSummary, VesselSnapshotSummary } from '~/types/myboat'
import { formatRelativeTime, formatTimestamp } from '~/utils/marine'

const { convertDepth, convertSpeed, depthUnitLabel, speedUnitLabel } = useMarineUnits()
const store = useMyBoatVesselStore()
const trafficEnabled = ref(true)
const entry = computed(() => store.authActiveEntry.value)
const detail = computed(() =>
  entry.value?.vessel ? store.getAuthDetailBySlug(entry.value.vessel.slug) : null,
)
const rawAisContacts = computed(() => store.serializeAisContacts(entry.value))
const trafficDetailBasePath = computed(() =>
  detail.value ? `/dashboard/vessels/${detail.value.vessel.slug}/traffic` : null,
)
const { contacts: enrichedAisContacts } = useAuthEnrichedTrafficContacts(
  computed(() => detail.value?.vessel.slug),
  rawAisContacts,
)
useAuthNearbyTrafficHydrator(
  computed(() => detail.value?.vessel.slug),
  computed(() => entry.value?.key),
  trafficEnabled,
)

function toRoundedText(value: number | null | undefined, digits = 1) {
  if (value === null || value === undefined) {
    return null
  }

  return value.toFixed(digits)
}

const primaryInstallation = computed<InstallationSummary | null>(
  () =>
    (detail.value?.installations.find((installation) => installation.isPrimary) ||
      detail.value?.installations[0] ||
      null) as InstallationSummary | null,
)
const liveSnapshot = computed<VesselSnapshotSummary | null>(
  () => detail.value?.vessel.liveSnapshot ?? null,
)
useMyBoatLiveDemand({
  namespace: 'auth',
  consumerId: 'dashboard-map',
  demand: computed(() => ({
    selfLevel: 'detail',
    ais: trafficEnabled.value,
  })),
})
const metricCards = computed(() => [
  {
    hint: formatTimestamp(liveSnapshot.value?.observedAt),
    icon: 'i-lucide-clock-3',
    label: 'Observed',
    unit: '',
    value: liveSnapshot.value?.observedAt
      ? formatRelativeTime(liveSnapshot.value.observedAt)
      : '--',
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
    <section>
      <UCard class="border-default/80 bg-default/90 shadow-card">
        <template #header>
          <div>
            <div>
              <h2 class="font-display text-2xl text-default">Operational chart</h2>
              <p class="mt-1 text-sm text-muted">
                AIS traffic is on here by default. Select a contact on the map to inspect the nearby
                picture without leaving the route.
              </p>
              <div class="mt-3 flex flex-wrap gap-2">
                <UBadge color="neutral" variant="soft">
                  {{ detail?.vessel.name || 'Primary vessel' }}
                </UBadge>
                <UBadge color="neutral" variant="soft">
                  {{ primaryInstallation?.label || 'No live source' }}
                </UBadge>
              </div>
            </div>
          </div>
        </template>

        <div data-testid="dashboard-live-map">
          <MyBoatDetailedMap
            :vessel="detail?.vessel || null"
            :passages="[]"
            :waypoints="detail?.waypoints || []"
            :installations="detail?.installations || []"
            :ais-contacts="enrichedAisContacts"
            :live-connection-state="entry?.live.connectionState"
            :live-last-delta-at="entry?.live.lastDeltaAt"
            :has-signal-k-source="entry?.live.hasSignalKSource"
            :traffic-detail-base-path="trafficDetailBasePath"
            v-model:traffic-enabled="trafficEnabled"
            :persist-key="detail ? `dashboard-map:${detail.vessel.slug}` : 'dashboard-map'"
            height-class="h-[30rem] sm:h-[36rem] lg:h-[46rem] xl:h-[54rem]"
            :show-focus-panel="false"
            :show-layer-toggles="false"
            :show-pin-labels="false"
            :show-stats-rail="false"
          />
        </div>
      </UCard>
    </section>

    <section class="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(22rem,0.92fr)]">
      <UCard class="border-default/80 bg-default/90 shadow-card">
        <template #header>
          <div>
            <h2 class="font-display text-2xl text-default">Live bridge metrics</h2>
            <p class="mt-1 text-sm text-muted">
              The full metric board lives under the chart so the map stays dominant.
            </p>
          </div>
        </template>

        <MarineSnapshotGrid :snapshot="liveSnapshot" />
      </UCard>

      <UCard class="border-default/80 bg-default/90 shadow-card">
        <template #header>
          <div>
            <h2 class="font-display text-2xl text-default">Fast read</h2>
            <p class="mt-1 text-sm text-muted">
              The shortest way to understand the vessel state before drilling into details.
            </p>
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
