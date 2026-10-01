/**
 * The shared money formatter. Amounts are stored as integer cents.
 * Use this everywhere money is shown, so all views look the same.
 */
export function formatMoney(cents: number, currency = 'EUR', locale = 'en-IE'): string {
  return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(cents / 100)
}
