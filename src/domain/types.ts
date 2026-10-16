/** Types shared by the store, the routes and the tests. */

export type InvoiceStatus = 'draft' | 'sent' | 'paid'

export const INVOICE_STATUSES: readonly InvoiceStatus[] = ['draft', 'sent', 'paid']

/**
 * Status as the API shows it: the stored status, except that a sent invoice due before today is
 * 'overdue'. Overdue is never stored; it is derived when an invoice is returned (invoiceStatusOn).
 */
export type InvoiceViewStatus = InvoiceStatus | 'overdue'

export const INVOICE_VIEW_STATUSES: readonly InvoiceViewStatus[] = [...INVOICE_STATUSES, 'overdue']

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
  /** ISO date, YYYY-MM-DD. Set when the invoice is marked as paid. */
  paidDate?: string
  /** Optional discount on the whole invoice, 0 to 100 with at most two decimals. Absent means none. */
  discountPercent?: number
  /** ISO timestamp of the last payment reminder. Absent means none was sent. */
  lastReminderSentAt?: string
  lines: InvoiceLine[]
}

export interface NewInvoice {
  customerId: string
  issueDate: string
  dueDate: string
  currency?: string
  discountPercent?: number
  lines: InvoiceLine[]
}

export interface InvoiceFilter {
  /** Matches the shown status (InvoiceViewStatus), so 'sent' excludes overdue invoices. */
  status?: InvoiceViewStatus
  customerId?: string
}
