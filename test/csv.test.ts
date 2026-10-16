import { describe, expect, it } from 'vitest'
import { seedCustomers, seedInvoices } from '../src/data/seed.js'
import { buildInvoicesCsv, buildSimpleInvoicesCsv, csvEscape, exportFileName, invoicesInRange, neutraliseFormula, parseDateRange } from '../src/domain/csv.js'
import type { Invoice } from '../src/domain/types.js'

const customerName = (id: string) => seedCustomers.find((customer) => customer.id === id)?.name ?? 'Unknown customer'

describe('csvEscape', () => {
  it('leaves plain values alone', () => {
    expect(csvEscape('Birch & Sons')).toBe('Birch & Sons')
  })

  it('quotes values with commas, quotes or line breaks and doubles inner quotes', () => {
    expect(csvEscape('Acme, Inc.')).toBe('"Acme, Inc."')
    expect(csvEscape('The "Best" Co')).toBe('"The ""Best"" Co"')
    expect(csvEscape('two\nlines')).toBe('"two\nlines"')
  })
})

describe('neutraliseFormula', () => {
  it.each(['=', '+', '-', '@', '\t', '\r'])('prefixes text starting with %j with a single quote', (trigger) => {
    expect(neutraliseFormula(`${trigger}SUM(A1:A9)`)).toBe(`'${trigger}SUM(A1:A9)`)
  })

  it('leaves other text alone, including triggers that are not at the start', () => {
    expect(neutraliseFormula('Birch & Sons')).toBe('Birch & Sons')
    expect(neutraliseFormula('Smith-Jones = Co')).toBe('Smith-Jones = Co')
    expect(neutraliseFormula('')).toBe('')
  })
})

describe('invoicesInRange', () => {
  it('includes both boundary days and sorts newest first', () => {
    const numbers = invoicesInRange(seedInvoices, { from: '2026-03-12', to: '2026-06-30' }).map((i) => i.number)
    expect(numbers).toEqual(['INV-2026-0006', 'INV-2026-0005', 'INV-2026-0004', 'INV-2026-0003'])
  })

  it('returns nothing for a range without invoices', () => {
    expect(invoicesInRange(seedInvoices, { from: '2025-01-01', to: '2025-12-31' })).toEqual([])
  })
})

describe('parseDateRange', () => {
  it('accepts a valid range, including a single day', () => {
    expect(parseDateRange('2026-03-01', '2026-06-30')).toEqual({ range: { from: '2026-03-01', to: '2026-06-30' } })
    expect(parseDateRange('2026-03-01', '2026-03-01')).toEqual({ range: { from: '2026-03-01', to: '2026-03-01' } })
  })

  it('says what is wrong', () => {
    expect(parseDateRange('2026-07-01', '2026-06-01')).toEqual({ error: 'from (2026-07-01) must not be after to (2026-06-01)' })
    expect(parseDateRange(undefined, '2026-06-01')).toEqual({ error: 'from is required (YYYY-MM-DD)' })
    expect(parseDateRange('2026-01-01', '')).toEqual({ error: 'to is required (YYYY-MM-DD)' })
    expect(parseDateRange('2026-3-1', '2026-06-01')).toEqual({ error: 'from must be a real date in YYYY-MM-DD form, got "2026-3-1"' })
    expect(parseDateRange('2026-01-01', '2026-02-30')).toEqual({ error: 'to must be a real date in YYYY-MM-DD form, got "2026-02-30"' })
  })
})

describe('buildInvoicesCsv', () => {
  it('writes the header and one escaped row per invoice with plain totals', () => {
    const invoice: Invoice = {
      id: 'inv_x', number: 'INV-2026-0099', customerId: 'cus_x', issueDate: '2026-05-01', dueDate: '2026-05-31',
      currency: 'EUR', status: 'sent', lines: [{ description: 'x', quantity: 1, unitPrice: 5 }],
    }
    const csv = buildInvoicesCsv([invoice], () => 'Smith, "Jones" & Co')
    expect(csv).toBe(
      'number,customer,issue_date,due_date,status,total,currency\r\n' +
      'INV-2026-0099,"Smith, ""Jones"" & Co",2026-05-01,2026-05-31,sent,0.05,EUR\r\n',
    )
  })

  it('neutralises formulas in text columns before quoting, but keeps a negative total a plain number', () => {
    const invoice: Invoice = {
      id: 'inv_y', number: 'INV-2026-0098', customerId: 'cus_y', issueDate: '2026-05-02', dueDate: '2026-06-01',
      currency: 'EUR', status: 'draft', lines: [{ description: 'refund', quantity: -1, unitPrice: 1250 }],
    }
    expect(buildInvoicesCsv([invoice], () => '=HYPERLINK("http://x.test","a,b")')).toBe(
      'number,customer,issue_date,due_date,status,total,currency\r\n' +
      `INV-2026-0098,"'=HYPERLINK(""http://x.test"",""a,b"")",2026-05-02,2026-06-01,draft,-12.50,EUR\r\n`,
    )
    expect(buildInvoicesCsv([invoice], () => '@cmd,"x"')).toContain(`INV-2026-0098,"'@cmd,""x""",2026-05-02,`)
    expect(buildInvoicesCsv([invoice], () => '-2+3')).toContain(`INV-2026-0098,'-2+3,2026-05-02,`)
    expect(buildInvoicesCsv([invoice], () => '\rline')).toContain(`INV-2026-0098,"'\rline",2026-05-02,`)
  })

  it('exports the seeded range in order', () => {
    const csv = buildInvoicesCsv(invoicesInRange(seedInvoices, { from: '2026-03-01', to: '2026-06-30' }), customerName)
    const lines = csv.trimEnd().split('\r\n')
    expect(lines).toHaveLength(5)
    expect(lines[4]).toBe('INV-2026-0003,Nordlicht Studio,2026-03-12,2026-04-11,paid,720.50,EUR')
    expect(lines[2]).toBe('INV-2026-0005,Acme Logistics GmbH,2026-05-20,2026-06-19,sent,3949.99,EUR')
  })

  it('names the file after the range', () => {
    expect(exportFileName({ from: '2026-03-01', to: '2026-06-30' })).toBe('invoices-2026-03-01-to-2026-06-30.csv')
  })
})

describe('buildSimpleInvoicesCsv', () => {
  const invoice: Invoice = {
    id: 'inv_x', number: 'INV-2026-0099', customerId: 'cus_x', issueDate: '2026-05-01', dueDate: '2026-05-31',
    currency: 'EUR', status: 'sent', lines: [{ description: 'x', quantity: 2, unitPrice: 1000 }], discountPercent: 10,
  }

  it('writes the header and one escaped row per invoice with the discounted total', () => {
    expect(buildSimpleInvoicesCsv([invoice], () => 'Smith, "Jones" & Co')).toBe(
      'id,customer,total,status\r\n' +
      'inv_x,"Smith, ""Jones"" & Co",18.00,sent\r\n',
    )
  })

  it('neutralises formulas in the text columns before quoting', () => {
    expect(buildSimpleInvoicesCsv([invoice], () => '=HYPERLINK("http://x.test","a,b")')).toBe(
      'id,customer,total,status\r\n' +
      `inv_x,"'=HYPERLINK(""http://x.test"",""a,b"")",18.00,sent\r\n`,
    )
    expect(buildSimpleInvoicesCsv([{ ...invoice, id: '@id' }], () => 'Acme')).toContain(`\r\n'@id,Acme,18.00,sent\r\n`)
  })

  it('exports every seeded invoice in the given order', () => {
    const csv = buildSimpleInvoicesCsv(seedInvoices, customerName)
    const lines = csv.trimEnd().split('\r\n')
    expect(lines[0]).toBe('id,customer,total,status')
    expect(lines.slice(1).map((line) => line.split(',')[0])).toEqual(seedInvoices.map((i) => i.id))
    expect(lines).toContain('inv_003,Nordlicht Studio,720.50,paid')
  })
})
