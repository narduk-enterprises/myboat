<script setup lang="ts">
definePageMeta({ layout: 'dashboard', middleware: ['auth'] })

useSeo({
  title: 'Dashboard',
  description:
    'The captain home for the primary vessel, live source, and current operating picture.',
  robots: 'noindex, nofollow',
})

useWebPageSchema({
  name: 'MyBoat dashboard',
  description:
    'The captain home for the primary vessel, live source, and current operating picture.',
})

const { data, pending } = await useDashboardOverview()
const store = useMyBoatVesselStore()

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

const hasDashboardState = computed(() =>
  Boolean(store.authActiveEntry.value || store.authState.value.profile),
)
</script>

<template>
  <div class="space-y-8">
    <template v-if="pending">
      <USkeleton class="h-56 rounded-[2rem]" />
      <div class="grid gap-6 xl:grid-cols-[minmax(0,1.18fr)_minmax(19rem,0.82fr)]">
        <USkeleton class="h-[26rem] rounded-[1.75rem]" />
        <div class="space-y-6">
          <USkeleton class="h-72 rounded-[1.75rem]" />
          <USkeleton class="h-48 rounded-[1.75rem]" />
        </div>
      </div>
      <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <USkeleton v-for="item in 6" :key="item" class="h-32 rounded-[1.5rem]" />
      </div>
    </template>

    <DashboardOverviewSurface v-else-if="hasDashboardState" />

    <UAlert
      v-else
      color="error"
      variant="soft"
      title="Dashboard unavailable"
      description="We could not load the captain dashboard right now."
    />
  </div>
</template>
