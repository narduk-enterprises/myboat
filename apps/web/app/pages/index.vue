<script setup lang="ts">
definePageMeta({ layout: 'landing', middleware: ['guest'] })

useSeo({
  title: 'MyBoat',
  description: 'Track your boat, manage onboard installs, and share a clean public vessel page.',
  ogImage: {
    title: 'MyBoat',
    description:
      'Live vessel tracking, trip history, and public sharing with private controls kept in the dashboard.',
  },
})

useWebPageSchema({
  name: 'MyBoat',
  description: 'Track your boat, manage onboard installs, and share a clean public vessel page.',
})

const capabilityCards = [
  {
    icon: 'i-lucide-anchor',
    eyebrow: 'Public page',
    signal: '@captain/boat',
    title: 'Claim one shareable home',
    description: 'Your captain handle and primary boat stay on one clean public link.',
  },
  {
    icon: 'i-lucide-radio',
    eyebrow: 'Live view',
    signal: 'Now + history',
    title: 'See the full picture',
    description: 'Position, onboard signals, and trip history sit in the same place.',
  },
  {
    icon: 'i-lucide-eye',
    eyebrow: 'Private controls',
    signal: 'Share by choice',
    title: 'Keep the right things private',
    description:
      'Installs, keys, and admin actions stay in the dashboard while public pages stay simple.',
  },
]

const quickSignals = [
  {
    label: 'Public page',
    value: '@captain/boat',
    detail: 'One link to share.',
  },
  {
    label: 'Live feed',
    value: 'Collector ready',
    detail: 'Connect when hardware is ready.',
  },
  {
    label: 'Trips',
    value: 'Live + logbook',
    detail: 'See what is happening now and what happened last.',
  },
]

const workflow = [
  {
    title: 'Create your account',
    detail: 'Claim your captain handle.',
  },
  {
    title: 'Add your boat',
    detail: 'Set the name, type, and home port.',
  },
  {
    title: 'Connect a feed',
    detail: 'Launch the collector and point it at your onboard feed.',
  },
  {
    title: 'Share when ready',
    detail: 'Open the dashboard and publish the public page.',
  },
]

const productSurfaces = [
  {
    badge: 'Private',
    title: 'Dashboard',
    description: 'Manage boats, trips, media, and installs.',
  },
  {
    badge: 'Public',
    title: 'Boat page',
    description: 'Share the boat, current status, and recent movement.',
  },
  {
    badge: 'Edge',
    title: 'Install setup',
    description: 'Keep keys, hostnames, and feed settings in one place.',
  },
]

const boundaryRules = [
  {
    title: 'One owner record',
    description: 'The captain profile and primary boat stay connected.',
  },
  {
    title: 'Live plus history',
    description: 'Current fixes and saved trips live together.',
  },
  {
    title: 'Private install controls',
    description: 'Keys and device settings stay in the dashboard.',
  },
]
</script>

<template>
  <div class="space-y-16 pb-16 lg:space-y-24 lg:pb-24">
    <section class="mx-auto max-w-7xl px-4 pt-6 sm:px-6 lg:px-8">
      <div data-testid="landing-hero" class="marine-hero px-6 py-10 sm:px-10 lg:px-12 lg:py-16">
        <div class="relative z-10 grid gap-10 lg:grid-cols-[1.08fr_0.92fr] lg:items-center">
          <div class="space-y-8">
            <div class="marine-kicker w-fit">Bluewater vessel intelligence</div>

            <div class="space-y-5">
              <h1
                class="max-w-4xl font-display text-5xl leading-none tracking-tight text-default sm:text-6xl lg:text-7xl"
              >
                Track the boat. Share the right parts.
              </h1>
              <p class="max-w-2xl text-lg text-muted sm:text-xl">
                MyBoat keeps live position, trips, installs, and a public boat page in one place.
              </p>
            </div>

            <div class="flex flex-wrap gap-3">
              <UButton to="/register" color="primary" size="xl" icon="i-lucide-ship-wheel">
                Create account
              </UButton>
              <UButton
                to="/explore"
                color="neutral"
                variant="soft"
                size="xl"
                icon="i-lucide-compass"
              >
                Explore public boats
              </UButton>
            </div>

            <div data-testid="landing-quick-signals" class="grid gap-3 sm:grid-cols-3">
              <div
                v-for="signal in quickSignals"
                :key="signal.label"
                class="metric-shell rounded-[1.4rem] p-4 backdrop-blur"
              >
                <p class="text-xs uppercase tracking-[0.24em] text-muted">{{ signal.label }}</p>
                <p class="mt-3 font-display text-2xl text-default">{{ signal.value }}</p>
                <p class="mt-2 text-xs text-muted">{{ signal.detail }}</p>
              </div>
            </div>
          </div>

          <div class="space-y-4">
            <UCard
              data-testid="landing-operational-board"
              class="chart-surface-strong rounded-[2rem]"
            >
              <template #header>
                <div class="relative z-10 flex items-center justify-between">
                  <div>
                    <p class="font-display text-2xl text-default">Live vessel board</p>
                    <p class="mt-1 text-sm text-muted">
                      A quick read on position, speed, wind, and depth.
                    </p>
                  </div>
                  <UBadge color="primary" variant="soft">Live-capable</UBadge>
                </div>
              </template>

              <div class="relative z-10 grid gap-3 sm:grid-cols-2">
                <MarineMetricCard
                  label="Current fix"
                  value="29°18'15&quot;N"
                  icon="i-lucide-navigation"
                />
                <MarineMetricCard
                  label="Speed over ground"
                  value="6.8"
                  unit="kts"
                  icon="i-lucide-gauge"
                />
                <MarineMetricCard
                  label="Apparent wind"
                  value="17.2"
                  unit="kts"
                  icon="i-lucide-wind"
                />
                <MarineMetricCard label="Depth" value="12.4" unit="ft" icon="i-lucide-waves" />
              </div>
            </UCard>

            <UCard class="chart-surface rounded-[1.75rem]">
              <template #header>
                <p class="font-display text-lg text-default">Start in four steps</p>
              </template>
              <ol class="space-y-3 text-sm text-muted">
                <li
                  v-for="(step, index) in workflow"
                  :key="step.title"
                  class="flex gap-3 rounded-[1.2rem] border border-default/70 bg-default/60 px-3 py-3"
                >
                  <span
                    class="mt-0.5 inline-flex size-6 items-center justify-center rounded-full bg-primary/10 text-primary"
                    >{{ index + 1 }}</span
                  >
                  <div class="min-w-0">
                    <p class="font-medium text-default">{{ step.title }}</p>
                    <p class="mt-1 text-sm text-muted">{{ step.detail }}</p>
                  </div>
                </li>
              </ol>
            </UCard>
          </div>
        </div>
      </div>
    </section>

    <section class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      <div class="grid gap-5 lg:grid-cols-3">
        <UCard
          v-for="card in capabilityCards"
          :key="card.title"
          class="chart-surface rounded-[1.75rem]"
        >
          <div class="space-y-5">
            <div class="flex items-start justify-between gap-4">
              <div
                class="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary"
              >
                <UIcon :name="card.icon" class="size-5" />
              </div>
              <UBadge color="neutral" variant="soft">{{ card.signal }}</UBadge>
            </div>
            <div>
              <p class="text-xs uppercase tracking-[0.24em] text-muted">{{ card.eyebrow }}</p>
              <h2 class="font-display text-2xl text-default">{{ card.title }}</h2>
              <p class="mt-2 text-sm text-muted">{{ card.description }}</p>
            </div>
          </div>
        </UCard>
      </div>
    </section>

    <section class="mx-auto grid max-w-7xl gap-5 px-4 sm:px-6 lg:grid-cols-[0.92fr_1.08fr] lg:px-8">
      <UCard class="chart-surface rounded-[1.75rem]">
        <template #header>
          <div>
            <p class="font-display text-2xl text-default">What you get</p>
            <p class="mt-2 text-sm text-muted">
              A private dashboard, a public page, and a clean install path.
            </p>
          </div>
        </template>

        <div class="grid gap-3">
          <article
            v-for="rule in boundaryRules"
            :key="rule.title"
            class="metric-shell rounded-[1.35rem] p-4"
          >
            <p class="font-display text-lg text-default">{{ rule.title }}</p>
            <p class="mt-2 text-sm text-muted">{{ rule.description }}</p>
          </article>
        </div>
      </UCard>

      <UCard data-testid="landing-surface-grid" class="chart-surface rounded-[1.75rem]">
        <template #header>
          <div>
            <p class="font-display text-2xl text-default">One boat, three views</p>
            <p class="mt-2 text-sm text-muted">
              Private controls, public sharing, and onboard setup stay connected.
            </p>
          </div>
        </template>

        <div class="grid gap-4 md:grid-cols-3">
          <article
            v-for="surface in productSurfaces"
            :key="surface.title"
            class="metric-shell rounded-[1.4rem] p-4"
          >
            <UBadge color="primary" variant="soft">{{ surface.badge }}</UBadge>
            <p class="font-display text-lg text-default">{{ surface.title }}</p>
            <p class="mt-2 text-sm text-muted">{{ surface.description }}</p>
          </article>
        </div>
      </UCard>
    </section>
  </div>
</template>
