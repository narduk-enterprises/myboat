<script setup lang="ts">
import type { DashboardOverview, InstallationSummary, VesselCardSummary } from '~/types/myboat'
import { formatRelativeTime } from '~/utils/marine'

const props = defineProps<{
  overview: DashboardOverview
}>()

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
const publicVesselCount = computed(
  () => props.overview.vessels.filter((vessel) => vessel.sharePublic).length,
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
const observedIdentity = computed(
  () =>
    primaryVessel.value?.observedIdentity || primaryInstallation.value?.observedIdentity || null,
)
const observedDimensions = computed(() => {
  if (!observedIdentity.value) {
    return 'Pending'
  }

  const segments = [
    observedIdentity.value.lengthOverall
      ? `LOA ${observedIdentity.value.lengthOverall.toFixed(1)} m`
      : null,
    observedIdentity.value.beam ? `Beam ${observedIdentity.value.beam.toFixed(1)} m` : null,
    observedIdentity.value.draft ? `Draft ${observedIdentity.value.draft.toFixed(1)} m` : null,
  ].filter(Boolean)

  return segments.join(' · ') || 'Dimensions not observed yet'
})
const setupIncomplete = computed(
  () => !props.overview.profile || !primaryVessel.value || !primaryInstallation.value,
)
const settingsContextCards = computed(() => [
  {
    label: 'Captain',
    value: props.overview.profile ? `@${props.overview.profile.username}` : 'Pending',
    note: props.overview.profile?.captainName || 'Finish the captain identity setup.',
  },
  {
    label: 'Primary vessel',
    value: primaryVessel.value?.name || 'Pending',
    note:
      [primaryVessel.value?.vesselType, primaryVessel.value?.homePort]
        .filter(Boolean)
        .join(' · ') || 'Complete the vessel profile and home port.',
  },
  {
    label: 'Live source',
    value: primaryInstallation.value?.label || 'Pending',
    note: primaryInstallation.value?.lastSeenAt
      ? `Last seen ${formatRelativeTime(primaryInstallation.value.lastSeenAt)}`
      : 'No source heartbeat observed yet.',
  },
  {
    label: 'Public posture',
    value: primaryVessel.value?.sharePublic ? 'Enabled' : 'Private',
    note: publicProfilePath.value
      ? 'Public profile route is available.'
      : 'Set up a public handle before sharing outward.',
  },
])
</script>

<template>
  <div class="space-y-8">
    <OperatorRouteMasthead
      eyebrow="Captain settings"
      title="Captain, vessel, and live-feed decisions"
      description="Use this control surface for the steady-state profile, source, sharing, and identity decisions that shape the captain workspace."
    >
      <template #actions>
        <UButton to="/dashboard" color="neutral" variant="soft" icon="i-lucide-arrow-left">
          Dashboard
        </UButton>
        <UButton to="/dashboard/map" color="neutral" variant="soft" icon="i-lucide-map">
          Live map
        </UButton>
        <UButton
          v-if="installationDetailPath"
          :to="installationDetailPath"
          color="primary"
          icon="i-lucide-cpu"
        >
          Open live source
        </UButton>
        <UButton v-else to="/dashboard/onboarding" color="primary" icon="i-lucide-anchor">
          Add live source
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
      </template>

      <template #meta>
        <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div
            v-for="card in settingsContextCards"
            :key="card.label"
            class="rounded-[1.15rem] border border-default/70 bg-elevated/70 px-4 py-3"
          >
            <p class="text-xs font-semibold uppercase tracking-[0.22em] text-muted">
              {{ card.label }}
            </p>
            <p class="mt-2 font-display text-lg text-default">{{ card.value }}</p>
            <p class="mt-1 text-xs text-muted">{{ card.note }}</p>
          </div>
        </div>
      </template>
    </OperatorRouteMasthead>

    <UAlert
      v-if="setupIncomplete"
      color="warning"
      variant="soft"
      title="Setup is still incomplete"
      description="Onboarding remains available as the temporary setup flow. Use it to finish captain, vessel, or source records, then return here for the steady-state control surface."
    >
      <template #actions>
        <UButton to="/dashboard/onboarding" color="warning" variant="soft" icon="i-lucide-anchor">
          Finish setup
        </UButton>
      </template>
    </UAlert>

    <section class="space-y-6">
      <UCard class="border-default/80 bg-default/90 shadow-card">
        <template #header>
          <div class="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h2 class="font-display text-2xl text-default">Route shortcuts</h2>
              <p class="mt-1 text-sm text-muted">
                Jump directly into the sections that change sharing, identity, and active-source
                posture.
              </p>
            </div>

            <div class="flex flex-wrap gap-2">
              <UButton
                to="/dashboard/settings/profile"
                color="neutral"
                variant="soft"
                icon="i-lucide-user-round"
              >
                Captain profile
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
              <UButton
                to="/dashboard/settings/sharing"
                color="neutral"
                variant="soft"
                icon="i-lucide-radio-tower"
              >
                Sharing
              </UButton>
            </div>
          </div>
        </template>

        <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div class="rounded-2xl border border-default bg-elevated/60 px-4 py-4">
            <p class="text-xs uppercase tracking-wide text-muted">Captain</p>
            <p class="mt-2 font-medium text-default">
              {{ props.overview.profile?.captainName || 'Pending' }}
            </p>
            <p class="mt-1 text-xs text-muted">
              {{
                props.overview.profile
                  ? `@${props.overview.profile.username}`
                  : 'Handle not claimed yet.'
              }}
            </p>
          </div>

          <div class="rounded-2xl border border-default bg-elevated/60 px-4 py-4">
            <p class="text-xs uppercase tracking-wide text-muted">Vessel</p>
            <p class="mt-2 font-medium text-default">{{ primaryVessel?.name || 'Pending' }}</p>
            <p class="mt-1 text-xs text-muted">
              {{
                [primaryVessel?.vesselType, primaryVessel?.homePort].filter(Boolean).join(' · ') ||
                'Primary vessel context appears here after setup.'
              }}
            </p>
          </div>

          <div class="rounded-2xl border border-default bg-elevated/60 px-4 py-4">
            <p class="text-xs uppercase tracking-wide text-muted">Observed identity</p>
            <p class="mt-2 font-medium text-default">{{ observedIdentity?.mmsi || 'Pending' }}</p>
            <p class="mt-1 text-xs text-muted">
              {{
                observedIdentity?.observedAt
                  ? `Observed ${formatRelativeTime(observedIdentity.observedAt)}`
                  : 'Waiting for collector identity discovery.'
              }}
            </p>
          </div>

          <div class="rounded-2xl border border-default bg-elevated/60 px-4 py-4">
            <p class="text-xs uppercase tracking-wide text-muted">Sharing</p>
            <p class="mt-2 font-medium text-default">
              {{ primaryVessel?.sharePublic ? 'Public vessel enabled' : 'Private by default' }}
            </p>
            <p class="mt-1 text-xs text-muted">
              {{ props.overview.followedVessels.length }}
              buddy boat{{ props.overview.followedVessels.length === 1 ? '' : 's' }} saved.
            </p>
          </div>
        </div>
      </UCard>

      <UCard class="border-default/80 bg-default/90 shadow-card">
        <template #header>
          <div>
            <h2 class="font-display text-2xl text-default">Captain profile</h2>
            <p class="mt-1 text-sm text-muted">
              Public identity, handle, and shareable captain copy.
            </p>
          </div>
        </template>

        <div class="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
          <div class="grid gap-3 sm:grid-cols-2">
            <div class="rounded-2xl border border-default bg-elevated/60 px-4 py-4">
              <p class="text-xs uppercase tracking-wide text-muted">Captain name</p>
              <p class="mt-2 font-medium text-default">
                {{ props.overview.profile?.captainName || 'Pending' }}
              </p>
            </div>
            <div class="rounded-2xl border border-default bg-elevated/60 px-4 py-4">
              <p class="text-xs uppercase tracking-wide text-muted">Public handle</p>
              <p class="mt-2 font-medium text-default">
                {{ props.overview.profile ? `@${props.overview.profile.username}` : 'Pending' }}
              </p>
            </div>
          </div>

          <div class="flex flex-wrap gap-3">
            <UButton to="/dashboard/settings/profile" color="primary" icon="i-lucide-user-round">
              Edit captain profile
            </UButton>
            <UButton
              v-if="publicProfilePath"
              :to="publicProfilePath"
              color="neutral"
              variant="soft"
              icon="i-lucide-share-2"
            >
              Open public profile
            </UButton>
          </div>
        </div>
      </UCard>

      <UCard class="border-default/80 bg-default/90 shadow-card">
        <template #header>
          <div>
            <h2 class="font-display text-2xl text-default">Vessel profile</h2>
            <p class="mt-1 text-sm text-muted">
              Launch stays single-vessel, so this section is about the one boat the captain is
              actively operating.
            </p>
          </div>
        </template>

        <div class="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
          <div class="grid gap-3 sm:grid-cols-2">
            <div class="rounded-2xl border border-default bg-elevated/60 px-4 py-4">
              <p class="text-xs uppercase tracking-wide text-muted">Primary vessel</p>
              <p class="mt-2 font-medium text-default">{{ primaryVessel?.name || 'Pending' }}</p>
              <p class="mt-1 text-xs text-muted">
                {{
                  [primaryVessel?.vesselType, primaryVessel?.homePort]
                    .filter(Boolean)
                    .join(' · ') || 'Type and home port still need setup.'
                }}
              </p>
            </div>
            <div class="rounded-2xl border border-default bg-elevated/60 px-4 py-4">
              <p class="text-xs uppercase tracking-wide text-muted">Public sharing</p>
              <p class="mt-2 font-medium text-default">
                {{ primaryVessel?.sharePublic ? 'Enabled' : 'Private' }}
              </p>
              <p class="mt-1 text-xs text-muted">
                {{ publicVesselCount }} public vessel record(s).
              </p>
            </div>
          </div>

          <div class="flex flex-wrap gap-3">
            <UButton to="/dashboard/onboarding" color="primary" icon="i-lucide-anchor">
              Edit vessel profile
            </UButton>
            <UButton
              v-if="vesselDetailPath"
              :to="vesselDetailPath"
              color="neutral"
              variant="soft"
              icon="i-lucide-ship"
            >
              Vessel detail
            </UButton>
          </div>
        </div>
      </UCard>

      <UCard class="border-default/80 bg-default/90 shadow-card">
        <template #header>
          <div>
            <h2 class="font-display text-2xl text-default">Collector setup</h2>
            <p class="mt-1 text-sm text-muted">
              Installation is still part of the model, but this is where the captain should think
              about the active collector path.
            </p>
          </div>
        </template>

        <div class="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
          <div class="grid gap-3 sm:grid-cols-2">
            <div class="rounded-2xl border border-default bg-elevated/60 px-4 py-4">
              <p class="text-xs uppercase tracking-wide text-muted">Primary source</p>
              <p class="mt-2 font-medium text-default">
                {{ primaryInstallation?.label || 'Pending' }}
              </p>
              <p class="mt-1 text-xs text-muted">
                {{
                  primaryInstallation?.lastSeenAt
                    ? `Last seen ${formatRelativeTime(primaryInstallation.lastSeenAt)}`
                    : 'No source heartbeat observed yet.'
                }}
              </p>
            </div>
            <div class="rounded-2xl border border-default bg-elevated/60 px-4 py-4">
              <p class="text-xs uppercase tracking-wide text-muted">Connection state</p>
              <p class="mt-2 font-medium text-default">
                {{ primaryInstallation?.connectionState || 'setup pending' }}
              </p>
              <p class="mt-1 text-xs text-muted">
                {{
                  primaryInstallation?.edgeHostname || 'Local boat host still needs configuration.'
                }}
              </p>
            </div>
          </div>

          <div class="flex flex-wrap gap-3">
            <UButton
              v-if="installationDetailPath"
              :to="installationDetailPath"
              color="primary"
              icon="i-lucide-cpu"
            >
              Open live source
            </UButton>
            <UButton v-else to="/dashboard/onboarding" color="primary" icon="i-lucide-anchor">
              Add live source
            </UButton>
            <UButton to="/dashboard/map" color="neutral" variant="soft" icon="i-lucide-map">
              Open live map
            </UButton>
          </div>
        </div>
      </UCard>

      <UCard class="border-default/80 bg-default/90 shadow-card">
        <template #header>
          <div>
            <h2 class="font-display text-2xl text-default">Observed connection identity</h2>
            <p class="mt-1 text-sm text-muted">
              Source-derived vessel identity from the primary collector path. These values come from
              the MyBoat ingest boundary, not direct browser access to SignalK.
            </p>
          </div>
        </template>

        <div class="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
          <div class="grid gap-3 sm:grid-cols-2">
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
              <p class="text-xs uppercase tracking-wide text-muted">Observed name</p>
              <p class="mt-2 font-medium text-default">
                {{ observedIdentity?.observedName || 'Pending' }}
              </p>
              <p class="mt-1 text-xs text-muted">
                {{
                  [observedIdentity?.callSign, observedIdentity?.shipType]
                    .filter(Boolean)
                    .join(' · ') || 'Callsign and ship type are not observed yet.'
                }}
              </p>
            </div>

            <div class="rounded-2xl border border-default bg-elevated/60 px-4 py-4">
              <p class="text-xs uppercase tracking-wide text-muted">Dimensions</p>
              <p class="mt-2 font-medium text-default">{{ observedDimensions }}</p>
              <p class="mt-1 text-xs text-muted">
                {{
                  observedIdentity?.registrationNumber ||
                  observedIdentity?.imo ||
                  'No registration identifiers observed yet.'
                }}
              </p>
            </div>

            <div class="rounded-2xl border border-default bg-elevated/60 px-4 py-4">
              <p class="text-xs uppercase tracking-wide text-muted">Source context</p>
              <p class="mt-2 break-all font-medium text-default">
                {{ observedIdentity?.selfContext || 'Waiting for self context' }}
              </p>
              <p class="mt-1 text-xs text-muted">
                {{ primaryInstallation?.label || 'No collector install linked yet.' }}
              </p>
            </div>
          </div>

          <div class="flex flex-wrap gap-3">
            <UButton
              v-if="installationDetailPath"
              :to="installationDetailPath"
              color="primary"
              icon="i-lucide-cpu"
            >
              Open live source
            </UButton>
            <UButton
              v-if="vesselDetailPath"
              :to="vesselDetailPath"
              color="neutral"
              variant="soft"
              icon="i-lucide-ship"
            >
              Vessel detail
            </UButton>
          </div>
        </div>
      </UCard>

      <UCard class="border-default/80 bg-default/90 shadow-card">
        <template #header>
          <div>
            <h2 class="font-display text-2xl text-default">Sharing and Buddy Boats</h2>
            <p class="mt-1 text-sm text-muted">
              Public profile posture and the extra vessels that should show up around the captain
              story.
            </p>
          </div>
        </template>

        <div class="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
          <div class="grid gap-3 sm:grid-cols-2">
            <div class="rounded-2xl border border-default bg-elevated/60 px-4 py-4">
              <p class="text-xs uppercase tracking-wide text-muted">Public vessels</p>
              <p class="mt-2 font-medium text-default">{{ publicVesselCount }}</p>
              <p class="mt-1 text-xs text-muted">
                Captain-facing sharing posture for the launch vessel.
              </p>
            </div>
            <div class="rounded-2xl border border-default bg-elevated/60 px-4 py-4">
              <p class="text-xs uppercase tracking-wide text-muted">Buddy Boats</p>
              <p class="mt-2 font-medium text-default">
                {{ props.overview.followedVessels.length }}
              </p>
              <p class="mt-1 text-xs text-muted">
                Saved buddy boats tracked from the map-first workspace.
              </p>
            </div>
          </div>

          <div class="flex flex-wrap gap-3">
            <UButton to="/dashboard/settings/sharing" color="primary" icon="i-lucide-radio-tower">
              Open sharing
            </UButton>
            <UButton
              to="/dashboard/fleet-friends"
              color="neutral"
              variant="soft"
              icon="i-lucide-users"
            >
              Buddy Boats
            </UButton>
          </div>
        </div>
      </UCard>

      <UCard class="border-default/80 bg-default/90 shadow-card">
        <template #header>
          <div>
            <h2 class="font-display text-2xl text-default">Security and local preferences</h2>
            <p class="mt-1 text-sm text-muted">
              Account hardening and local display defaults stay reachable, but do not need to own
              the dashboard navigation.
            </p>
          </div>
        </template>

        <div class="grid gap-4 lg:grid-cols-2">
          <div class="rounded-2xl border border-default bg-elevated/60 px-4 py-4">
            <p class="text-xs uppercase tracking-wide text-muted">Security</p>
            <p class="mt-2 font-medium text-default">Password and MFA</p>
            <p class="mt-1 text-xs text-muted">
              Keep the captain account secure with password rotation and multi-factor auth.
            </p>
            <div class="mt-4">
              <UButton
                to="/dashboard/settings/security"
                color="primary"
                icon="i-lucide-shield-check"
              >
                Open security
              </UButton>
            </div>
          </div>

          <div class="rounded-2xl border border-default bg-elevated/60 px-4 py-4">
            <p class="text-xs uppercase tracking-wide text-muted">Preferences</p>
            <p class="mt-2 font-medium text-default">Units and display defaults</p>
            <p class="mt-1 text-xs text-muted">
              Speed, depth, and temperature preferences are local to this device and browser.
            </p>
            <div class="mt-4">
              <UButton
                to="/dashboard/settings/preferences"
                color="primary"
                icon="i-lucide-sliders-horizontal"
              >
                Open preferences
              </UButton>
            </div>
          </div>
        </div>
      </UCard>
    </section>
  </div>
</template>
