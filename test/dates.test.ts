import { describe, expect, it } from 'vitest'
import { isIsoDate, toIsoDate } from '../src/lib/dates.js'

describe('isIsoDate', () => {
  it('accepts real calendar dates', () => {
    expect(isIsoDate('2026-02-28')).toBe(true)
  })

  it('rejects malformed or impossible dates', () => {
    expect(isIsoDate('2026-2-28')).toBe(false)
    expect(isIsoDate('2026-02-30')).toBe(false)
  })
})

describe('toIsoDate', () => {
  it('formats the local calendar date with zero padding', () => {
    expect(toIsoDate(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05')
    expect(toIsoDate(new Date(2026, 11, 31, 0, 0))).toBe('2026-12-31')
  })
})
