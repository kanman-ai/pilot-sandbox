# pilot-sandbox

A small invoicing service that [kanman](https://kanman.ai) works on in demos, in nightly live test runs and in documentation screenshots.

kanman is an AI teammate. It takes stories from your tracker, writes an acceptance spec for each one, has the code written, and proves the change against that spec before it asks for review. This repo is a safe place to watch that happen. It is public and has no secrets.

## What is in here

- `src/` Fastify API in TypeScript. Data lives in memory and is seeded on every start (4 customers, 10 invoices).
- `public/` A plain HTML page that lists invoices, plus an invoice detail page.
- `test/` Unit tests with Vitest.
- `.kanman/acceptance.json` How kanman starts the app and runs acceptance specs.
- `.kanman/verify.json` How kanman verifies a change locally. No CI secrets are needed.
- `.kanman/acceptance/<KEY>/` Acceptance specs, one folder per story. See [the README there](.kanman/acceptance/README.md).
- `docker-compose.acceptance.yml` The fresh environment the specs run against.

## API

| Method | Path | Notes |
|---|---|---|
| GET | `/api/invoices` | Filters: `status` (draft, sent, paid), `customerId`. Newest first. |
| GET | `/api/invoices/:id` | 404 if not found. |
| POST | `/api/invoices` | Creates a draft. Body: `customerId`, `issueDate`, `dueDate`, `lines[]`. |
| GET | `/api/customers` | All customers. |

Amounts are integer cents. The shared money formatter is `formatMoney` in `src/lib/money.ts`.

## Run it

Needs Node 22 or newer.

```
npm ci
npm run dev        # http://localhost:3000
npm test           # unit tests
npm run lint
npm run typecheck
```

Acceptance specs run against the app in Docker:

```
docker compose -f docker-compose.acceptance.yml up -d --build --wait
npx playwright install chromium
npx playwright test
docker compose -f docker-compose.acceptance.yml down -v
```

Without Docker, `npm run build && npm start` in one terminal and `npx playwright test` in another works too.

## Open stories

These are left open on purpose, so kanman has real work to do. Each one is also a GitHub issue with acceptance criteria and a Demonstrate block.

1. **Export invoices as CSV, filtered by date range.** Customers need to export their invoices for their accountant.
2. **Use the shared money formatter everywhere.** The invoice list shows `4125.00 EUR` while the detail page shows `€4,125.00`.
3. **Add a health check endpoint.** Deployments and the Docker health check need a cheap endpoint that says the service is up.
4. **Mark an invoice as paid.** There is no way to record a payment yet.

## License

MIT
