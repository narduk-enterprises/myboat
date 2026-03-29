<script setup lang="ts">
const { colorModeIcon, cycleColorMode } = useColorModeToggle()
</script>

<template>
  <LayerChromelessShell>
    <div class="myboat-shell">
      <div class="marine-auth-screen">
        <div
          class="mx-auto flex h-dvh min-h-dvh max-w-[92rem] flex-col overflow-hidden px-4 py-3 sm:px-6 lg:px-8"
        >
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

          <div class="flex min-h-0 flex-1 items-stretch py-4 lg:py-5">
            <slot />
          </div>
        </div>
      </div>
    </div>
  </LayerChromelessShell>
</template>
