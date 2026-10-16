import type { FastifyInstance } from 'fastify'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { buildApp } from '../src/app.js'
import { seedInvoices } from '../src/data/seed.js'
import { buildInvoicesCsv } from '../src/domain/csv.js'
import {
  discountAmount,
  invoiceAmounts,
  invoiceSubtotal,
  invoiceTotal,
  setInvoiceDiscount,
  validateDiscountPercent,
} from '../src/domain/invoices.js'
import type { Invoice, InvoiceStatus } from '../src/domain/types.js'

function invoice(status: InvoiceStatus, discountPercent?: number): Invoice {
  return {
    id: 'inv_x', number: 'INV-2026-0099', customerId: 'cus_acme',
    issueDate: '2026-10-01', dueDate: '2026-10-31', currency: 'EUR', status,
    ...(discountPercent === undefined ? {} : { discountPercent }),
    lines: [{ description: 'Work', quantity: 2, unitPrice: 5000 }],
  }
}

describe('discount amount', () => {
  it('is subtotal x percent / 100 for whole cents', () => {
    expect(discountAmount(45000, 10)).toBe(4500)
    expect(discountAmount(10000, 12.35)).toBe(1235)
  })

  it('rounds an exact half cent up', () => {
    // 1050 x 5% = 52.5 cents
    expect(discountAmount(1050, 5)).toBe(53)
    // 115 x 50% = 57.5 cents
    expect(discountAmount(115, 50)).toBe(58)
    // two-decimal percent: 200 x 12.25% = 24.5 cents
    expect(discountAmount(200, 12.25)).toBe(25)
  })

  it('rounds below a half cent down and above it up, with a two-decimal percent', () => {
    // 999 x 12.35% = 123.3765 cents
    expect(discountAmount(999, 12.35)).toBe(123)
    // 123448 x 10% = 12344.8 cents
    expect(discountAmount(123448, 10)).toBe(12345)
    // 1001 x 12.35% = 123.6235 cents
    expect(discountAmount(1001, 12.35)).toBe(124)
  })

  it('is 0 for 0% and for no discount, and the whole subtotal for 100%', () => {
    expect(discountAmount(123456, 0)).toBe(0)
    expect(discountAmount(123456, undefined)).toBe(0)
    expect(discountAmount(123456, null)).toBe(0)
    expect(discountAmount(123456, 100)).toBe(123456)
  })
})

describe('invoice totals with a discount', () => {
  const lines = [
    { description: 'A', quantity: 1, unitPrice: 100000 },
    { description: 'B', quantity: 3, unitPrice: 7816 },
  ]

  it('keeps the total of the lines when there is no discount', () => {
    expect(invoiceSubtotal(lines)).toBe(123448)
    expect(invoiceTotal(lines)).toBe(123448)
  })

  it('subtracts the rounded discount from the subtotal', () => {
    expect(invoiceTotal(lines, 10)).toBe(111103)
    expect(invoiceTotal(lines, 0)).toBe(123448)
    expect(invoiceTotal(lines, 100)).toBe(0)
  })

  it('reports subtotal, percent, discount and total, with null for no discount', () => {
    expect(invoiceAmounts({ lines, discountPercent: 10 })).toEqual({
      subtotal: 123448, discountPercent: 10, discountAmount: 12345, total: 111103,
    })
    expect(invoiceAmounts({ lines })).toEqual({
      subtotal: 123448, discountPercent: null, discountAmount: 0, total: 123448,
    })
  })
})

describe('validateDiscountPercent', () => {
  it.each([0, 10, 12.5, 12.35, 99.99, 100])('accepts %s', (value) => {
    expect(validateDiscountPercent(value)).toEqual([])
  })

  it('rejects a negative value', () => {
    expect(validateDiscountPercent(-1)).toEqual(['discountPercent must be from 0 to 100, got -1'])
  })

  it('rejects a value above 100', () => {
    expect(validateDiscountPercent(100.01)).toEqual(['discountPercent must be from 0 to 100, got 100.01'])
  })

  it('rejects more than two decimals', () => {
    expect(validateDiscountPercent(12.345)).toEqual(['discountPercent must have at most two decimals, got 12.345'])
    expect(validateDiscountPercent(0.001)).toEqual(['discountPercent must have at most two decimals, got 0.001'])
  })

  it.each([['a string', '10'], ['null', null], ['NaN', Number.NaN], ['Infinity', Number.POSITIVE_INFINITY], ['an object', {}]])(
    'rejects %s',
    (_name, value) => {
      expect(validateDiscountPercent(value)).toEqual(['discountPercent must be a number from 0 to 100'])
    },
  )
})

describe('setInvoiceDiscount', () => {
  it('sets, changes and removes the discount of a draft', () => {
    const set = setInvoiceDiscount(invoice('draft'), 10)
    expect(set).toEqual({ ok: true, invoice: invoice('draft', 10) })
    const changed = setInvoiceDiscount(invoice('draft', 10), 12.5)
    expect(changed).toEqual({ ok: true, invoice: invoice('draft', 12.5) })
    const removed = setInvoiceDiscount(invoice('draft', 10), null)
    expect(removed).toEqual({ ok: true, invoice: invoice('draft') })
    expect(removed.ok && removed.invoice).not.toHaveProperty('discountPercent')
  })

  it.each(['sent', 'paid'] as const)('refuses a %s invoice and leaves it unchanged', (status) => {
    const original = invoice(status)
    expect(setInvoiceDiscount(original, 10)).toEqual({
      ok: false,
      error: `Invoice INV-2026-0099 is ${status}; the discount can only be changed while it is a draft`,
    })
    expect(original).toEqual(invoice(status))
  })
})

describe('CSV export with a discount', () => {
  it('writes the discounted total', () => {
    const discounted = seedInvoices.map((entry) => (entry.id === 'inv_003' ? { ...entry, discountPercent: 10 } : entry))
    const csv = buildInvoicesCsv(discounted.filter((entry) => entry.id === 'inv_003'), () => 'Nordlicht Studio')
    // 72050 - 7205 = 64845
    expect(csv.split('\r\n')[1]).toBe('INV-2026-0003,Nordlicht Studio,2026-03-12,2026-04-11,paid,648.45,EUR')
  })
})

describe('discount API', () => {
  let app: FastifyInstance

  beforeEach(async () => {
    app = await buildApp()
  })

  afterEach(async () => {
    await app.close()
  })

  const patch = (id: string, payload: unknown) =>
    app.inject({ method: 'PATCH', url: `/api/invoices/${id}`, payload: payload as Record<string, unknown> })

  it('shows no discount on seeded invoices: discountPercent null, total equal to subtotal', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/invoices/inv_010' })
    expect(response.json()).toMatchObject({
      subtotal: 45000,
      subtotalFormatted: '€450.00',
      discountPercent: null,
      discountAmount: 0,
      discountAmountFormatted: '€0.00',
      total: 45000,
      totalFormatted: '€450.00',
    })
  })

  it('creates an invoice with a discount', async () => {
    const created = await app.inject({
      method: 'POST',
      url: '/api/invoices',
      payload: {
        customerId: 'cus_quarry',
        issueDate: '2026-10-01',
        dueDate: '2026-10-31',
        discountPercent: 12.5,
        lines: [{ description: 'Espresso machine service', quantity: 2, unitPrice: 12000 }],
      },
    })
    expect(created.statusCode).toBe(201)
    expect(created.json()).toMatchObject({
      status: 'draft',
      subtotal: 24000,
      discountPercent: 12.5,
      discountAmount: 3000,
      discountAmountFormatted: '€30.00',
      total: 21000,
      totalFormatted: '€210.00',
    })
    const reread = await app.inject({ method: 'GET', url: `/api/invoices/${created.json().id}` })
    expect(reread.json()).toMatchObject({ discountPercent: 12.5, total: 21000 })
  })

  it.each([
    ['negative', -5, /from 0 to 100/],
    ['above 100', 101, /from 0 to 100/],
    ['three decimals', 12.345, /at most two decimals/],
    ['a string', '10', /must be a number/],
  ])('rejects POST with a %s discount with 422', async (_name, discountPercent, message) => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/invoices',
      payload: {
        customerId: 'cus_quarry',
        issueDate: '2026-10-01',
        dueDate: '2026-10-31',
        discountPercent,
        lines: [{ description: 'Service', quantity: 1, unitPrice: 12000 }],
      },
    })
    expect(response.statusCode).toBe(422)
    expect(response.json().error).toBe('Invalid invoice')
    expect(response.json().problems).toEqual([expect.stringMatching(message)])
    const list = await app.inject({ method: 'GET', url: '/api/invoices' })
    expect(list.json().summary.count).toBe(10)
  })

  it('applies a discount to a draft with PATCH, and the list summary and CSV reflect it', async () => {
    const response = await patch('inv_010', { discountPercent: 10 })
    expect(response.statusCode).toBe(200)
    expect(response.json()).toMatchObject({
      number: 'INV-2026-0010',
      subtotal: 45000,
      subtotalFormatted: '€450.00',
      discountPercent: 10,
      discountAmount: 4500,
      discountAmountFormatted: '€45.00',
      total: 40500,
      totalFormatted: '€405.00',
    })

    const detail = await app.inject({ method: 'GET', url: '/api/invoices/inv_010' })
    expect(detail.json()).toMatchObject({ discountPercent: 10, total: 40500 })

    const list = await app.inject({ method: 'GET', url: '/api/invoices' })
    const row = list.json().invoices.find((entry: { id: string }) => entry.id === 'inv_010')
    expect(row).toMatchObject({ total: 40500, totalFormatted: '€405.00' })
    // 1992049 - 4500
    expect(list.json().summary).toEqual({
      count: 10,
      total: '19875.49',
      totalCents: 1987549,
      totalFormatted: '€19,875.49',
    })

    const csv = await app.inject({ method: 'GET', url: '/api/invoices/export.csv?from=2026-09-28&to=2026-09-28' })
    expect(csv.body.trimEnd().split('\r\n')[1]).toBe('INV-2026-0010,Birch & Sons,2026-09-28,2026-10-28,draft,405.00,EUR')
  })

  it('accepts a two-decimal percent such as 12.35', async () => {
    const response = await patch('inv_010', { discountPercent: 12.35 })
    expect(response.statusCode).toBe(200)
    // 45000 x 12.35% = 5557.5 cents, rounded half-up
    expect(response.json()).toMatchObject({ discountPercent: 12.35, discountAmount: 5558, total: 39442 })
  })

  it('removes the discount with null', async () => {
    await patch('inv_010', { discountPercent: 10 })
    const response = await patch('inv_010', { discountPercent: null })
    expect(response.statusCode).toBe(200)
    expect(response.json()).toMatchObject({ discountPercent: null, discountAmount: 0, total: 45000 })
    const detail = await app.inject({ method: 'GET', url: '/api/invoices/inv_010' })
    expect(detail.json()).toMatchObject({ discountPercent: null, subtotal: 45000, total: 45000 })
  })

  it.each([
    ['sent', 'inv_009', 'INV-2026-0009', 412500],
    ['paid', 'inv_004', 'INV-2026-0004', 245000],
  ])('refuses a %s invoice with 409 and leaves it unchanged', async (status, id, number, total) => {
    const before = await app.inject({ method: 'GET', url: `/api/invoices/${id}` })
    const response = await patch(id, { discountPercent: 10 })
    expect(response.statusCode).toBe(409)
    expect(response.json()).toEqual({
      error: `Invoice ${number} is ${status}; the discount can only be changed while it is a draft`,
    })
    const after = await app.inject({ method: 'GET', url: `/api/invoices/${id}` })
    expect(after.json()).toEqual(before.json())
    expect(after.json()).toMatchObject({ status, discountPercent: null, total })
  })

  it('returns 404 for an unknown invoice', async () => {
    const response = await patch('inv_999', { discountPercent: 10 })
    expect(response.statusCode).toBe(404)
    expect(response.json()).toEqual({ error: 'Invoice inv_999 not found' })
  })

  it.each([
    ['negative', -1, 'discountPercent must be from 0 to 100, got -1'],
    ['above 100', 100.5, 'discountPercent must be from 0 to 100, got 100.5'],
    ['three decimals', 12.345, 'discountPercent must have at most two decimals, got 12.345'],
    ['a string', '10', 'discountPercent must be a number from 0 to 100'],
    ['a boolean', true, 'discountPercent must be a number from 0 to 100'],
  ])('rejects PATCH with a %s value with 422 and changes nothing', async (_name, discountPercent, problem) => {
    const response = await patch('inv_010', { discountPercent })
    expect(response.statusCode).toBe(422)
    expect(response.json()).toEqual({ error: 'Invalid discount', problems: [problem] })
    const detail = await app.inject({ method: 'GET', url: '/api/invoices/inv_010' })
    expect(detail.json()).toMatchObject({ discountPercent: null, total: 45000 })
  })
})
