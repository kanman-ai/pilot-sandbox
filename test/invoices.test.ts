import { describe, expect, it } from 'vitest'
import { seedInvoices } from '../src/data/seed.js'
import { filterInvoices, invoiceTotal, nextInvoiceNumber, validateNewInvoice } from '../src/domain/invoices.js'

describe('invoice domain', () => {
  it('sums line totals in cents', () => {
    expect(invoiceTotal([
      { description: 'A', quantity: 3, unitPrice: 9500 },
      { description: 'B', quantity: 1, unitPrice: 45000 },
    ])).toBe(73500)
  })

  it('filters by status and sorts newest first', () => {
    const sent = filterInvoices(seedInvoices, { status: 'sent' })
    expect(sent.map((invoice) => invoice.number)).toEqual([
      'INV-2026-0009', 'INV-2026-0008', 'INV-2026-0007', 'INV-2026-0006', 'INV-2026-0005',
    ])
  })

  it('numbers invoices per year', () => {
    expect(nextInvoiceNumber(seedInvoices, 2026)).toBe('INV-2026-0011')
    expect(nextInvoiceNumber(seedInvoices, 2027)).toBe('INV-2027-0001')
  })

  it('rejects a due date before the issue date', () => {
    expect(validateNewInvoice({
      customerId: 'cus_acme',
      issueDate: '2026-10-01',
      dueDate: '2026-09-01',
      lines: [{ description: 'A', quantity: 1, unitPrice: 100 }],
    })).toEqual(['dueDate must not be before issueDate'])
  })
})
