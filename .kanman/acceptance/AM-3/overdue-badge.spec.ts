/**
 * AM-3: Overdue invoices show a red 'Overdue' badge in the invoice list.
 *
 * Demonstrate: start the app and open the invoice list. Every invoice that
 * GET /api/invoices reports as overdue, among them INV-2026-0005 (sent, due 2026-06-19),
 * shows a visible 'Overdue' badge in its row, with a red background (#b91c1c,
 * rgb(185, 28, 28)) and white text. Draft, sent and paid rows show no such badge.
 * Choose 'Overdue' in the Status filter: the table then lists exactly as many rows as
 * GET /api/invoices?status=overdue returns, and every one of them shows the badge.
 *
 * Runs against the real app. No network mocking.
 *
 * Read-only. Which invoices are overdue depends on today's date and on the
 * @mutates-state specs (AD-1167, AM-2, AD-1171), which run after this one, so the spec
 * takes the overdue set from the API instead of hardcoding a count. Badges are looked
 * up inside the table only, so the filter's <option>Overdue</option> never matches.
 */
import { type APIRequestContext, expect, test } from '@playwright/test'

interface InvoiceItem {
  id: string
  number: string
  status: string
  dueDate: string
}

async function listInvoices(request: APIRequestContext, query = ''): Promise<InvoiceItem[]> {
  const response = await request.get(`/api/invoices${query}`)
  expect(response.status()).toBe(200)
  const body = (await response.json()) as { invoices: InvoiceItem[] }
  return body.invoices
}

test('overdue rows show a red Overdue badge and the Overdue filter shows only them', async ({ page, request }) => {
  const all = await listInvoices(request)
  const inv005 = all.find((invoice) => invoice.number === 'INV-2026-0005')
  expect(inv005?.dueDate).toBe('2026-06-19')
  expect(inv005?.status).toBe('overdue')
  const overdueNumbers = all.filter((invoice) => invoice.status === 'overdue').map((invoice) => invoice.number)
  expect(overdueNumbers.length).toBeGreaterThan(0)

  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Invoices' })).toBeVisible()
  const table = page.getByRole('table', { name: 'Invoices' })
  const rows = table.locator('tbody tr')
  await expect(rows).toHaveCount(all.length)

  for (const invoice of all) {
    const row = rows.filter({ has: page.getByRole('link', { name: invoice.number, exact: true }) })
    await expect(row, invoice.number).toHaveCount(1)
    const badge = row.getByText('Overdue', { exact: true })
    if (invoice.status === 'overdue') {
      await expect(badge, `${invoice.number} shows the Overdue badge`).toBeVisible()
      await expect(badge, invoice.number).toHaveCSS('background-color', 'rgb(185, 28, 28)')
      await expect(badge, invoice.number).toHaveCSS('color', 'rgb(255, 255, 255)')
    } else {
      await expect(badge, `${invoice.number} (${invoice.status}) has no Overdue badge`).toHaveCount(0)
    }
  }

  const overdue = await listInvoices(request, '?status=overdue')
  expect(overdue.map((invoice) => invoice.number)).toContain('INV-2026-0005')
  await page.getByLabel('Status').selectOption({ label: 'Overdue' })
  await expect(rows).toHaveCount(overdue.length)
  for (const invoice of overdue) {
    const row = rows.filter({ has: page.getByRole('link', { name: invoice.number, exact: true }) })
    await expect(row, invoice.number).toHaveCount(1)
  }
  for (const row of await rows.all()) {
    await expect(row.getByText('Overdue', { exact: true })).toBeVisible()
  }
})
