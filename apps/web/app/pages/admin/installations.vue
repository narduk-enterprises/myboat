<script setup lang="ts">
definePageMeta({ middleware: ['admin'] })

useSeo({
  title: 'Installations · Admin',
  description: 'Inspect all onboard installations, connection states, and ingest pipeline health.',
  robots: 'noindex, nofollow',
})

useWebPageSchema({
  name: 'Admin installations',
  description: 'Inspect all onboard installations, connection states, and ingest pipeline health.',
})

const appFetch = useAppFetch()

interface AdminInstallation {
  id: string
  label: string
  edgeHostname: string | null
  connectionState: string
  lastSeenAt: string | null
  eventCount: number
  vesselName: string | null
  vesselSlug: string | null
  ownerEmail: string | null
  ownerName: string | null
  createdAt: string
}

interface InstallationsResponse {
  installations: AdminInstallation[]
  total: number
  liveCount: number
}

const { data } = await useAsyncData('admin-installations', () =>
  appFetch<InstallationsResponse>('/api/admin/app/installations'),
)

const installations = computed(() => data.value?.installations ?? [])
const total = computed(() => data.value?.total ?? 0)
const liveCount = computed(() => data.value?.liveCount ?? 0)

function stateColor(state: string) {
  if (state === 'live') return 'success'
  if (state === 'pending') return 'warning'
  return 'neutral'
}
</script>

<template>
  <div class="space-y-8">
    <div class="flex items-center gap-3">
      <UButton to="/admin" color="neutral" variant="ghost" icon="i-lucide-arrow-left" size="sm">
        Admin
      </UButton>
    </div>

    <UPageHero
      title="Installations"
      description="All onboard device deployments. Monitor connection states and ingest key usage."
    />

    <div class="grid gap-4 sm:grid-cols-3">
      <MarineMetricCard label="Total installs" :value="String(total)" icon="i-lucide-cpu" />
      <MarineMetricCard label="Live installs" :value="String(liveCount)" icon="i-lucide-radio" />
      <MarineMetricCard
        label="Pending installs"
        :value="String(total - liveCount)"
        icon="i-lucide-clock"
      />
    </div>

    <UCard class="chart-surface rounded-[1.75rem]">
      <template #header>
        <div>
          <h2 class="font-display text-xl text-default">All installations</h2>
          <p class="mt-1 text-sm text-muted">
            {{ total }} install{{ total === 1 ? '' : 's' }} · showing 50 most recent
          </p>
        </div>
      </template>

      <div v-if="installations.length" class="space-y-3">
        <div
          v-for="installation in installations"
          :key="installation.id"
          class="rounded-2xl border border-default bg-elevated/60 px-4 py-4"
        >
          <div class="flex items-start justify-between gap-4">
            <div class="min-w-0">
              <div class="flex flex-wrap items-center gap-2">
                <p class="font-medium text-default">{{ installation.label }}</p>
                <UBadge :color="stateColor(installation.connectionState)" variant="soft" size="xs">
                  {{ installation.connectionState }}
                </UBadge>
              </div>
              <p class="mt-1 text-sm text-muted">
                {{ installation.vesselName || 'Unknown vessel' }}
                <template v-if="installation.edgeHostname">
                  · {{ installation.edgeHostname }}
                </template>
              </p>
              <p class="mt-1 text-xs text-muted">
                Owner: {{ installation.ownerName || installation.ownerEmail || 'Unknown' }}
                · {{ installation.eventCount.toLocaleString() }} events
              </p>
              <p v-if="installation.lastSeenAt" class="mt-1 text-xs text-muted">
                Last seen {{ new Date(installation.lastSeenAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) }}
              </p>
            </div>
            <p class="shrink-0 text-xs text-muted">
              {{ new Date(installation.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) }}
            </p>
          </div>
        </div>
      </div>

      <MarineEmptyState
        v-else
        icon="i-lucide-cpu"
        title="No installations found"
        description="No onboard device deployments registered on this platform."
        compact
      />
    </UCard>
  </div>
</template>
