type ColorModePreference = 'system' | 'light' | 'dark'

export function useColorModeToggle() {
  // Color mode preference is stored client-side by default, so the icon must
  // stay deterministic until hydration finishes.
  const colorMode = useColorMode() as {
    preference: string
    value: string
  }
  const isHydrated = shallowRef(false)
  const modes: readonly ColorModePreference[] = ['system', 'light', 'dark']

  const colorModeIcon = computed(() => {
    if (!isHydrated.value || colorMode.preference === 'system') return 'i-lucide-monitor'
    return colorMode.value === 'dark' ? 'i-lucide-moon' : 'i-lucide-sun'
  })

  function cycleColorMode() {
    const currentPreference = modes.includes(colorMode.preference as ColorModePreference)
      ? (colorMode.preference as ColorModePreference)
      : 'system'
    const index = modes.indexOf(currentPreference)

    colorMode.preference = modes[(index + 1) % modes.length]!
  }

  onMounted(() => {
    isHydrated.value = true
  })

  return {
    colorMode,
    colorModeIcon,
    cycleColorMode,
    isHydrated: readonly(isHydrated),
  }
}
