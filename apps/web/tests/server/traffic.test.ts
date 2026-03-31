import { describe, expect, it, vi } from 'vitest'

vi.mock('#imports', () => ({
  useRuntimeConfig: () => ({}),
}))

vi.mock('#server/utils/aishub', () => ({
  getStoredAisHubResultsByMmsis: vi.fn(async () => new Map()),
}))

vi.mock('#server/database/app-schema', () => ({
  vesselInstallations: {},
}))

vi.mock('#server/utils/database', () => ({
  useAppDatabase: vi.fn(() => ({
    select: () => ({
      from: () => ({
        where: () => ({
          orderBy: () => ({
            get: async () => null,
          }),
        }),
      }),
    }),
  })),
}))

vi.mock('#server/utils/liveBroker', () => ({
  fetchVesselLiveState: vi.fn(async () => null),
}))

vi.mock('#server/utils/vesselIdentity', () => ({
  extractObservedIdentityPatchFromSignalKModel: vi.fn(() => null),
}))

const { buildTrafficContactFromSignalKVessel } = await import('../../server/utils/traffic')

describe('traffic utilities', () => {
  it('preserves the SignalK navigation timestamp for contact freshness', () => {
    const staleObservedAt = '2026-03-27T17:11:39.090Z'
    const fallbackObservedAtMs = Date.parse('2026-03-31T20:57:12.401Z')

    const contact = buildTrafficContactFromSignalKVessel(
      'urn:mrn:imo:mmsi:367362010',
      {
        name: {
          value: 'Old Position Vessel',
          timestamp: '2026-03-31T20:57:12.401Z',
        },
        navigation: {
          position: {
            value: {
              latitude: 29.4530133,
              longitude: -94.8453465,
            },
            timestamp: staleObservedAt,
          },
          speedOverGround: {
            value: 0.2,
            timestamp: staleObservedAt,
          },
        },
      },
      fallbackObservedAtMs,
    )

    expect(contact).toMatchObject({
      id: 'mmsi:367362010',
      mmsi: '367362010',
      name: 'Old Position Vessel',
      lat: 29.4530133,
      lng: -94.8453465,
      sog: 0.2,
    })
    expect(contact?.lastUpdateAt).toBe(Date.parse(staleObservedAt))
  })
})
