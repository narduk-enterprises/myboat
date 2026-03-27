<script setup lang="ts">
withDefaults(
  defineProps<{
    title: string
    description?: string
    icon?: string
    imageSrc?: string
    compact?: boolean
  }>(),
  {
    description: '',
    icon: '',
    imageSrc: '/images/empty-harbor.webp',
    compact: false,
  },
)
</script>

<template>
  <div :class="compact ? 'py-6' : 'py-10'" class="text-center">
    <div
      v-if="imageSrc"
      class="mx-auto mb-5 max-w-44 overflow-hidden rounded-[1.5rem] border border-primary/12 bg-default/72 p-2 shadow-card"
    >
      <NuxtImg :src="imageSrc" alt="" width="512" height="512" class="w-full rounded-[1.15rem]" />
    </div>
    <div
      v-if="icon"
      class="mx-auto -mt-10 mb-4 flex size-12 items-center justify-center rounded-2xl border border-primary/12 bg-primary/10 text-primary shadow-card"
      aria-hidden="true"
    >
      <UIcon :name="icon" class="size-5" />
    </div>
    <p class="font-display text-lg text-default">{{ title }}</p>
    <p v-if="description" class="mx-auto mt-2 max-w-sm text-sm text-muted">{{ description }}</p>
    <div v-if="$slots.default" class="mt-5">
      <slot />
    </div>
  </div>
</template>
