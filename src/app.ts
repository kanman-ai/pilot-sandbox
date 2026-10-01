/** Builds the Fastify app. Tests call this directly, the server entry point listens on a port. */
import { fileURLToPath } from 'node:url'
import fastifyStatic from '@fastify/static'
import Fastify, { type FastifyInstance } from 'fastify'
import { InvoiceStore } from './data/store.js'
import { invoiceRoutes } from './routes/invoices.js'

export interface AppOptions {
  store?: InvoiceStore
  logger?: boolean
}

export async function buildApp(options: AppOptions = {}): Promise<FastifyInstance> {
  const app = Fastify({ logger: options.logger ?? false })
  const store = options.store ?? new InvoiceStore()

  await app.register(fastifyStatic, {
    root: fileURLToPath(new URL('../public', import.meta.url)),
  })
  await app.register(invoiceRoutes(store))

  return app
}
