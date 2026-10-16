// Invoice detail page. Amounts (total, subtotal, discount, unit prices) come preformatted from the API
// (shared formatter). The total is the amount payable, after any discount; an overdue invoice adds a
// one-time late fee, giving the total due.

const id = new URLSearchParams(location.search).get('id')
const url = `/api/invoices/${encodeURIComponent(id ?? '')}`
const markPaid = document.getElementById('mark-paid')
const response = await fetch(url)

if (response.ok) {
  render(await response.json())
  markPaid.addEventListener('click', async () => {
    markPaid.disabled = true
    const result = await fetch(`${url}/mark-paid`, { method: 'POST' })
    markPaid.disabled = false
    if (result.ok) {
      render(await result.json())
    } else {
      const body = await result.json().catch(() => ({}))
      showError(body.error ?? 'Could not mark the invoice as paid.')
    }
  })
} else {
  showError('Invoice not found.')
}

function render(invoice) {
  document.title = `Invoice ${invoice.number}`
  setText('invoice-number', `Invoice ${invoice.number}`)
  setText('invoice-customer', invoice.customerName)
  setText('invoice-issued', invoice.issueDate)
  setText('invoice-due', invoice.dueDate)
  setText('invoice-status', invoice.status)
  setText('invoice-paid', invoice.paidDate ?? '')
  document.getElementById('invoice-paid-label').hidden = !invoice.paidDate
  document.getElementById('invoice-paid').hidden = !invoice.paidDate
  renderDiscount(invoice)
  setText('invoice-total', invoice.totalFormatted)
  renderLateFee(invoice)
  // Overdue invoices are sent invoices past their due date, so they can be marked as paid too.
  markPaid.hidden = invoice.status !== 'sent' && invoice.status !== 'overdue'
  document.getElementById('line-rows').replaceChildren(
    ...invoice.lines.map((line) => {
      const row = document.createElement('tr')
      for (const [value, className] of [
        [line.description],
        [String(line.quantity), 'amount'],
        [line.unitPriceFormatted, 'amount'],
      ]) {
        const td = document.createElement('td')
        if (className) td.className = className
        td.textContent = value
        row.append(td)
      }
      return row
    }),
  )
}

// Shows the Subtotal and Discount lines only when the invoice has a discount.
function renderDiscount(invoice) {
  const hasDiscount = invoice.discountPercent !== null && invoice.discountPercent !== undefined
  setText('invoice-subtotal', hasDiscount ? invoice.subtotalFormatted : '')
  setText('invoice-discount-label', hasDiscount ? `Discount (${invoice.discountPercent}%)` : 'Discount')
  setText('invoice-discount', hasDiscount ? `-${invoice.discountAmountFormatted}` : '')
  for (const elementId of ['invoice-subtotal-label', 'invoice-subtotal', 'invoice-discount-label', 'invoice-discount']) {
    document.getElementById(elementId).hidden = !hasDiscount
  }
}

// Shows the Late fee and Total due lines only when the invoice has a late fee (it is overdue).
function renderLateFee(invoice) {
  const hasLateFee = invoice.lateFee > 0
  setText('invoice-late-fee', hasLateFee ? invoice.lateFeeFormatted : '')
  setText('invoice-total-due', hasLateFee ? invoice.totalDueFormatted : '')
  for (const elementId of ['invoice-late-fee-label', 'invoice-late-fee', 'invoice-total-due-label', 'invoice-total-due']) {
    document.getElementById(elementId).hidden = !hasLateFee
  }
}

function showError(message) {
  const error = document.getElementById('error')
  error.textContent = message
  error.hidden = false
}

function setText(elementId, text) {
  document.getElementById(elementId).textContent = text
}
