import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';

import { ApiError } from '@core/api/api.types';
import { AuthService } from '@core/auth/auth.service';
import { LanguageService } from '@core/i18n/language.service';
import { DataTable, EmptyState, Icon, MetricCard, MetricsGrid, SegmentOption, SegmentedFilterBar, Skeleton, TableColumn } from '@shared/ui';
import { DateRange, parseLocal, rangeForPreset, toIsoDate, toLocalDateTime } from '@shared/utils/date-utils';
import { Cell, downloadCsv, printReport } from '@shared/utils/export';
import { Money } from '@shared/utils/money';
import { GlService } from '../general-ledger/gl.service';
import { Sale, methodLabel } from '../sales/sales.models';
import { SalesService } from '../sales/sales.service';
import { ReportFrame } from './report-frame';

type View = 'day' | 'staff' | 'product' | 'payment';

interface DayRow { uid: string; date: string; count: number; revenue: number; profit: number; paid: number; owed: number; discount: number; customers: number }
interface StaffRow { uid: string; name: string; count: number; revenue: number; profit: number; paid: number; owed: number; share: number; first: string | null; last: string | null }
interface ProductRow { uid: string; name: string; category: string; pieces: number; lines: number; revenue: number; cost: number; profit: number; margin: number | null }
interface PayRow { uid: string; method: string; count: number; amount: number; share: number }

/**
 * Sales report built from the sales register (the same rows the Sales module
 * lists, with their lines and payments). Money received is summed from each
 * sale's payments — the sale-level payment_status the old server report used
 * is stale on many rows — and the period total is checked against the GL.
 */
@Component({
  selector: 'app-sales-report',
  imports: [ReportFrame, SegmentedFilterBar, MetricCard, MetricsGrid, Skeleton, EmptyState, Icon, DataTable, TableColumn],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-report-frame report="sales" [range]="range()" [hasFilters]="true" (rangeChange)="setRange($event)" (refresh)="load()" (csv)="csv()" (print)="print()">
      <lsms-segmented-filter-bar filters [options]="views()" [selected]="view()" (selectedChange)="view.set($event)" />

      @if (error()) {
        <lsms-empty-state icon="cloud_off" [title]="i18n.t('Could not load sales', 'Mauzo hayakupatikana')" [message]="error()" />
      } @else if (!sales()) {
        <lsms-skeleton variant="list" [rows]="6" />
      } @else {
        @let k = kpi();
        <lsms-metrics-grid [gap]="12">
          <lsms-metric-card [title]="i18n.t('Sales', 'Mauzo')" [value]="m(k.revenue)" icon="point_of_sale" color="var(--c-success)" [subtitle]="k.count + ' ' + i18n.t('receipts', 'risiti') + (k.discount ? ' · ' + i18n.t('discount ', 'punguzo ') + m(k.discount) : '')" />
          @if (canProfit()) {
            <lsms-metric-card [title]="i18n.t('Gross profit', 'Faida ghafi')" [value]="m(k.profit)" icon="trending_up" color="var(--c-info)" [subtitle]="pct(k.profit, k.revenue) + ' ' + i18n.t('margin', 'ya mauzo')" />
          }
          <lsms-metric-card [title]="i18n.t('Money received', 'Pesa iliyopokelewa')" [value]="m(k.paid)" icon="payments" color="var(--c-primary)" [subtitle]="pct(k.paid, k.revenue) + ' ' + i18n.t('of sales', 'ya mauzo')" />
          <lsms-metric-card [title]="i18n.t('Still owed', 'Bado inadaiwa')" [value]="m(k.owed)" icon="request_quote" color="var(--c-warning)" [subtitle]="k.owedCount + ' ' + i18n.t('receipts on credit', 'risiti za mkopo')" />
        </lsms-metrics-grid>

        @if (glCheck(); as g) {
          <p class="xcheck" [class.bad]="!g.ok">
            <lsms-icon [name]="g.ok ? 'verified' : 'info'" [size]="17" />
            @if (g.ok) {
              {{ i18n.t('Matches the General Ledger: net sales', 'Inalingana na Leja Kuu: mauzo halisi') }} <b>{{ m(g.gl) }}</b>
            } @else {
              {{ i18n.t('General Ledger net sales', 'Mauzo halisi kwenye Leja Kuu') }} <b>{{ m(g.gl) }}</b> —
              {{ i18n.t('difference', 'tofauti') }} <b>{{ m(g.diff) }}</b>
              ({{ i18n.t('returns, restored or back-dated sales', 'marejesho, mauzo yaliyorejeshwa au ya tarehe za nyuma') }})
            }
          </p>
        }

        @switch (view()) {
          @case ('day') {
            <section class="card flush">
              <lsms-data-table [items]="days()" title="days" [showHeader]="false" [pageSize]="31" defaultSortColumn="date" defaultSortDirection="desc" [mobileTitle]="dayTitle" [emptyTitle]="i18n.t('No sales in this period', 'Hakuna mauzo katika kipindi hiki')">
                <ng-template lsmsColumn="date" [label]="i18n.t('Date', 'Tarehe')" [sortBy]="byDate" let-row><strong>{{ dayLabel(row.date) }}</strong></ng-template>
                <ng-template lsmsColumn="count" [label]="i18n.t('Receipts', 'Risiti')" align="end" [sortBy]="byCount" let-row><span class="num">{{ row.count }}</span></ng-template>
                <ng-template lsmsColumn="revenue" [label]="i18n.t('Sales', 'Mauzo')" align="end" [sortBy]="byRevenue" let-row><span class="num strong">{{ m(row.revenue) }}</span></ng-template>
                @if (canProfit()) {
                  <ng-template lsmsColumn="profit" [label]="i18n.t('Profit', 'Faida')" align="end" [sortBy]="byProfit" let-row><span class="num" [class.neg]="row.profit < 0">{{ m(row.profit) }}</span></ng-template>
                  <ng-template lsmsColumn="margin" label="%" align="end" let-row><span class="num muted">{{ pct(row.profit, row.revenue) }}</span></ng-template>
                }
                <ng-template lsmsColumn="paid" [label]="i18n.t('Received', 'Imepokelewa')" align="end" let-row><span class="num">{{ m(row.paid) }}</span></ng-template>
                <ng-template lsmsColumn="owed" [label]="i18n.t('On credit', 'Mkopo')" align="end" [sortBy]="byOwed" let-row><span class="num" [class.muted]="!row.owed">{{ m(row.owed) }}</span></ng-template>
                <ng-template lsmsColumn="avg" [label]="i18n.t('Avg. receipt', 'Wastani/risiti')" align="end" let-row><span class="num muted">{{ m(row.revenue / row.count) }}</span></ng-template>
                <ng-template lsmsColumn="customers" [label]="i18n.t('Named customers', 'Wateja')" align="end" [hidden]="true" let-row><span class="num">{{ row.customers }}</span></ng-template>
              </lsms-data-table>
            </section>
          }
          @case ('staff') {
            <section class="card flush">
              <lsms-data-table [items]="staff()" title="staff" [showHeader]="false" defaultSortColumn="revenue" defaultSortDirection="desc" [mobileTitle]="staffTitle" [emptyTitle]="i18n.t('No sales in this period', 'Hakuna mauzo katika kipindi hiki')">
                <ng-template lsmsColumn="name" [label]="i18n.t('Staff', 'Mfanyakazi')" [sortBy]="byStaffName" let-row>
                  <span class="cell-stack"><strong>{{ row.name }}</strong><small>{{ i18n.t('last sale', 'mauzo ya mwisho') }} {{ dayLabel(row.last) }}</small></span>
                </ng-template>
                <ng-template lsmsColumn="count" [label]="i18n.t('Receipts', 'Risiti')" align="end" [sortBy]="byCount" let-row><span class="num">{{ row.count }}</span></ng-template>
                <ng-template lsmsColumn="revenue" [label]="i18n.t('Sales', 'Mauzo')" align="end" [sortBy]="byRevenue" let-row><span class="num strong">{{ m(row.revenue) }}</span></ng-template>
                <ng-template lsmsColumn="share" [label]="i18n.t('Share', 'Sehemu')" let-row><span class="share"><span class="track"><i [style.width.%]="row.share"></i></span>{{ row.share.toFixed(0) }}%</span></ng-template>
                @if (canProfit()) {
                  <ng-template lsmsColumn="profit" [label]="i18n.t('Profit', 'Faida')" align="end" [sortBy]="byProfit" let-row><span class="num">{{ m(row.profit) }}</span></ng-template>
                }
                <ng-template lsmsColumn="paid" [label]="i18n.t('Received', 'Imepokelewa')" align="end" let-row><span class="num">{{ m(row.paid) }}</span></ng-template>
                <ng-template lsmsColumn="owed" [label]="i18n.t('On credit', 'Mkopo')" align="end" [sortBy]="byOwed" let-row><span class="num" [class.muted]="!row.owed">{{ m(row.owed) }}</span></ng-template>
                <ng-template lsmsColumn="avg" [label]="i18n.t('Avg. receipt', 'Wastani/risiti')" align="end" let-row><span class="num muted">{{ m(row.revenue / row.count) }}</span></ng-template>
              </lsms-data-table>
            </section>
          }
          @case ('product') {
            <section class="card flush">
              <lsms-data-table [items]="products()" title="products" [showHeader]="false" [pageSize]="25" [defaultSortColumn]="canProfit() ? 'profit' : 'revenue'" defaultSortDirection="desc" [mobileTitle]="productTitle" [emptyTitle]="i18n.t('No sales in this period', 'Hakuna mauzo katika kipindi hiki')">
                <ng-template lsmsColumn="name" [label]="i18n.t('Product', 'Bidhaa')" [sortBy]="byProductName" let-row>
                  <span class="cell-stack"><strong>{{ row.name }}</strong><small>{{ row.category }}</small></span>
                </ng-template>
                <ng-template lsmsColumn="pieces" [label]="i18n.t('Pieces sold', 'Vipande')" align="end" [sortBy]="byPieces" let-row><span class="num">{{ row.pieces.toLocaleString() }}</span></ng-template>
                <ng-template lsmsColumn="revenue" [label]="i18n.t('Sales', 'Mauzo')" align="end" [sortBy]="byRevenue" let-row><span class="num strong">{{ m(row.revenue) }}</span></ng-template>
                @if (canProfit()) {
                  <ng-template lsmsColumn="cost" [label]="i18n.t('Cost', 'Gharama')" align="end" let-row><span class="num muted">{{ m(row.cost) }}</span></ng-template>
                  <ng-template lsmsColumn="profit" [label]="i18n.t('Profit', 'Faida')" align="end" [sortBy]="byProfit" let-row><span class="num strong" [class.neg]="row.profit < 0">{{ m(row.profit) }}</span></ng-template>
                  <ng-template lsmsColumn="margin" [label]="i18n.t('Margin', 'Asilimia')" align="end" [sortBy]="byMargin" let-row>
                    @if (row.margin !== null) { <span class="status" [style.--st]="row.margin < 0 ? 'var(--c-error)' : row.margin < 5 ? 'var(--c-warning)' : 'var(--c-success)'">{{ row.margin.toFixed(1) }}%</span> } @else { <span class="muted">—</span> }
                  </ng-template>
                }
              </lsms-data-table>
            </section>
          }
          @case ('payment') {
            <section class="card">
              <header><h4>{{ i18n.t('Money received by method', 'Pesa iliyopokelewa kwa njia') }}</h4><small>{{ i18n.t('payments recorded on these receipts', 'malipo ya risiti hizi') }}</small></header>
              @if (payments().length) {
                <ul class="bars">
                  @for (p of payments(); track p.uid) {
                    <li>
                      <span class="nm">{{ p.method }} <small>{{ p.count }} ×</small></span>
                      <span class="track"><i [style.width.%]="p.share"></i></span>
                      <b>{{ m(p.amount) }}</b>
                    </li>
                  }
                </ul>
              } @else {
                <p class="muted pad">{{ i18n.t('No payments in this period', 'Hakuna malipo katika kipindi hiki') }}</p>
              }
            </section>
          }
        }
      }
    </app-report-frame>
  `,
  styleUrl: './report.scss',
  styles: `
    .share { display: inline-flex; align-items: center; gap: 8px; min-width: 120px; font-size: 0.76rem; color: var(--c-text-2); }
    .share .track { flex: 1; height: 6px; border-radius: 3px; background: color-mix(in srgb, var(--c-text-2) 12%, transparent); overflow: hidden; }
    .share .track i { display: block; height: 100%; background: var(--c-success); border-radius: 3px; }
  `,
})
export class SalesReport {
  protected readonly i18n = inject(LanguageService);
  private readonly api = inject(SalesService);
  private readonly gl = inject(GlService);
  private readonly auth = inject(AuthService);

  protected readonly canProfit = computed(() => this.auth.hasAnyPermission(['PROFIT_REPORT', 'FINANCE_READ']));
  private readonly canGl = computed(() => this.auth.hasPermission('FINANCE_READ'));

  protected readonly range = signal<DateRange>(rangeForPreset('thisMonth'));
  protected readonly view = signal<View>('day');
  protected readonly sales = signal<Sale[] | null>(null);
  protected readonly glNet = signal<number | null>(null);
  protected readonly error = signal('');

  protected readonly views = computed<SegmentOption<View>[]>(() => [
    { value: 'day', label: this.i18n.t('By day', 'Kwa siku'), icon: 'calendar_month' },
    { value: 'staff', label: this.i18n.t('By staff', 'Kwa mfanyakazi'), icon: 'badge' },
    { value: 'product', label: this.i18n.t('By product', 'Kwa bidhaa'), icon: 'inventory_2' },
    { value: 'payment', label: this.i18n.t('Payments', 'Malipo'), icon: 'payments' },
  ]);

  private readonly rows = computed(() => this.sales() ?? []);
  private profitOf(s: Sale): number {
    return s.profit ?? s.lines.reduce((a, l) => a + (l.profit ?? 0), 0);
  }

  protected readonly kpi = computed(() => {
    const r = this.rows();
    return {
      count: r.length,
      revenue: r.reduce((a, s) => a + s.total, 0),
      discount: r.reduce((a, s) => a + s.discount, 0),
      profit: r.reduce((a, s) => a + this.profitOf(s), 0),
      paid: r.reduce((a, s) => a + s.paid, 0),
      owed: r.reduce((a, s) => a + s.balance, 0),
      owedCount: r.filter((s) => s.balance > 0).length,
    };
  });

  protected readonly glCheck = computed(() => {
    const gl = this.glNet();
    if (gl === null) return null;
    const diff = gl - this.kpi().revenue;
    return { gl, diff, ok: Math.abs(diff) < 1 };
  });

  protected readonly days = computed<DayRow[]>(() => {
    const map = new Map<string, DayRow & { set: Set<string> }>();
    for (const s of this.rows()) {
      const d = (s.saleDate ?? '').slice(0, 10) || '—';
      const row = map.get(d) ?? { uid: d, date: d, count: 0, revenue: 0, profit: 0, paid: 0, owed: 0, discount: 0, customers: 0, set: new Set<string>() };
      row.count++;
      row.revenue += s.total;
      row.profit += this.profitOf(s);
      row.paid += s.paid;
      row.owed += s.balance;
      row.discount += s.discount;
      if (s.customerUid) row.set.add(s.customerUid);
      row.customers = row.set.size;
      map.set(d, row);
    }
    return [...map.values()];
  });

  protected readonly staff = computed<StaffRow[]>(() => {
    const total = this.kpi().revenue || 1;
    const map = new Map<string, StaffRow>();
    for (const s of this.rows()) {
      const name = s.seller ?? this.i18n.t('Unknown', 'Haijulikani');
      const row = map.get(name) ?? { uid: name, name, count: 0, revenue: 0, profit: 0, paid: 0, owed: 0, share: 0, first: s.saleDate, last: s.saleDate };
      row.count++;
      row.revenue += s.total;
      row.profit += this.profitOf(s);
      row.paid += s.paid;
      row.owed += s.balance;
      if ((s.saleDate ?? '') > (row.last ?? '')) row.last = s.saleDate;
      if ((s.saleDate ?? '') < (row.first ?? '￿')) row.first = s.saleDate;
      map.set(name, row);
    }
    return [...map.values()].map((r) => ({ ...r, share: (r.revenue / total) * 100 }));
  });

  protected readonly products = computed<ProductRow[]>(() => {
    const map = new Map<string, ProductRow>();
    for (const s of this.rows()) {
      for (const l of s.lines) {
        const row = map.get(l.productUid) ?? { uid: l.productUid, name: l.productName, category: l.category ?? '—', pieces: 0, lines: 0, revenue: 0, cost: 0, profit: 0, margin: null };
        row.pieces += l.pieces;
        row.lines++;
        row.revenue += l.subTotal;
        const profit = l.profit ?? (l.costPerPiece !== null ? l.subTotal - l.costPerPiece * l.pieces : 0);
        row.profit += profit;
        row.cost += l.subTotal - profit;
        map.set(l.productUid, row);
      }
    }
    return [...map.values()].map((r) => ({ ...r, margin: r.revenue ? (r.profit / r.revenue) * 100 : null }));
  });

  protected readonly payments = computed<PayRow[]>(() => {
    const map = new Map<string, PayRow>();
    for (const s of this.rows()) {
      for (const p of s.payments) {
        const key = (p.method || 'CASH').toUpperCase();
        const row = map.get(key) ?? { uid: key, method: methodLabel(key, this.i18n.isSwahili()), count: 0, amount: 0, share: 0 };
        row.count++;
        row.amount += p.amountPaid;
        map.set(key, row);
      }
    }
    const list = [...map.values()].sort((a, b) => b.amount - a.amount);
    const top = list[0]?.amount || 1;
    return list.map((r) => ({ ...r, share: Math.max(2, (r.amount / top) * 100) }));
  });

  // Sort keys / mobile titles
  protected readonly byDate = (r: DayRow) => r.date;
  protected readonly byCount = (r: { count: number }) => r.count;
  protected readonly byRevenue = (r: { revenue: number }) => r.revenue;
  protected readonly byProfit = (r: { profit: number }) => r.profit;
  protected readonly byOwed = (r: { owed: number }) => r.owed;
  protected readonly byStaffName = (r: StaffRow) => r.name.toLowerCase();
  protected readonly byProductName = (r: ProductRow) => r.name.toLowerCase();
  protected readonly byPieces = (r: ProductRow) => r.pieces;
  protected readonly byMargin = (r: ProductRow) => r.margin ?? -Infinity;
  protected readonly dayTitle = (r: DayRow) => this.dayLabel(r.date);
  protected readonly staffTitle = (r: StaffRow) => r.name;
  protected readonly productTitle = (r: ProductRow) => r.name;

  constructor() {
    this.load();
  }

  protected setRange(r: DateRange): void {
    this.range.set(r);
    this.load();
  }

  protected load(): void {
    const r = this.range();
    this.error.set('');
    this.sales.set(null);
    this.glNet.set(null);
    this.api
      .list(toLocalDateTime(r.start), toLocalDateTime(r.end))
      .then((s) => this.sales.set(s))
      .catch((e) => this.error.set(ApiError.from(e).message));
    if (this.canGl()) {
      this.gl
        .incomeStatement(toIsoDate(r.start), toIsoDate(r.end))
        .then((st) => this.glNet.set(st.netRevenue))
        .catch(() => this.glNet.set(null));
    }
  }

  protected m(v: number): string {
    return Money.format(v, { decimals: 0 });
  }

  protected pct(part: number, whole: number): string {
    return whole ? `${((part / whole) * 100).toFixed(1)}%` : '—';
  }

  protected dayLabel(v: string | null): string {
    const d = parseLocal(v);
    return d ? new Intl.DateTimeFormat(this.i18n.isSwahili() ? 'sw-TZ' : 'en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }).format(d) : '—';
  }

  private table(): { title: string; headers: string[]; rows: Cell[][]; numeric: number[] } {
    const t = (en: string, sw: string) => this.i18n.t(en, sw);
    const p = this.canProfit();
    switch (this.view()) {
      case 'day': {
        const rows = [...this.days()].sort((a, b) => b.date.localeCompare(a.date));
        return {
          title: t('Sales by day', 'Mauzo kwa siku'),
          headers: [t('Date', 'Tarehe'), t('Receipts', 'Risiti'), t('Sales', 'Mauzo'), ...(p ? [t('Profit', 'Faida')] : []), t('Received', 'Imepokelewa'), t('On credit', 'Mkopo'), t('Discount', 'Punguzo')],
          rows: rows.map((r) => [r.date, r.count, r.revenue, ...(p ? [r.profit] : []), r.paid, r.owed, r.discount]),
          numeric: p ? [1, 2, 3, 4, 5, 6] : [1, 2, 3, 4, 5],
        };
      }
      case 'staff': {
        const rows = [...this.staff()].sort((a, b) => b.revenue - a.revenue);
        return {
          title: t('Sales by staff', 'Mauzo kwa mfanyakazi'),
          headers: [t('Staff', 'Mfanyakazi'), t('Receipts', 'Risiti'), t('Sales', 'Mauzo'), t('Share %', 'Sehemu %'), ...(p ? [t('Profit', 'Faida')] : []), t('Received', 'Imepokelewa'), t('On credit', 'Mkopo')],
          rows: rows.map((r) => [r.name, r.count, r.revenue, r.share.toFixed(1), ...(p ? [r.profit] : []), r.paid, r.owed]),
          numeric: p ? [1, 2, 3, 4, 5, 6] : [1, 2, 3, 4, 5],
        };
      }
      case 'product': {
        const rows = [...this.products()].sort((a, b) => (p ? b.profit - a.profit : b.revenue - a.revenue));
        return {
          title: t('Sales by product', 'Mauzo kwa bidhaa'),
          headers: [t('Product', 'Bidhaa'), t('Category', 'Kategoria'), t('Pieces', 'Vipande'), t('Sales', 'Mauzo'), ...(p ? [t('Cost', 'Gharama'), t('Profit', 'Faida'), t('Margin %', 'Asilimia')] : [])],
          rows: rows.map((r) => [r.name, r.category, r.pieces, r.revenue, ...(p ? [r.cost, r.profit, r.margin?.toFixed(1) ?? ''] : [])]),
          numeric: p ? [2, 3, 4, 5, 6] : [2, 3],
        };
      }
      default:
        return {
          title: t('Money received by method', 'Pesa kwa njia ya malipo'),
          headers: [t('Method', 'Njia'), t('Payments', 'Malipo'), t('Amount', 'Kiasi')],
          rows: this.payments().map((r) => [r.method, r.count, r.amount]),
          numeric: [1, 2],
        };
    }
  }

  protected csv(): void {
    const tb = this.table();
    downloadCsv(`sales_${this.view()}`, tb.headers, tb.rows);
  }

  protected print(): void {
    const tb = this.table();
    const k = this.kpi();
    const r = this.range();
    // Counts stay plain; every other numeric column is money.
    const counts = new Set(tb.headers.map((h, i) => (/receipts|risiti|payments|malipo|pieces|vipande|%/i.test(h) ? i : -1)));
    const fmt = (c: Cell, i: number) => (typeof c === 'number' && !counts.has(i) ? this.m(c) : c);
    printReport({
      title: tb.title,
      subtitle: `${toIsoDate(r.start)} – ${toIsoDate(r.end)}`,
      headers: tb.headers,
      rows: tb.rows.map((row) => row.map(fmt)),
      numeric: tb.numeric,
      summary: [
        [this.i18n.t('Sales', 'Mauzo'), this.m(k.revenue)],
        ...(this.canProfit() ? ([[this.i18n.t('Gross profit', 'Faida ghafi'), this.m(k.profit)]] as [string, string][]) : []),
        [this.i18n.t('Received', 'Imepokelewa'), this.m(k.paid)],
        [this.i18n.t('On credit', 'Mkopo'), this.m(k.owed)],
      ],
    });
  }
}
