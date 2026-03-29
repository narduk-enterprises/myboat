<script setup lang="ts">
const config = useRuntimeConfig()

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

const canUseApple = computed(
  () => config.public.authBackend === 'supabase' && config.public.authProviders.includes('apple'),
)
const quickSignals = [
  'Encrypted sessions',
  canUseApple.value ? 'Apple or email access' : 'Email access',
  `${props.checklist.length || 3} launch steps`,
] as const
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

          <div class="mt-6 space-y-5">
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

            <div v-if="checklist.length" class="grid gap-3">
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

            <div class="marine-auth-note">
              <p class="text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-dimmed">
                Private workspace
              </p>
              <p class="mt-2.5 font-display text-[1.75rem] leading-none text-default xl:text-3xl">
                Boat dashboard
              </p>
              <p class="mt-2.5 text-sm leading-6 text-toned">
                Keep installs, live position, passages, and sharing controls in one calm surface.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div
      data-testid="auth-dock-panel"
      class="marine-auth-panel flex min-h-0 items-start justify-center px-5 py-4 sm:px-8 sm:py-6 lg:items-center lg:px-10"
    >
      <div class="w-full max-w-[36rem] space-y-3 sm:space-y-4">
        <div class="flex flex-wrap items-center gap-2 px-1 lg:hidden">
          <div class="flex flex-wrap items-center gap-2">
            <div class="marine-kicker w-fit">{{ eyebrow }}</div>
            <div class="marine-auth-chip">{{ canUseApple ? 'Apple first' : 'Email access' }}</div>
          </div>
        </div>

        <slot />
      </div>
    </div>
  </div>
</template>
