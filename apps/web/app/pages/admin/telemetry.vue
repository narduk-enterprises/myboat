<script setup lang="ts">
import { formatRelativeTime } from '~/utils/marine'
import type { AuthUser } from '~/composables/useAuthApi'

definePageMeta({ layout: 'admin', middleware: ['auth'] })

useSeo({
  title: 'Admin telemetry',
  description: 'Telemetry health and live-operational posture for MyBoat.',
  robots: 'noindex, nofollow',
})

useWebPageSchema({
  name: 'Admin telemetry',
  description: 'Telemetry health and live-operational posture for MyBoat.',
})

const session = useUserSession()
const currentUser = computed(() => session.user.value as AuthUser | null)
const { data } = await useDashboardOverview('myboat-admin-telemetry')

const overview = computed(() => data.value)
const primaryVessel = computed(
  () =>
    overview.value?.vessels.find((vessel) => vessel.isPrimary) ||
    overview.value?.vessels[0] ||
    null,
)

watchEffect(() => {
  if (session.loggedIn.value && currentUser.value && !currentUser.value.isAdmin) {
    void navigateTo('/dashboard', { replace: true })
  }
})
</script>

<template>
  <div v-if="overview" class="space-y-8">
    <UPageHero
      title="Telemetry"
      description="Watch live installs, snapshot freshness, and the current operational posture."
    >
      <template #links>
        <UButton to="/admin" color="neutral" variant="soft" icon="i-lucide-arrow-left">
          Back to admin
        </UButton>
      </template>
    </UPageHero>

    <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <MarineMetricCard
        label="Live installs"
        :value="String(overview.stats.liveInstallationCount)"
        icon="i-lucide-radio"
      />
      <MarineMetricCard
        label="Latest passages"
        :value="String(overview.stats.passageCount)"
        icon="i-lucide-route"
      />
      <MarineMetricCard
        label="Media items"
        :value="String(overview.stats.mediaCount)"
        icon="i-lucide-camera"
      />
      <MarineMetricCard
        label="Primary vessel"
        :value="primaryVessel?.name || 'Pending'"
        icon="i-lucide-ship"
      />
    </div>

    <div class="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
      <MarineSnapshotGrid :snapshot="primaryVessel?.liveSnapshot || null" />

      <UCard class="border-default/80 bg-default/90 shadow-card">
        <template #header>
          <div>
            <h2 class="font-display text-2xl text-default">Queue and replay</h2>
            <p class="mt-1 text-sm text-muted">
              The launch product keeps the operational queue and replay state visible, even before a
              dedicated admin feed exists.
            </p>
          </div>
        </template>

        <div class="space-y-4 text-sm text-muted">
          <p>Expected live freshness target: 5 to 15 seconds.</p>
          <p>Primary live source is captain-selected per vessel.</p>
          <p>Telemetry backfill should buffer and replay when installs reconnect.</p>
          <p>Queue/backlog health metrics are not yet wired to a dedicated backend surface.</p>
        </div>

        <div class="mt-5 rounded-2xl border border-dashed border-default/70 bg-muted/20 p-4">
          <p class="font-medium text-default">Most recent vessel observation</p>
          <p class="mt-2 text-sm text-muted">
            {{
              primaryVessel?.liveSnapshot?.observedAt
                ? `Observed ${formatRelativeTime(primaryVessel.liveSnapshot.observedAt)}`
                : 'No live telemetry observed yet'
            }}
          </p>
        </div>
      </UCard>
    </div>
  </div>
</template>
