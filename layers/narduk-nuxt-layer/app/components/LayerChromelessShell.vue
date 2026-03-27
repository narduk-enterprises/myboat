<script setup lang="ts">
/**
 * Minimal shell for routes that own the full viewport (auth docks, onboarding
 * heroes, branded one-off surfaces). Provides UApp, skip link, and a single
 * main landmark without header/footer slots or flex chrome.
 */
</script>

<template>
  <UApp>
    <ULink
      to="#main-content"
      class="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-100 focus:px-4 focus:py-2 focus:bg-primary focus:text-white focus:rounded-lg"
    >
      Skip to content
    </ULink>

    <!-- eslint-disable-next-line narduk/no-native-layout -- layer scaffold: semantic landmark element -->
    <main id="main-content" class="min-h-dvh w-full">
      <slot />
    </main>
  </UApp>
</template>
