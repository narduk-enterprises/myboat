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
  <div class="marine-auth-shell grid min-h-[calc(100vh-9rem)] lg:grid-cols-[0.95fr_1.05fr]">
    <div class="marine-auth-aside hidden lg:block">
      <div class="relative z-10 flex h-full flex-col justify-between gap-10 p-10 xl:p-12">
        <div class="space-y-6">
          <div class="marine-kicker w-fit">{{ eyebrow }}</div>
          <AppBrandMark />

          <div class="space-y-4">
            <h1 class="max-w-lg font-display text-5xl leading-none tracking-tight text-white">
              {{ title }}
            </h1>
            <p class="max-w-xl text-base text-primary-50/88">
              {{ description }}
            </p>
          </div>
        </div>

        <div class="grid gap-3">
          <div
            v-for="item in checklist"
            :key="item"
            class="flex items-start gap-3 rounded-[1.35rem] border border-white/14 bg-default/10 px-4 py-4 text-primary-50/88 backdrop-blur"
          >
            <div
              class="mt-0.5 flex size-7 items-center justify-center rounded-full bg-white/12 text-primary-100"
            >
              <UIcon name="i-lucide-check" class="size-4" />
            </div>
            <p class="text-sm leading-6">{{ item }}</p>
          </div>
        </div>
      </div>
    </div>

    <div class="marine-auth-panel flex items-center justify-center px-6 py-10 sm:px-10">
      <div class="w-full max-w-md">
        <slot />
      </div>
    </div>
  </div>
</template>
