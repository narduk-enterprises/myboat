import { beforeAll, describe, expect, it, vi } from 'vitest'

let splitStoredAisHubMmsiBatches: typeof import('../../server/utils/aishub').splitStoredAisHubMmsiBatches

vi.mock('#server/database/app-schema', () => ({
  aishubRequestState: {},
  aishubSearchCache: {},
  aishubVessels: {},
}))

vi.mock('#server/utils/database', () => ({
  useAppDatabase: () => {
    throw new Error('Database access is not available in this unit test.')
  },
}))

vi.mock('#server/utils/myboat', () => ({
  syncFollowedVesselsFromAisHubForMmsis: vi.fn(),
}))

beforeAll(async () => {
  ;({ splitStoredAisHubMmsiBatches } = await import('../../server/utils/aishub'))
})

describe('AISHub stored lookup batching', () => {
  it('dedupes MMSIs and splits large lookups into safe batches', () => {
    const rawMmsis = Array.from({ length: 405 }, (_, index) => String(100000000 + index))
    rawMmsis.unshift(' 100000000 ')
    rawMmsis.push('100000050')

    const batches = splitStoredAisHubMmsiBatches(rawMmsis)

    expect(batches).toHaveLength(3)
    expect(batches[0]).toHaveLength(200)
    expect(batches[1]).toHaveLength(200)
    expect(batches[2]).toHaveLength(5)
    expect(batches[0]?.[0]).toBe('100000000')
    expect(batches[2]?.[4]).toBe('100000404')
  })
})
