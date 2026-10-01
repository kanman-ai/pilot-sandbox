/** Pure invoice logic: totals, filtering and validation. */
import { compareIsoDates, isIsoDate } from '../lib/dates.js'
import type { Invoice, InvoiceFilter, InvoiceLine, NewInvoice } from './types.js'

/** Total of all lines, in cents. */
export function invoiceTotal(lines: InvoiceLine[]): number {
  return lines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0)
}

/** Applies the list filters and sorts by issue date, newest first. */
export function filterInvoices(invoices: Invoice[], filter: InvoiceFilter): Invoice[] {
  return invoices
    .filter((invoice) => !filter.status || invoice.status === filter.status)
    .filter((invoice) => !filter.customerId || invoice.customerId === filter.customerId)
    .sort((a, b) => compareIsoDates(b.issueDate, a.issueDate) || b.number.localeCompare(a.number))
}

/** Builds the next invoice number for a year, for example INV-2026-0007. */
export function nextInvoiceNumber(existing: Invoice[], year: number): string {
  const prefix = `INV-${year}-`
  const highest = existing
    .map((invoice) => invoice.number)
    .filter((number) => number.startsWith(prefix))
    .map((number) => Number(number.slice(prefix.length)))
    .reduce((max, value) => Math.max(max, value), 0)
  return `${prefix}${String(highest + 1).padStart(4, '0')}`
}

/** Returns a list of problems with a new invoice. Empty means valid. */
export function validateNewInvoice(input: NewInvoice): string[] {
  const problems: string[] = []
  if (!isIsoDate(input.issueDate)) problems.push('issueDate must be a date in YYYY-MM-DD form')
  if (!isIsoDate(input.dueDate)) problems.push('dueDate must be a date in YYYY-MM-DD form')
  if (problems.length === 0 && compareIsoDates(input.dueDate, input.issueDate) < 0) {
    problems.push('dueDate must not be before issueDate')
  }
  if (input.lines.length === 0) problems.push('an invoice needs at least one line')
  return problems
}
