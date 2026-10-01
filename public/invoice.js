// Invoice detail page. The total comes preformatted from the API (shared formatter).

const id = new URLSearchParams(location.search).get('id')
const response = await fetch(`/api/invoices/${encodeURIComponent(id ?? '')}`)

if (response.ok) {
  const invoice = await response.json()
  document.title = `Invoice ${invoice.number}`
  setText('invoice-number', `Invoice ${invoice.number}`)
  setText('invoice-customer', invoice.customerName)
  setText('invoice-issued', invoice.issueDate)
  setText('invoice-due', invoice.dueDate)
  setText('invoice-status', invoice.status)
  setText('invoice-total', invoice.totalFormatted)
  document.getElementById('line-rows').replaceChildren(
    ...invoice.lines.map((line) => {
      const row = document.createElement('tr')
      for (const [value, className] of [
        [line.description],
        [String(line.quantity), 'amount'],
        [`${(line.unitPrice / 100).toFixed(2)}`, 'amount'],
      ]) {
        const td = document.createElement('td')
        if (className) td.className = className
        td.textContent = value
        row.append(td)
      }
      return row
    }),
  )
} else {
  const error = document.getElementById('error')
  error.textContent = 'Invoice not found.'
  error.hidden = false
}

function setText(elementId, text) {
  document.getElementById(elementId).textContent = text
}
