import { Injectable, inject, signal } from '@angular/core';

import { ApiService } from '@core/api/api.service';
import { AuthService } from '@core/auth/auth.service';

/** One delete / edit of a sale as the server recorded it (sale_change_audit, backend 2.4.0 A6). */
export interface SaleChange {
  id: number;
  at: string;
  action: 'DELETE' | 'UPDATE' | 'DETAIL_UPDATE' | 'DETAIL_REMOVE' | 'RESTORE';
  result: 'ALLOWED' | 'REFUSED';
  refuseCode: string | null;
  saleUid: string;
  receiptNumber: string | null;
  saleDate: string | null;
  amountBefore: number | null;
  amountAfter: number | null;
  payments: string | null;
  recoStatus: string | null;
  byName: string | null;
  byEmail: string | null;
  byIsCeo: boolean;
  reason: string | null;
  detail: string | null;
  /** MY "Nimeona" (each reviewer marks for themselves). */
  ackAt: string | null;
  ackNote: string | null;
  /** Everyone who has marked it: "Name: note; …". */
  seenBy: string | null;
  /** Receipt(s) of the new sale that made a deleted one again, or null. */
  remadeAs: string | null;
}

export interface SaleChangeSummary {
  allowed: number;
  refused: number;
  deleted: number;
  deletedAmount: number;
  changed: number;
  byUser: { name: string; count: number; deletedAmount: number }[];
  byReason: { reason: string; count: number }[];
}

type Raw = Record<string, unknown>;
const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));

function toChange(r: Raw): SaleChange {
  return {
    ...(r as unknown as SaleChange),
    id: Number(r['id']),
    amountBefore: num(r['amountBefore']),
    amountAfter: num(r['amountAfter']),
    byIsCeo: r['byIsCeo'] === true,
  };
}

/**
 * The CEO's view of deleted / edited sales (SALE_DELETE_REVIEW). `pending` feeds the banner shown after every
 * login until each change is marked "Nimeona" with a note.
 */
@Injectable({ providedIn: 'root' })
export class SaleChangesService {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);

  readonly pending = signal<{ count: number; amount: number; items: SaleChange[] }>({ count: 0, amount: 0, items: [] });

  get allowed(): boolean {
    return this.auth.hasPermission('SALE_DELETE_REVIEW');
  }

  async loadPending(): Promise<void> {
    if (!this.allowed) return;
    const d = await this.api.get<Raw>('/api/v1/sales/changes/pending');
    this.pending.set({
      count: Number(d['count'] ?? 0),
      amount: Number(d['amount'] ?? 0),
      items: ((d['items'] as Raw[]) ?? []).map(toChange),
    });
  }

  async list(params: { from?: string; to?: string; action?: string; result?: string; page?: number; size?: number }): Promise<{ items: SaleChange[]; total: number }> {
    const d = await this.api.get<Raw>('/api/v1/sales/changes', { params });
    return { items: ((d['items'] as Raw[]) ?? []).map(toChange), total: Number(d['total'] ?? 0) };
  }

  async summary(params: { from?: string; to?: string }): Promise<SaleChangeSummary> {
    const d = await this.api.get<Raw>('/api/v1/sales/changes/summary', { params });
    return {
      allowed: Number(d['allowed'] ?? 0),
      refused: Number(d['refused'] ?? 0),
      deleted: Number(d['deleted'] ?? 0),
      deletedAmount: Number(d['deleted_amount'] ?? 0),
      changed: Number(d['changed'] ?? 0),
      byUser: ((d['byUser'] as Raw[]) ?? []).map((u) => ({
        name: String(u['by_name'] ?? u['by_email'] ?? '—'),
        count: Number(u['count'] ?? 0),
        deletedAmount: Number(u['deleted_amount'] ?? 0),
      })),
      byReason: ((d['byReason'] as Raw[]) ?? []).map((x) => ({ reason: String(x['reason'] ?? ''), count: Number(x['count'] ?? 0) })),
    };
  }

  /** "Nimeona" with a note; rows already seen are skipped by the server. */
  async ack(ids: number[], note: string): Promise<number> {
    const d = await this.api.post<Raw>('/api/v1/sales/changes/ack', { ids, note });
    await this.loadPending();
    return Number(d['acked'] ?? 0);
  }
}
