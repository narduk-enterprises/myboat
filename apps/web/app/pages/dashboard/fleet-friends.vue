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

const { data, pending, refresh } = await useDashboardOverview('myboat-fleet-friends')

const overview = computed(() => data.value)
</script>

<template>
  <div class="space-y-6">
    <template v-if="pending">
      <USkeleton class="h-16 rounded-[1.5rem]" />
      <div class="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(22rem,28rem)]">
        <USkeleton class="h-[38rem] rounded-[1.75rem]" />
        <div class="space-y-6">
          <USkeleton class="h-[22rem] rounded-[1.75rem]" />
          <USkeleton class="h-[20rem] rounded-[1.75rem]" />
        </div>
      </div>
    </template>

    <template v-else-if="overview">
      <div
        class="flex flex-col gap-4 rounded-[1.75rem] border border-default/70 bg-default/85 px-5 py-5 shadow-card sm:flex-row sm:items-center sm:justify-between"
      >
        <div>
          <h1 class="font-display text-3xl text-default">Buddy Boats</h1>
          <p class="mt-1 text-sm text-muted">
            Search the local AIS library, pull from AIS Hub only when needed, and save the boats you want on this captain page.
          </p>
        </div>

        <div class="flex flex-wrap gap-2">
          <UButton to="/dashboard" color="neutral" variant="soft" icon="i-lucide-arrow-left">
            Dashboard
          </UButton>
          <UButton
            to="/dashboard/settings/profile"
            color="neutral"
            variant="soft"
            icon="i-lucide-id-card"
          >
            Profile
          </UButton>
          <UBadge
            :color="overview.profile ? 'primary' : 'warning'"
            variant="soft"
            class="self-start sm:self-center"
          >
            {{ overview.profile ? `@${overview.profile.username}` : 'Profile pending' }}
          </UBadge>
        </div>
      </div>

      <UAlert
        v-if="!overview.profile"
        color="warning"
        variant="soft"
        title="Public handle still needs setup"
        description="You can save buddy boats now. They will publish on the captain page after the captain profile is finished."
      />

      <FleetFriendsManager
        :items="overview.followedVessels"
        :captain-username="overview.profile?.username ?? null"
        @changed="refresh"
      />
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
