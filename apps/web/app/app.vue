<script setup lang="ts">
const route = useRoute()
const { loggedIn } = useUserSession()

const navLinks = computed(() =>
  loggedIn.value
    ? [
        { label: 'Home', to: '/', icon: 'i-lucide-house' },
        { label: 'Dashboard', to: '/dashboard', icon: 'i-lucide-layout-dashboard' },
        { label: 'Boat setup', to: '/dashboard/onboarding', icon: 'i-lucide-anchor' },
      ]
    : [
        { label: 'Home', to: '/', icon: 'i-lucide-house' },
        { label: 'Create account', to: '/register', icon: 'i-lucide-user-round-plus' },
      ],
)

const userMenuLinks = [
  { label: 'Dashboard', to: '/dashboard', icon: 'i-lucide-layout-dashboard' },
  { label: 'Boat setup', to: '/dashboard/onboarding', icon: 'i-lucide-anchor' },
]

const footerLinks = computed(() =>
  loggedIn.value
    ? [
        { label: 'Dashboard', to: '/dashboard' },
        { label: 'Boat setup', to: '/dashboard/onboarding' },
        { label: 'Home', to: '/' },
      ]
    : [
        { label: 'Home', to: '/' },
        { label: 'Sign in', to: '/login' },
        { label: 'Create account', to: '/register' },
      ],
)
</script>

<template>
  <div class="myboat-shell">
    <LayerAppShell>
      <template #header>
        <div class="shell-header">
          <LayerAppHeader app-name="MyBoat" logo-text="MB" :nav-links="navLinks">
            <template #logo>
              <NuxtLink to="/" class="group">
                <AppBrandMark compact />
              </NuxtLink>
            </template>

            <template #actions>
              <AppUserMenu v-if="loggedIn" :menu-links="userMenuLinks" logout-redirect="/" />
              <UButton v-else to="/login" color="primary" icon="i-lucide-log-in">Sign in</UButton>
            </template>
          </LayerAppHeader>
        </div>
      </template>

      <div
        :class="[
          route.meta.layout === 'landing'
            ? ''
            : 'mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10',
        ]"
      >
        <NuxtLayout>
          <NuxtPage />
        </NuxtLayout>
      </div>

      <template #footer>
        <div role="contentinfo" class="shell-footer border-t border-default/70">
          <div
            class="mx-auto grid max-w-7xl gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:px-8"
          >
            <div class="space-y-4">
              <AppBrandMark />
              <p class="max-w-2xl text-sm text-muted">
                A bluewater operations surface for captain identity, live vessel tracking, passages,
                onboard installs, and the public story you choose to share.
              </p>
            </div>

            <div class="flex flex-wrap items-start gap-4 text-sm text-muted lg:justify-end">
              <NuxtLink
                v-for="link in footerLinks"
                :key="link.to"
                :to="link.to"
                class="rounded-full border border-default/60 px-4 py-2 transition hover:border-primary/30 hover:text-default"
              >
                {{ link.label }}
              </NuxtLink>
            </div>
          </div>
        </div>
      </template>
    </LayerAppShell>
  </div>
</template>
