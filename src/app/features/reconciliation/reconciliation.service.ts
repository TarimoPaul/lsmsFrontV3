import { Injectable, inject } from '@angular/core';

import { ApiService } from '@core/api/api.service';
import { ApiError } from '@core/api/api.types';
import {
  AuditEntry,
  CollectionHistoryItem,
  DebtSummary,
  ReconSnapshot,
  RetailDebtRequest,
  VarianceReport,
  normalizeAudit,
  normalizeCollection,
  normalizeDebtSummary,
  normalizeSnapshot,
  normalizeVarianceReport,
} from './recon-extra.models';
import { AutoSummary, Recon, VerifyType, normalizeAutoSummary, normalizeRecon } from './reconciliation.models';

const BASE = '/api/v1/reconciliation';
type Raw = Record<string, unknown>;

/** A workflow call's outcome: the fresh record, or the server's error (+ code, e.g. ZERO_CASH_DECLARATION). */
export interface ReconResult {
  recon: Recon | null;
  error: string | null;
  code: string | null;
}

/**
 * Daily reconciliation API (Spring `DailyReconciliationController`). Every
 * mutation returns the whole updated record, so callers just swap it in.
 * Workflow: DRAFT/REOPENED (editable) → SUBMITTED → REVIEWED → APPROVED;
 * APPROVED can be REOPENED.
 */
@Injectable({ providedIn: 'root' })
export class ReconciliationService {
  private readonly api = inject(ApiService);

  async autoSummary(date: string): Promise<AutoSummary | null> {
    const env = await this.api.getEnvelope<Raw>(`${BASE}/auto-summary/${date}`).catch(() => null);
    return env?.data ? normalizeAutoSummary(env.data) : null;
  }

  /** The caller's own record for the day (null when none exists yet). */
  async mine(date: string): Promise<Recon | null> {
    const env = await this.api.getEnvelope<Raw>(`${BASE}/mine/date/${date}`);
    return env.data ? normalizeRecon(env.data) : null;
  }

  async team(date: string): Promise<Recon[]> {
    const rows = await this.api.get<Raw[] | null>(`${BASE}/team/date/${date}`, { params: { size: 100 } });
    return (rows ?? []).map(normalizeRecon);
  }

  async byUid(uid: string): Promise<Recon> {
    return normalizeRecon(await this.api.get<Raw>(`${BASE}/${uid}`));
  }

  /** Re-runs the auto-populate steps (debt collections, POS debts) for an editable record. */
  async refresh(uid: string): Promise<Recon> {
    return normalizeRecon(await this.api.post<Raw>(`${BASE}/${uid}/refresh`, {}));
  }

  /** Creates the caller's record for `date` (or returns the existing one). */
  async create(date: string): Promise<Recon> {
    return normalizeRecon(await this.api.post<Raw>(BASE, { reconciliationDate: date }));
  }

  async pendingApproval(): Promise<Recon[]> {
    return ((await this.api.get<Raw[] | null>(`${BASE}/pending-approval`)) ?? []).map(normalizeRecon);
  }

  async myUnclosed(): Promise<Array<{ uid: string; date: string; status: string }>> {
    const rows = (await this.api.get<Raw[] | null>(`${BASE}/mine/unclosed`).catch(() => null)) ?? [];
    return rows.map((r) => ({ uid: String(r['uid'] ?? ''), date: String(r['reconciliationDate'] ?? ''), status: String(r['status'] ?? '') }));
  }

  // ── Entries (each returns the updated record) ──────────────────────────────
  addCash(uid: string, body: { entryType: string; amount: number; bankName?: string | null; depositReference?: string | null; notes?: string | null }): Promise<ReconResult> {
    return this.run(() => this.api.postResult<Raw>(`${BASE}/${uid}/cash-entry`, body));
  }
  removeCash(uid: string, entryUid: string): Promise<ReconResult> {
    return this.run(() => this.api.deleteResult<Raw>(`${BASE}/${uid}/cash-entry/${entryUid}`));
  }
  addMobile(uid: string, body: { provider: string; amount: number; transactionReference?: string | null; notes?: string | null }): Promise<ReconResult> {
    return this.run(() => this.api.postResult<Raw>(`${BASE}/${uid}/mobile-entry`, body));
  }
  removeMobile(uid: string, entryUid: string): Promise<ReconResult> {
    return this.run(() => this.api.deleteResult<Raw>(`${BASE}/${uid}/mobile-entry/${entryUid}`));
  }
  addExpense(uid: string, body: { expenseType: string; description: string; amount: number; receiptReference?: string | null; notes?: string | null }): Promise<ReconResult> {
    return this.run(() => this.api.postResult<Raw>(`${BASE}/${uid}/expense`, body));
  }
  removeExpense(uid: string, expenseUid: string): Promise<ReconResult> {
    return this.run(() => this.api.deleteResult<Raw>(`${BASE}/${uid}/expense/${expenseUid}`));
  }

  // ── Debts (walk-in debts recorded in reconciliation + the debt register) ────
  /** Debt register for a sale-date window (0-based page). Scoped server-side to what the caller may see. */
  async debts(p: { fromDate: string; toDate: string; search?: string; status?: string; page: number; size?: number }): Promise<DebtSummary> {
    const d = await this.api.get<Raw>(`${BASE}/debts`, {
      params: { fromDate: p.fromDate, toDate: p.toDate, search: p.search || undefined, paymentStatus: p.status || undefined, page: p.page, size: p.size ?? 20 },
    });
    return normalizeDebtSummary(d ?? {});
  }
  addRetailDebt(uid: string, body: RetailDebtRequest): Promise<ReconResult> {
    return this.run(() => this.api.postResult<Raw>(`${BASE}/${uid}/retail-debt`, body));
  }
  /** Edit a walk-in debt by its (plumbing) sale uid. */
  updateManualDebt(saleUid: string, body: RetailDebtRequest): Promise<ReconResult> {
    return this.run(() => this.api.putResult<Raw>(`${BASE}/manual-debt/${saleUid}`, body));
  }
  /** Voids the walk-in debt's sale for good — the reason is required and audited. */
  deleteManualDebt(saleUid: string, reason: string): Promise<ReconResult> {
    return this.run(() => this.api.deleteResult<Raw>(`${BASE}/manual-debt/${saleUid}`, { params: { reason } }));
  }

  // ── Purchases paid from the day's cash ─────────────────────────────────────
  addPurchase(uid: string, body: { supplierName?: string | null; description?: string | null; amount: number; invoiceReference?: string | null; purchaseUid?: string | null }): Promise<ReconResult> {
    return this.run(() => this.api.postResult<Raw>(`${BASE}/${uid}/purchase`, body));
  }
  removePurchase(uid: string, purchaseUid: string): Promise<ReconResult> {
    return this.run(() => this.api.deleteResult<Raw>(`${BASE}/${uid}/purchase/${purchaseUid}`));
  }
  /** Which of these purchases are already linked to some reconciliation. */
  async purchaseLinkStatus(purchaseUids: string[]): Promise<Set<string>> {
    if (!purchaseUids.length) return new Set();
    const rows = await this.api.get<string[] | null>(`${BASE}/purchase-link-status`, { params: { purchaseUids: purchaseUids.join(',') } }).catch(() => null);
    return new Set(rows ?? []);
  }

  // ── Debt collections history ───────────────────────────────────────────────
  async collectionsHistory(userUid: string, days = 30): Promise<CollectionHistoryItem[]> {
    const rows = await this.api.get<Raw[] | null>(`${BASE}/debt-collections`, { params: { days, userUid } });
    return (rows ?? []).map(normalizeCollection);
  }
  /** Read-only: debts this seller sold that somebody else collected. */
  async crossCollected(userUid: string, days = 30): Promise<CollectionHistoryItem[]> {
    const rows = await this.api.get<Raw[] | null>(`${BASE}/debt-collections/cross-collected`, { params: { days, userUid } }).catch(() => null);
    return (rows ?? []).map(normalizeCollection);
  }

  // ── Approval extras ────────────────────────────────────────────────────────
  async snapshot(uid: string): Promise<ReconSnapshot | null> {
    const env = await this.api.getEnvelope<Raw>(`${BASE}/${uid}/snapshot`).catch(() => null);
    return env?.data ? normalizeSnapshot(env.data) : null;
  }
  async auditLog(uid: string): Promise<AuditEntry[]> {
    const rows = await this.api.get<Raw[] | null>(`${BASE}/${uid}/audit-log`).catch(() => null);
    return (rows ?? []).map(normalizeAudit).sort((a, b) => (b.at ?? '').localeCompare(a.at ?? ''));
  }
  async varianceReport(fromDate: string, toDate: string): Promise<VarianceReport> {
    return normalizeVarianceReport((await this.api.get<Raw>(`${BASE}/variance-report`, { params: { fromDate, toDate } })) ?? {});
  }
  /** Material-variance threshold lives on the main business settings (PUT sends the whole record back). */
  async setVarianceThreshold(value: number): Promise<void> {
    const main = (await this.api.get<Raw>('/api/v1/business-settings/main')) ?? {};
    await this.api.put('/api/v1/business-settings/main', { ...main, varianceThreshold: value });
  }

  // ── Workflow ────────────────────────────────────────────────────────────────
  submit(uid: string, zeroCashReason?: string): Promise<ReconResult> {
    return this.run(() => this.api.postResult<Raw>(`${BASE}/${uid}/submit`, {}, { params: { zeroCashReason: zeroCashReason || undefined } }));
  }
  unsubmit(uid: string, reason: string): Promise<ReconResult> {
    return this.run(() => this.api.postResult<Raw>(`${BASE}/${uid}/unsubmit`, { reason }));
  }
  review(uid: string, notes?: string, zeroCashReason?: string): Promise<ReconResult> {
    return this.run(() => this.api.postResult<Raw>(`${BASE}/${uid}/review`, {}, { params: { notes: notes || undefined, zeroCashReason: zeroCashReason || undefined } }));
  }
  approve(uid: string, notes?: string): Promise<ReconResult> {
    return this.run(() => this.api.postResult<Raw>(`${BASE}/${uid}/approve`, {}, { params: { notes: notes || undefined } }));
  }
  reopen(uid: string, reason: string): Promise<ReconResult> {
    return this.run(() => this.api.postResult<Raw>(`${BASE}/${uid}/reopen`, {}, { params: { reason } }));
  }
  verify(uid: string, itemType: VerifyType, itemUid: string, verify: boolean, reason?: string): Promise<ReconResult> {
    return this.run(() => this.api.postResult<Raw>(`${BASE}/${uid}/verify-item`, {}, { params: { itemType, itemUid, verify, reason: reason || undefined } }));
  }
  explain(uid: string, explanation: string, shortageReason?: string | null): Promise<ReconResult> {
    return this.run(() => this.api.putResult<Raw>(`${BASE}/${uid}/variance-explanation`, {}, { params: { explanation, shortageReason: shortageReason || undefined } }));
  }

  /** Normalises success / API error (keeps the backend errorCode for the zero-cash & stale-collections guards). */
  private async run(call: () => Promise<{ data: Raw }>): Promise<ReconResult> {
    try {
      const res = await call();
      return { recon: res.data ? normalizeRecon(res.data) : null, error: null, code: null };
    } catch (e) {
      const err = ApiError.from(e);
      return { recon: null, error: err.message, code: err.errorCode };
    }
  }
}
