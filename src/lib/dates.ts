/** Small helpers for ISO calendar dates (YYYY-MM-DD). */

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

/** True if the value is a real calendar date in YYYY-MM-DD form. */
export function isIsoDate(value: string): boolean {
  if (!ISO_DATE.test(value)) return false
  const date = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value)
}

/** Compares two ISO dates. Negative if a is earlier than b. */
export function compareIsoDates(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0
}

/** The calendar date of a moment in local time, as YYYY-MM-DD. */
export function toIsoDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}
