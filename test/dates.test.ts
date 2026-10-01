import { describe, expect, it } from 'vitest'
import { isIsoDate } from '../src/lib/dates.js'

describe('isIsoDate', () => {
  it('accepts real calendar dates', () => {
    expect(isIsoDate('2026-02-28')).toBe(true)
  })

  it('rejects malformed or impossible dates', () => {
    expect(isIsoDate('2026-2-28')).toBe(false)
    expect(isIsoDate('2026-02-30')).toBe(false)
  })
})
