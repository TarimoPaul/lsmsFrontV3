import { Injectable, inject } from '@angular/core';

import { ApiService } from '@core/api/api.service';
import {
  SafeBoxCashierOutstanding,
  SafeBoxDeposit,
  SafeBoxDepositType,
  SafeBoxUnconfirmed,
  normalizeDeposit,
  normalizeOutstanding,
  normalizeUnconfirmed,
} from './recon-extra.models';

const BASE = '/api/v1/safe-box';
type Raw = Record<string, unknown>;

export interface DepositRequest {
  cashEntryUid: string | null;
  submittedAmount: number;
  depositType: SafeBoxDepositType;
  bankName?: string | null;
  receiptNumber?: string | null;
  recipientUid?: string | null;
}

/**
 * Safe Box accountability (Spring `SafeBoxController`) — port of Flutter
 * `SafeBoxService`. Money a cashier puts in the safe (a SAFE_BOX cash entry on
 * the day's reconciliation) must later be banked or handed to a manager: the
 * cashier submits deposits, a manager (SAFE_BOX_CONFIRM / RECONCILIATION_APPROVE)
 * confirms or rejects them. Never changes the day's formula.
 */
@Injectable({ providedIn: 'root' })
export class SafeBoxService {
  private readonly api = inject(ApiService);

  async myPending(): Promise<SafeBoxDeposit[]> {
    return ((await this.api.get<Raw[] | null>(`${BASE}/my-pending`)) ?? []).map(normalizeDeposit);
  }

  async recipients(): Promise<Array<{ uid: string; name: string }>> {
    const rows = (await this.api.get<Raw[] | null>(`${BASE}/eligible-recipients`).catch(() => null)) ?? [];
    return rows.map((r) => ({ uid: String(r['uid'] ?? ''), name: String(r['name'] ?? r['uid'] ?? '') }));
  }

  /** Every deposit made against one SAFE_BOX cash entry. */
  async entryHistory(cashEntryUid: string): Promise<SafeBoxDeposit[]> {
    return ((await this.api.get<Raw[] | null>(`${BASE}/entry/${cashEntryUid}/history`).catch(() => null)) ?? []).map(normalizeDeposit);
  }

  submit(body: DepositRequest): Promise<SafeBoxDeposit> {
    return this.api.post<Raw>(`${BASE}/deposit`, body).then(normalizeDeposit);
  }

  edit(depositUid: string, body: DepositRequest): Promise<SafeBoxDeposit> {
    return this.api.put<Raw>(`${BASE}/${depositUid}`, body).then(normalizeDeposit);
  }

  /** The cashier withdraws their own still-pending deposit. */
  async cancel(depositUid: string, reason: string): Promise<void> {
    await this.api.delete(`${BASE}/${depositUid}`, { params: { reason } });
  }

  // ── Manager ────────────────────────────────────────────────────────────────
  /** Pending deposits across the branch, flattened (server groups them by cashier). */
  async pendingForManager(): Promise<SafeBoxDeposit[]> {
    const d = (await this.api.get<Record<string, Raw[]> | null>(`${BASE}/pending`)) ?? {};
    return Object.values(d).flatMap((rows) => (rows ?? []).map(normalizeDeposit));
  }

  async confirm(depositUid: string): Promise<void> {
    await this.api.post(`${BASE}/${depositUid}/confirm`, {});
  }

  async reject(depositUid: string, reason: string): Promise<void> {
    await this.api.post(`${BASE}/${depositUid}/reject`, {}, { params: { reason } });
  }

  /** Safe-box money still not confirmed on approved days, per cashier. */
  async outstanding(): Promise<SafeBoxCashierOutstanding[]> {
    return ((await this.api.get<Raw[] | null>(`${BASE}/outstanding`)) ?? []).map(normalizeOutstanding);
  }

  /** Pre-approval warning for one reconciliation (informational — never blocks approval). */
  async unconfirmed(reconUid: string): Promise<SafeBoxUnconfirmed | null> {
    const d = await this.api.get<Raw>(`${BASE}/unconfirmed/${reconUid}`).catch(() => null);
    return d ? normalizeUnconfirmed(d) : null;
  }

  /** "Ask the cashier to bring it" — only writes an audit note (no notification is sent). */
  async requestDeposit(cashEntryUid: string, reconUid: string, cashierUid: string): Promise<void> {
    await this.api.post(`${BASE}/entry/${cashEntryUid}/request-deposit`, {}, { params: { reconUid, cashierUid } });
  }
}
