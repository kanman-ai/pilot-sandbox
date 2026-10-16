import type { FastifyInstance } from 'fastify'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { buildApp } from '../src/app.js'
import { InvoiceStore } from '../src/data/store.js'
import { seedCustomers, seedInvoices } from '../src/data/seed.js'
import { buildInvoicesCsv } from '../src/domain/csv.js'
import { filterInvoices, invoiceStatusOn } from '../src/domain/invoices.js'
import type { Invoice } from '../src/domain/types.js'

const TODAY = '2026-10-16'

const invoice = (id: string, status: Invoice['status'], dueDate: string): Invoice => ({
  id, number: `INV-2026-${id.slice(-4)}`, customerId: 'cus_acme',
  issueDate: '2026-09-01', dueDate, currency: 'EUR', status,
  lines: [{ description: 'A', quantity: 1, unitPrice: 100 }],
})

const dueYesterday = invoice('inv_0901', 'sent', '2026-10-15')
const dueToday = invoice('inv_0902', 'sent', '2026-10-16')
const draftPastDue = invoice('inv_0903', 'draft', '2026-10-01')
const paidPastDue = invoice('inv_0904', 'paid', '2026-10-01')
const fixtures = [dueYesterday, dueToday, draftPastDue, paidPastDue]

describe('invoiceStatusOn', () => {
  it('shows a sent invoice due before today as overdue', () => {
    expect(invoiceStatusOn(dueYesterday, TODAY)).toBe('overdue')
  })

  it('keeps a sent invoice due today or later as sent', () => {
    expect(invoiceStatusOn(dueToday, TODAY)).toBe('sent')
    expect(invoiceStatusOn(invoice('inv_0905', 'sent', '2026-11-01'), TODAY)).toBe('sent')
  })

  it('never makes drafts or paid invoices overdue', () => {
    expect(invoiceStatusOn(draftPastDue, TODAY)).toBe('draft')
    expect(invoiceStatusOn(paidPastDue, TODAY)).toBe('paid')
  })
})

describe('filterInvoices with today', () => {
  it('filters on the shown status', () => {
    expect(filterInvoices(fixtures, { status: 'overdue' }, TODAY).map((i) => i.id)).toEqual(['inv_0901'])
    expect(filterInvoices(fixtures, { status: 'sent' }, TODAY).map((i) => i.id)).toEqual(['inv_0902'])
    expect(filterInvoices(fixtures, { status: 'draft' }, TODAY).map((i) => i.id)).toEqual(['inv_0903'])
    expect(filterInvoices(fixtures, { status: 'paid' }, TODAY).map((i) => i.id)).toEqual(['inv_0904'])
  })
})

describe('buildInvoicesCsv with today', () => {
  it('writes the shown status in the status column', () => {
    const lines = buildInvoicesCsv(fixtures, () => 'Acme', TODAY).trimEnd().split('\r\n')
    expect(lines.slice(1).map((line) => line.split(',')[4])).toEqual(['overdue', 'sent', 'draft', 'paid'])
  })
})

describe('overdue status in the API (clock fixed at 2026-10-16)', () => {
  let app: FastifyInstance

  beforeEach(async () => {
    const store = new InvoiceStore(seedCustomers, [...seedInvoices, ...fixtures])
    app = await buildApp({ store, now: () => new Date(2026, 9, 16, 12, 0) })
  })

  afterEach(async () => {
    await app.close()
  })

  const get = async (url: string) => app.inject({ method: 'GET', url })
  const statusOf = (invoices: Invoice[], id: string) => invoices.find((i) => i.id === id)?.status

  it('shows overdue in list rows and GET /:id, but keeps due-today, draft and paid as they are', async () => {
    const list = (await get('/api/invoices')).json().invoices as Invoice[]
    expect(statusOf(list, 'inv_0901')).toBe('overdue')
    expect(statusOf(list, 'inv_0902')).toBe('sent')
    expect(statusOf(list, 'inv_0903')).toBe('draft')
    expect(statusOf(list, 'inv_0904')).toBe('paid')
    expect(statusOf(list, 'inv_005')).toBe('overdue')

    expect((await get('/api/invoices/inv_0901')).json().status).toBe('overdue')
    expect((await get('/api/invoices/inv_0902')).json().status).toBe('sent')
    expect((await get('/api/invoices/inv_0903')).json().status).toBe('draft')
    expect((await get('/api/invoices/inv_0904')).json().status).toBe('paid')
  })

  it('filters ?status=overdue and ?status=sent on the shown status', async () => {
    const overdue = await get('/api/invoices?status=overdue')
    expect(overdue.statusCode).toBe(200)
    expect(overdue.json().invoices.map((i: Invoice) => i.id)).toEqual([
      'inv_009', 'inv_0901', 'inv_008', 'inv_007', 'inv_006', 'inv_005',
    ])
    expect(overdue.json().summary.count).toBe(6)

    const sent = await get('/api/invoices?status=sent')
    expect(sent.json().invoices.map((i: Invoice) => i.id)).toEqual(['inv_0902'])
  })

  it('still rejects an unknown status with 400', async () => {
    expect((await get('/api/invoices?status=late')).statusCode).toBe(400)
  })

  it('marks an overdue invoice as paid', async () => {
    const response = await app.inject({ method: 'POST', url: '/api/invoices/inv_0901/mark-paid' })
    expect(response.statusCode).toBe(200)
    expect(response.json()).toMatchObject({ id: 'inv_0901', status: 'paid', paidDate: '2026-10-16' })
    expect((await get('/api/invoices/inv_0901')).json().status).toBe('paid')
    expect((await get('/api/invoices?status=overdue')).json().summary.count).toBe(5)
  })

  it('returns the shown status from PATCH and create', async () => {
    const created = await app.inject({
      method: 'POST',
      url: '/api/invoices',
      payload: {
        customerId: 'cus_acme', issueDate: '2026-09-01', dueDate: '2026-09-30',
        lines: [{ description: 'A', quantity: 1, unitPrice: 100 }],
      },
    })
    expect(created.statusCode).toBe(201)
    expect(created.json().status).toBe('draft')

    const patched = await app.inject({
      method: 'PATCH', url: `/api/invoices/${created.json().id}`, payload: { discountPercent: 10 },
    })
    expect(patched.statusCode).toBe(200)
    expect(patched.json().status).toBe('draft')
  })

  it('writes overdue in the CSV status column', async () => {
    const csv = await get('/api/invoices/export.csv?from=2026-05-20&to=2026-05-20')
    expect(csv.body).toBe(
      'number,customer,issue_date,due_date,status,total,currency\r\n' +
      'INV-2026-0005,Acme Logistics GmbH,2026-05-20,2026-06-19,overdue,3949.99,EUR\r\n',
    )
  })
})
