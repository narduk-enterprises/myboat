<script setup lang="ts">
useSeo({
  title: 'Create Account',
  description:
    'Create a MyBoat account to publish a vessel profile and connect your first live install.',
  robots: 'noindex, nofollow',
})

useWebPageSchema({
  name: 'Create Account',
  description:
    'Create a MyBoat account to publish a vessel profile and connect your first live install.',
})

definePageMeta({ middleware: ['guest'] })
</script>

<template>
  <div class="flex min-h-[calc(100vh-8rem)] items-center justify-center">
    <AuthRegisterCard
      title="Build the canonical home for your boat"
      subtitle="Create the account that owns the public profile, telemetry surface, and edge install keys."
    >
      <template #logo>
        <AppBrandMark />
      </template>
    </AuthRegisterCard>
  </div>
</template>
