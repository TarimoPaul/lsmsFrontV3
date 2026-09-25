export type ReconStatus = 'DRAFT' | 'SUBMITTED' | 'REVIEWED' | 'APPROVED' | 'CLOSED' | 'REOPENED';

export const RECON_STATUS: Record<ReconStatus, { en: string; sw: string; color: string; icon: string }> = {
  DRAFT: { en: 'Draft', sw: 'Rasimu', color: 'var(--c-text-2)', icon: 'edit_note' },
  SUBMITTED: { en: 'Submitted', sw: 'Imewasilishwa', color: 'var(--c-info)', icon: 'send' },
  REVIEWED: { en: 'Reviewed', sw: 'Imekaguliwa', color: 'var(--c-warning)', icon: 'rate_review' },
  APPROVED: { en: 'Approved', sw: 'Imeidhinishwa', color: 'var(--c-success)', icon: 'verified' },
  CLOSED: { en: 'Closed', sw: 'Imefungwa', color: 'var(--c-success)', icon: 'lock' },
  REOPENED: { en: 'Reopened', sw: 'Imefunguliwa tena', color: 'var(--c-error)', icon: 'lock_open' },
};

/** Where declared money sits — TODAY entries feed today's formula, DEBT ones the collections section. */
export const CASH_TYPES: Record<string, { en: string; sw: string; group: 'today' | 'debt' | 'previous'; bank?: boolean; icon: string }> = {
  CASH_IN_HAND: { en: 'Cash from today’s sales', sw: 'Taslimu (mauzo ya leo)', group: 'today', icon: 'payments' },
  BANK_DEPOSIT: { en: 'Bank deposit (today)', sw: 'Depositi benki (leo)', group: 'today', bank: true, icon: 'account_balance' },
  SAFE_BOX: { en: 'Safe box', sw: 'Sefu', group: 'today', bank: true, icon: 'lock' },
  FLOAT_BALANCE: { en: 'Float kept', sw: 'Bakaa la float', group: 'today', icon: 'savings' },
  PETTY_CASH: { en: 'Petty cash', sw: 'Petty cash', group: 'today', icon: 'wallet' },
  CASH_DEBT: { en: 'Cash from debts collected', sw: 'Taslimu (madeni)', group: 'debt', icon: 'payments' },
  BANK_DEBT: { en: 'Bank deposit of debts', sw: 'Depositi benki (madeni)', group: 'debt', bank: true, icon: 'account_balance' },
  MOBILE_DEBT: { en: 'Mobile deposit of debts', sw: 'Simu (madeni)', group: 'debt', icon: 'phone_iphone' },
  CASH_PREVIOUS: { en: 'Left over from earlier days', sw: 'Pesa za jana / zilizobaki', group: 'previous', icon: 'history' },
};
/** Types the cashier can add by hand (SAFE_BOX comes from the Safe box tab). */
export const CASH_TYPES_ADDABLE = ['CASH_IN_HAND', 'BANK_DEPOSIT', 'FLOAT_BALANCE', 'PETTY_CASH', 'CASH_DEBT', 'BANK_DEBT', 'MOBILE_DEBT', 'CASH_PREVIOUS'];

export const MOBILE_PROVIDERS = ['TIGO', 'VODACOM', 'AIRTEL', 'HALOPESA', 'ZANTEL', 'TTCL'];

export const EXPENSE_TYPES: Record<string, { en: string; sw: string; icon: string }> = {
  CHAKULA: { en: 'Food', sw: 'Chakula', icon: 'restaurant' },
  USAFIRI: { en: 'Transport', sw: 'Usafiri', icon: 'local_shipping' },
  UMEME: { en: 'Electricity', sw: 'Umeme', icon: 'bolt' },
  MAJI: { en: 'Water', sw: 'Maji', icon: 'water_drop' },
  PANGO: { en: 'Rent', sw: 'Pango', icon: 'home' },
  MISHAHARA: { en: 'Salaries', sw: 'Mishahara', icon: 'badge' },
  UKARABATI: { en: 'Repairs', sw: 'Ukarabati', icon: 'build' },
  NYINGINE: { en: 'Other', sw: 'Nyingine', icon: 'more_horiz' },
};

export const SHORTAGE_REASONS: Record<string, { en: string; sw: string }> = {
  CUSTOMER_BALANCE_PENDING: { en: 'Customer balance pending', sw: 'Bakaa la mteja linasubiri' },
  BANK_TRANSFER_PENDING: { en: 'Bank transfer pending', sw: 'Uhamisho benki unasubiri' },
  FLOAT_RETAINED: { en: 'Float retained', sw: 'Float imehifadhiwa' },
  EXPENSE_RECEIPT_PENDING: { en: 'Expense receipt pending', sw: 'Risiti ya gharama inasubiri' },
  COUNTING_ERROR: { en: 'Counting error', sw: 'Kosa la kuhesabu' },
  FRAUD_SUSPECTED: { en: 'Fraud suspected', sw: 'Ulaghai unashukiwa' },
  OTHER: { en: 'Other', sw: 'Nyingine' },
};

export type VerifyType = 'CASH' | 'MOBILE' | 'DEBT' | 'COLLECTION' | 'EXPENSE' | 'PURCHASE';

interface Verified {
  verified: boolean;
  verifiedByName: string | null;
  verifiedAt: string | null;
}

export interface CashEntry extends Verified {
  uid: string;
  type: string;
  amount: number;
  bankName: string | null;
  reference: string | null;
  notes: string | null;
  depositDate: string | null;
  /** Auto-created from a sales payment (server-managed, not deletable). */
  auto: boolean;
}

export interface MobileEntry extends Verified {
  uid: string;
  provider: string;
  amount: number;
  reference: string | null;
  notes: string | null;
  auto: boolean;
}

export interface Expense extends Verified {
  uid: string;
  type: string;
  description: string;
  amount: number;
  receipt: string | null;
  notes: string | null;
  approvalStatus: string | null;
}

export interface ReconDebt extends Verified {
  uid: string;
  customerName: string | null;
  customerPhone: string | null;
  amount: number;
  description: string | null;
  isPaid: boolean;
  saleUid: string | null;
  dueDate: string | null;
  origin: string | null;
}

export interface ReconPurchase extends Verified {
  uid: string;
  description: string;
  amount: number;
  supplier: string | null;
  purchaseUid: string | null;
  invoice: string | null;
}

export interface DebtCollection extends Verified {
  uid: string;
  saleUid: string | null;
  customerName: string | null;
  amount: number;
  method: string | null;
  receipt: string | null;
  saleDate: string | null;
}

export interface Recon {
  uid: string;
  date: string;
  userUid: string | null;
  userName: string | null;
  status: ReconStatus;
  editable: boolean;
  autoTotalSales: number;
  autoTotalPaid: number;
  autoReturnDeductions: number;
  cashOnHandDeclared: number;
  bankDepositsTotal: number;
  safeBoxTotal: number;
  pettyCashTotal: number;
  mobileMoneyTotal: number;
  retailDebtsTotal: number;
  posDebtsTotal: number;
  manualDebtsTotal: number;
  expensesTotal: number;
  purchasesTotal: number;
  debtCollectionsTotal: number;
  cashDebtTotal: number;
  bankDebtTotal: number;
  mobileDebtTotal: number;
  cashPreviousTotal: number;
  /** Positive = shortage (unaccounted), negative = excess. */
  result: number;
  expectedCash: number;
  accountedCash: number;
  varianceExplanation: string | null;
  shortageReason: string | null;
  zeroCashReason: string | null;
  notes: string | null;
  reviewNotes: string | null;
  approvalNotes: string | null;
  reopenReason: string | null;
  reopenCount: number;
  postApprovalDrift: number | null;
  hasDrift: boolean;
  submittedAt: string | null;
  reviewedAt: string | null;
  reviewedByName: string | null;
  approvedAt: string | null;
  approvedByName: string | null;
  reopenedAt: string | null;
  createdAt: string | null;
  cashEntries: CashEntry[];
  mobileEntries: MobileEntry[];
  expenses: Expense[];
  debts: ReconDebt[];
  purchases: ReconPurchase[];
  collections: DebtCollection[];
}

/** GET /reconciliation/auto-summary/{date} — live POS figures for the day. */
export interface AutoSummary {
  totalSales: number;
  totalPaid: number;
  totalOutstanding: number;
  cashSales: number;
  mobileSales: number;
  creditSales: number;
  retailSales: number;
  wholesaleSales: number;
  wholesaleOutstanding: number;
  returnDeductions: number;
  saleCount: number;
  paidCount: number;
  outstandingCount: number;
  mobileByProvider: Array<[string, number]>;
}

type Raw = Record<string, unknown>;
const num = (v: unknown) => Number(v ?? 0) || 0;
const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);
const ver = (r: Raw): Verified => ({ verified: r['verified'] === true, verifiedByName: str(r['verifiedByName']), verifiedAt: str(r['verifiedAt']) });
const list = (v: unknown) => (Array.isArray(v) ? (v as Raw[]) : []);

export function normalizeRecon(r: Raw): Recon {
  const status = String(r['status'] ?? 'DRAFT').toUpperCase() as ReconStatus;
  return {
    uid: String(r['uid'] ?? ''),
    date: String(r['reconciliationDate'] ?? ''),
    userUid: str(r['userUid']),
    userName: str(r['userName']),
    status: status in RECON_STATUS ? status : 'DRAFT',
    editable: r['editable'] === true || status === 'DRAFT' || status === 'REOPENED',
    autoTotalSales: num(r['autoTotalSales']),
    autoTotalPaid: num(r['autoTotalPaid']),
    autoReturnDeductions: num(r['autoReturnDeductions']),
    cashOnHandDeclared: num(r['cashOnHandDeclared']),
    bankDepositsTotal: num(r['bankDepositsTotal']),
    safeBoxTotal: num(r['safeBoxTotal']),
    pettyCashTotal: num(r['pettyCashTotal']),
    mobileMoneyTotal: num(r['mobileMoneytotal'] ?? r['mobileMoneyTotal']),
    retailDebtsTotal: num(r['retailDebtsTotal']),
    posDebtsTotal: num(r['posDebtsTotal']),
    manualDebtsTotal: num(r['manualDebtsTotal']),
    expensesTotal: num(r['expensesTotal']),
    purchasesTotal: num(r['purchasesTotal']),
    debtCollectionsTotal: num(r['debtCollectionsTotal']),
    cashDebtTotal: num(r['cashDebtTotal']),
    bankDebtTotal: num(r['bankDebtTotal']),
    mobileDebtTotal: num(r['mobileDebtTotal']),
    cashPreviousTotal: num(r['cashPreviousTotal']),
    result: num(r['todayFormulaResult']),
    expectedCash: num(r['expectedCash']),
    accountedCash: num(r['accountedCash']),
    varianceExplanation: str(r['varianceExplanation']),
    shortageReason: str(r['shortageReason']),
    zeroCashReason: str(r['zeroCashReason']),
    notes: str(r['notes']),
    reviewNotes: str(r['reviewNotes']),
    approvalNotes: str(r['approvalNotes']),
    reopenReason: str(r['reopenReason']),
    reopenCount: num(r['reopenCount']),
    postApprovalDrift: r['postApprovalDrift'] === null || r['postApprovalDrift'] === undefined ? null : num(r['postApprovalDrift']),
    hasDrift: r['hasPostApprovalDrift'] === true,
    submittedAt: str(r['submittedAt']),
    reviewedAt: str(r['reviewedAt']),
    reviewedByName: str(r['reviewedByName']),
    approvedAt: str(r['approvedAt']),
    approvedByName: str(r['approvedByName']),
    reopenedAt: str(r['reopenedAt']),
    createdAt: str(r['createdAt']),
    cashEntries: list(r['cashEntries']).map((e) => ({
      uid: String(e['uid'] ?? ''),
      type: String(e['entryType'] ?? 'CASH_IN_HAND'),
      amount: num(e['amount']),
      bankName: str(e['bankName']),
      reference: str(e['depositReference']),
      notes: str(e['notes']),
      depositDate: str(e['depositDate']),
      auto: !!str(e['sourcePaymentUid']),
      ...ver(e),
    })),
    mobileEntries: list(r['mobileEntries']).map((e) => ({
      uid: String(e['uid'] ?? ''),
      provider: String(e['provider'] ?? '—'),
      amount: num(e['amount']),
      reference: str(e['transactionReference']),
      notes: str(e['notes']),
      auto: !!str(e['sourcePaymentUid']),
      ...ver(e),
    })),
    expenses: list(r['expenses']).map((e) => ({
      uid: String(e['uid'] ?? ''),
      type: String(e['expenseType'] ?? 'NYINGINE'),
      description: String(e['description'] ?? ''),
      amount: num(e['amount']),
      receipt: str(e['receiptReference']),
      notes: str(e['notes']),
      approvalStatus: str(e['approvalStatus']),
      ...ver(e),
    })),
    debts: list(r['retailDebts']).map((e) => ({
      uid: String(e['uid'] ?? ''),
      customerName: str(e['debtorName'] ?? e['customerName']),
      customerPhone: str(e['debtorPhone'] ?? e['customerPhone']),
      amount: num(e['amount']),
      description: str(e['description']),
      isPaid: e['isPaid'] === true || e['paid'] === true,
      saleUid: str(e['saleUid']),
      dueDate: str(e['dueDate']),
      origin: str(e['referenceType']),
      ...ver(e),
    })),
    purchases: list(r['purchases']).map((e) => ({
      uid: String(e['uid'] ?? ''),
      description: String(e['description'] ?? e['productName'] ?? ''),
      amount: num(e['amount'] ?? e['totalAmount']),
      supplier: str(e['supplierName']),
      purchaseUid: str(e['purchaseUid']),
      invoice: str(e['invoiceReference']),
      ...ver(e),
    })),
    collections: list(r['debtCollections']).map((e) => ({
      uid: String(e['uid'] ?? ''),
      saleUid: str(e['saleUid']),
      customerName: str(e['customerName']),
      amount: num(e['amountCollected']),
      method: str(e['paymentMethod']),
      receipt: str(e['receiptNumber'] ?? e['saleReceiptNumber']),
      saleDate: str(e['saleDate'] ?? e['originalSaleDate']),
      ...ver(e),
    })),
  };
}

export function normalizeAutoSummary(d: Raw): AutoSummary {
  const byProvider = (d['mobileByProvider'] as Record<string, unknown>) ?? {};
  return {
    totalSales: num(d['totalSales']),
    totalPaid: num(d['totalPaid']),
    totalOutstanding: num(d['totalOutstanding']),
    cashSales: num(d['cashSales']),
    mobileSales: num(d['mobileSales']),
    creditSales: num(d['creditSales']),
    retailSales: num(d['retailSales']),
    wholesaleSales: num(d['wholesaleSales']),
    wholesaleOutstanding: num(d['wholesaleOutstanding']),
    returnDeductions: num(d['returnDeductions']),
    saleCount: num(d['saleCount']),
    paidCount: num(d['paidCount']),
    outstandingCount: num(d['outstandingCount']),
    mobileByProvider: Object.entries(byProvider).map(([k, v]) => [k, num(v)] as [string, number]),
  };
}

/** Items the approver must tick before approving (unpaid debts only). */
export function pendingVerification(r: Recon): number {
  const all = [...r.cashEntries, ...r.mobileEntries, ...r.expenses, ...r.purchases, ...r.collections];
  return all.filter((x) => !x.verified).length + r.debts.filter((d) => !d.isPaid && !d.verified).length;
}
