<script setup lang="ts">
definePageMeta({ layout: 'dashboard', middleware: ['auth'] })

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
  <div class="space-y-6">
    <div class="grid gap-6 xl:grid-cols-[0.86fr_1.14fr]">
      <div class="space-y-5 xl:sticky xl:top-24 xl:self-start">
        <section class="chart-surface-strong rounded-[2rem] px-6 py-8 sm:px-8">
          <div class="relative z-10 space-y-5">
            <div class="marine-kicker w-fit">Launch pass</div>
            <div>
              <h1 class="font-display text-4xl tracking-tight text-default sm:text-5xl">
                Lock the captain, vessel, and first install in one pass
              </h1>
              <p class="mt-3 text-base leading-7 text-muted">
                This setup becomes the canonical source for the public captain page, the live
                telemetry path, and the first install you trust in production.
              </p>
            </div>

            <div class="grid gap-3">
              <div class="metric-shell rounded-[1.35rem] p-4">
                <p class="text-xs uppercase tracking-[0.24em] text-muted">Public route</p>
                <p class="mt-2 font-display text-xl text-default">Captain handle + vessel page</p>
              </div>
              <div class="metric-shell rounded-[1.35rem] p-4">
                <p class="text-xs uppercase tracking-[0.24em] text-muted">Primary vessel</p>
                <p class="mt-2 font-display text-xl text-default">Live map, passages, media</p>
              </div>
              <div class="metric-shell rounded-[1.35rem] p-4">
                <p class="text-xs uppercase tracking-[0.24em] text-muted">First install</p>
                <p class="mt-2 font-display text-xl text-default">Keys, SignalK, edge hostname</p>
              </div>
            </div>
          </div>
        </section>

        <UCard class="chart-surface rounded-[1.75rem] shadow-card">
          <template #header>
            <div>
              <h2 class="font-display text-2xl text-default">What this setup controls</h2>
              <p class="mt-2 text-sm text-muted">
                One save aligns the private operator surface and the public-facing boat story.
              </p>
            </div>
          </template>

          <div class="space-y-4 text-sm leading-6 text-muted">
            <p>Your public handle becomes the URL for your captain profile and shared vessel pages.</p>
            <p>Your primary vessel powers the live map, passages, media memories, and voyage timeline.</p>
            <p>
              Your first onboard install is where ingest keys, SignalK details, and device metadata
              are managed.
            </p>
          </div>
        </UCard>
      </div>

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
