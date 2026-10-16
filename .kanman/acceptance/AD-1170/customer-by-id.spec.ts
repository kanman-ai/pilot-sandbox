/**
 * AD-1170: Add GET /api/customers/:id.
 *
 * Demonstrate: Start the app and fetch /api/customers. Take the id of one customer and
 * fetch /api/customers/<id>. The response is 200 and equals that entry of the list.
 * Fetch /api/customers/cus_nobody. The response is 404 with a JSON error naming the id.
 *
 * Runs against the real app. No network mocking. Read-only.
 */
import { expect, test } from '@playwright/test'

test('returns one customer equal to its entry in the customer list', async ({ request }) => {
  const list = await request.get('/api/customers')
  expect(list.status()).toBe(200)
  const { customers } = await list.json()
  expect(customers.length).toBeGreaterThan(0)
  const entry = customers[0]

  const response = await request.get(`/api/customers/${entry.id}`)
  expect(response.status()).toBe(200)
  expect(await response.json()).toEqual(entry)
})

test('returns 404 with an error naming the unknown id', async ({ request }) => {
  const response = await request.get('/api/customers/cus_nobody')
  expect(response.status()).toBe(404)
  expect(await response.json()).toEqual({ error: 'Customer cus_nobody not found' })
})
