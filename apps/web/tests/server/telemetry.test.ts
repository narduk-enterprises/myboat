import { describe, expect, it } from 'vitest'
import {
  buildAisContactFromDelta,
  buildInfluxLines,
  buildLivePublishMessage,
  buildSnapshotFromDelta,
} from '../../server/utils/telemetry'

describe('telemetry helpers', () => {
  it('builds a self snapshot from collector delta values', () => {
    const observedAt = '2026-03-28T12:00:00.000Z'
    const snapshot = buildSnapshotFromDelta({
      delta: {
        context: 'vessels.self',
        updates: [
          {
            values: [
              {
                path: 'navigation.position',
                value: { latitude: 29.546, longitude: -95.186 },
              },
              { path: 'navigation.speedOverGround', value: 6.2 },
              { path: 'navigation.headingMagnetic', value: Math.PI },
            ],
          },
        ],
      },
      observedAt,
      source: 'collector_ingest',
      vesselId: 'vessel-1',
    })

    expect(snapshot).toMatchObject({
      vesselId: 'vessel-1',
      source: 'collector_ingest',
      observedAt,
      positionLat: 29.546,
      positionLng: -95.186,
      speedOverGround: 6.2,
      headingMagnetic: 180,
    })
  })

  it('extracts AIS contacts from non-self contexts and builds live payloads', () => {
    const observedAt = '2026-03-28T12:01:00.000Z'
    const delta = {
      context: 'vessels.urn:mrn:imo:mmsi:367341190',
      updates: [
        {
          values: [
            { path: 'name', value: 'FREEDOM STAR' },
            {
              path: 'navigation.position',
              value: { latitude: 29.6, longitude: -95.1 },
            },
            { path: 'navigation.speedOverGround', value: 9.4 },
          ],
        },
      ],
    }

    const contact = buildAisContactFromDelta({ delta, observedAt })
    expect(contact).toMatchObject({
      id: 'mmsi:367341190',
      mmsi: '367341190',
      name: 'FREEDOM STAR',
      lat: 29.6,
      lng: -95.1,
      sog: 9.4,
    })

    expect(
      buildLivePublishMessage({
        delta,
        observedAt,
        vesselId: 'vessel-1',
        source: 'collector_ingest',
      }),
    ).toEqual({
      type: 'telemetry',
      aisContacts: [contact],
      connectionState: 'live',
      lastObservedAt: observedAt,
    })
  })

  it('treats the upstream self context as a vessel snapshot instead of AIS', () => {
    const observedAt = '2026-03-28T12:02:00.000Z'
    const delta = {
      context: 'vessels.urn:mrn:imo:mmsi:368327340',
      self: 'vessels.urn:mrn:imo:mmsi:368327340',
      updates: [
        {
          values: [
            {
              path: 'navigation.position',
              value: { latitude: 29.5458, longitude: -95.1864 },
            },
            { path: 'navigation.speedOverGround', value: 6.4 },
          ],
        },
      ],
    }

    expect(buildAisContactFromDelta({ delta, observedAt })).toBeNull()
    expect(
      buildLivePublishMessage({
        delta,
        observedAt,
        vesselId: 'vessel-1',
        source: 'collector_ingest',
      }),
    ).toMatchObject({
      type: 'telemetry',
      connectionState: 'live',
      lastObservedAt: observedAt,
      snapshot: {
        vesselId: 'vessel-1',
        positionLat: 29.5458,
        positionLng: -95.1864,
        speedOverGround: 6.4,
      },
    })
  })

  it('builds influx lines for numeric and structured values', () => {
    const lines = buildInfluxLines({
      delta: {
        context: 'vessels.self',
        updates: [
          {
            values: [
              { path: 'navigation.speedOverGround', value: 6.2 },
              {
                path: 'navigation.position',
                value: { latitude: 29.546, longitude: -95.186 },
              },
            ],
          },
        ],
      },
      installationId: 'install-1',
      vesselId: 'vessel-1',
      observedAt: '2026-03-28T12:00:00.000Z',
    })

    expect(lines).toHaveLength(2)
    expect(lines[0]).toContain('myboat_signalk')
    expect(lines[0]).toContain('vessel_id=vessel-1')
  })
})
