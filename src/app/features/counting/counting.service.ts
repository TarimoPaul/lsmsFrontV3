import { Injectable, inject } from '@angular/core';

import { ApiService } from '@core/api/api.service';
import { AuthService } from '@core/auth/auth.service';
import { CachedResource } from '@core/data/cached-resource';
import { UsersService } from '../users/users.service';
import {
  CountLine,
  CountSession,
  Liability,
  LiabilityItem,
  LiabilityPaymentType,
  LineDecisionDraft,
  RecountLine,
  toLiability,
  toLiabilityItem,
  toLine,
  toRecountLine,
  toSession,
} from './counting.models';

type Raw = Record<string, unknown>;
const BASE = '/api/v1/counting';
const LIAB = '/api/liabilities';

/**
 * Stock count + staff liability API (Spring `CountingController`,
 * `LiabilityController`). Backend errors already carry the exact Swahili
 * sentence to show, so callers display `ApiError.message` as-is.
 *
 * NB: an IN_PROGRESS / PENDING_RECOUNT session blocks sales and stock
 * movements for the whole branch (CountingGuardService).
 */
@Injectable({ providedIn: 'root' })
export class CountingService {
  private readonly api = inject(ApiService);
  private readonly users = inject(UsersService);
  private readonly auth = inject(AuthService);

  /**
   * uid → display name for "started by" / liability owners. Best effort: needs
   * USER_READ; without it rows fall back to "—" (Flutter showed raw uids).
   */
  readonly staff = new CachedResource<Map<string, string>>(async () => {
    if (!this.auth.hasPermission('USER_READ')) return new Map();
    const { users } = await this.users.list();
    return new Map(users.map((u) => [u.uid, `${u.firstName} ${u.lastName}`.trim() || u.email]));
  }, 10 * 60_000);

  staffName(uid: string | null | undefined): string | null {
    if (!uid) return null;
    if (uid === this.auth.user()?.uid) return this.auth.user()!.firstName + ' ' + this.auth.user()!.lastName;
    return this.staff.value()?.get(uid) ?? null;
  }

  // ── Sessions ──

  /** Blind vs sighted is decided server-side from the caller's COUNTING_SIGHTED. Response has no lines. */
  async start(): Promise<CountSession> {
    return toSession(await this.api.post<Raw>(`${BASE}/sessions`, {}));
  }

  /** Today's open session, or null ("nothing to resume" is a normal Success/null answer). */
  async active(): Promise<CountSession | null> {
    const r = await this.api.get<Raw | null>(`${BASE}/sessions/active`);
    return r ? toSession(r) : null;
  }

  async session(uid: string): Promise<CountSession> {
    return toSession(await this.api.get<Raw>(`${BASE}/sessions/${uid}`));
  }

  /** Summary rows only (no lines). `status` null = full history. */
  async list(status?: string): Promise<CountSession[]> {
    const rows = await this.api.get<Raw[] | null>(`${BASE}/sessions`, { params: { status } });
    return (rows ?? []).map(toSession);
  }

  /** Upserts one product's total piece count. */
  async submitLine(sessionUid: string, productUid: string, countedQty: number): Promise<CountLine> {
    return toLine(await this.api.put<Raw>(`${BASE}/sessions/${sessionUid}/lines`, { productUid, countedQty }));
  }

  /** Starter's own explanation of a variance line (PENDING_APPROVAL only). */
  async explain(sessionUid: string, lineUid: string, reason: string, note: string | null): Promise<CountLine> {
    const body = { reason, ...(note?.trim() ? { note: note.trim() } : {}) };
    return toLine(await this.api.put<Raw>(`${BASE}/sessions/${sessionUid}/lines/${lineUid}/explanation`, body));
  }

  /** IN_PROGRESS → PENDING_APPROVAL (or PENDING_RECOUNT for COUNTING_RECOUNT holders). No lines. */
  async complete(sessionUid: string): Promise<CountSession> {
    return toSession(await this.api.post<Raw>(`${BASE}/sessions/${sessionUid}/complete`));
  }

  /** The blind recount list (variance + random padding, fixed once per session). */
  async recountList(sessionUid: string): Promise<RecountLine[]> {
    const rows = await this.api.post<Raw[] | null>(`${BASE}/sessions/${sessionUid}/recount-list`);
    return (rows ?? []).map(toRecountLine);
  }

  /** Reason is required server-side only when the quantity changes. */
  async recount(sessionUid: string, lineUid: string, recountQty: number, reason: string | null): Promise<RecountLine> {
    const body = { recountQty, ...(reason?.trim() ? { recountReason: reason.trim() } : {}) };
    return toRecountLine(await this.api.put<Raw>(`${BASE}/sessions/${sessionUid}/lines/${lineUid}/recount`, body));
  }

  /** Ends the (single) recount round: PENDING_RECOUNT → PENDING_APPROVAL. */
  async completeRecount(sessionUid: string): Promise<CountSession> {
    return toSession(await this.api.post<Raw>(`${BASE}/sessions/${sessionUid}/complete-recount`));
  }

  async approve(sessionUid: string, decisions: LineDecisionDraft[]): Promise<CountSession> {
    const body = {
      decisions: decisions.map((d) => ({
        lineUid: d.lineUid,
        decision: d.decision,
        ...(d.reason ? { reason: d.reason } : {}),
        ...(d.notes?.trim() ? { notes: d.notes.trim() } : {}),
      })),
    };
    return toSession(await this.api.post<Raw>(`${BASE}/sessions/${sessionUid}/approve`, body));
  }

  async forceClose(sessionUid: string, reason: string): Promise<CountSession> {
    return toSession(await this.api.post<Raw>(`${BASE}/sessions/${sessionUid}/force-close`, { reason }));
  }

  /** All-time units sold per product NAME (the endpoint has no productUid) — sort order only. */
  async soldByName(): Promise<Map<string, number>> {
    const rows = await this.api.get<Raw[] | null>('/api/v1/sales/analytics/top-products/quantity', { params: { limit: 1000 } });
    const map = new Map<string, number>();
    for (const r of rows ?? []) {
      const name = String(r['productName'] ?? '').trim().toLowerCase();
      if (name) map.set(name, Number(r['quantitySold']) || 0);
    }
    return map;
  }

  // ── Staff liabilities ──

  async myLiabilities(): Promise<Liability[]> {
    return ((await this.api.get<Raw[] | null>(`${LIAB}/my`)) ?? []).map(toLiability);
  }

  /** LIABILITY_READ_ALL / LIABILITY_MANAGE. */
  async allLiabilities(): Promise<Liability[]> {
    return ((await this.api.get<Raw[] | null>(LIAB)) ?? []).map(toLiability);
  }

  /** Owner only (no ROOT bypass). Returns the updated item + the consent text recorded. */
  async acknowledge(itemUid: string): Promise<{ item: LiabilityItem; consentText: string }> {
    const r = await this.api.post<Raw>(`${LIAB}/items/${itemUid}/acknowledge`);
    return { item: toLiabilityItem(r['item'] as Raw), consentText: String(r['consentText'] ?? '') };
  }

  async dispute(itemUid: string, reason: string): Promise<LiabilityItem> {
    return toLiabilityItem(await this.api.post<Raw>(`${LIAB}/items/${itemUid}/dispute`, { reason }));
  }

  async recordPayment(
    uid: string,
    body: { amount: number; paymentType: LiabilityPaymentType; paidAt: string | null; notes: string | null },
  ): Promise<Liability> {
    const payload = {
      amount: body.amount,
      paymentType: body.paymentType,
      ...(body.paidAt ? { paidAt: body.paidAt } : {}),
      ...(body.notes?.trim() ? { notes: body.notes.trim() } : {}),
    };
    return toLiability(await this.api.post<Raw>(`${LIAB}/${uid}/payments`, payload));
  }

  /** Cancels a debt raised in error for a stock surplus (LIABILITY_MANAGE; no GL entry). */
  async voidSurplus(uid: string, reason: string): Promise<Liability> {
    return toLiability(await this.api.post<Raw>(`${LIAB}/${uid}/void-surplus`, { reason }));
  }

  /** `startMonth` = yyyy-MM-01; salary is only used server-side for the cap check. */
  async setDeductionPlan(
    uid: string,
    body: { monthlyDeduction: number; startMonth: string; salary: number; reason: string | null },
  ): Promise<Liability> {
    const payload = {
      monthlyDeduction: body.monthlyDeduction,
      startMonth: body.startMonth,
      salary: body.salary,
      ...(body.reason?.trim() ? { reason: body.reason.trim() } : {}),
    };
    return toLiability(await this.api.put<Raw>(`${LIAB}/${uid}/deduction-plan`, payload));
  }
}
