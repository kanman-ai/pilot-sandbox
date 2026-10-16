/** Health check: a cheap endpoint for deployments and the container health check. */
import { readFileSync } from 'node:fs'
import type { FastifyInstance } from 'fastify'

/** Reads the version from package.json, one level above src/ and dist/. */
function readVersion(): string {
  const raw = readFileSync(new URL('../../package.json', import.meta.url), 'utf8')
  return (JSON.parse(raw) as { version: string }).version
}

export function healthRoutes() {
  const version = readVersion()

  return async function register(app: FastifyInstance): Promise<void> {
    // Silent so the frequent health probes do not log a line per request.
    app.get('/health', { logLevel: 'silent' }, async () => ({
      status: 'ok',
      version,
      uptimeSeconds: Math.round(process.uptime() * 1000) / 1000,
    }))
  }
}
