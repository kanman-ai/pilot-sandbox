import { readFileSync } from 'node:fs'
import type { FastifyInstance } from 'fastify'
import { afterEach, describe, expect, it } from 'vitest'
import { buildApp } from '../src/app.js'
import { InvoiceStore } from '../src/data/store.js'

const packageVersion = (JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as { version: string })
  .version

/** A store that fails the test if anything reads or writes invoice data. */
class UntouchableStore extends InvoiceStore {
  override listCustomers(): never {
    throw new Error('health check touched the store')
  }
  override getCustomer(): never {
    throw new Error('health check touched the store')
  }
  override listInvoices(): never {
    throw new Error('health check touched the store')
  }
  override getInvoice(): never {
    throw new Error('health check touched the store')
  }
  override createInvoice(): never {
    throw new Error('health check touched the store')
  }
}

let app: FastifyInstance

afterEach(async () => {
  await app.close()
})

describe('health check', () => {
  it('returns ok, the package version and the uptime without touching invoice data', async () => {
    app = await buildApp({ store: new UntouchableStore() })
    const response = await app.inject({ method: 'GET', url: '/health' })
    expect(response.statusCode).toBe(200)
    const body = response.json()
    expect(body).toEqual({ status: 'ok', version: packageVersion, uptimeSeconds: expect.any(Number) })
    expect(body.uptimeSeconds).toBeGreaterThan(0)
  })

  it('reports a growing uptime', async () => {
    app = await buildApp()
    const first = (await app.inject({ method: 'GET', url: '/health' })).json()
    await new Promise((resolve) => setTimeout(resolve, 50))
    const second = (await app.inject({ method: 'GET', url: '/health' })).json()
    expect(second.uptimeSeconds).toBeGreaterThan(first.uptimeSeconds)
  })

  it('does not log health requests', async () => {
    app = await buildApp({ logger: true })
    const levels: string[] = []
    app.addHook('onRequest', async (request) => {
      levels.push(request.log.level)
    })
    await app.inject({ method: 'GET', url: '/health' })
    expect(levels).toEqual(['silent'])
  })
})
