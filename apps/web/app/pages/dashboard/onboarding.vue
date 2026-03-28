<script setup lang="ts">
definePageMeta({ layout: 'dashboard', middleware: ['auth'] })

useSeo({
  title: 'Boat Setup',
  description: 'Set up your captain profile, boat, and first install.',
  robots: 'noindex, nofollow',
})

useWebPageSchema({
  name: 'Boat setup',
  description: 'Set up your captain profile, boat, and first install.',
})

const { data } = await useDashboardOverview('myboat-onboarding-overview')

const { user } = useUserSession()

const setupHighlights = [
  {
    label: 'Public page',
    value: 'Handle + profile',
  },
  {
    label: 'Boat record',
    value: 'Map + trips',
  },
  {
    label: 'First install',
    value: 'Keys + SignalK',
  },
]

const setupOutcomes = [
  'Creates your shareable captain URL.',
  'Links your boat to maps, trips, and media.',
  'Sets up the first live data path.',
]

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
                Set up your captain page, boat, and first install
              </h1>
              <p class="mt-3 text-base leading-7 text-muted">
                Save this once and the dashboard, public page, and live feed all use the same setup.
              </p>
            </div>

            <div class="grid gap-3">
              <div
                v-for="highlight in setupHighlights"
                :key="highlight.label"
                class="metric-shell rounded-[1.35rem] p-4"
              >
                <p class="text-xs uppercase tracking-[0.24em] text-muted">
                  {{ highlight.label }}
                </p>
                <p class="mt-2 font-display text-xl text-default">{{ highlight.value }}</p>
              </div>
            </div>
          </div>
        </section>

        <UCard
          data-testid="onboarding-explainer"
          class="chart-surface rounded-[1.75rem] shadow-card"
        >
          <template #header>
            <div>
              <h2 class="font-display text-2xl text-default">What this unlocks</h2>
              <p class="mt-2 text-sm text-muted">Each section updates the same boat record.</p>
            </div>
          </template>

          <div class="space-y-3">
            <article
              v-for="item in setupOutcomes"
              :key="item"
              class="rounded-[1.2rem] border border-default/70 bg-default/60 px-4 py-3 text-sm text-muted"
            >
              {{ item }}
            </article>
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
          signalKUrl:
            data?.installations?.[0]?.collectorSignalKUrl ||
            data?.installations?.[0]?.signalKUrl ||
            data?.defaultSignalKUrl ||
            '',
        }"
        @complete="handleComplete"
      />
    </div>
  </div>
</template>
