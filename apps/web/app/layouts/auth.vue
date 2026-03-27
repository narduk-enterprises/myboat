<script setup lang="ts">
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Color Mode types depend on build-time module resolution
const colorMode = useColorMode() as any

const colorModeIcon = computed(() => {
  if (colorMode.preference === 'system') return 'i-lucide-monitor'
  return colorMode.value === 'dark' ? 'i-lucide-moon' : 'i-lucide-sun'
})

function cycleColorMode() {
  const modes = ['system', 'light', 'dark'] as const
  const index = modes.indexOf(colorMode.preference as (typeof modes)[number])
  colorMode.preference = modes[(index + 1) % modes.length]!
}
</script>

<template>
  <div class="myboat-shell">
    <LayerAppShell>
      <div class="marine-auth-screen">
        <div class="mx-auto flex min-h-screen max-w-7xl flex-col px-4 py-4 sm:px-6 lg:px-8">
          <div class="flex items-center justify-between gap-4">
            <NuxtLink to="/" class="shrink-0">
              <AppBrandMark compact />
            </NuxtLink>

            <div class="flex items-center gap-2">
              <UButton to="/explore" color="neutral" variant="ghost" icon="i-lucide-compass">
                <span class="hidden sm:inline">Explore</span>
              </UButton>
              <UButton
                :icon="colorModeIcon"
                variant="ghost"
                color="neutral"
                aria-label="Toggle color mode"
                @click="cycleColorMode"
              />
            </div>
          </div>

          <div class="flex flex-1 items-center py-6 lg:py-10">
            <slot />
          </div>
        </div>
      </div>
    </LayerAppShell>
  </div>
</template>
