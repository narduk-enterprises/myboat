<script setup lang="ts">
definePageMeta({ layout: 'landing' })

const route = useRoute()
const username = computed(() => String(route.params.username || ''))
const vesselSlug = computed(() => String(route.params.vesselSlug || ''))
const store = useMyBoatVesselStore()

const { data, error, pending, refreshDetail, lastRefreshCompletedAt, refreshIntervalMs } =
  await useLivePublicVesselDetail(username.value, vesselSlug.value)

watch(
  [username, vesselSlug],
  () => {
    store.setActivePublicVessel(null)
  },
  { immediate: true },
)

watch(
  () => data.value,
  (nextDetail) => {
    if (!nextDetail) {
      return
    }

    store.hydratePublicVesselDetail(nextDetail)
    store.setActivePublicVessel(`${nextDetail.profile.username}/${nextDetail.vessel.slug}`)
  },
  { immediate: true },
)

const detail = computed(() => store.getPublicDetail(username.value, vesselSlug.value))

onBeforeUnmount(() => {
  store.setActivePublicVessel(null)
})

useSeo({
  title: detail.value
    ? `${detail.value.vessel.name} · @${detail.value.profile.username}`
    : 'Public vessel',
  description:
    detail.value?.vessel.summary ||
    'Public MyBoat vessel detail with live status, route memory, and captain-approved sharing.',
})

useWebPageSchema({
  name: 'Public vessel',
  description:
    'Public MyBoat vessel detail with live status, route memory, and captain-approved sharing.',
  type: 'WebPage',
})
</script>

<template>
  <div class="space-y-8">
    <PublicVesselLiveDashboard
      v-if="detail"
      :refreshing="pending"
      :last-refresh-completed-at="lastRefreshCompletedAt"
      :refresh-interval-ms="refreshIntervalMs"
      @refresh="refreshDetail"
    />

    <template v-else-if="pending">
      <USkeleton class="h-64 rounded-[2rem]" />
      <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <USkeleton v-for="item in 4" :key="item" class="h-32 rounded-[1.5rem]" />
      </div>
      <div class="grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
        <USkeleton class="h-[34rem] rounded-[1.75rem]" />
        <div class="space-y-6">
          <USkeleton class="h-[18rem] rounded-[1.75rem]" />
          <USkeleton class="h-[18rem] rounded-[1.75rem]" />
        </div>
      </div>
    </template>

    <UAlert
      v-else-if="error"
      color="error"
      variant="soft"
      title="Public vessel unavailable"
      description="The requested vessel could not be found or is not currently shared."
    />
  </div>
</template>
