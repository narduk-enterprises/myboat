import { describe, expect, it } from 'vitest'
import { buildNearbyAisPins } from '../../app/components/myboat/maps/map-support'

describe('map support helpers', () => {
  it('keeps all nearby traffic contacts instead of trimming to 32', () => {
    const contacts = Array.from({ length: 36 }, (_, index) => ({
      id: `mmsi:${367000000 + index}`,
      name: `Boat ${index + 1}`,
      mmsi: String(367000000 + index),
      shipType: 37,
      lat: 29.55 + index * 0.01,
      lng: -95.18,
      cog: 90,
      sog: 3.5,
      heading: 90,
      destination: null,
      callSign: null,
      length: null,
      beam: null,
      draft: null,
      navState: null,
      lastUpdateAt: Date.now(),
    }))

    const pins = buildNearbyAisPins({
      contacts,
      focusSnapshot: {
        observedAt: '2026-03-29T11:00:00.000Z',
        positionLat: 29.55,
        positionLng: -95.18,
        headingMagnetic: null,
        speedOverGround: null,
        speedThroughWater: null,
        windSpeedApparent: null,
        windAngleApparent: null,
        depthBelowTransducer: null,
        waterTemperatureKelvin: null,
        batteryVoltage: null,
        engineRpm: null,
        statusNote: null,
      },
      primaryVessel: null,
    })

    expect(pins).toHaveLength(36)
  })

  it('filters the primary vessel out of nearby AIS by MMSI', () => {
    const pins = buildNearbyAisPins({
      contacts: [
        {
          id: 'mmsi:368327340',
          name: 'Unhelpful upstream name',
          mmsi: '368327340',
          shipType: 37,
          lat: 29.5501,
          lng: -95.1801,
          cog: 90,
          sog: 2,
          heading: 90,
          destination: null,
          callSign: 'WDC8821',
          length: null,
          beam: null,
          draft: null,
          navState: null,
          lastUpdateAt: Date.now(),
        },
        {
          id: 'mmsi:367123450',
          name: 'Nearby friend',
          mmsi: '367123450',
          shipType: 70,
          lat: 29.59,
          lng: -95.12,
          cog: 180,
          sog: 5,
          heading: 180,
          destination: null,
          callSign: 'WXY1234',
          length: null,
          beam: null,
          draft: null,
          navState: null,
          lastUpdateAt: Date.now(),
        },
      ],
      focusSnapshot: {
        observedAt: '2026-03-29T11:00:00.000Z',
        positionLat: 29.55,
        positionLng: -95.18,
        headingMagnetic: null,
        speedOverGround: null,
        speedThroughWater: null,
        windSpeedApparent: null,
        windAngleApparent: null,
        depthBelowTransducer: null,
        waterTemperatureKelvin: null,
        batteryVoltage: null,
        engineRpm: null,
        statusNote: null,
      },
      primaryVessel: {
        name: 'Tideye',
        observedIdentity: {
          source: 'signalk_delta',
          observedAt: '2026-03-29T10:59:00.000Z',
          selfContext: 'vessels.urn:mrn:imo:mmsi:368327340',
          mmsi: '368327340',
          callSign: 'WDC8821',
          observedName: 'Tideye',
          shipType: 'Sailing',
          shipTypeCode: 37,
          lengthOverall: null,
          beam: null,
          draft: null,
          registrationNumber: null,
          imo: null,
          sourceInstallationId: null,
        },
      },
    })

    expect(pins).toHaveLength(1)
    expect(pins[0]?.mmsi).toBe('367123450')
  })
})
