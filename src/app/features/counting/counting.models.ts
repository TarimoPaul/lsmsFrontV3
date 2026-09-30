/**
 * Stock count (Spring `com.Lsms.Counting`) — port of Flutter
 * `modules/counting/counting_dto.dart`, `counting_enums.dart`,
 * `liability_dto.dart`.
 *
 * Blind-count rule: the sighted-only fields (system qty, cost, variance,
 * explanations, recount) are ABSENT from the JSON for a caller who may not
 * see them — the backend decides. UI code only ever null-checks them.
 */

export type SessionStatus = 'IN_PROGRESS' | 'PENDING_RECOUNT' | 'PENDING_APPROVAL' | 'APPROVED' | 'FORCE_CLOSED';
export type CountMode = 'BLIND' | 'SIGHTED';
export type LineDecision = 'ADJUST' | 'NO_ACTION' | 'CHARGE_TO_CASHIER';

export interface CountLine {
  uid: string;
  productUid: string;
  productName: string;
  piecesPerPackage: number | null;
  packageAbbreviation: string | null;
  /** 3× the highest past count of this product (typo guard); null = no history. */
  typoThreshold: number | null;
  countedQty: number | null;
  countedAt: string | null;
  postCountMovementFlag: boolean;
  postCountMovementNote: string | null;
  // Sighted-only.
  systemQtySnapshot: number | null;
  unitCostSnapshot: number | null;
  varianceQty: number | null;
  varianceValue: number | null;
  cashierReason: string | null;
  cashierNote: string | null;
  explainedAt: string | null;
  firstCountQty: number | null;
  recountQty: number | null;
  recountReason: string | null;
}

/** Blind recount entry — structurally cannot leak variance / padding membership. */
export interface RecountLine {
  uid: string;
  productUid: string;
  productName: string;
  piecesPerPackage: number | null;
  packageAbbreviation: string | null;
  firstCountQty: number | null;
}

export interface CountSession {
  uid: string;
  branchUid: string | null;
  sessionDate: string | null;
  status: SessionStatus;
  countMode: CountMode | null;
  startedByUid: string | null;
  startedAt: string | null;
  completedAt: string | null;
  approvedByUid: string | null;
  approvedAt: string | null;
  forceClosedByUid: string | null;
  forceClosedAt: string | null;
  forceClosedReason: string | null;
  totalItems: number;
  itemsCounted: number;
  itemsWithVariance: number | null;
  totalVarianceValue: number | null;
  lines: CountLine[];
}

export interface LineDecisionDraft {
  lineUid: string;
  decision: LineDecision;
  reason?: string | null;
  notes?: string | null;
}

export const hasVariance = (l: CountLine) => l.varianceQty != null && l.varianceQty !== 0;

// ── Labels ──

type Label = { en: string; sw: string };

export const SESSION_STATUS: Record<SessionStatus, Label & { color: string; icon: string }> = {
  IN_PROGRESS: { en: 'In progress', sw: 'Inaendelea', color: 'var(--c-info)', icon: 'pending' },
  PENDING_RECOUNT: { en: 'Awaiting recount', sw: 'Inasubiri kuhesabiwa tena', color: 'var(--c-secondary)', icon: 'replay' },
  PENDING_APPROVAL: { en: 'Awaiting approval', sw: 'Inasubiri uthibitisho', color: 'var(--c-warning)', icon: 'hourglass_top' },
  APPROVED: { en: 'Approved', sw: 'Imethibitishwa', color: 'var(--c-success)', icon: 'verified' },
  FORCE_CLOSED: { en: 'Force-closed', sw: 'Imefungwa kwa nguvu', color: 'var(--c-error)', icon: 'block' },
};

/** Approver's reason for ADJUST / CHARGE_TO_CASHIER (backend `AdjustmentReason`). */
export const ADJUSTMENT_REASONS: Record<string, Label> = {
  DAMAGED: { en: 'Damaged', sw: 'Imeharibika' },
  EXPIRED: { en: 'Expired', sw: 'Imeisha muda' },
  THEFT_SUSPECTED: { en: 'Theft suspected', sw: 'Inashukiwa kuibiwa' },
  COUNTING_ERROR: { en: 'Counting error', sw: 'Kosa la kuhesabu' },
  OFF_SYSTEM_SALE: { en: 'Sold outside the system', sw: 'Mauzo nje ya mfumo' },
  UNRECORDED_DELIVERY: { en: 'Unrecorded delivery', sw: 'Bidhaa zilizoletwa bila kuandikwa' },
  UNKNOWN: { en: 'Unknown', sw: 'Haijulikani' },
};
/** Only these may justify charging a cashier (Flutter Phase 6c-2 UI filter). */
export const CHARGE_REASONS = ['THEFT_SUSPECTED', 'UNKNOWN', 'OFF_SYSTEM_SALE'];

/** Counter's own explanation of a variance line (DB CHECK constraint). */
export const CASHIER_REASONS: Record<string, Label> = {
  ZIMEHARIBIKA: { en: 'Damaged', sw: 'Zimeharibika' },
  ZIMEIBIWA: { en: 'Stolen', sw: 'Zimeibiwa' },
  SIJUI: { en: "Don't know", sw: 'Sijui' },
  NYINGINE: { en: 'Other', sw: 'Nyingine' },
};

export const DECISIONS: Record<LineDecision, Label & { color: string; icon: string }> = {
  ADJUST: { en: 'Adjust stock', sw: 'Marekebisho', color: 'var(--c-warning)', icon: 'tune' },
  NO_ACTION: { en: 'No action', sw: 'Bila hatua', color: 'var(--c-text-2)', icon: 'do_not_disturb_on' },
  CHARGE_TO_CASHIER: { en: 'Charge staff', sw: 'Mtoze mfanyakazi', color: 'var(--c-error)', icon: 'person_alert' },
};

// ── Quantities (PKG + PCS) ──

/** `31` with 24/pkg → `1 ctn, 7 pcs` (display only). */
export function formatQty(qty: number | null | undefined, ppp: number | null, unit: string | null): string {
  if (qty == null) return '—';
  const per = ppp ?? 1;
  if (per <= 1) return `${qty} pcs`;
  const whole = Math.floor(qty / per);
  const rem = qty % per;
  const u = unit || 'pkg';
  if (whole === 0) return `${rem} pcs`;
  return rem === 0 ? `${whole} ${u}` : `${whole} ${u}, ${rem} pcs`;
}

export function formatVariance(v: number | null | undefined, ppp: number | null, unit: string | null): string {
  if (v == null) return '—';
  const sign = v > 0 ? '+' : v < 0 ? '−' : '';
  return sign + formatQty(Math.abs(v), ppp, unit);
}

// ── Staff liabilities ──

export type LiabilityStatus = 'OPEN' | 'PARTIALLY_PAID' | 'SETTLED' | 'WAIVED';
export type LiabilityPaymentType = 'PAYROLL_DEDUCTION' | 'CASH' | 'WAIVER_PARTIAL';

export const LIABILITY_STATUS: Record<LiabilityStatus, Label & { color: string }> = {
  OPEN: { en: 'Open', sw: 'Wazi', color: 'var(--c-warning)' },
  PARTIALLY_PAID: { en: 'Partly paid', sw: 'Sehemu imelipwa', color: 'var(--c-info)' },
  SETTLED: { en: 'Settled', sw: 'Imekamilika', color: 'var(--c-success)' },
  WAIVED: { en: 'Waived', sw: 'Imesamehewa', color: 'var(--c-text-2)' },
};

export const PAYMENT_TYPES: Record<LiabilityPaymentType, Label & { icon: string }> = {
  CASH: { en: 'Cash', sw: 'Fedha taslimu', icon: 'payments' },
  PAYROLL_DEDUCTION: { en: 'Payroll deduction', sw: 'Kato la mshahara', icon: 'badge' },
  WAIVER_PARTIAL: { en: 'Partial waiver', sw: 'Msamaha (sehemu)', icon: 'volunteer_activism' },
};

export interface LiabilityItem {
  uid: string;
  productUid: string;
  productName: string;
  expectedQty: number | null;
  countedQty: number | null;
  varianceQty: number | null;
  unitCostUsed: number | null;
  lineAmount: number;
  cashierReason: string | null;
  cashierNote: string | null;
  acknowledgedAt: string | null;
  disputed: boolean;
  disputeReason: string | null;
  approverNote: string | null;
  /** Live consent sentence the backend would record now (null once acknowledged). */
  consentText: string | null;
  /** Frozen sentence actually agreed to. */
  consentTextUsed: string | null;
}

export interface LiabilityPayment {
  paidAt: string | null;
  amount: number;
  paymentType: string | null;
  recordedBy: string | null;
  notes: string | null;
}

export interface Liability {
  uid: string;
  userUid: string;
  sessionUid: string | null;
  sessionDate: string | null;
  createdAt: string | null;
  amount: number;
  /** amount − payments (server-derived) — the prominent number. */
  balance: number;
  status: LiabilityStatus | string | null;
  monthlyDeduction: number | null;
  deductionStartMonth: string | null;
  deductionMonthsRemaining: number | null;
  deductionFinalPartialAmount: number | null;
  items: LiabilityItem[];
  payments: LiabilityPayment[];
}

export const isPendingItem = (i: LiabilityItem) => !i.acknowledgedAt && !i.disputed;
/** Line charged for a stock SURPLUS (counted more than expected) — never a real loss. */
export const isSurplusItem = (i: LiabilityItem) => (i.varianceQty ?? 0) > 0;
/** Day a liability belongs to (sessionDate is often null server-side → createdAt). */
export const liabilityDay = (l: Liability) => (l.sessionDate ?? l.createdAt ?? '').slice(0, 10);

// ── Normalisers ──

type Raw = Record<string, unknown>;
const num = (v: unknown): number | null => (v === null || v === undefined || v === '' ? null : Number(v));
const str = (v: unknown): string | null => (v === null || v === undefined || v === '' ? null : String(v));

export function toLine(r: Raw): CountLine {
  return {
    uid: String(r['uid']),
    productUid: String(r['productUid'] ?? ''),
    productName: str(r['productName']) ?? String(r['productUid'] ?? ''),
    piecesPerPackage: num(r['piecesPerPackage']),
    packageAbbreviation: str(r['packageAbbreviation']),
    typoThreshold: num(r['typoThreshold']),
    countedQty: num(r['countedQty']),
    countedAt: str(r['countedAt']),
    postCountMovementFlag: !!r['postCountMovementFlag'],
    postCountMovementNote: str(r['postCountMovementNote']),
    systemQtySnapshot: num(r['systemQtySnapshot']),
    unitCostSnapshot: num(r['unitCostSnapshot']),
    varianceQty: num(r['varianceQty']),
    varianceValue: num(r['varianceValue']),
    cashierReason: str(r['cashierReason']),
    cashierNote: str(r['cashierNote']),
    explainedAt: str(r['explainedAt']),
    firstCountQty: num(r['firstCountQty']),
    recountQty: num(r['recountQty']),
    recountReason: str(r['recountReason']),
  };
}

export function toRecountLine(r: Raw): RecountLine {
  return {
    uid: String(r['uid']),
    productUid: String(r['productUid'] ?? ''),
    productName: str(r['productName']) ?? String(r['productUid'] ?? ''),
    piecesPerPackage: num(r['piecesPerPackage']),
    packageAbbreviation: str(r['packageAbbreviation']),
    firstCountQty: num(r['firstCountQty']),
  };
}

export function toSession(r: Raw): CountSession {
  return {
    uid: String(r['uid']),
    branchUid: str(r['branchUid']),
    sessionDate: str(r['sessionDate']),
    status: (str(r['status']) ?? 'IN_PROGRESS') as SessionStatus,
    countMode: str(r['countMode']) as CountMode | null,
    startedByUid: str(r['startedByUid']),
    startedAt: str(r['startedAt']),
    completedAt: str(r['completedAt']),
    approvedByUid: str(r['approvedByUid']),
    approvedAt: str(r['approvedAt']),
    forceClosedByUid: str(r['forceClosedByUid']),
    forceClosedAt: str(r['forceClosedAt']),
    forceClosedReason: str(r['forceClosedReason']),
    totalItems: num(r['totalItems']) ?? 0,
    itemsCounted: num(r['itemsCounted']) ?? 0,
    itemsWithVariance: num(r['itemsWithVariance']),
    totalVarianceValue: num(r['totalVarianceValue']),
    lines: ((r['lines'] as Raw[] | null) ?? []).map(toLine),
  };
}

export function toLiabilityItem(r: Raw): LiabilityItem {
  return {
    uid: String(r['uid']),
    productUid: String(r['productUid'] ?? ''),
    productName: str(r['productName']) ?? String(r['productUid'] ?? ''),
    expectedQty: num(r['expectedQty']),
    countedQty: num(r['countedQty']),
    varianceQty: num(r['varianceQty']),
    unitCostUsed: num(r['unitCostUsed']),
    lineAmount: num(r['lineAmount']) ?? 0,
    cashierReason: str(r['cashierReason']),
    cashierNote: str(r['cashierNote']),
    acknowledgedAt: str(r['acknowledgedAt']),
    disputed: !!r['disputed'],
    disputeReason: str(r['disputeReason']),
    approverNote: str(r['approverNote']),
    consentText: str(r['consentText']),
    consentTextUsed: str(r['consentTextUsed']),
  };
}

export function toLiability(r: Raw): Liability {
  return {
    uid: String(r['uid']),
    userUid: String(r['userUid'] ?? ''),
    sessionUid: str(r['sessionUid']),
    sessionDate: str(r['sessionDate']),
    createdAt: str(r['createdAt']),
    amount: num(r['amount']) ?? 0,
    balance: num(r['balance']) ?? 0,
    status: str(r['status']),
    monthlyDeduction: num(r['monthlyDeduction']),
    deductionStartMonth: str(r['deductionStartMonth']),
    deductionMonthsRemaining: num(r['deductionMonthsRemaining']),
    deductionFinalPartialAmount: num(r['deductionFinalPartialAmount']),
    items: ((r['items'] as Raw[] | null) ?? []).map(toLiabilityItem),
    payments: ((r['payments'] as Raw[] | null) ?? []).map((p) => ({
      paidAt: str(p['paidAt']),
      amount: num(p['amount']) ?? 0,
      paymentType: str(p['paymentType']),
      recordedBy: str(p['recordedBy']),
      notes: str(p['notes']),
    })),
  };
}
