import { Injectable, inject, signal } from '@angular/core';

import { ApiService } from '@core/api/api.service';
import {
  AssetDecisionDraft,
  AssetItem,
  AssetLine,
  AssetSession,
  AssetStatusSummary,
  toAssetItem,
  toAssetLine,
  toAssetSession,
  toAssetStatus,
} from './asset.models';

type Raw = Record<string, unknown>;
const BASE = '/api/v1/counting/assets';

export interface AssetItemInput {
  name?: string;
  location?: string;
  qty?: number;
  unitValue?: number;
  capitalExpenditureUid?: string;
  capitalDecision?: 'DECLINED';
}

/**
 * Asset register + asset count API (Spring `AssetCountController`). Backend
 * errors carry the Swahili sentence to show — callers display it as-is.
 * An asset count never pauses sales.
 */
@Injectable({ providedIn: 'root' })
export class AssetService {
  private readonly api = inject(ApiService);

  /** Shared by the tab header, the count view and the register (one request). */
  readonly status = signal<AssetStatusSummary | null>(null);

  async loadStatus(): Promise<AssetStatusSummary> {
    const s = toAssetStatus(await this.api.get<Raw>(`${BASE}/status`));
    this.status.set(s);
    return s;
  }

  /** DAILY · WEEKLY (needs `dayOfWeek` 1=Mon..7=Sun) · OFF. */
  async saveSchedule(frequency: 'DAILY' | 'WEEKLY' | 'OFF', dayOfWeek: number | null): Promise<AssetStatusSummary> {
    const s = toAssetStatus(await this.api.put<Raw>(`${BASE}/schedule`, { frequency, dayOfWeek }));
    this.status.set(s);
    return s;
  }

  // ── Register (ASSET_COUNT_MANAGE / ASSET_COUNT_APPROVE) ──

  /** Register rows, then Capital fixed assets nobody registered yet (`uid` null). */
  async register(): Promise<AssetItem[]> {
    return ((await this.api.get<Raw[] | null>(BASE)) ?? []).map(toAssetItem);
  }

  async create(body: AssetItemInput): Promise<AssetItem> {
    return toAssetItem(await this.api.post<Raw>(BASE, body));
  }

  /** A changed quantity becomes a proposal the CEO has to confirm again. */
  async update(uid: string, body: AssetItemInput): Promise<AssetItem> {
    return toAssetItem(await this.api.put<Raw>(`${BASE}/${uid}`, body));
  }

  /** Only a row that was never confirmed. */
  async remove(uid: string): Promise<void> {
    await this.api.delete(`${BASE}/${uid}`);
  }

  /** Returns the whole refreshed register. */
  async approveItems(uids: string[]): Promise<AssetItem[]> {
    return ((await this.api.post<Raw[] | null>(`${BASE}/approve`, { uids })) ?? []).map(toAssetItem);
  }

  async rejectItem(uid: string, reason: string): Promise<AssetItem> {
    return toAssetItem(await this.api.post<Raw>(`${BASE}/${uid}/reject`, { reason }));
  }

  /** Takes an asset out of future counts; its history stays. */
  async retireItem(uid: string, reason: string): Promise<AssetItem> {
    return toAssetItem(await this.api.post<Raw>(`${BASE}/${uid}/retire`, { reason }));
  }

  // ── Counts ──

  async start(): Promise<AssetSession> {
    return toAssetSession(await this.api.post<Raw>(`${BASE}/counts`, {}));
  }

  /** The branch's open count, else my own count still waiting for the CEO; null = nothing. */
  async active(): Promise<AssetSession | null> {
    const r = await this.api.get<Raw | null>(`${BASE}/counts/active`);
    return r ? toAssetSession(r) : null;
  }

  /** Summary rows only (no lines). */
  async list(status?: string): Promise<AssetSession[]> {
    return ((await this.api.get<Raw[] | null>(`${BASE}/counts`, { params: { status } })) ?? []).map(toAssetSession);
  }

  async session(uid: string): Promise<AssetSession> {
    return toAssetSession(await this.api.get<Raw>(`${BASE}/counts/${uid}`));
  }

  async submitLine(sessionUid: string, lineUid: string, countedQty: number): Promise<AssetLine> {
    return toAssetLine(await this.api.put<Raw>(`${BASE}/counts/${sessionUid}/lines/${lineUid}`, { countedQty }));
  }

  /** → MATCHED when nothing differs, else PENDING_APPROVAL. Lines come back sighted. */
  async complete(sessionUid: string): Promise<AssetSession> {
    return toAssetSession(await this.api.post<Raw>(`${BASE}/counts/${sessionUid}/complete`));
  }

  async explain(sessionUid: string, lineUid: string, reason: string, note: string | null): Promise<AssetLine> {
    const body = { reason, ...(note?.trim() ? { note: note.trim() } : {}) };
    return toAssetLine(await this.api.put<Raw>(`${BASE}/counts/${sessionUid}/lines/${lineUid}/explanation`, body));
  }

  async approve(sessionUid: string, decisions: AssetDecisionDraft[]): Promise<AssetSession> {
    const body = {
      decisions: decisions.map((d) => ({
        lineUid: d.lineUid,
        decision: d.decision,
        ...(d.note?.trim() ? { note: d.note.trim() } : {}),
        ...(d.decision === 'CHARGE_STAFF' ? { chargeAmount: d.chargeAmount, ...(d.chargeUserUid ? { chargeUserUid: d.chargeUserUid } : {}) } : {}),
      })),
    };
    return toAssetSession(await this.api.post<Raw>(`${BASE}/counts/${sessionUid}/approve`, body));
  }

  async cancel(sessionUid: string, reason: string): Promise<AssetSession> {
    return toAssetSession(await this.api.post<Raw>(`${BASE}/counts/${sessionUid}/cancel`, { reason }));
  }
}
