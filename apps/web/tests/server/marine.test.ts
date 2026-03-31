import { describe, expect, it } from 'vitest'
import { formatTimestamp } from '~/utils/marine'

describe('formatTimestamp', () => {
  it('does not leave a comma before clock time (Node vs WebKit ICU hydration stability)', () => {
    const s = formatTimestamp('2023-12-05T18:10:00.000Z')
    expect(s).not.toMatch(/\d{4},\s*\d{1,2}:\d{2}/)
    expect(s).toMatch(/\d{4} at \d{1,2}:\d{2}/i)
  })
})
