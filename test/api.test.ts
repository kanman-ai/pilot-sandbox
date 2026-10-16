import type { FastifyInstance } from 'fastify'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { buildApp } from '../src/app.js'

let app: FastifyInstance

beforeEach(async () => {
  app = await buildApp()
})

afterEach(async () => {
  await app.close()
})

describe('invoice API', () => {
  it('lists all seeded invoices with a summary', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/invoices' })
    expect(response.statusCode).toBe(200)
    const body = response.json()
    expect(body.invoices).toHaveLength(10)
    expect(body.summary.count).toBe(10)
  })

  it('returns the summary total raw, in cents and formatted with the shared formatter', async () => {
    const all = await app.inject({ method: 'GET', url: '/api/invoices' })
    expect(all.json().summary).toEqual({
      count: 10,
      total: '19920.49',
      totalCents: 1992049,
      totalFormatted: '€19,920.49',
    })

    const sent = await app.inject({ method: 'GET', url: '/api/invoices?status=sent' })
    expect(sent.json().summary).toEqual({
      count: 5,
      total: '13764.99',
      totalCents: 1376499,
      totalFormatted: '€13,764.99',
    })
  })

  it('formats each invoice total and line unit price with the shared formatter', async () => {
    const list = await app.inject({ method: 'GET', url: '/api/invoices' })
    const row = list.json().invoices.find((invoice: { number: string }) => invoice.number === 'INV-2026-0009')
    expect(row).toMatchObject({ total: 412500, totalFormatted: '€4,125.00' })

    const detail = await app.inject({ method: 'GET', url: '/api/invoices/inv_008' })
    expect(detail.json()).toMatchObject({
      total: 440000,
      totalFormatted: '€4,400.00',
      lines: [{ description: 'Loyalty card app, design sprint', quantity: 5, unitPrice: 88000, unitPriceFormatted: '€880.00' }],
    })
  })

  it('filters by customer', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/invoices?customerId=cus_birch' })
    const numbers = response.json().invoices.map((invoice: { number: string }) => invoice.number)
    expect(numbers).toEqual(['INV-2026-0010', 'INV-2026-0006', 'INV-2026-0002'])
  })

  it('returns one invoice or 404', async () => {
    const found = await app.inject({ method: 'GET', url: '/api/invoices/inv_009' })
    expect(found.json()).toMatchObject({ number: 'INV-2026-0009', customerName: 'Acme Logistics GmbH', total: 412500 })
    const missing = await app.inject({ method: 'GET', url: '/api/invoices/inv_999' })
    expect(missing.statusCode).toBe(404)
    expect(missing.json()).toEqual({ error: 'Invoice inv_999 not found' })
  })

  it('creates a draft invoice and rejects invalid input', async () => {
    const created = await app.inject({
      method: 'POST',
      url: '/api/invoices',
      payload: {
        customerId: 'cus_quarry',
        issueDate: '2026-10-01',
        dueDate: '2026-10-31',
        lines: [{ description: 'Espresso machine service', quantity: 2, unitPrice: 12000 }],
      },
    })
    expect(created.statusCode).toBe(201)
    expect(created.json()).toMatchObject({ number: 'INV-2026-0011', status: 'draft', total: 24000 })

    const invalid = await app.inject({
      method: 'POST',
      url: '/api/invoices',
      payload: { customerId: 'cus_nobody', issueDate: '2026-10-01', dueDate: '2026-10-31', lines: [] },
    })
    expect(invalid.statusCode).toBe(422)
    expect(invalid.json().problems).toContain('customerId does not exist')
  })

  it('exports a date range as a CSV download without colliding with /:id', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/invoices/export.csv?from=2026-03-01&to=2026-06-30' })
    expect(response.statusCode).toBe(200)
    expect(response.headers['content-type']).toMatch(/^text\/csv/)
    expect(response.headers['content-disposition']).toBe('attachment; filename="invoices-2026-03-01-to-2026-06-30.csv"')
    const lines = response.body.trimEnd().split('\r\n')
    expect(lines[0]).toBe('number,customer,issue_date,due_date,status,total,currency')
    expect(lines.slice(1).map((line) => line.split(',')[0])).toEqual([
      'INV-2026-0006', 'INV-2026-0005', 'INV-2026-0004', 'INV-2026-0003',
    ])
    expect(lines[4]).toMatch(/,720\.50,EUR$/)
  })

  it.each([
    ['from after to', 'from=2026-07-01&to=2026-06-01', /must not be after/],
    ['missing from', 'to=2026-06-01', /from is required/],
    ['malformed date', 'from=01.03.2026&to=2026-06-01', /from must be a real date in YYYY-MM-DD form/],
    ['impossible date', 'from=2026-02-01&to=2026-02-30', /to must be a real date in YYYY-MM-DD form/],
  ])('rejects the export with 400 for %s', async (_name, query, message) => {
    const response = await app.inject({ method: 'GET', url: `/api/invoices/export.csv?${query}` })
    expect(response.statusCode).toBe(400)
    expect(response.json().error).toMatch(message)
  })

  it('returns one customer, the same as its entry in the customer list', async () => {
    const list = await app.inject({ method: 'GET', url: '/api/customers' })
    const entry = list.json().customers.find((customer: { id: string }) => customer.id === 'cus_birch')
    expect(entry).toBeDefined()

    const response = await app.inject({ method: 'GET', url: '/api/customers/cus_birch' })
    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual(entry)
  })

  it('returns 404 with an error naming the id for an unknown customer', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/customers/cus_nobody' })
    expect(response.statusCode).toBe(404)
    expect(response.json()).toEqual({ error: 'Customer cus_nobody not found' })
  })

  describe('POST /api/invoices/:id/mark-paid', () => {
    let fixed: FastifyInstance

    beforeEach(async () => {
      fixed = await buildApp({ now: () => new Date(2026, 9, 16, 12, 0) })
    })

    afterEach(async () => {
      await fixed.close()
    })

    it('marks a sent invoice as paid today and keeps it paid', async () => {
      const response = await fixed.inject({ method: 'POST', url: '/api/invoices/inv_009/mark-paid' })
      expect(response.statusCode).toBe(200)
      expect(response.json()).toMatchObject({ number: 'INV-2026-0009', status: 'paid', paidDate: '2026-10-16' })
      expect(response.json()).toMatchObject({
        totalFormatted: '€4,125.00',
        lines: [{ unitPriceFormatted: '€4,125.00' }],
      })

      const reread = await fixed.inject({ method: 'GET', url: '/api/invoices/inv_009' })
      expect(reread.json()).toMatchObject({ status: 'paid', paidDate: '2026-10-16' })
      const paid = await fixed.inject({ method: 'GET', url: '/api/invoices?status=paid' })
      expect(paid.json().summary.count).toBe(5)
    })

    it('refuses a draft with 409 and changes nothing', async () => {
      const response = await fixed.inject({ method: 'POST', url: '/api/invoices/inv_010/mark-paid' })
      expect(response.statusCode).toBe(409)
      expect(response.json().error).toBe('Invoice INV-2026-0010 is a draft; only sent invoices can be marked as paid')
      const reread = await fixed.inject({ method: 'GET', url: '/api/invoices/inv_010' })
      expect(reread.json().status).toBe('draft')
      expect(reread.json()).not.toHaveProperty('paidDate')
    })

    it('refuses an invoice that is already paid with 409 and changes nothing', async () => {
      const response = await fixed.inject({ method: 'POST', url: '/api/invoices/inv_004/mark-paid' })
      expect(response.statusCode).toBe(409)
      expect(response.json().error).toBe('Invoice INV-2026-0004 is already paid')
      const reread = await fixed.inject({ method: 'GET', url: '/api/invoices/inv_004' })
      expect(reread.json().status).toBe('paid')
      expect(reread.json()).not.toHaveProperty('paidDate')
    })

    it('refuses to mark the same invoice paid twice', async () => {
      await fixed.inject({ method: 'POST', url: '/api/invoices/inv_009/mark-paid' })
      const again = await fixed.inject({ method: 'POST', url: '/api/invoices/inv_009/mark-paid' })
      expect(again.statusCode).toBe(409)
    })

    it('returns 404 for an unknown invoice', async () => {
      const response = await fixed.inject({ method: 'POST', url: '/api/invoices/inv_999/mark-paid' })
      expect(response.statusCode).toBe(404)
      expect(response.json()).toEqual({ error: 'Invoice inv_999 not found' })
    })
  })
})
