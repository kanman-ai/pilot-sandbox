/**
 * SBX-1: List invoices.
 *
 * Demonstrate: open the invoice list, see all seeded invoices newest first,
 * filter by status "Paid" and see only paid invoices. Open one and see its total.
 *
 * Runs against the real app. No network mocking.
 */
import { expect, test } from '@playwright/test'

test('lists invoices, filters by status and opens one', async ({ page, request }) => {
  const api = await request.get('/api/invoices')
  expect(api.ok()).toBe(true)
  const { invoices } = await api.json()

  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Invoices' })).toBeVisible()

  const rows = page.getByRole('table', { name: 'Invoices' }).locator('tbody tr')
  await expect(rows).toHaveCount(invoices.length)
  await expect(rows.first()).toContainText('INV-2026-0010')

  await page.getByLabel('Status').selectOption('paid')
  await expect(rows).toHaveCount(4)
  for (const status of await rows.locator('td:nth-child(5)').allTextContents()) {
    expect(status).toBe('paid')
  }

  await page.getByRole('link', { name: 'INV-2026-0004' }).click()
  await expect(page.getByRole('heading', { name: 'Invoice INV-2026-0004' })).toBeVisible()
  await expect(page.locator('#invoice-customer')).toHaveText('Quarry Coffee Roasters')
  await expect(page.locator('#invoice-total')).toHaveText('€2,450.00')
})
