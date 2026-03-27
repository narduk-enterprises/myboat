<script setup lang="ts">
const route = useRoute()
const { loggedIn } = useUserSession()

const navLinks = computed(() => [{ label: 'Home', to: '/', icon: 'i-lucide-house' }])
</script>

<template>
  <LayerAppShell>
    <template #header>
      <LayerAppHeader app-name="MyBoat" logo-text="MB" :nav-links="navLinks">
        <template #logo>
          <NuxtLink to="/" class="group">
            <AppBrandMark compact />
          </NuxtLink>
        </template>

        <template #actions>
          <UButton
            v-if="loggedIn"
            to="/dashboard"
            color="primary"
            variant="soft"
            icon="i-lucide-layout-dashboard"
          >
            Dashboard
          </UButton>
          <UButton v-else to="/login" color="primary" variant="soft" icon="i-lucide-log-in">
            Sign in
          </UButton>
        </template>
      </LayerAppHeader>
    </template>

    <div
      :class="[
        route.meta.layout === 'landing' ? '' : 'mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8',
      ]"
    >
      <NuxtLayout>
        <NuxtPage />
      </NuxtLayout>
    </div>

    <template #footer>
      <div role="contentinfo" class="border-t border-default bg-default/80">
        <div
          class="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-6 sm:px-6 lg:px-8 md:flex-row md:items-center md:justify-between"
        >
          <div>
            <p class="font-display text-lg text-default">MyBoat</p>
            <p class="text-sm text-muted">
              Public vessel identity, live telemetry, passages, and device installs in one canonical
              app.
            </p>
          </div>

          <div class="flex items-center gap-3 text-sm text-muted">
            <NuxtLink to="/" class="hover:text-default">Home</NuxtLink>
            <NuxtLink to="/dashboard" class="hover:text-default">Dashboard</NuxtLink>
            <NuxtLink to="/register" class="hover:text-default">Create account</NuxtLink>
          </div>
        </div>
      </div>
    </template>
  </LayerAppShell>
</template>
