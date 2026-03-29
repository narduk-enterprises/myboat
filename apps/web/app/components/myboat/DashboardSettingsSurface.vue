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
const setupIncomplete = computed(
  () => !props.overview.profile || !primaryVessel.value || !primaryInstallation.value,
)
</script>

<template>
  <div class="space-y-8">
    <section class="chart-surface-strong rounded-[2rem] px-6 py-8 sm:px-8">
      <div class="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div class="space-y-4">
          <div class="marine-kicker w-fit">Captain settings</div>
          <div>
            <h1 class="font-display text-4xl tracking-tight text-default sm:text-5xl">
              One place for captain, vessel, and live-feed decisions
            </h1>
            <p class="mt-3 max-w-3xl text-base leading-7 text-muted">
              This is the canonical settings destination. The older settings subpages stay available
              as contextual editors, but the dashboard should point here first.
            </p>
          </div>
        </div>

        <div class="flex flex-wrap gap-3">
          <UButton to="/dashboard" color="neutral" variant="soft" icon="i-lucide-arrow-left">
            Dashboard
          </UButton>
          <UButton to="/dashboard/map" color="neutral" variant="soft" icon="i-lucide-map">
            Live map
          </UButton>
          <UButton
            v-if="publicProfilePath"
            :to="publicProfilePath"
            color="primary"
            icon="i-lucide-share-2"
          >
            Public profile
          </UButton>
        </div>
      </div>
    </section>

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
            <UButton to="/dashboard/settings/sharing" color="primary" icon="i-lucide-broadcast">
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
