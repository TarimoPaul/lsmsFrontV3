/**
 * Asset register + asset counts (Spring `com.Lsms.Counting.Asset`).
 *
 * The register says how many of each asset the business owns: a quantity is
 * PROPOSED (ASSET_COUNT_MANAGE) and becomes official once the CEO confirms it
 * (ASSET_COUNT_APPROVE). A periodic count (COUNTING_PERFORM) is checked against
 * the official quantity only.
 *
 * Blind rule: while a count is IN_PROGRESS the backend leaves `expectedQty` /
 * `varianceQty` out of the JSON — UI code only ever null-checks them.
 */

export type AssetStatus = 'NEW' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'RETIRED';
export type AssetSessionStatus = 'IN_PROGRESS' | 'PENDING_APPROVAL' | 'APPROVED' | 'MATCHED' | 'CANCELLED';
export type AssetDecision = 'ACCEPT' | 'NO_ACTION' | 'CHARGE_STAFF';

export interface AssetItem {
  /** null = a Capital fixed asset that is not in the register yet (`status` NEW). */
  uid: string | null;
  name: string;
  location: string | null;
  capitalExpenditureUid: string | null;
  /** LINKED · DECLINED · null (nobody answered "add to Capital?" yet). */
  capitalDecision: string | null;
  capitalStatus: string | null;
  capitalCost: number | null;
  approvedQty: number | null;
  proposedQty: number | null;
  unitValue: number | null;
  status: AssetStatus;
  proposedByUid: string | null;
  proposedAt: string | null;
  approvedByUid: string | null;
  approvedAt: string | null;
  rejectReason: string | null;
  notes: string | null;
}

export interface AssetLine {
  uid: string;
  assetItemUid: string;
  assetName: string;
  location: string | null;
  countedQty: number | null;
  countedAt: string | null;
  // Sighted-only (absent while the count is in progress).
  expectedQty: number | null;
  varianceQty: number | null;
  unitValue: number | null;
  reason: string | null;
  note: string | null;
  explainedAt: string | null;
  decision: AssetDecision | null;
  decisionNote: string | null;
  chargeAmount: number | null;
  chargeUserUid: string | null;
}

export interface AssetSession {
  uid: string;
  sessionDate: string | null;
  status: AssetSessionStatus;
  startedByUid: string | null;
  startedAt: string | null;
  completedAt: string | null;
  approvedByUid: string | null;
  approvedAt: string | null;
  cancelledReason: string | null;
  totalItems: number;
  itemsCounted: number;
  itemsWithVariance: number | null;
  lines: AssetLine[];
}

export interface AssetStatusSummary {
  approvedItems: number;
  pendingItems: number;
  frequency: 'DAILY' | 'WEEKLY' | null;
  dayOfWeek: number | null;
  due: boolean;
  dueSince: string | null;
  lastCountDate: string | null;
  activeSessionUid: string | null;
  sessionsAwaitingApproval: number;
}

export interface AssetDecisionDraft {
  lineUid: string;
  decision: AssetDecision;
  note?: string | null;
  chargeAmount?: number | null;
  chargeUserUid?: string | null;
}

export const assetHasVariance = (l: AssetLine) => l.varianceQty != null && l.varianceQty !== 0;
/** A quantity is waiting for the CEO. */
export const assetIsPending = (i: AssetItem) => i.proposedQty != null && i.status !== 'REJECTED' && i.status !== 'RETIRED';

type Label = { en: string; sw: string };

export const ASSET_STATUS: Record<AssetStatus, Label & { color: string; icon: string }> = {
  NEW: { en: 'Not counted yet', sw: 'Haijajazwa', color: 'var(--c-text-2)', icon: 'edit_note' },
  PENDING: { en: 'Awaiting CEO', sw: 'Inasubiri CEO', color: 'var(--c-warning)', icon: 'hourglass_top' },
  APPROVED: { en: 'Confirmed', sw: 'Imethibitishwa', color: 'var(--c-success)', icon: 'verified' },
  REJECTED: { en: 'Rejected', sw: 'Imekataliwa', color: 'var(--c-error)', icon: 'block' },
  RETIRED: { en: 'Removed', sw: 'Imeondolewa', color: 'var(--c-text-2)', icon: 'delete_sweep' },
};

export const ASSET_SESSION_STATUS: Record<AssetSessionStatus, Label & { color: string; icon: string }> = {
  IN_PROGRESS: { en: 'In progress', sw: 'Inaendelea', color: 'var(--c-info)', icon: 'pending' },
  PENDING_APPROVAL: { en: 'Awaiting CEO decision', sw: 'Inasubiri uamuzi wa CEO', color: 'var(--c-warning)', icon: 'hourglass_top' },
  APPROVED: { en: 'Decided', sw: 'Imeamuliwa', color: 'var(--c-success)', icon: 'verified' },
  MATCHED: { en: 'All matched', sw: 'Zote zimelingana', color: 'var(--c-success)', icon: 'task_alt' },
  CANCELLED: { en: 'Cancelled', sw: 'Imefutwa', color: 'var(--c-text-2)', icon: 'block' },
};

/** Counter's explanation of a difference (backend `AssetCountService.REASONS`). */
export const ASSET_REASONS: Record<string, Label> = {
  IMEHARIBIKA: { en: 'Broken', sw: 'Imeharibika' },
  IMEPOTEA: { en: 'Missing', sw: 'Imepotea' },
  IMEHAMISHWA: { en: 'Moved elsewhere', sw: 'Imehamishwa' },
  IMEONGEZWA: { en: 'New one added', sw: 'Imeongezwa' },
  SIJUI: { en: "Don't know", sw: 'Sijui' },
  NYINGINE: { en: 'Other', sw: 'Nyingine' },
};

export const ASSET_DECISIONS: Record<AssetDecision, Label & { color: string; icon: string }> = {
  ACCEPT: { en: 'Accept new quantity', sw: 'Kubali idadi mpya', color: 'var(--c-warning)', icon: 'tune' },
  NO_ACTION: { en: 'No action', sw: 'Bila hatua', color: 'var(--c-text-2)', icon: 'do_not_disturb_on' },
  CHARGE_STAFF: { en: 'Charge staff', sw: 'Mtoze mfanyakazi', color: 'var(--c-error)', icon: 'person_alert' },
};

/** ISO-8601 day of week, 1 = Monday. */
export const WEEK_DAYS: Label[] = [
  { en: 'Monday', sw: 'Jumatatu' },
  { en: 'Tuesday', sw: 'Jumanne' },
  { en: 'Wednesday', sw: 'Jumatano' },
  { en: 'Thursday', sw: 'Alhamisi' },
  { en: 'Friday', sw: 'Ijumaa' },
  { en: 'Saturday', sw: 'Jumamosi' },
  { en: 'Sunday', sw: 'Jumapili' },
];

// ── Normalisers ──

type Raw = Record<string, unknown>;
const num = (v: unknown): number | null => (v === null || v === undefined || v === '' ? null : Number(v));
const str = (v: unknown): string | null => (v === null || v === undefined || v === '' ? null : String(v));

export function toAssetItem(r: Raw): AssetItem {
  return {
    uid: str(r['uid']),
    name: str(r['name']) ?? '—',
    location: str(r['location']),
    capitalExpenditureUid: str(r['capitalExpenditureUid']),
    capitalDecision: str(r['capitalDecision']),
    capitalStatus: str(r['capitalStatus']),
    capitalCost: num(r['capitalCost']),
    approvedQty: num(r['approvedQty']),
    proposedQty: num(r['proposedQty']),
    unitValue: num(r['unitValue']),
    status: (str(r['status']) ?? 'PENDING') as AssetStatus,
    proposedByUid: str(r['proposedByUid']),
    proposedAt: str(r['proposedAt']),
    approvedByUid: str(r['approvedByUid']),
    approvedAt: str(r['approvedAt']),
    rejectReason: str(r['rejectReason']),
    notes: str(r['notes']),
  };
}

export function toAssetLine(r: Raw): AssetLine {
  return {
    uid: String(r['uid']),
    assetItemUid: String(r['assetItemUid'] ?? ''),
    assetName: str(r['assetName']) ?? '—',
    location: str(r['location']),
    countedQty: num(r['countedQty']),
    countedAt: str(r['countedAt']),
    expectedQty: num(r['expectedQty']),
    varianceQty: num(r['varianceQty']),
    unitValue: num(r['unitValue']),
    reason: str(r['reason']),
    note: str(r['note']),
    explainedAt: str(r['explainedAt']),
    decision: str(r['decision']) as AssetDecision | null,
    decisionNote: str(r['decisionNote']),
    chargeAmount: num(r['chargeAmount']),
    chargeUserUid: str(r['chargeUserUid']),
  };
}

export function toAssetSession(r: Raw): AssetSession {
  return {
    uid: String(r['uid']),
    sessionDate: str(r['sessionDate']),
    status: (str(r['status']) ?? 'IN_PROGRESS') as AssetSessionStatus,
    startedByUid: str(r['startedByUid']),
    startedAt: str(r['startedAt']),
    completedAt: str(r['completedAt']),
    approvedByUid: str(r['approvedByUid']),
    approvedAt: str(r['approvedAt']),
    cancelledReason: str(r['cancelledReason']),
    totalItems: num(r['totalItems']) ?? 0,
    itemsCounted: num(r['itemsCounted']) ?? 0,
    itemsWithVariance: num(r['itemsWithVariance']),
    lines: ((r['lines'] as Raw[] | null) ?? []).map(toAssetLine),
  };
}

export function toAssetStatus(r: Raw): AssetStatusSummary {
  return {
    approvedItems: num(r['approvedItems']) ?? 0,
    pendingItems: num(r['pendingItems']) ?? 0,
    frequency: str(r['frequency']) as 'DAILY' | 'WEEKLY' | null,
    dayOfWeek: num(r['dayOfWeek']),
    due: !!r['due'],
    dueSince: str(r['dueSince']),
    lastCountDate: str(r['lastCountDate']),
    activeSessionUid: str(r['activeSessionUid']),
    sessionsAwaitingApproval: num(r['sessionsAwaitingApproval']) ?? 0,
  };
}
