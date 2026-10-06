import { Injectable, inject, signal } from '@angular/core';

import { AuthService } from '@core/auth/auth.service';
import { LanguageService } from '@core/i18n/language.service';
import { ToastService } from '@shared/ui';
import { toIsoDate } from '@shared/utils/date-utils';
import { Recon } from './reconciliation.models';
import { ReconciliationService } from './reconciliation.service';

const CHANNEL = 'lsms-recon-sync';

/**
 * What happened when a day's record was asked to pull in its debt collections:
 * `synced` — a record exists and was re-synced (see `recon`); a submitted /
 * reviewed one takes only the debt collections it missed;
 * `locked` — the record is approved, so it cannot take more without a reopen;
 * `none` — there is no record for that day and none could be created (only its
 * owner can open one, on a day with sales or received debt payments).
 */
export type DaySync = 'synced' | 'locked' | 'none';

/**
 * Keeps the reconciliation in step with debt payments taken anywhere in the
 * app (Customer statement, Sales, Reconciliation debts). The backend only
 * mirrors a previous-day debt payment into "Debt collections" when the
 * receiver's reconciliation for the payment day is created or refreshed — a
 * payment from the Customer module never triggers that on its own. So after
 * every payment we sync today's own record (creating it when there is none
 * yet — a received debt payment is enough to open one, even with no sales)
 * and tell open reconciliation screens — this tab and other tabs — to reload.
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
   * is a debt collection (sale from an earlier day) or part of today's sales;
   * `saleUid` lets us confirm the collection really landed in the record.
   */
  async paymentReceived(saleDate: string | null, saleUid?: string | null): Promise<void> {
    const today = toIsoDate(new Date());
    const isCollection = !!saleDate && saleDate.slice(0, 10) < today;
    if (isCollection && this.auth.hasPermission('RECONCILIATION_CREATE')) await this.mirror(today, saleUid ?? null);
    this.notify();
  }

  /**
   * Pulls the day's debt payments into `ownerUid`'s record for `date` (the
   * caller's own when omitted): refreshes it unless approved, creates the
   * caller's own when missing. Never throws.
   */
  async syncDay(date: string, ownerUid?: string | null): Promise<{ outcome: DaySync; recon: Recon | null }> {
    const own = !ownerUid || ownerUid === this.auth.user()?.uid;
    try {
      const found = own ? await this.api.mine(date) : ((await this.api.team(date)).find((r) => r.userUid === ownerUid) ?? null);
      if (found?.uid) {
        const frozen = found.status === 'APPROVED' || found.status === 'CLOSED';
        return frozen ? { outcome: 'locked', recon: found } : { outcome: 'synced', recon: await this.api.refresh(found.uid) };
      }
      if (!own || !this.auth.hasPermission('RECONCILIATION_CREATE')) return { outcome: 'none', recon: null };
      // With nothing to reconcile that day the backend answers with an unsaved record (no uid).
      const made = await this.api.create(date);
      return made.uid ? { outcome: 'synced', recon: made } : { outcome: 'none', recon: null };
    } catch {
      return { outcome: 'none', recon: null };
    }
  }

  /** Tell open reconciliation screens (this tab and others) to reload. */
  notify(): void {
    this.version.update((v) => v + 1);
    this.channel?.postMessage(Date.now());
  }

  /** Syncs today's own record and says truthfully whether the collection is in it. */
  private async mirror(today: string, saleUid: string | null): Promise<void> {
    const t = (en: string, sw: string) => this.i18n.t(en, sw);
    const { outcome, recon } = await this.syncDay(today);
    if (outcome === 'locked') {
      this.toast.warning(
        t(
          "Today's reconciliation is already approved — ask for a reopen so this debt collection is included.",
          'Upatanisho wa leo tayari umeidhinishwa — omba ufunguliwe ili makusanyo haya ya deni yaingie.',
        ),
        { duration: 8000 },
      );
    } else if (outcome === 'none') {
      this.toast.warning(
        t(
          "Payment saved, but it is NOT in a reconciliation yet: today's reconciliation could not be opened. Check Reconciliation → Debt collections.",
          'Malipo yamehifadhiwa, lakini BADO hayajaingia reco: upatanisho wa leo haukuweza kufunguliwa. Angalia Upatanisho → Makusanyo ya madeni.',
        ),
        { duration: 10000 },
      );
    } else if (saleUid && !recon?.collections.some((c) => c.saleUid === saleUid)) {
      this.toast.warning(
        t(
          "Payment saved, but today's reconciliation did not take it into Debt collections. It is listed there as not counted.",
          'Malipo yamehifadhiwa, lakini upatanisho wa leo haujayaingiza kwenye Makusanyo ya madeni. Yameorodheshwa huko kama hayajahesabiwa.',
        ),
        { duration: 10000 },
      );
    } else {
      this.toast.info(t("Added to today's reconciliation → Debt collections.", 'Imeongezwa kwenye upatanisho wa leo → Makusanyo ya madeni.'));
    }
  }
}
