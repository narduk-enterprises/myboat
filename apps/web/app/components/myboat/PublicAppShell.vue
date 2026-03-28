<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    fullBleed?: boolean
  }>(),
  {
    fullBleed: false,
  },
)

const { footerGroups, loggedIn, publicNavLinks, userMenuLinks } = useMyBoatShell()
</script>

<template>
  <div class="myboat-shell">
    <LayerAppShell>
      <template #header>
        <div class="shell-header">
          <LayerAppHeader app-name="MyBoat" logo-text="MB" :nav-links="publicNavLinks">
            <template #logo>
              <NuxtLink to="/" class="group">
                <AppBrandMark compact />
              </NuxtLink>
            </template>

            <template #actions>
              <AppUserMenu
                v-if="loggedIn"
                :menu-links="userMenuLinks"
                logout-redirect="/"
                :show-admin-link="true"
              />

              <div v-else class="hidden items-center gap-2 sm:flex">
                <UButton to="/login" color="neutral" variant="ghost" icon="i-lucide-log-in">
                  Sign in
                </UButton>
                <UButton to="/register" color="primary" icon="i-lucide-user-round-plus">
                  Create account
                </UButton>
              </div>
            </template>
          </LayerAppHeader>
        </div>
      </template>

      <div
        :class="
          props.fullBleed ? 'w-full' : 'mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10'
        "
      >
        <slot />
      </div>

      <template #footer>
        <div role="contentinfo" class="shell-footer border-t border-default/70">
          <div class="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
            <div class="grid gap-8 lg:grid-cols-[1.15fr_0.85fr] lg:items-start">
              <div class="space-y-4">
                <AppBrandMark />
                <p class="max-w-2xl text-sm leading-6 text-muted">
                  Track your boat, manage installs, and share a public page when you&apos;re ready.
                </p>
                <div class="flex flex-wrap gap-3">
                  <UButton
                    :to="loggedIn ? '/dashboard' : '/register'"
                    color="primary"
                    variant="soft"
                    icon="i-lucide-layout-dashboard"
                  >
                    {{ loggedIn ? 'Open dashboard' : 'Create account' }}
                  </UButton>
                  <UButton to="/explore" color="neutral" variant="ghost" icon="i-lucide-compass">
                    Explore boats
                  </UButton>
                </div>
              </div>

              <div class="grid gap-5 sm:grid-cols-3">
                <div v-for="group in footerGroups" :key="group.title" class="space-y-3">
                  <p class="text-xs font-semibold uppercase tracking-[0.24em] text-muted">
                    {{ group.title }}
                  </p>
                  <div class="grid gap-2">
                    <NuxtLink
                      v-for="link in group.links"
                      :key="link.to"
                      :to="link.to"
                      class="text-sm text-muted transition hover:text-default"
                    >
                      {{ link.label }}
                    </NuxtLink>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </template>
    </LayerAppShell>
  </div>
</template>
