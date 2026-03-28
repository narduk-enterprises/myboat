export interface MyBoatShellLink {
  label: string
  to: string
  icon: string
}

interface FooterGroup {
  title: string
  links: Array<{
    label: string
    to: string
  }>
}

export function useMyBoatShell() {
  const session = useUserSession()

  const loggedIn = computed(() => session.loggedIn.value)
  const user = computed(() => session.user.value)
  const isAdmin = computed(() => !!user.value?.isAdmin)

  const publicNavLinks = computed<MyBoatShellLink[]>(() =>
    loggedIn.value
      ? [
          { label: 'Home', to: '/', icon: 'i-lucide-house' },
          { label: 'Explore', to: '/explore', icon: 'i-lucide-compass' },
          { label: 'Dashboard', to: '/dashboard', icon: 'i-lucide-layout-dashboard' },
          { label: 'Buddy boats', to: '/dashboard/fleet-friends', icon: 'i-lucide-users' },
          { label: 'Setup', to: '/dashboard/onboarding', icon: 'i-lucide-anchor' },
          { label: 'Settings', to: '/dashboard/settings', icon: 'i-lucide-sliders-horizontal' },
        ]
      : [
          { label: 'Home', to: '/', icon: 'i-lucide-house' },
          { label: 'Explore', to: '/explore', icon: 'i-lucide-compass' },
          { label: 'Create account', to: '/register', icon: 'i-lucide-user-round-plus' },
        ],
  )

  const userMenuLinks = computed<MyBoatShellLink[]>(() => {
    const links: MyBoatShellLink[] = [
      { label: 'Dashboard', to: '/dashboard', icon: 'i-lucide-layout-dashboard' },
      { label: 'Buddy boats', to: '/dashboard/fleet-friends', icon: 'i-lucide-users' },
      { label: 'Explore', to: '/explore', icon: 'i-lucide-compass' },
      { label: 'Boat setup', to: '/dashboard/onboarding', icon: 'i-lucide-anchor' },
      {
        label: 'Settings',
        to: '/dashboard/settings',
        icon: 'i-lucide-sliders-horizontal',
      },
    ]

    if (isAdmin.value) {
      links.push({ label: 'Admin', to: '/admin', icon: 'i-lucide-shield-check' })
    }

    return links
  })

  const footerGroups = computed<FooterGroup[]>(() => [
    {
      title: 'Product',
      links: [
        { label: 'Overview', to: '/' },
        { label: 'Explore', to: '/explore' },
        {
          label: loggedIn.value ? 'Dashboard' : 'Create account',
          to: loggedIn.value ? '/dashboard' : '/register',
        },
      ],
    },
    {
      title: 'Captain',
      links: [
        { label: 'Boat setup', to: '/dashboard/onboarding' },
        { label: 'Buddy boats', to: '/dashboard/fleet-friends' },
        { label: 'Settings', to: '/dashboard/settings' },
        {
          label: loggedIn.value ? 'Sign out' : 'Sign in',
          to: loggedIn.value ? '/logout' : '/login',
        },
      ],
    },
    {
      title: 'Public',
      links: [
        { label: 'Public explore', to: '/explore' },
        { label: 'Captain profiles', to: '/explore' },
        { label: 'Vessel pages', to: '/explore' },
      ],
    },
  ])

  return {
    footerGroups,
    isAdmin,
    loggedIn,
    publicNavLinks,
    user,
    userMenuLinks,
  }
}
