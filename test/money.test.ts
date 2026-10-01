import { describe, expect, it } from 'vitest'
import { formatMoney } from '../src/lib/money.js'

describe('formatMoney', () => {
  it('formats cents as euros with grouping', () => {
    expect(formatMoney(412500)).toBe('€4,125.00')
  })

  it('formats other currencies', () => {
    expect(formatMoney(999, 'USD')).toBe('US$9.99')
  })
})
