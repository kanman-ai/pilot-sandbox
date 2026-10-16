/**
 * AD-1165: Add a health check endpoint.
 *
 * Demonstrate: Start the app and open http://localhost:3000/health. The response is 200
 * with status set to ok and version set to 0.1.0. Wait two seconds and call it again.
 * uptimeSeconds is higher than before.
 *
 * Runs against the real app. No network mocking.
 */
import { expect, test } from '@playwright/test'

test('health check reports ok, the version and a growing uptime', async ({ request }) => {
  const first = await request.get('/health')
  expect(first.status()).toBe(200)
  const before = await first.json()
  expect(before.status).toBe('ok')
  expect(before.version).toBe('0.1.0')
  expect(typeof before.uptimeSeconds).toBe('number')

  await new Promise((resolve) => setTimeout(resolve, 2000))

  const second = await request.get('/health')
  expect(second.status()).toBe(200)
  const after = await second.json()
  expect(after.status).toBe('ok')
  expect(typeof after.uptimeSeconds).toBe('number')
  expect(after.uptimeSeconds).toBeGreaterThan(before.uptimeSeconds)
})
