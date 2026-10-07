import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';

import { ApiError } from '@core/api/api.types';
import { LanguageService } from '@core/i18n/language.service';
import { NotificationCenter } from '@core/notifications/notification-center.service';
import { AppNotification, NotificationCategory, kindOf } from '@core/notifications/notification.models';
import { Button, DialogService, EmptyState, Icon, SegmentOption, SegmentedFilterBar, Skeleton, ToastService } from '@shared/ui';
import { dayOnly, parseLocal } from '@shared/utils/date-utils';
import { MoneyPipe } from '@shared/utils/money';
import { CustomerStatementLauncher } from '../customers/open-statement';

const PAGE = 30;
/** Same-type, same-person notifications this close together read as one event (a bulk approve/receive). */
const BURST_MS = 5 * 60_000;

interface Row {
  key: string;
  items: AppNotification[];
}
interface Day {
  label: string;
  rows: Row[];
}

/**
 * Notifications inbox. v3 over Flutter: one tab per kind with the server's exact
 * unread count (purchase events outnumber debt collections ~400:1 on prod and
 * used to bury them), unread-only filter, mark-all-read per tab, bulk purchase
 * bursts collapsed into one row, and every row opens what it is about.
 */
@Component({
  selector: 'app-notifications-page',
  imports: [SegmentedFilterBar, EmptyState, Button, Icon, Skeleton, MoneyPipe, DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="head">
      <div>
        <h1>{{ i18n.t('Notifications', 'Arifa') }}</h1>
        <p>{{ center.unread() ? i18n.t(center.unread() + ' unread', 'Hazijasomwa ' + center.unread()) : i18n.t('All caught up', 'Umesoma zote') }}</p>
      </div>
      <div class="actions">
        <label class="toggle"><input type="checkbox" [checked]="unreadOnly()" (change)="setUnreadOnly($any($event.target).checked)" />{{ i18n.t('Unread only', 'Zisizosomwa tu') }}</label>
        <button lsmsButton="secondary" size="sm" icon="done_all" [disabled]="!center.unreadIn(category()) || busy()" [loading]="busy()" (click)="markAll()">{{ i18n.t('Mark all read', 'Soma zote') }}</button>
      </div>
    </header>

    <lsms-segmented-filter-bar [options]="tabs()" [selected]="category()" (selectedChange)="setCategory($event)" />

    <section class="card">
      @if (error()) {
        <lsms-empty-state icon="error" iconColor="var(--c-error)" [title]="i18n.t('Could not load notifications', 'Imeshindikana kupakia arifa')" [message]="error()!" [secondaryActionLabel]="i18n.t('Retry', 'Jaribu tena')" (secondaryAction)="reload()" />
      } @else if (loading() && !items().length) {
        <lsms-skeleton variant="list" [rows]="6" />
      } @else if (!items().length) {
        <lsms-empty-state icon="notifications_off" [title]="unreadOnly() ? i18n.t('Nothing unread here', 'Hakuna zisizosomwa hapa') : i18n.t('No notifications yet', 'Hakuna arifa bado')" [message]="i18n.t('New alerts about debts, purchases and sales appear here.', 'Arifa mpya za madeni, manunuzi na mauzo zitaonekana hapa.')" />
      } @else {
        @for (d of days(); track d.label) {
          <h2 class="day">{{ d.label }}</h2>
          @for (r of d.rows; track r.key) {
            @let n = r.items[0];
            @let k = kind(n.type);
            <div class="item" [class.unread]="unreadIn(r)" [style.--tone]="k.color">
              <button type="button" class="main" (click)="open(r)">
                <span class="ico"><lsms-icon [name]="k.icon" [size]="20" /></span>
                <span class="txt">
                  <span class="top">
                    <strong>{{ r.items.length > 1 ? i18n.t(r.items.length + ' × ' + k.en, k.sw + ' × ' + r.items.length) : n.title || (i18n.isSwahili() ? k.sw : k.en) }}</strong>
                    <small>{{ ago(n.createdAt) }}</small>
                  </span>
                  <span class="msg">{{ r.items.length > 1 ? burstText(r) : n.message }}</span>
                  @if (r.items.length === 1) {
                    @if (n.type === 'PRICE_CHANGE') {
                      <span class="chips">
                        @if (n.newRetailPrice !== null) { <span>{{ i18n.t('Retail', 'Rejareja') }} {{ n.oldRetailPrice | money: { symbol: false } }} → <b>{{ n.newRetailPrice | money: { symbol: false } }}</b></span> }
                        @if (n.newWholesalePrice !== null) { <span>{{ i18n.t('Wholesale', 'Jumla') }} {{ n.oldWholesalePrice | money: { symbol: false } }} → <b>{{ n.newWholesalePrice | money: { symbol: false } }}</b></span> }
                        @if (n.newPurchasePrice !== null) { <span>{{ i18n.t('Cost', 'Gharama') }} {{ n.oldPurchasePrice | money: { symbol: false } }} → <b>{{ n.newPurchasePrice | money: { symbol: false } }}</b></span> }
                      </span>
                    } @else if (n.totalAmount !== null && n.type !== 'DEBT_COLLECTED') {
                      <span class="chips">
                        @if (n.totalCount !== null) { <span>{{ i18n.t('Sales', 'Mauzo') }} <b>{{ n.totalCount }}</b></span> }
                        <span>{{ i18n.t('Amount', 'Kiasi') }} <b>{{ n.totalAmount | money: { decimals: 0 } }}</b></span>
                        @if (n.totalProfit !== null) { <span>{{ i18n.t('Profit', 'Faida') }} <b>{{ n.totalProfit | money: { decimals: 0 } }}</b></span> }
                      </span>
                    }
                  }
                </span>
                @if (unreadIn(r)) { <span class="dot" [attr.aria-label]="i18n.t('Unread', 'Haijasomwa')"></span> }
              </button>
              @if (r.items.length > 1) {
                <button type="button" class="more" (click)="toggle(r.key)" [attr.aria-expanded]="expanded().has(r.key)"><lsms-icon [name]="expanded().has(r.key) ? 'expand_less' : 'expand_more'" [size]="20" /></button>
              }
            </div>
            @if (r.items.length > 1 && expanded().has(r.key)) {
              <div class="sub">
                @for (s of r.items; track s.uid) {
                  <button type="button" class="subitem" [class.unread]="!s.isRead" (click)="openOne(s)">
                    <span>{{ s.message }}</span><small>{{ date(s.createdAt) | date: 'HH:mm' }}</small>
                  </button>
                }
              </div>
            }
          }
        }
        @if (page() < pages()) {
          <div class="load"><button lsmsButton="secondary" size="sm" icon="expand_more" [loading]="loading()" (click)="loadMore()">{{ i18n.t('Load more', 'Pakia zaidi') }}</button></div>
        }
      }
    </section>
  `,
  styles: `
    :host { display: block; max-width: 920px; margin: 0 auto; padding: 8px 0 32px; }
    .head { display: flex; align-items: flex-end; justify-content: space-between; gap: 12px; flex-wrap: wrap; margin-bottom: 14px; }
    h1 { margin: 0; font-size: 1.35rem; }
    .head p { margin: 2px 0 0; color: var(--c-text-2); font-size: 0.86rem; }
    /* Phones: the app bar already says "Notifications". */
    @media (max-width: 767px) { .head h1 { display: none; } }
    .actions { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
    .toggle { display: inline-flex; align-items: center; gap: 6px; font-size: 0.84rem; color: var(--c-text-2); cursor: pointer; }
    .card { margin-top: 12px; border: 1px solid var(--c-border); border-radius: 16px; background: var(--c-surface); overflow: hidden; }
    .day { margin: 0; padding: 10px 16px 6px; font-size: 0.74rem; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; color: var(--c-text-2); background: color-mix(in srgb, var(--c-text) 3%, transparent); border-top: 1px solid var(--c-border); }
    .day:first-child { border-top: 0; }
    .item { --tone: var(--c-primary); display: flex; align-items: stretch; border-top: 1px solid var(--c-border); }
    .item.unread { background: color-mix(in srgb, var(--tone) 5%, transparent); box-shadow: inset 3px 0 0 var(--tone); }
    .main { flex: 1; display: flex; align-items: flex-start; gap: 12px; min-width: 0; padding: 12px 16px; border: 0; background: transparent; color: var(--c-text); font: inherit; text-align: left; cursor: pointer; }
    .main:hover { background: color-mix(in srgb, var(--tone) 6%, transparent); }
    .ico { flex: none; display: grid; place-items: center; width: 40px; height: 40px; border-radius: 12px; color: var(--tone); background: color-mix(in srgb, var(--tone) 12%, transparent); }
    .txt { flex: 1; display: flex; flex-direction: column; gap: 3px; min-width: 0; }
    .top { display: flex; justify-content: space-between; gap: 10px; }
    .top strong { font-size: 0.9rem; }
    .top small { flex: none; font-size: 0.72rem; color: var(--c-text-2); }
    .msg { font-size: 0.84rem; color: var(--c-text-2); overflow-wrap: anywhere; }
    .chips { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 4px; }
    .chips span { font-size: 0.74rem; padding: 2px 8px; border-radius: 999px; background: color-mix(in srgb, var(--c-text) 5%, transparent); }
    .dot { flex: none; width: 9px; height: 9px; margin-top: 6px; border-radius: 50%; background: var(--tone); }
    .more { flex: none; width: 44px; border: 0; border-left: 1px solid var(--c-border); background: transparent; color: var(--c-text-2); cursor: pointer; }
    .sub { display: flex; flex-direction: column; padding: 4px 16px 10px 68px; border-top: 1px dashed var(--c-border); }
    .subitem { display: flex; justify-content: space-between; gap: 10px; padding: 6px 8px; border: 0; border-radius: 8px; background: transparent; color: var(--c-text-2); font: inherit; font-size: 0.8rem; text-align: left; cursor: pointer; }
    .subitem.unread { color: var(--c-text); font-weight: 600; }
    .subitem:hover { background: color-mix(in srgb, var(--c-text) 5%, transparent); }
    .load { display: flex; justify-content: center; padding: 12px; border-top: 1px solid var(--c-border); }
    @media (max-width: 600px) { :host { padding: 8px 12px 24px; } .sub { padding-left: 16px; } }
  `,
})
export class NotificationsPage {
  protected readonly i18n = inject(LanguageService);
  protected readonly center = inject(NotificationCenter);
  private readonly dialogs = inject(DialogService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  private readonly statement = inject(CustomerStatementLauncher);

  protected readonly category = signal<NotificationCategory>('ALL');
  protected readonly unreadOnly = signal(false);
  protected readonly items = signal<AppNotification[]>([]);
  protected readonly page = signal(0);
  protected readonly pages = signal(1);
  protected readonly loading = signal(false);
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly expanded = signal<Set<string>>(new Set());
  private seq = 0;

  protected readonly kind = kindOf;

  protected readonly tabs = computed<SegmentOption<NotificationCategory>[]>(() => {
    const t = (en: string, sw: string) => this.i18n.t(en, sw);
    const c = (x: NotificationCategory) => this.center.unreadIn(x) || undefined;
    const tabs: SegmentOption<NotificationCategory>[] = [
      { value: 'ALL', label: t('All', 'Zote'), count: c('ALL') },
      { value: 'DEBT', label: t('Debt collections', 'Madeni yaliyolipwa'), icon: 'payments', count: c('DEBT') },
      { value: 'PURCHASES', label: t('Purchases', 'Manunuzi'), icon: 'shopping_cart', count: c('PURCHASES') },
      { value: 'SALES', label: t('Sales', 'Mauzo'), icon: 'bar_chart', count: c('SALES') },
      { value: 'PRICES', label: t('Prices', 'Bei'), icon: 'sell', count: c('PRICES') },
    ];
    if (this.center.unreadIn('SYSTEM')) tabs.push({ value: 'SYSTEM', label: t('System', 'Mfumo'), icon: 'warning', count: c('SYSTEM') });
    return tabs;
  });

  /** Grouped by day; consecutive same-type, same-person events within BURST_MS become one row. */
  protected readonly days = computed<Day[]>(() => {
    const out: Day[] = [];
    let row: Row | null = null;
    for (const n of this.items()) {
      const label = this.dayLabel(n.createdAt);
      let day = out[out.length - 1];
      if (!day || day.label !== label) {
        day = { label, rows: [] };
        out.push(day);
        row = null;
      }
      const prev = row?.items[row.items.length - 1];
      const t = parseLocal(n.createdAt)?.getTime() ?? 0;
      const pt = prev ? (parseLocal(prev.createdAt)?.getTime() ?? 0) : 0;
      if (row && prev && prev.type === n.type && n.type.startsWith('PURCHASE_') && prev.changedByName === n.changedByName && Math.abs(pt - t) <= BURST_MS) {
        row.items.push(n);
      } else {
        row = { key: n.uid, items: [n] };
        day.rows.push(row);
      }
    }
    return out;
  });

  constructor() {
    void this.reload();
  }

  protected setCategory(c: NotificationCategory): void {
    this.category.set(c);
    void this.reload();
  }

  protected setUnreadOnly(v: boolean): void {
    this.unreadOnly.set(v);
    void this.reload();
  }

  protected async reload(): Promise<void> {
    this.items.set([]);
    this.expanded.set(new Set());
    await this.fetch(0);
  }

  protected async loadMore(): Promise<void> {
    await this.fetch(this.page());
  }

  /** `index` is the 0-based page to fetch; `page()` holds how many pages are loaded. */
  private async fetch(index: number): Promise<void> {
    const mine = ++this.seq;
    this.loading.set(true);
    this.error.set(null);
    try {
      const res = await this.center.list(index, PAGE, this.category(), this.unreadOnly());
      if (mine !== this.seq) return;
      this.items.update((l) => (index === 0 ? res.items : [...l, ...res.items]));
      this.page.set(index + 1);
      this.pages.set(res.pages);
    } catch (e) {
      if (mine === this.seq) this.error.set(ApiError.from(e).message);
    } finally {
      if (mine === this.seq) this.loading.set(false);
    }
  }

  protected async markAll(): Promise<void> {
    this.busy.set(true);
    try {
      await this.center.markAllRead(this.category());
      this.items.update((l) => l.map((n) => ({ ...n, isRead: true })));
      if (this.unreadOnly()) await this.reload();
    } catch (e) {
      this.toast.error(ApiError.from(e).message);
    } finally {
      this.busy.set(false);
    }
  }

  protected toggle(key: string): void {
    const next = new Set(this.expanded());
    if (next.has(key)) next.delete(key);
    else next.add(key);
    this.expanded.set(next);
  }

  /** A burst row marks all its items read; a single row opens its subject. */
  protected async open(r: Row): Promise<void> {
    if (r.items.length > 1) {
      this.toggle(r.key);
      await Promise.all(r.items.filter((n) => !n.isRead).map((n) => this.markLocal(n)));
      return;
    }
    await this.openOne(r.items[0]);
  }

  protected async openOne(n: AppNotification): Promise<void> {
    void this.markLocal(n);
    try {
      switch (n.type) {
        case 'DEBT_COLLECTED':
          this.center.dismissBanner(n.uid);
          if (n.referenceUid) await this.statement.open(n.referenceUid);
          break;
        case 'PURCHASE_CREATED':
        case 'PURCHASE_APPROVED':
        case 'PURCHASE_RECEIVED':
          if (n.referenceUid) {
            const { PurchaseDetailsDialog } = await import('../purchases/purchase-details-dialog');
            await this.dialogs.openAsync(PurchaseDetailsDialog, { size: 'lg', data: { uid: n.referenceUid } });
          }
          break;
        case 'DAILY_SALES_SUMMARY':
        case 'PAST_DATE_SALE':
          await this.router.navigate(['/sales'], { queryParams: n.summaryDate ? { date: n.summaryDate.slice(0, 10) } : {} });
          break;
        case 'PRICE_CHANGE':
          await this.router.navigateByUrl('/products');
          break;
        case 'ORDER_SUGGESTION':
          await this.router.navigateByUrl('/purchases/suggestion');
          break;
      }
    } catch (e) {
      this.toast.error(ApiError.from(e).message);
    }
  }

  private async markLocal(n: AppNotification): Promise<void> {
    if (n.isRead) return;
    this.items.update((l) => l.map((x) => (x.uid === n.uid ? { ...x, isRead: true } : x)));
    await this.center.markRead(n).catch(() => undefined);
  }

  protected unreadIn(r: Row): boolean {
    return r.items.some((n) => !n.isRead);
  }

  protected burstText(r: Row): string {
    const who = r.items[0].changedByName;
    const first = r.items[r.items.length - 1].message;
    return (who ? this.i18n.t(`by ${who} · `, `na ${who} · `) : '') + first + (r.items.length > 1 ? this.i18n.t(` and ${r.items.length - 1} more`, ` na mengine ${r.items.length - 1}`) : '');
  }

  protected ago(v: string | null): string {
    const d = parseLocal(v);
    if (!d) return '';
    const s = Math.max(0, (Date.now() - d.getTime()) / 1000);
    const t = (en: string, sw: string) => this.i18n.t(en, sw);
    if (s < 60) return t('just now', 'sasa hivi');
    if (s < 3600) return t(`${Math.floor(s / 60)} min ago`, `dakika ${Math.floor(s / 60)} zilizopita`);
    if (s < 86400) return t(`${Math.floor(s / 3600)} h ago`, `saa ${Math.floor(s / 3600)} zilizopita`);
    return new DatePipe('en-US').transform(d, 'HH:mm') ?? '';
  }

  private dayLabel(v: string | null): string {
    const d = parseLocal(v);
    if (!d) return '—';
    const today = dayOnly(new Date()).getTime();
    const day = dayOnly(d).getTime();
    if (day === today) return this.i18n.t('Today', 'Leo');
    if (day === today - 86_400_000) return this.i18n.t('Yesterday', 'Jana');
    return new DatePipe('en-US').transform(d, 'EEE, dd MMM yyyy') ?? '';
  }

  protected date(v: string | null): Date | null {
    return parseLocal(v);
  }
}
