<script setup lang="ts">
import AuthDock from '~/components/myboat/AuthDock.vue'

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

const dockChecklist = [
  'Open the dashboard and current boat status.',
  'Manage installs, keys, and collector feeds.',
  'Update the public page when you want to share.',
]
</script>

<template>
  <AuthDock
    eyebrow="Captain access"
    title="Back to your boat"
    description="Sign in to open your dashboard, manage collector installs, and update the public page."
    :checklist="dockChecklist"
  >
    <AuthLoginCard
      title="Welcome back aboard"
      subtitle="Open your dashboard and install controls."
      :show-demo-login="showDemoLogin"
    >
      <template #logo>
        <AppBrandMark />
      </template>
    </AuthLoginCard>
  </AuthDock>
</template>
