/**
 * Reports hub catalogue. Every report reads the same live sources the modules
 * use — the General Ledger for money, Store for stock, the sales / purchases
 * registers and Capital — so a figure here always matches the module it came
 * from. Flutter's server reports that no longer work (daily-sales, cashier,
 * deleted-debts, inventory/*) are computed from those sources instead.
 */
export type ReportId = 'financial' | 'profit' | 'sales' | 'inventory' | 'purchases' | 'receivables' | 'expenses' | 'deleted-debts';

type Label = { en: string; sw: string };

export interface ReportDef {
  id: ReportId;
  icon: string;
  color: string;
  title: Label;
  description: Label;
  /** Source shown on the card, e.g. "General Ledger". */
  source: Label;
  /** Any one of these unlocks the report (ROOT sees everything). */
  permissions: string[];
  topics: Label[];
}

export const REPORTS: ReportDef[] = [
  {
    id: 'financial',
    icon: 'account_balance',
    color: 'var(--c-primary)',
    title: { en: 'Financial statements', sw: 'Taarifa za fedha' },
    description: { en: 'Monthly profit & loss, financial position and book checks', sw: 'Faida na hasara kwa mwezi, hali ya fedha na ukaguzi wa vitabu' },
    source: { en: 'General Ledger', sw: 'Leja Kuu (GL)' },
    permissions: ['FINANCE_READ'],
    topics: [
      { en: 'P&L by month', sw: 'Faida/hasara kwa mwezi' },
      { en: 'Financial position', sw: 'Hali ya fedha' },
      { en: 'Expenses by account', sw: 'Gharama kwa akaunti' },
      { en: 'GL vs registers', sw: 'GL dhidi ya rejista' },
    ],
  },
  {
    id: 'profit',
    icon: 'savings',
    color: 'var(--c-success)',
    title: { en: 'Daily profit & cash', sw: 'Faida ya kila siku' },
    description: { en: 'Net profit per day, profit already collected, money with debtors and operating cash flow', sw: 'Faida halisi kwa siku, faida iliyokusanywa, pesa iliyokwama kwa wadeni na mtiririko wa pesa' },
    source: { en: 'Sales, recon, expenses, stock', sw: 'Mauzo, recon, gharama, stoki' },
    permissions: ['SALES_ANALYTICS'],
    topics: [
      { en: 'Net by day', sw: 'Faida kwa siku' },
      { en: 'Collected profit', sw: 'Faida iliyokusanywa' },
      { en: 'Money with debtors', sw: 'Pesa kwa wadeni' },
      { en: 'Cash flow', sw: 'Mtiririko wa pesa' },
    ],
  },
  {
    id: 'sales',
    icon: 'point_of_sale',
    color: 'var(--c-success)',
    title: { en: 'Sales report', sw: 'Ripoti ya mauzo' },
    description: { en: 'Daily sales, staff performance, product profitability and payments', sw: 'Mauzo ya kila siku, utendaji wa wafanyakazi, faida kwa bidhaa na malipo' },
    source: { en: 'Sales register', sw: 'Rejista ya mauzo' },
    permissions: ['SALES_REPORT', 'PROFIT_REPORT'],
    topics: [
      { en: 'By day', sw: 'Kwa siku' },
      { en: 'By staff', sw: 'Kwa mfanyakazi' },
      { en: 'By product', sw: 'Kwa bidhaa' },
      { en: 'Payment methods', sw: 'Njia za malipo' },
    ],
  },
  {
    id: 'inventory',
    icon: 'inventory_2',
    color: 'var(--c-info)',
    title: { en: 'Stock report', sw: 'Ripoti ya stoki' },
    description: { en: 'Stock on hand, value at cost and at selling price, items to re-order', sw: 'Stoki iliyopo, thamani kwa gharama na kwa bei ya kuuza, bidhaa za kuagiza' },
    source: { en: 'Store', sw: 'Stoo' },
    permissions: ['STOCK_REPORT'],
    topics: [
      { en: 'Stock levels', sw: 'Kiasi cha stoki' },
      { en: 'Valuation', sw: 'Thamani ya stoki' },
      { en: 'Re-order list', sw: 'Orodha ya kuagiza' },
      { en: 'Price list print', sw: 'Chapisha bei' },
    ],
  },
  {
    id: 'purchases',
    icon: 'local_shipping',
    color: 'var(--c-warning)',
    title: { en: 'Purchases report', sw: 'Ripoti ya manunuzi' },
    description: { en: 'What was bought, from whom and at what cost', sw: 'Kilichonunuliwa, kutoka kwa nani na kwa gharama gani' },
    source: { en: 'Purchases register', sw: 'Rejista ya manunuzi' },
    permissions: ['PURCHASE_REPORT'],
    topics: [
      { en: 'By supplier', sw: 'Kwa msambazaji' },
      { en: 'By product', sw: 'Kwa bidhaa' },
      { en: 'Status', sw: 'Hali' },
    ],
  },
  {
    id: 'receivables',
    icon: 'request_quote',
    color: 'var(--c-teal)',
    title: { en: 'Customer debts (AR)', sw: 'Madeni ya wateja (AR)' },
    description: { en: 'Who owes and for how long — 0-30, 31-60, 61-90, 90+ days', sw: 'Nani anadaiwa na kwa muda gani — siku 0-30, 31-60, 61-90, 90+' },
    source: { en: 'Receivables ledger', sw: 'Rejista ya madeni' },
    permissions: ['SALES_READ'],
    topics: [
      { en: 'Aging buckets', sw: 'Umri wa deni' },
      { en: 'By customer', sw: 'Kwa mteja' },
      { en: 'Unpaid invoices', sw: 'Ankara zisizolipwa' },
    ],
  },
  {
    id: 'expenses',
    icon: 'receipt_long',
    color: 'var(--c-error)',
    title: { en: 'Expenses & capital', sw: 'Gharama na mtaji' },
    description: { en: 'Running costs by category, fixed assets, loans and owner capital', sw: 'Gharama za uendeshaji kwa aina, mali za kudumu, mikopo na mtaji wa mmiliki' },
    source: { en: 'Capital + GL', sw: 'Mtaji + GL' },
    permissions: ['CAPITAL_READ'],
    topics: [
      { en: 'By category', sw: 'Kwa aina' },
      { en: 'Fixed assets', sw: 'Mali za kudumu' },
      { en: 'Loans', sw: 'Mikopo' },
      { en: 'Owner capital', sw: 'Mtaji wa mmiliki' },
    ],
  },
  {
    id: 'deleted-debts',
    icon: 'delete_sweep',
    color: '#b71c1c',
    title: { en: 'Deleted debts', sw: 'Madeni yaliyofutwa' },
    description: { en: 'Sales deleted while money was still owed — who deleted them and why', sw: 'Mauzo yaliyofutwa yakiwa bado na deni — nani aliyafuta na kwa nini' },
    source: { en: 'Deleted sales', sw: 'Mauzo yaliyofutwa' },
    permissions: ['SALES_READ_ALL'],
    topics: [
      { en: 'Debt at deletion', sw: 'Deni wakati wa kufuta' },
      { en: 'Deleted by', sw: 'Aliyefuta' },
      { en: 'Reason', sw: 'Sababu' },
    ],
  },
];

export function reportDef(id: string): ReportDef | undefined {
  return REPORTS.find((r) => r.id === id);
}

// ── Receivables (/api/reports/ar, v_accounts_receivable — matches GL 1100) ──

export interface ArInvoice {
  saleUid: string;
  receiptNumber: string;
  saleDate: string | null;
  dueDate: string | null;
  customerUid: string | null;
  customerName: string;
  customerPhone: string | null;
  totalAmount: number;
  outstanding: number;
  paymentStatus: string | null;
  daysOutstanding: number;
  bucket: AgingKey;
}

export interface ArCustomer {
  customerUid: string | null;
  customerName: string;
  customerPhone: string | null;
  invoiceCount: number;
  total: number;
  b0: number;
  b31: number;
  b61: number;
  b90: number;
  maxDays: number;
}

export type AgingKey = '0-30' | '31-60' | '61-90' | '90+';

export const AGING: { key: AgingKey; en: string; sw: string; color: string }[] = [
  { key: '0-30', en: '0–30 days', sw: 'Siku 0–30', color: 'var(--c-success)' },
  { key: '31-60', en: '31–60 days', sw: 'Siku 31–60', color: 'var(--c-info)' },
  { key: '61-90', en: '61–90 days', sw: 'Siku 61–90', color: 'var(--c-warning)' },
  { key: '90+', en: 'Over 90 days', sw: 'Zaidi ya siku 90', color: 'var(--c-error)' },
];

// ── Deleted debts (parsed from the deletion note the backend writes) ──

export interface DeletedDebt {
  saleUid: string;
  receiptNumber: string;
  saleDate: string | null;
  deletedAt: string | null;
  customerName: string;
  seller: string | null;
  total: number;
  /** Money still owed when the sale was deleted. */
  debt: number;
  deletedBy: string | null;
  reason: string | null;
  /** "System" / unknown actor — the deletion cannot be traced to a person. */
  untraced: boolean;
}

// ── Daily profit & cash (/api/reports/daily-pnl) ──

export interface PnlDay {
  date: string;
  revenue: number;
  cogs: number;
  grossProfit: number;
  dailyExpenses: number;
  monthlyExpenses: number;
  depreciation: number;
  /** Posted stock loss at cost (negative = net surplus). */
  stockLoss: number;
  netProfit: number;
  debtIssuedPos: number;
  debtIssuedWalkIn: number;
  debtCollected: number;
  debtAdjusted: number;
  /** Of this day's debts, what is still unpaid now. */
  stillOwed: number;
  stillOwedWalkIn: number;
  marginInStillOwed: number;
  marginInStillOwedEstimated: number;
  collectedProfit: number;
}

export interface PnlTotals extends Omit<PnlDay, 'date'> {
  days: number;
  grossMarginPct: number;
  arOpening: number;
  arClosing: number;
  arClosingWalkIn: number;
  arNow: number;
  stockOpening: number;
  stockClosing: number;
  stockChange: number;
  operatingCashFlow: number;
}

export interface PnlMonth {
  month: string;
  revenue: number;
  grossProfit: number;
  grossMarginPct: number;
  monthlyExpenses: number;
  depreciation: number;
  daysInMonth: number;
}

export interface PnlMonthlyItem {
  month: string;
  description: string;
  amount: number;
  allYear: boolean;
}

export interface PnlWarning {
  code: string;
  count: number;
  amount: number | null;
  message: string;
}

export interface DailyPnl {
  from: string;
  to: string;
  asOf: string;
  walkInMarginEstimated: boolean;
  days: PnlDay[];
  totals: PnlTotals;
  months: PnlMonth[];
  monthlyItems: PnlMonthlyItem[];
  warnings: PnlWarning[];
}

/** The backend refuses longer periods. */
export const DAILY_PNL_MAX_DAYS = 93;
