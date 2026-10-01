/** Seed data. The app keeps everything in memory and starts from this on every boot. */
import type { Customer, Invoice } from '../domain/types.js'

export const seedCustomers: Customer[] = [
  { id: 'cus_acme', name: 'Acme Logistics GmbH', email: 'billing@acme-logistics.example' },
  { id: 'cus_birch', name: 'Birch & Sons', email: 'accounts@birchandsons.example' },
  { id: 'cus_nordlicht', name: 'Nordlicht Studio', email: 'hello@nordlicht.example' },
  { id: 'cus_quarry', name: 'Quarry Coffee Roasters', email: 'finance@quarry.example' },
]

export const seedInvoices: Invoice[] = [
  {
    id: 'inv_001', number: 'INV-2026-0001', customerId: 'cus_acme',
    issueDate: '2026-01-15', dueDate: '2026-02-14', currency: 'EUR', status: 'paid',
    lines: [{ description: 'Route planning workshop', quantity: 1, unitPrice: 180000 }],
  },
  {
    id: 'inv_002', number: 'INV-2026-0002', customerId: 'cus_birch',
    issueDate: '2026-02-03', dueDate: '2026-03-05', currency: 'EUR', status: 'paid',
    lines: [
      { description: 'Website maintenance (February)', quantity: 1, unitPrice: 45000 },
      { description: 'Extra support hours', quantity: 3, unitPrice: 9500 },
    ],
  },
  {
    id: 'inv_003', number: 'INV-2026-0003', customerId: 'cus_nordlicht',
    issueDate: '2026-03-12', dueDate: '2026-04-11', currency: 'EUR', status: 'paid',
    lines: [{ description: 'Brand photography, half day', quantity: 1, unitPrice: 72050 }],
  },
  {
    id: 'inv_004', number: 'INV-2026-0004', customerId: 'cus_quarry',
    issueDate: '2026-04-01', dueDate: '2026-05-01', currency: 'EUR', status: 'paid',
    lines: [{ description: 'Point of sale integration', quantity: 1, unitPrice: 245000 }],
  },
  {
    id: 'inv_005', number: 'INV-2026-0005', customerId: 'cus_acme',
    issueDate: '2026-05-20', dueDate: '2026-06-19', currency: 'EUR', status: 'sent',
    lines: [
      { description: 'Fleet dashboard, phase 1', quantity: 1, unitPrice: 390000 },
      { description: 'Hosting (May)', quantity: 1, unitPrice: 4999 },
    ],
  },
  {
    id: 'inv_006', number: 'INV-2026-0006', customerId: 'cus_birch',
    issueDate: '2026-06-30', dueDate: '2026-07-30', currency: 'EUR', status: 'sent',
    lines: [{ description: 'Website maintenance (June)', quantity: 1, unitPrice: 45000 }],
  },
  {
    id: 'inv_007', number: 'INV-2026-0007', customerId: 'cus_nordlicht',
    issueDate: '2026-07-14', dueDate: '2026-08-13', currency: 'EUR', status: 'sent',
    lines: [{ description: 'Product shots', quantity: 24, unitPrice: 3500 }],
  },
  {
    id: 'inv_008', number: 'INV-2026-0008', customerId: 'cus_quarry',
    issueDate: '2026-08-05', dueDate: '2026-09-04', currency: 'EUR', status: 'sent',
    lines: [{ description: 'Loyalty card app, design sprint', quantity: 5, unitPrice: 88000 }],
  },
  {
    id: 'inv_009', number: 'INV-2026-0009', customerId: 'cus_acme',
    issueDate: '2026-09-10', dueDate: '2026-10-10', currency: 'EUR', status: 'sent',
    lines: [{ description: 'Fleet dashboard, phase 2', quantity: 1, unitPrice: 412500 }],
  },
  {
    id: 'inv_010', number: 'INV-2026-0010', customerId: 'cus_birch',
    issueDate: '2026-09-28', dueDate: '2026-10-28', currency: 'EUR', status: 'draft',
    lines: [{ description: 'Website maintenance (September)', quantity: 1, unitPrice: 45000 }],
  },
]
