import { describe, expect, it } from 'vitest'
import {
  DEFAULT_LIVE_DEMAND,
  canonicalAisStorageKey,
  createMyBoatLiveWebSocketUrl,
  diffRemovedAisContactKeys,
  filterAisContactsNearSnapshot,
  isLiveDemandEmpty,
  mergeAisContactSummary,
  mergeAisContactsIntoRecord,
  mergeLiveDemands,
  normalizeLiveDemand,
  pruneAisContactRecordBySnapshot,
  pruneStaleAisContactRecord,
} from '../../shared/myboatLive'

describe('myboat live helpers', () => {
  it('normalizes partial demand payloads', () => {
    expect(normalizeLiveDemand({ selfLevel: 'detail', ais: 1 as never })).toEqual({
      selfLevel: 'detail',
      ais: true,
    })
    expect(normalizeLiveDemand({ selfLevel: 'wat' as never })).toEqual(DEFAULT_LIVE_DEMAND)
  })

  it('merges demand by highest self level and any AIS request', () => {
    expect(
      mergeLiveDemands([
        { selfLevel: 'summary', ais: false },
        { selfLevel: 'detail', ais: false },
        { selfLevel: 'none', ais: true },
      ]),
    ).toEqual({
      selfLevel: 'detail',
      ais: true,
    })
  })

  it('detects empty demand and builds websocket urls', () => {
    expect(isLiveDemandEmpty(DEFAULT_LIVE_DEMAND)).toBe(true)
    expect(
      createMyBoatLiveWebSocketUrl('/api/app/vessels/north-star/live', 'https://mybo.at'),
    ).toBe('wss://mybo.at/api/app/vessels/north-star/live')
  })

  it('merges sparse AIS upserts onto the previous contact state', () => {
    expect(
      mergeAisContactSummary(
        {
          id: 'mmsi:123',
          name: 'Tideye',
          mmsi: '123',
          shipType: 36,
          lat: 29.5,
          lng: -95.0,
          cog: 182,
          sog: 6.2,
          heading: 184,
          destination: 'Kemah',
          callSign: 'WDC1234',
          length: 12.4,
          beam: 4.5,
          draft: 1.2,
          navState: 'motoring',
          lastUpdateAt: 100,
        },
        {
          id: 'mmsi:123',
          name: null,
          mmsi: '123',
          shipType: null,
          lat: 29.6,
          lng: -95.1,
          cog: null,
          sog: 6.4,
          heading: null,
          destination: null,
          callSign: null,
          length: null,
          beam: null,
          draft: null,
          navState: null,
          lastUpdateAt: 125,
        },
      ),
    ).toEqual({
      id: 'mmsi:123',
      name: 'Tideye',
      mmsi: '123',
      shipType: 36,
      lat: 29.6,
      lng: -95.1,
      cog: 182,
      sog: 6.4,
      heading: 184,
      destination: 'Kemah',
      callSign: 'WDC1234',
      length: 12.4,
      beam: 4.5,
      draft: 1.2,
      navState: 'motoring',
      lastUpdateAt: 125,
    })
  })

  it('uses MMSI as canonical storage key when present', () => {
    expect(
      canonicalAisStorageKey({
        id: 'vessels.urn:mrn:signalk:com:foo',
        mmsi: '367123456',
      }),
    ).toBe('mmsi:367123456')
    expect(
      canonicalAisStorageKey({
        id: 'vessels.urn:mrn:signalk:com:foo',
        mmsi: null,
      }),
    ).toBe('vessels.urn:mrn:signalk:com:foo')
  })

  it('merges duplicate AIS entries that share an MMSI into one record key', () => {
    const merged = mergeAisContactsIntoRecord(
      {
        'vessels.urn:x': {
          id: 'vessels.urn:x',
          name: 'Alpha',
          mmsi: '367123456',
          shipType: 37,
          lat: 29.0,
          lng: -95.0,
          cog: null,
          sog: 5,
          heading: null,
          destination: null,
          callSign: null,
          length: null,
          beam: null,
          draft: null,
          navState: null,
          lastUpdateAt: 100,
        },
      },
      [
        {
          id: 'mmsi:367123456',
          name: null,
          mmsi: '367123456',
          shipType: null,
          lat: 29.1,
          lng: -95.1,
          cog: 180,
          sog: 5.5,
          heading: null,
          destination: null,
          callSign: null,
          length: null,
          beam: null,
          draft: null,
          navState: null,
          lastUpdateAt: 200,
        },
      ],
    )

    expect(Object.keys(merged)).toEqual(['mmsi:367123456'])
    expect(merged['mmsi:367123456']?.lat).toBe(29.1)
    expect(merged['mmsi:367123456']?.name).toBe('Alpha')
  })

  it('drops stale AIS contacts from a record', () => {
    const now = 1_000_000
    const pruned = pruneStaleAisContactRecord(
      {
        a: {
          id: 'a',
          name: null,
          mmsi: null,
          shipType: null,
          lat: 1,
          lng: 2,
          cog: null,
          sog: null,
          heading: null,
          destination: null,
          callSign: null,
          length: null,
          beam: null,
          draft: null,
          navState: null,
          lastUpdateAt: now - 60_000,
        },
        b: {
          id: 'b',
          name: null,
          mmsi: null,
          shipType: null,
          lat: 1,
          lng: 2,
          cog: null,
          sog: null,
          heading: null,
          destination: null,
          callSign: null,
          length: null,
          beam: null,
          draft: null,
          navState: null,
          lastUpdateAt: now - 10 * 60_000,
        },
      },
      now,
      5 * 60_000,
    )

    expect(Object.keys(pruned)).toEqual(['a'])
  })

  it('filters AIS contacts to a radius around the snapshot', () => {
    const snapshot = {
      vesselId: 'v1',
      source: 'test',
      observedAt: '2026-01-01T00:00:00.000Z',
      positionLat: 29.3,
      positionLng: -94.8,
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
      updatedAt: '2026-01-01T00:00:00.000Z',
    }

    const baseContact = {
      name: null,
      mmsi: null,
      shipType: null,
      cog: null,
      sog: null,
      heading: null,
      destination: null,
      callSign: null,
      length: null,
      beam: null,
      draft: null,
      navState: null,
      lastUpdateAt: Date.now(),
    }

    const nearby = filterAisContactsNearSnapshot(
      [
        { id: 'mmsi:1', ...baseContact, lat: 29.31, lng: -94.81 },
        { id: 'mmsi:2', ...baseContact, lat: 50, lng: -10 },
      ],
      snapshot,
    )

    expect(nearby.map((c) => c.id)).toEqual(['mmsi:1'])
  })

  it('prunes an AIS contact record by snapshot radius', () => {
    const snapshot = {
      vesselId: 'v1',
      source: 'test',
      observedAt: '2026-01-01T00:00:00.000Z',
      positionLat: 29.3,
      positionLng: -94.8,
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
      updatedAt: '2026-01-01T00:00:00.000Z',
    }

    const base = {
      name: null,
      mmsi: null,
      shipType: null,
      cog: null,
      sog: null,
      heading: null,
      destination: null,
      callSign: null,
      length: null,
      beam: null,
      draft: null,
      navState: null,
      lastUpdateAt: Date.now(),
    }

    const pruned = pruneAisContactRecordBySnapshot(
      {
        near: { id: 'near', ...base, lat: 29.31, lng: -94.81 },
        far: { id: 'far', ...base, lat: 60, lng: -10 },
      },
      snapshot,
    )

    expect(Object.keys(pruned)).toEqual(['near'])
  })

  it('returns removed AIS keys between record versions', () => {
    expect(
      diffRemovedAisContactKeys(
        {
          keep: {
            id: 'keep',
            name: null,
            mmsi: null,
            shipType: null,
            lat: 1,
            lng: 2,
            cog: null,
            sog: null,
            heading: null,
            destination: null,
            callSign: null,
            length: null,
            beam: null,
            draft: null,
            navState: null,
            lastUpdateAt: 1,
          },
          drop: {
            id: 'drop',
            name: null,
            mmsi: null,
            shipType: null,
            lat: 1,
            lng: 2,
            cog: null,
            sog: null,
            heading: null,
            destination: null,
            callSign: null,
            length: null,
            beam: null,
            draft: null,
            navState: null,
            lastUpdateAt: 1,
          },
        },
        {
          keep: {
            id: 'keep',
            name: null,
            mmsi: null,
            shipType: null,
            lat: 1,
            lng: 2,
            cog: null,
            sog: null,
            heading: null,
            destination: null,
            callSign: null,
            length: null,
            beam: null,
            draft: null,
            navState: null,
            lastUpdateAt: 2,
          },
        },
      ),
    ).toEqual(['drop'])
  })
})
