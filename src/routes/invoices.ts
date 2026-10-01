/** Invoice API: list, read and create. */
import type { FastifyInstance } from 'fastify'
import type { InvoiceStore } from '../data/store.js'
import { invoiceTotal, validateNewInvoice } from '../domain/invoices.js'
import { INVOICE_STATUSES, type Invoice, type InvoiceFilter, type NewInvoice } from '../domain/types.js'
import { formatMoney } from '../lib/money.js'

const lineSchema = {
  type: 'object',
  required: ['description', 'quantity', 'unitPrice'],
  additionalProperties: false,
  properties: {
    description: { type: 'string', minLength: 1, maxLength: 200 },
    quantity: { type: 'integer', minimum: 1 },
    unitPrice: { type: 'integer', minimum: 0 },
  },
} as const

const createSchema = {
  body: {
    type: 'object',
    required: ['customerId', 'issueDate', 'dueDate', 'lines'],
    additionalProperties: false,
    properties: {
      customerId: { type: 'string', minLength: 1 },
      issueDate: { type: 'string' },
      dueDate: { type: 'string' },
      currency: { type: 'string', pattern: '^[A-Z]{3}$' },
      lines: { type: 'array', items: lineSchema },
    },
  },
} as const

const listSchema = {
  querystring: {
    type: 'object',
    additionalProperties: false,
    properties: {
      status: { type: 'string', enum: INVOICE_STATUSES },
      customerId: { type: 'string' },
    },
  },
} as const

export function invoiceRoutes(store: InvoiceStore) {
  /** Adds the customer name and the total to an invoice for API responses. */
  function toView(invoice: Invoice) {
    const total = invoiceTotal(invoice.lines)
    return {
      ...invoice,
      customerName: store.getCustomer(invoice.customerId)?.name ?? 'Unknown customer',
      total,
      totalFormatted: formatMoney(total, invoice.currency),
    }
  }

  return async function register(app: FastifyInstance): Promise<void> {
    app.get<{ Querystring: InvoiceFilter }>('/api/invoices', { schema: listSchema }, async (request) => {
      const invoices = store.listInvoices(request.query).map(toView)
      const sum = invoices.reduce((acc, invoice) => acc + invoice.total, 0)
      return {
        invoices,
        summary: { count: invoices.length, total: (sum / 100).toFixed(2) },
      }
    })

    app.get<{ Params: { id: string } }>('/api/invoices/:id', async (request, reply) => {
      const invoice = store.getInvoice(request.params.id)
      if (!invoice) return reply.code(404).send({ error: 'Invoice not found' })
      return toView(invoice)
    })

    app.post<{ Body: NewInvoice }>('/api/invoices', { schema: createSchema }, async (request, reply) => {
      const problems = validateNewInvoice(request.body)
      if (!store.getCustomer(request.body.customerId)) problems.push('customerId does not exist')
      if (problems.length > 0) return reply.code(422).send({ error: 'Invalid invoice', problems })
      const invoice = store.createInvoice(request.body)
      return reply.code(201).send(toView(invoice))
    })

    app.get('/api/customers', async () => ({ customers: store.listCustomers() }))
  }
}
