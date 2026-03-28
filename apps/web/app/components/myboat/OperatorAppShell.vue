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

function isActive(to: string) {
  return route.path === to || route.path.startsWith(`${to}/`)
}

const topLinks = computed<MyBoatShellLink[]>(() =>
  props.mode === 'admin'
    ? [
        { label: 'Dashboard', to: '/dashboard', icon: 'i-lucide-layout-dashboard' },
        { label: 'Users', to: '/admin/users', icon: 'i-lucide-user-cog' },
        { label: 'Vessels', to: '/admin/vessels', icon: 'i-lucide-ship' },
        { label: 'Telemetry', to: '/admin/telemetry', icon: 'i-lucide-broadcast' },
      ]
    : [
        { label: 'Home', to: '/', icon: 'i-lucide-house' },
        { label: 'Explore', to: '/explore', icon: 'i-lucide-compass' },
        { label: 'Buddy boats', to: '/dashboard/fleet-friends', icon: 'i-lucide-users' },
        { label: 'Setup', to: '/dashboard/onboarding', icon: 'i-lucide-anchor' },
        { label: 'Settings', to: '/dashboard/settings', icon: 'i-lucide-sliders-horizontal' },
        ...(isAdmin.value ? [{ label: 'Admin', to: '/admin', icon: 'i-lucide-shield-check' }] : []),
      ],
)

const railLinks = computed<MyBoatShellLink[]>(() =>
  props.mode === 'admin'
    ? [
        { label: 'Admin overview', to: '/admin', icon: 'i-lucide-shield-check' },
        { label: 'Users', to: '/admin/users', icon: 'i-lucide-user-cog' },
        { label: 'Vessels', to: '/admin/vessels', icon: 'i-lucide-ship' },
        { label: 'Installations', to: '/admin/installations', icon: 'i-lucide-cpu' },
        { label: 'Telemetry', to: '/admin/telemetry', icon: 'i-lucide-broadcast' },
      ]
    : [
        { label: 'Command board', to: '/dashboard', icon: 'i-lucide-layout-dashboard' },
        { label: 'Find buddy boats', to: '/dashboard/fleet-friends', icon: 'i-lucide-users' },
        { label: 'Boat setup', to: '/dashboard/onboarding', icon: 'i-lucide-anchor' },
        {
          label: 'Captain settings',
          to: '/dashboard/settings',
          icon: 'i-lucide-sliders-horizontal',
        },
        { label: 'Public explore', to: '/explore', icon: 'i-lucide-compass' },
        ...(isAdmin.value
          ? [{ label: 'Admin console', to: '/admin', icon: 'i-lucide-shield-check' }]
          : []),
      ],
)

const mobileLinks = computed<MyBoatShellLink[]>(() =>
  props.mode === 'admin'
    ? [
        { label: 'Admin', to: '/admin', icon: 'i-lucide-shield-check' },
        { label: 'Users', to: '/admin/users', icon: 'i-lucide-user-cog' },
        { label: 'Vessels', to: '/admin/vessels', icon: 'i-lucide-ship' },
        { label: 'Installs', to: '/admin/installations', icon: 'i-lucide-cpu' },
        { label: 'Signal', to: '/admin/telemetry', icon: 'i-lucide-broadcast' },
      ]
    : [
        { label: 'Board', to: '/dashboard', icon: 'i-lucide-layout-dashboard' },
        { label: 'Buddy', to: '/dashboard/fleet-friends', icon: 'i-lucide-users' },
        { label: 'Explore', to: '/explore', icon: 'i-lucide-compass' },
        { label: 'Setup', to: '/dashboard/onboarding', icon: 'i-lucide-anchor' },
        { label: 'Settings', to: '/dashboard/settings', icon: 'i-lucide-sliders-horizontal' },
        {
          label: isAdmin.value ? 'Admin' : 'Home',
          to: isAdmin.value ? '/admin' : '/',
          icon: isAdmin.value ? 'i-lucide-shield-check' : 'i-lucide-house',
        },
      ],
)

const context = computed(() =>
  props.mode === 'admin'
    ? {
        chip: 'Operator console',
        description:
          'Internal controls for account health, vessel oversight, stale installs, and live telemetry posture.',
        eyebrow: 'Internal ops',
        title: 'Keep the fleet calm and explicit',
      }
    : {
        chip: 'Captain workspace',
        description:
          'Run the vessel setup, inspect install posture, and keep the public story aligned with live telemetry.',
        eyebrow: 'Owner board',
        title: 'Operate the boat, not the shell',
      },
)
</script>

<template>
  <div class="marine-operator-shell">
    <LayerAppShell>
      <template #header>
        <div role="banner" class="marine-operator-header border-b border-default/70">
          <div
            class="mx-auto flex max-w-[96rem] items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8"
          >
            <div class="flex min-w-0 items-center gap-4">
              <NuxtLink to="/" class="shrink-0">
                <AppBrandMark compact />
              </NuxtLink>

              <div
                class="hidden items-center gap-1 xl:flex"
                role="navigation"
                aria-label="Workspace navigation"
              >
                <NuxtLink
                  v-for="link in topLinks"
                  :key="link.to"
                  :to="link.to"
                  class="flex items-center gap-2 rounded-full px-3 py-2 text-sm font-medium transition"
                  :class="
                    isActive(link.to)
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted hover:bg-default/70 hover:text-default'
                  "
                >
                  <UIcon :name="link.icon" class="size-4" />
                  {{ link.label }}
                </NuxtLink>
              </div>
            </div>

            <div class="flex items-center gap-2">
              <UBadge
                :color="props.mode === 'admin' ? 'error' : 'primary'"
                variant="soft"
                class="hidden sm:inline-flex"
              >
                {{ context.chip }}
              </UBadge>
              <UButton
                :icon="colorModeIcon"
                variant="ghost"
                color="neutral"
                aria-label="Toggle color mode"
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
        class="mx-auto grid max-w-[96rem] gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[17rem_minmax(0,1fr)] lg:px-8 lg:py-8"
      >
        <aside class="hidden lg:block">
          <div class="marine-operator-panel rounded-[2rem] p-5">
            <div class="marine-kicker w-fit">{{ context.eyebrow }}</div>
            <h1 class="mt-4 font-display text-3xl leading-tight text-default">
              {{ context.title }}
            </h1>
            <p class="mt-3 text-sm leading-6 text-muted">
              {{ context.description }}
            </p>
          </div>

          <div class="mt-4 space-y-2" role="navigation" aria-label="Section navigation">
            <NuxtLink
              v-for="link in railLinks"
              :key="link.to"
              :to="link.to"
              class="flex items-center gap-3 rounded-[1.35rem] border px-4 py-3 text-sm font-medium transition"
              :class="
                isActive(link.to)
                  ? 'border-primary/20 bg-primary/10 text-primary shadow-card'
                  : 'border-default/70 bg-default/72 text-muted hover:border-primary/15 hover:bg-default hover:text-default'
              "
            >
              <span
                class="flex size-9 items-center justify-center rounded-2xl"
                :class="isActive(link.to) ? 'bg-primary/12' : 'bg-elevated/80'"
              >
                <UIcon :name="link.icon" class="size-4" />
              </span>
              <span>{{ link.label }}</span>
            </NuxtLink>
          </div>

          <div class="marine-operator-panel mt-4 rounded-[1.75rem] p-4">
            <p class="text-xs font-semibold uppercase tracking-[0.24em] text-muted">Signed in</p>
            <p class="mt-3 font-display text-xl text-default">
              {{ user?.name || user?.email || 'Captain account' }}
            </p>
            <p class="mt-2 text-sm leading-6 text-muted">
              {{
                props.mode === 'admin'
                  ? 'Keep emergency actions explicit and review stale telemetry before touching public visibility.'
                  : 'Use setup for identity changes, settings for preferences, and keep public sharing deliberate.'
              }}
            </p>
          </div>
        </aside>

        <div class="min-w-0 pb-28 lg:pb-8">
          <slot />
        </div>
      </div>

      <div class="marine-mobile-nav lg:hidden" role="navigation" aria-label="Primary">
        <div class="mx-auto max-w-2xl px-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <div
            class="marine-mobile-nav-panel grid gap-2 rounded-[1.5rem] p-2 shadow-overlay"
            :style="{ gridTemplateColumns: `repeat(${mobileLinks.length}, minmax(0, 1fr))` }"
          >
            <NuxtLink
              v-for="link in mobileLinks"
              :key="link.to"
              :to="link.to"
              class="flex min-w-0 flex-col items-center gap-1 rounded-[1rem] px-2 py-2 text-[0.7rem] font-medium transition"
              :class="
                isActive(link.to)
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted hover:bg-default/80 hover:text-default'
              "
            >
              <UIcon :name="link.icon" class="size-4 shrink-0" />
              <span class="truncate">{{ link.label }}</span>
            </NuxtLink>
          </div>
        </div>
      </div>
    </LayerAppShell>
  </div>
</template>
