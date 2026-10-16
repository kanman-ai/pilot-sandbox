// Invoice detail page. Amounts (total, subtotal, discount, unit prices) come preformatted from the API
// (shared formatter). The total is the amount payable, after any discount. Overdue invoices get a
// Send reminder button; the last reminder is shown from lastReminderSentAt, so it stays after a reload.

const id = new URLSearchParams(location.search).get('id')
const url = `/api/invoices/${encodeURIComponent(id ?? '')}`
const markPaid = document.getElementById('mark-paid')
const sendReminder = document.getElementById('send-reminder')
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
  sendReminder.addEventListener('click', async () => {
    sendReminder.disabled = true
    const result = await fetch(`${url}/send-reminder`, { method: 'POST' })
    sendReminder.disabled = false
    if (result.ok) {
      render(await result.json())
    } else {
      const body = await result.json().catch(() => ({}))
      showError(body.error ?? 'Could not send the reminder.')
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
  // Overdue invoices are sent invoices past their due date, so they can be marked as paid too.
  markPaid.hidden = invoice.status !== 'sent' && invoice.status !== 'overdue'
  sendReminder.hidden = invoice.status !== 'overdue'
  renderReminder(invoice)
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

// Shows "Reminder sent <date>" when a reminder was sent, for example "Reminder sent 16 Oct 2026".
function renderReminder(invoice) {
  const sentAt = invoice.lastReminderSentAt
  const date = sentAt ? new Date(sentAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : ''
  setText('reminder-sent', sentAt ? `Reminder sent ${date}` : '')
  document.getElementById('reminder-sent').hidden = !sentAt
}

function showError(message) {
  const error = document.getElementById('error')
  error.textContent = message
  error.hidden = false
}

function setText(elementId, text) {
  document.getElementById(elementId).textContent = text
}
