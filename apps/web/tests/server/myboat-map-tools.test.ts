import { describe, expect, it } from 'vitest'
import {
  buildHeadingAidFeatureCollection,
  buildMeasureResult,
  buildRangeRingFeatureCollection,
  nextMapStyle,
  resolveMyBoatMapToolCapabilities,
} from '../../app/components/myboat/maps/advanced-tools'
import {
  mergeMarinePreferences,
  type MarinePreferencesShape,
} from '../../app/utils/marine-preferences'

const DEFAULT_PREFERENCES: MarinePreferencesShape = {
  defaultMapStyle: null,
  speed: 'kts',
  depth: 'ft',
  temperature: 'f',
}

describe('myboat shared map tools', () => {
  it('returns the expected capability matrix for each tools profile', () => {
    expect(resolveMyBoatMapToolCapabilities('none')).toEqual({
      basemap: false,
      measure: false,
      rangeRings: false,
      headingLine: false,
    })

    expect(resolveMyBoatMapToolCapabilities('viewer')).toEqual({
      basemap: true,
      measure: true,
      rangeRings: false,
      headingLine: false,
    })

    expect(resolveMyBoatMapToolCapabilities('navigation')).toEqual({
      basemap: true,
      measure: true,
      rangeRings: true,
      headingLine: true,
    })
  })

  it('cycles through the supported map styles in order', () => {
    expect(nextMapStyle('standard')).toBe('muted')
    expect(nextMapStyle('muted')).toBe('satellite')
    expect(nextMapStyle('satellite')).toBe('hybrid')
    expect(nextMapStyle('hybrid')).toBe('standard')
  })

  it('builds a two-point measurement result with distance and bearing', () => {
    const result = buildMeasureResult([
      { lat: 29.3043, lng: -94.7977 },
      { lat: 29.3543, lng: -94.7477 },
    ])

    expect(result).not.toBeNull()
    expect(result?.distNm).toBeGreaterThan(3)
    expect(result?.distNm).toBeLessThan(5)
    expect(result?.bearing).toBeGreaterThan(35)
    expect(result?.bearing).toBeLessThan(55)
    expect(result?.cardinal).toBe('NE')
  })

  it('creates the configured range-ring set around a live vessel position', () => {
    const collection = buildRangeRingFeatureCollection({
      positionLat: 29.3043,
      positionLng: -94.7977,
    })

    expect(collection.features).toHaveLength(4)
    expect(collection.features.map((feature) => feature.properties.radiusNm)).toEqual([
      0.5, 1, 2, 5,
    ])
    expect(collection.features.every((feature) => feature.geometry.type === 'LineString')).toBe(
      true,
    )
  })

  it('builds heading and course aids when both are available and materially different', () => {
    const collection = buildHeadingAidFeatureCollection({
      positionLat: 29.3043,
      positionLng: -94.7977,
      headingMagnetic: 90,
      courseOverGround: 126,
      speedOverGround: 12,
    })

    expect(collection.features).toHaveLength(2)
    expect(collection.features.map((feature) => feature.properties.aidKind)).toEqual([
      'heading',
      'course',
    ])
  })

  it('merges persisted preferences while dropping unknown values back to defaults', () => {
    expect(
      mergeMarinePreferences(
        {
          defaultMapStyle: 'satellite',
          speed: 'mph',
          depth: 'm',
          temperature: 'c',
        },
        DEFAULT_PREFERENCES,
      ),
    ).toEqual({
      defaultMapStyle: 'satellite',
      speed: 'mph',
      depth: 'm',
      temperature: 'c',
    })

    expect(
      mergeMarinePreferences(
        {
          defaultMapStyle: 'not-a-style',
          speed: 'warp',
          depth: 'yards',
          temperature: 'kelvin',
        },
        DEFAULT_PREFERENCES,
      ),
    ).toEqual(DEFAULT_PREFERENCES)
  })
})
