<script setup lang="ts">
import type {
  InstallationSummary,
  VesselDetailResponse,
  VesselSnapshotSummary,
} from '~/types/myboat'
import { formatCoordinate, formatRelativeTime, formatTimestamp } from '~/utils/marine'

const props = defineProps<{
  detail: VesselDetailResponse
}>()

const primaryInstallation = computed<InstallationSummary | null>(
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
const liveFeedEnabled = computed(() => import.meta.client && signalKUrlCandidates.value.length > 0)
const {
  activeUrl: liveFeedActiveUrl,
  connectionState: liveFeedConnectionState,
  lastDeltaAt: liveFeedLastDeltaAt,
  selfSnapshot,
} = useSignalKAisFeed({
  enabled: liveFeedEnabled,
  urls: signalKUrlCandidates,
})
const recentPassages = computed(() => props.detail.passages.slice(0, 3))
const publicPath = computed(() => `/${props.detail.profile.username}/${props.detail.vessel.slug}`)

function mergeSnapshots(
  fallback: VesselSnapshotSummary | null,
  live: VesselSnapshotSummary | null,
): VesselSnapshotSummary | null {
  if (!fallback && !live) {
    return null
  }

  return {
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
  }
}

const liveSnapshot = computed(() => mergeSnapshots(props.detail.vessel.liveSnapshot, selfSnapshot.value))
const liveVessel = computed(() => ({
  ...props.detail.vessel,
  liveSnapshot: liveSnapshot.value,
}))
const liveFeedSourceUrl = computed(
  () =>
    liveFeedActiveUrl.value ||
    primaryInstallation.value?.collectorSignalKUrl ||
    primaryInstallation.value?.relaySignalKUrl ||
    primaryInstallation.value?.signalKUrl ||
    null,
)
const liveFeedStatus = computed(() => {
  switch (liveFeedConnectionState.value) {
    case 'connected':
      return liveFeedLastDeltaAt.value
        ? `Live feed connected · updated ${formatRelativeTime(new Date(liveFeedLastDeltaAt.value).toISOString())}`
        : 'Live feed connected'
    case 'connecting':
      return 'Connecting to Tideye Signal K'
    case 'error':
      return 'Live feed unavailable'
    default:
      return signalKUrlCandidates.value.length
        ? 'Live feed standing by'
        : 'No live Signal K endpoint linked'
  }
})
</script>

<template>
  <div class="space-y-6">
    <div class="grid gap-6 xl:grid-cols-[1.18fr_0.82fr]">
      <div class="space-y-6">
        <div data-testid="vessel-detail-live-map">
          <MarineTrackMap
            :vessels="[liveVessel]"
            :passages="detail.passages"
            :waypoints="detail.waypoints"
            :installations="detail.installations"
            height-class="h-[32rem]"
            traffic-mode="auto"
          />
        </div>

        <UCard class="border-default/80 bg-default/90 shadow-card">
          <template #header>
            <div>
              <h2 class="font-display text-2xl text-default">Live vessel data</h2>
              <p class="mt-1 text-sm text-muted">
                Default bridge metrics for the current vessel feed, with wind, depth, temperatures, and power in one place.
              </p>
            </div>
          </template>

          <MarineSnapshotGrid :snapshot="liveSnapshot" />
        </UCard>

        <UCard class="border-default/80 bg-default/90 shadow-card">
          <template #header>
            <div class="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <h2 class="font-display text-2xl text-default">Recent route memory</h2>
                <p class="mt-1 text-sm text-muted">
                  The live view keeps a short route recap nearby, while the full passage log lives on its own page.
                </p>
              </div>

              <UButton
                :to="`/dashboard/vessels/${detail.vessel.slug}/passages`"
                color="neutral"
                variant="soft"
                icon="i-lucide-arrow-right"
              >
                Open passages
              </UButton>
            </div>
          </template>

          <PassageTimeline :passages="recentPassages" />
        </UCard>
      </div>

      <div class="space-y-6">
        <UCard class="border-default/80 bg-default/90 shadow-card">
          <template #header>
            <div>
              <h2 class="font-display text-2xl text-default">Live position</h2>
              <p class="mt-1 text-sm text-muted">
                Current fix, public route, and the freshest owner-facing position context.
              </p>
            </div>
          </template>

          <div class="space-y-4 text-sm text-muted">
            <div class="rounded-2xl border border-default bg-elevated/60 px-4 py-4">
              <p class="text-xs uppercase tracking-wide text-muted">Observed</p>
              <p class="mt-2 font-medium text-default">
                {{ formatRelativeTime(liveSnapshot?.observedAt) }}
              </p>
              <p class="mt-1 text-xs text-muted">
                {{ formatTimestamp(liveSnapshot?.observedAt) }}
              </p>
            </div>

            <div class="rounded-2xl border border-default bg-elevated/60 px-4 py-4">
              <p class="text-xs uppercase tracking-wide text-muted">Coordinates</p>
              <p class="mt-2 font-medium text-default">
                {{ formatCoordinate(liveSnapshot?.positionLat, true) }}
              </p>
              <p class="mt-1 font-medium text-default">
                {{ formatCoordinate(liveSnapshot?.positionLng, false) }}
              </p>
            </div>

            <div class="rounded-2xl border border-default bg-elevated/60 px-4 py-4">
              <p class="text-xs uppercase tracking-wide text-muted">Traffic source</p>
              <p class="mt-2 font-medium text-default">
                {{ primaryInstallation?.label || 'No live install linked yet' }}
              </p>
              <p class="mt-1 text-xs text-muted">
                {{
                  liveFeedSourceUrl ||
                  'Attach a live install to unlock AIS traffic and a persistent SignalK source.'
                }}
              </p>
              <p class="mt-2 text-xs text-muted">{{ liveFeedStatus }}</p>
            </div>

            <div class="rounded-2xl border border-default bg-elevated/60 px-4 py-4">
              <p class="text-xs uppercase tracking-wide text-muted">Public route</p>
              <p class="mt-2 font-medium text-default">{{ publicPath }}</p>
            </div>
          </div>
        </UCard>

        <UCard class="border-default/80 bg-default/90 shadow-card">
          <template #header>
            <div>
              <h2 class="font-display text-2xl text-default">Install posture</h2>
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
              <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div class="flex flex-wrap items-center gap-2">
                    <p class="font-medium text-default">{{ installation.label }}</p>
                    <UBadge v-if="installation.isPrimary" color="primary" variant="soft">
                      Primary
                    </UBadge>
                    <UBadge color="neutral" variant="subtle">
                      {{ installation.connectionState }}
                    </UBadge>
                  </div>
                  <p class="mt-2 text-sm text-muted">
                    {{
                      installation.edgeHostname ||
                      installation.collectorSignalKUrl ||
                      installation.relaySignalKUrl ||
                      installation.signalKUrl ||
                      'Connector details pending'
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
      </div>
    </div>

    <MediaStrip v-if="detail.media.length" :media="detail.media" />
  </div>
</template>
