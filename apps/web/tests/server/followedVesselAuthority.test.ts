import { describe, expect, it } from 'vitest'
import type { AisHubVessel, FollowedVessel } from '../../server/database/app-schema'
import { mergeFollowedVesselAuthority } from '../../server/utils/myboat'

function buildFollowedVessel(overrides: Partial<FollowedVessel> = {}): FollowedVessel {
  return {
    id: 'followed-1',
    ownerUserId: 'user-1',
    source: 'aishub',
    matchMode: 'mmsi',
    mmsi: '236112646',
    imo: null,
    name: 'DIVINE',
    callSign: 'OLD1234',
    destination: 'Legacy destination',
    lastReportAt: '2026-03-28T00:00:00.000Z',
    positionLat: 1,
    positionLng: 2,
    shipType: 36,
    sourceStationsJson: '["paste"]',
    createdAt: '2026-03-28T00:00:00.000Z',
    updatedAt: '2026-03-28T00:00:00.000Z',
    ...overrides,
  }
}

function buildAuthority(overrides: Partial<AisHubVessel> = {}): AisHubVessel {
  return {
    mmsi: '236112646',
    imo: null,
    name: 'DEEP PLAYA',
    callSign: null,
    destination: null,
    lastReportAt: null,
    positionLat: null,
    positionLng: null,
    shipType: null,
    courseOverGround: null,
    speedOverGround: null,
    heading: null,
    rateOfTurn: null,
    navStatus: null,
    dimensionBow: null,
    dimensionStern: null,
    dimensionPort: null,
    dimensionStarboard: null,
    draughtMeters: null,
    etaRaw: null,
    sourceStationsJson: '[]',
    searchDocument: '236112646 deep playa',
    firstSeenAt: '2026-03-29T06:00:00.000Z',
    lastFetchedAt: '2026-03-29T06:00:00.000Z',
    updatedAt: '2026-03-29T06:00:00.000Z',
    ...overrides,
  }
}

describe('mergeFollowedVesselAuthority', () => {
  it('returns the saved row unchanged when no authoritative AIS row exists', () => {
    const saved = buildFollowedVessel()

    expect(mergeFollowedVesselAuthority(saved, null)).toEqual(saved)
  })

  it('replaces pasted fields with authoritative AIS data for the same MMSI', () => {
    const saved = buildFollowedVessel()
    const authority = buildAuthority()

    expect(mergeFollowedVesselAuthority(saved, authority)).toEqual({
      ...saved,
      source: 'aishub',
      imo: authority.imo,
      name: 'DEEP PLAYA',
      callSign: null,
      destination: null,
      lastReportAt: null,
      positionLat: null,
      positionLng: null,
      shipType: null,
      sourceStationsJson: '[]',
      updatedAt: '2026-03-29T06:00:00.000Z',
    })
  })
})
