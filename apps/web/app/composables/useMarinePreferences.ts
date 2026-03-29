import { mergeMarinePreferences } from '~/utils/marine-preferences'

type MarineSpeedUnit = 'kts' | 'mph' | 'kmh'
type MarineDepthUnit = 'ft' | 'm' | 'fathoms'
type MarineTemperatureUnit = 'f' | 'c'
type MarineMapStyle = 'standard' | 'muted' | 'satellite' | 'hybrid'

export interface MarinePreferences {
  defaultMapStyle: MarineMapStyle | null
  speed: MarineSpeedUnit
  depth: MarineDepthUnit
  temperature: MarineTemperatureUnit
}

const STORAGE_KEY = 'myboat-marine-preferences'
export const DEFAULT_MARINE_PREFERENCES: MarinePreferences = {
  defaultMapStyle: null,
  speed: 'kts',
  depth: 'ft',
  temperature: 'f',
}

export function useMarinePreferences() {
  const preferences = useState<MarinePreferences>(
    'marine-preferences',
    () => DEFAULT_MARINE_PREFERENCES,
  )
  const hasLoaded = useState('marine-preferences-loaded', () => false)

  onMounted(() => {
    if (!import.meta.client || hasLoaded.value) {
      return
    }

    hasLoaded.value = true
    const stored = localStorage.getItem(STORAGE_KEY)

    if (stored) {
      try {
        preferences.value = mergeMarinePreferences(JSON.parse(stored), DEFAULT_MARINE_PREFERENCES)
      } catch {
        preferences.value = DEFAULT_MARINE_PREFERENCES
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
