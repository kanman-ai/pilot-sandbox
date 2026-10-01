/** Types shared by the store, the routes and the tests. */

export type InvoiceStatus = 'draft' | 'sent' | 'paid'

export const INVOICE_STATUSES: readonly InvoiceStatus[] = ['draft', 'sent', 'paid']

export interface Customer {
  id: string
  name: string
  email: string
}

export interface InvoiceLine {
  description: string
  quantity: number
  /** Unit price in cents. */
  unitPrice: number
}

export interface Invoice {
  id: string
  number: string
  customerId: string
  /** ISO date, YYYY-MM-DD. */
  issueDate: string
  /** ISO date, YYYY-MM-DD. */
  dueDate: string
  currency: string
  status: InvoiceStatus
  lines: InvoiceLine[]
}

export interface NewInvoice {
  customerId: string
  issueDate: string
  dueDate: string
  currency?: string
  lines: InvoiceLine[]
}

export interface InvoiceFilter {
  status?: InvoiceStatus
  customerId?: string
}
