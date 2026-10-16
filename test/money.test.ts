import { describe, expect, it } from 'vitest'
import { centsToDecimal, formatMoney } from '../src/lib/money.js'

describe('formatMoney', () => {
  it('formats cents as euros with grouping', () => {
    expect(formatMoney(412500)).toBe('€4,125.00')
  })

  it('formats other currencies', () => {
    expect(formatMoney(999, 'USD')).toBe('US$9.99')
  })
})

describe('centsToDecimal', () => {
  it('renders cents as a plain decimal string', () => {
    expect(centsToDecimal(1992049)).toBe('19920.49')
    expect(centsToDecimal(412500)).toBe('4125.00')
    expect(centsToDecimal(5)).toBe('0.05')
    expect(centsToDecimal(0)).toBe('0.00')
    expect(centsToDecimal(-1050)).toBe('-10.50')
  })
})
