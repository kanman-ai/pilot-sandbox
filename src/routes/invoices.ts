/** Invoice API: list, read, create, set the discount, export as CSV and mark as paid. */
import type { FastifyInstance } from 'fastify'
import type { InvoiceStore } from '../data/store.js'
import { buildInvoicesCsv, exportFileName, invoicesInRange, parseDateRange } from '../domain/csv.js'
import {
  invoiceAmounts,
  invoiceStatusOn,
  markInvoicePaid,
  setInvoiceDiscount,
  validateDiscountPercent,
  validateNewInvoice,
} from '../domain/invoices.js'
import { INVOICE_VIEW_STATUSES, type Invoice, type InvoiceFilter, type NewInvoice } from '../domain/types.js'
import { toIsoDate } from '../lib/dates.js'
import { centsToDecimal, formatMoney } from '../lib/money.js'

/** 404 body for an unknown invoice id, naming the id like the customer 404 does. */
const invoiceNotFound = (id: string) => ({ error: `Invoice ${id} not found` })

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
      // Checked by validateDiscountPercent, so a wrong value gets the same 422 { error, problems } answer.
      discountPercent: {},
      lines: { type: 'array', items: lineSchema },
    },
  },
} as const

const patchSchema = {
  body: {
    type: 'object',
    required: ['discountPercent'],
    additionalProperties: false,
    properties: {
      // A number from 0 to 100 with at most two decimals, or null to remove the discount.
      // Checked by validateDiscountPercent (422) rather than here (400), like POST validation.
      discountPercent: {},
    },
  },
} as const

const listSchema = {
  querystring: {
    type: 'object',
    additionalProperties: false,
    properties: {
      status: { type: 'string', enum: INVOICE_VIEW_STATUSES },
      customerId: { type: 'string' },
    },
  },
} as const

export interface InvoiceRouteOptions {
  /** Clock used for dates like paidDate and for "today" in the overdue status. Tests pass a fixed one. */
  now?: () => Date
}

export function invoiceRoutes(store: InvoiceStore, options: InvoiceRouteOptions = {}) {
  const now = options.now ?? (() => new Date())
  /** Today in the server's local time zone, YYYY-MM-DD. */
  const today = () => toIsoDate(now())

  /**
   * Adds the customer name and the amounts to an invoice for API responses.
   * status is the shown status: a sent invoice due before today is 'overdue' (never stored).
   * discountPercent is always present: a number, or null when the invoice has no discount.
   * total is the amount payable, after the discount.
   */
  function toView(invoice: Invoice, day = today()) {
    const { subtotal, discountPercent, discountAmount, total } = invoiceAmounts(invoice)
    return {
      ...invoice,
      status: invoiceStatusOn(invoice, day),
      customerName: store.getCustomer(invoice.customerId)?.name ?? 'Unknown customer',
      lines: invoice.lines.map((line) => ({
        ...line,
        unitPriceFormatted: formatMoney(line.unitPrice, invoice.currency),
      })),
      subtotal,
      subtotalFormatted: formatMoney(subtotal, invoice.currency),
      discountPercent,
      discountAmount,
      discountAmountFormatted: formatMoney(discountAmount, invoice.currency),
      total,
      totalFormatted: formatMoney(total, invoice.currency),
    }
  }

  return async function register(app: FastifyInstance): Promise<void> {
    app.get<{ Querystring: InvoiceFilter }>('/api/invoices', { schema: listSchema }, async (request) => {
      const day = today()
      const invoices = store.listInvoices(request.query, day).map((invoice) => toView(invoice, day))
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
      const csv = buildInvoicesCsv(invoices, (id) => store.getCustomer(id)?.name ?? 'Unknown customer', today())
      return reply
        .header('content-type', 'text/csv; charset=utf-8')
        .header('content-disposition', `attachment; filename="${exportFileName(parsed.range)}"`)
        .send(csv)
    })

    app.get<{ Params: { id: string } }>('/api/invoices/:id', async (request, reply) => {
      const invoice = store.getInvoice(request.params.id)
      if (!invoice) return reply.code(404).send(invoiceNotFound(request.params.id))
      return toView(invoice)
    })

    app.post<{ Body: NewInvoice }>('/api/invoices', { schema: createSchema }, async (request, reply) => {
      const problems = validateNewInvoice(request.body)
      if (!store.getCustomer(request.body.customerId)) problems.push('customerId does not exist')
      if (problems.length > 0) return reply.code(422).send({ error: 'Invalid invoice', problems })
      const invoice = store.createInvoice(request.body)
      return reply.code(201).send(toView(invoice))
    })

    app.patch<{ Params: { id: string }; Body: { discountPercent: unknown } }>(
      '/api/invoices/:id',
      { schema: patchSchema },
      async (request, reply) => {
        const invoice = store.getInvoice(request.params.id)
        if (!invoice) return reply.code(404).send(invoiceNotFound(request.params.id))
        const { discountPercent } = request.body
        if (discountPercent !== null) {
          const problems = validateDiscountPercent(discountPercent)
          if (problems.length > 0) return reply.code(422).send({ error: 'Invalid discount', problems })
        }
        const result = setInvoiceDiscount(invoice, discountPercent as number | null)
        if (!result.ok) return reply.code(409).send({ error: result.error })
        store.updateInvoice(result.invoice)
        return toView(result.invoice)
      },
    )

    app.post<{ Params: { id: string } }>('/api/invoices/:id/mark-paid', async (request, reply) => {
      const invoice = store.getInvoice(request.params.id)
      if (!invoice) return reply.code(404).send(invoiceNotFound(request.params.id))
      const result = markInvoicePaid(invoice, toIsoDate(now()))
      if (!result.ok) return reply.code(409).send({ error: result.error })
      store.updateInvoice(result.invoice)
      return toView(result.invoice)
    })

    app.get('/api/customers', async () => ({ customers: store.listCustomers() }))

    app.get<{ Params: { id: string } }>('/api/customers/:id', async (request, reply) => {
      const customer = store.getCustomer(request.params.id)
      if (!customer) return reply.code(404).send({ error: `Customer ${request.params.id} not found` })
      return customer
    })
  }
}
