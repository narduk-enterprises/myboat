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
  <div class="flex items-center" :class="compact ? 'gap-2.5 sm:gap-3' : 'gap-4'">
    <div
      class="brand-orbit flex items-center justify-center overflow-hidden rounded-[1.35rem] border border-primary/15 bg-default/72 shadow-card"
      :class="compact ? 'size-9 p-1.25 sm:size-10 sm:p-1.5' : 'size-12 p-2'"
    >
      <img src="/favicon.svg" alt="" class="size-full" />
    </div>

    <div class="leading-none">
      <p
        class="font-display uppercase text-default"
        :class="
          compact
            ? 'text-[0.72rem] tracking-[0.28em] sm:text-sm sm:tracking-[0.32em]'
            : 'text-sm tracking-[0.32em]'
        "
      >
        MyBoat
      </p>
      <p class="text-xs text-muted" :class="compact ? 'mt-0.5 hidden sm:block' : 'mt-1'">
        Bluewater vessel intelligence
      </p>
    </div>
  </div>
</template>
