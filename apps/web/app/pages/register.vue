<script setup lang="ts">
import AuthDock from '~/components/myboat/AuthDock.vue'

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

const dockChecklist = [
  'Claim the captain handle that becomes the public home for your boat.',
  'Define the vessel, first install, and ingest posture in one bluewater control surface.',
  'Keep live telemetry, passages, and public sharing aligned as the boat starts reporting.',
]
</script>

<template>
  <AuthDock
    eyebrow="New captain workspace"
    title="Launch the operating surface for your boat"
    description="Create the account that owns your public vessel identity, telemetry surface, and edge installation keys."
    :checklist="dockChecklist"
  >
    <AuthRegisterCard
      title="Build the canonical home for your boat"
      subtitle="Create the account that owns the public profile, telemetry surface, and edge install keys."
    >
      <template #logo>
        <AppBrandMark />
      </template>
    </AuthRegisterCard>
  </AuthDock>
</template>
