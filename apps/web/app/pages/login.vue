<script setup lang="ts">
import AuthDock from '~/components/myboat/AuthDock.vue'

useSeo({
  title: 'Sign In',
  description: 'Sign in to manage vessels, installations, telemetry, and public boat sharing.',
  robots: 'noindex, nofollow',
})

useWebPageSchema({
  name: 'Sign In',
  description: 'Sign in to manage vessels, installations, telemetry, and public boat sharing.',
})

definePageMeta({ layout: 'auth', middleware: ['guest'] })

const showDemoLogin = import.meta.dev

const dockChecklist = [
  'Review the live vessel board without exposing private install controls.',
  'Issue ingest keys, inspect SignalK posture, and keep the edge path healthy.',
  'Update the public captain page, passage history, and shared boat memory from one place.',
]
</script>

<template>
  <AuthDock
    eyebrow="Captain access"
    title="Return to the bridge"
    description="Sign in to reach the live vessel board, manage onboard installs, and keep the public captain page current."
    :checklist="dockChecklist"
  >
    <AuthLoginCard
      title="Welcome back aboard"
      subtitle="Sign in to reach your dashboard, telemetry posture, and installation controls."
      :show-demo-login="showDemoLogin"
    >
      <template #logo>
        <AppBrandMark />
      </template>
    </AuthLoginCard>
  </AuthDock>
</template>
