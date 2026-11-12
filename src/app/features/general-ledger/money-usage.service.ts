import { Injectable, computed, inject } from '@angular/core';

import { ApiService } from '@core/api/api.service';
import { CachedResource } from '@core/data/cached-resource';
import { LanguageService } from '@core/i18n/language.service';
import { DialogService } from '@shared/ui';

/** One money account (1000, 102x, 103x): the last day a live journal touched it, journals in the last 30 days. */
export interface MoneyUsage {
  code: string;
  lastUsed: string | null;
  uses30: number;
}

/** Bank / wallet names as typed on the reco and safe box -> their GL account. Unknown names (OTHER, ZANTEL…) -> null. */
export const NAME_ACCOUNT: Record<string, string> = {
  CRDB: '1020', NMB: '1021', NBC: '1022', SELCOM: '1023', PCB: '1024',
  VODACOM: '1030', MPESA: '1030', TIGO: '1031', TIGOPESA: '1031', HALOPESA: '1032', AIRTEL: '1033', AIRTELMONEY: '1033',
};

/** The accounts in use today (owner fe/fj), first when the last 30 days tie. */
const PREFERRED = ['1000', '1021', '1023', '1030', '1031'];
export const IDLE_DAYS = 60;

/**
 * (owner 12/11 fj) Every bank / phone account stays open. Pickers of where money came from or went to put the
 * accounts used most in the last 30 days first, and ask "are you sure?" before an account not used for more than
 * 60 days (or never) is picked. Without the usage list (offline, old server) nothing is reordered or asked.
 */
@Injectable({ providedIn: 'root' })
export class MoneyUsageService {
  private readonly api = inject(ApiService);
  private readonly dialogs = inject(DialogService);
  private readonly i18n = inject(LanguageService);

  readonly usage = new CachedResource<MoneyUsage[]>(
    () => this.api.get<MoneyUsage[]>('/api/v1/gl/money-accounts/usage').then((r) => r ?? []).catch(() => []),
    10 * 60_000,
  );
  private readonly byCode = computed(() => new Map((this.usage.value() ?? []).map((u) => [u.code, u])));

  constructor() {
    void this.usage.load().catch(() => undefined);
  }

  /** Most used in the last 30 days first; ties keep the accounts in use first, then the given order. */
  rank<T>(items: readonly T[], code: (t: T) => string | null | undefined): T[] {
    const m = this.byCode();
    const pref = (c: string | null | undefined) => {
      const i = c ? PREFERRED.indexOf(c) : -1;
      return i < 0 ? PREFERRED.length : i;
    };
    return items
      .map((t, i) => ({ t, i, c: code(t) }))
      .sort((a, b) => (m.get(b.c ?? '')?.uses30 ?? 0) - (m.get(a.c ?? '')?.uses30 ?? 0) || pref(a.c) - pref(b.c) || a.i - b.i)
      .map((x) => x.t);
  }

  /**
   * The last-used day when the account is idle (> 60 days), 'never' when never used, else null.
   * The accounts the owner named as in use (fe/fj) never ask: Selcom / Tigo have no history before the cut-over D.
   */
  idle(code: string | null | undefined): string | null {
    if (!code || PREFERRED.includes(code)) return null;
    const u = this.byCode().get(code);
    if (!u) return null;
    if (!u.lastUsed) return 'never';
    const days = (Date.now() - new Date(u.lastUsed + 'T00:00:00').getTime()) / 86_400_000;
    return days > IDLE_DAYS ? u.lastUsed : null;
  }

  /** True to go ahead: the account is in use, or the person confirmed an idle one. */
  async confirmPick(code: string | null | undefined, name: string): Promise<boolean> {
    const since = this.idle(code);
    if (!since) return true;
    const t = (en: string, sw: string) => this.i18n.t(en, sw);
    return this.dialogs.confirm({
      title: t('Account not in use', 'Akaunti haitumiki'),
      message: since === 'never'
        ? t(`${name} has never been used — are you sure?`, `${name} haijawahi kutumika — una uhakika?`)
        : t(`${name} has not been used since ${since} — are you sure?`, `${name} haijatumika tangu ${since} — una uhakika?`),
      confirmText: t('Yes, use it', 'Ndiyo, tumia'),
    });
  }
}
