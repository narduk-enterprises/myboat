<script setup lang="ts">
import type { LocationQueryRaw } from 'vue-router'

definePageMeta({ layout: 'dashboard', middleware: ['auth'] })

const route = useRoute()
const store = useMyBoatVesselStore()
const { data, error, pending } = await useDashboardOverview('myboat-dashboard-passages')

if (data.value) {
  store.hydrateAuthOverview(data.value)
}

watch(
  data,
  (value) => {
    if (value) {
      store.hydrateAuthOverview(value)
    }
  },
  { immediate: false },
)

const overview = computed(() => data.value ?? null)
const singleVesselSlug = computed(() =>
  overview.value?.vessels.length === 1 ? overview.value.vessels[0]?.slug || null : null,
)

if (singleVesselSlug.value) {
  const nextQuery: LocationQueryRaw = { ...route.query }
  delete nextQuery.vessel

  await navigateTo(
    {
      path: `/dashboard/vessels/${singleVesselSlug.value}/passages`,
      query: nextQuery,
    },
    { replace: true },
  )
}

useSeo({
  title: 'Passages',
  description:
    'Captain passage workspace with route history, saved track geometry, and vessel switching.',
  robots: 'noindex, nofollow',
})

useWebPageSchema({
  name: 'Captain passages',
  description:
    'Captain passage workspace with route history, saved track geometry, and vessel switching.',
})
</script>

<template>
  <div class="space-y-8">
    <template v-if="pending">
      <USkeleton class="h-40 rounded-[2rem]" />
      <USkeleton class="h-[24rem] rounded-[1.75rem]" />
    </template>

    <DashboardPassagesWorkspaceSurface
      v-else-if="overview && overview.vessels.length > 1"
      :overview="overview"
    />

    <UAlert
      v-else-if="error"
      color="error"
      variant="soft"
      title="Passages unavailable"
      description="The captain passage workspace could not be loaded right now."
    />

    <div v-else class="space-y-6">
      <UPageHero
        title="Passages"
        description="Create the captain profile and first vessel before opening the shared route log."
      />

      <MarineEmptyState
        title="No vessel ready for the passage log"
        description="Finish onboarding to attach the primary boat, then the shared passages workspace will resolve here."
        icon="i-lucide-anchor"
      >
        <UButton to="/dashboard/onboarding" color="primary" icon="i-lucide-anchor">
          Finish onboarding
        </UButton>
      </MarineEmptyState>
    </div>
  </div>
</template>
