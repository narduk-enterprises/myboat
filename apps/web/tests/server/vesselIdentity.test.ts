import { beforeAll, describe, expect, it, vi } from 'vitest'

let extractObservedSelfIdentityPatchFromDelta: typeof import('../../server/utils/vesselIdentity').extractObservedSelfIdentityPatchFromDelta
let extractObservedSelfIdentityPatchFromSignalKModel: typeof import('../../server/utils/vesselIdentity').extractObservedSelfIdentityPatchFromSignalKModel
let mergeObservedIdentityPatches: typeof import('../../server/utils/vesselIdentity').mergeObservedIdentityPatches

vi.mock('#server/database/app-schema', () => ({}))
vi.mock('#server/utils/database', () => ({
  useAppDatabase: () => {
    throw new Error('Database access is not available in this unit test.')
  },
}))

beforeAll(async () => {
  ;({
    extractObservedSelfIdentityPatchFromDelta,
    extractObservedSelfIdentityPatchFromSignalKModel,
    mergeObservedIdentityPatches,
  } = await import('../../server/utils/vesselIdentity'))
})

describe('vessel identity helpers', () => {
  it('extracts observed self identity from self deltas', () => {
    const patch = extractObservedSelfIdentityPatchFromDelta({
      context: 'vessels.urn:mrn:imo:mmsi:367341190',
      self: 'vessels.urn:mrn:imo:mmsi:367341190',
      updates: [
        {
          values: [
            { path: 'name', value: 'SEA CHANGE' },
            { path: 'communication.callsignVhf', value: 'WDN8821' },
            { path: 'design.aisShipType', value: 37 },
            { path: 'design.length.overall', value: 12.4 },
            { path: 'design.beam', value: 4.2 },
            { path: 'design.draft.current', value: 1.8 },
          ],
        },
      ],
    })

    expect(patch).toEqual({
      selfContext: 'vessels.urn:mrn:imo:mmsi:367341190',
      mmsi: '367341190',
      observedName: 'SEA CHANGE',
      callSign: 'WDN8821',
      shipTypeCode: 37,
      lengthOverall: 12.4,
      beam: 4.2,
      draft: 1.8,
    })
  })

  it('extracts observed self identity from SignalK self models', () => {
    const patch = extractObservedSelfIdentityPatchFromSignalKModel(
      {
        name: { value: 'SEA CHANGE' },
        communication: {
          callsignVhf: { value: 'WDN8821' },
        },
        design: {
          type: { value: 'sailing vessel' },
          aisShipType: { value: 37 },
          length: {
            overall: { value: 12.4 },
          },
          beam: { value: 4.2 },
          draft: {
            current: { value: 1.8 },
          },
        },
        registrations: {
          imo: { value: '9387421' },
        },
      },
      'vessels.urn:mrn:imo:mmsi:367341190',
    )

    expect(patch).toEqual({
      selfContext: 'vessels.urn:mrn:imo:mmsi:367341190',
      mmsi: '367341190',
      observedName: 'SEA CHANGE',
      callSign: 'WDN8821',
      shipType: 'sailing vessel',
      shipTypeCode: 37,
      lengthOverall: 12.4,
      beam: 4.2,
      draft: 1.8,
      imo: '9387421',
    })
  })

  it('merges sparse observed identity patches without discarding older fields', () => {
    expect(
      mergeObservedIdentityPatches(
        {
          mmsi: '367341190',
          observedName: 'SEA CHANGE',
        },
        {
          callSign: 'WDN8821',
        },
      ),
    ).toEqual({
      mmsi: '367341190',
      observedName: 'SEA CHANGE',
      callSign: 'WDN8821',
    })
  })
})
