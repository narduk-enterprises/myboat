<script setup lang="ts">
import AuthDock from '~/components/myboat/AuthDock.vue'

useSeo({
  title: 'Create Account',
  description: 'Create an account to set up your boat and first live feed.',
  robots: 'noindex, nofollow',
})

useWebPageSchema({
  name: 'Create Account',
  description: 'Create an account to set up your boat and first live feed.',
})

definePageMeta({ layout: 'auth', middleware: ['guest'] })

const dockChecklist = [
  'Claim the public handle for your captain page.',
  'Add your boat and first install in one setup flow.',
  'Connect a live feed when the hardware is ready.',
]
</script>

<template>
  <AuthDock
    eyebrow="New boat setup"
    title="Set up your boat workspace"
    description="Create the account that owns your dashboard, public page, and first live feed."
    :checklist="dockChecklist"
  >
    <AuthRegisterCard
      title="Create your account"
      subtitle="Start with your captain login. Boat setup comes next."
    >
      <template #logo>
        <AppBrandMark />
      </template>
    </AuthRegisterCard>
  </AuthDock>
</template>
