import { describe, expect, it } from 'vitest'
import {
  DEFAULT_LIVE_DEMAND,
  createMyBoatLiveWebSocketUrl,
  isLiveDemandEmpty,
  mergeAisContactSummary,
  mergeLiveDemands,
  normalizeLiveDemand,
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
    expect(createMyBoatLiveWebSocketUrl('/api/app/vessels/north-star/live', 'https://mybo.at')).toBe(
      'wss://mybo.at/api/app/vessels/north-star/live',
    )
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
})
