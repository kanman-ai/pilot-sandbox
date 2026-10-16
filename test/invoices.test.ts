import { describe, expect, it } from 'vitest'
import { seedInvoices } from '../src/data/seed.js'
import {
  filterInvoices,
  invoiceTotal,
  markInvoicePaid,
  nextInvoiceNumber,
  validateNewInvoice,
} from '../src/domain/invoices.js'
import type { Invoice } from '../src/domain/types.js'

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

  describe('markInvoicePaid', () => {
    const invoice = (status: Invoice['status']): Invoice => ({
      id: 'inv_x', number: 'INV-2026-0099', customerId: 'cus_acme',
      issueDate: '2026-09-01', dueDate: '2026-10-01', currency: 'EUR', status,
      lines: [{ description: 'A', quantity: 1, unitPrice: 100 }],
    })

    it('marks a sent invoice as paid on the given date without changing the input', () => {
      const sent = invoice('sent')
      const result = markInvoicePaid(sent, '2026-10-16')
      expect(result).toEqual({ ok: true, invoice: { ...sent, status: 'paid', paidDate: '2026-10-16' } })
      expect(sent.status).toBe('sent')
      expect(sent.paidDate).toBeUndefined()
    })

    it('refuses drafts', () => {
      expect(markInvoicePaid(invoice('draft'), '2026-10-16')).toEqual({
        ok: false,
        error: 'Invoice INV-2026-0099 is a draft; only sent invoices can be marked as paid',
      })
    })

    it('refuses invoices that are already paid', () => {
      expect(markInvoicePaid(invoice('paid'), '2026-10-16')).toEqual({
        ok: false,
        error: 'Invoice INV-2026-0099 is already paid',
      })
    })
  })
})
