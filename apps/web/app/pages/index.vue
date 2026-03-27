<script setup lang="ts">
definePageMeta({ layout: 'landing' })

useSeo({
  title: 'MyBoat',
  description:
    'A marine-aware command surface for vessel identity, live telemetry, passages, media, and public sharing.',
  ogImage: {
    title: 'MyBoat',
    description:
      'A calm operational surface for live vessel tracking, passage history, device installs, and public sharing.',
  },
})

useWebPageSchema({
  name: 'MyBoat',
  description:
    'A marine-aware command surface for vessel identity, live telemetry, passages, media, and public sharing.',
})

const capabilityCards = [
  {
    icon: 'i-lucide-anchor',
    title: 'Vessel-first identity',
    description:
      'Lock a public captain handle, define the primary vessel, and keep one canonical home for the boat profile.',
  },
  {
    icon: 'i-lucide-ship-wheel',
    title: 'Live and historical context',
    description:
      'Frame live telemetry, last known position, passages, and route memory as one operational story.',
  },
  {
    icon: 'i-lucide-map',
    title: 'Public sharing with discipline',
    description:
      'Expose only the surfaces that should be public while keeping private dashboards and install controls secured.',
  },
]

const workflow = [
  'Create an account and lock the captain handle.',
  'Define the vessel and the first SignalK-capable device install.',
  'Issue an ingest key and connect the edge collector.',
  'Track the live position, review passages, and publish a clean public profile.',
]
</script>

<template>
  <div class="bg-default">
    <section class="marine-hero relative overflow-hidden">
      <div
        class="mx-auto grid max-w-7xl gap-12 px-4 py-20 sm:px-6 lg:grid-cols-[1.2fr_0.8fr] lg:px-8 lg:py-28"
      >
        <div class="space-y-8">
          <div
            class="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/8 px-4 py-2 text-sm text-primary"
          >
            <UIcon name="i-lucide-radio" class="size-4" />
            Canonical home for mybo.at
          </div>

          <div class="space-y-5">
            <h1
              class="max-w-3xl font-display text-5xl leading-none tracking-tight text-default sm:text-6xl lg:text-7xl"
            >
              Calm command for the boat, not generic app scaffolding.
            </h1>
            <p class="max-w-2xl text-lg text-muted sm:text-xl">
              MyBoat keeps vessel identity, live telemetry, passages, media, and public sharing in
              one coherent operating surface built on a Cloudflare-safe Nuxt platform.
            </p>
          </div>

          <div class="flex flex-wrap gap-3">
            <UButton to="/register" color="primary" size="xl" icon="i-lucide-anchor">
              Create account
            </UButton>
            <UButton
              to="/dashboard"
              color="neutral"
              variant="soft"
              size="xl"
              icon="i-lucide-layout-dashboard"
            >
              Open dashboard
            </UButton>
          </div>
        </div>

        <div class="space-y-4">
          <UCard class="border-primary/20 bg-default/80 shadow-overlay backdrop-blur">
            <template #header>
              <div class="flex items-center justify-between">
                <p class="font-display text-xl text-default">Operational center</p>
                <UBadge color="success" variant="soft">Live-capable</UBadge>
              </div>
            </template>

            <div class="grid gap-3 sm:grid-cols-2">
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

          <UCard class="border-default/80 bg-elevated/70 shadow-card">
            <template #header>
              <p class="font-display text-lg text-default">Typical workflow</p>
            </template>
            <ol class="space-y-3 text-sm text-muted">
              <li v-for="step in workflow" :key="step" class="flex gap-3">
                <span
                  class="mt-0.5 inline-flex size-6 items-center justify-center rounded-full bg-primary/10 text-primary"
                  >•</span
                >
                <span>{{ step }}</span>
              </li>
            </ol>
          </UCard>
        </div>
      </div>
    </section>

    <section class="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
      <div class="grid gap-5 lg:grid-cols-3">
        <UCard
          v-for="card in capabilityCards"
          :key="card.title"
          class="border-default/80 bg-default/90 shadow-card"
        >
          <div class="space-y-4">
            <div
              class="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary"
            >
              <UIcon :name="card.icon" class="size-5" />
            </div>
            <div>
              <h2 class="font-display text-2xl text-default">{{ card.title }}</h2>
              <p class="mt-2 text-sm text-muted">{{ card.description }}</p>
            </div>
          </div>
        </UCard>
      </div>
    </section>
  </div>
</template>
