// Invoice list page. Plain browser JavaScript, no build step.
// Amounts come preformatted from the API (shared formatter, formatMoney in src/lib/money.ts).

const rows = document.getElementById('invoice-rows')
const count = document.getElementById('invoice-count')
const sum = document.getElementById('invoice-sum')
const statusFilter = document.getElementById('status-filter')
const error = document.getElementById('error')
const exportForm = document.getElementById('export-form')
const exportFrom = document.getElementById('export-from')
const exportTo = document.getElementById('export-to')
const exportError = document.getElementById('export-error')
const downloadCsvButton = document.getElementById('download-csv')

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

// Downloads the CSV for the chosen date range. On an error the message is shown and nothing downloads.
async function exportCsv(event) {
  event.preventDefault()
  exportError.hidden = true
  const params = new URLSearchParams({ from: exportFrom.value, to: exportTo.value })
  const response = await fetch(`/api/invoices/export.csv?${params}`)
  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    exportError.textContent = body.error ?? 'Could not export invoices.'
    exportError.hidden = false
    return
  }
  const disposition = response.headers.get('content-disposition') ?? ''
  const match = /filename="([^"]+)"/.exec(disposition)
  const url = URL.createObjectURL(await response.blob())
  const link = document.createElement('a')
  link.href = url
  link.download = match ? match[1] : `invoices-${exportFrom.value}-to-${exportTo.value}.csv`
  document.body.append(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 0)
}

// Downloads all invoices as invoices.csv, no dates needed. On an error the message is shown and nothing downloads.
async function downloadCsv() {
  exportError.hidden = true
  const response = await fetch('/api/invoices.csv')
  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    exportError.textContent = body.error ?? 'Could not download invoices.'
    exportError.hidden = false
    return
  }
  const url = URL.createObjectURL(await response.blob())
  const link = document.createElement('a')
  link.href = url
  link.download = 'invoices.csv'
  document.body.append(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 0)
}

statusFilter.addEventListener('change', load)
exportForm.addEventListener('submit', exportCsv)
downloadCsvButton.addEventListener('click', downloadCsv)
load()
