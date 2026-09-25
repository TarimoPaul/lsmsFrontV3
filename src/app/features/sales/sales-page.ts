import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { ApiError } from '@core/api/api.types';
import { AuthService } from '@core/auth/auth.service';
import { BusinessService } from '@core/data/business.service';
import { LanguageService } from '@core/i18n/language.service';
import {
  ActionMenu,
  Button,
  DashboardKpiCard,
  DashboardKpiRow,
  DashboardPeakCard,
  DashboardRevenueCard,
  DashboardTodaySection,
  DataTable,
  DateRangeSelector,
  DialogService,
  EmptyState,
  ExportFormat,
  ExportToolbar,
  FilterPanel,
  Icon,
  MenuAction,
  PageHeader,
  PaymentStatusBadge,
  SegmentOption,
  SegmentedFilterBar,
  TableColumn,
  ToastService,
} from '@shared/ui';
import { DateRange, addDays, dayOnly, endOfDay, formatRangeLabel, isSameDay, parseLocal, rangeForPreset, toLocalDateTime } from '@shared/utils/date-utils';
import { downloadCsv, printReport } from '@shared/utils/export';
import { Money, MoneyPipe } from '@shared/utils/money';
import type { SaleDetailsResult } from './sale-details-dialog';
import { printReceipt } from './receipt';
import { Sale, SalesSummary, methodLabel, shortReceipt } from './sales.models';
import { DebtApprovalsPanel } from './debt-approvals-panel';
import { ProfitPanel } from './profit-panel';
import { ReturnsPanel } from './returns-panel';
import { SalesService } from './sales.service';

type Period = 'current' | 'today' | 'week' | 'month' | 'custom';
type Status = 'ALL' | 'OWING' | 'PAID' | 'RETURNED';
type View = 'sales' | 'profit' | 'returns' | 'debts';

/**
 * Sales — port of Flutter `SalesDashboard`: the last day with sales opens by
 * default ("Current"), KPIs + hourly charts from the server summary, and the
 * period's sales (lines + payments embedded) filtered client-side. Row
 * actions: details, receipt, receive payment, delete. The till is /sales/new.
 */
@Component({
  selector: 'app-sales-page',
  imports: [
    RouterLink,
    PageHeader,
    Button,
    DashboardKpiRow,
    DashboardKpiCard,
    DashboardTodaySection,
    DashboardRevenueCard,
    DashboardPeakCard,
    FilterPanel,
    SegmentedFilterBar,
    DateRangeSelector,
    DataTable,
    TableColumn,
    ActionMenu,
    ExportToolbar,
    EmptyState,
    Icon,
    PaymentStatusBadge,
    ReturnsPanel,
    ProfitPanel,
    DebtApprovalsPanel,
    MoneyPipe,
    DatePipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './sales-page.html',
  styleUrl: './sales-page.scss',
})
export class SalesPage {
  protected readonly auth = inject(AuthService);
  protected readonly i18n = inject(LanguageService);
  private readonly api = inject(SalesService);
  private readonly business = inject(BusinessService);
  private readonly dialogs = inject(DialogService);
  private readonly toast = inject(ToastService);

  protected readonly view = signal<View>('sales');
  protected readonly period = signal<Period>('current');
  protected readonly custom = signal<DateRange>(rangeForPreset('thisMonth'));
  /** Last day with any sale (from the server) — the "Current" period. */
  private readonly lastActive = signal<Date | null>(null);
  protected readonly sales = signal<Sale[]>([]);
  protected readonly summary = signal<SalesSummary | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly search = signal('');
  protected readonly status = signal<Status>('ALL');

  protected readonly canWrite = computed(() => this.auth.hasPermission('SALES_WRITE'));
  protected readonly canPay = computed(() => this.auth.hasPermission('PAYMENT_WRITE'));
  protected readonly canDelete = computed(() => this.auth.hasPermission('SALES_DELETE'));
  protected readonly canAnalytics = computed(() => this.auth.hasPermission('SALES_ANALYTICS'));
  protected readonly canReturns = computed(() => this.auth.hasPermission('SALES_RETURN_READ'));
  protected readonly canProfit = computed(() => this.auth.hasPermission('SALES_VIEW_PROFIT'));
  protected readonly views = computed<SegmentOption<View>[]>(() => {
    const v: SegmentOption<View>[] = [{ value: 'sales', label: this.i18n.t('Sales', 'Mauzo'), icon: 'point_of_sale' }];
    if (this.canProfit()) v.push({ value: 'profit', label: this.i18n.t('Profit', 'Faida'), icon: 'trending_up' });
    if (this.canReturns()) v.push({ value: 'returns', label: this.i18n.t('Returns', 'Marejesho'), icon: 'assignment_return' });
    if (this.auth.hasPermission('DEBT_ADJUST_APPROVE')) v.push({ value: 'debts', label: this.i18n.t('Debt approvals', 'Idhini za madeni'), icon: 'how_to_reg' });
    return v;
  });

  protected readonly rowId = (s: Sale) => s.uid;
  protected readonly titleOf = (s: Sale) => s.customerName ?? shortReceipt(s.receiptNumber);
  protected readonly dateOf = (s: Sale) => s.saleDate ?? '';
  protected readonly totalOf = (s: Sale) => s.total;
  protected readonly balanceOf = (s: Sale) => s.balance;
  protected readonly customerOf = (s: Sale) => s.customerName ?? '';
  protected readonly short = shortReceipt;
  protected readonly hours = Array.from({ length: 24 }, (_, h) => `${String(h).padStart(2, '0')}:00`);

  /** The window being shown. */
  protected readonly range = computed<DateRange>(() => {
    switch (this.period()) {
      case 'current': {
        const d = this.lastActive() ?? new Date();
        return { start: dayOnly(d), end: endOfDay(d) };
      }
      case 'today':
        return rangeForPreset('today');
      case 'week':
        return rangeForPreset('thisWeek');
      case 'month':
        return rangeForPreset('thisMonth');
      default:
        return this.custom();
    }
  });

  protected readonly periodLabel = computed(() => {
    const r = this.range();
    const t = (en: string, sw: string) => this.i18n.t(en, sw);
    if (isSameDay(r.start, r.end)) {
      const today = new Date();
      if (isSameDay(r.start, today)) return t('Today', 'Leo');
      if (isSameDay(r.start, addDays(today, -1))) return t('Yesterday', 'Jana');
    }
    return formatRangeLabel(r);
  });

  protected readonly periods = computed<SegmentOption<Period>[]>(() => {
    const t = (en: string, sw: string) => this.i18n.t(en, sw);
    return [
      { value: 'current', label: t('Current', 'Sasa hivi'), icon: 'bolt' },
      { value: 'today', label: t('Today', 'Leo') },
      { value: 'week', label: t('This week', 'Wiki hii') },
      { value: 'month', label: t('This month', 'Mwezi huu') },
    ];
  });

  protected readonly statusOptions = computed<SegmentOption<Status>[]>(() => {
    const list = this.sales();
    const t = (en: string, sw: string) => this.i18n.t(en, sw);
    return [
      { value: 'ALL', label: t('All', 'Yote'), count: list.length },
      { value: 'OWING', label: t('Owing', 'Yenye deni'), icon: 'account_balance_wallet', count: list.filter((s) => s.balance > 0).length },
      { value: 'PAID', label: t('Paid', 'Yamelipwa'), icon: 'task_alt', count: list.filter((s) => s.balance === 0).length },
      { value: 'RETURNED', label: t('Returns', 'Marejesho'), icon: 'assignment_return', count: list.filter((s) => s.hasReturn).length },
    ];
  });

  protected readonly rows = computed(() => {
    const q = this.search().trim().toLowerCase();
    const f = this.status();
    return this.sales().filter((s) => {
      if (f === 'OWING' && s.balance <= 0) return false;
      if (f === 'PAID' && s.balance > 0) return false;
      if (f === 'RETURNED' && !s.hasReturn) return false;
      return !q || s.haystack.includes(q);
    });
  });

  /** Figures for the KPI cards — the summary when allowed, else folded from the rows. */
  protected readonly kpi = computed(() => {
    const s = this.summary();
    const list = this.sales();
    if (s) return { ...s, peak: peakWindow(s.hourlyOrders) };
    const revenue = list.reduce((n, x) => n + x.total, 0);
    const owing = list.filter((x) => x.balance > 0);
    const orders = new Array(24).fill(0);
    const hourly = new Array(24).fill(0);
    for (const x of list) {
      const h = parseLocal(x.saleDate)?.getHours() ?? 0;
      orders[h]++;
      hourly[h] += x.total;
    }
    return {
      count: list.length,
      revenue,
      discount: list.reduce((n, x) => n + x.discount, 0),
      paid: list.reduce((n, x) => n + x.paid, 0),
      paidPct: 0,
      pending: owing.length,
      completed: list.length - owing.length,
      allTimeOutstanding: null as number | null,
      allTimePending: 0,
      windowOutstanding: owing.reduce((n, x) => n + x.balance, 0),
      lastActiveDate: null,
      hourlyRevenue: hourly,
      hourlyOrders: orders,
      peak: peakWindow(orders),
    };
  });

  constructor() {
    void this.init();
    void this.business.profile.load().catch(() => undefined);
  }

  private async init(): Promise<void> {
    // Bootstrap: the summary carries the (unbounded) last day with sales.
    if (this.canAnalytics()) {
      try {
        const now = toLocalDateTime(new Date());
        const s = await this.api.summary(now, now, false);
        this.lastActive.set(parseLocal(s.lastActiveDate));
      } catch {
        // Fall back to today.
      }
    }
    await this.refresh();
  }

  protected async refresh(): Promise<void> {
    const r = this.range();
    const start = toLocalDateTime(r.start);
    const end = toLocalDateTime(endOfDay(r.end));
    this.loading.set(true);
    this.error.set(null);
    const summary = this.canAnalytics() ? this.api.summary(start, end).catch(() => null) : Promise.resolve(null);
    try {
      const [rows, sum] = await Promise.all([this.api.list(start, end), summary]);
      // Ignore a response for a period the user has already left.
      if (this.range() !== r) return;
      this.sales.set(rows);
      this.summary.set(sum);
    } catch (e) {
      const err = ApiError.from(e);
      this.error.set(err.isForbidden ? this.i18n.t('You are not allowed to view sales.', 'Huruhusiwi kuona mauzo.') : err.message);
    } finally {
      if (this.range() === r) this.loading.set(false);
    }
  }

  protected setPeriod(p: Period): void {
    this.period.set(p);
    void this.refresh();
  }

  /** A calendar month shown whole (This month, or a picked full month). */
  private isMonth(r: DateRange): boolean {
    return this.period() === 'month' || (r.start.getDate() === 1 && addDays(dayOnly(r.end), 1).getDate() === 1 && r.start.getMonth() === r.end.getMonth());
  }

  private spanDays(r: DateRange): number {
    return Math.round((dayOnly(r.end).getTime() - dayOnly(r.start).getTime()) / 864e5) + 1;
  }

  protected readonly canStepNext = computed(() => dayOnly(this.range().end) < dayOnly(new Date()));

  protected stepLabel(dir: -1 | 1): string {
    const r = this.range();
    const t = (en: string, sw: string) => this.i18n.t(en, sw);
    if (this.isMonth(r)) return dir < 0 ? t('Previous month', 'Mwezi uliopita') : t('Next month', 'Mwezi unaofuata');
    if (this.spanDays(r) === 1) return dir < 0 ? t('Previous day', 'Siku iliyopita') : t('Next day', 'Siku inayofuata');
    return dir < 0 ? t('Previous period', 'Kipindi kilichopita') : t('Next period', 'Kipindi kinachofuata');
  }

  /**
   * ‹ / › beside the period: move the same-sized window one step back or
   * forward (a day, a week, a whole month) without opening the date picker.
   * Never goes past today; landing on today selects the Today chip.
   */
  protected step(dir: -1 | 1): void {
    if (dir > 0 && !this.canStepNext()) return;
    const r = this.range();
    const today = dayOnly(new Date());
    let start: Date;
    let end: Date;
    if (this.isMonth(r)) {
      start = new Date(r.start.getFullYear(), r.start.getMonth() + dir, 1);
      end = new Date(start.getFullYear(), start.getMonth() + 1, 0);
    } else if (this.period() === 'week') {
      // "This week" ends today; step whole weeks.
      start = addDays(dayOnly(r.start), 7 * dir);
      end = addDays(start, 6);
    } else {
      const n = this.spanDays(r) * dir;
      start = addDays(dayOnly(r.start), n);
      end = addDays(dayOnly(r.end), n);
    }
    if (end > today) end = today;
    if (isSameDay(start, today) && isSameDay(end, today)) {
      this.setPeriod('today');
      return;
    }
    this.setCustom({ start, end: endOfDay(end) });
  }

  protected setCustom(r: DateRange): void {
    this.custom.set(r);
    this.period.set('custom');
    void this.refresh();
  }

  protected date(v: string | null): Date | null {
    return parseLocal(v);
  }

  protected itemsText(s: Sale): string {
    const names = s.lines.map((l) => l.productName);
    return names.length <= 2 ? names.join(', ') : `${names.slice(0, 2).join(', ')} +${names.length - 2}`;
  }

  protected methodText(s: Sale): string {
    const ms = [...new Set(s.payments.map((p) => p.method))];
    return ms.length ? ms.map((m) => methodLabel(m, this.i18n.isSwahili())).join(' + ') : this.i18n.t('Credit', 'Mkopo');
  }

  protected actions(s: Sale): MenuAction[] {
    const t = (en: string, sw: string) => this.i18n.t(en, sw);
    const list: MenuAction[] = [
      { label: t('View details', 'Angalia taarifa'), icon: 'visibility', run: () => void this.openDetails(s) },
      { label: t('Print receipt', 'Chapisha risiti'), icon: 'print', run: () => this.print(s) },
    ];
    if (s.balance > 0 && this.canPay()) list.push({ label: t('Receive payment', 'Pokea malipo'), icon: 'payments', run: () => void this.pay(s) });
    if (this.canDelete()) list.push({ label: t('Delete', 'Futa'), icon: 'delete', destructive: true, run: () => void this.remove(s) });
    return list;
  }

  protected print(s: Sale): void {
    printReceipt(s, this.business.profile.value(), this.i18n.isSwahili());
  }

  protected async openDetails(s: Sale): Promise<void> {
    const { SaleDetailsDialog } = await import('./sale-details-dialog');
    const res = await this.dialogs.openAsync<SaleDetailsResult>(SaleDetailsDialog, { size: 'lg', data: { sale: s } });
    if (res === 'changed') void this.refresh();
  }

  protected async pay(s: Sale): Promise<void> {
    const { SalePaymentDialog } = await import('./sale-payment-dialog');
    const fresh = await this.dialogs.openAsync<Sale>(SalePaymentDialog, { size: 'sm', data: { sale: s } });
    if (fresh) void this.refresh();
  }

  protected async openDeleted(): Promise<void> {
    const { DeletedSalesDialog } = await import('./deleted-sales-dialog');
    if (await this.dialogs.openAsync<boolean>(DeletedSalesDialog, { size: 'md' })) void this.refresh();
  }

  protected async remove(s: Sale): Promise<void> {
    const ok = await this.dialogs.confirmDelete({
      title: this.i18n.t(`Delete sale ${s.receiptNumber}?`, `Futa mauzo ${s.receiptNumber}?`),
      message: this.i18n.t(
        `The ${s.lines.length} item(s) go back into stock and ${Money.format(s.total)} is removed from sales. It can be restored later.`,
        `Bidhaa ${s.lines.length} zitarudi stoo na ${Money.format(s.total)} vitaondolewa kwenye mauzo. Yanaweza kurejeshwa baadaye.`,
      ),
    });
    if (!ok) return;
    try {
      await this.api.remove(s.uid);
      this.toast.success(this.i18n.t('Sale deleted', 'Mauzo yamefutwa'));
      void this.refresh();
    } catch (e) {
      this.toast.error(ApiError.from(e).message);
    }
  }

  protected showStatus(s: Status): void {
    this.status.set(s);
  }

  protected export(format: ExportFormat): void {
    const t = (en: string, sw: string) => this.i18n.t(en, sw);
    const list = this.rows();
    if (!list.length) {
      this.toast.info(t('Nothing to export', 'Hakuna cha kuhamisha'));
      return;
    }
    const headers = [t('Date', 'Tarehe'), t('Receipt', 'Risiti'), t('Customer', 'Mteja'), t('Items', 'Bidhaa'), t('Total', 'Jumla'), t('Paid', 'Imelipwa'), t('Balance', 'Deni'), t('Method', 'Njia'), t('Seller', 'Muuzaji')];
    const rows = list.map((s) => [
      (s.saleDate ?? '').replace('T', ' ').slice(0, 16),
      s.receiptNumber,
      s.customerName ?? '',
      s.lines.map((l) => `${l.productName} ×${l.saleType === 'PIECES' ? l.pieces : l.packages}`).join('; '),
      s.total,
      s.paid,
      s.balance,
      this.methodText(s),
      s.seller ?? '',
    ]);
    if (format === 'csv') {
      downloadCsv('sales', headers, rows);
      this.toast.success(t(`${list.length} sales exported`, `Mauzo ${list.length} yamehamishwa`));
      return;
    }
    printReport({
      title: t('Sales', 'Mauzo'),
      subtitle: this.periodLabel(),
      headers: ['#', ...headers],
      rows: rows.map((r, i) => [i + 1, ...r.map((v, j) => (j >= 4 && j <= 6 && typeof v === 'number' ? Money.format(v, { symbol: false }) : v))]),
      summary: [
        [t('Sales', 'Mauzo'), list.length],
        [t('Total', 'Jumla'), Money.format(list.reduce((n, s) => n + s.total, 0))],
        [t('Paid', 'Imelipwa'), Money.format(list.reduce((n, s) => n + s.paid, 0))],
        [t('Owed', 'Deni'), Money.format(list.reduce((n, s) => n + s.balance, 0))],
      ],
      numeric: [0, 5, 6, 7],
    });
  }
}

/** Busiest hour → "11:00 – 13:00" + share of orders. */
function peakWindow(orders: number[]): { label: string; pct: number; total: number } {
  const total = orders.reduce((a, b) => a + b, 0);
  if (!total) return { label: '—', pct: 0, total: 0 };
  let h = 0;
  for (let i = 1; i < orders.length; i++) if (orders[i] > orders[h]) h = i;
  const f = (x: number) => `${String(x % 24).padStart(2, '0')}:00`;
  return { label: `${f(h)} – ${f(h + 2)}`, pct: Math.round((orders[h] / total) * 100), total };
}
