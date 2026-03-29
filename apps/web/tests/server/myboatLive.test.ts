import { describe, expect, it } from 'vitest'
import {
  DEFAULT_LIVE_DEMAND,
  createMyBoatLiveWebSocketUrl,
  isLiveDemandEmpty,
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
})
