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
  'Get back to the live boat dashboard fast.',
  'Open installs, keys, and collector controls.',
  'Keep email available only as a fallback.',
]
</script>

<template>
  <AuthDock
    eyebrow="Captain access"
    title="Sign in and get back underway"
    description="Apple is the fastest path into your boat workspace. Email stays available as a fallback, not the first thing you have to fight through."
    :checklist="dockChecklist"
  >
    <AuthLoginCard
      title="Sign in to MyBoat"
      subtitle="Use Apple first. Reveal email only if that is really how you want to sign in."
      :show-demo-login="showDemoLogin"
    />
  </AuthDock>
</template>
