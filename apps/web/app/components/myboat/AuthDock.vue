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
      <div class="relative z-10 flex h-full flex-col justify-between gap-10 p-10 xl:p-12">
        <div class="space-y-6">
          <div class="marine-kicker w-fit">{{ eyebrow }}</div>
          <AppBrandMark />

          <div class="space-y-4">
            <h1 class="max-w-xl font-display text-5xl leading-none tracking-tight text-white">
              {{ title }}
            </h1>
            <p class="max-w-2xl text-base leading-7 text-primary-50/84">
              {{ description }}
            </p>
          </div>
        </div>

        <div class="grid gap-4">
          <div class="grid gap-3 sm:grid-cols-3">
            <div
              class="rounded-[1.3rem] border border-white/12 bg-default/10 px-4 py-4 text-primary-50/90 backdrop-blur-md"
            >
              <p class="text-[0.68rem] uppercase tracking-[0.22em] text-primary-100/70">
                Public route
              </p>
              <p class="mt-3 font-display text-xl text-white">@captain</p>
            </div>

            <div
              class="rounded-[1.3rem] border border-white/12 bg-default/10 px-4 py-4 text-primary-50/90 backdrop-blur-md"
            >
              <p class="text-[0.68rem] uppercase tracking-[0.22em] text-primary-100/70">
                Live posture
              </p>
              <p class="mt-3 font-display text-xl text-white">SignalK ready</p>
            </div>

            <div
              class="rounded-[1.3rem] border border-white/12 bg-default/10 px-4 py-4 text-primary-50/90 backdrop-blur-md"
            >
              <p class="text-[0.68rem] uppercase tracking-[0.22em] text-primary-100/70">
                Edge control
              </p>
              <p class="mt-3 font-display text-xl text-white">Ingest keys</p>
            </div>
          </div>

          <div class="grid gap-3">
            <div
              v-for="item in checklist"
              :key="item"
              class="flex items-start gap-3 rounded-[1.35rem] border border-white/12 bg-default/10 px-4 py-4 text-primary-50/88 backdrop-blur-md"
            >
              <div
                class="mt-0.5 flex size-7 items-center justify-center rounded-full bg-white/10 text-primary-100"
              >
                <UIcon name="i-lucide-check" class="size-4" />
              </div>
              <p class="text-sm leading-6">{{ item }}</p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div
      data-testid="auth-dock-panel"
      class="marine-auth-panel flex items-center justify-center px-6 py-10 sm:px-10"
    >
      <div class="w-full max-w-md rounded-[2rem]">
        <slot />
      </div>
    </div>
  </div>
</template>
