<script setup lang="ts">
import type { VesselDetailResponse } from '~/types/myboat'

defineProps<{
  detail: VesselDetailResponse
}>()
</script>

<template>
  <PassagesWorkspace
    :vessel="detail.vessel"
    :passages="detail.passages"
    :waypoints="detail.waypoints"
    :media="detail.media"
    title="Passages"
    description="Pick a leg from the rail to focus the chart and replay the route."
    :map-persist-key="`dashboard-vessel-passages:${detail.vessel.slug}`"
  />
</template>
