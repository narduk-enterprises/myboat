<script setup lang="ts">
withDefaults(
  defineProps<{
    compact?: boolean
  }>(),
  {
    compact: false,
  },
)
</script>

<template>
  <div class="flex items-center gap-3">
    <div
      class="flex items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-card"
      :class="compact ? 'size-9 text-sm font-bold' : 'size-11 text-base font-black'"
    >
      MB
    </div>

    <div class="leading-none">
      <p class="font-display text-sm tracking-[0.24em] text-muted uppercase">MyBoat</p>
      <p class="text-xs text-muted">Live vessel intelligence</p>
    </div>
  </div>
</template>
