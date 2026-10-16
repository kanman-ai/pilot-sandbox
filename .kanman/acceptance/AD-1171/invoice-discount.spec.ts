/**
 * AD-1171: Percentage discount on the whole invoice.
 *
 * Demonstrate: create a draft invoice for a seeded customer with a subtotal of
 * €1,234.48 via POST /api/invoices. Apply a 10% discount with
 * PATCH /api/invoices/:id { discountPercent: 10 }. Open its detail page: it shows
 * Subtotal €1,234.48, Discount (10%) -€123.45 (123.448 rounded half-up) and
 * Total €1,111.03. Export the CSV for that issue date: the row of the invoice ends
 * with 1111.03,EUR.
 *
 * Runs against the real app. No network mocking.
 *
 * This spec adds an invoice to the one shared in-memory app, so it is tagged
 * @mutates-state and runs after all read-only specs (project chromium-mutating).
 * It may run in parallel with the AD-1167 spec, which marks INV-2026-0009 paid and
 * then expects INV-2026-0010 to be the first (newest) row of the list. The new invoice
 * is therefore issued on 2020-01-15, older than every seeded invoice, so it sorts last
 * and never becomes the first row. It is a draft, so it never shows under "paid".
 * This spec only reads its own invoice and asserts no list counts or footers.
 */
import { expect, test } from '@playwright/test'

const ISSUE_DATE = '2020-01-15'

test('applies a 10% discount to a draft invoice and shows it on the detail page and in the CSV', { tag: '@mutates-state' }, async ({ page, request }) => {
  const created = await request.post('/api/invoices', {
    data: {
      customerId: 'cus_quarry',
      issueDate: ISSUE_DATE,
      dueDate: '2020-02-14',
      lines: [
        { description: 'Roastery consulting', quantity: 1, unitPrice: 100000 },
        { description: 'Cupping session', quantity: 3, unitPrice: 7816 },
      ],
    },
  })
  expect(created.status()).toBe(201)
  const invoice = await created.json()
  expect(invoice.status).toBe('draft')
  // Subtotal: 100000 + 3 * 7816 = 123448 cents (€1,234.48).
  expect(invoice.total).toBe(123448)

  const patched = await request.patch(`/api/invoices/${invoice.id}`, { data: { discountPercent: 10 } })
  expect(patched.status()).toBe(200)
  // 10% of 123448 = 12344.8 -> 12345 (half-up to the cent), total 111103.
  expect(await patched.json()).toMatchObject({
    subtotal: 123448,
    discountPercent: 10,
    discountAmount: 12345,
    total: 111103,
  })

  await page.goto(`/invoice.html?id=${encodeURIComponent(invoice.id)}`)
  await expect(page.getByRole('heading', { name: `Invoice ${invoice.number}` })).toBeVisible()
  await expect(page.locator('#invoice-subtotal-label')).toHaveText('Subtotal')
  await expect(page.locator('#invoice-subtotal')).toHaveText('€1,234.48')
  await expect(page.locator('#invoice-discount-label')).toHaveText('Discount (10%)')
  await expect(page.locator('#invoice-discount')).toHaveText('-€123.45')
  await expect(page.locator('#invoice-total')).toHaveText('€1,111.03')

  const csv = await request.get(`/api/invoices/export.csv?from=${ISSUE_DATE}&to=${ISSUE_DATE}`)
  expect(csv.status()).toBe(200)
  const lines = (await csv.text()).split(/\r?\n/).filter((line) => line.length > 0)
  expect(lines[0]).toBe('number,customer,issue_date,due_date,status,total,currency')
  const row = lines.find((line) => line.startsWith(`${invoice.number},`))
  expect(row).toBeDefined()
  expect(row?.endsWith(',1111.03,EUR')).toBe(true)
})
