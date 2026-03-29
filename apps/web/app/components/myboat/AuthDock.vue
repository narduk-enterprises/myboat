<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    eyebrow: string
    title: string
    description: string
    checklist?: string[]
  }>(),
  {
    checklist: () => [],
  },
)

const dockStats = [
  {
    label: 'Public page',
    title: '@captain',
    detail: 'Share the page when your route and story are ready.',
  },
  {
    label: 'Collector feed',
    title: 'Ready to monitor',
    detail: 'Track install health, ingest, and fresh vessel activity.',
  },
  {
    label: 'Install setup',
    title: 'Keys + access',
    detail: 'Keep credentials, owners, and hardware notes in one place.',
  },
] as const

const quickSignals = [
  'Encrypted sessions',
  'Apple or email access',
  `${props.checklist.length || 3} launch steps`,
] as const
const panelSignals = ['Private workspace', 'Boat + crew controls'] as const
</script>

<template>
  <div
    data-testid="auth-dock-shell"
    class="marine-auth-shell grid h-full min-h-0 w-full lg:grid-cols-[minmax(0,1.04fr)_minmax(34rem,0.96fr)]"
  >
    <div data-testid="auth-dock-aside" class="marine-auth-aside hidden min-h-0 lg:block">
      <div class="relative z-10 flex h-full items-center p-5 xl:p-6">
        <div class="marine-auth-story w-full p-6 xl:p-7">
          <div class="flex items-center justify-between gap-4">
            <div class="marine-kicker w-fit">{{ eyebrow }}</div>
            <div class="marine-auth-chip">Secure access</div>
          </div>

          <div class="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(15rem,0.85fr)]">
            <div class="space-y-5">
              <AppBrandMark />

              <div class="space-y-3">
                <h1
                  class="max-w-2xl font-display text-[2.75rem] leading-none tracking-tight text-default xl:text-5xl"
                >
                  {{ title }}
                </h1>
                <p class="max-w-2xl text-sm leading-6 text-toned xl:text-base xl:leading-7">
                  {{ description }}
                </p>
              </div>

              <div class="flex flex-wrap gap-2">
                <div v-for="signal in quickSignals" :key="signal" class="marine-auth-chip">
                  {{ signal }}
                </div>
              </div>
            </div>

            <div class="space-y-3">
              <div class="marine-auth-note min-h-[11.5rem]">
                <p class="text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-dimmed">
                  Private access
                </p>
                <p class="mt-2.5 font-display text-[1.75rem] leading-none text-default xl:text-3xl">
                  Dashboard
                </p>
                <p class="mt-2.5 text-sm leading-5 text-toned">
                  Open installs, maps, passages, and sharing controls from one workspace.
                </p>
                <div class="mt-4 space-y-1.5">
                  <div class="flex items-center justify-between text-sm text-default">
                    <span>Boat dashboard</span>
                    <span class="font-semibold text-primary">Ready</span>
                  </div>
                  <div class="flex items-center justify-between text-sm text-default">
                    <span>Live feed controls</span>
                    <span class="font-semibold text-primary">Connected</span>
                  </div>
                  <div class="flex items-center justify-between text-sm text-default">
                    <span>Secure sign-in</span>
                    <span class="font-semibold text-primary">Protected</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="mt-6 grid gap-3 lg:grid-cols-3">
            <div v-for="item in dockStats" :key="item.label" class="marine-auth-note">
              <p class="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-dimmed">
                {{ item.label }}
              </p>
              <p class="mt-2.5 font-display text-lg leading-tight text-default xl:text-xl">
                {{ item.title }}
              </p>
              <p class="mt-1.5 text-sm leading-5 text-toned">{{ item.detail }}</p>
            </div>
          </div>

          <div class="mt-6 grid gap-3 md:grid-cols-2">
            <div
              v-for="item in checklist"
              :key="item"
              class="marine-auth-note flex items-start gap-3"
            >
              <div
                class="mt-0.5 flex size-7 items-center justify-center rounded-full border border-default bg-elevated text-primary"
              >
                <UIcon name="i-lucide-check" class="size-3.5" />
              </div>
              <p class="text-sm leading-5 text-default">{{ item }}</p>
            </div>
          </div>

          <div
            class="mt-6 flex items-center justify-between gap-4 border-t border-default/70 pt-4 text-sm text-toned"
          >
            <p>Private access for what you manage. Public pages for what you share.</p>
            <div class="marine-auth-chip">Secure sign-in</div>
          </div>
        </div>
      </div>
    </div>

    <div
      data-testid="auth-dock-panel"
      class="marine-auth-panel flex min-h-0 items-center justify-center px-5 py-4 sm:px-8 sm:py-6 lg:px-10"
    >
      <div class="w-full max-w-[36rem] space-y-4 sm:space-y-5">
        <div
          class="rounded-[1.65rem] border border-primary-200/70 bg-white/76 p-5 shadow-card backdrop-blur-xl lg:hidden"
        >
          <div class="marine-kicker w-fit">{{ eyebrow }}</div>
          <h1 class="mt-4 font-display text-2xl leading-tight text-default">{{ title }}</h1>
          <p class="mt-2 text-sm leading-6 text-toned">{{ description }}</p>
        </div>

        <div class="hidden lg:block">
          <div class="flex flex-wrap gap-2">
            <div v-for="signal in panelSignals" :key="signal" class="marine-auth-chip">
              {{ signal }}
            </div>
          </div>
        </div>

        <slot />

        <div class="grid gap-3 sm:grid-cols-2">
          <div class="marine-auth-note">
            <p class="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-dimmed">
              New here
            </p>
            <p class="mt-2 text-sm leading-6 text-default">
              Create the account first, then connect your boat and first collector.
            </p>
          </div>

          <div class="marine-auth-note">
            <p class="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-dimmed">
              Returning crew
            </p>
            <p class="mt-2 text-sm leading-6 text-default">
              Pick up where you left off with dashboard access, installs, and sharing.
            </p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
