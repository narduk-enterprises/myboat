<script setup lang="ts">
import type {
  DashboardOverview,
  InstallationSummary,
  PassageSummary,
  VesselCardSummary,
  VesselSnapshotSummary,
} from '~/types/myboat'
import {
  formatCoordinate,
  formatRelativeTime,
  formatTimestamp,
  getConnectionTone,
} from '~/utils/marine'

const props = defineProps<{
  overview: DashboardOverview
}>()

const {
  convertAngle,
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

const primaryVessel = computed<VesselCardSummary | null>(
  () =>
    props.overview.vessels.find((vessel) => vessel.isPrimary) || props.overview.vessels[0] || null,
)
const primaryInstallation = computed<InstallationSummary | null>(
  () =>
    props.overview.installations.find(
      (installation) => installation.vesselId === primaryVessel.value?.id && installation.isPrimary,
    ) ||
    props.overview.installations.find(
      (installation) => installation.vesselId === primaryVessel.value?.id,
    ) ||
    props.overview.installations[0] ||
    null,
)
const primarySnapshot = computed<VesselSnapshotSummary | null>(
  () => primaryVessel.value?.liveSnapshot ?? null,
)
const latestPassage = computed<PassageSummary | null>(
  () => primaryVessel.value?.latestPassage || props.overview.recentPassages[0] || null,
)
const hasMapFix = computed(
  () =>
    primarySnapshot.value?.positionLat !== null &&
    primarySnapshot.value?.positionLat !== undefined &&
    primarySnapshot.value?.positionLng !== null &&
    primarySnapshot.value?.positionLng !== undefined,
)
const publicProfilePath = computed(() =>
  props.overview.profile ? `/${props.overview.profile.username}` : null,
)
const vesselDetailPath = computed(() =>
  primaryVessel.value ? `/dashboard/vessels/${primaryVessel.value.slug}` : null,
)
const installationDetailPath = computed(() =>
  primaryInstallation.value ? `/dashboard/installations/${primaryInstallation.value.id}` : null,
)
const sourceBadgeTone = computed(() =>
  getConnectionTone(
    primaryInstallation.value?.connectionState || 'idle',
    primaryInstallation.value?.lastSeenAt,
  ),
)
const currentFixLatitude = computed(() =>
  hasMapFix.value ? formatCoordinate(primarySnapshot.value?.positionLat ?? null, true) : 'No live fix yet',
)
const currentFixLongitude = computed(() =>
  hasMapFix.value ? formatCoordinate(primarySnapshot.value?.positionLng ?? null, false) : null,
)
const currentFixObservedLabel = computed(() =>
  primarySnapshot.value?.observedAt
    ? `Observed ${formatRelativeTime(primarySnapshot.value.observedAt)}`
    : 'Waiting for the first position update.',
)
const nextAction = computed(() => {
  if (!props.overview.profile) {
    return {
      description:
        'Finish captain identity, vessel setup, and the first live-data source so the dashboard can anchor to one real boat.',
      label: 'Finish setup',
      title: 'Captain setup is still incomplete',
      to: '/dashboard/onboarding',
      tone: 'warning' as const,
    }
  }

  if (!primaryVessel.value) {
    return {
      description: 'Add the first vessel so live telemetry, sharing, and buddy-boat context have a clear home.',
      label: 'Add vessel',
      title: 'The dashboard still needs a vessel',
      to: '/dashboard/onboarding',
      tone: 'warning' as const,
    }
  }

  if (!primaryInstallation.value) {
    return {
      description: 'Link a live-data source so the vessel can publish position, AIS context, and bridge metrics.',
      label: 'Open settings',
      title: 'No live-data source is linked yet',
      to: '/dashboard/settings',
      tone: 'warning' as const,
    }
  }

  if (!primarySnapshot.value?.observedAt) {
    return {
      description: 'The vessel and source are saved, but telemetry has not landed yet. Check the source and start sending data.',
      label: installationDetailPath.value ? 'Open live source' : 'Open settings',
      title: 'Waiting for the first live fix',
      to: installationDetailPath.value || '/dashboard/settings',
      tone: 'warning' as const,
    }
  }

  return {
    description: 'The primary vessel is reporting. Use the live map for AIS traffic, selected-contact detail, and issue context.',
    label: 'Open live map',
    title: 'The operator board is live',
    to: '/dashboard/map',
    tone: 'success' as const,
  }
})

const summaryCards = computed(() => [
  {
    hint:
      [primaryVessel.value?.vesselType, primaryVessel.value?.homePort].filter(Boolean).join(' · ') ||
      'Add the vessel type and home port when ready.',
    icon: 'i-lucide-ship',
    label: 'Primary vessel',
    value: primaryVessel.value?.name || 'Pending',
  },
  {
    hint:
      primaryInstallation.value?.lastSeenAt
        ? `Last seen ${formatRelativeTime(primaryInstallation.value.lastSeenAt)}`
        : 'No live source reporting yet.',
    icon: 'i-lucide-radio',
    label: 'Live source',
    value: primaryInstallation.value?.label || 'Pending',
  },
  {
    hint: props.overview.profile?.headline || 'Claim the public handle when you are ready to share.',
    icon: 'i-lucide-share-2',
    label: 'Public profile',
    value: props.overview.profile ? `@${props.overview.profile.username}` : 'Pending',
  },
  {
    hint: props.overview.followedVessels.length ? 'Saved buddy boats for the captain surface.' : 'No buddy boats saved yet.',
    icon: 'i-lucide-users',
    label: 'Buddy Boats',
    value: String(props.overview.followedVessels.length),
  },
])

const liveMetrics = computed(() => {
  const snapshot = primarySnapshot.value

  if (!snapshot) {
    return []
  }

  return [
    {
      hint: formatTimestamp(snapshot.observedAt),
      icon: 'i-lucide-clock-3',
      label: 'Observed',
      unit: '',
      value: snapshot.observedAt ? formatRelativeTime(snapshot.observedAt) : null,
    },
    {
      hint: 'Speed over ground from the active feed.',
      icon: 'i-lucide-gauge',
      label: 'Speed over ground',
      unit: speedUnitLabel.value,
      value: toRoundedText(convertSpeed(snapshot.speedOverGround)),
    },
    {
      hint: 'Magnetic heading from the latest snapshot.',
      icon: 'i-lucide-compass',
      label: 'Heading',
      unit: '°',
      value: toRoundedText(convertAngle(snapshot.headingMagnetic), 0),
    },
    {
      hint: 'Apparent wind speed from the current feed.',
      icon: 'i-lucide-wind',
      label: 'Apparent wind',
      unit: speedUnitLabel.value,
      value: toRoundedText(convertSpeed(snapshot.windSpeedApparent)),
    },
    {
      hint: 'Current sounding at the transducer.',
      icon: 'i-lucide-waves',
      label: 'Depth',
      unit: depthUnitLabel.value,
      value: toRoundedText(convertDepth(snapshot.depthBelowTransducer)),
    },
    {
      hint: 'House or starter battery from the latest snapshot.',
      icon: 'i-lucide-battery-medium',
      label: 'Battery',
      unit: 'V',
      value: toRoundedText(snapshot.batteryVoltage),
    },
  ].map((metric) => ({
    ...metric,
    value: metric.value || '--',
  }))
})
</script>

<template>
  <div class="space-y-8">
    <section class="chart-surface-strong rounded-[2rem] px-6 py-8 sm:px-8">
      <div class="relative z-10 grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
        <div class="space-y-5">
          <div class="marine-kicker w-fit">Captain workspace</div>

          <div>
            <h1 class="font-display text-4xl tracking-tight text-default sm:text-5xl">
              {{
                props.overview.profile
                  ? `Ready watch for ${props.overview.profile.captainName}`
                  : 'Bring the first vessel online'
              }}
            </h1>
            <p class="mt-3 max-w-3xl text-base text-muted sm:text-lg">
              {{
                props.overview.profile
                  ? 'One captain, one primary vessel, and one calm operational board for the live data that matters right now.'
                  : 'MyBoat launches around a single captain and vessel pair. Finish setup once, then run the boat from the dashboard.'
              }}
            </p>
          </div>

          <div class="flex flex-wrap gap-2">
            <UBadge v-if="props.overview.profile" color="primary" variant="soft">
              @{{ props.overview.profile.username }}
            </UBadge>
            <UBadge :color="sourceBadgeTone" variant="soft">
              {{ primaryInstallation?.connectionState || 'setup pending' }}
            </UBadge>
            <UBadge v-if="primaryVessel" color="neutral" variant="soft">
              {{ primaryVessel.name }}
            </UBadge>
          </div>

          <div class="flex flex-wrap gap-3">
            <UButton :to="nextAction.to" :color="nextAction.tone === 'success' ? 'primary' : 'warning'">
              {{ nextAction.label }}
            </UButton>
            <UButton to="/dashboard/settings" color="neutral" variant="soft" icon="i-lucide-sliders-horizontal">
              Settings
            </UButton>
            <UButton
              v-if="publicProfilePath"
              :to="publicProfilePath"
              color="neutral"
              variant="soft"
              icon="i-lucide-share-2"
            >
              Public profile
            </UButton>
          </div>
        </div>

        <div class="grid self-start gap-3 sm:grid-cols-2">
          <div
            v-for="card in summaryCards"
            :key="card.label"
            class="metric-shell rounded-[1.5rem] p-4 shadow-card"
          >
            <div class="flex items-start justify-between gap-3">
              <div>
                <p class="text-xs uppercase tracking-[0.24em] text-muted">{{ card.label }}</p>
                <p class="mt-2 font-display text-2xl text-default">{{ card.value }}</p>
                <p class="mt-2 text-xs text-muted">{{ card.hint }}</p>
              </div>
              <div class="flex size-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <UIcon :name="card.icon" class="size-5" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section class="grid gap-6 xl:grid-cols-[minmax(0,1.18fr)_minmax(19rem,0.82fr)]">
      <UCard class="border-default/80 bg-default/90 shadow-card">
        <template #header>
          <div class="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h2 class="font-display text-2xl text-default">Current location</h2>
              <p class="mt-1 text-sm text-muted">
                A compact chart for the active vessel. Use the live map for full AIS traffic and diagnostic depth.
              </p>
            </div>

            <UButton to="/dashboard/map" color="neutral" variant="soft" icon="i-lucide-expand">
              Open live map
            </UButton>
          </div>
        </template>

        <div v-if="primaryVessel && hasMapFix" data-testid="dashboard-current-location-map">
          <MarineTrackMap
            :vessels="[primaryVessel]"
            :passages="latestPassage ? [latestPassage] : []"
            :installations="primaryInstallation ? [primaryInstallation] : []"
            height-class="h-[17rem] sm:h-[20rem] lg:h-[22rem]"
            traffic-mode="off"
          />
        </div>

        <MarineEmptyState
          v-else
          icon="i-lucide-navigation"
          title="Current location is still quiet"
          description="Once the primary vessel reports a live fix, this compact chart becomes the fast read on position and route context."
          compact
        >
          <UButton :to="nextAction.to" :color="nextAction.tone === 'success' ? 'primary' : 'warning'">
            {{ nextAction.label }}
          </UButton>
        </MarineEmptyState>
      </UCard>

      <div class="space-y-6">
        <UCard class="border-default/80 bg-default/90 shadow-card">
          <template #header>
            <div>
              <h2 class="font-display text-2xl text-default">Current status</h2>
              <p class="mt-1 text-sm text-muted">The next operational move without the extra dashboard noise.</p>
            </div>
          </template>

          <div class="space-y-4 text-sm text-muted">
            <div class="rounded-2xl border border-default bg-elevated/60 px-4 py-4">
              <p class="text-xs uppercase tracking-wide text-muted">Next action</p>
              <p class="mt-2 font-medium text-default">{{ nextAction.title }}</p>
              <p class="mt-2">{{ nextAction.description }}</p>
            </div>

            <div class="rounded-2xl border border-default bg-elevated/60 px-4 py-4">
              <p class="text-xs uppercase tracking-wide text-muted">Current fix</p>
              <p class="mt-2 font-medium text-default">{{ currentFixLatitude }}</p>
              <p v-if="currentFixLongitude" class="mt-1 font-medium text-default">
                {{ currentFixLongitude }}
              </p>
              <p class="mt-2 text-xs text-muted">{{ currentFixObservedLabel }}</p>
            </div>

            <div class="rounded-2xl border border-default bg-elevated/60 px-4 py-4">
              <p class="text-xs uppercase tracking-wide text-muted">Source posture</p>
              <p class="mt-2 font-medium text-default">
                {{ primaryInstallation?.label || 'Source pending' }}
              </p>
              <p class="mt-1 text-xs text-muted">
                {{
                  primaryInstallation?.lastSeenAt
                    ? `Last seen ${formatRelativeTime(primaryInstallation.lastSeenAt)}`
                    : 'No live-data source heartbeat yet.'
                }}
              </p>
            </div>

            <div class="rounded-2xl border border-default bg-elevated/60 px-4 py-4">
              <p class="text-xs uppercase tracking-wide text-muted">Route memory</p>
              <p class="mt-2 font-medium text-default">
                {{ latestPassage?.title || 'No passage logged yet' }}
              </p>
              <p class="mt-1 text-xs text-muted">
                {{
                  latestPassage
                    ? `${latestPassage.departureName || 'Departure'} → ${latestPassage.arrivalName || 'Arrival pending'}`
                    : 'The live board stays sparse until the vessel starts building passage history.'
                }}
              </p>
            </div>
          </div>
        </UCard>

        <UCard v-if="vesselDetailPath" class="border-default/80 bg-default/90 shadow-card">
          <template #header>
            <div>
              <h2 class="font-display text-2xl text-default">Context links</h2>
              <p class="mt-1 text-sm text-muted">Legacy detail pages stay reachable without competing for primary navigation.</p>
            </div>
          </template>

          <div class="flex flex-wrap gap-3">
            <UButton :to="vesselDetailPath" color="neutral" variant="soft" icon="i-lucide-ship">
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
            <UButton to="/dashboard/fleet-friends" color="neutral" variant="soft" icon="i-lucide-users">
              Buddy Boats
            </UButton>
          </div>
        </UCard>
      </div>
    </section>

    <section>
      <div class="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 class="font-display text-3xl text-default">Live data board</h2>
          <p class="mt-1 text-sm text-muted">
            Core bridge signals only. The deeper chart and AIS workload stay on the dedicated live map route.
          </p>
        </div>
      </div>

      <div v-if="liveMetrics.length" class="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <MarineMetricCard
          v-for="metric in liveMetrics"
          :key="metric.label"
          :label="metric.label"
          :value="metric.value"
          :unit="metric.unit"
          :hint="metric.hint"
          :icon="metric.icon"
        />
      </div>

      <MarineEmptyState
        v-else
        class="mt-5"
        icon="i-lucide-radio"
        title="No live data yet"
        description="Finish setup and start the live-data source to turn this board into the captain's fast operational read."
      >
        <UButton :to="nextAction.to" :color="nextAction.tone === 'success' ? 'primary' : 'warning'">
          {{ nextAction.label }}
        </UButton>
      </MarineEmptyState>

      <UAlert
        v-if="primarySnapshot?.statusNote"
        class="mt-5 rounded-[1.5rem]"
        color="primary"
        variant="soft"
        icon="i-lucide-message-square-text"
        :description="primarySnapshot.statusNote"
      />
    </section>
  </div>
</template>
