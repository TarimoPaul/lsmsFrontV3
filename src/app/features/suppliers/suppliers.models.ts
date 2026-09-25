/** Spring `SupplierDto`. `outstanding` is computed by the server (received purchases − payments, ≥ 0). */
export interface Supplier {
  uid: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  tin: string | null;
  paymentTermsDays: number;
  creditLimit: number | null;
  notes: string | null;
  outstanding: number;
}

export type SupplierRequest = Omit<Supplier, 'uid' | 'outstanding'>;

/** Spring `SupplierApStatementDto`. */
export interface SupplierStatement {
  supplierUid: string;
  supplierName: string;
  totalPurchased: number;
  totalPaid: number;
  outstanding: number;
  overdueAmount: number;
  agingCurrent: number;
  aging1To30: number;
  aging31To60: number;
  aging61To90: number;
  aging90Plus: number;
  ledger: LedgerEntry[];
}

export interface LedgerEntry {
  date: string | null;
  type: 'PURCHASE' | 'PAYMENT' | string;
  reference: string | null;
  description: string | null;
  dueDate: string | null;
  debit: number;
  credit: number;
  runningBalance: number;
}

export type PaymentMethod = 'CASH' | 'MOBILE_MONEY' | 'BANK_TRANSFER';

export const PAYMENT_METHODS: Record<PaymentMethod, { en: string; sw: string; icon: string }> = {
  CASH: { en: 'Cash', sw: 'Pesa taslimu', icon: 'payments' },
  MOBILE_MONEY: { en: 'Mobile money', sw: 'Pesa ya simu', icon: 'smartphone' },
  BANK_TRANSFER: { en: 'Bank transfer', sw: 'Benki', icon: 'account_balance' },
};

/** Spring `SupplierPaymentDto`. */
export interface SupplierPayment {
  uid: string;
  supplierUid: string;
  purchaseUid: string | null;
  amount: number;
  paymentMethod: string | null;
  paymentProvider: string | null;
  paymentDate: string | null;
  paidByName: string | null;
  reference: string | null;
  notes: string | null;
}

export interface SupplierPaymentRequest {
  supplierUid: string;
  amount: number;
  paymentMethod: PaymentMethod;
  paymentProvider: string | null;
  paymentDate: string;
  reference: string | null;
  notes: string | null;
}

export const AGING_BUCKETS: Array<{ key: keyof SupplierStatement; en: string; sw: string; color: string }> = [
  { key: 'agingCurrent', en: 'Not due', sw: 'Bado', color: 'var(--c-success)' },
  { key: 'aging1To30', en: '1–30 days', sw: 'Siku 1–30', color: 'var(--c-info)' },
  { key: 'aging31To60', en: '31–60 days', sw: 'Siku 31–60', color: 'var(--c-warning)' },
  { key: 'aging61To90', en: '61–90 days', sw: 'Siku 61–90', color: '#e65100' },
  { key: 'aging90Plus', en: '90+ days', sw: 'Siku 90+', color: 'var(--c-error)' },
];

export function supplierInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? parts[0]?.[1] ?? '')).toUpperCase() || '?';
}

/** Share of the credit limit already used (null when no limit). */
export function creditUsage(s: Supplier): number | null {
  return s.creditLimit && s.creditLimit > 0 ? s.outstanding / s.creditLimit : null;
}

const num = (v: unknown) => Number(v ?? 0) || 0;

export function normalizeSupplier(r: Partial<Supplier>): Supplier {
  return {
    uid: r.uid ?? '',
    name: (r.name ?? '').trim(),
    phone: r.phone?.trim() || null,
    email: r.email?.trim() || null,
    address: r.address?.trim() || null,
    tin: r.tin?.trim() || null,
    paymentTermsDays: num(r.paymentTermsDays) || 30,
    creditLimit: r.creditLimit === null || r.creditLimit === undefined ? null : num(r.creditLimit),
    notes: r.notes?.trim() || null,
    outstanding: num(r.outstanding),
  };
}

export function normalizeStatement(r: Partial<SupplierStatement>): SupplierStatement {
  return {
    supplierUid: r.supplierUid ?? '',
    supplierName: r.supplierName ?? '',
    totalPurchased: num(r.totalPurchased),
    totalPaid: num(r.totalPaid),
    outstanding: num(r.outstanding),
    overdueAmount: num(r.overdueAmount),
    agingCurrent: num(r.agingCurrent),
    aging1To30: num(r.aging1To30),
    aging31To60: num(r.aging31To60),
    aging61To90: num(r.aging61To90),
    aging90Plus: num(r.aging90Plus),
    ledger: (r.ledger ?? []).map((e) => ({
      date: e.date ?? null,
      type: e.type ?? '',
      reference: e.reference ?? null,
      description: e.description ?? null,
      dueDate: e.dueDate ?? null,
      debit: num(e.debit),
      credit: num(e.credit),
      runningBalance: num(e.runningBalance),
    })),
  };
}
