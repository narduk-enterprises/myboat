import { describe, expect, it } from 'vitest'
import {
  buildStickyWinnerMap,
  classifySignalKSourceFamily,
  createTelemetrySourceCandidates,
  expandSignalKLeafValues,
  normalizeSignalKSourceInventory,
  selectCanonicalTelemetry,
  selectTelemetryCandidates,
} from '@myboat/telemetry-source-policy'

function candidatesFor(input: {
  context: string
  path: string
  publisherRole?: 'primary' | 'shadow'
  receivedAt?: string
  self?: string
  sourceId: string
  value: unknown
}) {
  return createTelemetrySourceCandidates({
    context: input.context,
    originalPath: input.path,
    publisherRole: input.publisherRole || 'primary',
    receivedAt: input.receivedAt || '2026-03-29T12:00:00.000Z',
    self: input.self,
    sourceId: input.sourceId,
    value: input.value,
  })
}

describe('telemetry source policy', () => {
  it('classifies known SignalK source families', () => {
    expect(classifySignalKSourceFamily('ydg-nmea-2000.74')).toBe('nmea2000')
    expect(classifySignalKSourceFamily('ydg-nmea-0183.YD')).toBe('nmea0183')
    expect(classifySignalKSourceFamily('venus.com.victronenergy.system.0')).toBe('venus')
    expect(classifySignalKSourceFamily('signalk-leopard-empirbus-switches')).toBe('leopard_plugin')
    expect(classifySignalKSourceFamily('signalk-engine-hours.0')).toBe('engine_hours_plugin')
    expect(classifySignalKSourceFamily('defaults')).toBe('defaults')
  })

  it('expands object-valued and root-path SignalK updates into leaf paths', () => {
    expect(
      expandSignalKLeafValues('navigation.position', {
        latitude: 29.5458,
        longitude: -95.1864,
      }),
    ).toEqual([
      { canonicalPath: 'navigation.position.latitude', value: 29.5458 },
      { canonicalPath: 'navigation.position.longitude', value: -95.1864 },
    ])

    expect(
      expandSignalKLeafValues('', {
        design: {
          length: {
            overall: 12.3,
          },
        },
      }),
    ).toEqual([{ canonicalPath: 'design.length.overall', value: 12.3 }])
  })

  it('prefers direct NMEA 2000 navigation over Venus and 0183 fallbacks', () => {
    const results = selectCanonicalTelemetry({
      candidates: [
        ...candidatesFor({
          context: 'vessels.self',
          path: 'navigation.speedOverGround',
          self: 'vessels.self',
          sourceId: 'ydg-nmea-2000.74',
          value: 6.4,
        }),
        ...candidatesFor({
          context: 'vessels.self',
          path: 'navigation.speedOverGround',
          self: 'vessels.self',
          sourceId: 'venus.com.victronenergy.gps.141',
          value: 6.3,
        }),
        ...candidatesFor({
          context: 'vessels.self',
          path: 'navigation.speedOverGround',
          self: 'vessels.self',
          sourceId: 'ydg-nmea-0183.YD',
          value: 6.1,
        }),
        ...candidatesFor({
          context: 'vessels.self',
          path: 'navigation.speedOverGround',
          self: 'vessels.self',
          sourceId: 'ydg-nmea-0183.AI',
          value: 6.0,
        }),
      ],
      now: Date.parse('2026-03-29T12:00:10.000Z'),
    })

    expect(results).toHaveLength(1)
    expect(results[0]?.winner?.sourceId).toBe('ydg-nmea-2000.74')
    expect(results[0]?.dropped.map((drop) => drop.candidate.sourceId)).toEqual([
      'venus.com.victronenergy.gps.141',
      'ydg-nmea-0183.YD',
      'ydg-nmea-0183.AI',
    ])
  })

  it('suppresses shadow publishers while a fresh primary winner exists', () => {
    const sticky = buildStickyWinnerMap(
      selectCanonicalTelemetry({
        candidates: candidatesFor({
          context: 'vessels.self',
          path: 'environment.wind.speedApparent',
          self: 'vessels.self',
          sourceId: 'ydg-nmea-2000.105',
          value: 8.2,
        }),
        now: Date.parse('2026-03-29T12:00:00.000Z'),
      }),
    )

    const results = selectCanonicalTelemetry({
      candidates: candidatesFor({
        context: 'vessels.self',
        path: 'environment.wind.speedApparent',
        publisherRole: 'shadow',
        receivedAt: '2026-03-29T12:00:05.000Z',
        self: 'vessels.self',
        sourceId: 'ydg-nmea-0183.YD',
        value: 8.0,
      }),
      now: Date.parse('2026-03-29T12:00:05.000Z'),
      stickyWinners: sticky,
    })

    expect(results[0]?.winner).toBeNull()
    expect(results[0]?.dropped[0]?.reason).toBe('shadow_source_suppressed')
  })

  it('applies AIS and switch-domain precedence with debug-only raw bank switches', () => {
    const aisResults = selectCanonicalTelemetry({
      candidates: [
        ...candidatesFor({
          context: 'vessels.urn:mrn:imo:mmsi:367341190',
          path: 'navigation.position.latitude',
          sourceId: 'ydg-nmea-2000.2',
          value: 29.6,
        }),
        ...candidatesFor({
          context: 'vessels.urn:mrn:imo:mmsi:367341190',
          path: 'navigation.position.latitude',
          sourceId: 'ydg-nmea-0183.AI',
          value: 29.61,
        }),
      ],
      now: Date.parse('2026-03-29T12:00:00.000Z'),
    })

    expect(aisResults[0]?.winner?.sourceId).toBe('ydg-nmea-2000.2')

    const switchResults = selectCanonicalTelemetry({
      candidates: [
        ...candidatesFor({
          context: 'vessels.self',
          path: 'electrical.switches.leopard.navLights',
          self: 'vessels.self',
          sourceId: 'signalk-leopard-empirbus-switches',
          value: true,
        }),
        ...candidatesFor({
          context: 'vessels.self',
          path: 'electrical.switches.bank.1',
          self: 'vessels.self',
          sourceId: 'ydg-nmea-0183.36',
          value: true,
        }),
      ],
      now: Date.parse('2026-03-29T12:00:00.000Z'),
    })

    expect(switchResults.find((result) => result.winner)?.winner?.sourceId).toBe(
      'signalk-leopard-empirbus-switches',
    )
    expect(switchResults.find((result) => result.debugOnly)?.debugOnly).toBe(true)
  })

  it('normalizes source inventory snapshots with source counts and self context', () => {
    const snapshot = normalizeSignalKSourceInventory({
      observedAt: '2026-03-29T12:00:00.000Z',
      publisherRole: 'primary',
      selfContext: 'vessels.self',
      raw: {
        'ydg-nmea-2000.74': { label: 'N2K GPS 74', pgn: 129026 },
        'signalk-leopard-empirbus-switches': { label: 'Leopard switches' },
      },
    })

    expect(snapshot.selfContext).toBe('vessels.self')
    expect(snapshot.sourceCount).toBe(2)
    expect(snapshot.sources.map((source) => source.sourceId)).toEqual([
      'signalk-leopard-empirbus-switches',
      'ydg-nmea-2000.74',
    ])
  })

  it('exposes wrapper results that preserve sticky-winner freshness semantics', () => {
    const initial = selectCanonicalTelemetry({
      candidates: candidatesFor({
        context: 'vessels.self',
        path: 'electrical.batteries.36.voltage',
        self: 'vessels.self',
        sourceId: 'ydg-nmea-2000.36',
        value: 13.2,
      }),
      now: Date.parse('2026-03-29T12:00:00.000Z'),
    })
    const sticky = buildStickyWinnerMap(initial)

    const wrapped = selectTelemetryCandidates({
      candidates: [
        ...candidatesFor({
          context: 'vessels.self',
          path: 'electrical.batteries.36.voltage',
          receivedAt: '2026-03-29T12:00:20.000Z',
          self: 'vessels.self',
          sourceId: 'ydg-nmea-2000.37',
          value: 13.1,
        }),
        ...candidatesFor({
          context: 'vessels.self',
          path: 'electrical.batteries.36.voltage',
          receivedAt: '2026-03-29T12:00:20.000Z',
          self: 'vessels.self',
          sourceId: 'ydg-nmea-2000.0',
          value: 13.0,
        }),
      ],
      now: '2026-03-29T12:00:20.000Z',
      stickyWinners: sticky,
    })

    expect(wrapped[0]?.kept).toBeNull()
    expect(wrapped[0]?.rejected.map((entry) => entry.reason)).toEqual([
      'sticky_winner_fresh',
      'sticky_winner_fresh',
    ])
  })
})
