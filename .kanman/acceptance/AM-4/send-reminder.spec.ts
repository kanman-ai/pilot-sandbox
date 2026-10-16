/**
 * AM-4: Send a payment reminder for an overdue invoice.
 *
 * Demonstrate: open INV-2026-0006 from the invoice list. It is sent and was due
 * 2026-07-30, so its status is overdue, a Send reminder button is shown and no
 * "Reminder sent" text is shown; GET /api/invoices/inv_006 has no lastReminderSentAt
 * (null or absent). Click Send reminder: POST /api/invoices/inv_006/send-reminder
 * answers 200 and the page shows "Reminder sent" with the date, in one visible element
 * (for example "Reminder sent 2026-10-16" or "Reminder sent on 16 Oct 2026").
 * GET /api/invoices/inv_006 now has lastReminderSentAt, an ISO timestamp from the last
 * few minutes. Reload the page: "Reminder sent" with the date is still shown. Open
 * INV-2026-0010, a draft: there is no Send reminder button.
 * POST /api/invoices/inv_010/send-reminder answers 409 and inv_010 still has no
 * lastReminderSentAt. POST /api/invoices/inv_nope/send-reminder answers 404.
 *
 * Runs against the real app. No network mocking.
 *
 * The date format on the page is not fixed; the spec only requires the year of the
 * reminder to appear in the "Reminder sent" text.
 *
 * The reminder test changes shared state (inv_006 gets lastReminderSentAt), so it is
 * tagged @mutates-state and runs after all read-only specs. No other spec reads inv_006
 * by id or opens its page; AD-1168 only reads the number INV-2026-0006 from a CSV
 * export, which a reminder does not change. Its status stays overdue, so the list and
 * paid filter that AD-1167 checks are unaffected. The read-only test only reads inv_010
 * (a draft, which AD-1167 and AM-2 also only read) and a non-existent id.
 */
import { expect, test } from '@playwright/test'

interface InvoiceView {
  id: string
  number: string
  status: string
  lastReminderSentAt?: string | null
}

const ISO_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/

test('sends a reminder for an overdue invoice and shows it on the detail page', { tag: '@mutates-state' }, async ({ page, request }) => {
  const before = await request.get('/api/invoices/inv_006')
  expect(before.status()).toBe(200)
  const initial = (await before.json()) as InvoiceView
  expect(initial.number).toBe('INV-2026-0006')
  expect(initial.status).toBe('overdue')
  expect(initial.lastReminderSentAt ?? null).toBeNull()

  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Invoices' })).toBeVisible()
  await page.getByRole('link', { name: 'INV-2026-0006' }).click()
  await expect(page.getByRole('heading', { name: 'Invoice INV-2026-0006' })).toBeVisible()
  await expect(page.locator('#invoice-status')).toHaveText('overdue')

  const sendReminder = page.getByRole('button', { name: 'Send reminder' })
  const reminderText = page.getByText(/Reminder sent/).filter({ visible: true })
  await expect(sendReminder).toBeVisible()
  await expect(reminderText).toHaveCount(0)

  const startedAt = Date.now()
  const [response] = await Promise.all([
    page.waitForResponse(
      (res) => res.url().endsWith('/api/invoices/inv_006/send-reminder') && res.request().method() === 'POST',
    ),
    sendReminder.click(),
  ])
  expect(response.status()).toBe(200)
  await expect(reminderText).toBeVisible()

  const after = await request.get('/api/invoices/inv_006')
  expect(after.status()).toBe(200)
  const reminded = (await after.json()) as InvoiceView
  const sentAt = reminded.lastReminderSentAt
  expect(typeof sentAt).toBe('string')
  expect(sentAt ?? '').toMatch(ISO_TIMESTAMP)
  const sentAtMs = Date.parse(sentAt ?? '')
  // The server and the runner may disagree a little about the time; allow ten minutes either way.
  expect(Math.abs(sentAtMs - startedAt), `lastReminderSentAt ${sentAt}`).toBeLessThan(10 * 60 * 1000)

  const year = String(new Date(sentAtMs).getFullYear())
  await expect(reminderText).toContainText(year)

  await page.reload()
  await expect(page.getByRole('heading', { name: 'Invoice INV-2026-0006' })).toBeVisible()
  await expect(reminderText).toBeVisible()
  await expect(reminderText).toContainText(year)
})

test('only overdue invoices can get a reminder', async ({ page, request }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Invoices' })).toBeVisible()
  await page.getByRole('link', { name: 'INV-2026-0010' }).click()
  await expect(page.getByRole('heading', { name: 'Invoice INV-2026-0010' })).toBeVisible()
  await expect(page.locator('#invoice-status')).toHaveText('draft')
  await expect(page.getByRole('button', { name: 'Send reminder' })).toHaveCount(0)

  const draft = await request.post('/api/invoices/inv_010/send-reminder')
  expect(draft.status()).toBe(409)
  const unchanged = await request.get('/api/invoices/inv_010')
  expect(unchanged.status()).toBe(200)
  const invoice = (await unchanged.json()) as InvoiceView
  expect(invoice.status).toBe('draft')
  expect(invoice.lastReminderSentAt ?? null).toBeNull()

  const missing = await request.post('/api/invoices/inv_nope/send-reminder')
  expect(missing.status()).toBe(404)
})
