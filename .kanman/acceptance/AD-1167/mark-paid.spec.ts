/**
 * AD-1167: Mark an invoice as paid.
 *
 * Demonstrate: open INV-2026-0009 from the invoice list. Its status is overdue (it is
 * sent and was due 2026-10-10; AM-2 shows such invoices as overdue) and a
 * Mark as paid button is shown. Click it. The status changes to paid and the button
 * disappears. Reload the page: it is still paid. Go back to the list and filter by
 * status Paid. INV-2026-0009 is in the list. Open INV-2026-0010, a draft. There is
 * no Mark as paid button.
 *
 * Runs against the real app. No network mocking.
 *
 * This spec changes shared state (INV-2026-0009 goes from overdue to paid) in the one
 * running app. It is tagged @mutates-state so playwright.config.ts runs it only after
 * all other specs have finished.
 */
import { expect, test } from '@playwright/test'

test('marks a sent invoice as paid', { tag: '@mutates-state' }, async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Invoices' })).toBeVisible()

  await page.getByRole('link', { name: 'INV-2026-0009' }).click()
  await expect(page.getByRole('heading', { name: 'Invoice INV-2026-0009' })).toBeVisible()
  await expect(page.locator('#invoice-status')).toHaveText('overdue')
  const markPaid = page.getByRole('button', { name: 'Mark as paid' })
  await expect(markPaid).toBeVisible()

  await markPaid.click()
  await expect(page.locator('#invoice-status')).toHaveText('paid')
  await expect(markPaid).toHaveCount(0)

  await page.reload()
  await expect(page.getByRole('heading', { name: 'Invoice INV-2026-0009' })).toBeVisible()
  await expect(page.locator('#invoice-status')).toHaveText('paid')
  await expect(markPaid).toHaveCount(0)

  await page.getByRole('link', { name: 'Back to invoices' }).click()
  await expect(page.getByRole('heading', { name: 'Invoices' })).toBeVisible()
  const rows = page.getByRole('table', { name: 'Invoices' }).locator('tbody tr')
  await expect(rows.first()).toContainText('INV-2026-0010')
  await page.getByLabel('Status').selectOption('paid')
  await expect(rows.first()).toContainText('INV-2026-0009')
  for (const status of await rows.locator('td:nth-child(5)').allTextContents()) {
    expect(status).toBe('paid')
  }

  await page.getByLabel('Status').selectOption('')
  await page.getByRole('link', { name: 'INV-2026-0010' }).click()
  await expect(page.getByRole('heading', { name: 'Invoice INV-2026-0010' })).toBeVisible()
  await expect(page.locator('#invoice-status')).toHaveText('draft')
  await expect(page.getByRole('button', { name: 'Mark as paid' })).toHaveCount(0)
})
