export function useMarineUnits() {
  const { preferences } = useMarinePreferences()

  function convertSpeed(metersPerSecond: number | null | undefined) {
    if (metersPerSecond === null || metersPerSecond === undefined) {
      return null
    }

    switch (preferences.value.speed) {
      case 'mph':
        return metersPerSecond * 2.23694
      case 'kmh':
        return metersPerSecond * 3.6
      default:
        return metersPerSecond * 1.94384
    }
  }

  function convertDepth(meters: number | null | undefined) {
    if (meters === null || meters === undefined) {
      return null
    }

    switch (preferences.value.depth) {
      case 'm':
        return meters
      case 'fathoms':
        return meters * 0.546807
      default:
        return meters * 3.28084
    }
  }

  function convertTemperature(kelvin: number | null | undefined) {
    if (kelvin === null || kelvin === undefined) {
      return null
    }

    const celsius = kelvin - 273.15
    return preferences.value.temperature === 'c' ? celsius : celsius * (9 / 5) + 32
  }

  function convertAngle(radians: number | null | undefined) {
    if (radians === null || radians === undefined) {
      return null
    }

    return (radians * 180) / Math.PI
  }

  const speedUnitLabel = computed(() => {
    switch (preferences.value.speed) {
      case 'mph':
        return 'mph'
      case 'kmh':
        return 'km/h'
      default:
        return 'kts'
    }
  })

  const depthUnitLabel = computed(() => {
    switch (preferences.value.depth) {
      case 'm':
        return 'm'
      case 'fathoms':
        return 'fathoms'
      default:
        return 'ft'
    }
  })

  const temperatureUnitLabel = computed(() => (preferences.value.temperature === 'c' ? '°C' : '°F'))

  return {
    preferences,
    convertAngle,
    convertDepth,
    convertSpeed,
    convertTemperature,
    depthUnitLabel,
    speedUnitLabel,
    temperatureUnitLabel,
  }
}
