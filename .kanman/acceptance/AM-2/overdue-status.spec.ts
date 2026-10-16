/**
 * AM-2: Invoices past due show status 'overdue'.
 *
 * Demonstrate: start the app and fetch GET /api/invoices/inv_005, a sent invoice due on
 * 2026-06-19. Its status is overdue, and it is overdue in GET /api/invoices too.
 * INV-2026-0010, a draft, is still draft and INV-2026-0004, a paid invoice, is still paid,
 * although both are due before today. Export the CSV for 2026-05-20: the row of
 * INV-2026-0005 has the status overdue. GET /api/invoices?status=overdue contains
 * inv_005 and only overdue invoices. GET /api/invoices?status=sent contains only sent
 * invoices and none of them is due before today. Then mark inv_007 (sent, due
 * 2026-08-13, so overdue) as paid with POST /api/invoices/inv_007/mark-paid: the
 * response is 200 with status paid, and GET /api/invoices/inv_007 then shows paid.
 *
 * Runs against the real app. No network mocking.
 *
 * Only seeded invoices due long before today are used (inv_005 due 2026-06-19,
 * inv_007 due 2026-08-13), so the spec gives the same answer on any later day.
 * "Today" is the server's local date; the runner's clock may be in another time zone,
 * so the ?status=sent check allows one day of slack at the boundary.
 *
 * The read-only test does not touch inv_009 (AD-1167 marks it paid) or the invoice
 * AD-1171 creates. The mark-paid test changes shared state, so it is tagged
 * @mutates-state and runs after all read-only specs. It uses inv_007, which no other
 * spec reads by id or number; it is older than INV-2026-0009 and INV-2026-0010, so it
 * does not change the first row of the list or of the paid filter that AD-1167 checks.
 */
import { type APIRequestContext, expect, test } from '@playwright/test'

interface InvoiceItem {
  id: string
  number: string
  status: string
  dueDate: string
}

/** Local calendar date of the runner, shifted by a number of days, as YYYY-MM-DD. */
function localIsoDate(offsetDays: number): string {
  const date = new Date()
  date.setDate(date.getDate() + offsetDays)
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

async function listInvoices(request: APIRequestContext, query = ''): Promise<InvoiceItem[]> {
  const response = await request.get(`/api/invoices${query}`)
  expect(response.status()).toBe(200)
  const body = (await response.json()) as { invoices: InvoiceItem[] }
  return body.invoices
}

test('a sent invoice past its due date is overdue in detail, list, CSV and filters', async ({ request }) => {
  const detail = await request.get('/api/invoices/inv_005')
  expect(detail.status()).toBe(200)
  const inv005 = (await detail.json()) as InvoiceItem
  expect(inv005.number).toBe('INV-2026-0005')
  expect(inv005.dueDate).toBe('2026-06-19')
  expect(inv005.status).toBe('overdue')

  const all = await listInvoices(request)
  expect(all.find((invoice) => invoice.id === 'inv_005')?.status).toBe('overdue')
  // A draft and a paid invoice never become overdue.
  expect(all.find((invoice) => invoice.id === 'inv_010')?.status).toBe('draft')
  expect(all.find((invoice) => invoice.id === 'inv_004')?.status).toBe('paid')

  const draft = await request.get('/api/invoices/inv_010')
  expect(draft.status()).toBe(200)
  expect((await draft.json()).status).toBe('draft')
  const paid = await request.get('/api/invoices/inv_004')
  expect(paid.status()).toBe(200)
  expect((await paid.json()).status).toBe('paid')

  const csv = await request.get('/api/invoices/export.csv?from=2026-05-20&to=2026-05-20')
  expect(csv.status()).toBe(200)
  const lines = (await csv.text()).split(/\r?\n/).filter((line) => line.length > 0)
  expect(lines[0]).toBe('number,customer,issue_date,due_date,status,total,currency')
  expect(lines.slice(1)).toEqual(['INV-2026-0005,Acme Logistics GmbH,2026-05-20,2026-06-19,overdue,3949.99,EUR'])

  const overdue = await listInvoices(request, '?status=overdue')
  expect(overdue.map((invoice) => invoice.id)).toContain('inv_005')
  for (const invoice of overdue) {
    expect(invoice.status, invoice.number).toBe('overdue')
  }

  // The server decides "today" in its own time zone. Due dates before yesterday on the runner's clock
  // are before today on the server's clock too, as long as the two clocks are less than a day apart.
  const cutoff = localIsoDate(-1)
  const sent = await listInvoices(request, '?status=sent')
  expect(sent.map((invoice) => invoice.id)).not.toContain('inv_005')
  for (const invoice of sent) {
    expect(invoice.status, invoice.number).toBe('sent')
    expect(invoice.dueDate >= cutoff, `${invoice.number} is due ${invoice.dueDate}`).toBe(true)
  }
})

test('an overdue invoice can be marked as paid', { tag: '@mutates-state' }, async ({ request }) => {
  const before = await request.get('/api/invoices/inv_007')
  expect(before.status()).toBe(200)
  const invoice = (await before.json()) as InvoiceItem
  expect(invoice.number).toBe('INV-2026-0007')
  expect(invoice.status).toBe('overdue')

  const marked = await request.post('/api/invoices/inv_007/mark-paid')
  expect(marked.status()).toBe(200)
  const result = await marked.json()
  expect(result.id).toBe('inv_007')
  expect(result.status).toBe('paid')

  const after = await request.get('/api/invoices/inv_007')
  expect(after.status()).toBe(200)
  expect((await after.json()).status).toBe('paid')
})
