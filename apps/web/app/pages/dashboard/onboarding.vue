<script setup lang="ts">
definePageMeta({ middleware: ['auth'] })

useSeo({
  title: 'Boat Setup',
  description:
    'Define the captain profile, vessel identity, and primary install for the MyBoat workspace.',
  robots: 'noindex, nofollow',
})

useWebPageSchema({
  name: 'Boat setup',
  description:
    'Define the captain profile, vessel identity, and primary install for the MyBoat workspace.',
})

const { data } = await useDashboardOverview('myboat-onboarding-overview')

const { user } = useUserSession()

async function handleComplete(redirectTo: string) {
  await navigateTo(redirectTo)
}
</script>

<template>
  <div class="space-y-8">
    <UPageHero
      title="Boat setup"
      description="Create your public captain profile, choose the vessel you publish, and register the first onboard install for live data."
    />

    <div class="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
      <UCard class="border-default/80 bg-default/90 shadow-card">
        <template #header>
          <div>
            <h2 class="font-display text-2xl text-default">What this setup controls</h2>
            <p class="mt-2 text-sm text-muted">
              These choices become the foundation for your dashboard, public profile, and ingest
              pipeline.
            </p>
          </div>
        </template>

        <div class="space-y-4 text-sm text-muted">
          <p>Your public handle becomes the URL for your captain profile and shared boat pages.</p>
          <p>Your primary vessel powers the live map, passages, media memories, and timeline.</p>
          <p>
            Your first onboard install is where ingest keys, SignalK details, and device metadata
            are managed.
          </p>
        </div>
      </UCard>

      <OnboardingForm
        :initial-state="{
          captainName: data?.profile?.captainName || user?.name || '',
          username: data?.profile?.username || '',
          headline: data?.profile?.headline || '',
          bio: data?.profile?.bio || '',
          vesselName: data?.vessels?.[0]?.name || '',
          vesselType: data?.vessels?.[0]?.vesselType || '',
          homePort: data?.vessels?.[0]?.homePort || data?.profile?.homePort || '',
          summary: data?.vessels?.[0]?.summary || '',
          installationLabel: data?.installations?.[0]?.label || '',
          edgeHostname: data?.installations?.[0]?.edgeHostname || '',
          signalKUrl: data?.installations?.[0]?.signalKUrl || '',
        }"
        @complete="handleComplete"
      />
    </div>
  </div>
</template>
