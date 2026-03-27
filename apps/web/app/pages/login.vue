<script setup lang="ts">
useSeo({
  title: 'Sign In',
  description: 'Sign in to manage vessels, installations, telemetry, and public boat sharing.',
  robots: 'noindex, nofollow',
})

useWebPageSchema({
  name: 'Sign In',
  description: 'Sign in to manage vessels, installations, telemetry, and public boat sharing.',
})

definePageMeta({ middleware: ['guest'] })
</script>

<template>
  <div class="flex min-h-[calc(100vh-8rem)] items-center justify-center">
    <AuthLoginCard
      title="Welcome back aboard"
      subtitle="Sign in to reach your vessel dashboard and installation controls."
    >
      <template #logo>
        <AppBrandMark />
      </template>
    </AuthLoginCard>
  </div>
</template>
