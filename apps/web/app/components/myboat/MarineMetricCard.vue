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
  <UCard class="metric-shell h-full rounded-[1.5rem] shadow-card">
    <div class="flex items-start justify-between gap-4">
      <div>
        <p class="text-sm text-muted">{{ label }}</p>
        <p class="mt-3 text-3xl font-display font-semibold text-default">
          {{ value }}
          <span v-if="unit" class="text-base font-sans text-muted">{{ unit }}</span>
        </p>
        <p v-if="hint" class="mt-2 text-xs text-muted">{{ hint }}</p>
      </div>

      <div
        v-if="icon"
        class="flex size-10 items-center justify-center rounded-2xl bg-primary/10 text-primary"
      >
        <UIcon :name="icon" class="size-5" />
      </div>
    </div>
  </UCard>
</template>
