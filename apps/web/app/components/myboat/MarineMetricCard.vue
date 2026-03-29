<script setup lang="ts">
withDefaults(
  defineProps<{
    label: string
    value: string
    unit?: string
    icon?: string
    hint?: string
  }>(),
  {
    unit: '',
    icon: '',
    hint: '',
  },
)
</script>

<template>
  <UCard class="metric-shell h-full rounded-[1.25rem] shadow-card sm:rounded-[1.5rem]">
    <div class="flex items-start justify-between gap-3 sm:gap-4">
      <div>
        <p class="text-xs text-muted sm:text-sm">{{ label }}</p>
        <p
          class="mt-2 break-words text-[1.65rem] leading-none font-display font-semibold text-default sm:mt-3 sm:text-3xl"
        >
          {{ value }}
          <span v-if="unit" class="text-sm font-sans text-muted sm:text-base">{{ unit }}</span>
        </p>
        <p v-if="hint" class="mt-2 text-xs text-muted">{{ hint }}</p>
      </div>

      <div
        v-if="icon"
        class="flex size-8 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary sm:size-10"
      >
        <UIcon :name="icon" class="size-4 sm:size-5" />
      </div>
    </div>
  </UCard>
</template>
