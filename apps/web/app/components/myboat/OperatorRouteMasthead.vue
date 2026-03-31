<script setup lang="ts">
withDefaults(
  defineProps<{
    eyebrow?: string
    title: string
    description: string
  }>(),
  {
    eyebrow: '',
  },
)
</script>

<template>
  <section
    class="rounded-[1.5rem] border border-default/70 bg-default/88 px-5 py-5 shadow-card sm:px-6 sm:py-6"
  >
    <div class="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
      <div class="min-w-0">
        <p
          v-if="eyebrow"
          class="text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-muted"
        >
          {{ eyebrow }}
        </p>
        <h1 class="mt-2 font-display text-3xl tracking-tight text-default sm:text-4xl">
          {{ title }}
        </h1>
        <p class="mt-2 max-w-3xl text-sm leading-6 text-muted sm:text-base">
          {{ description }}
        </p>
      </div>

      <div v-if="$slots.actions" class="flex flex-wrap gap-2 xl:justify-end">
        <slot name="actions" />
      </div>
    </div>

    <div v-if="$slots.meta" class="mt-4 border-t border-default/70 pt-4">
      <slot name="meta" />
    </div>
  </section>
</template>
