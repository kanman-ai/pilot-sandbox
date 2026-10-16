/**
 * The shared money formatter. Amounts are stored as integer cents.
 * Use this everywhere money is shown, so all views look the same.
 */
export function formatMoney(cents: number, currency = 'EUR', locale = 'en-IE'): string {
  return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(cents / 100)
}

/**
 * Plain decimal string of an amount in cents, e.g. 1992049 -> "19920.49".
 * Not for display (use formatMoney); kept for API fields that already return this shape.
 */
export function centsToDecimal(cents: number): string {
  const sign = cents < 0 ? '-' : ''
  const abs = Math.abs(Math.round(cents))
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`
}
