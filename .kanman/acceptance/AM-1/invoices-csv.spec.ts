/**
 * AM-1: Download all invoices as a simple CSV.
 *
 * Demonstrate: Open the invoice list and click Download CSV. A file named
 * invoices.csv downloads. Its first line is id,customer,total,status, followed by
 * one row per invoice (10), newest first, in the same order as GET /api/invoices.
 * The row for inv_003 reads inv_003,Nordlicht Studio,720.50,paid. GET
 * /api/invoices.csv answers 200 with a text/csv content type. The existing Export
 * CSV button for the date-range export is still on the page.
 *
 * Runs against the real app. No network mocking.
 */
import { readFile } from 'node:fs/promises'
import { expect, test } from '@playwright/test'

test('downloads all invoices as invoices.csv from the list page', async ({ page, request }) => {
  const api = await request.get('/api/invoices')
  expect(api.ok()).toBe(true)
  const { invoices } = (await api.json()) as { invoices: { id: string }[] }
  const ids = invoices.map((invoice) => invoice.id)

  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Invoices' })).toBeVisible()

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Download CSV' }).click(),
  ])
  expect(download.suggestedFilename()).toBe('invoices.csv')

  const path = await download.path()
  const csv = await readFile(path, 'utf8')
  const lines = csv.split(/\r?\n/).filter((line) => line.length > 0)
  expect(lines[0]).toBe('id,customer,total,status')
  const rows = lines.slice(1)
  expect(rows).toHaveLength(10)
  expect(rows.map((row) => row.split(',')[0])).toEqual(ids)

  // Nordlicht Studio has no comma or quote, so the CSV field is unquoted.
  const row3 = rows.find((row) => row.startsWith('inv_003,'))
  expect(row3).toBe('inv_003,Nordlicht Studio,720.50,paid')

  const direct = await request.get('/api/invoices.csv')
  expect(direct.status()).toBe(200)
  expect(direct.headers()['content-type']).toContain('text/csv')

  await expect(page.getByRole('button', { name: 'Export CSV' })).toBeVisible()
})
