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
    class="marine-auth-shell grid min-h-[100dvh] w-full lg:grid-cols-[0.98fr_1.02fr]"
  >
    <div data-testid="auth-dock-aside" class="marine-auth-aside hidden lg:block">
      <div class="relative z-10 flex h-full items-center p-8 xl:p-10">
        <div class="marine-auth-story w-full p-8 xl:p-9">
          <div class="flex items-center justify-between gap-4">
            <div class="marine-kicker w-fit">{{ eyebrow }}</div>
            <div
              class="rounded-full border border-default bg-default/70 px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-muted"
            >
              Secure access
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
              <p class="text-[0.68rem] uppercase tracking-[0.22em] text-muted">Private access</p>
              <p class="mt-2 font-display text-2xl text-default">Dashboard</p>
              <p class="mt-2 max-w-[10rem] text-sm leading-5 text-muted">
                Manage installs, trips, and sharing.
              </p>
            </div>
          </div>

          <div class="mt-10 grid gap-4">
            <div class="grid gap-3 sm:grid-cols-3">
              <div
                class="rounded-[1.35rem] border border-default bg-elevated/88 px-4 py-4 text-default shadow-[0_20px_45px_-38px_rgb(15_23_42_/_0.24)] backdrop-blur-xl"
              >
                <p class="text-[0.68rem] uppercase tracking-[0.22em] text-muted">Public page</p>
                <p class="mt-3 font-display text-xl text-default">@captain</p>
                <p class="mt-2 text-sm leading-5 text-muted">Your captain and boat page.</p>
              </div>

              <div
                class="rounded-[1.35rem] border border-default bg-elevated/88 px-4 py-4 text-default shadow-[0_20px_45px_-38px_rgb(15_23_42_/_0.24)] backdrop-blur-xl"
              >
                <p class="text-[0.68rem] uppercase tracking-[0.22em] text-muted">Live feed</p>
                <p class="mt-3 font-display text-xl text-default">Collector ready</p>
                <p class="mt-2 text-sm leading-5 text-muted">
                  Watch feed health and recent activity.
                </p>
              </div>

              <div
                class="rounded-[1.35rem] border border-default bg-elevated/88 px-4 py-4 text-default shadow-[0_20px_45px_-38px_rgb(15_23_42_/_0.24)] backdrop-blur-xl"
              >
                <p class="text-[0.68rem] uppercase tracking-[0.22em] text-muted">Install setup</p>
                <p class="mt-3 font-display text-xl text-default">Keys + ingest</p>
                <p class="mt-2 text-sm leading-5 text-muted">
                  Manage device labels and connection details.
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
            <p>Private access for what you manage. Public pages for what you share.</p>
            <div class="rounded-full border border-default bg-default/70 px-3 py-1 text-default">
              Secure sign-in
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
