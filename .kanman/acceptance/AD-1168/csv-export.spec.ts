/**
 * AD-1168: Export invoices as CSV, filtered by date range.
 *
 * Demonstrate: Open the invoice list. Set From to 2026-03-01 and To to 2026-06-30
 * and click Export CSV. A file named invoices-2026-03-01-to-2026-06-30.csv downloads.
 * It has the header row and 4 rows: INV-2026-0006, INV-2026-0005, INV-2026-0004 and
 * INV-2026-0003. The row for INV-2026-0003 ends with 720.50,EUR. Then set From to
 * 2026-07-01 and To to 2026-06-01. The page shows an error and nothing downloads.
 *
 * Runs against the real app. No network mocking.
 */
import { readFile } from 'node:fs/promises'
import { expect, test } from '@playwright/test'

test('exports invoices in a date range as CSV and rejects an inverted range', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Invoices' })).toBeVisible()

  await page.getByLabel('From').fill('2026-03-01')
  await page.getByLabel('To').fill('2026-06-30')
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Export CSV' }).click(),
  ])
  expect(download.suggestedFilename()).toBe('invoices-2026-03-01-to-2026-06-30.csv')

  const path = await download.path()
  const csv = await readFile(path, 'utf8')
  const lines = csv.split(/\r?\n/).filter((line) => line.length > 0)
  expect(lines[0]).toBe('number,customer,issue_date,due_date,status,total,currency')
  const rows = lines.slice(1)
  expect(rows).toHaveLength(4)
  expect(rows.map((row) => row.split(',')[0])).toEqual([
    'INV-2026-0006',
    'INV-2026-0005',
    'INV-2026-0004',
    'INV-2026-0003',
  ])
  const row3 = rows.find((row) => row.startsWith('INV-2026-0003,'))
  expect(row3?.endsWith('720.50,EUR')).toBe(true)

  let downloads = 0
  page.on('download', () => {
    downloads += 1
  })
  await page.getByLabel('From').fill('2026-07-01')
  await page.getByLabel('To').fill('2026-06-01')
  await page.getByRole('button', { name: 'Export CSV' }).click()
  const error = page.locator('#export-error')
  await expect(error).toBeVisible()
  await expect(error).toContainText(/from/i)
  await page.waitForTimeout(1000)
  expect(downloads).toBe(0)
})
