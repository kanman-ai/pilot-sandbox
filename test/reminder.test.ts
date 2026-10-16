import type { FastifyInstance } from 'fastify'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { buildApp } from '../src/app.js'
import { InvoiceStore } from '../src/data/store.js'
import { seedCustomers, seedInvoices } from '../src/data/seed.js'
import { sendInvoiceReminder } from '../src/domain/invoices.js'
import type { Invoice } from '../src/domain/types.js'

const NOW = new Date(2026, 9, 16, 12, 0)
const SENT_AT = NOW.toISOString()

/** Sent and due today, so not overdue yet. */
const dueToday: Invoice = {
  id: 'inv_0902', number: 'INV-2026-0902', customerId: 'cus_acme',
  issueDate: '2026-09-01', dueDate: '2026-10-16', currency: 'EUR', status: 'sent',
  lines: [{ description: 'A', quantity: 1, unitPrice: 100 }],
}

describe('sendInvoiceReminder', () => {
  it('sets lastReminderSentAt on an overdue invoice without changing the original', () => {
    const overdue = { ...dueToday, dueDate: '2026-10-15' }
    expect(sendInvoiceReminder(overdue, '2026-10-16', SENT_AT)).toEqual({
      ok: true,
      invoice: { ...overdue, lastReminderSentAt: SENT_AT },
    })
    expect(overdue).not.toHaveProperty('lastReminderSentAt')
  })

  it('refuses an invoice that is not overdue', () => {
    expect(sendInvoiceReminder(dueToday, '2026-10-16', SENT_AT)).toEqual({
      ok: false,
      error: 'Invoice INV-2026-0902 is sent; only overdue invoices can get a reminder',
    })
  })
})

describe('POST /api/invoices/:id/send-reminder (clock fixed at 2026-10-16 12:00)', () => {
  let app: FastifyInstance

  beforeEach(async () => {
    const store = new InvoiceStore(seedCustomers, [...seedInvoices, dueToday])
    app = await buildApp({ store, now: () => NOW })
  })

  afterEach(async () => {
    await app.close()
  })

  const get = async (id: string) => app.inject({ method: 'GET', url: `/api/invoices/${id}` })
  const remind = async (id: string) => app.inject({ method: 'POST', url: `/api/invoices/${id}/send-reminder` })

  it('includes lastReminderSentAt as null in every view before a reminder', async () => {
    expect((await get('inv_006')).json()).toHaveProperty('lastReminderSentAt', null)
    const list = (await app.inject({ method: 'GET', url: '/api/invoices' })).json().invoices as Invoice[]
    for (const invoice of list) expect(invoice).toHaveProperty('lastReminderSentAt', null)
  })

  it('sends a reminder for an overdue invoice and keeps it', async () => {
    const response = await remind('inv_006')
    expect(response.statusCode).toBe(200)
    expect(response.json()).toMatchObject({
      id: 'inv_006', number: 'INV-2026-0006', status: 'overdue', lastReminderSentAt: SENT_AT, total: 45000,
    })

    expect((await get('inv_006')).json()).toMatchObject({ status: 'overdue', lastReminderSentAt: SENT_AT })
    const list = (await app.inject({ method: 'GET', url: '/api/invoices' })).json().invoices as Invoice[]
    expect(list.find((invoice) => invoice.id === 'inv_006')).toMatchObject({ lastReminderSentAt: SENT_AT })
  })

  it('returns 404 for an unknown invoice', async () => {
    const response = await remind('inv_999')
    expect(response.statusCode).toBe(404)
    expect(response.json()).toEqual({ error: 'Invoice inv_999 not found' })
  })

  it.each([
    ['draft', 'inv_010', 'INV-2026-0010'],
    ['paid', 'inv_004', 'INV-2026-0004'],
    ['sent', 'inv_0902', 'INV-2026-0902'],
  ])('refuses a %s invoice with 409 and leaves it unchanged', async (status, id, number) => {
    const before = await get(id)
    const response = await remind(id)
    expect(response.statusCode).toBe(409)
    expect(response.json()).toEqual({ error: `Invoice ${number} is ${status}; only overdue invoices can get a reminder` })
    const after = await get(id)
    expect(after.json()).toEqual(before.json())
    expect(after.json()).toMatchObject({ status, lastReminderSentAt: null })
  })
})
