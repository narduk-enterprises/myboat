<script setup lang="ts">
definePageMeta({ layout: 'dashboard', middleware: ['auth'] })

const route = useRoute()
const vesselSlug = computed(() => String(route.params.vesselSlug || ''))

const { data, pending } = await useVesselDetail(vesselSlug.value)

const detail = computed(() => data.value ?? null)

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
