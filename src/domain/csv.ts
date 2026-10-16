/** CSV export of invoices (RFC 4180 style: comma separated, CRLF line endings, quoted when needed). */
import { centsToDecimal } from '../lib/money.js'
import { compareIsoDates, isIsoDate } from '../lib/dates.js'
import { invoiceAmounts } from './invoices.js'
import type { Invoice } from './types.js'

export const CSV_HEADER = ['number', 'customer', 'issue_date', 'due_date', 'status', 'total', 'currency'] as const

/** Quotes a value when it contains a comma, a double quote or a line break. Inner quotes are doubled. */
export function csvEscape(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value
}

/**
 * Prefixes free text that starts with =, +, -, @, tab or carriage return with a single quote, so a
 * spreadsheet shows it as text instead of running it as a formula (OWASP CSV injection guidance).
 * Use it for text columns only; csvEscape still runs afterwards.
 */
export function neutraliseFormula(value: string): string {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value
}

export interface DateRange {
  from: string
  to: string
}

/** Checks the from and to query values. Returns the range, or a message that says what is wrong. */
export function parseDateRange(from: unknown, to: unknown): { range: DateRange } | { error: string } {
  for (const [name, value] of [['from', from], ['to', to]] as const) {
    if (value === undefined || value === '') return { error: `${name} is required (YYYY-MM-DD)` }
    if (typeof value !== 'string' || !isIsoDate(value)) {
      return { error: `${name} must be a real date in YYYY-MM-DD form, got "${String(value)}"` }
    }
  }
  const range = { from: from as string, to: to as string }
  if (compareIsoDates(range.from, range.to) > 0) {
    return { error: `from (${range.from}) must not be after to (${range.to})` }
  }
  return { range }
}

/** Invoices issued within the range, both days included, newest first. */
export function invoicesInRange(invoices: Invoice[], range: DateRange): Invoice[] {
  return invoices
    .filter((invoice) => compareIsoDates(invoice.issueDate, range.from) >= 0)
    .filter((invoice) => compareIsoDates(invoice.issueDate, range.to) <= 0)
    .sort((a, b) => compareIsoDates(b.issueDate, a.issueDate) || b.number.localeCompare(a.number))
}

/**
 * Builds the CSV text: header row, then one row per invoice in the given order.
 * Formula neutralisation applies to the text columns (number, customer) only. Dates are YYYY-MM-DD,
 * status is one of a fixed set, currency is a code and the total (after any discount) is a number that may be negative,
 * so prefixing those would only corrupt them.
 */
export function buildInvoicesCsv(invoices: Invoice[], customerName: (customerId: string) => string): string {
  const rows = invoices.map((invoice) => [
    neutraliseFormula(invoice.number),
    neutraliseFormula(customerName(invoice.customerId)),
    invoice.issueDate,
    invoice.dueDate,
    invoice.status,
    centsToDecimal(invoiceAmounts(invoice).total),
    invoice.currency,
  ])
  return [[...CSV_HEADER], ...rows].map((row) => row.map(csvEscape).join(',')).join('\r\n') + '\r\n'
}

/** The download file name for a range, for example invoices-2026-03-01-to-2026-06-30.csv. */
export function exportFileName(range: DateRange): string {
  return `invoices-${range.from}-to-${range.to}.csv`
}
