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
})
