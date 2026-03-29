type MarineSpeedUnit = 'kts' | 'mph' | 'kmh'
type MarineDepthUnit = 'ft' | 'm' | 'fathoms'
type MarineTemperatureUnit = 'f' | 'c'
type MarineMapStyle = 'standard' | 'muted' | 'satellite' | 'hybrid'

export interface MarinePreferencesShape {
  defaultMapStyle: MarineMapStyle | null
  speed: MarineSpeedUnit
  depth: MarineDepthUnit
  temperature: MarineTemperatureUnit
}

const SPEED_UNITS = ['kts', 'mph', 'kmh'] as const satisfies readonly MarineSpeedUnit[]
const DEPTH_UNITS = ['ft', 'm', 'fathoms'] as const satisfies readonly MarineDepthUnit[]
const TEMPERATURE_UNITS = ['f', 'c'] as const satisfies readonly MarineTemperatureUnit[]
const MAP_STYLE_OPTIONS = [
  'standard',
  'muted',
  'satellite',
  'hybrid',
] as const satisfies readonly MarineMapStyle[]

export function mergeMarinePreferences(
  raw: unknown,
  defaults: MarinePreferencesShape,
): MarinePreferencesShape {
  if (!raw || typeof raw !== 'object') {
    return defaults
  }

  const record = raw as Partial<Record<keyof MarinePreferencesShape, unknown>>

  return {
    defaultMapStyle:
      record.defaultMapStyle === null ||
      (typeof record.defaultMapStyle === 'string' &&
        MAP_STYLE_OPTIONS.includes(record.defaultMapStyle as MarineMapStyle))
        ? (record.defaultMapStyle as MarinePreferencesShape['defaultMapStyle'])
        : defaults.defaultMapStyle,
    speed:
      typeof record.speed === 'string' && SPEED_UNITS.includes(record.speed as MarineSpeedUnit)
        ? (record.speed as MarinePreferencesShape['speed'])
        : defaults.speed,
    depth:
      typeof record.depth === 'string' && DEPTH_UNITS.includes(record.depth as MarineDepthUnit)
        ? (record.depth as MarinePreferencesShape['depth'])
        : defaults.depth,
    temperature:
      typeof record.temperature === 'string' &&
      TEMPERATURE_UNITS.includes(record.temperature as MarineTemperatureUnit)
        ? (record.temperature as MarinePreferencesShape['temperature'])
        : defaults.temperature,
  }
}
