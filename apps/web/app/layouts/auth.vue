<script setup lang="ts">
const { colorModeIcon, cycleColorMode } = useColorModeToggle()
</script>

<template>
  <LayerChromelessShell>
    <div class="myboat-shell">
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
    </div>
  </LayerChromelessShell>
</template>
