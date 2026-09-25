export type SaleType = 'PIECES' | 'QUARTER_PACKAGE' | 'HALF_PACKAGE' | 'WHOLE_PACKAGE';

/** POS price buttons, in Flutter's order and colours. */
export const SALE_TYPES: Record<SaleType, { en: string; sw: string; color: string }> = {
  PIECES: { en: 'Retail', sw: 'Rejareja', color: 'var(--c-primary)' },
  QUARTER_PACKAGE: { en: 'Quarter', sw: 'Robo', color: '#2196f3' },
  HALF_PACKAGE: { en: 'Half', sw: 'Nusu', color: '#4caf50' },
  WHOLE_PACKAGE: { en: 'Wholesale', sw: 'Jumla', color: '#ff9800' },
};
export const SALE_TYPE_ORDER: SaleType[] = ['PIECES', 'QUARTER_PACKAGE', 'HALF_PACKAGE', 'WHOLE_PACKAGE'];

export const PAYMENT_METHODS: Record<string, { en: string; sw: string; icon: string }> = {
  CASH: { en: 'Cash', sw: 'Fedha Taslimu', icon: 'payments' },
  CREDIT: { en: 'Credit', sw: 'Mkopo', icon: 'credit_score' },
  VODACOM: { en: 'M-Pesa', sw: 'M-Pesa', icon: 'phone_iphone' },
  TIGOPESA: { en: 'Tigo Pesa', sw: 'Tigo Pesa', icon: 'phone_iphone' },
  HALOPESA: { en: 'Halo Pesa', sw: 'Halo Pesa', icon: 'phone_iphone' },
  AIRTELMONEY: { en: 'Airtel Money', sw: 'Airtel Money', icon: 'phone_iphone' },
  AIRTEL_MONEY: { en: 'Airtel Money', sw: 'Airtel Money', icon: 'phone_iphone' },
  MOBILE_MONEY: { en: 'Mobile money', sw: 'Pesa ya simu', icon: 'phone_iphone' },
  CRDB: { en: 'CRDB', sw: 'CRDB', icon: 'account_balance' },
  NMB: { en: 'NMB', sw: 'NMB', icon: 'account_balance' },
  NBC: { en: 'NBC', sw: 'NBC', icon: 'account_balance' },
  PCB: { en: 'PCB', sw: 'PCB', icon: 'account_balance' },
  SELCOM: { en: 'Selcom', sw: 'Selcom', icon: 'point_of_sale' },
  BANK_TRANSFER: { en: 'Bank transfer', sw: 'Uhamisho wa benki', icon: 'account_balance' },
};
export const DEFAULT_PAYMENT_METHODS = ['CASH', 'VODACOM', 'TIGOPESA', 'HALOPESA', 'AIRTELMONEY', 'CRDB', 'NMB', 'NBC', 'CREDIT', 'BANK_TRANSFER'];

export function methodLabel(m: string | null | undefined, sw: boolean): string {
  if (!m) return '—';
  const x = PAYMENT_METHODS[m.toUpperCase()];
  return x ? (sw ? x.sw : x.en) : m.replaceAll('_', ' ');
}

export interface SaleLine {
  uid: string;
  productUid: string;
  productName: string;
  category: string | null;
  saleType: string;
  /** How many of the sale-type unit (e.g. 2 × "Wholesale"). */
  packages: number;
  /** Stock pieces taken. */
  pieces: number;
  unitPrice: number;
  subTotal: number;
  profit: number | null;
  costPerPiece: number | null;
  margin: number | null;
  packageAbbreviation: string | null;
  priceOverridden: boolean;
}

export interface SalePayment {
  uid: string;
  method: string;
  amountPaid: number;
  date: string | null;
  reference: string | null;
  notes: string | null;
  receivedBy: string | null;
}

export interface Sale {
  uid: string;
  receiptNumber: string;
  saleDate: string | null;
  subtotal: number;
  discount: number;
  total: number;
  profit: number | null;
  notes: string | null;
  customerUid: string | null;
  customerName: string | null;
  customerPhone: string | null;
  seller: string | null;
  lines: SaleLine[];
  payments: SalePayment[];
  paid: number;
  balance: number;
  dueDate: string | null;
  hasReturn: boolean;
  returnStatus: string | null;
  returnUid: string | null;
  isFullReturn: boolean;
  returnedAmount: number;
  /** Lower-cased text used by the client-side search. */
  haystack: string;
}

/** GET /sales/analytics/dashboard-summary */
export interface SalesSummary {
  count: number;
  revenue: number;
  discount: number;
  paid: number;
  paidPct: number;
  pending: number;
  completed: number;
  allTimeOutstanding: number;
  allTimePending: number;
  windowOutstanding: number;
  lastActiveDate: string | null;
  hourlyRevenue: number[];
  hourlyOrders: number[];
}

/** GET /api/store/display/stock/available — one sellable product at the till. */
export interface PosProduct {
  uid: string;
  name: string;
  category: string | null;
  categoryUid: string | null;
  stock: number;
  piecesPerPackage: number | null;
  abbreviation: string | null;
  averageCost: number | null;
  /** Price and stock pieces per sale type (only types with a price are offered). */
  options: Array<{ type: SaleType; price: number; pieces: number }>;
  stockDisplay: string | null;
  search: string;
}

export interface StockIssue {
  productUid: string;
  productName: string;
  reason: string;
  available: number | null;
  saleType?: string | null;
}

/** Body of POST /sales/partial and /sales/pre-validate. */
export interface SaleRequest {
  saleDate: string;
  customerUid: string | null;
  customerName: string | null;
  customerPhoneNumber: string | null;
  userUid: string | null;
  userName: string | null;
  discountAmount: number;
  saleNotes: string | null;
  saleDetails: Array<{
    productUid: string;
    productName: string;
    productCategory: string | null;
    saleType: SaleType;
    pieceQuantity: number;
    packageQuantity: number;
    unitPrice: number;
    subTotal: number;
    overrideUnitPrice: number | null;
    costPerPiece: number | null;
    piecesPerPackage: number | null;
    packageAbbreviation: string | null;
  }>;
  payments: Array<{
    customerUid: string | null;
    customerName: string;
    paymentMethod: string;
    totalAmount: number;
    amountPaid: number;
    paymentDate: string;
    paymentNotes: string | null;
  }>;
}

export type ReturnStatus = 'PENDING' | 'APPROVED' | 'PROCESSED' | 'REJECTED' | 'PARTIALLY_PROCESSED' | 'CANCELLED' | 'COMPLETED';
export type ReturnType = 'FULL_RETURN' | 'PARTIAL_RETURN' | 'DAMAGED_RETURN' | 'EXCHANGE';

export const RETURN_STATUS: Record<string, { en: string; sw: string; color: string; icon: string }> = {
  PENDING: { en: 'Waiting for approval', sw: 'Inasubiri idhini', color: 'var(--c-warning)', icon: 'hourglass_top' },
  APPROVED: { en: 'Approved', sw: 'Imeidhinishwa', color: 'var(--c-success)', icon: 'verified' },
  PROCESSED: { en: 'Processed', sw: 'Imeshughulikiwa', color: 'var(--c-success)', icon: 'task_alt' },
  COMPLETED: { en: 'Completed', sw: 'Imekamilika', color: 'var(--c-success)', icon: 'done_all' },
  PARTIALLY_PROCESSED: { en: 'Partly processed', sw: 'Sehemu imeshughulikiwa', color: 'var(--c-info)', icon: 'pending' },
  REJECTED: { en: 'Rejected', sw: 'Imekataliwa', color: 'var(--c-error)', icon: 'cancel' },
  CANCELLED: { en: 'Cancelled', sw: 'Imefutwa', color: 'var(--c-text-2)', icon: 'block' },
};
export const RETURN_TYPES: Record<ReturnType, { en: string; sw: string; hint: { en: string; sw: string } }> = {
  FULL_RETURN: { en: 'Good condition', sw: 'Hali nzuri', hint: { en: 'Goes back into stock', sw: 'Inarudi stoo' } },
  PARTIAL_RETURN: { en: 'Some items', sw: 'Baadhi ya bidhaa', hint: { en: 'Only part of the sale', sw: 'Sehemu ya mauzo tu' } },
  DAMAGED_RETURN: { en: 'Damaged', sw: 'Zimeharibika', hint: { en: 'Cannot be resold', sw: 'Haziwezi kuuzwa tena' } },
  EXCHANGE: { en: 'Exchange', sw: 'Kubadilisha', hint: { en: 'Swap for another product', sw: 'Badilisha kwa bidhaa nyingine' } },
};

export interface SalesReturn {
  uid: string;
  reference: string;
  saleUid: string;
  receiptNumber: string | null;
  customerName: string | null;
  type: string;
  status: string;
  reason: string | null;
  comments: string | null;
  notes: string | null;
  rejectionReason: string | null;
  refund: number;
  value: number;
  pieces: number;
  requestedAt: string | null;
  approvedAt: string | null;
  rejectedAt: string | null;
  items: Array<{ uid: string; productName: string; category: string | null; pieces: number; soldPieces: number; display: string | null; unitPrice: number; refund: number; condition: string | null; toStock: boolean }>;
}

export interface ReturnCheck {
  valid: boolean;
  errors: string[];
  warnings: string[];
  daysFromSale: number | null;
  withinWindow: boolean;
  estimatedRefund: number | null;
}

type Raw = Record<string, unknown>;
const num = (v: unknown) => Number(v ?? 0) || 0;
const numOrNull = (v: unknown) => (v === null || v === undefined || v === '' ? null : Number(v));
const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);

export function normalizeLine(r: Raw): SaleLine {
  return {
    uid: String(r['uid'] ?? ''),
    productUid: String(r['productUid'] ?? ''),
    productName: String(r['productName'] ?? '').trim(),
    category: str(r['productCategory']),
    saleType: String(r['saleType'] ?? 'PIECES'),
    packages: num(r['packageQuantity']) || 1,
    pieces: num(r['pieceQuantity']),
    unitPrice: num(r['unitPrice']),
    subTotal: num(r['subTotal']),
    profit: numOrNull(r['profitAmount']),
    costPerPiece: numOrNull(r['costPerPiece']),
    margin: numOrNull(r['profitMargin']),
    packageAbbreviation: str(r['packageAbbreviation']),
    priceOverridden: r['overrideUnitPrice'] !== null && r['overrideUnitPrice'] !== undefined,
  };
}

export function normalizeSale(r: Raw): Sale {
  const lines = ((r['saleDetails'] as Raw[]) ?? []).map(normalizeLine);
  const payments: SalePayment[] = ((r['payments'] as Raw[]) ?? [])
    .filter((p) => p['isDeleted'] !== true)
    .map((p) => ({
      uid: String(p['uid'] ?? ''),
      method: String(p['paymentMethod'] ?? 'CASH'),
      amountPaid: num(p['amountPaid']),
      date: str(p['paymentDate']),
      reference: str(p['transactionReference']),
      notes: str(p['paymentNotes']),
      receivedBy: str(p['receivedByName']),
    }));
  const total = num(r['totalAmount']);
  // The sale-level totalPaidAmount / balanceDue are stale on many rows (a credit
  // sale can read "fully paid"); the payments themselves are the truth — as in
  // Flutter (`payments.totalReceived`) and the server's outstanding summary.
  const hasPayments = Array.isArray(r['payments']);
  const paid = hasPayments ? payments.reduce((n, p) => n + p.amountPaid, 0) : num(r['totalPaidAmount']);
  const balance = Math.max(0, hasPayments ? total - paid : num(r['balanceDue']));
  const customerName = str(r['customerName']);
  const sale: Sale = {
    uid: String(r['uid'] ?? ''),
    receiptNumber: String(r['receiptNumber'] ?? ''),
    saleDate: str(r['saleDate']),
    subtotal: num(r['subtotalAmount']),
    discount: num(r['discountAmount']),
    total,
    profit: numOrNull(r['totalProfit']),
    notes: str(r['saleNotes']),
    customerUid: str(r['customerUid']),
    customerName: customerName && !/^walk-in customer$/i.test(customerName) ? customerName : null,
    customerPhone: str(r['customerPhoneNumber']),
    seller: str(r['userName']),
    lines,
    payments,
    paid,
    balance: balance < 0.01 ? 0 : balance,
    dueDate: str(r['dueDate']),
    hasReturn: r['hasReturn'] === true,
    returnStatus: str(r['returnStatus']),
    returnUid: str(r['returnUid']),
    isFullReturn: r['isFullReturn'] === true,
    returnedAmount: num(r['returnedAmount']),
    haystack: '',
  };
  sale.haystack = [sale.receiptNumber, sale.customerName ?? '', sale.customerPhone ?? '', sale.seller ?? '', ...lines.map((l) => l.productName)].join(' ').toLowerCase();
  return sale;
}

export function normalizePosProduct(r: Raw): PosProduct {
  const ppp = numOrNull(r['piecesPerPackage']);
  const pieces = (type: SaleType): number => {
    switch (type) {
      case 'PIECES':
        return 1;
      case 'QUARTER_PACKAGE':
        return num(r['quarterPackageQuantity']) || (ppp ? Math.round(ppp / 4) : 1);
      case 'HALF_PACKAGE':
        return num(r['halfPackageQuantity']) || (ppp ? Math.round(ppp / 2) : 1);
      default:
        return num(r['wholePackageQuantity']) || ppp || 1;
    }
  };
  const priceKey: Record<SaleType, string> = { PIECES: 'pieceSalePrice', QUARTER_PACKAGE: 'quarterSalePrice', HALF_PACKAGE: 'halfSalePrice', WHOLE_PACKAGE: 'wholeSalePrice' };
  const options = SALE_TYPE_ORDER.filter((t) => numOrNull(r[priceKey[t]]) !== null && num(r[priceKey[t]]) > 0).map((t) => ({ type: t, price: num(r[priceKey[t]]), pieces: pieces(t) }));
  const name = String(r['formattedDisplayName'] ?? r['productName'] ?? '').trim();
  const category = str(r['category']);
  return {
    uid: String(r['productUid'] ?? r['uid'] ?? ''),
    name,
    category,
    categoryUid: str(r['categoryUid']),
    stock: num(r['currentStock']),
    piecesPerPackage: ppp,
    abbreviation: str(r['packageAbbreviation']),
    averageCost: numOrNull(r['averageCostPrice']),
    options,
    stockDisplay: str(r['stockDisplay']),
    search: `${name} ${category ?? ''}`.toLowerCase(),
  };
}

export function normalizeReturn(r: Raw): SalesReturn {
  return {
    uid: String(r['uid'] ?? ''),
    reference: String(r['returnReference'] ?? ''),
    saleUid: String(r['saleUid'] ?? ''),
    receiptNumber: str(r['receiptNumber']),
    customerName: str(r['customerName']),
    type: String(r['returnType'] ?? 'FULL_RETURN'),
    status: String(r['returnStatus'] ?? 'PENDING'),
    reason: str(r['returnReason']),
    comments: str(r['customerComments']),
    notes: str(r['returnNotes']),
    rejectionReason: str(r['rejectionReason']),
    refund: num(r['netRefundAmount'] ?? r['totalRefundAmount'] ?? r['refundAmount']),
    value: num(r['totalReturnValue']),
    pieces: num(r['totalItemsReturned']),
    requestedAt: str(r['requestedAt']) ?? str(r['returnDate']),
    approvedAt: str(r['approvedAt']),
    rejectedAt: str(r['rejectedAt']),
    items: ((r['returnItems'] as Raw[]) ?? []).map((i) => ({
      uid: String(i['uid'] ?? ''),
      productName: String(i['productName'] ?? ''),
      category: str(i['categoryName']),
      pieces: num(i['quantityReturned']),
      soldPieces: num(i['originalQuantitySold']),
      display: str(i['quantityReturnedDisplay']),
      unitPrice: num(i['unitPrice']),
      refund: num(i['refundAmount']),
      condition: str(i['itemCondition']),
      toStock: i['returnToStock'] !== false,
    })),
  };
}

export function normalizeSummary(d: Raw): SalesSummary {
  const arr = (v: unknown) => (Array.isArray(v) ? v.map((x) => Number(x) || 0) : new Array(24).fill(0));
  return {
    count: num(d['totalSalesCount']),
    revenue: num(d['totalRevenue']),
    discount: num(d['totalDiscount']),
    paid: num(d['totalPaid']),
    paidPct: num(d['paidPct']),
    pending: num(d['pendingSalesCount']),
    completed: num(d['completedSalesCount']),
    allTimeOutstanding: num(d['allTimeOutstandingAmount']),
    allTimePending: num(d['allTimePendingSalesCount']),
    windowOutstanding: num(d['windowedOutstandingAmount']),
    lastActiveDate: str(d['lastActiveSalesDate']),
    hourlyRevenue: arr(d['hourlyRevenue']),
    hourlyOrders: arr(d['hourlyOrderCount']),
  };
}

/** "2 × Wholesale (40 pcs)" / "3 pcs" */
export function lineQtyLabel(l: SaleLine, sw: boolean): string {
  const t = SALE_TYPES[l.saleType as SaleType];
  if (l.saleType === 'PIECES' || !t) return `${l.pieces} ${sw ? 'vip' : 'pcs'}`;
  return `${l.packages} × ${sw ? t.sw : t.en} (${l.pieces} ${sw ? 'vip' : 'pcs'})`;
}

/** Short receipt: RCP-20260820-872000-64EA → 872000-64EA */
export function shortReceipt(r: string): string {
  const m = /^RCP-\d{8}-(.+)$/.exec(r);
  return m ? m[1] : r;
}
