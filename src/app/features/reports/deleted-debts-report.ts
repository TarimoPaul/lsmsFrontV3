import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';

import { ApiError } from '@core/api/api.types';
import { LanguageService } from '@core/i18n/language.service';
import { DataTable, EmptyState, Icon, MetricCard, MetricsGrid, SegmentOption, SegmentedFilterBar, Skeleton, TableColumn } from '@shared/ui';
import { DateRange, parseLocal, rangeForPreset, toIsoDate } from '@shared/utils/date-utils';
import { Cell, downloadCsv, printReport } from '@shared/utils/export';
import { Money } from '@shared/utils/money';
import { DeletedDebt } from './reports.models';
import { ReportFrame } from './report-frame';
import { ReportsService } from './reports.service';

type Filter = 'ALL' | 'UNTRACED';

/**
 * Control report: sales deleted while the customer still owed money
 * (/api/reports/deleted-debts — every delete path, owed amount at deletion).
 * "Untraced" means the actor was recorded as System.
 */
@Component({
  selector: 'app-deleted-debts-report',
  imports: [ReportFrame, SegmentedFilterBar, MetricCard, MetricsGrid, Skeleton, EmptyState, Icon, DataTable, TableColumn],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-report-frame report="deleted-debts" [range]="range()" [hasFilters]="true" (rangeChange)="range.set($event)" (refresh)="load()" (csv)="csv()" (print)="print()">
      <lsms-segmented-filter-bar filters [options]="filters()" [selected]="filter()" (selectedChange)="filter.set($event)" />

      @if (error()) {
        <lsms-empty-state icon="cloud_off" [title]="i18n.t('Could not load deleted sales', 'Mauzo yaliyofutwa hayakupatikana')" [message]="error()" />
      } @else if (!rows()) {
        <lsms-skeleton variant="list" [rows]="6" />
      } @else {
        @let k = kpi();
        <lsms-metrics-grid [gap]="12">
          <lsms-metric-card [title]="i18n.t('Debt wiped by deletion', 'Deni lililofutwa')" [value]="m(k.debt)" icon="money_off" color="var(--c-error)" [urgent]="k.debt > 0" [subtitle]="k.count + ' ' + i18n.t('deleted sales with money owed', 'mauzo yaliyofutwa yenye deni')" />
          <lsms-metric-card [title]="i18n.t('Value of those sales', 'Thamani ya mauzo hayo')" [value]="m(k.total)" icon="delete_sweep" color="var(--c-warning)" [subtitle]="k.withReason + ' ' + i18n.t('have a recorded reason', 'zina sababu iliyoandikwa')" />
          <lsms-metric-card [title]="i18n.t('Cannot be traced', 'Haijulikani aliyefuta')" [value]="'' + k.untraced" icon="person_off" color="#b71c1c" [subtitle]="i18n.t('recorded as “System”', 'imeandikwa “System”')" />
        </lsms-metrics-grid>

        <section class="card flush">
          <lsms-data-table [items]="visible()" [rowId]="rowId" title="deleted" [showHeader]="false" [pageSize]="25" defaultSortColumn="deleted" defaultSortDirection="desc" [mobileTitle]="title" [emptyTitle]="i18n.t('Nothing to show', 'Hakuna cha kuonyesha')">
            <ng-template lsmsColumn="receipt" [label]="i18n.t('Receipt', 'Risiti')" let-row>
              <span class="cell-stack"><strong>{{ row.receiptNumber }}</strong><small>{{ i18n.t('sold', 'iliuzwa') }} {{ day(row.saleDate) }}@if (row.seller) { · {{ row.seller }} }</small></span>
            </ng-template>
            <ng-template lsmsColumn="customer" [label]="i18n.t('Customer', 'Mteja')" let-row>{{ row.customerName }}</ng-template>
            <ng-template lsmsColumn="total" [label]="i18n.t('Sale total', 'Jumla')" align="end" [sortBy]="byTotal" let-row><span class="num muted">{{ m(row.total) }}</span></ng-template>
            <ng-template lsmsColumn="debt" [label]="i18n.t('Owed at deletion', 'Deni wakati wa kufuta')" align="end" [sortBy]="byDebt" let-row><span class="num strong" [class.neg]="row.debt > 0" [class.muted]="!row.debt">{{ m(row.debt) }}</span></ng-template>
            <ng-template lsmsColumn="deleted" [label]="i18n.t('Deleted', 'Ilifutwa')" [sortBy]="byDeleted" let-row>
              <span class="cell-stack">
                <span>{{ day(row.deletedAt) }}</span>
                <small>
                  @if (row.untraced) { <span class="status" style="--st: #b71c1c"><lsms-icon name="person_off" [size]="12" />{{ i18n.t('untraced', 'haijulikani') }}</span> } @else { {{ row.deletedBy }} }
                </small>
              </span>
            </ng-template>
            <ng-template lsmsColumn="reason" [label]="i18n.t('Reason', 'Sababu')" let-row><span class="desc">{{ row.reason ?? '—' }}</span></ng-template>
          </lsms-data-table>
        </section>
      }
    </app-report-frame>
  `,
  styleUrl: './report.scss',
  styles: `.desc { display: inline-block; max-width: 320px; white-space: normal; font-size: 0.8rem; color: var(--c-text-2); }`,
})
export class DeletedDebtsReport {
  protected readonly i18n = inject(LanguageService);
  private readonly api = inject(ReportsService);

  /** Deleted sales are few; default to a wide window so older deletions show. */
  protected readonly range = signal<DateRange>(rangeForPreset('thisYear'));
  protected readonly filter = signal<Filter>('ALL');
  protected readonly all = signal<DeletedDebt[] | null>(null);
  protected readonly error = signal('');

  protected readonly rows = computed(() => {
    const a = this.all();
    if (!a) return null;
    const r = this.range();
    const from = toIsoDate(r.start);
    const to = toIsoDate(r.end);
    return a.filter((d) => {
      const day = (d.deletedAt ?? d.saleDate ?? '').slice(0, 10);
      return day >= from && day <= to;
    });
  });

  protected readonly kpi = computed(() => {
    const r = this.rows() ?? [];
    return {
      count: r.length,
      total: r.reduce((a, d) => a + d.total, 0),
      debt: r.reduce((a, d) => a + d.debt, 0),
      withReason: r.filter((d) => !!d.reason).length,
      untraced: r.filter((d) => d.untraced).length,
    };
  });

  protected readonly filters = computed<SegmentOption<Filter>[]>(() => {
    const r = this.rows() ?? [];
    return [
      { value: 'ALL', label: this.i18n.t('All', 'Zote'), count: r.length },
      { value: 'UNTRACED', label: this.i18n.t('Untraced', 'Haijulikani'), count: r.filter((d) => d.untraced).length },
    ];
  });

  protected readonly visible = computed(() => {
    const f = this.filter();
    return (this.rows() ?? []).filter((d) => f === 'ALL' || d.untraced);
  });

  protected readonly rowId = (d: DeletedDebt) => d.saleUid;
  protected readonly title = (d: DeletedDebt) => `${d.receiptNumber} · ${d.customerName}`;
  protected readonly byTotal = (d: DeletedDebt) => d.total;
  protected readonly byDebt = (d: DeletedDebt) => d.debt;
  protected readonly byDeleted = (d: DeletedDebt) => d.deletedAt ?? '';

  constructor() {
    this.load();
  }

  protected load(): void {
    this.error.set('');
    this.all.set(null);
    this.api
      .deletedDebts()
      .then((d) => this.all.set(d))
      .catch((e) => this.error.set(ApiError.from(e).message));
  }

  protected m(v: number): string {
    return Money.format(v, { decimals: 0 });
  }

  protected day(v: string | null): string {
    const d = parseLocal(v);
    return d ? new Intl.DateTimeFormat(this.i18n.isSwahili() ? 'sw-TZ' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(d) : '—';
  }

  private table(): { headers: string[]; rows: Cell[][] } {
    const t = (en: string, sw: string) => this.i18n.t(en, sw);
    return {
      headers: [t('Receipt', 'Risiti'), t('Sold', 'Iliuzwa'), t('Customer', 'Mteja'), t('Seller', 'Muuzaji'), t('Sale total', 'Jumla'), t('Owed at deletion', 'Deni'), t('Deleted', 'Ilifutwa'), t('Deleted by', 'Aliyefuta'), t('Reason', 'Sababu')],
      rows: this.visible().map((d) => [d.receiptNumber, (d.saleDate ?? '').slice(0, 10), d.customerName, d.seller ?? '', d.total, d.debt, (d.deletedAt ?? '').slice(0, 16).replace('T', ' '), d.untraced ? 'System' : (d.deletedBy ?? ''), d.reason ?? '']),
    };
  }

  protected csv(): void {
    const tb = this.table();
    downloadCsv('deleted_debts', tb.headers, tb.rows);
  }

  protected print(): void {
    const tb = this.table();
    const k = this.kpi();
    const r = this.range();
    printReport({
      title: this.i18n.t('Deleted debts', 'Madeni yaliyofutwa'),
      subtitle: `${toIsoDate(r.start)} – ${toIsoDate(r.end)}`,
      headers: tb.headers,
      rows: tb.rows.map((row) => row.map((c, i) => (typeof c === 'number' && (i === 4 || i === 5) ? this.m(c) : c))),
      numeric: [4, 5],
      summary: [
        [this.i18n.t('Debt wiped', 'Deni lililofutwa'), this.m(k.debt)],
        [this.i18n.t('Deleted sales with debt', 'Mauzo yaliyofutwa yenye deni'), k.count],
        [this.i18n.t('Untraced', 'Haijulikani'), k.untraced],
      ],
    });
  }
}
