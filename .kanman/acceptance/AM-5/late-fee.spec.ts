/**
 * AM-5: Overdue invoices get a one-time 5% late fee.
 *
 * Demonstrate: start the app and fetch GET /api/invoices/inv_005 (INV-2026-0005, sent,
 * due 2026-06-19, so overdue). Its total is 394999 cents (€3,949.99, no discount). Its
 * lateFee is 5% of that total, 19749.95 rounded half-up to the cent: 19750 cents
 * (€197.50), and its totalDue is total + lateFee = 414749 cents (€4,147.49). The
 * total itself is unchanged. The fee is applied once and does not grow with the days
 * overdue, so it gives the same answer on any later day. INV-2026-0010 (a draft) and
 * INV-2026-0004 (paid) have lateFee 0 and totalDue equal to their total. Open
 * INV-2026-0005 from the invoice list: its detail page shows Late fee with the
 * lateFeeFormatted of the API and Total due with its totalDueFormatted. Open
 * INV-2026-0010: its page shows no late fee.
 *
 * Runs against the real app. No network mocking.
 *
 * Read-only: it only reads inv_005, inv_010 and inv_004, which no spec changes
 * (AD-1167 marks inv_009 paid, AM-2 marks inv_007 paid, AD-1171 changes only the
 * invoice it creates), so it runs with the other read-only specs.
 */
import { type APIRequestContext, expect, test } from '@playwright/test'

interface InvoiceView {
  id: string
  number: string
  status: string
  total: number
  totalFormatted: string
  lateFee: number
  lateFeeFormatted: string
  totalDue: number
  totalDueFormatted: string
}

async function getInvoice(request: APIRequestContext, id: string): Promise<InvoiceView> {
  const response = await request.get(`/api/invoices/${id}`)
  expect(response.status()).toBe(200)
  return (await response.json()) as InvoiceView
}

/** 5% of an amount in cents, rounded half-up to the cent, in integer math. */
function lateFeeOf(totalCents: number): number {
  return Math.floor((totalCents * 5 + 50) / 100)
}

test('an overdue invoice has a 5% late fee and a total due; others have none', async ({ request }) => {
  const overdue = await getInvoice(request, 'inv_005')
  expect(overdue.number).toBe('INV-2026-0005')
  expect(overdue.status).toBe('overdue')
  // The total stays the discounted total, without the fee: 390000 + 4999 = 394999 cents.
  expect(overdue.total).toBe(394999)
  // 394999 * 5 / 100 = 19749.95 -> 19750 cents (half-up), whatever the day.
  expect(overdue.lateFee).toBe(lateFeeOf(overdue.total))
  expect(overdue.lateFee).toBe(19750)
  expect(overdue.totalDue).toBe(overdue.total + overdue.lateFee)
  expect(overdue.totalDue).toBe(414749)
  expect(typeof overdue.lateFeeFormatted).toBe('string')
  expect(typeof overdue.totalDueFormatted).toBe('string')

  // The list rows are invoice views too and carry the same fee.
  const list = await request.get('/api/invoices')
  expect(list.status()).toBe(200)
  const rows = ((await list.json()) as { invoices: InvoiceView[] }).invoices
  expect(rows.find((invoice) => invoice.id === 'inv_005')).toMatchObject({
    total: 394999,
    lateFee: 19750,
    totalDue: 414749,
  })

  for (const [id, status] of [
    ['inv_010', 'draft'],
    ['inv_004', 'paid'],
  ] as const) {
    const invoice = await getInvoice(request, id)
    expect(invoice.status, id).toBe(status)
    expect(invoice.lateFee, id).toBe(0)
    expect(invoice.totalDue, id).toBe(invoice.total)
    expect(invoice.totalDueFormatted, id).toBe(invoice.totalFormatted)
  }
})

test('the detail page shows the late fee and total due of an overdue invoice only', async ({ page, request }) => {
  const overdue = await getInvoice(request, 'inv_005')
  expect(overdue.status).toBe('overdue')
  expect(overdue.lateFee).toBe(19750)

  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Invoices' })).toBeVisible()
  await page.getByRole('link', { name: 'INV-2026-0005' }).click()
  await expect(page.getByRole('heading', { name: 'Invoice INV-2026-0005' })).toBeVisible()
  await expect(page.locator('#invoice-status')).toHaveText('overdue')
  const main = page.locator('main')
  await expect(main).toContainText('Late fee', { useInnerText: true })
  await expect(page.getByText(overdue.lateFeeFormatted, { exact: true })).toBeVisible()
  await expect(main).toContainText('Total due', { useInnerText: true })
  await expect(page.getByText(overdue.totalDueFormatted, { exact: true })).toBeVisible()

  await page.getByRole('link', { name: 'Back to invoices' }).click()
  await expect(page.getByRole('heading', { name: 'Invoices' })).toBeVisible()
  await page.getByRole('link', { name: 'INV-2026-0010' }).click()
  await expect(page.getByRole('heading', { name: 'Invoice INV-2026-0010' })).toBeVisible()
  await expect(page.locator('#invoice-status')).toHaveText('draft')
  // Rendered text only, so a hidden, empty late fee row does not count.
  await expect(main).not.toContainText('Late fee', { useInnerText: true })
})
