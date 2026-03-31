<script setup lang="ts">
import { formatRelativeTime } from '~/utils/marine'

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

const mappedCount = computed(
  () =>
    followedVessels.value.filter(
      (vessel) => vessel.positionLat !== null && vessel.positionLng !== null,
    ).length,
)
const hiddenCount = computed(() => followedVessels.value.length - mappedCount.value)
const freshestReportLabel = computed(() => {
  const freshest = [...followedVessels.value]
    .filter((vessel) => vessel.lastReportAt)
    .sort(
      (left, right) =>
        new Date(right.lastReportAt || 0).getTime() - new Date(left.lastReportAt || 0).getTime(),
    )[0]

  return freshest?.lastReportAt ? formatRelativeTime(freshest.lastReportAt) : 'No telemetry yet'
})
</script>

<template>
  <div class="space-y-6">
    <template v-if="pending">
      <USkeleton class="h-40 rounded-[1.5rem]" />
      <USkeleton class="h-[40rem] rounded-[1.75rem]" />
    </template>

    <template v-else-if="overview">
      <OperatorRouteMasthead
        eyebrow="Buddy boats"
        title="Track the fleet you care about"
        description="Use the map as the primary workspace, keep the active buddy-boat context visible, and open the manager only when you need to search, save, or prune the list."
      >
        <template #actions>
          <UButton
            color="primary"
            icon="i-lucide-users-round"
            size="lg"
            @click="isManageBuddiesOpen = true"
          >
            Manage Buddies
          </UButton>
        </template>

        <template #meta>
          <div class="grid gap-3 md:grid-cols-3">
            <div class="rounded-[1.15rem] border border-default/70 bg-elevated/70 px-4 py-3">
              <p class="text-xs font-semibold uppercase tracking-[0.22em] text-muted">Mapped</p>
              <p class="mt-2 font-display text-lg text-default">{{ mappedCount }}</p>
              <p class="mt-1 text-xs text-muted">Buddy boats with current AIS coordinates.</p>
            </div>

            <div class="rounded-[1.15rem] border border-default/70 bg-elevated/70 px-4 py-3">
              <p class="text-xs font-semibold uppercase tracking-[0.22em] text-muted">Off map</p>
              <p class="mt-2 font-display text-lg text-default">{{ hiddenCount }}</p>
              <p class="mt-1 text-xs text-muted">Saved boats waiting for a current position.</p>
            </div>

            <div class="rounded-[1.15rem] border border-default/70 bg-elevated/70 px-4 py-3">
              <p class="text-xs font-semibold uppercase tracking-[0.22em] text-muted">
                Freshest report
              </p>
              <p class="mt-2 font-display text-lg text-default">{{ freshestReportLabel }}</p>
              <p class="mt-1 text-xs text-muted">Latest AIS report visible in this workspace.</p>
            </div>
          </div>
        </template>
      </OperatorRouteMasthead>

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
        height-class="h-[26rem] sm:h-[30rem] lg:h-[36rem] xl:h-[40rem]"
        workspace-mode="split"
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
