<script setup lang="ts">
import { formatRelativeTime } from '~/utils/marine'
import type { AuthUser } from '~/composables/useAuthApi'

definePageMeta({ layout: 'admin', middleware: ['admin'] })

useSeo({
  title: 'Admin',
  description: 'Internal ops console for MyBoat.',
  robots: 'noindex, nofollow',
})

useWebPageSchema({
  name: 'Admin',
  description: 'Internal ops console for MyBoat.',
})

const toast = useToast()
const session = useUserSession()
const currentUser = computed(() => session.user.value as AuthUser | null)
const { data, pending } = await useDashboardOverview('myboat-admin-index')
const {
  data: syncData,
  pending: syncPending,
  refresh: refreshSyncStatus,
} = await useAdminAisHubSyncStatus()
const { runSync, pending: syncRunning } = useRunAdminAisHubSync()

const overview = computed(() => data.value)
const syncStatus = computed(() => syncData.value)
const syncBadgeColor = computed(() => {
  switch (syncStatus.value?.sync.lastStatus) {
    case 'success':
      return 'success'
    case 'running':
      return 'info'
    case 'error':
      return 'error'
    case 'skipped':
      return 'warning'
    default:
      return 'neutral'
  }
})
const syncLastSuccessLabel = computed(() =>
  syncStatus.value?.sync.lastSuccessAt
    ? formatRelativeTime(syncStatus.value.sync.lastSuccessAt)
    : 'No successful sync yet',
)
const syncLastRequestLabel = computed(() =>
  syncStatus.value?.lastRequestAt ? formatRelativeTime(syncStatus.value.lastRequestAt) : 'Never',
)

watchEffect(() => {
  if (session.loggedIn.value && currentUser.value && !currentUser.value.isAdmin) {
    void navigateTo('/dashboard', { replace: true })
  }
})

async function onRunAisHubSync() {
  try {
    syncData.value = await runSync()
    await refreshSyncStatus()
    toast.add({
      title: 'AIS Hub sync started',
      description: 'The rolling catalog refresh completed and the admin status has been updated.',
      color: 'success',
    })
  } catch (error) {
    toast.add({
      title: 'Unable to run AIS Hub sync',
      description: error instanceof Error ? error.message : 'Please try again.',
      color: 'error',
    })
  }
}
</script>

<template>
  <div class="space-y-8">
    <template v-if="pending">
      <USkeleton class="h-56 rounded-[2rem]" />
      <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <USkeleton v-for="item in 4" :key="item" class="h-32 rounded-[1.5rem]" />
      </div>
      <div class="grid gap-5 lg:grid-cols-2">
        <USkeleton v-for="item in 2" :key="item" class="h-72 rounded-[1.75rem]" />
      </div>
    </template>

    <template v-else-if="overview && currentUser?.isAdmin !== false">
      <UPageHero
        title="Admin"
        description="Internal operations console for captain accounts, vessels, installs, and telemetry health."
      >
        <template #links>
          <UButton to="/dashboard" color="neutral" variant="soft" icon="i-lucide-arrow-left">
            Back to dashboard
          </UButton>
        </template>
      </UPageHero>

      <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MarineMetricCard
          label="Captain accounts"
          :value="overview.profile ? '1' : '0'"
          icon="i-lucide-users"
          hint="Current owner identity in this workspace."
        />
        <MarineMetricCard
          label="Vessels"
          :value="String(overview.vessels.length)"
          icon="i-lucide-ship"
          hint="Public and private vessel records."
        />
        <MarineMetricCard
          label="Installations"
          :value="String(overview.installations.length)"
          icon="i-lucide-cpu"
          hint="Collector installs and telemetry endpoints."
        />
        <MarineMetricCard
          label="Live installs"
          :value="String(overview.stats.liveInstallationCount)"
          icon="i-lucide-radio"
          hint="Currently reporting telemetry."
        />
      </div>

      <section class="grid gap-5 lg:grid-cols-2">
        <UCard class="chart-surface rounded-[1.75rem] shadow-card">
          <template #header>
            <div>
              <h2 class="font-display text-2xl text-default">Operator areas</h2>
              <p class="mt-1 text-sm text-muted">
                Jump into the specific admin sections that matter during launch.
              </p>
            </div>
          </template>

          <div class="grid gap-4 sm:grid-cols-2">
            <UButton
              to="/admin/users"
              color="neutral"
              variant="soft"
              icon="i-lucide-user-cog"
              class="w-full"
            >
              Users
            </UButton>
            <UButton
              to="/admin/vessels"
              color="neutral"
              variant="soft"
              icon="i-lucide-ship"
              class="w-full"
            >
              Vessels
            </UButton>
            <UButton
              to="/admin/installations"
              color="neutral"
              variant="soft"
              icon="i-lucide-cpu"
              class="w-full"
            >
              Installations
            </UButton>
            <UButton
              to="/admin/telemetry"
              color="neutral"
              variant="soft"
              icon="i-lucide-radio-tower"
              class="w-full"
            >
              Telemetry
            </UButton>
          </div>
        </UCard>

        <UCard class="border-default/80 bg-default/90 shadow-card">
          <template #header>
            <div>
              <h2 class="font-display text-2xl text-default">Emergency controls</h2>
              <p class="mt-1 text-sm text-muted">Narrow operator actions for launch.</p>
            </div>
          </template>

          <div class="space-y-4">
            <div class="rounded-2xl border border-default bg-elevated/60 p-4">
              <div class="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div class="flex flex-wrap items-center gap-2">
                    <p class="font-medium text-default">AIS Hub catalog sync</p>
                    <UBadge :color="syncBadgeColor" variant="soft">
                      {{ syncStatus?.sync.lastStatus || 'idle' }}
                    </UBadge>
                  </div>
                  <p class="mt-1 text-sm text-muted">
                    Pull the rolling AIS Hub vessel catalog into the local database on demand.
                  </p>
                </div>

                <UButton
                  color="primary"
                  icon="i-lucide-refresh-cw"
                  :loading="syncRunning"
                  :disabled="syncPending || syncRunning"
                  @click="onRunAisHubSync"
                >
                  Run sync now
                </UButton>
              </div>

              <div class="mt-4 grid gap-3 text-sm text-muted md:grid-cols-2">
                <p>Catalog size: {{ syncStatus?.catalogSize ?? 0 }} vessels</p>
                <p>Last request: {{ syncLastRequestLabel }}</p>
                <p>Last success: {{ syncLastSuccessLabel }}</p>
                <p>
                  Last batch: {{ syncStatus?.sync.lastRecordCount ?? 0 }} records across
                  {{ syncStatus?.sync.lastBatchCount ?? 0 }} batches
                </p>
              </div>

              <UAlert
                v-if="syncStatus?.sync.lastError"
                class="mt-4"
                color="warning"
                variant="soft"
                title="Last sync note"
                :description="syncStatus.sync.lastError"
              />
            </div>

            <div class="space-y-4 text-sm text-muted">
              <p>Revoke keys when an install is compromised.</p>
              <p>Disable sharing when a public vessel needs to go dark.</p>
              <p>Mark installs unhealthy when telemetry is stale or misconfigured.</p>
              <p>Audit trails should remain lightweight but visible to operators.</p>
            </div>
          </div>
        </UCard>
      </section>
    </template>

    <UAlert
      v-else
      color="error"
      variant="soft"
      title="Admin unavailable"
      description="This operator surface is not available for the current account."
    />
  </div>
</template>
