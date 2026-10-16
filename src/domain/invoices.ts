/** Pure invoice logic: totals and discounts, filtering, validation and status changes. */
import { compareIsoDates, isIsoDate } from '../lib/dates.js'
import type { Invoice, InvoiceFilter, InvoiceLine, NewInvoice } from './types.js'

/** Sum of all lines before any discount, in cents. */
export function invoiceSubtotal(lines: InvoiceLine[]): number {
  return lines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0)
}

/**
 * Discount in cents: subtotal x percent / 100, rounded half-up to the cent.
 * Integer math only: the percent becomes hundredths of a percent first, so 12.35 is 1235 and
 * discount = floor((subtotal * 1235 + 5000) / 10000). No discount (undefined or null) is 0.
 */
export function discountAmount(subtotal: number, discountPercent?: number | null): number {
  if (discountPercent === undefined || discountPercent === null) return 0
  const hundredths = Math.round(discountPercent * 100)
  return Math.floor((subtotal * hundredths + 5000) / 10000)
}

/** Amount payable in cents: the subtotal of the lines minus the discount, if any. */
export function invoiceTotal(lines: InvoiceLine[], discountPercent?: number | null): number {
  const subtotal = invoiceSubtotal(lines)
  return subtotal - discountAmount(subtotal, discountPercent)
}

export interface InvoiceAmounts {
  subtotal: number
  /** null when the invoice has no discount. */
  discountPercent: number | null
  discountAmount: number
  total: number
}

/** Subtotal, discount and total of an invoice, in cents. Every total shown anywhere comes from here. */
export function invoiceAmounts(invoice: Pick<Invoice, 'lines' | 'discountPercent'>): InvoiceAmounts {
  const subtotal = invoiceSubtotal(invoice.lines)
  const discount = discountAmount(subtotal, invoice.discountPercent)
  return {
    subtotal,
    discountPercent: invoice.discountPercent ?? null,
    discountAmount: discount,
    total: subtotal - discount,
  }
}

/**
 * Checks a discount percent: a number from 0 to 100 with at most two decimals.
 * Returns a list of problems; empty means valid.
 */
export function validateDiscountPercent(value: unknown): string[] {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return ['discountPercent must be a number from 0 to 100']
  }
  const problems: string[] = []
  if (value < 0 || value > 100) problems.push(`discountPercent must be from 0 to 100, got ${value}`)
  // Tolerance, because 12.35 * 100 is 1234.9999999999998 in floating point.
  if (Math.abs(value * 100 - Math.round(value * 100)) >= 1e-9) {
    problems.push(`discountPercent must have at most two decimals, got ${value}`)
  }
  return problems
}

export type SetDiscountResult = { ok: true; invoice: Invoice } | { ok: false; error: string }

/**
 * Sets (a number) or removes (null) the discount of a draft invoice. Sent and paid invoices are
 * refused. The value must already be valid (validateDiscountPercent).
 */
export function setInvoiceDiscount(invoice: Invoice, discountPercent: number | null): SetDiscountResult {
  if (invoice.status !== 'draft') {
    return {
      ok: false,
      error: `Invoice ${invoice.number} is ${invoice.status}; the discount can only be changed while it is a draft`,
    }
  }
  const updated: Invoice = { ...invoice }
  if (discountPercent === null) delete updated.discountPercent
  else updated.discountPercent = discountPercent
  return { ok: true, invoice: updated }
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
  if (input.discountPercent !== undefined) problems.push(...validateDiscountPercent(input.discountPercent))
  return problems
}

export type MarkPaidResult = { ok: true; invoice: Invoice } | { ok: false; error: string }

/** Marks a sent invoice as paid on the given date. Drafts and paid invoices are refused. */
export function markInvoicePaid(invoice: Invoice, paidDate: string): MarkPaidResult {
  if (invoice.status === 'paid') {
    return { ok: false, error: `Invoice ${invoice.number} is already paid` }
  }
  if (invoice.status !== 'sent') {
    return { ok: false, error: `Invoice ${invoice.number} is a ${invoice.status}; only sent invoices can be marked as paid` }
  }
  return { ok: true, invoice: { ...invoice, status: 'paid', paidDate } }
}
