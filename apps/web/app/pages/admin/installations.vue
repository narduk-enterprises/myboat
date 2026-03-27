<script setup lang="ts">
import { formatRelativeTime, getConnectionTone } from '~/utils/marine'
import type { AuthUser } from '~/composables/useAuthApi'

definePageMeta({ layout: 'admin', middleware: ['auth'] })

useSeo({
  title: 'Admin installations',
  description: 'Operator installation and connector overview for MyBoat.',
  robots: 'noindex, nofollow',
})

useWebPageSchema({
  name: 'Admin installations',
  description: 'Operator installation and connector overview for MyBoat.',
})

const session = useUserSession()
const currentUser = computed(() => session.user.value as AuthUser | null)
const { data } = await useDashboardOverview('myboat-admin-installations')

const overview = computed(() => data.value)
const primaryVesselName = computed(() => overview.value?.vessels.find((vessel) => vessel.isPrimary)?.name || 'Pending')
const publicVesselCount = computed(() => overview.value?.vessels.filter((vessel) => vessel.sharePublic).length || 0)

watchEffect(() => {
  if (session.loggedIn.value && currentUser.value && !currentUser.value.isAdmin) {
    void navigateTo('/dashboard', { replace: true })
  }
})
</script>

<template>
  <div v-if="overview" class="space-y-8">
    <UPageHero
      title="Installations"
      description="Review onboard collectors, SignalK endpoints, and current connection state."
    >
      <template #links>
        <UButton to="/admin" color="neutral" variant="soft" icon="i-lucide-arrow-left">
          Back to admin
        </UButton>
      </template>
    </UPageHero>

    <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <MarineMetricCard
        label="Installations"
        :value="String(overview.stats.installationCount)"
        icon="i-lucide-cpu"
      />
      <MarineMetricCard
        label="Live installs"
        :value="String(overview.stats.liveInstallationCount)"
        icon="i-lucide-radio"
      />
      <MarineMetricCard
        label="Primary vessel"
        :value="primaryVesselName"
        icon="i-lucide-ship"
      />
      <MarineMetricCard
        label="Public vessels"
        :value="String(publicVesselCount)"
        icon="i-lucide-share-2"
      />
    </div>

    <section class="space-y-4">
      <div class="grid gap-4 lg:grid-cols-2">
        <div
          v-for="installation in overview.installations"
          :key="installation.id"
          class="rounded-[1.5rem] border border-default bg-elevated/70 p-5 shadow-card"
        >
          <div class="flex items-start justify-between gap-4">
            <div>
              <p class="font-display text-xl text-default">{{ installation.label }}</p>
              <p class="mt-1 text-sm text-muted">
                {{ installation.vesselName }} · {{ installation.edgeHostname || 'Hostname pending' }}
              </p>
            </div>
            <UBadge :color="getConnectionTone(installation.connectionState, installation.lastSeenAt)">
              {{ installation.connectionState }}
            </UBadge>
          </div>

          <div class="mt-4 grid gap-3 sm:grid-cols-2">
            <div class="rounded-2xl border border-default bg-default/80 px-4 py-3">
              <p class="text-xs uppercase tracking-[0.24em] text-muted">SignalK</p>
              <p class="mt-2 break-all text-sm text-default">{{ installation.signalKUrl || 'Pending' }}</p>
            </div>
            <div class="rounded-2xl border border-default bg-default/80 px-4 py-3">
              <p class="text-xs uppercase tracking-[0.24em] text-muted">Events</p>
              <p class="mt-2 text-sm text-default">{{ installation.eventCount }}</p>
            </div>
          </div>

          <p class="mt-3 text-xs text-muted">
            {{
              installation.lastSeenAt
                ? `Last seen ${formatRelativeTime(installation.lastSeenAt)}`
                : 'No telemetry observed yet'
            }}
          </p>
        </div>
      </div>
    </section>
  </div>
</template>
