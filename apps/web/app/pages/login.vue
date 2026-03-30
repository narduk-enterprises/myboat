<script setup lang="ts">
useSeo({
  title: 'Sign In',
  description: 'Sign in to manage your boat, installs, and public page.',
  robots: 'noindex, nofollow',
})

useWebPageSchema({
  name: 'Sign In',
  description: 'Sign in to manage your boat, installs, and public page.',
})

definePageMeta({ layout: 'auth', middleware: ['guest'] })

const showDemoLogin = import.meta.dev
</script>

<template>
  <div class="flex w-full justify-center px-4 sm:px-6">
    <AuthLoginCard
      class="w-full max-w-[36rem]"
      title="Sign in to MyBoat"
      subtitle="Use Apple first. Reveal email only if that is really how you want to sign in."
      :show-demo-login="showDemoLogin"
    />
  </div>
</template>
