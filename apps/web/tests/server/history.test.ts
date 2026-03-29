import { describe, expect, it } from 'vitest'
import {
  getHistoryCatalog,
  buildHistoryFluxQuery,
  buildHistoryLines,
  getHistorySeriesDefinition,
} from '../../server/utils/history'

describe('history helpers', () => {
  it('builds core and detail history lines from curated SignalK paths', () => {
    const lines = buildHistoryLines({
      delta: {
        context: 'vessels.self',
        updates: [
          {
            values: [
              {
                path: 'navigation.position',
                value: { latitude: 29.546, longitude: -95.186 },
              },
              { path: 'navigation.headingMagnetic', value: Math.PI },
              { path: 'navigation.speedOverGround', value: 6.2 },
              { path: 'environment.current', value: { drift: 0.8, setTrue: Math.PI / 2 } },
              { path: 'electrical.batteries.tideyeBmv.voltage', value: 13.1 },
              { path: 'electrical.solar.tideyeSolar1.panelPower', value: 410 },
              { path: 'electrical.switches.leopard.navLights', value: true },
            ],
          },
        ],
      },
      installationId: 'install-1',
      observedAt: '2026-03-29T09:00:00.000Z',
      vesselId: 'vessel-1',
    })

    expect(lines.coreLines.join('\n')).toContain('myboat_history_core')
    expect(lines.coreLines.join('\n')).toContain('series_id=navigation.position.latitude')
    expect(lines.coreLines.join('\n')).toContain('series_id=navigation.position.longitude')
    expect(lines.coreLines.join('\n')).toContain('series_id=navigation.headingMagnetic')
    expect(lines.coreLines.join('\n')).toContain('series_id=environment.current.drift')
    expect(lines.coreLines.join('\n')).toContain('series_id=electrical.batteries.tideyeBmv.voltage')
    expect(lines.coreLines.join('\n')).toContain('numeric_value=180')
    expect(lines.detailLines.join('\n')).toContain('myboat_history_detail')
    expect(lines.detailLines.join('\n')).toContain(
      'series_id=electrical.solar.tideyeSolar1.panelPower',
    )
    expect(lines.detailLines.join('\n')).not.toContain('switches.leopard.navLights')
  })

  it('ignores non-self deltas when building vessel history lines', () => {
    const lines = buildHistoryLines({
      delta: {
        context: 'vessels.urn:mrn:imo:mmsi:123456789',
        self: 'vessels.self',
        updates: [
          {
            values: [
              {
                path: 'navigation.position',
                value: { latitude: 10, longitude: 11 },
              },
              { path: 'navigation.speedOverGround', value: 4.2 },
            ],
          },
        ],
      },
      installationId: 'install-1',
      observedAt: '2026-03-29T09:00:00.000Z',
      vesselId: 'vessel-1',
    })

    expect(lines.coreLines).toEqual([])
    expect(lines.detailLines).toEqual([])
  })

  it('exposes curated history metadata for exact and pattern-backed series ids', () => {
    expect(getHistorySeriesDefinition('navigation.speedOverGround')).toMatchObject({
      aggregator: 'mean',
      tier: 'core',
      visibility: 'public',
    })

    expect(getHistorySeriesDefinition('electrical.solar.tideyeSolar1.panelPower')).toMatchObject({
      aggregator: 'mean',
      tier: 'detail',
      visibility: 'owner',
    })
  })

  it('exposes discoverable owner and public history catalogs', () => {
    const ownerCatalog = getHistoryCatalog('owner')
    const publicCatalog = getHistoryCatalog('public')

    expect(ownerCatalog.series.some((series) => series.id === 'navigation.attitude.roll')).toBe(
      true,
    )
    expect(publicCatalog.series.some((series) => series.id === 'navigation.attitude.roll')).toBe(
      false,
    )
    expect(
      ownerCatalog.families.some((family) => family.id === 'steering.{system}.rudderAngle'),
    ).toBe(true)
    expect(
      publicCatalog.families.some((family) => family.id === 'steering.{system}.rudderAngle'),
    ).toBe(false)
  })

  it('builds aggregate-heavy flux queries without pivots', () => {
    const query = buildHistoryFluxQuery({
      aggregator: 'mean',
      bucket: 'myboat-history-core-free',
      end: '2026-03-29T10:00:00.000Z',
      measurement: 'myboat_history_core',
      resolution: '5m',
      seriesIds: ['navigation.speedOverGround', 'environment.wind.speedApparent'],
      start: '2026-03-29T08:00:00.000Z',
      vesselId: 'vessel-1',
    })

    expect(query).toContain('from(bucket: "myboat-history-core-free")')
    expect(query).toContain('aggregateWindow(every: 5m, fn: mean, createEmpty: false)')
    expect(query).toContain('r._measurement == "myboat_history_core"')
    expect(query).toContain('r.series_id == "navigation.speedOverGround"')
    expect(query).not.toContain('pivot(')
  })
})
