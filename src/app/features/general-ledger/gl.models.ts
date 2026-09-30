/**
 * General Ledger (Spring `/api/v1/gl`) — journals are the source of truth for
 * every financial figure in the app (balance sheet, P&L, capital position).
 */

export interface GlAccount {
  uid: string;
  accountCode: string;
  accountName: string;
  accountNameSw: string | null;
  accountType: 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE' | string;
  accountCategory: string | null;
  normalBalance: 'DEBIT' | 'CREDIT' | string;
  isActive: boolean;
}

export interface GlStatus {
  postingEnabled: boolean;
  shadowMode: boolean;
  totalEntriesPosted: number;
  balancedEntries: number;
  unbalancedEntries: number;
  lastPostingDate: string | null;
  message: string;
}

export interface TrialBalanceLine {
  accountCode: string;
  accountName: string;
  accountNameSw: string | null;
  accountType: string | null;
  accountCategory: string | null;
  openingBalance: number;
  periodDebit: number;
  periodCredit: number;
  debitBalance: number;
  creditBalance: number;
  netBalance: number;
  abnormal: boolean;
}

export interface TrialBalance {
  periodStart: string;
  periodEnd: string;
  lines: TrialBalanceLine[];
  totalDebits: number;
  totalCredits: number;
  isBalanced: boolean;
}

export interface BsAccount {
  code: string;
  name: string;
  nameSw: string | null;
  category: string | null;
  amount: number;
}

export interface BalanceSheet {
  asOfDate: string;
  assets: { accounts: BsAccount[]; subtotal: number };
  liabilities: { accounts: BsAccount[]; subtotal: number };
  equity: { accounts: BsAccount[]; subtotal: number };
  totalAssets: number;
  totalLiabilitiesAndEquity: number;
  isBalanced: boolean;
}

export interface PnlLine {
  code: string;
  name: string;
  nameSw: string | null;
  amount: number;
}

export interface IncomeStatement {
  periodStart: string;
  periodEnd: string;
  revenue: PnlLine[];
  revenueTotal: number;
  contraRevenue: PnlLine[];
  contraRevenueTotal: number;
  netRevenue: number;
  costOfSales: PnlLine[];
  costOfSalesTotal: number;
  grossProfit: number;
  grossMarginPct: number;
  operatingExpenses: PnlLine[];
  operatingExpensesTotal: number;
  operatingProfit: number;
  otherIncome: PnlLine[];
  otherIncomeTotal: number;
  netProfit: number;
  netMarginPct: number;
}

export interface CashAccountBalance {
  code: string;
  name: string;
  nameSw: string | null;
  amount: number;
}

export interface FinancialPosition {
  asOfDate: string;
  postingEnabled: boolean;
  cash: number;
  cashAccounts: CashAccountBalance[];
  receivables: number;
  staffReceivables: number;
  inventory: number;
  fixedAssetsCost: number;
  accumulatedDepreciation: number;
  fixedAssetsNet: number;
  otherAssets: number;
  totalAssets: number;
  payables: number;
  loans: number;
  otherLiabilities: number;
  totalLiabilities: number;
  ownerCapital: number;
  openingBalanceEquity: number;
  drawings: number;
  retainedEarnings: number;
  totalEquity: number;
  workingCapital: number;
  debtToEquity: number | null;
  isBalanced: boolean;
}

export type ControlKey = 'INVENTORY' | 'RECEIVABLES' | 'PAYABLES' | 'STAFF_RECEIVABLES' | 'LOANS';

export interface ControlCheck {
  key: ControlKey;
  accountCode: string;
  label: string;
  labelSw: string;
  glBalance: number;
  subLedgerBalance: number;
  difference: number;
  reconciled: boolean;
}

export interface JournalLine {
  uid: string;
  accountCode: string;
  accountName: string;
  debitAmount: number;
  creditAmount: number;
  description: string | null;
  lineOrder: number;
}

export interface JournalEntry {
  uid: string;
  entryDate: string;
  entryNumber: string | null;
  description: string | null;
  referenceType: string;
  referenceUid: string | null;
  referenceNumber: string | null;
  status: string;
  reversedEntryUid: string | null;
  totalDebit: number;
  totalCredit: number;
  postedBy: string | null;
  postedAt: string | null;
  isReversal: boolean;
  lines: JournalLine[];
}

export interface LedgerRow {
  entryDate: string;
  entryNumber: string | null;
  description: string | null;
  referenceType: string | null;
  referenceNumber: string | null;
  debit: number;
  credit: number;
  runningBalance: number;
}

export interface AccountLedger {
  accountCode: string;
  accountName: string;
  accountNameSw: string | null;
  openingBalance: number;
  transactions: LedgerRow[];
  totalDebits: number;
  totalCredits: number;
  closingBalance: number;
}

export interface ManualLine {
  accountCode: string;
  debit: number;
  credit: number;
  description?: string;
}

type Label = { en: string; sw: string };

/** Journal event types (backend `JournalEventType`). */
export const EVENT_TYPES: Record<string, Label> = {
  SALE_CASH: { en: 'Cash sale', sw: 'Mauzo ya taslimu' },
  SALE_CREDIT: { en: 'Credit sale', sw: 'Mauzo ya mkopo' },
  SALE_MIXED: { en: 'Mixed-payment sale', sw: 'Mauzo mchanganyiko' },
  PAYMENT_RECEIVED: { en: 'Debt collected', sw: 'Deni limelipwa' },
  SALE_RETURN_CASH: { en: 'Sale return (cash)', sw: 'Marejesho (pesa)' },
  SALE_RETURN_CREDIT: { en: 'Sale return (credit)', sw: 'Marejesho (mkopo)' },
  PURCHASE_INVENTORY: { en: 'Stock purchase', sw: 'Ununuzi wa bidhaa' },
  PURCHASE_PAYMENT: { en: 'Supplier payment', sw: 'Malipo kwa msambazaji' },
  EXPENSE_DIRECT: { en: 'Expense', sw: 'Gharama' },
  EXPENSE_RECURRING: { en: 'Recurring expense', sw: 'Gharama inayojirudia' },
  ASSET_PURCHASE: { en: 'Asset purchase', sw: 'Ununuzi wa mali' },
  ASSET_DEPRECIATION: { en: 'Depreciation', sw: 'Uchakavu' },
  ASSET_DISPOSAL_GAIN: { en: 'Asset disposal (gain)', sw: 'Kuondoa mali (faida)' },
  ASSET_DISPOSAL_LOSS: { en: 'Asset disposal (loss)', sw: 'Kuondoa mali (hasara)' },
  LOAN_RECEIVED: { en: 'Loan received', sw: 'Mkopo umepokelewa' },
  LOAN_REPAYMENT: { en: 'Loan repayment', sw: 'Malipo ya mkopo' },
  LOAN_RECLASSIFICATION: { en: 'Loan to capital', sw: 'Mkopo kuwa mtaji' },
  CAPITAL_INJECTION: { en: 'Capital injection', sw: 'Kuongeza mtaji' },
  OWNER_WITHDRAWAL: { en: 'Owner withdrawal', sw: 'Mmiliki kutoa pesa' },
  SHRINKAGE_LOSS: { en: 'Shrinkage', sw: 'Upotevu wa bidhaa' },
  STOCK_ADJUSTMENT: { en: 'Stock adjustment', sw: 'Marekebisho ya stock' },
  STAFF_LIABILITY_CHARGE: { en: 'Charged to staff', sw: 'Deni la mfanyakazi' },
  STAFF_LIABILITY_PAYMENT: { en: 'Staff debt paid', sw: 'Mfanyakazi amelipa' },
  STAFF_LIABILITY_WAIVER: { en: 'Staff debt waived', sw: 'Deni la mfanyakazi limesamehewa' },
  DAY_CLOSE_VARIANCE: { en: 'Day-close variance', sw: 'Tofauti ya siku' },
  DEBT_RECLASSIFICATION: { en: 'Walk-in debt', sw: 'Deni la rejareja' },
  DEBT_WRITE_OFF: { en: 'Bad debt write-off', sw: 'Kufuta deni' },
  DEBT_WAIVER: { en: 'Debt waiver', sw: 'Msamaha wa deni' },
  DEBT_CORRECTION: { en: 'Debt correction', sw: 'Marekebisho ya deni' },
  RECONCILIATION_EXPENSE: { en: 'Reconciliation expense', sw: 'Gharama ya ulinganisho' },
  MANUAL_ADJUSTMENT: { en: 'Manual journal', sw: 'Journal ya mkono' },
  OPENING_BALANCE: { en: 'Opening balance / true-up', sw: 'Salio la kuanzia' },
  FUNDS_TRANSFER: { en: 'Transfer', sw: 'Uhamisho' },
};

export function eventLabel(type: string, sw: boolean): string {
  const l = EVENT_TYPES[type];
  return l ? (sw ? l.sw : l.en) : type;
}

export const ACCOUNT_TYPES: Record<string, Label & { color: string }> = {
  ASSET: { en: 'Assets', sw: 'Mali', color: 'var(--c-info)' },
  LIABILITY: { en: 'Liabilities', sw: 'Madeni', color: 'var(--c-warning)' },
  EQUITY: { en: 'Equity', sw: 'Mtaji', color: 'var(--c-secondary)' },
  REVENUE: { en: 'Revenue', sw: 'Mapato', color: 'var(--c-success)' },
  EXPENSE: { en: 'Expenses', sw: 'Matumizi', color: 'var(--c-error)' },
};

export const CONTROL_HELP: Record<ControlKey, Label> = {
  INVENTORY: { en: 'Stock on hand × weighted average cost', sw: 'Stock iliyopo × wastani wa bei ya kununua' },
  RECEIVABLES: { en: 'Unpaid balances of customer sales', sw: 'Madeni ya wateja ambayo hayajalipwa' },
  PAYABLES: { en: 'What suppliers are still owed', sw: 'Tunachodaiwa na wasambazaji' },
  STAFF_RECEIVABLES: { en: 'Open stock-shortage debts of staff', sw: 'Madeni ya uhaba ya wafanyakazi' },
  LOANS: { en: 'Unpaid loan principal (loan register)', sw: 'Mikopo ambayo haijalipwa' },
};

/** Parse the numbers Spring sends (BigDecimal → number/string). */
export const num = (v: unknown): number => (v === null || v === undefined || v === '' ? 0 : Number(v));
