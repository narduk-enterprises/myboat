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
const store = useMyBoatVesselStore()
const trafficEnabled = ref(true)
const entry = computed(() => store.getAuthEntryBySlug(props.detail.vessel.slug))
const rawAisContacts = computed(() => store.serializeAisContacts(entry.value))
const trafficDetailBasePath = computed(() => `/dashboard/vessels/${props.detail.vessel.slug}/traffic`)
const { contacts: enrichedAisContacts } = useAuthEnrichedTrafficContacts(
  computed(() => props.detail.vessel.slug),
  rawAisContacts,
)
useMyBoatLiveDemand({
  namespace: 'auth',
  consumerId: 'dashboard-vessel-live',
  demand: computed(() => ({
    selfLevel: 'detail',
    ais: trafficEnabled.value,
  })),
})

const primaryInstallation = computed<InstallationSummary | null>(
  () =>
    props.detail.installations.find((installation) => installation.isPrimary) ||
    props.detail.installations[0] ||
    null,
)
const recentPassages = computed(() => props.detail.passages.slice(0, 3))
const publicPath = computed(() => `/${props.detail.profile.username}/${props.detail.vessel.slug}`)
const liveSnapshot = computed<VesselSnapshotSummary | null>(
  () => entry.value?.mergedSnapshot || props.detail.vessel.liveSnapshot || null,
)
const liveVessel = computed(() => entry.value?.vessel || props.detail.vessel)
const observedIdentity = computed(
  () => liveVessel.value?.observedIdentity || primaryInstallation.value?.observedIdentity || null,
)
const observedDimensions = computed(() => {
  if (!observedIdentity.value) {
    return 'Dimensions pending'
  }

  const segments = [
    observedIdentity.value.lengthOverall
      ? `LOA ${observedIdentity.value.lengthOverall.toFixed(1)} m`
      : null,
    observedIdentity.value.beam ? `Beam ${observedIdentity.value.beam.toFixed(1)} m` : null,
    observedIdentity.value.draft ? `Draft ${observedIdentity.value.draft.toFixed(1)} m` : null,
  ].filter(Boolean)

  return segments.join(' · ') || 'Dimensions pending'
})
const liveFeedSourceUrl = computed(
  () => entry.value?.live.activeUrl || primaryInstallation.value?.edgeHostname || null,
)
const liveFeedStatus = computed(() => {
  switch (entry.value?.live.connectionState) {
    case 'connected':
      return entry.value?.live.lastDeltaAt
        ? `Live feed connected · updated ${formatRelativeTime(new Date(entry.value.live.lastDeltaAt).toISOString())}`
        : 'Live feed connected'
    case 'connecting':
      return 'Connecting to the MyBoat collector feed'
    case 'error':
      return 'Live feed unavailable'
    default:
      return entry.value?.live.hasSignalKSource
        ? 'Live feed standing by'
        : 'No live collector feed linked'
  }
})
</script>

<template>
  <div class="space-y-5 sm:space-y-6">
    <div class="grid gap-5 xl:grid-cols-[1.18fr_0.82fr] xl:gap-6">
      <div class="space-y-5 sm:space-y-6">
        <div data-testid="vessel-detail-live-map">
          <MyBoatCurrentLocationMap
            :vessel="liveVessel"
            :installations="detail.installations"
            :ais-contacts="enrichedAisContacts"
            :has-signal-k-source="entry?.live.hasSignalKSource"
            :traffic-detail-base-path="trafficDetailBasePath"
            v-model:traffic-enabled="trafficEnabled"
            height-class="h-[18rem] sm:h-[24rem] lg:h-[32rem]"
          />
        </div>

        <UCard class="border-default/80 bg-default/90 shadow-card">
          <template #header>
            <div>
              <h2 class="font-display text-xl text-default sm:text-2xl">Live data board</h2>
              <p class="mt-1 text-sm text-muted">
                Dense bridge metrics for the current vessel feed, with live fix, wind, depth,
                temperatures, and power in one place.
              </p>
            </div>
          </template>

          <MarineSnapshotGrid :snapshot="liveSnapshot" />
        </UCard>

        <UCard class="border-default/80 bg-default/90 shadow-card">
          <template #header>
            <div class="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <h2 class="font-display text-xl text-default sm:text-2xl">Recent route memory</h2>
                <p class="mt-1 text-sm text-muted">
                  The live view keeps a short route recap nearby, while the full passage log lives
                  on its own page.
                </p>
              </div>

              <UButton
                :to="`/dashboard/vessels/${detail.vessel.slug}/passages`"
                color="neutral"
                variant="soft"
                icon="i-lucide-arrow-right"
                class="w-full justify-center sm:w-auto"
              >
                Open passages
              </UButton>
            </div>
          </template>

          <PassageTimeline :passages="recentPassages" />
        </UCard>
      </div>

      <div class="space-y-5 sm:space-y-6">
        <UCard class="border-default/80 bg-default/90 shadow-card">
          <template #header>
            <div>
              <h2 class="font-display text-xl text-default sm:text-2xl">Observed identity</h2>
              <p class="mt-1 text-sm text-muted">
                Source-derived vessel identity from the current primary collector path.
              </p>
            </div>
          </template>

          <div class="space-y-4 text-sm text-muted">
            <div class="rounded-2xl border border-default bg-elevated/60 px-4 py-4">
              <p class="text-xs uppercase tracking-wide text-muted">MMSI</p>
              <p class="mt-2 font-medium text-default">{{ observedIdentity?.mmsi || 'Pending' }}</p>
              <p class="mt-1 text-xs text-muted">
                {{
                  observedIdentity?.observedAt
                    ? `Observed ${formatRelativeTime(observedIdentity.observedAt)}`
                    : 'No observed identity reported yet.'
                }}
              </p>
            </div>

            <div class="rounded-2xl border border-default bg-elevated/60 px-4 py-4">
              <p class="text-xs uppercase tracking-wide text-muted">Observed name / callsign</p>
              <p class="mt-2 font-medium text-default">
                {{ observedIdentity?.observedName || 'Pending' }}
              </p>
              <p class="mt-1 text-xs text-muted">
                {{
                  [observedIdentity?.callSign, observedIdentity?.shipType]
                    .filter(Boolean)
                    .join(' · ') || 'Callsign and ship type are pending.'
                }}
              </p>
            </div>

            <div class="rounded-2xl border border-default bg-elevated/60 px-4 py-4">
              <p class="text-xs uppercase tracking-wide text-muted">Dimensions</p>
              <p class="mt-2 font-medium text-default">{{ observedDimensions }}</p>
              <p class="mt-1 text-xs text-muted">
                {{ observedIdentity?.selfContext || 'Waiting for collector self context.' }}
              </p>
            </div>
          </div>
        </UCard>

        <UCard class="border-default/80 bg-default/90 shadow-card">
          <template #header>
            <div>
              <h2 class="font-display text-xl text-default sm:text-2xl">Live position</h2>
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
                  'Attach a collector install to unlock AIS traffic and the MyBoat live stream.'
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
              <h2 class="font-display text-xl text-default sm:text-2xl">Install posture</h2>
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
                    {{ installation.edgeHostname || 'Connector details pending' }}
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
                  class="w-full justify-center sm:w-auto"
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
