// Invoice list page. Plain browser JavaScript, no build step.
// Amounts come preformatted from the API (shared formatter, formatMoney in src/lib/money.ts).

const rows = document.getElementById('invoice-rows')
const count = document.getElementById('invoice-count')
const sum = document.getElementById('invoice-sum')
const statusFilter = document.getElementById('status-filter')
const error = document.getElementById('error')

async function load() {
  const params = new URLSearchParams()
  if (statusFilter.value) params.set('status', statusFilter.value)
  const response = await fetch(`/api/invoices?${params}`)
  if (!response.ok) {
    error.textContent = 'Could not load invoices.'
    error.hidden = false
    return
  }
  error.hidden = true
  const data = await response.json()
  rows.replaceChildren(...data.invoices.map(renderRow))
  count.textContent = `${data.summary.count} invoices`
  sum.textContent = data.summary.totalFormatted
}

function renderRow(invoice) {
  const row = document.createElement('tr')
  row.dataset.testid = 'invoice-row'
  const link = document.createElement('a')
  link.href = `/invoice.html?id=${encodeURIComponent(invoice.id)}`
  link.textContent = invoice.number
  row.append(
    cell(link),
    cell(invoice.customerName),
    cell(invoice.issueDate),
    cell(invoice.dueDate),
    cell(invoice.status),
    cell(invoice.totalFormatted, 'amount'),
  )
  return row
}

function cell(content, className) {
  const td = document.createElement('td')
  if (className) td.className = className
  td.append(content)
  return td
}

statusFilter.addEventListener('change', load)
load()
