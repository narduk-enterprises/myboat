<script setup lang="ts">
import type { MyBoatShellLink } from '~/composables/useMyBoatShell'

const props = withDefaults(
  defineProps<{
    mode?: 'dashboard' | 'admin'
  }>(),
  {
    mode: 'dashboard',
  },
)

const route = useRoute()
const { isAdmin, user, userMenuLinks } = useMyBoatShell()
const { colorModeIcon, cycleColorMode } = useColorModeToggle()
const activeVesselSlug = computed(() =>
  typeof route.params.vesselSlug === 'string' ? route.params.vesselSlug : null,
)
const mobilePassagesLink = computed<MyBoatShellLink>(() => ({
  label: 'Passages',
  to: activeVesselSlug.value
    ? `/dashboard/vessels/${activeVesselSlug.value}/passages`
    : '/dashboard/passages',
  icon: 'i-lucide-route',
}))

function isActive(link: MyBoatShellLink) {
  if (link.label === 'Passages') {
    return route.path === link.to || route.path.endsWith('/passages')
  }

  if (link.match === 'prefix') {
    return route.path === link.to || route.path.startsWith(`${link.to}/`)
  }

  return route.path === link.to
}

const railLinks = computed<MyBoatShellLink[]>(() =>
  props.mode === 'admin'
    ? [
        { label: 'Admin overview', to: '/admin', icon: 'i-lucide-shield-check' },
        { label: 'Users', to: '/admin/users', icon: 'i-lucide-user-cog' },
        { label: 'Vessels', to: '/admin/vessels', icon: 'i-lucide-ship' },
        { label: 'Installations', to: '/admin/installations', icon: 'i-lucide-cpu' },
        { label: 'Telemetry', to: '/admin/telemetry', icon: 'i-lucide-radio-tower' },
      ]
    : [
        { label: 'Dashboard', to: '/dashboard', icon: 'i-lucide-layout-dashboard' },
        { label: 'Live Map', to: '/dashboard/map', icon: 'i-lucide-map' },
        { label: 'Passages', to: '/dashboard/passages', icon: 'i-lucide-route' },
        { label: 'Buddy Boats', to: '/dashboard/fleet-friends', icon: 'i-lucide-users' },
        {
          label: 'Settings',
          to: '/dashboard/settings',
          icon: 'i-lucide-sliders-horizontal',
          match: 'prefix',
        },
        ...(isAdmin.value
          ? [{ label: 'Admin console', to: '/admin', icon: 'i-lucide-shield-check' }]
          : []),
      ],
)

const mobileLinks = computed<MyBoatShellLink[]>(() =>
  props.mode === 'admin'
    ? [
        { label: 'Admin', to: '/admin', icon: 'i-lucide-shield-check', match: 'prefix' },
        { label: 'Users', to: '/admin/users', icon: 'i-lucide-user-cog' },
        { label: 'Vessels', to: '/admin/vessels', icon: 'i-lucide-ship' },
        { label: 'Installs', to: '/admin/installations', icon: 'i-lucide-cpu' },
        { label: 'Signal', to: '/admin/telemetry', icon: 'i-lucide-radio-tower' },
      ]
    : [
        { label: 'Board', to: '/dashboard', icon: 'i-lucide-layout-dashboard', match: 'prefix' },
        { label: 'Map', to: '/dashboard/map', icon: 'i-lucide-map' },
        mobilePassagesLink.value,
        { label: 'Buddy', to: '/dashboard/fleet-friends', icon: 'i-lucide-users' },
        {
          label: 'Prefs',
          to: '/dashboard/settings',
          icon: 'i-lucide-sliders-horizontal',
          match: 'prefix',
        },
      ],
)

const shellHomePath = computed(() => (props.mode === 'admin' ? '/admin' : '/dashboard'))

const context = computed(() =>
  props.mode === 'admin'
    ? {
        chip: 'Operator console',
        description:
          'Internal controls for account health, vessel oversight, stale installs, and live telemetry posture.',
        eyebrow: 'Internal ops',
        title: 'Keep the fleet calm and explicit',
      }
    : null,
)
</script>

<template>
  <div class="marine-operator-shell">
    <LayerAppShell>
      <template #header>
        <div role="banner" class="marine-operator-header border-b border-default/70">
          <div
            class="mx-auto flex max-w-[96rem] items-center justify-between gap-3 px-4 py-3 sm:gap-4 sm:px-6 sm:py-4 lg:px-8"
          >
            <div class="flex min-w-0 items-center gap-4">
              <NuxtLink :to="shellHomePath" class="shrink-0">
                <AppBrandMark compact />
              </NuxtLink>
            </div>

            <div class="flex items-center gap-1.5 sm:gap-2">
              <UBadge
                :color="props.mode === 'admin' ? 'error' : 'primary'"
                variant="soft"
                class="hidden sm:inline-flex"
              >
                {{ context?.chip || 'Captain workspace' }}
              </UBadge>
              <UButton
                :icon="colorModeIcon"
                variant="ghost"
                color="neutral"
                aria-label="Toggle color mode"
                class="hidden sm:inline-flex"
                @click="cycleColorMode"
              />
              <AppUserMenu
                :menu-links="userMenuLinks"
                logout-redirect="/"
                :show-admin-link="true"
              />
            </div>
          </div>
        </div>
      </template>

      <div
        class="mx-auto grid max-w-[96rem] gap-5 px-4 py-5 sm:px-6 sm:py-6 lg:grid-cols-[17rem_minmax(0,1fr)] lg:gap-6 lg:px-8 lg:py-8"
      >
        <aside class="hidden lg:block">
          <div v-if="context" class="marine-operator-panel rounded-[2rem] p-5">
            <div class="marine-kicker w-fit">{{ context.eyebrow }}</div>
            <h1 class="mt-4 font-display text-3xl leading-tight text-default">
              {{ context.title }}
            </h1>
            <p class="mt-3 text-sm leading-6 text-muted">
              {{ context.description }}
            </p>
          </div>

          <div
            class="space-y-2"
            :class="context ? 'mt-4' : ''"
            role="navigation"
            aria-label="Section navigation"
          >
            <NuxtLink
              v-for="link in railLinks"
              :key="link.to"
              :to="link.to"
              class="flex items-center gap-3 rounded-[1.35rem] border px-4 py-3 text-sm font-medium transition"
              :class="
                isActive(link)
                  ? 'border-primary/20 bg-primary/10 text-primary shadow-card'
                  : 'border-default/70 bg-default/72 text-muted hover:border-primary/15 hover:bg-default hover:text-default'
              "
            >
              <span
                class="flex size-9 items-center justify-center rounded-2xl"
                :class="isActive(link) ? 'bg-primary/12' : 'bg-elevated/80'"
              >
                <UIcon :name="link.icon" class="size-4" />
              </span>
              <span>{{ link.label }}</span>
            </NuxtLink>
          </div>

          <div v-if="context" class="marine-operator-panel mt-4 rounded-[1.75rem] p-4">
            <p class="text-xs font-semibold uppercase tracking-[0.24em] text-muted">Signed in</p>
            <p class="mt-3 font-display text-xl text-default">
              {{ user?.name || user?.email || 'Captain account' }}
            </p>
            <p class="mt-2 text-sm leading-6 text-muted">
              {{
                props.mode === 'admin'
                  ? 'Keep emergency actions explicit and review stale telemetry before touching public visibility.'
                  : 'Use the live map for traffic, settings for captain and source changes, and contextual detail pages only when you need depth.'
              }}
            </p>
          </div>
        </aside>

        <div class="min-w-0 pb-[calc(8.25rem+env(safe-area-inset-bottom))] lg:pb-8">
          <slot />
        </div>
      </div>

      <div class="marine-mobile-nav lg:hidden" role="navigation" aria-label="Primary">
        <div class="mx-auto max-w-2xl px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:px-4">
          <div
            class="marine-mobile-nav-panel grid gap-1.5 rounded-[1.35rem] p-1.5 shadow-card sm:gap-2 sm:rounded-[1.5rem] sm:p-2"
            :style="{ gridTemplateColumns: `repeat(${mobileLinks.length}, minmax(0, 1fr))` }"
          >
            <NuxtLink
              v-for="link in mobileLinks"
              :key="link.to"
              :to="link.to"
              class="flex min-w-0 flex-col items-center gap-1 rounded-[0.95rem] px-1.5 py-2 text-[0.68rem] font-medium leading-none transition sm:rounded-[1rem] sm:px-2 sm:text-[0.7rem]"
              :class="
                isActive(link)
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted hover:bg-default/80 hover:text-default'
              "
            >
              <UIcon :name="link.icon" class="size-4 shrink-0" />
              <span class="truncate text-center">{{ link.label }}</span>
            </NuxtLink>
          </div>
        </div>
      </div>
    </LayerAppShell>
  </div>
</template>
