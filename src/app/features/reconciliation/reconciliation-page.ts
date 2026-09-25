import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';

import { LanguageService } from '@core/i18n/language.service';
import { EmptyState, Icon, PageHeader, SegmentOption, SegmentedFilterBar, Skeleton } from '@shared/ui';
import { addDays, parseLocal, toIsoDate } from '@shared/utils/date-utils';
import { ReconApprovalTab } from './recon-approval-tab';
import { ReconCollectionsTab } from './recon-collections-tab';
import { ReconDebtsTab } from './recon-debts-tab';
import { EntryKind, ReconEntriesTab } from './recon-entries-tab';
import { ReconPurchasesTab } from './recon-purchases-tab';
import { ReconSafeBoxTab } from './recon-safebox-tab';
import { ReconSummaryTab } from './recon-summary-tab';
import { ReconVarianceTab } from './recon-variance-tab';
import { ReconStore } from './recon.store';
import { RECON_STATUS, pendingVerification } from './reconciliation.models';

type Tab = 'summary' | EntryKind | 'debts' | 'purchases' | 'safebox' | 'collections' | 'approval' | 'variance';

const DATE_KEY = 'lsms.recon.date';
const TAB_KEY = 'lsms.recon.tab';

/**
 * Daily reconciliation — port of Flutter `ReconciliationDashboard`: pick a
 * day (and, for managers, whose record), then Summary · Cash & bank · Mobile
 * money · Debts · Expenses · Purchases · Safe box · Debt collections ·
 * Approval (+ Variance tracking for approvers). The day and tab survive a
 * refresh like Flutter's SharedPreferences restore.
 */
@Component({
  selector: 'app-reconciliation-page',
  imports: [
    PageHeader,
    SegmentedFilterBar,
    Icon,
    Skeleton,
    EmptyState,
    ReconSummaryTab,
    ReconEntriesTab,
    ReconDebtsTab,
    ReconPurchasesTab,
    ReconSafeBoxTab,
    ReconCollectionsTab,
    ReconApprovalTab,
    ReconVarianceTab,
    DatePipe,
  ],
  providers: [ReconStore],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="wrap">
      <lsms-page-header
        [title]="i18n.t('Reconciliation', 'Upatanisho')"
        [subtitle]="i18n.t('Account for each day’s sales: cash, bank, mobile, debts and expenses', 'Eleza mauzo ya kila siku: taslimu, benki, simu, madeni na matumizi')"
        icon="balance"
        [refreshable]="true"
        (refresh)="store.load()"
      />

      <div class="bar">
        <div class="day">
          <button type="button" (click)="shift(-1)" [attr.aria-label]="i18n.t('Previous day', 'Siku iliyopita')"><lsms-icon name="chevron_left" [size]="20" /></button>
          <label>
            <lsms-icon name="calendar_today" [size]="16" />
            <input type="date" [max]="today" [value]="store.date()" (change)="pick($any($event.target).value)" [attr.aria-label]="i18n.t('Day', 'Siku')" />
          </label>
          <button type="button" (click)="shift(1)" [disabled]="store.date() >= today" [attr.aria-label]="i18n.t('Next day', 'Siku inayofuata')"><lsms-icon name="chevron_right" [size]="20" /></button>
          @if (store.date() !== today) {
            <button type="button" class="today" (click)="pick(today)">{{ i18n.t('Today', 'Leo') }}</button>
          }
        </div>

        @if (store.isManager()) {
          <label class="who">
            <lsms-icon name="badge" [size]="16" />
            <select [value]="store.current()?.uid ?? ''" (change)="openRecord($any($event.target).value)" [attr.aria-label]="i18n.t('Salesperson', 'Muuzaji')">
              @if (!store.current()) {
                <option value="">{{ i18n.t('Choose salesperson…', 'Chagua muuzaji…') }}</option>
              }
              @for (t of store.team(); track t.uid) {
                <option [value]="t.uid">{{ t.userName || '—' }} · {{ statusText(t.status) }}{{ t.userUid === store.me() ? ' (' + i18n.t('mine', 'wangu') + ')' : '' }}</option>
              }
            </select>
            <small>{{ i18n.t(store.team().length + ' on this day', store.team().length + ' siku hii') }}</small>
          </label>
        }

        @if (store.current(); as r) {
          @let st = status(r.status);
          <span class="owner">
            <span class="pill" [style.--st]="st.color"><lsms-icon [name]="st.icon" [size]="13" />{{ i18n.isSwahili() ? st.sw : st.en }}</span>
            <small>{{ r.userName }}</small>
          </span>
        }
      </div>

      @if (store.unclosed().length && !hideReminder()) {
        <div class="reminder">
          <lsms-icon name="notification_important" [size]="18" />
          <span>
            <b>{{ i18n.t('You have ' + store.unclosed().length + ' day(s) not yet approved', 'Una siku ' + store.unclosed().length + ' ambazo hazijaidhinishwa') }}</b>
            <span class="days">
              @for (u of store.unclosed().slice(0, 8); track u.uid) {
                <button type="button" (click)="pick(u.date)">{{ day(u.date) | date: 'dd MMM' }} · {{ statusText(u.status) }}</button>
              }
            </span>
          </span>
          <button type="button" class="x" (click)="hideReminder.set(true)" [attr.aria-label]="i18n.t('Dismiss', 'Funga')"><lsms-icon name="close" [size]="16" /></button>
        </div>
      }

      <lsms-segmented-filter-bar class="tabs" [options]="tabs()" [selected]="tab()" (selectedChange)="setTab($event)" />

      @if (tab() === 'variance' && store.isManager()) {
        <app-recon-variance-tab (openRecon)="openFromReport($event)" />
      } @else if (store.loading()) {
        <lsms-skeleton variant="list" [rows]="6" />
      } @else if (store.error() && !store.current()) {
        <lsms-empty-state icon="error" iconColor="var(--c-error)" [title]="i18n.t('Could not load', 'Imeshindikana kupakia')" [message]="store.error()!" [secondaryActionLabel]="i18n.t('Retry', 'Jaribu tena')" (secondaryAction)="store.load()" />
      } @else {
        @switch (tab()) {
          @case ('summary') {
            <app-recon-summary-tab (goApproval)="setTab('approval')" />
          }
          @case ('debts') {
            <app-recon-debts-tab />
          }
          @case ('purchases') {
            <app-recon-purchases-tab />
          }
          @case ('safebox') {
            <app-recon-safebox-tab />
          }
          @case ('collections') {
            <app-recon-collections-tab />
          }
          @case ('approval') {
            @if (store.current()) {
              <app-recon-approval-tab />
            } @else {
              <lsms-empty-state icon="verified" [title]="i18n.t('Nothing to approve for this day', 'Hakuna cha kuidhinisha siku hii')" />
            }
          }
          @default {
            <app-recon-entries-tab [kind]="$any(tab())" />
          }
        }
      }
    </div>
  `,
  styles: `
    @use 'list-page';
    @include list-page.base;
    .bar { display: flex; align-items: center; flex-wrap: wrap; gap: 10px 14px; }
    .day { display: inline-flex; align-items: center; gap: 4px; }
    .day button { display: inline-flex; align-items: center; justify-content: center; height: 40px; min-width: 36px; padding: 0 8px; border-radius: 10px; border: 1px solid var(--c-border); background: var(--c-surface); font: inherit; font-size: 0.8rem; font-weight: 700; color: var(--c-text); cursor: pointer; }
    .day button:disabled { opacity: 0.4; cursor: default; }
    .day .today { color: var(--c-primary); }
    .day label, .who { display: inline-flex; align-items: center; gap: 6px; height: 40px; padding: 0 10px; border-radius: 10px; border: 1px solid var(--c-border); background: var(--c-surface); }
    .day label lsms-icon, .who lsms-icon { color: var(--c-primary); }
    .day input, .who select { border: 0; outline: 0; background: transparent; font: inherit; font-size: 0.86rem; font-weight: 600; color: var(--c-text); }
    .who select { max-width: 260px; }
    .who small { font-size: 0.7rem; color: var(--c-text-2); white-space: nowrap; }
    .owner { display: inline-flex; align-items: center; gap: 8px; margin-left: auto; }
    .owner small { font-size: 0.8rem; font-weight: 600; color: var(--c-text-2); }
    .pill { display: inline-flex; align-items: center; gap: 4px; padding: 3px 10px; border-radius: 100px; font-size: 0.72rem; font-weight: 700; color: var(--st); background: color-mix(in srgb, var(--st) 12%, transparent); }
    .reminder { display: flex; gap: 10px; padding: 12px 14px; border-radius: 14px; color: var(--c-warning); background: color-mix(in srgb, var(--c-warning) 9%, var(--c-surface)); border: 1px solid color-mix(in srgb, var(--c-warning) 35%, transparent); }
    .reminder > span { display: flex; flex-direction: column; gap: 6px; flex: 1; }
    .reminder .days { display: flex; flex-wrap: wrap; gap: 6px; }
    .reminder .days button { padding: 3px 9px; border-radius: 100px; border: 1px solid color-mix(in srgb, var(--c-warning) 40%, transparent); background: var(--c-surface); font: inherit; font-size: 0.74rem; font-weight: 600; color: var(--c-text); cursor: pointer; }
    .reminder .x { align-self: flex-start; display: inline-flex; padding: 2px; border: 0; background: transparent; color: var(--c-text-2); cursor: pointer; }
    .tabs { display: flex; }
  `,
})
export class ReconciliationPage {
  protected readonly i18n = inject(LanguageService);
  protected readonly store = inject(ReconStore);

  protected readonly today = toIsoDate(new Date());
  protected readonly tab = signal<Tab>((read(TAB_KEY) as Tab) || 'summary');
  protected readonly hideReminder = signal(false);

  protected readonly tabs = computed<SegmentOption<Tab>[]>(() => {
    const r = this.store.current();
    const t = (en: string, sw: string) => this.i18n.t(en, sw);
    const n = (v: number | undefined) => (v ? v : undefined);
    return [
      { value: 'summary', label: t('Summary', 'Muhtasari'), icon: 'dashboard' },
      { value: 'cash', label: t('Cash & bank', 'Taslimu na benki'), icon: 'account_balance', count: n(r?.cashEntries.length) },
      { value: 'mobile', label: t('Mobile money', 'Pesa za simu'), icon: 'phone_iphone', count: n(r?.mobileEntries.length) },
      { value: 'debts', label: t('Debts', 'Madeni'), icon: 'group', count: n(r?.debts.length) },
      { value: 'expense', label: t('Expenses', 'Matumizi'), icon: 'receipt_long', count: n(r?.expenses.length) },
      { value: 'purchases', label: t('Purchases', 'Manunuzi'), icon: 'shopping_cart', count: n(r?.purchases.length) },
      { value: 'safebox', label: t('Safe box', 'Sefu'), icon: 'lock', count: n(r?.cashEntries.filter((e) => e.type === 'SAFE_BOX').length) },
      { value: 'collections', label: t('Debt collections', 'Makusanyo ya madeni'), icon: 'payments', count: n(r?.collections.length) },
      { value: 'approval', label: t('Approval', 'Idhini'), icon: 'verified', count: r && (r.status === 'SUBMITTED' || r.status === 'REVIEWED') ? n(pendingVerification(r)) : undefined },
      // Approvers only (Flutter hides it for everyone else).
      ...(this.store.isManager() ? [{ value: 'variance' as Tab, label: t('Variance tracking', 'Ufuatiliaji wa tofauti'), icon: 'query_stats' }] : []),
    ];
  });

  constructor() {
    const saved = read(DATE_KEY);
    const date = saved && saved <= this.today ? saved : this.today;
    void this.store.load(date);
    void this.store.loadUnclosed();
  }

  protected setTab(t: Tab): void {
    this.tab.set(t);
    write(TAB_KEY, t);
  }

  protected pick(date: string): void {
    if (!date || date > this.today) return;
    write(DATE_KEY, date);
    void this.store.load(date);
  }

  protected shift(d: number): void {
    const cur = parseLocal(this.store.date()) ?? new Date();
    this.pick(toIsoDate(addDays(cur, d)));
  }

  /** From the variance report: jump to that salesperson's day and show its summary. */
  protected async openFromReport(e: { uid: string; date: string }): Promise<void> {
    write(DATE_KEY, e.date);
    await this.store.load(e.date);
    await this.store.open(e.uid);
    this.setTab('summary');
  }

  protected openRecord(uid: string): void {
    if (uid) void this.store.open(uid);
  }

  protected status(s: string) {
    return RECON_STATUS[s as keyof typeof RECON_STATUS] ?? RECON_STATUS.DRAFT;
  }

  protected statusText(s: string): string {
    const x = this.status(s);
    return this.i18n.isSwahili() ? x.sw : x.en;
  }

  protected day(v: string): Date | null {
    return parseLocal(v);
  }
}

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function write(key: string, v: string): void {
  try {
    localStorage.setItem(key, v);
  } catch {
    // ignore
  }
}
