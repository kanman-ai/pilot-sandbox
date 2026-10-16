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
| GET | `/api/invoices` | Filters: `status` (draft, sent, overdue, paid), `customerId`. `status` matches the shown status, so `sent` lists only sent invoices not yet due and `overdue` only those past due. Newest first. |
| GET | `/api/invoices.csv` | CSV download (`invoices.csv`) of all invoices, in the same order as `GET /api/invoices`. Columns: `id,customer,total,status`. See [CSV export](#csv-export). |
| GET | `/api/invoices/export.csv` | Query: `from`, `to` (YYYY-MM-DD, both required, both days included). CSV download of invoices issued in that range, newest first. Columns: `number,customer,issue_date,due_date,status,total,currency`; `total` is a plain decimal like `720.50`. 400 with an `error` message if a date is missing, malformed or impossible, or `from` is after `to`. |
| GET | `/api/invoices/:id` | 404 if not found. |
| POST | `/api/invoices` | Creates a draft. Body: `customerId`, `issueDate`, `dueDate`, `lines[]`, optional `discountPercent` (0–100, at most two decimals). |
| PATCH | `/api/invoices/:id` | Sets the discount of a draft. Body: `{ discountPercent: number \| null }`; `null` removes the discount. 200 with the updated invoice. 404 if not found, 409 if it is sent or paid (the invoice stays unchanged), 422 with `{ error: "Invalid discount", problems }` for an invalid value. |
| POST | `/api/invoices/:id/mark-paid` | Marks a sent or overdue invoice as paid and sets `paidDate` to today. 404 if not found, 409 if it is a draft or already paid. |
| GET | `/api/customers` | All customers. |
| GET | `/api/customers/:id` | One customer, same shape as an entry of `/api/customers`. 404 with `{ error: "Customer <id> not found" }` if not found. |
| GET | `/health` | `{ status, version, uptimeSeconds }`. Not logged. Used by the container health check. |

Amounts are integer cents. The shared money formatter is `formatMoney` in `src/lib/money.ts`.

Invoice views (list rows, `GET /api/invoices/:id` and the create, PATCH and mark-paid responses) include:

- `subtotal` (sum of the lines), `discountPercent` (number, or `null` without a discount), `discountAmount` and `total` (subtotal minus discount), plus `subtotalFormatted`, `discountAmountFormatted` and `totalFormatted`.
- The discount is subtotal × percent / 100, rounded half-up to the cent.
- Totals in the list rows, the list `summary` and the CSV `total` column are the discounted totals.
- `lateFee`, `lateFeeFormatted`, `totalDue` (`total` + `lateFee`) and `totalDueFormatted`.

## Overdue invoices

A sent invoice whose `dueDate` is before today (the server's local date) has the status `overdue` wherever invoices are returned: list rows, `GET /api/invoices/:id`, the create, PATCH and mark-paid responses, and the `status` column of both CSV exports. The stored status stays `draft`, `sent` or `paid`; `overdue` is worked out each time an invoice is returned, so an invoice due today is still `sent`. Drafts and paid invoices never become overdue. Filter with `GET /api/invoices?status=overdue`. An overdue invoice can be marked as paid like a sent one, and the invoice page shows its **Mark as paid** button.

## Late fee

An overdue invoice (see above) has a one-time late fee of 5% (`LATE_FEE_PERCENT` in `src/domain/invoices.ts`) of its discounted `total`, rounded half-up to the cent: `lateFee`. It is applied once and does not grow with the days overdue. Every other invoice has `lateFee` 0. `totalDue` is `total` + `lateFee`; `total`, the list `summary` and both CSV exports leave the fee out. The invoice page shows **Late fee** and **Total due** only when there is a late fee.

## CSV export

`GET /api/invoices.csv` returns every invoice as a CSV download named `invoices.csv` (`text/csv; charset=utf-8`), newest first like `GET /api/invoices`, with no filters. The header is `id,customer,total,status`; `customer` is the customer name, `total` is the discounted total as a plain decimal like `720.50`. Lines end with CRLF, values with a comma, quote or line break are quoted, and text that starts with `=`, `+`, `-` or `@` is prefixed with `'` so spreadsheets do not run it as a formula.

On the invoice list, the **Download CSV** button downloads this file without asking for dates. The **Export CSV** form next to it still exports a date range via `/api/invoices/export.csv`.

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
