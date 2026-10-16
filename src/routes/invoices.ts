/** Invoice API: list, read, create, export as CSV and mark as paid. */
import type { FastifyInstance } from 'fastify'
import type { InvoiceStore } from '../data/store.js'
import { buildInvoicesCsv, exportFileName, invoicesInRange, parseDateRange } from '../domain/csv.js'
import { invoiceTotal, markInvoicePaid, validateNewInvoice } from '../domain/invoices.js'
import { INVOICE_STATUSES, type Invoice, type InvoiceFilter, type NewInvoice } from '../domain/types.js'
import { toIsoDate } from '../lib/dates.js'
import { centsToDecimal, formatMoney } from '../lib/money.js'

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

export interface InvoiceRouteOptions {
  /** Clock used for dates like paidDate. Tests pass a fixed one. */
  now?: () => Date
}

export function invoiceRoutes(store: InvoiceStore, options: InvoiceRouteOptions = {}) {
  const now = options.now ?? (() => new Date())

  /** Adds the customer name and the total to an invoice for API responses. */
  function toView(invoice: Invoice) {
    const total = invoiceTotal(invoice.lines)
    return {
      ...invoice,
      customerName: store.getCustomer(invoice.customerId)?.name ?? 'Unknown customer',
      lines: invoice.lines.map((line) => ({
        ...line,
        unitPriceFormatted: formatMoney(line.unitPrice, invoice.currency),
      })),
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
        summary: {
          count: invoices.length,
          // Kept as the decimal string it always was, for existing API clients.
          total: centsToDecimal(sum),
          totalCents: sum,
          totalFormatted: formatMoney(sum),
        },
      }
    })

    // Static path, so Fastify matches it before the parametric /api/invoices/:id route.
    app.get<{ Querystring: { from?: string; to?: string } }>('/api/invoices/export.csv', async (request, reply) => {
      const parsed = parseDateRange(request.query.from, request.query.to)
      if ('error' in parsed) return reply.code(400).send({ error: parsed.error })
      const invoices = invoicesInRange(store.listInvoices(), parsed.range)
      const csv = buildInvoicesCsv(invoices, (id) => store.getCustomer(id)?.name ?? 'Unknown customer')
      return reply
        .header('content-type', 'text/csv; charset=utf-8')
        .header('content-disposition', `attachment; filename="${exportFileName(parsed.range)}"`)
        .send(csv)
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

    app.post<{ Params: { id: string } }>('/api/invoices/:id/mark-paid', async (request, reply) => {
      const invoice = store.getInvoice(request.params.id)
      if (!invoice) return reply.code(404).send({ error: 'Invoice not found' })
      const result = markInvoicePaid(invoice, toIsoDate(now()))
      if (!result.ok) return reply.code(409).send({ error: result.error })
      store.updateInvoice(result.invoice)
      return toView(result.invoice)
    })

    app.get('/api/customers', async () => ({ customers: store.listCustomers() }))
  }
}
