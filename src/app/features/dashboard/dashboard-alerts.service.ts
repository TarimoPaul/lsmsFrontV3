import { Injectable, inject, signal } from '@angular/core';

import { ApiService } from '@core/api/api.service';
import { AuthService } from '@core/auth/auth.service';
import { safeStorage } from '@core/utils/safe-storage';
import { toIsoDate } from '@shared/utils/date-utils';

const today = () => toIsoDate(new Date());

export interface LiabilityAlert {
  count: number;
  balance: number;
}

export interface ReconApprovalAlert {
  count: number;
  oldestDate: string | null;
}

interface LiabilityDto {
  balance?: number;
  items?: Array<{ acknowledgedAt?: string | null; disputed?: boolean }>;
}

interface ReconDto {
  reconciliationDate?: string | null;
}

/**
 * Permission-gated "needs your attention" cards on the main dashboard
 * (Flutter MainMenu: liability badge, pending reconciliation approvals,
 * pending debt adjustments). Each call fires only when the user holds the
 * permission, exactly like Flutter — load-time only, no polling.
 */
@Injectable({ providedIn: 'root' })
export class DashboardAlertsService {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);

  /** Dismissed alerts: key → count at dismissal time (today, per user). */
  private readonly dismissed = signal<Record<string, number>>(this.readDismissed());

  readonly liabilities = signal<LiabilityAlert | null>(null);
  readonly reconApprovals = signal<ReconApprovalAlert | null>(null);
  readonly debtAdjustments = signal<number | null>(null);

  load(): void {
    // Re-read in case another user signed in on this browser.
    this.dismissed.set(this.readDismissed());
    if (this.auth.hasPermission('LIABILITY_READ_OWN')) void this.loadLiabilities();
    else this.liabilities.set(null);
    if (this.auth.hasPermission('RECONCILIATION_APPROVE')) void this.loadReconApprovals();
    else this.reconApprovals.set(null);
    if (this.auth.hasPermission('DEBT_ADJUST_APPROVE')) void this.loadDebtAdjustments();
    else this.debtAdjustments.set(null);
  }

  /**
   * An alert stays hidden for the rest of the day after the user closes it,
   * unless new items arrive (count grows above what was dismissed).
   */
  isDismissed(key: string, count: number): boolean {
    const at = this.dismissed()[key];
    return at !== undefined && count <= at;
  }

  dismiss(key: string, count: number): void {
    this.dismissed.update((d) => {
      const next = { ...d, [key]: count };
      safeStorage.set(this.storageKey(), JSON.stringify({ day: today(), items: next }));
      return next;
    });
  }

  private storageKey(): string {
    return `lsms_dismissed_alerts_${this.auth.user()?.uid ?? 'anon'}`;
  }

  private readDismissed(): Record<string, number> {
    try {
      const raw = JSON.parse(safeStorage.get(this.storageKey()) ?? 'null') as { day: string; items: Record<string, number> } | null;
      return raw?.day === today() ? raw.items : {};
    } catch {
      return {};
    }
  }

  private async loadLiabilities(): Promise<void> {
    try {
      const list = (await this.api.get<LiabilityDto[]>('/api/liabilities/my')) ?? [];
      const pending = list.flatMap((l) => l.items ?? []).filter((i) => !i.acknowledgedAt && !i.disputed);
      const balance = list.reduce((sum, l) => sum + (Number(l.balance) || 0), 0);
      this.liabilities.set({ count: pending.length, balance });
    } catch {
      this.liabilities.set(null);
    }
  }

  private async loadReconApprovals(): Promise<void> {
    try {
      const items = (await this.api.get<ReconDto[]>('/api/v1/reconciliation/pending-approval')) ?? [];
      const dates = items
        .map((r) => r.reconciliationDate)
        .filter((d): d is string => !!d)
        .sort();
      this.reconApprovals.set({ count: items.length, oldestDate: dates[0] ?? null });
    } catch {
      this.reconApprovals.set(null);
    }
  }

  private async loadDebtAdjustments(): Promise<void> {
    try {
      const items = (await this.api.get<unknown[]>('/api/debt-adjustments/pending')) ?? [];
      this.debtAdjustments.set(items.length);
    } catch {
      this.debtAdjustments.set(null);
    }
  }
}
