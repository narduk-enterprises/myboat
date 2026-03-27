<script setup lang="ts">
definePageMeta({ layout: 'auth' })

useSeo({
  title: 'Finishing Sign In',
  description: 'Completing your authentication callback.',
})

useWebPageSchema({
  name: 'Finishing Sign In',
  description: 'Completing your authentication callback.',
})
</script>

<template>
  <div class="flex w-full items-center justify-center px-4 py-12">
    <AuthExchangePanel />
  </div>
</template>
