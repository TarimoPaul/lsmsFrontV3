// Types for the reconciliation side screens — debts register, collection
// history, snapshot, audit log, variance report and the Safe Box workflow.

type Raw = Record<string, unknown>;
const num = (v: unknown) => Number(v ?? 0) || 0;
const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);
const list = (v: unknown) => (Array.isArray(v) ? (v as Raw[]) : []);

/** Price tier a walk-in debt line was sold at (matches the POS sale types). */
export type DebtPriceType = 'PIECES' | 'QUARTER_PACKAGE' | 'HALF_PACKAGE' | 'WHOLE_PACKAGE';

export interface DebtProductLine {
  productUid: string | null;
  productName: string | null;
  quantity: number;
  unitPrice: number;
  priceType: DebtPriceType;
  subTotal: number;
}

const PRICE_TYPE_LABELS: Record<string, [string, string]> = { PIECES: ['Piece', 'Kipande'], QUARTER_PACKAGE: ['Quarter', 'Robo'], HALF_PACKAGE: ['Half', 'Nusu'], WHOLE_PACKAGE: ['Whole', 'Jumla'] };

export function priceTypeLabel(t: string, sw: boolean): string {
  const x = PRICE_TYPE_LABELS[t];
  return x ? x[sw ? 1 : 0] : t;
}

const toLine = (p: Raw): DebtProductLine => ({
  productUid: str(p['productUid']),
  productName: str(p['productName'] ?? p['productDisplayName']),
  quantity: num(p['quantity']),
  unitPrice: num(p['unitPrice']),
  priceType: (str(p['priceType']) as DebtPriceType) ?? 'PIECES',
  subTotal: num(p['subTotal']),
});

/** GET /reconciliation/debts — one unpaid / part-paid credit sale. */
export interface DebtItem {
  saleUid: string;
  receipt: string | null;
  saleDate: string | null;
  customerName: string | null;
  customerPhone: string | null;
  /** RECONCILIATION_MANUAL = walk-in debt recorded in reconciliation (editable). */
  source: string | null;
  total: number;
  paid: number;
  balance: number;
  status: string;
  lastPayment: string | null;
  ageDays: number;
  overdue: boolean;
  notes: string | null;
  productNotes: string | null;
  products: DebtProductLine[];
}

export interface DebtSummary {
  outstanding: number;
  paidToday: number;
  overdue: number;
  count: number;
  overdueCount: number;
  debts: DebtItem[];
  page: number;
  pages: number;
  total: number;
}

export function normalizeDebtSummary(d: Raw): DebtSummary {
  return {
    outstanding: num(d['totalOutstandingBalance']),
    paidToday: num(d['totalPaidToday']),
    overdue: num(d['totalOverdueBalance']),
    count: num(d['totalDebtCount']),
    overdueCount: num(d['overdueCount']),
    page: num(d['currentPage']),
    pages: num(d['totalPages']),
    total: num(d['totalItems']),
    debts: list(d['debts']).map((x) => ({
      saleUid: String(x['saleUid'] ?? ''),
      receipt: str(x['receiptNumber']),
      saleDate: str(x['saleDate']),
      customerName: str(x['customerName']),
      customerPhone: str(x['customerPhone']),
      source: str(x['saleSource']),
      total: num(x['totalAmount']),
      paid: num(x['amountPaid']),
      balance: num(x['remainingBalance']),
      status: String(x['paymentStatus'] ?? 'UNPAID'),
      lastPayment: str(x['lastPaymentDate']),
      ageDays: num(x['debtAgeInDays']),
      overdue: x['overdue'] === true,
      notes: str(x['notes']),
      productNotes: str(x['productNotes']),
      products: list(x['products']).map(toLine),
    })),
  };
}

/** POST /{uid}/retail-debt and PUT /manual-debt/{saleUid} body. */
export interface RetailDebtRequest {
  customerUid?: string | null;
  debtorName: string;
  debtorPhone?: string | null;
  amount: number;
  notes?: string | null;
  saleDate?: string | null;
  dueDate?: string | null;
  isPaid?: boolean;
  products: Array<{ productUid: string | null; quantity: number; unitPrice: number; priceType: DebtPriceType; subTotal: number }>;
}

/** GET /debt-collections (30-day history) and /debt-collections/cross-collected. */
export interface CollectionHistoryItem {
  uid: string;
  reconUid: string | null;
  reconDate: string | null;
  reconApproved: boolean;
  reconUserUid: string | null;
  saleUid: string | null;
  customerName: string | null;
  customerPhone: string | null;
  amount: number;
  method: string | null;
  receipt: string | null;
  saleDate: string | null;
  collectedAt: string | null;
  receivedBy: string | null;
  saleTotal: number | null;
  remainingAfter: number | null;
  verified: boolean;
  verifiedByName: string | null;
}

export function normalizeCollection(x: Raw): CollectionHistoryItem {
  const n = (v: unknown) => (v === null || v === undefined ? null : num(v));
  return {
    uid: String(x['uid'] ?? ''),
    reconUid: str(x['reconciliationUid']),
    reconDate: str(x['reconciliationDate']),
    reconApproved: x['reconciliationApproved'] === true,
    reconUserUid: str(x['reconciliationUserUid']),
    saleUid: str(x['saleUid']),
    customerName: str(x['customerName']),
    customerPhone: str(x['customerPhone']),
    amount: num(x['amountCollected']),
    method: str(x['paymentMethod']),
    receipt: str(x['receiptNumber']),
    saleDate: str(x['saleDate']),
    collectedAt: str(x['collectedAt']),
    receivedBy: str(x['receivedByName']),
    saleTotal: n(x['saleTotal']),
    remainingAfter: n(x['saleRemainingAfter']),
    verified: x['verified'] === true,
    verifiedByName: str(x['verifiedByName']),
  };
}

/** GET /{uid}/snapshot — the frozen figures at approval time. */
export interface ReconSnapshot {
  approvedByName: string | null;
  approvedAt: string | null;
  totalSales: number;
  cashSales: number;
  mobileSales: number;
  creditSales: number;
  returnDeductions: number;
  cashOnHand: number;
  bankDeposits: number;
  safeBox: number;
  pettyCash: number;
  mobileMoney: number;
  debtCollections: number;
  expenses: number;
  purchases: number;
  retailDebts: number;
  expectedCash: number;
  accountedCash: number;
  variance: number;
  varianceExplanation: string | null;
  shortageReason: string | null;
}

export function normalizeSnapshot(d: Raw): ReconSnapshot {
  return {
    approvedByName: str(d['approvedByName']),
    approvedAt: str(d['approvedAt']),
    totalSales: num(d['autoTotalSales']),
    cashSales: num(d['autoCashSales']),
    mobileSales: num(d['autoMobileSales']),
    creditSales: num(d['autoCreditSales']),
    returnDeductions: num(d['autoReturnDeductions']),
    cashOnHand: num(d['cashOnHandDeclared']),
    bankDeposits: num(d['bankDepositsTotal']),
    safeBox: num(d['safeBoxTotal']),
    pettyCash: num(d['pettyCashTotal']),
    mobileMoney: num(d['mobileMoneytotal'] ?? d['mobileMoneyTotal']),
    debtCollections: num(d['debtCollectionsTotal']),
    expenses: num(d['expensesTotal']),
    purchases: num(d['purchasesTotal']),
    retailDebts: num(d['retailDebtsTotal']),
    expectedCash: num(d['expectedCash']),
    accountedCash: num(d['accountedCash']),
    variance: num(d['varianceAmount']),
    varianceExplanation: str(d['varianceExplanation']),
    shortageReason: str(d['shortageReason']),
  };
}

export interface AuditEntry {
  uid: string;
  action: string;
  actorName: string | null;
  details: string | null;
  at: string | null;
}

export function normalizeAudit(x: Raw): AuditEntry {
  return { uid: String(x['uid'] ?? ''), action: String(x['action'] ?? ''), actorName: str(x['actorName']), details: str(x['details']), at: str(x['createdAt']) };
}

/** GET /variance-report — per salesperson-day shortages / surpluses (managers). */
export interface VarianceRow {
  reconUid: string;
  date: string;
  userUid: string;
  userName: string;
  status: string;
  variance: number;
  isShortage: boolean;
  isMaterial: boolean;
  explanation: string | null;
  shortageReason: string | null;
}

export interface VarianceReport {
  cutoffDate: string | null;
  startsBeforeCutoff: boolean;
  threshold: number;
  totalShortage: number;
  totalSurplus: number;
  net: number;
  materialDays: number;
  minorDays: number;
  rows: VarianceRow[];
}

export function normalizeVarianceReport(d: Raw): VarianceReport {
  return {
    cutoffDate: str(d['cutoffDate']),
    startsBeforeCutoff: d['requestedRangeStartsBeforeCutoff'] === true,
    threshold: num(d['thresholdApplied']),
    totalShortage: num(d['totalShortage']),
    totalSurplus: num(d['totalSurplus']),
    net: num(d['netVariance']),
    materialDays: num(d['materialDaysCount']),
    minorDays: num(d['subThresholdDaysCount']),
    rows: list(d['rows']).map((x) => ({
      reconUid: String(x['reconciliationUid'] ?? ''),
      date: String(x['reconciliationDate'] ?? ''),
      userUid: String(x['userUid'] ?? ''),
      userName: String(x['userName'] ?? '—'),
      status: String(x['status'] ?? ''),
      variance: num(x['varianceAmount']),
      isShortage: x['isShortage'] === true || x['shortage'] === true,
      isMaterial: x['isMaterial'] === true || x['material'] === true,
      explanation: str(x['varianceExplanation']),
      shortageReason: str(x['shortageReason']),
    })),
  };
}

// ── Safe Box ────────────────────────────────────────────────────────────────
export type SafeBoxStatus = 'PENDING' | 'CONFIRMED' | 'REJECTED' | 'CANCELLED';
export type SafeBoxDepositType = 'BANK_DEPOSIT' | 'HAND_OVER';

export interface SafeBoxDeposit {
  uid: string;
  cashEntryUid: string | null;
  cashierUid: string | null;
  cashierName: string | null;
  originalAmount: number | null;
  amount: number;
  remaining: number | null;
  type: SafeBoxDepositType;
  bankName: string | null;
  receipt: string | null;
  recipientUid: string | null;
  recipientName: string | null;
  status: SafeBoxStatus;
  rejectionReason: string | null;
  cancellationReason: string | null;
  submittedAt: string | null;
  confirmedByName: string | null;
  confirmedAt: string | null;
}

export function normalizeDeposit(x: Raw): SafeBoxDeposit {
  const n = (v: unknown) => (v === null || v === undefined ? null : num(v));
  return {
    uid: String(x['uid'] ?? ''),
    cashEntryUid: str(x['cashEntryUid']),
    cashierUid: str(x['cashierUid']),
    cashierName: str(x['cashierName']),
    originalAmount: n(x['originalAmount']),
    amount: num(x['submittedAmount']),
    remaining: n(x['remainingAmount']),
    type: (str(x['depositType']) as SafeBoxDepositType) ?? 'BANK_DEPOSIT',
    bankName: str(x['bankName']),
    receipt: str(x['receiptNumber']),
    recipientUid: str(x['recipientUid']),
    recipientName: str(x['recipientName']),
    status: (str(x['status']) as SafeBoxStatus) ?? 'PENDING',
    rejectionReason: str(x['rejectionReason']),
    cancellationReason: str(x['cancellationReason']),
    submittedAt: str(x['submittedAt']),
    confirmedByName: str(x['confirmedByName']),
    confirmedAt: str(x['confirmedAt']),
  };
}

export interface SafeBoxOutstandingEntry {
  cashEntryUid: string | null;
  reconUid: string | null;
  date: string | null;
  amount: number;
  confirmed: number;
  remaining: number;
}

const toOutstanding = (x: Raw): SafeBoxOutstandingEntry => ({
  cashEntryUid: str(x['cashEntryUid']),
  reconUid: str(x['reconUid']),
  date: str(x['reconciliationDate']),
  amount: num(x['amount']),
  confirmed: num(x['confirmedTotal']),
  remaining: num(x['remaining']),
});

export interface SafeBoxCashierOutstanding {
  cashierUid: string | null;
  cashierName: string | null;
  total: number;
  entries: SafeBoxOutstandingEntry[];
}

export function normalizeOutstanding(x: Raw): SafeBoxCashierOutstanding {
  return { cashierUid: str(x['cashierUid']), cashierName: str(x['cashierName']), total: num(x['totalOutstanding']), entries: list(x['entries']).map(toOutstanding) };
}

export interface SafeBoxUnconfirmed {
  count: number;
  total: number;
  entries: SafeBoxOutstandingEntry[];
}

export function normalizeUnconfirmed(x: Raw): SafeBoxUnconfirmed {
  return { count: num(x['count']), total: num(x['totalAmount']), entries: list(x['entries']).map(toOutstanding) };
}

export const SAFE_BOX_STATUS: Record<SafeBoxStatus, { en: string; sw: string; color: string }> = {
  PENDING: { en: 'Waiting', sw: 'Inasubiri', color: 'var(--c-warning)' },
  CONFIRMED: { en: 'Confirmed', sw: 'Imethibitishwa', color: 'var(--c-success)' },
  REJECTED: { en: 'Rejected', sw: 'Imekataliwa', color: 'var(--c-error)' },
  CANCELLED: { en: 'Cancelled', sw: 'Imefutwa', color: 'var(--c-text-2)' },
};

/** Banks offered for Safe Box deposits (Flutter `_reconBanks`); OTHER = type a name. */
export const RECON_BANKS = ['CRDB', 'NMB', 'NBC', 'SELCOM', 'PCB', 'OTHER'];
