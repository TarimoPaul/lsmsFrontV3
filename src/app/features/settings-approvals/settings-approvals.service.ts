import { Injectable, computed, inject } from '@angular/core';

import { ApiService } from '@core/api/api.service';
import { AuthService } from '@core/auth/auth.service';
import { CachedResource } from '@core/data/cached-resource';
import { BusinessSettingsUpdate } from '../business-settings/business-settings.models';
import { BusinessSettingsService } from '../business-settings/business-settings.service';

const BASE = '/api/v1/settings-approvals';
type Raw = Record<string, unknown>;
const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);

export type ApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED' | 'EXPIRED';

/** One requested change of the main business settings (maker-checker). */
export interface SettingsRequest {
  uid: string;
  status: ApprovalStatus;
  /** Only the fields being changed. */
  before: Partial<BusinessSettingsUpdate>;
  after: Partial<BusinessSettingsUpdate>;
  description: string | null;
  reason: string | null;
  requesterUid: string | null;
  requesterName: string | null;
  requestedAt: string | null;
  approverName: string | null;
  approvalNote: string | null;
  decidedAt: string | null;
  rejectionReason: string | null;
  expiresAt: string | null;
  expired: boolean;
}

function parse(v: unknown): Record<string, unknown> {
  try {
    const o = typeof v === 'string' ? JSON.parse(v) : v;
    return o && typeof o === 'object' ? (o as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function normalize(r: Raw): SettingsRequest {
  const expired = r['isExpired'] === true;
  const status = String(r['status'] ?? 'PENDING') as ApprovalStatus;
  return {
    uid: String(r['uid'] ?? ''),
    status: status === 'PENDING' && expired ? 'EXPIRED' : status,
    before: parse(r['oldValue']) as Partial<BusinessSettingsUpdate>,
    after: parse(r['newValue']) as Partial<BusinessSettingsUpdate>,
    description: str(r['changeDescription']),
    reason: str(r['requestReason']),
    requesterUid: str(r['requesterUid']),
    requesterName: str(r['requesterName']),
    requestedAt: str(r['requestedAt']) ?? str(r['createdAt']),
    approverName: str(r['approverName']),
    approvalNote: str(r['approvalReason']),
    decidedAt: str(r['approvedAt']) ?? str(r['rejectedAt']),
    rejectionReason: str(r['rejectionReason']),
    expiresAt: str(r['expiresAt']),
    expired,
  };
}

/**
 * Settings approvals (maker-checker for the main business settings). Someone
 * who may request but not edit directly sends the changed fields; an approver
 * (not the requester) approves → the backend applies the change in the same
 * transaction, or rejects with a reason.
 */
@Injectable({ providedIn: 'root' })
export class SettingsApprovalsService {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  private readonly settings = inject(BusinessSettingsService);

  readonly canEditDirect = computed(() => this.auth.hasPermission('BUSINESS_SETTINGS_MAIN_UPDATE'));
  readonly canRequest = computed(() => !this.canEditDirect() && this.auth.hasAnyPermission(['BUSINESS_SETTINGS_WRITE', 'SETTINGS_APPROVAL_WRITE']));
  readonly canApprove = computed(() => this.auth.hasAnyPermission(['SETTINGS_APPROVAL_APPROVE', 'BUSINESS_SETTINGS_MAIN_UPDATE']));
  readonly canReject = computed(() => this.auth.hasAnyPermission(['SETTINGS_APPROVAL_REJECT', 'BUSINESS_SETTINGS_MAIN_UPDATE']));
  readonly canRead = computed(() => this.auth.hasAnyPermission(['BUSINESS_SETTINGS_READ', 'SETTINGS_APPROVAL_READ']));

  /** Everyone's open requests (approvers only). */
  readonly pending = new CachedResource<SettingsRequest[]>(async () => {
    if (!this.canApprove()) return [];
    return ((await this.api.get<Raw[] | null>(`${BASE}/pending`)) ?? []).map(normalize);
  }, 60_000);

  /** My own requests, every status, newest first. */
  readonly mine = new CachedResource<SettingsRequest[]>(async () => {
    if (!this.canRead()) return [];
    return ((await this.api.get<Raw[] | null>(`${BASE}/my-history`, { params: { page: 0, size: 100 } })) ?? []).map(normalize);
  }, 60_000);

  /** Send the changed fields of the business settings for approval. */
  async request(before: Partial<BusinessSettingsUpdate>, after: Partial<BusinessSettingsUpdate>, description: string, reason: string, settingsUid: string | null): Promise<SettingsRequest> {
    const r = normalize(
      await this.api.post<Raw>(BASE, {
        settingType: 'BUSINESS_SETTINGS',
        settingField: 'main',
        oldValue: JSON.stringify(before),
        newValue: JSON.stringify(after),
        changeDescription: description,
        requestReason: reason,
        relatedEntityUid: settingsUid,
      }),
    );
    this.mine.invalidate();
    this.pending.invalidate();
    return r;
  }

  async approve(uid: string, note: string | null): Promise<void> {
    await this.api.post(`${BASE}/${uid}/approve`, { reason: note || null });
    this.afterDecision();
    // The change is now in effect — receipts and the settings page must re-read it.
    this.settings.main.invalidate();
    void this.settings.main.load(true).catch(() => undefined);
  }

  async reject(uid: string, reason: string): Promise<void> {
    await this.api.post(`${BASE}/${uid}/reject`, { uid, reason });
    this.afterDecision();
  }

  async cancel(uid: string): Promise<void> {
    await this.api.post(`${BASE}/${uid}/cancel`, {});
    this.afterDecision();
  }

  private afterDecision(): void {
    this.pending.invalidate();
    this.mine.invalidate();
    void this.pending.load(true).catch(() => undefined);
    void this.mine.load(true).catch(() => undefined);
  }
}
