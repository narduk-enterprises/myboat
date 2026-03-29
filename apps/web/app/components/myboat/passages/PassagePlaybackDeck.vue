<script setup lang="ts">
import type {
  AisContactSummary,
  PassageSummary,
  VesselCardSummary,
  WaypointSummary,
} from '~/types/myboat'
import {
  usePassagePlaybackBundle,
  usePassagePlaybackController,
  usePlaybackVessel,
} from '~/composables/usePassagePlayback'
import { formatTimestamp } from '~/utils/marine'
import { buildPassageDisplayRoute, buildPassageDisplayTitle } from '~/utils/passage-display'

const props = withDefaults(
  defineProps<{
    selectedPassage: PassageSummary | null
    mapPassages: PassageSummary[]
    vessel: VesselCardSummary | null
    waypoints?: WaypointSummary[]
    mapPersistKey?: string | null
    accessScope?: 'auth' | 'public'
    publicUsername?: string | null
    publicVesselSlug?: string | null
  }>(),
  {
    waypoints: () => [],
    mapPersistKey: null,
    accessScope: 'auth',
    publicUsername: null,
    publicVesselSlug: null,
  },
)

const playbackScope = computed(() =>
  props.accessScope === 'public'
    ? {
        access: 'public' as const,
        username: props.publicUsername,
        vesselSlug: props.publicVesselSlug,
      }
    : {
        access: 'auth' as const,
      },
)

const selectedPassageId = computed(() =>
  props.selectedPassage?.playbackAvailable ? props.selectedPassage.id : null,
)

const {
  data: bundle,
  error,
  pending,
} = await usePassagePlaybackBundle(selectedPassageId, playbackScope)

const controller = usePassagePlaybackController(computed(() => bundle.value))
const aisContacts = controller.aisContacts
const playbackEvents = controller.events
const isPlaying = controller.isPlaying
const nearbyTraffic = controller.nearbyTraffic
const playbackRate = controller.playbackRate
const playbackRateOptions = controller.playbackRateOptions

const stagePassages = computed(() => props.mapPassages)
const mapVessel = computed(() => usePlaybackVessel(props.vessel, controller.playbackSnapshot.value))
const playbackMetrics = computed(() => controller.metrics.value)
const selectedTitle = computed(() => buildPassageDisplayTitle(props.selectedPassage))
const selectedRoute = computed(() => {
  return props.selectedPassage
    ? buildPassageDisplayRoute(props.selectedPassage)
    : 'Select a passage from the rail to focus playback.'
})
const selectedEndedAt = computed(
  () => props.selectedPassage?.endedAt || props.selectedPassage?.startedAt || null,
)

const sliderValue = computed({
  get: () => Math.round(controller.progressRatio.value * 1000),
  set: (value: number) => {
    controller.seekToRatio(value / 1000)
  },
})

const metricCards = computed(() => {
  const metrics = playbackMetrics.value
  if (!metrics) {
    return []
  }

  return [
    {
      label: 'SOG',
      value: metrics.sog != null ? `${metrics.sog.toFixed(1)} kts` : '—',
      hint: 'Speed over ground at the current playback sample.',
    },
    {
      label: 'STW',
      value:
        metrics.speedThroughWater != null ? `${metrics.speedThroughWater.toFixed(1)} kts` : '—',
      hint: 'Speed through water when that channel is present in the bundle.',
    },
    {
      label: 'Wind',
      value: metrics.windTrueSpeedKts != null ? `${metrics.windTrueSpeedKts.toFixed(1)} kts` : '—',
      hint:
        metrics.windTrueDirectionDeg != null
          ? `${metrics.windTrueDirectionDeg.toFixed(0)}° true`
          : 'True wind at the current sample.',
    },
    {
      label: 'Remain',
      value: `${metrics.distanceRemainingNm.toFixed(1)} nm`,
      hint: 'Approximate remaining distance based on the stored playback path.',
    },
  ]
})

const trafficCount = computed(() => aisContacts.value.length)

function buildTrafficSummary(contact: AisContactSummary) {
  const parts = [
    contact.shipType != null ? `Type ${contact.shipType}` : null,
    contact.sog != null ? `${contact.sog.toFixed(1)} kts` : null,
  ].filter(Boolean)

  return parts.join(' · ') || 'No dynamic metadata stored for this target.'
}
</script>

<template>
  <UCard class="chart-surface rounded-[1.75rem] shadow-card" data-testid="passage-playback-deck">
    <template #header>
      <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p class="text-xs uppercase tracking-[0.22em] text-muted">Playback theater</p>
          <h2 class="mt-2 font-display text-2xl text-default">
            {{ selectedPassage ? selectedTitle : 'Stored route overview' }}
          </h2>
          <p class="mt-1 text-sm text-muted">{{ selectedRoute }}</p>
        </div>

        <div class="flex flex-wrap gap-2 text-xs">
          <UBadge v-if="selectedPassage?.playbackAvailable" color="primary" variant="soft">
            Playback ready
          </UBadge>
          <UBadge v-else-if="selectedPassage" color="neutral" variant="soft"> Track only </UBadge>
          <UBadge color="neutral" variant="soft">
            {{ trafficCount }} traffic contact{{ trafficCount === 1 ? '' : 's' }}
          </UBadge>
        </div>
      </div>
    </template>

    <div class="space-y-5">
      <div class="overflow-hidden rounded-[1.4rem] border border-default/70 bg-elevated/40">
        <MyBoatDetailedMap
          :vessel="mapVessel"
          :passages="stagePassages"
          :waypoints="[]"
          :ais-contacts="[]"
          :persist-key="mapPersistKey"
          :auto-fit-key="selectedPassage?.id || 'all-passages'"
          height-class="h-[24rem] sm:h-[30rem] lg:h-[36rem]"
          :show-focus-panel="false"
          :show-pin-labels="false"
          :show-stats-rail="false"
        />
      </div>

      <div
        v-if="!selectedPassage"
        class="rounded-[1.35rem] border border-default bg-elevated/60 p-4"
      >
        <p class="font-medium text-default">Select a playback-ready passage</p>
        <p class="mt-2 text-sm text-muted">
          The map is showing the full route archive. Pick a passage from the rail to zoom into that
          leg, load its replay, and scrub the timeline.
        </p>
      </div>

      <div
        v-else-if="!selectedPassage.playbackAvailable"
        class="rounded-[1.35rem] border border-default bg-elevated/60 p-4"
      >
        <p class="font-medium text-default">Playback bundle unavailable</p>
        <p class="mt-2 text-sm text-muted">
          This passage has stored geometry but no replay data yet, so the stage stays in static
          route-focus mode.
        </p>
      </div>

      <template v-else-if="pending">
        <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <USkeleton v-for="item in 4" :key="item" class="h-24 rounded-[1.2rem]" />
        </div>
        <USkeleton class="h-28 rounded-[1.35rem]" />
      </template>

      <UAlert
        v-else-if="error || !bundle"
        color="warning"
        variant="soft"
        title="Playback bundle unavailable"
        :description="
          error?.message ||
          'The selected passage has a playback flag, but the stored bundle could not be loaded.'
        "
      />

      <template v-else>
        <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div
            v-for="card in metricCards"
            :key="card.label"
            class="rounded-[1.2rem] border border-default bg-elevated/60 px-4 py-4"
          >
            <p class="text-xs uppercase tracking-[0.2em] text-muted">{{ card.label }}</p>
            <p class="mt-2 font-display text-2xl text-default">{{ card.value }}</p>
            <p class="mt-2 text-xs text-muted">{{ card.hint }}</p>
          </div>
        </div>

        <div class="rounded-[1.35rem] border border-default bg-elevated/60 p-4">
          <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p class="text-xs uppercase tracking-[0.2em] text-muted">Playback clock</p>
              <p class="mt-2 font-display text-2xl text-default">
                {{ playbackMetrics?.timestampLabel || formatTimestamp(selectedPassage.startedAt) }}
              </p>
              <p class="mt-1 text-sm text-muted">
                {{ playbackMetrics?.elapsedLabel || '0m 00s' }}
                <span class="mx-2 text-dimmed">·</span>
                {{ isPlaying ? 'Playing' : 'Paused' }}
              </p>
            </div>

            <div class="flex flex-wrap items-center gap-2">
              <UButton
                color="primary"
                :icon="isPlaying ? 'i-lucide-pause' : 'i-lucide-play'"
                @click="controller.togglePlayback"
              >
                {{ isPlaying ? 'Pause' : 'Play' }}
              </UButton>
              <UButton
                color="neutral"
                variant="soft"
                icon="i-lucide-rotate-ccw"
                @click="controller.resetPlayback"
              >
                Reset
              </UButton>

              <div class="inline-flex rounded-full border border-default/70 bg-default/80 p-1">
                <UButton
                  v-for="rate in playbackRateOptions"
                  :key="rate"
                  :color="playbackRate === rate ? 'primary' : 'neutral'"
                  :variant="playbackRate === rate ? 'soft' : 'ghost'"
                  size="xs"
                  @click="controller.setPlaybackRate(rate)"
                >
                  {{ rate }}x
                </UButton>
              </div>
            </div>
          </div>

          <div class="mt-4 space-y-3">
            <UInput
              v-model.number="sliderValue"
              data-testid="passage-playback-slider"
              class="w-full accent-primary"
              type="range"
              min="0"
              max="1000"
              step="1"
            />

            <div class="flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
              <span>{{ formatTimestamp(selectedPassage.startedAt) }}</span>
              <span>{{ formatTimestamp(selectedEndedAt) }}</span>
            </div>

            <div class="flex flex-wrap gap-2">
              <UButton
                v-for="event in playbackEvents"
                :key="event.id"
                color="neutral"
                variant="soft"
                size="xs"
                @click="controller.seekToEvent(event.ms)"
              >
                {{ event.shortLabel }}
              </UButton>
            </div>
          </div>
        </div>

        <div class="rounded-[1.35rem] border border-default bg-elevated/60 p-4">
          <p class="text-xs uppercase tracking-[0.2em] text-muted">Nearby traffic</p>
          <p class="mt-3 text-sm text-muted">
            {{ bundle.self.samples.length }} replay samples ·
            {{ bundle.traffic.vessels.length }} tracked traffic contacts
          </p>
          <div v-if="nearbyTraffic.length" class="mt-4 space-y-3">
            <div
              v-for="contact in nearbyTraffic"
              :key="contact.id"
              class="rounded-2xl border border-default/70 bg-default/70 px-3 py-3"
            >
              <p class="font-medium text-default">
                {{ contact.name || contact.mmsi || 'Traffic contact' }}
              </p>
              <p class="mt-1 text-xs text-muted">
                {{ buildTrafficSummary(contact) }}
              </p>
            </div>
          </div>

          <p v-else class="mt-4 text-sm text-muted">
            No nearby traffic sample aligns with the current playback position.
          </p>
        </div>
      </template>
    </div>
  </UCard>
</template>
