<script setup lang="ts">
definePageMeta({ layout: 'dashboard', middleware: ['auth'] })

useSeo({
  title: 'Settings',
  description:
    'Canonical captain settings for vessel profile, live-feed setup, sharing, security, and local preferences.',
  robots: 'noindex, nofollow',
})

useWebPageSchema({
  name: 'Settings',
  description:
    'Canonical captain settings for vessel profile, live-feed setup, sharing, security, and local preferences.',
})

const { data, pending } = await useDashboardOverview('myboat-settings-index')

const overview = computed(() => data.value)
</script>

<template>
  <div class="space-y-8">
    <template v-if="pending">
      <USkeleton class="h-56 rounded-[2rem]" />
      <div class="space-y-6">
        <USkeleton v-for="item in 5" :key="item" class="h-64 rounded-[1.75rem]" />
      </div>
    </template>

    <DashboardSettingsSurface v-else-if="overview" :overview="overview" />

    <UAlert
      v-else
      color="error"
      variant="soft"
      title="Settings unavailable"
      description="We could not load the captain settings surface right now."
    />
  </div>
</template>
