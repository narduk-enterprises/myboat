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
  <div class="flex items-center" :class="compact ? 'gap-3' : 'gap-4'">
    <div
      class="brand-orbit flex items-center justify-center overflow-hidden rounded-[1.35rem] border border-primary/15 bg-default/72 shadow-card"
      :class="compact ? 'size-10 p-1.5' : 'size-12 p-2'"
    >
      <img src="/favicon.svg" alt="" class="size-full" />
    </div>

    <div class="leading-none">
      <p class="font-display text-sm tracking-[0.32em] text-default uppercase">MyBoat</p>
      <p class="mt-1 text-xs text-muted">Bluewater vessel intelligence</p>
    </div>
  </div>
</template>
