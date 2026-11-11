import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, output, signal } from '@angular/core';

import { ApiError } from '@core/api/api.types';
import { LanguageService } from '@core/i18n/language.service';
import { DataTable, DialogService, EmptyState, FilterPanel, Icon, MetricCard, MetricsGrid, SegmentOption, SegmentedFilterBar, TableColumn } from '@shared/ui';
import { parseLocal } from '@shared/utils/date-utils';
import { Money, MoneyPipe } from '@shared/utils/money';
import { RETURN_STATUS, RETURN_TYPES, ReturnType, SalesReturn } from './sales.models';
import { SalesService } from './sales.service';

type Filter = 'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXCHANGE';

/**
 * All return requests (newest first) with the approval queue — Flutter showed
 * returns only per sale; here managers get one place to approve / reject.
 */
@Component({
  selector: 'app-returns-panel',
  imports: [MetricsGrid, MetricCard, FilterPanel, SegmentedFilterBar, DataTable, TableColumn, EmptyState, Icon, MoneyPipe, DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <lsms-metrics-grid [gap]="12">
      <lsms-metric-card [title]="i18n.t('Returns', 'Marejesho')" [value]="loading() ? '—' : list().length + ''" icon="assignment_return" color="var(--c-primary)" [clickable]="true" (tap)="filter.set('ALL')" />
      <lsms-metric-card [title]="i18n.t('Waiting for approval', 'Yanasubiri idhini')" [value]="stats().pending + ''" icon="hourglass_top" color="var(--c-warning)" [urgent]="stats().pending > 0" [clickable]="stats().pending > 0" (tap)="filter.set('PENDING')" />
      <lsms-metric-card [title]="i18n.t('Money handed back', 'Pesa iliyorudishwa')" [value]="stats().cash | money: { decimals: 0 }" [subtitle]="i18n.t('of ' + money(stats().value) + ' returned value', 'kati ya ' + money(stats().value) + ' ya thamani')" icon="currency_exchange" color="var(--c-success)" />
      <lsms-metric-card [title]="i18n.t('Pieces back', 'Vipande vilivyorudi')" [value]="stats().pieces + ''" [subtitle]="stats().rejected ? i18n.t(stats().rejected + ' rejected', stats().rejected + ' zimekataliwa') : undefined" icon="inventory" color="var(--c-info)" />
    </lsms-metrics-grid>

    <div class="table-card">
      <lsms-filter-panel [searchPlaceholder]="i18n.t('Search reference, receipt, customer or product…', 'Tafuta kumbukumbu, risiti, mteja au bidhaa…')" (search)="search.set($event)">
        <lsms-segmented-filter-bar filterSegments [options]="options()" [(selected)]="filter" />
      </lsms-filter-panel>
      @if (error()) {
        <lsms-empty-state icon="error" iconColor="var(--c-error)" [title]="i18n.t('Could not load returns', 'Imeshindikana kupakia marejesho')" [message]="error()!" [secondaryActionLabel]="i18n.t('Retry', 'Jaribu tena')" (secondaryAction)="load()" />
      } @else {
        <lsms-data-table
          [title]="i18n.t('Return requests', 'Maombi ya kurudisha')"
          [items]="rows()"
          [rowId]="rowId"
          [loading]="loading()"
          [mobileTitle]="titleOf"
          [mobileColumns]="['refund', 'status', 'date', 'items']"
          [mobileCompactColumns]="['refund']"
          [emptyTitle]="i18n.t('No returns', 'Hakuna marejesho')"
          [emptyMessage]="i18n.t('Returns are requested from a sale’s details.', 'Marejesho huombwa kutoka kwenye taarifa za mauzo.')"
          emptyIcon="assignment_return"
          (rowClick)="open($event)"
        >
          <ng-template lsmsColumn="date" [label]="i18n.t('Requested', 'Iliombwa')" let-row>
            <span class="when"><b>{{ date(row.requestedAt) | date: 'dd MMM yyyy' }}</b><small>{{ date(row.requestedAt) | date: 'HH:mm' }}</small></span>
          </ng-template>
          <ng-template lsmsColumn="ref" [label]="i18n.t('Reference', 'Kumbukumbu')" [locked]="true" let-row>
            <span class="ref"><b>{{ row.reference }}</b><small>{{ row.receiptNumber }}</small></span>
          </ng-template>
          <ng-template lsmsColumn="customer" [label]="i18n.t('Customer', 'Mteja')" let-row>
            <span [class.muted]="!row.customerName">{{ row.customerName || i18n.t('Walk-in', 'Kawaida') }}</span>
          </ng-template>
          <ng-template lsmsColumn="items" [label]="i18n.t('Items', 'Bidhaa')" let-row>
            <span class="items">{{ itemsText(row) }}</span>
          </ng-template>
          <ng-template lsmsColumn="type" [label]="i18n.t('Kind', 'Aina')" let-row>
            <span class="muted">@if (row.type === 'EXCHANGE') { <lsms-icon name="swap_horiz" [size]="13" /> }{{ type(row.type) }}@if (row.exchangeReceipt) { <small> · {{ row.exchangeReceipt }}</small> }</span>
          </ng-template>
          <ng-template lsmsColumn="refund" [label]="i18n.t('Value', 'Thamani')" align="end" let-row>
            <span class="val">
              <b class="num">{{ row.refund | money }}</b>
              @if (done(row.status)) {
                <small>{{ row.cash > 0 ? i18n.t('paid back ', 'imerudishwa ') + money(row.cash) : i18n.t('debt cleared', 'deni limepunguzwa') }}</small>
              }
            </span>
          </ng-template>
          <ng-template lsmsColumn="status" [label]="i18n.t('Status', 'Hali')" let-row>
            @let st = status(row.status);
            <span class="status" [style.--st]="st.color"><lsms-icon [name]="st.icon" [size]="13" />{{ i18n.isSwahili() ? st.sw : st.en }}</span>
          </ng-template>
        </lsms-data-table>
      }
    </div>
  `,
  styles: `
    @use 'list-page';
    @include list-page.base;
    :host { display: flex; flex-direction: column; gap: 16px; }
    .when, .ref { display: flex; flex-direction: column; min-width: 0; }
    .ref b { font-family: ui-monospace, monospace; font-size: 0.76rem; }
    .num { font-variant-numeric: tabular-nums; white-space: nowrap; }
    .val { display: inline-flex; flex-direction: column; align-items: flex-end; }
    .val small { font-size: 0.7rem; color: var(--c-text-2); white-space: nowrap; }
  `,
})
export class ReturnsPanel {
  protected readonly i18n = inject(LanguageService);
  private readonly api = inject(SalesService);
  private readonly dialogs = inject(DialogService);

  /** Tells the page a return moved (the sales list refreshes). */
  readonly changed = output<void>();

  protected readonly list = signal<SalesReturn[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly filter = signal<Filter>('ALL');
  protected readonly search = signal('');

  protected readonly rowId = (r: SalesReturn) => r.uid;
  protected readonly titleOf = (r: SalesReturn) => r.customerName ?? r.reference;

  protected readonly stats = computed(() => {
    const l = this.list();
    const approved = l.filter((r) => ['APPROVED', 'PROCESSED', 'COMPLETED'].includes(r.status));
    return {
      pending: l.filter((r) => r.status === 'PENDING').length,
      approved: approved.length,
      rejected: l.filter((r) => r.status === 'REJECTED').length,
      value: approved.reduce((n, r) => n + r.refund, 0),
      cash: approved.reduce((n, r) => n + r.cash, 0),
      exchanges: l.filter((r) => r.type === 'EXCHANGE').length,
      pieces: approved.reduce((n, r) => n + r.pieces, 0),
    };
  });

  protected readonly options = computed<SegmentOption<Filter>[]>(() => {
    const s = this.stats();
    const t = (en: string, sw: string) => this.i18n.t(en, sw);
    return [
      { value: 'ALL', label: t('All', 'Yote'), count: this.list().length },
      { value: 'PENDING', label: t('Waiting', 'Yanasubiri'), icon: 'hourglass_top', count: s.pending },
      { value: 'APPROVED', label: t('Approved', 'Yameidhinishwa'), icon: 'verified', count: s.approved },
      { value: 'REJECTED', label: t('Rejected', 'Yamekataliwa'), icon: 'cancel', count: s.rejected },
      ...(s.exchanges ? [{ value: 'EXCHANGE' as Filter, label: t('Exchanges', 'Kubadilisha'), icon: 'swap_horiz', count: s.exchanges }] : []),
    ];
  });

  protected readonly rows = computed(() => {
    const f = this.filter();
    const q = this.search().trim().toLowerCase();
    return this.list().filter((r) => {
      if (f === 'PENDING' && r.status !== 'PENDING') return false;
      if (f === 'APPROVED' && !['APPROVED', 'PROCESSED', 'COMPLETED'].includes(r.status)) return false;
      if (f === 'REJECTED' && r.status !== 'REJECTED') return false;
      if (f === 'EXCHANGE' && r.type !== 'EXCHANGE') return false;
      if (!q) return true;
      return [r.reference, r.receiptNumber ?? '', r.exchangeReceipt ?? '', r.customerName ?? '', ...r.items.map((i) => i.productName)].some((x) => x.toLowerCase().includes(q));
    });
  });

  constructor() {
    void this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      this.list.set(await this.api.returns());
    } catch (e) {
      this.error.set(ApiError.from(e).message);
    } finally {
      this.loading.set(false);
    }
  }

  protected status(s: string) {
    return RETURN_STATUS[s] ?? RETURN_STATUS['PENDING'];
  }

  protected type(t: string): string {
    const x = RETURN_TYPES[t as ReturnType];
    return x ? (this.i18n.isSwahili() ? x.sw : x.en) : t;
  }

  protected done(s: string): boolean {
    return ['APPROVED', 'PROCESSED', 'COMPLETED'].includes(s);
  }

  protected money(n: number): string {
    return Money.format(n, { decimals: 0 });
  }

  protected date(v: string | null): Date | null {
    return parseLocal(v);
  }

  protected itemsText(r: SalesReturn): string {
    const n = r.items.map((i) => `${i.productName} ×${i.pieces}`);
    return n.length <= 2 ? n.join(', ') : `${n.slice(0, 2).join(', ')} +${n.length - 2}`;
  }

  protected async open(r: SalesReturn): Promise<void> {
    const { ReturnDetailsDialog } = await import('./return-details-dialog');
    const moved = await this.dialogs.openAsync<boolean>(ReturnDetailsDialog, { size: 'lg', data: { ret: r } });
    if (moved) {
      void this.load();
      this.changed.emit();
    }
  }
}
