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
  'Start with Apple so the first step feels obvious.',
  'Create the captain account before boat setup.',
  'Keep email sign up tucked away as fallback.',
]
</script>

<template>
  <AuthDock
    eyebrow="New boat setup"
    title="Create the account that owns the boat"
    description="Make the first decision clean. Apple takes the lead, and email only shows up when you intentionally choose it."
    :checklist="dockChecklist"
  >
    <AuthRegisterCard
      title="Create your MyBoat account"
      subtitle="Start with Apple. Bring out email only if you want the manual path."
    />
  </AuthDock>
</template>
