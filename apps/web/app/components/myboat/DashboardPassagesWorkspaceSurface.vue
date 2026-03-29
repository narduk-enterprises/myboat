<script setup lang="ts">
import type { LocationQueryRaw } from 'vue-router'
import type { DashboardOverview, VesselDetailResponse } from '~/types/myboat'

const props = defineProps<{
  overview: DashboardOverview
}>()

const route = useRoute()
const router = useRouter()
const appFetch = useAppFetch()
const store = useMyBoatVesselStore()

const availableVessels = computed(() => props.overview.vessels)
const selectedVesselSlug = computed(() => {
  const requestedSlug = typeof route.query.vessel === 'string' ? route.query.vessel : null
  if (requestedSlug && availableVessels.value.some((vessel) => vessel.slug === requestedSlug)) {
    return requestedSlug
  }

  const activeSlug = store.authActiveEntry.value?.vessel?.slug
  if (activeSlug && availableVessels.value.some((vessel) => vessel.slug === activeSlug)) {
    return activeSlug
  }

  return (
    availableVessels.value.find((vessel) => vessel.isPrimary)?.slug ||
    availableVessels.value[0]?.slug ||
    null
  )
})

const { data, error, pending } = await useAsyncData(
  () => `myboat-dashboard-passages:${selectedVesselSlug.value || 'none'}`,
  () => {
    if (!selectedVesselSlug.value) {
      return Promise.resolve(null)
    }

    return appFetch<VesselDetailResponse>(`/api/app/vessels/${selectedVesselSlug.value}`)
  },
  { watch: [selectedVesselSlug] },
)

watch(
  () => data.value,
  (value) => {
    if (!value) {
      return
    }

    store.hydrateAuthVesselDetail(value)
    store.setActiveAuthVessel(value.vessel.id)
  },
  { immediate: true },
)

const detail = computed(() => {
  if (!selectedVesselSlug.value) {
    return null
  }

  return store.getAuthDetailBySlug(selectedVesselSlug.value) || data.value || null
})

function selectVessel(slug: string) {
  if (slug === selectedVesselSlug.value) {
    return
  }

  const nextQuery: LocationQueryRaw = {
    ...route.query,
    vessel: slug,
  }

  delete nextQuery.p

  void router.replace({ query: nextQuery })
}
</script>

<template>
  <div data-testid="dashboard-passages-surface" class="space-y-6">
    <UPageHero
      title="Passages"
      description="Search the private route log, focus one vessel on the chart, and keep public storytelling separate from the captain workspace."
    >
      <template #links>
        <UButton
          v-if="detail"
          :to="`/dashboard/vessels/${detail.vessel.slug}`"
          color="neutral"
          variant="soft"
          icon="i-lucide-radar"
        >
          Open live view
        </UButton>

        <UButton
          v-if="detail?.profile.username"
          :to="`/${detail.profile.username}/${detail.vessel.slug}/passages`"
          color="neutral"
          variant="soft"
          icon="i-lucide-share-2"
        >
          Public log
        </UButton>
      </template>
    </UPageHero>

    <template v-if="pending">
      <USkeleton class="h-[24rem] rounded-[1.75rem]" />
      <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <USkeleton v-for="item in 4" :key="item" class="h-32 rounded-[1.5rem]" />
      </div>
    </template>

    <UAlert
      v-else-if="error"
      color="error"
      variant="soft"
      title="Passages unavailable"
      description="The captain passage workspace could not be loaded right now."
    />

    <PassagesWorkspace
      v-else-if="detail"
      :vessel="detail.vessel"
      :passages="detail.passages"
      :waypoints="detail.waypoints"
      :media="detail.media"
      title="Captain passage log"
      description="Switch vessels when needed, search the route log, and focus one saved track without leaving the captain workspace."
      :map-persist-key="`dashboard-passages:${detail.vessel.slug}`"
    >
      <template #toolbar>
        <div v-if="availableVessels.length > 1" class="flex flex-wrap gap-2">
          <UButton
            v-for="vessel in availableVessels"
            :key="vessel.id"
            :color="selectedVesselSlug === vessel.slug ? 'primary' : 'neutral'"
            :variant="selectedVesselSlug === vessel.slug ? 'soft' : 'outline'"
            size="xs"
            @click="selectVessel(vessel.slug)"
          >
            {{ vessel.name }}
          </UButton>
        </div>
      </template>
    </PassagesWorkspace>
  </div>
</template>
