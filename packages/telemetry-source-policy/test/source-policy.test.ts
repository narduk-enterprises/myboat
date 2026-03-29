import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  buildStickyWinnerMap,
  classifySignalKSourceFamily,
  createTelemetrySourceCandidates,
  expandSignalKLeafValues,
  normalizeSignalKSourceInventory,
  selectTelemetryCandidates,
} from '../src/index.ts'

describe('telemetry source policy', () => {
  it('classifies the major source families', () => {
    assert.equal(classifySignalKSourceFamily('ydg-nmea-2000.74'), 'nmea2000')
    assert.equal(classifySignalKSourceFamily('ydg-nmea-0183.YD'), 'nmea0183')
    assert.equal(classifySignalKSourceFamily('venus.com.victronenergy.gps.141'), 'venus')
    assert.equal(classifySignalKSourceFamily('signalk-leopard-empirbus-switches'), 'leopard_plugin')
    assert.equal(classifySignalKSourceFamily('defaults'), 'defaults')
  })

  it('expands nested object-valued updates into leaf paths', () => {
    assert.deepEqual(
      expandSignalKLeafValues('navigation.position', {
        latitude: 29.5,
        longitude: -95.1,
      }),
      [
        { canonicalPath: 'navigation.position.latitude', value: 29.5 },
        { canonicalPath: 'navigation.position.longitude', value: -95.1 },
      ],
    )

    assert.deepEqual(
      expandSignalKLeafValues('', {
        name: 'Tideye',
        design: {
          length: {
            overall: 12.4,
          },
        },
      }),
      [
        { canonicalPath: 'name', value: 'Tideye' },
        { canonicalPath: 'design.length.overall', value: 12.4 },
      ],
    )
  })

  it('prefers the explicit self-navigation source order', () => {
    const candidates = [
      ...createTelemetrySourceCandidates({
        context: 'vessels.self',
        originalPath: 'navigation.position',
        publisherRole: 'primary',
        receivedAt: '2026-03-29T12:00:00.000Z',
        sourceId: 'ydg-nmea-0183.YD',
        value: { latitude: 29.5, longitude: -95.1 },
      }),
      ...createTelemetrySourceCandidates({
        context: 'vessels.self',
        originalPath: 'navigation.position',
        publisherRole: 'primary',
        receivedAt: '2026-03-29T12:00:00.100Z',
        sourceId: 'venus.com.victronenergy.gps.141',
        value: { latitude: 29.51, longitude: -95.11 },
      }),
      ...createTelemetrySourceCandidates({
        context: 'vessels.self',
        originalPath: 'navigation.position',
        publisherRole: 'primary',
        receivedAt: '2026-03-29T12:00:00.200Z',
        sourceId: 'ydg-nmea-2000.74',
        value: { latitude: 29.52, longitude: -95.12 },
      }),
    ]

    const results = selectTelemetryCandidates({ candidates, now: '2026-03-29T12:00:00.200Z' })
    assert.equal(results.length, 2)
    assert.deepEqual(
      results.map((result) => result.winnerSourceId),
      ['ydg-nmea-2000.74', 'ydg-nmea-2000.74'],
    )
  })

  it('keeps a fresh sticky winner over same-tier competition but allows better sources through', () => {
    const firstSelection = selectTelemetryCandidates({
      candidates: createTelemetrySourceCandidates({
        context: 'vessels.self',
        originalPath: 'environment.current',
        publisherRole: 'primary',
        receivedAt: '2026-03-29T12:00:00.000Z',
        sourceId: 'ydg-nmea-2000.4',
        value: { drift: 1.2, setTrue: 1.4 },
      }),
      now: '2026-03-29T12:00:00.000Z',
    })

    const stickyWinners = buildStickyWinnerMap(firstSelection)
    const secondSelection = selectTelemetryCandidates({
      candidates: createTelemetrySourceCandidates({
        context: 'vessels.self',
        originalPath: 'environment.current',
        publisherRole: 'primary',
        receivedAt: '2026-03-29T12:00:05.000Z',
        sourceId: 'ydg-nmea-0183.YD',
        value: { drift: 1.3, setTrue: 1.5 },
      }),
      now: '2026-03-29T12:00:05.000Z',
      stickyWinners,
    })

    assert.deepEqual(
      secondSelection.map((result) => result.kept),
      [null, null],
    )
    assert.deepEqual(
      secondSelection.map((result) => result.rejected[0]?.reason),
      ['sticky_winner_fresh', 'sticky_winner_fresh'],
    )
  })

  it('suppresses shadow publishers while a fresh primary winner exists', () => {
    const selection = selectTelemetryCandidates({
      candidates: [
        ...createTelemetrySourceCandidates({
          context: 'vessels.self',
          originalPath: 'navigation.speedOverGround',
          publisherRole: 'primary',
          receivedAt: '2026-03-29T12:00:00.000Z',
          sourceId: 'ydg-nmea-2000.74',
          value: 6.4,
        }),
        ...createTelemetrySourceCandidates({
          context: 'vessels.self',
          originalPath: 'navigation.speedOverGround',
          publisherRole: 'shadow',
          receivedAt: '2026-03-29T12:00:00.100Z',
          sourceId: 'ydg-nmea-2000.74',
          value: 6.5,
        }),
      ],
      now: '2026-03-29T12:00:00.100Z',
    })

    assert.equal(selection.length, 1)
    assert.equal(selection[0]?.winnerPublisherRole, 'primary')
    assert.equal(selection[0]?.rejected[0]?.reason, 'shadow_source_suppressed')
  })

  it('normalizes source inventory snapshots', () => {
    const snapshot = normalizeSignalKSourceInventory({
      observedAt: '2026-03-29T12:00:00.000Z',
      publisherRole: 'shadow',
      raw: {
        'ydg-nmea-2000.74': { pgnsReceived: [129025, 129026] },
        'signalk-server': { version: '2.24.0' },
      },
    })

    assert.equal(snapshot.publisherRole, 'shadow')
    assert.equal(snapshot.sources.length, 2)
    assert.deepEqual(
      snapshot.sources.map((source) => source.family),
      ['signalk_server', 'nmea2000'],
    )
  })
})
