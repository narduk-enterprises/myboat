<script setup lang="ts">
definePageMeta({ layout: 'dashboard', middleware: ['auth'] })

const route = useRoute()
const vesselSlug = computed(() => String(route.params.vesselSlug || ''))

const { data, pending } = await useVesselDetail(vesselSlug.value)
const store = useMyBoatVesselStore()

if (data.value) {
  store.hydrateAuthVesselDetail(data.value)
  store.setActiveAuthVessel(data.value.vessel.id)
}

watch(
  data,
  (value) => {
    if (!value) {
      return
    }

    store.hydrateAuthVesselDetail(value)
    store.setActiveAuthVessel(value.vessel.id)
  },
  { immediate: false },
)

const detail = computed(() => store.getAuthDetailBySlug(vesselSlug.value))

useSeo({
  title: detail.value?.vessel.name ? `${detail.value.vessel.name} passages` : 'Vessel passages',
  description: 'Historical passages, tracks, waypoints, and media for the active boat.',
  robots: 'noindex, nofollow',
})

useWebPageSchema({
  name: 'Vessel passages',
  description: 'Historical passages, tracks, waypoints, and media for the active boat.',
})
</script>

<template>
  <DashboardVesselShell
    :detail="detail"
    :pending="pending"
    active-view="passages"
    fallback-description="Historical passages, tracks, waypoints, and media for the active boat."
  >
    <DashboardVesselPassagesView v-if="detail" :detail="detail" />
  </DashboardVesselShell>
</template>
