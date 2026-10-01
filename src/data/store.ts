/**
 * In-memory store for customers and invoices.
 * Each app instance gets its own store, so tests never share state.
 */
import { filterInvoices, nextInvoiceNumber } from '../domain/invoices.js'
import type { Customer, Invoice, InvoiceFilter, NewInvoice } from '../domain/types.js'
import { seedCustomers, seedInvoices } from './seed.js'

export class InvoiceStore {
  private readonly customers: Map<string, Customer>
  private readonly invoices: Invoice[]

  constructor(customers: Customer[] = seedCustomers, invoices: Invoice[] = seedInvoices) {
    this.customers = new Map(customers.map((customer) => [customer.id, { ...customer }]))
    this.invoices = structuredClone(invoices)
  }

  listCustomers(): Customer[] {
    return [...this.customers.values()]
  }

  getCustomer(id: string): Customer | undefined {
    return this.customers.get(id)
  }

  listInvoices(filter: InvoiceFilter = {}): Invoice[] {
    return filterInvoices(this.invoices, filter)
  }

  getInvoice(id: string): Invoice | undefined {
    return this.invoices.find((invoice) => invoice.id === id)
  }

  createInvoice(input: NewInvoice): Invoice {
    const year = Number(input.issueDate.slice(0, 4))
    const invoice: Invoice = {
      id: `inv_${String(this.invoices.length + 1).padStart(3, '0')}`,
      number: nextInvoiceNumber(this.invoices, year),
      customerId: input.customerId,
      issueDate: input.issueDate,
      dueDate: input.dueDate,
      currency: input.currency ?? 'EUR',
      status: 'draft',
      lines: input.lines.map((line) => ({ ...line })),
    }
    this.invoices.push(invoice)
    return invoice
  }
}
