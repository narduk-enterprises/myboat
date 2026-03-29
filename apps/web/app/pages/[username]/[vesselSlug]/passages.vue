<script setup lang="ts">
definePageMeta({ layout: 'landing' })

const route = useRoute()
const username = computed(() => String(route.params.username || ''))
const vesselSlug = computed(() => String(route.params.vesselSlug || ''))
const store = useMyBoatVesselStore()

const { data, error, pending } = await usePublicVesselDetail(username.value, vesselSlug.value)

watch(
  () => data.value,
  (nextDetail) => {
    if (!nextDetail) {
      return
    }

    store.hydratePublicVesselDetail(nextDetail)
  },
  { immediate: true },
)

const detail = computed(
  () => store.getPublicDetail(username.value, vesselSlug.value) || data.value || null,
)

useSeo({
  title: detail.value?.vessel.name
    ? `${detail.value.vessel.name} passages · @${detail.value.profile.username}`
    : 'Public passages',
  description:
    detail.value?.vessel.summary ||
    'Public MyBoat passage log with captain-approved route history and stored track geometry.',
})

useWebPageSchema({
  name: 'Public passages',
  description:
    'Public MyBoat passage log with captain-approved route history and stored track geometry.',
  type: 'CollectionPage',
})
</script>

<template>
  <div class="space-y-8">
    <template v-if="pending">
      <USkeleton class="h-64 rounded-[2rem]" />
      <div class="grid gap-6 xl:grid-cols-[minmax(0,1.12fr)_22rem]">
        <USkeleton class="h-[28rem] rounded-[1.75rem]" />
        <USkeleton class="h-[28rem] rounded-[1.75rem]" />
      </div>
    </template>

    <PublicVesselPassagesView v-else-if="detail" :detail="detail" />

    <UAlert
      v-else-if="error"
      color="error"
      variant="soft"
      title="Public passages unavailable"
      description="The requested vessel could not be found or is not currently shared."
    />
  </div>
</template>
