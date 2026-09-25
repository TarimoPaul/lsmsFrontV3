import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';

import { ApiError } from '@core/api/api.types';
import { AuthService } from '@core/auth/auth.service';
import { LanguageService } from '@core/i18n/language.service';
import { DialogService, Icon, Skeleton, ToastService } from '@shared/ui';
import { parseLocal } from '@shared/utils/date-utils';
import { MoneyPipe } from '@shared/utils/money';
import { CollectionHistoryItem } from './recon-extra.models';
import { ReconStore } from './recon.store';
import { ReconciliationService } from './reconciliation.service';

interface DayGroup {
  date: string;
  items: CollectionHistoryItem[];
  total: number;
  unverified: number;
}

/**
 * Debt collections tab — port of Flutter `_DebtCollectionsTab`: money
 * collected on old debts, grouped by reconciliation day for the last 30 days
 * (today's day opens by default), each item verifiable against its OWN
 * reconciliation by an approver; plus a read-only list of this seller's debts
 * that someone else collected (information only — never counted here).
 */
@Component({
  selector: 'app-recon-collections-tab',
  imports: [Icon, Skeleton, MoneyPipe, DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (store.current(); as r) {
      <div class="totals">
        <div style="--tc: var(--c-success)"><small>{{ i18n.t('Collected (this day)', 'Yamekusanywa (siku hii)') }}</small><b>{{ r.debtCollectionsTotal | money }}</b></div>
        <div style="--tc: var(--c-info)"><small>{{ i18n.t('Declared (cash + bank + mobile)', 'Yametajwa (taslimu + benki + simu)') }}</small><b>{{ declared() | money }}</b></div>
        @if (gap() !== 0) {
          <div style="--tc: var(--c-error)"><small>{{ gap() > 0 ? i18n.t('Not yet declared', 'Bado hayajatajwa') : i18n.t('Declared more than collected', 'Yametajwa zaidi ya yaliyokusanywa') }}</small><b>{{ (gap() > 0 ? gap() : -gap()) | money }}</b></div>
        }
      </div>
      @if (gap() > 0.01) {
        <p class="warnbox"><lsms-icon name="warning" [size]="17" />{{ i18n.t('Declare where the collected debt money is in Cash & bank (Cash / Bank / Mobile — debts).', 'Taja pesa za madeni yaliyokusanywa ziko wapi kwenye Taslimu na benki (Taslimu / Benki / Simu — madeni).') }}</p>
      }
    }

    @if (cross().length) {
      <section class="cross">
        <button type="button" class="head" (click)="showCross.set(!showCross())" [attr.aria-expanded]="showCross()">
          <lsms-icon name="swap_horiz" [size]="18" />
          <span><b>{{ i18n.t('My debts collected by someone else', 'Madeni yangu yaliyokusanywa na wengine') }}</b><small>{{ i18n.t('Information only — not your money', 'Taarifa tu — si pesa yako') }}</small></span>
          <span class="count">{{ cross().length }}</span>
          <lsms-icon [name]="showCross() ? 'expand_less' : 'expand_more'" [size]="20" />
        </button>
        @if (showCross()) {
          <ul class="items">
            @for (c of cross(); track c.uid) {
              <li>
                <span class="ic muted"><lsms-icon name="person" [size]="17" /></span>
                <span class="t">
                  <b>{{ c.customerName || '—' }}</b>
                  <small>{{ i18n.t('Collected by', 'Imekusanywa na') }} {{ c.receivedBy || '—' }} · {{ day(c.collectedAt) | date: 'dd MMM, HH:mm' }} · {{ c.receipt || '—' }}</small>
                </span>
                <b class="amt">{{ c.amount | money }}</b>
              </li>
            }
          </ul>
        }
      </section>
    }

    @if (loading() && !groups().length) {
      <lsms-skeleton variant="list" [rows]="4" />
    } @else if (error()) {
      <p class="empty">{{ error() }}</p>
    } @else if (!groups().length) {
      <p class="empty">{{ i18n.t('No debt collections in the last 30 days.', 'Hakuna makusanyo ya madeni kwa siku 30 zilizopita.') }}</p>
    } @else {
      <div class="days">
        @for (g of groups(); track g.date) {
          @let open = isOpen(g.date);
          <section class="day" [class.today]="g.date === store.date()">
            <button type="button" class="head" (click)="toggle(g.date)" [attr.aria-expanded]="open">
              <lsms-icon name="event" [size]="18" />
              <span>
                <b>{{ g.date === store.date() ? i18n.t('This reconciliation day', 'Siku ya upatanisho huu') : (day(g.date) | date: 'EEE, dd MMM yyyy') }}</b>
                <small>{{ i18n.t(g.items.length + ' collection(s)', 'Makusanyo ' + g.items.length) }}@if (g.unverified) { · <em>{{ i18n.t(g.unverified + ' not verified', g.unverified + ' hayajathibitishwa') }}</em> }</small>
              </span>
              <b class="amt">{{ g.total | money }}</b>
              <lsms-icon [name]="open ? 'expand_less' : 'expand_more'" [size]="20" />
            </button>
            @if (open) {
              <ul class="items">
                @for (c of g.items; track c.uid) {
                  <li>
                    <span class="ic"><lsms-icon name="payments" [size]="17" /></span>
                    <span class="t">
                      <b>{{ c.customerName || '—' }}</b>
                      <small>
                        {{ c.method || '—' }} · {{ i18n.t('collected', 'imekusanywa') }} {{ day(c.collectedAt) | date: 'dd MMM, HH:mm' }}
                        · {{ i18n.t('sold', 'iliuzwa') }} {{ day(c.saleDate) | date: 'dd MMM' }}
                        @if (c.remainingAfter !== null) { · {{ c.remainingAfter > 0 ? i18n.t('still owes ', 'bado anadaiwa ') + (c.remainingAfter | money: { symbol: false }) : i18n.t('cleared', 'amemaliza') }} }
                      </small>
                    </span>
                    <b class="amt">{{ c.amount | money }}</b>
                    @if (canVerify() && !c.reconApproved && c.reconUid) {
                      <button type="button" class="vchip" [class.on]="c.verified" [disabled]="busy() === c.uid" (click)="verify(c)" [title]="c.verified ? i18n.t('Undo verification', 'Ondoa uthibitisho') : i18n.t('Mark verified', 'Thibitisha')">
                        <lsms-icon [name]="c.verified ? 'verified' : 'schedule'" [size]="14" [filled]="c.verified" />{{ c.verified ? i18n.t('Verified', 'Imethibitishwa') : i18n.t('Verify', 'Thibitisha') }}
                      </button>
                    } @else {
                      <span class="vchip ro" [class.on]="c.verified" [title]="c.verifiedByName || ''"><lsms-icon [name]="c.verified ? 'verified' : 'schedule'" [size]="14" [filled]="c.verified" />{{ c.verified ? i18n.t('Verified', 'Imethibitishwa') : i18n.t('Waiting', 'Inasubiri') }}</span>
                    }
                  </li>
                }
              </ul>
            }
          </section>
        }
      </div>
    }
  `,
  styleUrl: './recon-tab.scss',
  styles: `
    .warnbox { display: flex; align-items: center; gap: 8px; padding: 10px 12px; border-radius: 12px; font-size: 0.82rem; color: var(--c-warning); background: color-mix(in srgb, var(--c-warning) 8%, var(--c-surface)); border: 1px solid color-mix(in srgb, var(--c-warning) 28%, var(--c-border)); }
    .cross, .day { border-radius: 16px; background: var(--c-surface); border: 1px solid var(--c-border); overflow: hidden; }
    .cross { border-style: dashed; }
    .day.today { border-color: color-mix(in srgb, var(--c-primary) 45%, var(--c-border)); }
    .days { display: flex; flex-direction: column; gap: 10px; }
    .head { display: flex; align-items: center; gap: 10px; width: 100%; padding: 12px 14px; border: 0; background: transparent; font: inherit; color: var(--c-text); text-align: left; cursor: pointer; }
    .head:hover { background: var(--c-hover); }
    .head > lsms-icon:first-child { color: var(--c-primary); }
    .head span { display: flex; flex-direction: column; flex: 1; min-width: 0; }
    .head b { font-size: 0.86rem; font-weight: 600; }
    .head small { font-size: 0.74rem; color: var(--c-text-2); }
    .head em { font-style: normal; font-weight: 600; color: var(--c-warning); }
    .head .amt { font-weight: 700; color: var(--c-info); }
    .count { flex: 0 0 auto !important; padding: 1px 8px; border-radius: 100px; font-size: 0.74rem; font-weight: 700; color: var(--c-warning); background: color-mix(in srgb, var(--c-warning) 12%, transparent); }
    .cross .items, .day .items { border: 0; border-top: 1px solid var(--c-border); border-radius: 0; }
    .ic.muted { color: var(--c-text-2); background: color-mix(in srgb, var(--c-text-2) 10%, transparent); }
    .vchip { display: inline-flex; align-items: center; gap: 4px; flex-shrink: 0; padding: 3px 9px; border-radius: 100px; border: 1px solid color-mix(in srgb, var(--c-warning) 40%, transparent); background: color-mix(in srgb, var(--c-warning) 10%, transparent); font: inherit; font-size: 0.72rem; font-weight: 600; color: var(--c-warning); cursor: pointer; }
    .vchip.on { color: var(--c-success); border-color: color-mix(in srgb, var(--c-success) 40%, transparent); background: color-mix(in srgb, var(--c-success) 10%, transparent); }
    .vchip.ro { cursor: default; }
    .vchip:disabled { opacity: 0.6; }
  `,
})
export class ReconCollectionsTab {
  protected readonly i18n = inject(LanguageService);
  protected readonly store = inject(ReconStore);
  private readonly auth = inject(AuthService);
  private readonly api = inject(ReconciliationService);
  private readonly dialogs = inject(DialogService);
  private readonly toast = inject(ToastService);

  protected readonly history = signal<CollectionHistoryItem[]>([]);
  protected readonly cross = signal<CollectionHistoryItem[]>([]);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly showCross = signal(false);
  protected readonly busy = signal<string | null>(null);
  private readonly opened = signal<Set<string>>(new Set());

  protected readonly canVerify = computed(() => this.auth.hasAnyPermission(['RECONCILIATION_VERIFY', 'RECONCILIATION_APPROVE']));
  protected readonly declared = computed(() => {
    const r = this.store.current();
    return r ? r.cashDebtTotal + r.bankDebtTotal + r.mobileDebtTotal : 0;
  });
  protected readonly gap = computed(() => Math.round(((this.store.current()?.debtCollectionsTotal ?? 0) - this.declared()) * 100) / 100);
  protected readonly groups = computed<DayGroup[]>(() => {
    const by = new Map<string, CollectionHistoryItem[]>();
    for (const c of this.history()) {
      const d = c.reconDate ?? '';
      by.set(d, [...(by.get(d) ?? []), c]);
    }
    return [...by.entries()]
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([date, items]) => ({ date, items, total: items.reduce((n, c) => n + c.amount, 0), unverified: items.filter((c) => !c.verified).length }));
  });

  constructor() {
    // Reload for whoever owns the open reconciliation (a manager may view another seller's day).
    effect(() => {
      const owner = this.store.current()?.userUid ?? this.store.me();
      const date = this.store.date();
      untracked(() => {
        this.opened.set(new Set([date]));
        if (owner) void this.load(owner);
      });
    });
  }

  private async load(userUid: string): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const [h, x] = await Promise.all([this.api.collectionsHistory(userUid, 30), this.api.crossCollected(userUid, 30)]);
      this.history.set(h);
      this.cross.set(x);
    } catch (e) {
      this.error.set(ApiError.from(e).message);
    } finally {
      this.loading.set(false);
    }
  }

  protected isOpen(date: string): boolean {
    return this.opened().has(date);
  }

  protected toggle(date: string): void {
    this.opened.update((s) => {
      const n = new Set(s);
      if (n.has(date)) n.delete(date);
      else n.add(date);
      return n;
    });
  }

  protected day(v: string | null): Date | null {
    return parseLocal(v);
  }

  /** Verify against the collection's own reconciliation; own items with SELF_APPROVE need a reason. */
  protected async verify(c: CollectionHistoryItem): Promise<void> {
    if (!c.reconUid) return;
    let reason: string | undefined;
    if (c.reconUserUid && c.reconUserUid === this.store.me() && this.auth.hasPermission('RECONCILIATION_SELF_APPROVE')) {
      const { ReasonDialog } = await import('./reason-dialog');
      reason = await this.dialogs.openAsync<string>(ReasonDialog, {
        size: 'sm',
        data: {
          title: this.i18n.t('Verifying your own item', 'Kuthibitisha kipengele chako mwenyewe'),
          message: this.i18n.t('You recorded this yourself — a reason is required and is kept in the audit log.', 'Wewe ndiye uliyerekodi hiki — sababu inahitajika na inahifadhiwa kwenye kumbukumbu.'),
          label: this.i18n.t('Reason', 'Sababu'),
          confirm: c.verified ? this.i18n.t('Remove verification', 'Ondoa uthibitisho') : this.i18n.t('Verify', 'Thibitisha'),
        },
      });
      if (!reason) return;
    }
    this.busy.set(c.uid);
    try {
      const res = await this.api.verify(c.reconUid, 'COLLECTION', c.uid, !c.verified, reason);
      if (res.error) return void this.toast.error(res.error);
      this.history.update((l) => l.map((x) => (x.uid === c.uid ? { ...x, verified: !c.verified } : x)));
      if (c.reconUid === this.store.current()?.uid && res.recon) this.store.current.set(res.recon);
    } finally {
      this.busy.set(null);
    }
  }
}
