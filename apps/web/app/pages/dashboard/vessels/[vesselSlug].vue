<script setup lang="ts">
import { formatCoordinate, formatRelativeTime, formatTimestamp } from '~/utils/marine'

definePageMeta({ middleware: ['auth'] })

const route = useRoute()
const vesselSlug = computed(() => String(route.params.vesselSlug || ''))

const { data } = await useVesselDetail(vesselSlug.value)

const detail = computed(() => data.value)

useSeo({
  title: detail.value?.vessel.name || 'Vessel',
  description: 'Vessel detail including live telemetry, passages, media, and install context.',
  robots: 'noindex, nofollow',
})

useWebPageSchema({
  name: 'Vessel detail',
  description: 'Vessel detail including live telemetry, passages, media, and install context.',
})

const tabs = [
  { value: 'overview', label: 'Overview', icon: 'i-lucide-map', slot: 'overview' },
  { value: 'telemetry', label: 'Telemetry', icon: 'i-lucide-gauge', slot: 'telemetry' },
  { value: 'passages', label: 'Passages', icon: 'i-lucide-route', slot: 'passages' },
  { value: 'media', label: 'Media', icon: 'i-lucide-camera', slot: 'media' },
  { value: 'installs', label: 'Installs', icon: 'i-lucide-cpu', slot: 'installs' },
]

const { convertAngle, convertSpeed, speedUnitLabel } = useMarineUnits()

const extendedMetrics = computed(() => {
  const snap = detail.value?.vessel.liveSnapshot
  if (!snap) return []

  const items: { label: string; value: string; unit: string; icon: string }[] = []

  if (snap.speedThroughWater !== null && snap.speedThroughWater !== undefined) {
    items.push({
      label: 'Speed through water',
      value: convertSpeed(snap.speedThroughWater)?.toFixed(1) ?? '--',
      unit: speedUnitLabel.value,
      icon: 'i-lucide-waves',
    })
  }

  if (snap.headingMagnetic !== null && snap.headingMagnetic !== undefined) {
    items.push({
      label: 'Heading magnetic',
      value: convertAngle(snap.headingMagnetic)?.toFixed(0) ?? '--',
      unit: '°M',
      icon: 'i-lucide-compass',
    })
  }

  if (snap.engineRpm !== null && snap.engineRpm !== undefined) {
    items.push({
      label: 'Engine RPM',
      value: snap.engineRpm.toFixed(0),
      unit: 'RPM',
      icon: 'i-lucide-activity',
    })
  }

  return items
})
</script>

<template>
  <div v-if="detail" class="space-y-6">
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
          :to="`/${detail.profile.username}`"
          color="neutral"
          variant="soft"
          icon="i-lucide-share-2"
        >
          Public profile
        </UButton>
      </template>
    </UPageHero>

    <AppTabs :items="tabs" query-key="tab">
      <template #overview>
        <div class="grid gap-6 pt-4 xl:grid-cols-[1.2fr_0.8fr]">
          <MarineTrackMap
            :vessels="[detail.vessel]"
            :passages="detail.passages"
            :waypoints="detail.waypoints"
            height-class="h-[30rem]"
          />

          <UCard class="border-default/80 bg-default/90 shadow-card">
            <template #header>
              <div>
                <h3 class="font-display text-xl text-default">Live position</h3>
                <p class="mt-1 text-sm text-muted">Last reported fix and operational context.</p>
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

              <div
                v-if="detail.vessel.liveSnapshot?.statusNote"
                class="rounded-2xl border border-default bg-elevated/60 px-4 py-4"
              >
                <p class="text-xs uppercase tracking-wide text-muted">Status note</p>
                <p class="mt-2 font-medium text-default">
                  {{ detail.vessel.liveSnapshot.statusNote }}
                </p>
              </div>
            </div>
          </UCard>
        </div>
      </template>

      <template #telemetry>
        <div class="space-y-6 pt-4">
          <div>
            <h3 class="font-display text-lg text-default">Live snapshot</h3>
            <p class="mt-1 text-sm text-muted">
              Current telemetry from the most recent ingest event.
              <span
                v-if="detail.vessel.liveSnapshot?.observedAt"
              >
                Last updated {{ formatRelativeTime(detail.vessel.liveSnapshot.observedAt) }}.
              </span>
            </p>
          </div>

          <MarineSnapshotGrid :snapshot="detail.vessel.liveSnapshot" />

          <div v-if="extendedMetrics.length" class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <MarineMetricCard
              v-for="metric in extendedMetrics"
              :key="metric.label"
              :label="metric.label"
              :value="metric.value"
              :unit="metric.unit"
              :icon="metric.icon"
            />
          </div>
        </div>
      </template>

      <template #passages>
        <div class="pt-4">
          <PassageTimeline :passages="detail.passages" />
        </div>
      </template>

      <template #media>
        <div class="pt-4">
          <MediaStrip :media="detail.media" />
        </div>
      </template>

      <template #installs>
        <div class="pt-4">
          <UCard class="border-default/80 bg-default/90 shadow-card">
            <template #header>
              <div>
                <h3 class="font-display text-xl text-default">Install links</h3>
                <p class="mt-1 text-sm text-muted">
                  Device installs currently mapped to this vessel.
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
                    <p class="font-medium text-default">{{ installation.label }}</p>
                    <p class="mt-1 text-xs text-muted">
                      {{ installation.edgeHostname || 'Hostname pending' }}
                    </p>
                  </div>

                  <UButton
                    :to="`/dashboard/installations/${installation.id}`"
                    color="neutral"
                    variant="soft"
                  >
                    Open
                  </UButton>
                </div>
              </div>
            </div>

            <AppEmptyState
              v-else
              icon="i-lucide-cpu"
              title="No installs linked yet"
              description="Create or finish onboarding to attach a live device install to this vessel."
              compact
            />
          </UCard>
        </div>
      </template>
    </AppTabs>
  </div>
</template>
