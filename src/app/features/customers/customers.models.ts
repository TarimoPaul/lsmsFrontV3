export type CustomerType = 'REGULAR' | 'VIP' | 'WHOLESALE' | 'CORPORATE';

export const CUSTOMER_TYPES: Record<CustomerType, { en: string; sw: string; color: string; icon: string }> = {
  REGULAR: { en: 'Regular', sw: 'Wa kawaida', color: 'var(--c-text-2)', icon: 'person' },
  VIP: { en: 'VIP', sw: 'VIP', color: '#9c27b0', icon: 'workspace_premium' },
  WHOLESALE: { en: 'Wholesale', sw: 'Jumla', color: 'var(--c-info)', icon: 'inventory' },
  CORPORATE: { en: 'Corporate', sw: 'Kampuni', color: 'var(--c-primary)', icon: 'corporate_fare' },
};

/** Row from GET /api/v1/customers (Spring `CustomerDto`) — includes sales totals and balance. */
export interface Customer {
  uid: string;
  name: string;
  phoneNumber: string | null;
  email: string | null;
  address: string | null;
  customerType: CustomerType;
  creditLimit: number | null;
  salesCount: number;
  totalSpent: number;
  outstandingBalance: number;
  createdAt: string | null;
}

export interface CustomerRequest {
  name: string;
  phoneNumber: string | null;
  email: string | null;
  address: string | null;
  customerType: CustomerType;
  creditLimit: number | null;
}

/** GET /customers/{uid}/statement (`CustomerArStatementDto`). */
export interface CustomerStatement {
  totalInvoiced: number;
  totalPaid: number;
  totalReturned: number;
  outstandingBalance: number;
  overdueAmount: number;
  totalInvoices: number;
  unpaidInvoices: number;
  aging0to30: number;
  aging31to60: number;
  aging61to90: number;
  aging90plus: number;
  oldestUnpaidAgeDays: number;
  entries: StatementEntry[];
}

export interface StatementEntry {
  date: string | null;
  type: 'INVOICE' | 'PAYMENT' | 'RETURN' | string;
  reference: string | null;
  saleUid: string | null;
  debit: number;
  credit: number;
  runningBalance: number;
  paymentMethod: string | null;
  dueDate: string | null;
  overdue: boolean;
  receivedByName: string | null;
}

/** GET /customers/{uid}/sales-analytics (CUSTOMER_ANALYTICS). */
export interface CustomerAnalytics {
  totalSaleCount: number;
  totalRevenue: number;
  totalProfit: number;
  averageOrderValue: number;
  daysSinceLastPurchase: number | null;
  purchaseFrequencyDays: number | null;
  distinctProductCount: number;
  repeatCustomer: boolean;
  atRiskOfChurning: boolean;
  fullPaymentPercentage: number;
  lastPurchaseDate: string | null;
  firstPurchaseDate: string | null;
}

/** One sale in GET /customers/{uid}/purchase-history. */
export interface PurchaseRecord {
  saleUid: string;
  receiptNumber: string;
  purchaseDate: string | null;
  totalAmount: number;
  paymentStatus: string;
  outstandingBalance: number;
  amountPaid: number;
  items: number;
}

/** GET /customers/settlements (`CustomerSettlementDto`). */
export interface Settlement {
  customerUid: string | null;
  customerName: string;
  customerPhone: string | null;
  saleUid: string | null;
  receiptNumber: string | null;
  saleDate: string | null;
  settledDate: string | null;
  totalAmount: number;
  amountCollected: number;
  waivedAmount: number;
  receivedByName: string | null;
  paymentMethod: string | null;
  collectionEvents: number;
  daysToSettle: number | null;
}

export interface AuditEntry {
  action: string;
  details: string | null;
  performedBy: string | null;
  timestamp: string | null;
}

export const PAYMENT_STATUS: Record<string, { en: string; sw: string; color: string }> = {
  PAID: { en: 'Paid', sw: 'Imelipwa', color: 'var(--c-success)' },
  PARTIAL: { en: 'Partial', sw: 'Sehemu', color: 'var(--c-warning)' },
  PARTIALLY_PAID: { en: 'Partial', sw: 'Sehemu', color: 'var(--c-warning)' },
  UNPAID: { en: 'Unpaid', sw: 'Haijalipwa', color: 'var(--c-error)' },
};

export function customerInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? parts[0]?.[1] ?? '')).toUpperCase() || '?';
}

/** Local phone form used for duplicate checks: +255 / 255 → 0. */
export function phoneKey(phone: string | null | undefined): string {
  const p = (phone ?? '').replace(/[\s-]/g, '');
  if (!p) return '';
  if (p.startsWith('+255')) return '0' + p.slice(4);
  if (p.startsWith('255') && p.length === 12) return '0' + p.slice(3);
  return p;
}

const num = (v: unknown) => Number(v ?? 0) || 0;
const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);

export function normalizeCustomer(r: Record<string, unknown>): Customer {
  const type = (r['customerType'] as CustomerType) ?? 'REGULAR';
  return {
    uid: String(r['uid'] ?? ''),
    name: String(r['name'] ?? '').trim(),
    phoneNumber: str(r['phoneNumber']),
    email: str(r['email']),
    address: str(r['address']),
    customerType: type in CUSTOMER_TYPES ? type : 'REGULAR',
    creditLimit: r['creditLimit'] === null || r['creditLimit'] === undefined ? null : num(r['creditLimit']),
    salesCount: num(r['salesCount']),
    totalSpent: num(r['totalSpent']),
    outstandingBalance: num(r['outstandingBalance']),
    createdAt: str(r['createdAt']),
  };
}
