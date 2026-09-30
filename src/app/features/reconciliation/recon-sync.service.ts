import { Injectable, inject, signal } from '@angular/core';

import { AuthService } from '@core/auth/auth.service';
import { LanguageService } from '@core/i18n/language.service';
import { ToastService } from '@shared/ui';
import { toIsoDate } from '@shared/utils/date-utils';
import { ReconciliationService } from './reconciliation.service';

const CHANNEL = 'lsms-recon-sync';

/**
 * Keeps the reconciliation in step with debt payments taken anywhere in the
 * app (Customer statement, Sales, Reconciliation debts). The backend only
 * mirrors a previous-day debt payment into "Debt collections" when the
 * receiver's reconciliation for the payment day is created or refreshed — a
 * payment from the Customer module never triggers that on its own. So after
 * every payment we sync today's own record (creating it when there is none
 * yet) and tell open reconciliation screens — this tab and other tabs — to
 * reload.
 */
@Injectable({ providedIn: 'root' })
export class ReconSyncService {
  private readonly api = inject(ReconciliationService);
  private readonly auth = inject(AuthService);
  private readonly i18n = inject(LanguageService);
  private readonly toast = inject(ToastService);
  private readonly channel = typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel(CHANNEL);

  /** Bumped whenever the reconciliation data changed outside the reconciliation screen. */
  readonly version = signal(0);

  constructor() {
    if (this.channel) this.channel.onmessage = () => this.version.update((v) => v + 1);
  }

  /**
   * Call after money was received against a sale. `saleDate` decides whether it
   * is a debt collection (sale from an earlier day) or part of today's sales.
   */
  async paymentReceived(saleDate: string | null): Promise<void> {
    const today = toIsoDate(new Date());
    const isCollection = !!saleDate && saleDate.slice(0, 10) < today;
    if (isCollection && this.auth.hasPermission('RECONCILIATION_CREATE')) await this.mirror(today);
    this.notify();
  }

  private async mirror(today: string): Promise<void> {
    try {
      const mine = await this.api.mine(today);
      if (mine && !mine.editable) {
        this.toast.warning(
          this.i18n.t(
            "Today's reconciliation is already submitted — unsubmit (or ask for a reopen) so this debt collection is included.",
            'Upatanisho wa leo tayari umewasilishwa — urudishe (au omba ufunguliwe) ili makusanyo haya ya deni yaingie.',
          ),
          { duration: 8000 },
        );
        return;
      }
      if (mine) await this.api.refresh(mine.uid);
      else await this.api.create(today);
      this.toast.info(this.i18n.t("Added to today's reconciliation → Debt collections.", 'Imeongezwa kwenye upatanisho wa leo → Makusanyo ya madeni.'));
    } catch {
      // The reconciliation screen refreshes on open anyway — never fail the payment over this.
    }
  }

  private notify(): void {
    this.version.update((v) => v + 1);
    this.channel?.postMessage(Date.now());
  }
}
