<script setup lang="ts">
definePageMeta({ middleware: ['admin'] })

useSeo({
  title: 'Vessels · Admin',
  description: 'Review all registered vessels across the MyBoat platform.',
  robots: 'noindex, nofollow',
})

useWebPageSchema({
  name: 'Admin vessels',
  description: 'Review all registered vessels across the MyBoat platform.',
})

const appFetch = useAppFetch()

interface AdminVessel {
  id: string
  slug: string
  name: string
  vesselType: string | null
  homePort: string | null
  isPrimary: boolean
  sharePublic: boolean
  ownerEmail: string | null
  ownerName: string | null
  createdAt: string
}

interface VesselsResponse {
  vessels: AdminVessel[]
  total: number
}

const { data } = await useAsyncData('admin-vessels', () =>
  appFetch<VesselsResponse>('/api/admin/app/vessels'),
)

const vessels = computed(() => data.value?.vessels ?? [])
const total = computed(() => data.value?.total ?? 0)
</script>

<template>
  <div class="space-y-8">
    <div class="flex items-center gap-3">
      <UButton to="/admin" color="neutral" variant="ghost" icon="i-lucide-arrow-left" size="sm">
        Admin
      </UButton>
    </div>

    <UPageHero
      title="Vessels"
      description="All registered vessels across the platform. Showing the 50 most recently created."
    />

    <UCard class="chart-surface rounded-[1.75rem]">
      <template #header>
        <div>
          <h2 class="font-display text-xl text-default">All vessels</h2>
          <p class="mt-1 text-sm text-muted">{{ total }} vessel{{ total === 1 ? '' : 's' }} registered</p>
        </div>
      </template>

      <div v-if="vessels.length" class="space-y-3">
        <div
          v-for="vessel in vessels"
          :key="vessel.id"
          class="rounded-2xl border border-default bg-elevated/60 px-4 py-4"
        >
          <div class="flex items-start justify-between gap-4">
            <div class="min-w-0">
              <div class="flex flex-wrap items-center gap-2">
                <p class="font-medium text-default">{{ vessel.name }}</p>
                <UBadge v-if="vessel.isPrimary" color="primary" variant="soft" size="xs">
                  Primary
                </UBadge>
                <UBadge
                  :color="vessel.sharePublic ? 'success' : 'neutral'"
                  variant="soft"
                  size="xs"
                >
                  {{ vessel.sharePublic ? 'Public' : 'Private' }}
                </UBadge>
              </div>
              <p class="mt-1 text-sm text-muted">
                {{ vessel.vesselType || 'No type' }}
                <template v-if="vessel.homePort"> · {{ vessel.homePort }}</template>
              </p>
              <p class="mt-1 text-xs text-muted">
                Owner: {{ vessel.ownerName || vessel.ownerEmail || 'Unknown' }}
                <span class="opacity-60"> · /{{ vessel.slug }}</span>
              </p>
            </div>
            <p class="shrink-0 text-xs text-muted">
              {{ new Date(vessel.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) }}
            </p>
          </div>
        </div>
      </div>

      <MarineEmptyState
        v-else
        icon="i-lucide-ship"
        title="No vessels registered"
        description="No vessel records found on this platform."
        compact
      />
    </UCard>
  </div>
</template>
