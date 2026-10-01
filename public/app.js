// Invoice list page. Plain browser JavaScript, no build step.

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
  sum.textContent = `EUR ${data.summary.total}`
}

function renderRow(invoice) {
  const row = document.createElement('tr')
  row.dataset.testid = 'invoice-row'
  const link = document.createElement('a')
  link.href = `/invoice.html?id=${encodeURIComponent(invoice.id)}`
  link.textContent = invoice.number
  const amount = `${(invoice.total / 100).toFixed(2)} ${invoice.currency}`
  row.append(
    cell(link),
    cell(invoice.customerName),
    cell(invoice.issueDate),
    cell(invoice.dueDate),
    cell(invoice.status),
    cell(amount, 'amount'),
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
