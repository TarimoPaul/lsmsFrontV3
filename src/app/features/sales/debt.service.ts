import { Injectable, inject } from '@angular/core';

import { ApiService } from '@core/api/api.service';

export type DebtAdjustmentType = 'WRITE_OFF' | 'WAIVER' | 'CORRECTION';

export const DEBT_TYPES: Record<DebtAdjustmentType, { en: string; sw: string; hint: { en: string; sw: string }; permission: string }> = {
  WAIVER: { en: 'Waive', sw: 'Samehe', hint: { en: 'Forgive the customer', sw: 'Msamehe mteja' }, permission: 'DEBT_WRITE_OFF' },
  WRITE_OFF: { en: 'Write off', sw: 'Futa deni', hint: { en: 'Cannot be collected', sw: 'Haliwezi kukusanywa' }, permission: 'DEBT_WRITE_OFF' },
  CORRECTION: { en: 'Correction', sw: 'Rekebisha', hint: { en: 'Fix a wrong amount', sw: 'Rekebisha kiasi kilichokosewa' }, permission: 'DEBT_ADJUST_CREATE' },
};

export const DEBT_STATUS: Record<string, { en: string; sw: string; color: string }> = {
  PENDING: { en: 'Waiting for a checker', sw: 'Inasubiri mkaguzi', color: 'var(--c-warning)' },
  APPROVED: { en: 'Approved', sw: 'Imeidhinishwa', color: 'var(--c-success)' },
  REJECTED: { en: 'Rejected', sw: 'Imekataliwa', color: 'var(--c-error)' },
  CANCELLED: { en: 'Cancelled', sw: 'Imefutwa', color: 'var(--c-text-2)' },
};

export interface DebtAdjustment {
  uid: string;
  saleUid: string;
  receiptNumber: string | null;
  customerName: string | null;
  type: DebtAdjustmentType;
  amount: number;
  reason: string;
  outstandingAtRequest: number;
  isFullVoid: boolean;
  requiresChecker: boolean;
  status: string;
  requesterName: string | null;
  requesterUid: string | null;
  requestedAt: string | null;
  approverName: string | null;
  approvedAt: string | null;
  approvalReason: string | null;
  rejectionReason: string | null;
}

type Raw = Record<string, unknown>;
const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);

function normalize(r: Raw): DebtAdjustment {
  return {
    uid: String(r['uid'] ?? ''),
    saleUid: String(r['saleUid'] ?? ''),
    receiptNumber: str(r['saleReceiptNumber']),
    customerName: str(r['customerName']),
    type: String(r['type'] ?? 'CORRECTION') as DebtAdjustmentType,
    amount: Number(r['amount'] ?? 0) || 0,
    reason: String(r['reason'] ?? ''),
    outstandingAtRequest: Number(r['outstandingAtRequest'] ?? 0) || 0,
    isFullVoid: r['isFullVoid'] === true,
    requiresChecker: r['requiresChecker'] === true,
    status: String(r['status'] ?? 'PENDING'),
    requesterName: str(r['requesterName']),
    requesterUid: str(r['requesterUid']),
    requestedAt: str(r['requestedAt']),
    approverName: str(r['approverName']),
    approvedAt: str(r['approvedAt']),
    approvalReason: str(r['approvalReason']),
    rejectionReason: str(r['rejectionReason']),
  };
}

/**
 * Debt adjustments (Spring `DebtAdjustmentController`) — maker-checker
 * write-offs / waivers / corrections against a sale's balance. WAIVER and
 * WRITE_OFF need DEBT_WRITE_OFF and are approved at once; a CORRECTION
 * (DEBT_ADJUST_CREATE) above 100,000 (20,000 for a full void) waits for a
 * different DEBT_ADJUST_APPROVE holder. All post to the GL. The /report
 * endpoint always fails server-side, so lists come from /pending, /sale, /customer.
 */
@Injectable({ providedIn: 'root' })
export class DebtService {
  private readonly api = inject(ApiService);
  private readonly base = '/api/debt-adjustments';

  async create(saleUid: string, type: DebtAdjustmentType, amount: number, reason: string): Promise<DebtAdjustment> {
    return normalize(await this.api.post<Raw>(this.base, { saleUid, type, amount, reason }));
  }

  async approve(uid: string, approvalReason: string | null): Promise<DebtAdjustment> {
    return normalize(await this.api.post<Raw>(`${this.base}/${uid}/approve`, { approvalReason }));
  }

  async reject(uid: string, rejectionReason: string): Promise<DebtAdjustment> {
    return normalize(await this.api.post<Raw>(`${this.base}/${uid}/reject`, { rejectionReason }));
  }

  async cancel(uid: string): Promise<void> {
    await this.api.post(`${this.base}/${uid}/cancel`, {});
  }

  async pending(): Promise<DebtAdjustment[]> {
    return ((await this.api.get<Raw[] | null>(`${this.base}/pending`)) ?? []).map(normalize);
  }

  async bySale(saleUid: string): Promise<DebtAdjustment[]> {
    return ((await this.api.get<Raw[] | null>(`${this.base}/sale/${saleUid}`)) ?? []).map(normalize);
  }

  async byCustomer(customerUid: string): Promise<DebtAdjustment[]> {
    return ((await this.api.get<Raw[] | null>(`${this.base}/customer/${customerUid}`)) ?? []).map(normalize);
  }
}
