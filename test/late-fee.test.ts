import type { FastifyInstance } from 'fastify'
import { afterEach, describe, expect, it } from 'vitest'
import { buildApp } from '../src/app.js'
import { InvoiceStore } from '../src/data/store.js'
import { seedCustomers, seedInvoices } from '../src/data/seed.js'
import { LATE_FEE_PERCENT, lateFeeAmount } from '../src/domain/invoices.js'
import type { Invoice } from '../src/domain/types.js'

const invoice = (id: string, status: Invoice['status'], dueDate: string, unitPrice: number, discountPercent?: number): Invoice => ({
  id, number: `INV-2026-${id.slice(-4)}`, customerId: 'cus_acme',
  issueDate: '2026-09-01', dueDate, currency: 'EUR', status,
  ...(discountPercent === undefined ? {} : { discountPercent }),
  lines: [{ description: 'A', quantity: 1, unitPrice }],
})

// Subtotal 123450, 10% discount 12345, total 111105; 5% of that is 5555.25 -> 5555.
const discountedOverdue = invoice('inv_0911', 'sent', '2026-10-01', 123450, 10)
// 5% of 10 cents is 0.5 -> 1 (half-up).
const halfCentOverdue = invoice('inv_0912', 'sent', '2026-10-01', 10)
const sentDueToday = invoice('inv_0913', 'sent', '2026-10-16', 50000)
const fixtures = [discountedOverdue, halfCentOverdue, sentDueToday]

describe('lateFeeAmount', () => {
  it('is 5% of the total, rounded half-up to the cent, for an overdue invoice', () => {
    expect(LATE_FEE_PERCENT).toBe(5)
    expect(lateFeeAmount(394999, 'overdue')).toBe(19750)
    expect(lateFeeAmount(10, 'overdue')).toBe(1)
    expect(lateFeeAmount(30, 'overdue')).toBe(2)
    expect(lateFeeAmount(29, 'overdue')).toBe(1)
    expect(lateFeeAmount(0, 'overdue')).toBe(0)
  })

  it('is 0 for draft, sent and paid invoices', () => {
    expect(lateFeeAmount(394999, 'draft')).toBe(0)
    expect(lateFeeAmount(394999, 'sent')).toBe(0)
    expect(lateFeeAmount(394999, 'paid')).toBe(0)
  })
})

describe('late fee in the API', () => {
  let app: FastifyInstance | undefined

  afterEach(async () => {
    await app?.close()
    app = undefined
  })

  /** An app with the seed data plus the fixtures and the clock fixed at noon of the given local date. */
  async function appOn(year: number, monthIndex: number, day: number): Promise<FastifyInstance> {
    await app?.close()
    const store = new InvoiceStore(seedCustomers, [...seedInvoices, ...fixtures])
    app = await buildApp({ store, now: () => new Date(year, monthIndex, day, 12, 0) })
    return app
  }

  const get = async (server: FastifyInstance, id: string) =>
    (await server.inject({ method: 'GET', url: `/api/invoices/${id}` })).json()

  it('adds a 5% late fee and the total due to an overdue invoice, leaving total unchanged', async () => {
    const server = await appOn(2026, 9, 16)
    expect(await get(server, 'inv_005')).toMatchObject({
      status: 'overdue',
      total: 394999,
      totalFormatted: '€3,949.99',
      lateFee: 19750,
      lateFeeFormatted: '€197.50',
      totalDue: 414749,
      totalDueFormatted: '€4,147.49',
    })
    const rows = (await server.inject({ method: 'GET', url: '/api/invoices' })).json().invoices
    expect(rows.find((row: { id: string }) => row.id === 'inv_005')).toMatchObject({
      total: 394999, lateFee: 19750, totalDue: 414749,
    })
  })

  it('takes the fee from the discounted total', async () => {
    const server = await appOn(2026, 9, 16)
    expect(await get(server, 'inv_0911')).toMatchObject({
      status: 'overdue', subtotal: 123450, discountAmount: 12345, total: 111105, lateFee: 5555, totalDue: 116660,
    })
  })

  it('rounds half a cent up', async () => {
    const server = await appOn(2026, 9, 16)
    expect(await get(server, 'inv_0912')).toMatchObject({ status: 'overdue', total: 10, lateFee: 1, totalDue: 11 })
  })

  it.each([
    ['inv_010', 'draft'],
    ['inv_004', 'paid'],
    ['inv_0913', 'sent'],
  ])('has no late fee on %s (%s)', async (id, status) => {
    const server = await appOn(2026, 9, 16)
    const view = await get(server, id)
    expect(view.status).toBe(status)
    expect(view.lateFee).toBe(0)
    expect(view.lateFeeFormatted).toBe('€0.00')
    expect(view.totalDue).toBe(view.total)
    expect(view.totalDueFormatted).toBe(view.totalFormatted)
  })

  it('applies the fee once: it is the same on two later dates', async () => {
    const first = await get(await appOn(2026, 9, 17), 'inv_005')
    const later = await get(await appOn(2027, 2, 1), 'inv_005')
    expect(first).toMatchObject({ status: 'overdue', lateFee: 19750, totalDue: 414749 })
    expect(later).toMatchObject({ status: 'overdue', lateFee: 19750, totalDue: 414749 })
  })

  it('leaves the list summary without the fee, and mark-paid returns lateFee 0', async () => {
    const server = await appOn(2026, 9, 16)
    const list = (await server.inject({ method: 'GET', url: '/api/invoices' })).json()
    const totals = list.invoices.reduce((sum: number, row: { total: number }) => sum + row.total, 0)
    expect(list.summary.totalCents).toBe(totals)
    const paid = await server.inject({ method: 'POST', url: '/api/invoices/inv_0912/mark-paid' })
    expect(paid.json()).toMatchObject({ status: 'paid', lateFee: 0, totalDue: 10 })
  })
})
