<script setup lang="ts">
import type { VesselDetailResponse } from '~/types/myboat'

definePageMeta({ layout: 'dashboard', middleware: ['auth'] })

useSeo({
  title: 'Live map',
  description: 'Large operational chart with AIS traffic, selected-contact detail, and live vessel diagnostics.',
  robots: 'noindex, nofollow',
})

useWebPageSchema({
  name: 'Live map',
  description: 'Large operational chart with AIS traffic, selected-contact detail, and live vessel diagnostics.',
})

const { data: overviewData, pending: overviewPending } = await useDashboardOverview('myboat-dashboard-map')
const store = useMyBoatVesselStore()

const overview = computed(() => overviewData.value)
const primaryVesselSlug = computed(
  () =>
    overview.value?.vessels.find((vessel) => vessel.isPrimary)?.slug ||
    overview.value?.vessels[0]?.slug ||
    null,
)
const appFetch = useAppFetch()
const { data: detailData, pending: detailPending } = await useAsyncData(
  'myboat-dashboard-map-detail',
  async () => {
    if (!primaryVesselSlug.value) {
      return null
    }

    return await appFetch<VesselDetailResponse>(`/api/app/vessels/${primaryVesselSlug.value}`)
  },
  {
    watch: [primaryVesselSlug],
  },
)

const pending = computed(
  () => overviewPending.value || (Boolean(primaryVesselSlug.value) && detailPending.value),
)

if (overviewData.value) {
  store.hydrateAuthOverview(overviewData.value)
}

if (detailData.value) {
  store.hydrateAuthVesselDetail(detailData.value)
}

watch(
  overviewData,
  (value) => {
    if (value) {
      store.hydrateAuthOverview(value)
    }
  },
  { immediate: false },
)

watch(
  detailData,
  (value) => {
    if (value) {
      store.hydrateAuthVesselDetail(value)
    }
  },
  { immediate: false },
)

const hasMapState = computed(() => Boolean(store.authActiveEntry.value?.vessel))
</script>

<template>
  <div class="space-y-8">
    <template v-if="pending">
      <USkeleton class="h-56 rounded-[2rem]" />
      <div class="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(20rem,0.8fr)]">
        <USkeleton class="h-[34rem] rounded-[1.75rem]" />
        <div class="space-y-6">
          <USkeleton class="h-60 rounded-[1.75rem]" />
          <USkeleton class="h-64 rounded-[1.75rem]" />
        </div>
      </div>
      <div class="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(22rem,0.92fr)]">
        <USkeleton class="h-[30rem] rounded-[1.75rem]" />
        <USkeleton class="h-[30rem] rounded-[1.75rem]" />
      </div>
    </template>

    <DashboardMapSurface v-else-if="hasMapState" />

    <MarineEmptyState
      v-else
      icon="i-lucide-map-off"
      title="No vessel is ready for the live map yet"
      description="Finish the primary vessel setup and connect a live-data source to unlock the dedicated chart route."
    >
      <UButton to="/dashboard/onboarding" color="primary" icon="i-lucide-anchor">
        Finish setup
      </UButton>
    </MarineEmptyState>
  </div>
</template>
