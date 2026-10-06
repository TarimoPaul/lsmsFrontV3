import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';

import { ApiError } from '@core/api/api.types';
import { AuthService } from '@core/auth/auth.service';
import { LanguageService } from '@core/i18n/language.service';
import { DialogService, Icon, Skeleton, ToastService } from '@shared/ui';
import { addDays, dayOnly, parseLocal, toLocalDateTime } from '@shared/utils/date-utils';
import { MoneyPipe } from '@shared/utils/money';
import { DebtPayment } from '../customers/customers.models';
import { CustomersService } from '../customers/customers.service';
import { CollectionHistoryItem } from './recon-extra.models';
import { DaySync, ReconSyncService } from './recon-sync.service';
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
 * Better than Flutter: debt payments this person received that reached NO
 * reconciliation are listed too (same feed as Customers → Debt payments), with
 * a one-click pull into the day they belong to and the reason for any left over.
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

    @if (missing().length) {
      <section class="miss">
        <div class="mhead">
          <lsms-icon name="report" [size]="18" />
          <span>
            <b>{{ i18n.t('Received but not in any reconciliation', 'Yamepokelewa lakini hayajaingia reco yoyote') }}</b>
            <small>{{ i18n.t(missing().length + ' payment(s), last 30 days — not counted in any day yet', 'Malipo ' + missing().length + ', siku 30 zilizopita — hayajahesabiwa siku yoyote bado') }}</small>
          </span>
          <b class="amt">{{ missingTotal() | money }}</b>
          @if (canSync()) {
            <button type="button" class="sync" [disabled]="syncing()" (click)="syncMissing()">
              <lsms-icon name="sync" [size]="15" />{{ syncing() ? i18n.t('Working…', 'Inafanya kazi…') : i18n.t('Pull into reconciliation', 'Ingiza kwenye reco') }}
            </button>
          }
        </div>
        <ul class="items">
          @for (p of missing(); track p.paymentUid) {
            <li>
              <span class="ic bad"><lsms-icon name="payments" [size]="17" /></span>
              <span class="t">
                <b>{{ p.customerName }}</b>
                <small>{{ p.paymentMethod || '—' }} · {{ i18n.t('collected', 'imekusanywa') }} {{ day(p.paymentDate) | date: 'dd MMM, HH:mm' }} · {{ p.receiptNumber || '—' }} · {{ i18n.t('sold', 'iliuzwa') }} {{ day(p.saleDate) | date: 'dd MMM' }}</small>
                @if (reason(p); as why) { <small class="why">{{ why }}</small> }
              </span>
              <b class="amt">{{ p.amount | money }}</b>
            </li>
          }
        </ul>
      </section>
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
    .miss { border-radius: 16px; background: var(--c-surface); border: 1px solid color-mix(in srgb, var(--c-error) 35%, var(--c-border)); overflow: hidden; }
    .miss .items { border: 0; border-top: 1px solid var(--c-border); border-radius: 0; }
    .mhead { display: flex; align-items: center; flex-wrap: wrap; gap: 10px; padding: 12px 14px; }
    .mhead > lsms-icon { color: var(--c-error); }
    .mhead span { display: flex; flex-direction: column; flex: 1; min-width: 160px; }
    .mhead b { font-size: 0.86rem; font-weight: 600; }
    .mhead small { font-size: 0.74rem; color: var(--c-text-2); }
    .mhead .amt { font-weight: 700; color: var(--c-error); }
    .sync { display: inline-flex; align-items: center; gap: 5px; padding: 6px 12px; border-radius: 100px; border: 1px solid var(--c-primary); background: var(--c-primary); font: inherit; font-size: 0.76rem; font-weight: 600; color: #fff; cursor: pointer; }
    .sync:disabled { opacity: 0.6; cursor: default; }
    .ic.bad { color: var(--c-error); background: color-mix(in srgb, var(--c-error) 10%, transparent); }
    .items .t small.why { white-space: normal; color: var(--c-warning); }
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
  private readonly customers = inject(CustomersService);
  private readonly sync = inject(ReconSyncService);

  /** Debt payments the open record's owner received that reached no reconciliation (last 30 days). */
  protected readonly missing = signal<DebtPayment[]>([]);
  protected readonly missingTotal = computed(() => this.missing().reduce((n, p) => n + p.amount, 0));
  protected readonly syncing = signal(false);
  /** Outcome of the last pull, per payment day — explains what is still left. */
  private readonly pulled = signal<Record<string, DaySync>>({});
  private readonly owner = computed(() => this.store.current()?.userUid ?? this.store.me());
  /** Own days need RECONCILIATION_CREATE; somebody else's are re-synced through the team list. */
  protected readonly canSync = computed(() => (this.owner() === this.store.me() ? this.auth.hasPermission('RECONCILIATION_CREATE') : this.store.isManager()));

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
      const owner = this.owner();
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
      const [h, x, m] = await Promise.all([this.api.collectionsHistory(userUid, 30), this.api.crossCollected(userUid, 30), this.notInRecon(userUid)]);
      this.history.set(h);
      this.cross.set(x);
      this.missing.set(m);
    } catch (e) {
      this.error.set(ApiError.from(e).message);
    } finally {
      this.loading.set(false);
    }
  }

  /** Needs CUSTOMER_CREDIT_VIEW — without it the section simply stays hidden. */
  private notInRecon(userUid: string): Promise<DebtPayment[]> {
    const from = toLocalDateTime(dayOnly(addDays(new Date(), -29)));
    return this.customers.debtPayments(1, 100, { from, search: '', receivedBy: userUid, reconState: 'NONE' }).then(
      (r) => r.items,
      () => [],
    );
  }

  /** Re-syncs the owner's record of every day that has a stray payment, then says what is left and why. */
  protected async syncMissing(): Promise<void> {
    const owner = this.owner();
    if (!owner || this.syncing()) return;
    this.syncing.set(true);
    try {
      const before = this.missing().length;
      const days = [...new Set(this.missing().map(payDay).filter(Boolean))];
      const pulled: Record<string, DaySync> = {};
      for (const d of days) pulled[d] = (await this.sync.syncDay(d, owner)).outcome;
      this.pulled.set(pulled);
      await this.load(owner);
      const left = this.missing().length;
      const done = before - left;
      if (done > 0) this.toast.success(this.i18n.t(done + ' payment(s) pulled into reconciliation.', 'Malipo ' + done + ' yameingizwa kwenye reco.'));
      if (left > 0) this.toast.warning(this.i18n.t(left + ' payment(s) could not be pulled in — the reason is shown on each.', 'Malipo ' + left + ' hayakuweza kuingizwa — sababu imeoneshwa kwenye kila moja.'), { duration: 8000 });
      // The open record's own totals moved too (this also reloads the lists here).
      if (done > 0) void this.store.refresh();
    } finally {
      this.syncing.set(false);
    }
  }

  /** Why a payment is still outside reconciliation — known once a pull was tried for its day. */
  protected reason(p: DebtPayment): string | null {
    switch (this.pulled()[payDay(p)]) {
      case 'locked':
        return this.i18n.t("That day's reconciliation is already approved — reopen it, then pull again.", 'Reco ya siku hiyo imeshaidhinishwa — ifunguliwe tena, kisha ingiza tena.');
      case 'none':
        return this.i18n.t('No reconciliation exists for that day — the person who received the money has to open that day in Reconciliation.', 'Hakuna reco ya siku hiyo — aliyepokea pesa anatakiwa afungue siku hiyo kwenye Upatanisho.');
      case 'synced':
        return this.i18n.t("That day's reconciliation was re-synced but did not take this payment — report it to the administrator.", 'Reco ya siku hiyo imesasishwa lakini haikuyachukua malipo haya — mjulishe msimamizi wa mfumo.');
      default:
        return null;
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

function payDay(p: DebtPayment): string {
  return (p.paymentDate ?? '').slice(0, 10);
}
