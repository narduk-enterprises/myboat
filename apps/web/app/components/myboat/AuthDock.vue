<script setup lang="ts">
withDefaults(
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
</script>

<template>
  <div
    data-testid="auth-dock-shell"
    class="marine-auth-shell grid min-h-[calc(100vh-9rem)] lg:grid-cols-[0.98fr_1.02fr]"
  >
    <div data-testid="auth-dock-aside" class="marine-auth-aside hidden lg:block">
      <div class="relative z-10 flex h-full items-center p-8 xl:p-10">
        <div class="marine-auth-story w-full p-8 xl:p-9">
          <div class="flex items-center justify-between gap-4">
            <div class="marine-kicker w-fit">{{ eyebrow }}</div>
            <div
              class="rounded-full border border-default bg-default/70 px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-muted"
            >
              Fleet ready
            </div>
          </div>

          <div class="mt-8 flex items-start justify-between gap-6">
            <div class="space-y-6">
              <AppBrandMark />

              <div class="space-y-4">
                <h1 class="max-w-xl font-display text-5xl leading-none tracking-tight text-default">
                  {{ title }}
                </h1>
                <p class="max-w-2xl text-base leading-7 text-muted">
                  {{ description }}
                </p>
              </div>
            </div>

            <div
              class="rounded-[1.5rem] border border-default bg-elevated/90 px-4 py-4 text-right text-default shadow-[0_24px_60px_-42px_rgb(15_23_42_/_0.24)] backdrop-blur-md"
            >
              <p class="text-[0.68rem] uppercase tracking-[0.22em] text-muted">Private route</p>
              <p class="mt-2 font-display text-2xl text-default">Bridge auth</p>
              <p class="mt-2 max-w-[10rem] text-sm leading-5 text-muted">
                Secure captain access for installs, passages, and public updates.
              </p>
            </div>
          </div>

          <div class="mt-10 grid gap-4">
            <div class="grid gap-3 sm:grid-cols-3">
              <div
                class="rounded-[1.35rem] border border-default bg-elevated/88 px-4 py-4 text-default shadow-[0_20px_45px_-38px_rgb(15_23_42_/_0.24)] backdrop-blur-xl"
              >
                <p class="text-[0.68rem] uppercase tracking-[0.22em] text-muted">Public route</p>
                <p class="mt-3 font-display text-xl text-default">@captain</p>
                <p class="mt-2 text-sm leading-5 text-muted">
                  Shared vessel page stays current while private install controls stay sealed.
                </p>
              </div>

              <div
                class="rounded-[1.35rem] border border-default bg-elevated/88 px-4 py-4 text-default shadow-[0_20px_45px_-38px_rgb(15_23_42_/_0.24)] backdrop-blur-xl"
              >
                <p class="text-[0.68rem] uppercase tracking-[0.22em] text-muted">Live posture</p>
                <p class="mt-3 font-display text-xl text-default">SignalK ready</p>
                <p class="mt-2 text-sm leading-5 text-muted">
                  Watch telemetry health, route freshness, and dockside readiness in one pass.
                </p>
              </div>

              <div
                class="rounded-[1.35rem] border border-default bg-elevated/88 px-4 py-4 text-default shadow-[0_20px_45px_-38px_rgb(15_23_42_/_0.24)] backdrop-blur-xl"
              >
                <p class="text-[0.68rem] uppercase tracking-[0.22em] text-muted">Edge control</p>
                <p class="mt-3 font-display text-xl text-default">Ingest keys</p>
                <p class="mt-2 text-sm leading-5 text-muted">
                  Keep collector credentials and the relay path aligned before the boat reports.
                </p>
              </div>
            </div>

            <div class="grid gap-3">
              <div
                v-for="item in checklist"
                :key="item"
                class="flex items-start gap-3 rounded-[1.35rem] border border-default bg-default/86 px-4 py-4 text-default shadow-[0_20px_45px_-40px_rgb(15_23_42_/_0.22)] backdrop-blur-xl"
              >
                <div
                  class="mt-0.5 flex size-7 items-center justify-center rounded-full border border-default bg-elevated text-primary"
                >
                  <UIcon name="i-lucide-check" class="size-4" />
                </div>
                <p class="text-sm leading-6">{{ item }}</p>
              </div>
            </div>
          </div>

          <div
            class="mt-10 flex items-center justify-between gap-4 border-t border-default/70 pt-5 text-sm text-muted"
          >
            <p>Designed for the captain view that connects public presence to live operations.</p>
            <div class="rounded-full border border-default bg-default/70 px-3 py-1 text-default">
              Auth surface v2
            </div>
          </div>
        </div>
      </div>
    </div>

    <div
      data-testid="auth-dock-panel"
      class="marine-auth-panel flex items-center justify-center px-6 py-10 sm:px-10"
    >
      <div class="w-full max-w-md space-y-5 rounded-[2rem]">
        <div
          class="rounded-[1.65rem] border border-primary-200/70 bg-white/72 px-5 py-4 shadow-[0_24px_70px_-56px_rgb(37_99_235_/_0.65)] backdrop-blur-xl lg:hidden"
        >
          <div class="marine-kicker">{{ eyebrow }}</div>
          <h1 class="mt-4 font-display text-2xl leading-tight text-default">{{ title }}</h1>
          <p class="mt-2 text-sm leading-6 text-muted">{{ description }}</p>
        </div>

        <slot />
      </div>
    </div>
  </div>
</template>
