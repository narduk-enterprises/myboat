import { describe, expect, it } from 'vitest'
import { matchVesselLiveRoute, toVesselDetailPath } from '../../worker/liveRoute'

describe('live route helpers', () => {
  it('matches authenticated live websocket routes', () => {
    const route = matchVesselLiveRoute('/api/app/vessels/north-star/live')

    expect(route).toEqual({
      namespace: 'auth',
      vesselSlug: 'north-star',
    })
    expect(toVesselDetailPath(route!)).toBe('/api/app/vessels/north-star')
  })

  it('matches public live websocket routes', () => {
    const route = matchVesselLiveRoute('/api/public/narduk/tideye/live')

    expect(route).toEqual({
      namespace: 'public',
      username: 'narduk',
      vesselSlug: 'tideye',
    })
    expect(toVesselDetailPath(route!)).toBe('/api/public/narduk/tideye')
  })

  it('ignores non-live routes', () => {
    expect(matchVesselLiveRoute('/api/public/narduk/tideye')).toBeNull()
    expect(matchVesselLiveRoute('/api/app/vessels/north-star')).toBeNull()
  })
})
