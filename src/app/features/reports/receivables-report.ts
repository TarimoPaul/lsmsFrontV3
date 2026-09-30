import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';

import { ApiError } from '@core/api/api.types';
import { AuthService } from '@core/auth/auth.service';
import { LanguageService } from '@core/i18n/language.service';
import { AgingBar, AgingBucket, DataTable, EmptyState, Icon, MetricCard, MetricsGrid, SearchBar, SegmentOption, SegmentedFilterBar, Skeleton, TableColumn } from '@shared/ui';
import { parseLocal } from '@shared/utils/date-utils';
import { Cell, downloadCsv, printReport } from '@shared/utils/export';
import { Money } from '@shared/utils/money';
import { ControlCheck } from '../general-ledger/gl.models';
import { GlService } from '../general-ledger/gl.service';
import { AGING, AgingKey, ArCustomer, ArInvoice } from './reports.models';
import { ReportFrame } from './report-frame';
import { ReportsService } from './reports.service';

type View = 'customer' | 'invoice';
type Bucket = 'ALL' | AgingKey;

/**
 * Customer debts by age from the receivables view (v_accounts_receivable),
 * which agrees with GL account 1100 — the report shows that check. Aging
 * counts days since the sale.
 */
@Component({
  selector: 'app-receivables-report',
  imports: [ReportFrame, SegmentedFilterBar, SearchBar, MetricCard, MetricsGrid, AgingBar, Skeleton, EmptyState, Icon, DataTable, TableColumn],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-report-frame report="receivables" [hasFilters]="true" [note]="i18n.t('as of today', 'hadi leo')" (refresh)="load(true)" (csv)="csv()" (print)="print()">
      <div filters class="filters">
        <lsms-segmented-filter-bar [options]="views()" [selected]="view()" (selectedChange)="view.set($event)" />
        <lsms-segmented-filter-bar [options]="buckets()" [selected]="bucket()" (selectedChange)="bucket.set($event)" />
        <lsms-search-bar class="search" [(value)]="q" [placeholder]="i18n.t('Search customer or receipt', 'Tafuta mteja au risiti')" />
      </div>

      @if (error()) {
        <lsms-empty-state icon="cloud_off" [title]="i18n.t('Could not load debts', 'Madeni hayakupatikana')" [message]="error()" />
      } @else if (!invoices() || !customers()) {
        <lsms-skeleton variant="list" [rows]="6" />
      } @else {
        @let k = kpi();
        <lsms-metrics-grid [gap]="12">
          <lsms-metric-card [title]="i18n.t('Customers owe', 'Wateja wanadaiwa')" [value]="m(k.total)" icon="request_quote" color="var(--c-warning)" [subtitle]="k.customers + ' ' + i18n.t('customers', 'wateja') + ' · ' + k.invoices + ' ' + i18n.t('receipts', 'risiti')" />
          <lsms-metric-card [title]="i18n.t('Over 90 days', 'Zaidi ya siku 90')" [value]="m(k.b90)" icon="warning" color="var(--c-error)" [urgent]="k.b90 > 0" [subtitle]="pct(k.b90, k.total) + ' ' + i18n.t('of all debt', 'ya madeni yote')" />
          <lsms-metric-card [title]="i18n.t('Average age', 'Umri wa wastani')" [value]="k.avgDays + ' ' + i18n.t('days', 'siku')" icon="schedule" color="var(--c-info)" [subtitle]="i18n.t('weighted by amount', 'kwa uzito wa kiasi')" />
          <lsms-metric-card [title]="i18n.t('Biggest debtor', 'Mdaiwa mkubwa')" [value]="k.top ? m(k.top.total) : '—'" icon="person" color="var(--c-primary)" [subtitle]="k.top ? k.top.customerName : undefined" />
        </lsms-metrics-grid>

        <section class="card">
          <header><h4>{{ i18n.t('Debt by age', 'Madeni kwa umri') }}</h4></header>
          <lsms-aging-bar [buckets]="aging()" />
        </section>

        @if (glCheck(); as g) {
          <p class="xcheck" [class.bad]="!g.reconciled">
            <lsms-icon [name]="g.reconciled ? 'verified' : 'info'" [size]="17" />
            {{ i18n.t('General Ledger account', 'Akaunti ya Leja Kuu') }} {{ g.accountCode }}: <b>{{ m(g.glBalance) }}</b>
            {{ g.reconciled ? i18n.t('— matches this report', '— inalingana na ripoti hii') : i18n.t('— differs by ', '— tofauti ') + m(g.difference) }}
          </p>
        }

        @if (view() === 'customer') {
          <section class="card flush">
            <lsms-data-table [items]="customerRows()" title="customers" [showHeader]="false" [pageSize]="25" defaultSortColumn="total" defaultSortDirection="desc" [mobileTitle]="custName" [emptyTitle]="i18n.t('Nobody owes', 'Hakuna anayedaiwa')">
              <ng-template lsmsColumn="name" [label]="i18n.t('Customer', 'Mteja')" [sortBy]="custSort" let-row>
                <span class="cell-stack"><strong>{{ row.customerName }}</strong><small>{{ row.customerPhone ?? '' }}</small></span>
              </ng-template>
              <ng-template lsmsColumn="count" [label]="i18n.t('Receipts', 'Risiti')" align="end" let-row><span class="num">{{ row.invoiceCount }}</span></ng-template>
              <ng-template lsmsColumn="b0" [label]="ageLabel(0)" align="end" let-row><span class="num" [class.muted]="!row.b0">{{ m(row.b0) }}</span></ng-template>
              <ng-template lsmsColumn="b31" [label]="ageLabel(1)" align="end" let-row><span class="num" [class.muted]="!row.b31">{{ m(row.b31) }}</span></ng-template>
              <ng-template lsmsColumn="b61" [label]="ageLabel(2)" align="end" let-row><span class="num" [class.muted]="!row.b61">{{ m(row.b61) }}</span></ng-template>
              <ng-template lsmsColumn="b90" [label]="ageLabel(3)" align="end" let-row><span class="num" [class.neg]="row.b90 > 0" [class.muted]="!row.b90">{{ m(row.b90) }}</span></ng-template>
              <ng-template lsmsColumn="total" [label]="i18n.t('Total owed', 'Jumla')" align="end" [sortBy]="custTotal" let-row><span class="num strong">{{ m(row.total) }}</span></ng-template>
              <ng-template lsmsColumn="days" [label]="i18n.t('Oldest', 'Kongwe')" align="end" [sortBy]="custDays" let-row><span class="num">{{ row.maxDays }} {{ i18n.t('d', 'siku') }}</span></ng-template>
            </lsms-data-table>
          </section>
        } @else {
          <section class="card flush">
            <lsms-data-table [items]="invoiceRows()" [rowId]="invId" title="invoices" [showHeader]="false" [pageSize]="25" defaultSortColumn="days" defaultSortDirection="desc" [mobileTitle]="invTitle" [emptyTitle]="i18n.t('No unpaid receipts', 'Hakuna risiti zisizolipwa')">
              <ng-template lsmsColumn="receipt" [label]="i18n.t('Receipt', 'Risiti')" let-row>
                <span class="cell-stack"><strong>{{ row.receiptNumber }}</strong><small>{{ day(row.saleDate) }}</small></span>
              </ng-template>
              <ng-template lsmsColumn="customer" [label]="i18n.t('Customer', 'Mteja')" [sortBy]="invCust" let-row>
                <span class="cell-stack"><span>{{ row.customerName }}</span><small>{{ row.customerPhone ?? '' }}</small></span>
              </ng-template>
              <ng-template lsmsColumn="total" [label]="i18n.t('Sale total', 'Jumla ya mauzo')" align="end" let-row><span class="num muted">{{ m(row.totalAmount) }}</span></ng-template>
              <ng-template lsmsColumn="owed" [label]="i18n.t('Still owed', 'Bado inadaiwa')" align="end" [sortBy]="invOwed" let-row><span class="num strong">{{ m(row.outstanding) }}</span></ng-template>
              <ng-template lsmsColumn="days" [label]="i18n.t('Age', 'Umri')" align="end" [sortBy]="invDays" let-row>
                @let a = age(row.bucket);
                <span class="status" [style.--st]="a.color">{{ row.daysOutstanding }} {{ i18n.t('days', 'siku') }}</span>
              </ng-template>
            </lsms-data-table>
          </section>
        }
      }
    </app-report-frame>
  `,
  styleUrl: './report.scss',
  styles: `.search { flex: 1 1 220px; min-width: 200px; max-width: 360px; }`,
})
export class ReceivablesReport {
  protected readonly i18n = inject(LanguageService);
  private readonly api = inject(ReportsService);
  private readonly gl = inject(GlService);
  private readonly auth = inject(AuthService);

  protected readonly view = signal<View>('customer');
  protected readonly bucket = signal<Bucket>('ALL');
  protected readonly q = signal('');
  protected readonly error = signal('');
  protected readonly glCheck = signal<ControlCheck | null>(null);
  protected readonly invoices = this.api.arInvoices.value;
  protected readonly customers = this.api.arCustomers.value;

  protected readonly kpi = computed(() => {
    const inv = this.invoices() ?? [];
    const cust = this.customers() ?? [];
    const total = inv.reduce((a, i) => a + i.outstanding, 0);
    const weighted = inv.reduce((a, i) => a + i.outstanding * i.daysOutstanding, 0);
    return {
      total,
      invoices: inv.length,
      customers: cust.length,
      b90: inv.filter((i) => i.bucket === '90+').reduce((a, i) => a + i.outstanding, 0),
      avgDays: total ? Math.round(weighted / total) : 0,
      top: cust[0] ?? null,
    };
  });

  protected readonly aging = computed<AgingBucket[]>(() => {
    const inv = this.invoices() ?? [];
    return AGING.map((a) => ({ label: this.i18n.isSwahili() ? a.sw : a.en, value: inv.filter((i) => i.bucket === a.key).reduce((s, i) => s + i.outstanding, 0), color: a.color }));
  });

  protected readonly views = computed<SegmentOption<View>[]>(() => [
    { value: 'customer', label: this.i18n.t('By customer', 'Kwa mteja'), icon: 'group', count: this.customers()?.length },
    { value: 'invoice', label: this.i18n.t('Receipts', 'Risiti'), icon: 'receipt_long', count: this.invoices()?.length },
  ]);
  protected readonly buckets = computed<SegmentOption<Bucket>[]>(() => [
    { value: 'ALL', label: this.i18n.t('All ages', 'Umri wote') },
    ...AGING.map((a) => ({ value: a.key as Bucket, label: a.key })),
  ]);

  private matches(name: string, extra: string): boolean {
    const q = this.q().trim().toLowerCase();
    return !q || name.toLowerCase().includes(q) || extra.toLowerCase().includes(q);
  }

  protected readonly customerRows = computed(() => {
    const b = this.bucket();
    const key = { '0-30': 'b0', '31-60': 'b31', '61-90': 'b61', '90+': 'b90' } as const;
    return (this.customers() ?? []).filter((c) => (b === 'ALL' || c[key[b]] > 0) && this.matches(c.customerName, c.customerPhone ?? ''));
  });
  protected readonly invoiceRows = computed(() => {
    const b = this.bucket();
    return (this.invoices() ?? []).filter((i) => (b === 'ALL' || i.bucket === b) && this.matches(i.customerName, i.receiptNumber));
  });

  protected readonly custName = (r: ArCustomer) => r.customerName;
  protected readonly custSort = (r: ArCustomer) => r.customerName.toLowerCase();
  protected readonly custTotal = (r: ArCustomer) => r.total;
  protected readonly custDays = (r: ArCustomer) => r.maxDays;
  protected readonly invId = (r: ArInvoice) => r.saleUid;
  protected readonly invTitle = (r: ArInvoice) => `${r.customerName} · ${r.receiptNumber}`;
  protected readonly invCust = (r: ArInvoice) => r.customerName.toLowerCase();
  protected readonly invOwed = (r: ArInvoice) => r.outstanding;
  protected readonly invDays = (r: ArInvoice) => r.daysOutstanding;

  constructor() {
    this.load(false);
  }

  protected load(force: boolean): void {
    this.error.set('');
    Promise.all([this.api.arInvoices.load(force), this.api.arCustomers.load(force)]).catch((e) => this.error.set(ApiError.from(e).message));
    if (this.auth.hasPermission('FINANCE_READ')) {
      this.gl
        .controlChecks()
        .then((c) => this.glCheck.set(c.find((x) => x.key === 'RECEIVABLES') ?? null))
        .catch(() => this.glCheck.set(null));
    }
  }

  protected ageLabel(i: number): string {
    return this.i18n.isSwahili() ? AGING[i].sw : AGING[i].en;
  }

  protected age(k: AgingKey) {
    return AGING.find((a) => a.key === k)!;
  }

  protected m(v: number): string {
    return Money.format(v, { decimals: 0 });
  }

  protected pct(part: number, whole: number): string {
    return whole ? `${((part / whole) * 100).toFixed(1)}%` : '—';
  }

  protected day(v: string | null): string {
    const d = parseLocal(v);
    return d ? new Intl.DateTimeFormat(this.i18n.isSwahili() ? 'sw-TZ' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(d) : '—';
  }

  private table(): { title: string; headers: string[]; rows: Cell[][]; money: number[] } {
    const t = (en: string, sw: string) => this.i18n.t(en, sw);
    if (this.view() === 'customer') {
      return {
        title: t('Customer debts by age', 'Madeni ya wateja kwa umri'),
        headers: [t('Customer', 'Mteja'), t('Phone', 'Simu'), t('Receipts', 'Risiti'), ...AGING.map((a) => (this.i18n.isSwahili() ? a.sw : a.en)), t('Total owed', 'Jumla'), t('Oldest (days)', 'Kongwe (siku)')],
        rows: this.customerRows().map((c) => [c.customerName, c.customerPhone ?? '', c.invoiceCount, c.b0, c.b31, c.b61, c.b90, c.total, c.maxDays]),
        money: [3, 4, 5, 6, 7],
      };
    }
    return {
      title: t('Unpaid receipts', 'Risiti zisizolipwa'),
      headers: [t('Receipt', 'Risiti'), t('Date', 'Tarehe'), t('Customer', 'Mteja'), t('Phone', 'Simu'), t('Sale total', 'Jumla ya mauzo'), t('Still owed', 'Bado inadaiwa'), t('Days', 'Siku')],
      rows: this.invoiceRows().map((i) => [i.receiptNumber, (i.saleDate ?? '').slice(0, 10), i.customerName, i.customerPhone ?? '', i.totalAmount, i.outstanding, i.daysOutstanding]),
      money: [4, 5],
    };
  }

  protected csv(): void {
    const tb = this.table();
    downloadCsv(this.view() === 'customer' ? 'ar_by_customer' : 'ar_receipts', tb.headers, tb.rows);
  }

  protected print(): void {
    const tb = this.table();
    const k = this.kpi();
    printReport({
      title: tb.title,
      subtitle: this.i18n.t('As of ', 'Hadi ') + new Date().toLocaleDateString(),
      headers: tb.headers,
      rows: tb.rows.map((row) => row.map((c, i) => (typeof c === 'number' && tb.money.includes(i) ? this.m(c) : c))),
      numeric: [...tb.money, tb.headers.length - 1],
      summary: [
        [this.i18n.t('Total owed', 'Jumla inadaiwa'), this.m(k.total)],
        ...this.aging().map((a) => [a.label, this.m(a.value)] as [string, string]),
      ],
    });
  }
}
