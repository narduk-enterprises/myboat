<script setup lang="ts">
definePageMeta({ middleware: ['admin'] })

useSeo({
  title: 'Telemetry · Admin',
  description: 'Live snapshot coverage and ingest pipeline health across all MyBoat vessels.',
  robots: 'noindex, nofollow',
})

useWebPageSchema({
  name: 'Admin telemetry',
  description: 'Live snapshot coverage and ingest pipeline health across all MyBoat vessels.',
})

const appFetch = useAppFetch()

interface TelemetrySnapshot {
  vesselId: string
  source: string
  observedAt: string | null
  positionLat: number | null
  positionLng: number | null
  speedOverGround: number | null
  updatedAt: string
  vesselName: string | null
  ownerEmail: string | null
  eventCount: number | null
}

interface TelemetryResponse {
  snapshots: TelemetrySnapshot[]
  total: number
}

const { data } = await useAsyncData('admin-telemetry', () =>
  appFetch<TelemetryResponse>('/api/admin/app/telemetry'),
)

const snapshots = computed(() => data.value?.snapshots ?? [])
const total = computed(() => data.value?.total ?? 0)
const withPosition = computed(
  () => snapshots.value.filter((s) => s.positionLat !== null && s.positionLng !== null).length,
)
const withSpeed = computed(
  () => snapshots.value.filter((s) => s.speedOverGround !== null).length,
)

function formatCoord(lat: number | null, lng: number | null) {
  if (lat === null || lng === null) return 'No fix'
  return `${lat.toFixed(4)}°, ${lng.toFixed(4)}°`
}
</script>

<template>
  <div class="space-y-8">
    <div class="flex items-center gap-3">
      <UButton to="/admin" color="neutral" variant="ghost" icon="i-lucide-arrow-left" size="sm">
        Admin
      </UButton>
    </div>

    <UPageHero
      title="Telemetry"
      description="Live snapshot coverage from the ingest edge. Each row is the latest state reported by a vessel."
    />

    <div class="grid gap-4 sm:grid-cols-3">
      <MarineMetricCard
        label="Vessels with snapshots"
        :value="String(total)"
        icon="i-lucide-activity"
      />
      <MarineMetricCard
        label="With GPS fix"
        :value="String(withPosition)"
        icon="i-lucide-map-pin"
      />
      <MarineMetricCard
        label="With speed data"
        :value="String(withSpeed)"
        icon="i-lucide-gauge"
      />
    </div>

    <UCard class="chart-surface rounded-[1.75rem]">
      <template #header>
        <div>
          <h2 class="font-display text-xl text-default">Live snapshots</h2>
          <p class="mt-1 text-sm text-muted">
            Latest telemetry state per vessel · showing 50 most recently updated
          </p>
        </div>
      </template>

      <div v-if="snapshots.length" class="space-y-3">
        <div
          v-for="snapshot in snapshots"
          :key="snapshot.vesselId"
          class="rounded-2xl border border-default bg-elevated/60 px-4 py-4"
        >
          <div class="flex items-start justify-between gap-4">
            <div class="min-w-0">
              <p class="font-medium text-default">{{ snapshot.vesselName || 'Unknown vessel' }}</p>
              <p class="mt-1 text-sm text-muted">
                {{ formatCoord(snapshot.positionLat, snapshot.positionLng) }}
                <template v-if="snapshot.speedOverGround !== null">
                  · {{ snapshot.speedOverGround.toFixed(1) }} kts SOG
                </template>
              </p>
              <p class="mt-1 text-xs text-muted">
                Owner: {{ snapshot.ownerEmail || 'Unknown' }}
                · Source: {{ snapshot.source }}
                <template v-if="snapshot.eventCount !== null">
                  · {{ snapshot.eventCount.toLocaleString() }} events
                </template>
              </p>
            </div>
            <div class="shrink-0 text-right">
              <UBadge
                :color="snapshot.observedAt ? 'success' : 'neutral'"
                variant="soft"
                size="xs"
              >
                {{ snapshot.observedAt ? 'Observed' : 'No data' }}
              </UBadge>
              <p class="mt-1 text-xs text-muted">
                Updated {{ new Date(snapshot.updatedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) }}
              </p>
            </div>
          </div>
        </div>
      </div>

      <MarineEmptyState
        v-else
        icon="i-lucide-radio"
        title="No telemetry data"
        description="No live snapshots found. Snapshots are created when the first ingest payload arrives for a vessel."
        compact
      />
    </UCard>
  </div>
</template>
