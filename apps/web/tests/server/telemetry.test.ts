import { describe, expect, it } from 'vitest'
import {
  buildAisContactFromDelta,
  buildInfluxLines,
  buildLivePublishMessage,
  buildSnapshotPatchFromDelta,
  buildSnapshotFromDelta,
  mergeSnapshotPatch,
  selectTelemetryDelta,
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

  it('merges sparse self snapshot patches over the prior fix', () => {
    const previousSnapshot = {
      vesselId: 'vessel-1',
      source: 'collector_ingest',
      observedAt: '2026-03-28T12:01:00.000Z',
      positionLat: 29.5458,
      positionLng: -95.1864,
      headingMagnetic: null,
      speedOverGround: 6.4,
      speedThroughWater: null,
      windSpeedApparent: null,
      windAngleApparent: null,
      depthBelowTransducer: null,
      waterTemperatureKelvin: null,
      batteryVoltage: null,
      engineRpm: null,
      statusNote: null,
      updatedAt: null,
    }
    const snapshotPatch = buildSnapshotPatchFromDelta({
      delta: {
        context: 'vessels.self',
        updates: [
          {
            values: [{ path: 'navigation.headingMagnetic', value: Math.PI / 2 }],
          },
        ],
      },
      observedAt: '2026-03-28T12:02:00.000Z',
      source: 'collector_ingest',
      vesselId: 'vessel-1',
    })

    expect(mergeSnapshotPatch(previousSnapshot, snapshotPatch)).toMatchObject({
      vesselId: 'vessel-1',
      observedAt: '2026-03-28T12:02:00.000Z',
      positionLat: 29.5458,
      positionLng: -95.1864,
      headingMagnetic: 90,
      speedOverGround: 6.4,
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

  it('selects canonical winners and keeps loser provenance in debug deltas', () => {
    const outcome = selectTelemetryDelta({
      delta: {
        context: 'vessels.self',
        publisherRole: 'primary',
        self: 'vessels.self',
        updates: [
          {
            $source: 'ydg-nmea-0183.YD',
            timestamp: '2026-03-29T12:00:00.000Z',
            values: [{ path: 'navigation.speedOverGround', value: 6.0 }],
          },
          {
            $source: 'ydg-nmea-2000.74',
            timestamp: '2026-03-29T12:00:00.050Z',
            values: [
              { path: 'navigation.position', value: { latitude: 29.5, longitude: -95.1 } },
              { path: 'navigation.speedOverGround', value: 6.2 },
            ],
          },
        ],
      },
      receivedAt: '2026-03-29T12:00:00.100Z',
    })

    expect(outcome.selectedDeltas).toHaveLength(1)
    expect(outcome.debugDeltas).toHaveLength(1)
    expect(outcome.selectedDeltas[0]?.delta.updates[0]?.$source).toBe('ydg-nmea-2000.74')
    expect(outcome.debugDeltas[0]?.delta.updates[0]?.dropReason).toBe('lower_priority_source')
    expect(outcome.debugDeltas[0]?.delta.updates[0]?.$source).toBe('ydg-nmea-0183.YD')
  })

  it('adds source provenance tags to debug influx lines', () => {
    const lines = buildInfluxLines({
      delta: {
        context: 'vessels.self',
        publisherRole: 'shadow',
        updates: [
          {
            $source: 'ydg-nmea-0183.YD',
            dropReason: 'shadow_source_suppressed',
            source: { label: '0183 YD' },
            values: [{ path: 'navigation.speedOverGround', value: 6.1 }],
          },
        ],
      },
      installationId: 'install-1',
      vesselId: 'vessel-1',
      observedAt: '2026-03-28T12:05:00.000Z',
    })

    expect(lines[0]).toContain('publisher_role=shadow')
    expect(lines[0]).toContain('source_id=ydg-nmea-0183.YD')
    expect(lines[0]).toContain('drop_reason=shadow_source_suppressed')
    expect(lines[0]).toContain('source_json=')
  })
})
