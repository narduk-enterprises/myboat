export interface AppShellLink {
  label: string
  shortLabel?: string
  to: string
  icon: string
  match?: string[]
  description?: string
}

function withMatch(link: AppShellLink) {
  return link
}

export function useAppShellNavigation() {
  const { loggedIn, user } = useUserSession()

  const isAdmin = computed(() => !!user.value?.isAdmin)

  const publicNavLinks = computed<AppShellLink[]>(() =>
    loggedIn.value
      ? [
          withMatch({
            label: 'Home',
            shortLabel: 'Home',
            to: '/',
            icon: 'i-lucide-house',
            match: ['/'],
          }),
          withMatch({
            label: 'Dashboard',
            shortLabel: 'Dashboard',
            to: '/dashboard',
            icon: 'i-lucide-layout-dashboard',
            match: ['/dashboard', '/dashboard/vessels/*', '/dashboard/installations/*'],
          }),
          withMatch({
            label: 'Boat setup',
            shortLabel: 'Setup',
            to: '/dashboard/onboarding',
            icon: 'i-lucide-anchor',
            match: ['/dashboard/onboarding'],
          }),
        ]
      : [
          withMatch({
            label: 'Home',
            shortLabel: 'Home',
            to: '/',
            icon: 'i-lucide-house',
            match: ['/'],
          }),
          withMatch({
            label: 'Sign in',
            shortLabel: 'Sign in',
            to: '/login',
            icon: 'i-lucide-log-in',
            match: ['/login'],
          }),
        ],
  )

  const footerLinks = computed(() =>
    loggedIn.value
      ? [
          { label: 'Dashboard', to: '/dashboard' },
          { label: 'Boat setup', to: '/dashboard/onboarding' },
          { label: 'Settings', to: '/dashboard/settings' },
          { label: 'Home', to: '/' },
        ]
      : [
          { label: 'Home', to: '/' },
          { label: 'Sign in', to: '/login' },
          { label: 'Create account', to: '/register' },
        ],
  )

  const userMenuLinks = computed(() => [
    { label: 'Dashboard', to: '/dashboard', icon: 'i-lucide-layout-dashboard' },
    { label: 'Boat setup', to: '/dashboard/onboarding', icon: 'i-lucide-anchor' },
    { label: 'Settings', to: '/dashboard/settings', icon: 'i-lucide-settings-2' },
  ])

  const dashboardNavLinks = computed<AppShellLink[]>(() => {
    const links: AppShellLink[] = [
      withMatch({
        label: 'Overview',
        shortLabel: 'Overview',
        to: '/dashboard',
        icon: 'i-lucide-layout-dashboard',
        match: ['/dashboard', '/dashboard/vessels/*', '/dashboard/installations/*'],
        description: 'Fleet posture, live status, and the current operating briefing.',
      }),
      withMatch({
        label: 'Boat setup',
        shortLabel: 'Setup',
        to: '/dashboard/onboarding',
        icon: 'i-lucide-anchor',
        match: ['/dashboard/onboarding'],
        description: 'Captain identity, vessel profile, and the first install configuration.',
      }),
      withMatch({
        label: 'Settings',
        shortLabel: 'Settings',
        to: '/dashboard/settings',
        icon: 'i-lucide-settings-2',
        match: ['/dashboard/settings', '/dashboard/settings/*'],
        description: 'Units, security, sharing defaults, and captain-level preferences.',
      }),
    ]

    if (isAdmin.value) {
      links.push(
        withMatch({
          label: 'Admin',
          shortLabel: 'Admin',
          to: '/admin',
          icon: 'i-lucide-shield-check',
          match: ['/admin', '/admin/*'],
          description: 'System health, ingest posture, and moderation controls.',
        }),
      )
    }

    return links
  })

  const adminNavLinks = computed<AppShellLink[]>(() => [
    withMatch({
      label: 'Admin overview',
      shortLabel: 'Admin',
      to: '/admin',
      icon: 'i-lucide-shield-check',
      match: ['/admin', '/admin/*'],
      description: 'Operational telemetry, fleet review, and admin health signals.',
    }),
    withMatch({
      label: 'Captain dashboard',
      shortLabel: 'Dashboard',
      to: '/dashboard',
      icon: 'i-lucide-layout-dashboard',
      match: ['/dashboard', '/dashboard/vessels/*', '/dashboard/installations/*'],
      description: 'Jump back to the owner-facing operations view.',
    }),
  ])

  return {
    footerLinks,
    publicNavLinks,
    userMenuLinks,
    dashboardNavLinks,
    adminNavLinks,
    isAdmin,
  }
}
