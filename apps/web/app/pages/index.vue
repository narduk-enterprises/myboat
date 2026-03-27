<script setup lang="ts">
definePageMeta({ layout: 'landing' })

useSeo({
  title: 'MyBoat',
  description:
    'A bluewater command surface for captain identity, live telemetry, passages, media, and public boat sharing.',
  ogImage: {
    title: 'MyBoat',
    description:
      'A calm operational surface for live vessel tracking, passage history, device installs, and disciplined public sharing.',
  },
})

useWebPageSchema({
  name: 'MyBoat',
  description:
    'A bluewater command surface for captain identity, live telemetry, passages, media, and public boat sharing.',
})

const { loggedIn } = useUserSession()

const capabilityCards = [
  {
    icon: 'i-lucide-anchor',
    eyebrow: 'Public identity',
    signal: '@captain route',
    title: 'Captain and vessel identity',
    description:
      'Lock the public captain handle, define the primary vessel, and keep one authoritative home for the boat profile.',
  },
  {
    icon: 'i-lucide-radio',
    eyebrow: 'Operational telemetry',
    signal: 'Live + historical',
    title: 'Live telemetry with context',
    description:
      'Treat current position, onboard signals, passages, and historical track memory as one operational record.',
  },
  {
    icon: 'i-lucide-eye',
    eyebrow: 'Disciplined sharing',
    signal: 'Public by choice',
    title: 'Public sharing with discipline',
    description:
      'Publish the surfaces worth sharing while keeping install controls, admin actions, and private history inside the owner dashboard.',
  },
]

const quickSignals = [
  {
    label: 'Public captain URL',
    value: '@captain',
    detail: 'One canonical home for the public-facing vessel story.',
  },
  {
    label: 'SignalK ingest',
    value: 'Ready',
    detail: 'Edge installs, credentials, and reporting posture stay aligned.',
  },
  {
    label: 'Passage memory',
    value: 'Live + logbook',
    detail: 'Current motion and historical crossings sit in the same system.',
  },
]

const workflow = [
  'Create the captain account and claim the public handle.',
  'Define the primary vessel and register the first onboard install.',
  'Issue an ingest key and connect the edge collector or SignalK source.',
  'Review live position, record passages, and publish a clean public captain page.',
]

const productSurfaces = [
  {
    badge: 'Private',
    title: 'Owner dashboard',
    description:
      'Operational board for telemetry posture, installs, passages, and vessel-level detail.',
  },
  {
    badge: 'Public',
    title: 'Public captain page',
    description: 'A shareable route for vessel identity, current readiness, and recent movement.',
  },
  {
    badge: 'Edge',
    title: 'Install control plane',
    description:
      'The ingest edge for API keys, hostnames, SignalK endpoints, and live connection state.',
  },
]

const boundaryRules = [
  {
    title: 'Captain-owned identity',
    description:
      'Public handles, captain headlines, and vessel presence stay tied to one explicit owner record.',
  },
  {
    title: 'Telemetry plus logbook',
    description:
      'Live fixes and voyage memory share the same operating model instead of splitting into separate tools.',
  },
  {
    title: 'Private edge controls',
    description:
      'Install credentials, relay posture, and admin actions stay inside the operational workspace.',
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
                Know where the boat is. Share only what matters.
              </h1>
              <p class="max-w-2xl text-lg text-muted sm:text-xl">
                MyBoat is the calm operating surface for captain identity, live telemetry, passages,
                onboard installs, and the public story that follows the boat.
              </p>
            </div>

            <div class="flex flex-wrap gap-3">
              <UButton
                :to="loggedIn ? '/dashboard' : '/register'"
                color="primary"
                size="xl"
                icon="i-lucide-ship-wheel"
              >
                {{ loggedIn ? 'Open dashboard' : 'Create account' }}
              </UButton>
              <UButton
                :to="loggedIn ? '/dashboard/onboarding' : '/explore'"
                color="neutral"
                variant="soft"
                size="xl"
                :icon="loggedIn ? 'i-lucide-navigation' : 'i-lucide-compass'"
              >
                {{ loggedIn ? 'Refine boat setup' : 'Explore public boats' }}
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
                    <p class="font-display text-2xl text-default">Operational board</p>
                    <p class="mt-1 text-sm text-muted">
                      One product surface for vessel state, telemetry posture, and public presence.
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
                <p class="font-display text-lg text-default">Typical operating rhythm</p>
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
            <p class="font-display text-2xl text-default">What the product actually contains</p>
            <p class="mt-2 text-sm text-muted">
              MyBoat is not a generic starter. It is a marine-aware system with clear public and
              private boundaries.
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
            <p class="font-display text-2xl text-default">Three surfaces, one system</p>
            <p class="mt-2 text-sm text-muted">
              Each part of the product has a job, but the underlying model stays coherent.
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
