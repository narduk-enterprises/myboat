import {
  createTelemetrySourceCandidates,
  selectCanonicalTelemetry,
} from '@myboat/telemetry-source-policy'
import { describe, expect, it } from 'vitest'
import {
  buildTelemetrySelectionSummary,
  hydrateInstallationTelemetrySourceState,
  normalizeSourceInventoryIngress,
} from '../../server/utils/telemetrySources'

describe('telemetry source diagnostics helpers', () => {
  it('summarizes duplicate hotspots and tracked winners from selection results', () => {
    const results = selectCanonicalTelemetry({
      candidates: [
        ...createTelemetrySourceCandidates({
          context: 'vessels.self',
          originalPath: 'navigation.speedOverGround',
          publisherRole: 'primary',
          receivedAt: '2026-03-29T12:00:00.000Z',
          sourceId: 'ydg-nmea-0183.YD',
          value: 6.0,
        }),
        ...createTelemetrySourceCandidates({
          context: 'vessels.self',
          originalPath: 'navigation.speedOverGround',
          publisherRole: 'primary',
          receivedAt: '2026-03-29T12:00:00.100Z',
          sourceId: 'ydg-nmea-2000.74',
          value: 6.2,
        }),
      ],
      now: '2026-03-29T12:00:00.100Z',
    })

    const summary = buildTelemetrySelectionSummary({
      observedAt: '2026-03-29T12:00:00.100Z',
      selections: results,
    })

    expect(summary.duplicateHotspots).toHaveLength(1)
    expect(summary.duplicateHotspots[0]).toMatchObject({
      canonicalPath: 'navigation.speedOverGround',
      contenderSourceIds: ['ydg-nmea-0183.YD', 'ydg-nmea-2000.74'],
      winnerSourceId: 'ydg-nmea-2000.74',
    })
    expect(summary.trackedWinners).toHaveLength(1)
    expect(summary.trackedWinners[0]).toMatchObject({
      canonicalPath: 'navigation.speedOverGround',
      sourceId: 'ydg-nmea-2000.74',
    })
  })

  it('treats non-object source inventory JSON as absent', () => {
    const hydrated = hydrateInstallationTelemetrySourceState({
      currentWinnersJson: '[]',
      duplicateHotspotsJson: '[]',
      lastInventoryObservedAt: null,
      lastSelectionObservedAt: null,
      policyVersion: null,
      publisherRole: null,
      shadowPublisherSeen: null,
      sourceInventoryJson: '[]',
    })

    expect(hydrated.sourceInventory).toBeNull()
    expect(hydrated.policyVersion).toBe('2026-03-29')
  })

  it('normalizes collector source inventory payloads with self context intact', () => {
    const snapshot = normalizeSourceInventoryIngress({
      observedAt: '2026-03-29T12:00:00.000Z',
      publisherRole: 'primary',
      selfContext: 'vessels.self',
      sources: [
        {
          family: 'nmea2000',
          label: 'N2K GPS',
          metadata: { label: 'N2K GPS', pgn: 129026 },
          sourceId: 'ydg-nmea-2000.74',
        },
        {
          id: 'signalk-leopard-empirbus-switches',
          metadata: { label: 'Leopard switches' },
        },
      ],
    })

    expect(snapshot).toMatchObject({
      observedAt: '2026-03-29T12:00:00.000Z',
      publisherRole: 'primary',
      selfContext: 'vessels.self',
      sourceCount: 2,
    })
    expect(snapshot.sources).toEqual([
      {
        family: 'nmea2000',
        label: 'N2K GPS',
        metadata: { label: 'N2K GPS', pgn: 129026 },
        sourceId: 'ydg-nmea-2000.74',
      },
      {
        family: 'leopard_plugin',
        label: 'signalk-leopard-empirbus-switches',
        metadata: { label: 'Leopard switches' },
        sourceId: 'signalk-leopard-empirbus-switches',
      },
    ])
  })
})
