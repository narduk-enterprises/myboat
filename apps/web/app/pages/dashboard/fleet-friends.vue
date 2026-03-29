<script setup lang="ts">
definePageMeta({ layout: 'dashboard', middleware: ['auth'] })

useSeo({
  title: 'Buddy Boats',
  description: 'Search, save, and chart the buddy boats this captain follows.',
  robots: 'noindex, nofollow',
})

useWebPageSchema({
  name: 'Buddy Boats',
  description: 'Search, save, and chart the buddy boats this captain follows.',
})

const { data, pending } = await useDashboardOverview('myboat-fleet-friends')

const overview = computed(() => data.value)
const isCompactViewport = useCompactViewport()
const isManageBuddiesOpen = shallowRef(false)
const {
  items: followedVessels,
  removeItem: removeFollowedVessel,
  setItems: setFollowedVessels,
  upsertItem: upsertFollowedVessel,
  upsertItems: upsertFollowedVessels,
} = useFollowedVesselsState()

watch(
  () => overview.value?.followedVessels,
  (nextItems) => {
    if (!nextItems) {
      return
    }

    setFollowedVessels(nextItems)
  },
  { immediate: true },
)
</script>

<template>
  <div class="space-y-6">
    <template v-if="pending">
      <USkeleton class="h-16 rounded-[1.5rem]" />
      <USkeleton class="h-[40rem] rounded-[1.75rem]" />
    </template>

    <template v-else-if="overview">
      <div
        class="flex flex-col gap-4 rounded-[1.75rem] border border-default/70 bg-default/85 px-5 py-5 shadow-card sm:flex-row sm:items-center sm:justify-between"
      >
        <div>
          <h1 class="font-display text-3xl text-default">Buddy Boats</h1>
          <p class="mt-1 text-sm text-muted">
            Keep the fleet chart front and center, then open the manager when you need to search,
            save, or remove buddy boats for this captain page.
          </p>
        </div>

        <div class="flex items-center gap-2">
          <UButton
            color="primary"
            icon="i-lucide-users-round"
            size="lg"
            @click="isManageBuddiesOpen = true"
          >
            Manage Buddies
          </UButton>
        </div>
      </div>

      <UAlert
        v-if="!overview.profile"
        color="warning"
        variant="soft"
        title="Public handle still needs setup"
        description="You can save buddy boats now. They will publish on the captain page after the captain profile is finished."
      />

      <BuddyBoatsMap
        :vessels="followedVessels"
        title="Buddy boats chart"
        description="Saved buddy boats with current AIS positions render here. Open the manager to search AIS Hub, add new boats, or prune the list."
        height-class="h-[30rem] sm:h-[38rem] lg:h-[46rem] xl:h-[54rem]"
        empty-description="Open Manage Buddies to search AIS Hub, save the boats you care about, and bring them onto this chart once current coordinates are available."
      />

      <UModal
        v-model:open="isManageBuddiesOpen"
        title="Manage buddies"
        description="Search AIS Hub, save buddy boats to this captain page, and remove boats you no longer want to track."
        :fullscreen="isCompactViewport"
        class="overflow-hidden"
        :ui="{
          content: 'w-[calc(100vw-2rem)] max-w-5xl rounded-[1.5rem] shadow-overlay',
          body: 'overflow-y-auto p-4 sm:p-5',
        }"
      >
        <template #body>
          <BuddyBoatTableManager
            :items="followedVessels"
            @imported="upsertFollowedVessels"
            @refreshed="setFollowedVessels"
            @removed="removeFollowedVessel"
            @saved="upsertFollowedVessel"
          />
        </template>
      </UModal>
    </template>

    <UAlert
      v-else
      color="error"
      variant="soft"
      title="Buddy boat search unavailable"
      description="We could not load the buddy boats workspace right now."
    />
  </div>
</template>
