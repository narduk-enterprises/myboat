type MarineSpeedUnit = 'kts' | 'mph' | 'kmh'
type MarineDepthUnit = 'ft' | 'm' | 'fathoms'
type MarineTemperatureUnit = 'f' | 'c'

export interface MarinePreferences {
  speed: MarineSpeedUnit
  depth: MarineDepthUnit
  temperature: MarineTemperatureUnit
}

const STORAGE_KEY = 'myboat-marine-preferences'
const DEFAULT_PREFERENCES: MarinePreferences = {
  speed: 'kts',
  depth: 'ft',
  temperature: 'f',
}

export function useMarinePreferences() {
  const preferences = useState<MarinePreferences>('marine-preferences', () => DEFAULT_PREFERENCES)
  const hasLoaded = useState('marine-preferences-loaded', () => false)

  onMounted(() => {
    if (!import.meta.client || hasLoaded.value) {
      return
    }

    hasLoaded.value = true
    const stored = localStorage.getItem(STORAGE_KEY)

    if (stored) {
      try {
        preferences.value = {
          ...DEFAULT_PREFERENCES,
          ...JSON.parse(stored),
        }
      } catch {
        preferences.value = DEFAULT_PREFERENCES
      }
    }
  })

  watch(
    preferences,
    (value) => {
      if (!import.meta.client || !hasLoaded.value) {
        return
      }

      localStorage.setItem(STORAGE_KEY, JSON.stringify(value))
    },
    { deep: true },
  )

  function updatePreferences(partial: Partial<MarinePreferences>) {
    preferences.value = {
      ...preferences.value,
      ...partial,
    }
  }

  return {
    preferences: readonly(preferences),
    updatePreferences,
  }
}
