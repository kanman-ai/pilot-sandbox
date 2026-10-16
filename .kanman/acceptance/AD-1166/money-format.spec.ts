/**
 * AD-1166: Use the shared money formatter everywhere.
 *
 * Demonstrate: Open the invoice list. The row for INV-2026-0009 shows €4,125.00
 * and the footer shows €19,920.49. Filter by status Paid. The footer shows €5,705.50.
 * (This step filtered by Sent, footer €13,764.99. Since AM-2 every seeded sent invoice is
 * past due and shows as overdue, so the Sent filter is empty; Paid is a fixed set of 4.)
 * Open INV-2026-0008. The unit price of its line shows €880.00 and the total shows €4,400.00.
 *
 * Runs against the real app. No network mocking.
 */
import { expect, test } from '@playwright/test'

test('list and detail show money with the shared formatter', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Invoices' })).toBeVisible()

  const table = page.getByRole('table', { name: 'Invoices' })
  const row = table.locator('tbody tr').filter({ hasText: 'INV-2026-0009' })
  await expect(row.locator('td.amount')).toHaveText('€4,125.00')
  await expect(page.locator('#invoice-sum')).toHaveText('€19,920.49')

  await page.getByLabel('Status').selectOption('paid')
  await expect(table.locator('tbody tr')).toHaveCount(4)
  await expect(page.locator('#invoice-sum')).toHaveText('€5,705.50')

  await page.getByRole('link', { name: 'INV-2026-0008' }).click()
  await expect(page.getByRole('heading', { name: 'Invoice INV-2026-0008' })).toBeVisible()
  const lines = page.getByRole('table', { name: 'Invoice lines' }).locator('tbody tr')
  await expect(lines).toHaveCount(1)
  await expect(lines.first().locator('td:nth-child(3)')).toHaveText('€880.00')
  await expect(page.locator('#invoice-total')).toHaveText('€4,400.00')
})
