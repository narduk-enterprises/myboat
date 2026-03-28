<script setup lang="ts">
definePageMeta({ layout: 'dashboard', middleware: ['auth'] })

const route = useRoute()
const vesselSlug = computed(() => String(route.params.vesselSlug || ''))

const { data, pending } = await useVesselDetail(vesselSlug.value)

const detail = computed(() => data.value ?? null)

useSeo({
  title: detail.value?.vessel.name || 'Vessel',
  description: 'Live vessel telemetry, AIS traffic, and install posture for the active boat.',
  robots: 'noindex, nofollow',
})

useWebPageSchema({
  name: 'Vessel live view',
  description: 'Live vessel telemetry, AIS traffic, and install posture for the active boat.',
})
</script>

<template>
  <DashboardVesselShell
    :detail="detail"
    :pending="pending"
    active-view="live"
    fallback-description="Live vessel telemetry, AIS traffic, and install posture for the active boat."
  >
    <DashboardVesselLiveView v-if="detail" :detail="detail" />
  </DashboardVesselShell>
</template>
