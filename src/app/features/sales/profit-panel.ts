import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';

import { LanguageService } from '@core/i18n/language.service';
import { DataTable, Icon, MetricCard, MetricsGrid, SegmentOption, SegmentedFilterBar, TableColumn } from '@shared/ui';
import { MoneyPipe } from '@shared/utils/money';
import { SALE_TYPES, Sale, SaleType } from './sales.models';

interface ProductProfit {
  uid: string;
  name: string;
  category: string | null;
  pieces: number;
  revenue: number;
  cost: number;
  profit: number;
  margin: number;
}

type By = 'product' | 'category' | 'type';

/**
 * Profit for the selected period — port of Flutter `SalesProfitAndTotalsScreen`.
 * Computed from the sales already loaded by the page (the backend
 * `/profit-summary` returns zeros), applying the same return adjustment as
 * Flutter: an approved return scales the sale's figures by what was kept.
 */
@Component({
  selector: 'app-profit-panel',
  imports: [MetricsGrid, MetricCard, SegmentedFilterBar, DataTable, TableColumn, Icon, MoneyPipe, DecimalPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let s = summary();
    <lsms-metrics-grid [gap]="12">
      <lsms-metric-card [title]="i18n.t('Revenue', 'Mapato')" [value]="s.revenue | money: { decimals: 0 }" [subtitle]="i18n.t(s.count + ' sales', 'Mauzo ' + s.count)" icon="payments" color="var(--c-primary)" />
      <lsms-metric-card [title]="i18n.t('Cost of goods', 'Gharama ya bidhaa')" [value]="s.cost | money: { decimals: 0 }" icon="inventory_2" color="var(--c-warning)" />
      <lsms-metric-card [title]="i18n.t('Gross profit', 'Faida ghafi')" [value]="s.profit | money: { decimals: 0 }" [subtitle]="(s.margin | number: '1.0-1') + '% ' + i18n.t('margin', 'faida')" icon="trending_up" [color]="s.profit >= 0 ? 'var(--c-success)' : 'var(--c-error)'" />
      <lsms-metric-card [title]="i18n.t('Retail share', 'Sehemu ya rejareja')" [value]="(s.retailPct | number: '1.0-0') + '%'" [subtitle]="i18n.t('Profit ', 'Faida ') + (s.retailProfit | money: { decimals: 0 })" icon="storefront" color="var(--c-info)" />
    </lsms-metrics-grid>

    @if (s.returned || s.noCost) {
      <p class="note">
        <lsms-icon name="info" [size]="15" />
        @if (s.returned) {
          <span>{{ i18n.t(s.returned + ' sale(s) with approved returns are counted for what was kept.', 'Mauzo ' + s.returned + ' yenye marejesho yamehesabiwa kwa kilichobaki.') }}</span>
        }
        @if (s.noCost) {
          <span>{{ i18n.t(s.noCost + ' line(s) have no cost price — their profit is not known.', 'Mistari ' + s.noCost + ' haina bei ya gharama — faida yake haijulikani.') }}</span>
        }
      </p>
    }

    <div class="table-card">
      <div class="head">
        <h3><lsms-icon name="leaderboard" [size]="18" />{{ i18n.t('Profit by', 'Faida kwa') }}</h3>
        <lsms-segmented-filter-bar [options]="byOptions()" [(selected)]="by" [scrollable]="false" />
      </div>
      <lsms-data-table
        [title]="i18n.t('Profit', 'Faida')"
        [items]="groups()"
        [rowId]="rowId"
        defaultSortColumn="profit"
        defaultSortDirection="desc"
        [mobileTitle]="nameOf"
        [mobileColumns]="['profit', 'revenue', 'margin']"
        [mobileCompactColumns]="['profit']"
        [emptyTitle]="i18n.t('No sales in this period', 'Hakuna mauzo katika kipindi hiki')"
        emptyIcon="trending_up"
      >
        <ng-template lsmsColumn="name" [label]="label()" [sortBy]="nameOf" [locked]="true" let-row>
          <span class="nm"><strong>{{ row.name }}</strong>@if (row.category) { <small>{{ row.category }}</small> }</span>
        </ng-template>
        <ng-template lsmsColumn="pieces" [label]="i18n.t('Pieces', 'Vipande')" [sortBy]="piecesOf" align="end" let-row>
          <span class="num">{{ row.pieces | number }}</span>
        </ng-template>
        <ng-template lsmsColumn="revenue" [label]="i18n.t('Revenue', 'Mapato')" [sortBy]="revenueOf" align="end" let-row>
          <span class="num">{{ row.revenue | money: { symbol: false } }}</span>
        </ng-template>
        <ng-template lsmsColumn="cost" [label]="i18n.t('Cost', 'Gharama')" [sortBy]="costOf" align="end" let-row>
          <span class="num muted">{{ row.cost | money: { symbol: false } }}</span>
        </ng-template>
        <ng-template lsmsColumn="profit" [label]="i18n.t('Profit', 'Faida')" [sortBy]="profitOf" align="end" let-row>
          <b class="num" [class.pos]="row.profit > 0" [class.neg]="row.profit < 0">{{ row.profit | money: { symbol: false } }}</b>
        </ng-template>
        <ng-template lsmsColumn="margin" [label]="i18n.t('Margin', 'Asilimia')" [sortBy]="marginOf" width="170px" let-row>
          <span class="margin" [class.neg]="row.margin < 0">
            <span class="track"><i [style.width.%]="row.margin < 0 ? 0 : row.margin > 60 ? 100 : (row.margin / 60) * 100"></i></span>
            <small>{{ row.margin | number: '1.0-1' }}%</small>
          </span>
        </ng-template>
      </lsms-data-table>
    </div>
  `,
  styles: `
    @use 'list-page';
    @include list-page.base;
    :host { display: flex; flex-direction: column; gap: 16px; }
    .note { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 12px; padding: 10px 14px; border-radius: 12px; font-size: 0.8rem; color: var(--c-text-2); background: var(--c-surface); border: 1px solid var(--c-border); }
    .head { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px; padding: 14px 16px 6px; }
    .head h3 { display: flex; align-items: center; gap: 6px; font-size: 0.95rem; font-weight: 800; margin: 0; }
    .head h3 lsms-icon { color: var(--c-primary); }
    lsms-data-table { border: 0; border-radius: 0; }
    .nm { display: flex; flex-direction: column; min-width: 0; }
    .num { font-variant-numeric: tabular-nums; white-space: nowrap; }
    .pos { color: var(--c-success); }
    .neg { color: var(--c-error); }
    .margin { --bar: var(--c-success); display: flex; align-items: center; gap: 8px; width: 100%; }
    .margin .track { flex: 1; height: 6px; }
    .margin small { min-width: 42px; text-align: right; font-size: 0.74rem; font-weight: 600; }
    .margin.neg small { color: var(--c-error); }
  `,
})
export class ProfitPanel {
  protected readonly i18n = inject(LanguageService);

  readonly sales = input.required<Sale[]>();

  protected readonly by = signal<By>('product');
  protected readonly rowId = (r: ProductProfit) => r.uid;
  protected readonly nameOf = (r: ProductProfit) => r.name;
  protected readonly piecesOf = (r: ProductProfit) => r.pieces;
  protected readonly revenueOf = (r: ProductProfit) => r.revenue;
  protected readonly costOf = (r: ProductProfit) => r.cost;
  protected readonly profitOf = (r: ProductProfit) => r.profit;
  protected readonly marginOf = (r: ProductProfit) => r.margin;

  protected readonly byOptions = computed<SegmentOption<By>[]>(() => [
    { value: 'product', label: this.i18n.t('Product', 'Bidhaa') },
    { value: 'category', label: this.i18n.t('Category', 'Kundi') },
    { value: 'type', label: this.i18n.t('Sale type', 'Aina ya mauzo') },
  ]);
  protected readonly label = computed(() => this.byOptions().find((o) => o.value === this.by())!.label);

  /** Every line with the return adjustment applied. */
  private readonly lines = computed(() => {
    const out: Array<{ key: string; name: string; category: string | null; type: string; pieces: number; revenue: number; cost: number; profit: number; noCost: boolean }> = [];
    for (const s of this.sales()) {
      const kept = s.hasReturn && s.returnStatus === 'APPROVED' && s.total > 0 ? Math.min(1, Math.max(0, (s.total - s.returnedAmount) / s.total)) : 1;
      for (const l of s.lines) {
        const cost = (l.costPerPiece ?? 0) * l.pieces * kept;
        const revenue = l.subTotal * kept;
        out.push({
          key: l.productUid,
          name: l.productName,
          category: l.category,
          type: l.saleType,
          pieces: Math.round(l.pieces * kept),
          revenue,
          cost,
          profit: l.profit !== null ? l.profit * kept : revenue - cost,
          noCost: l.costPerPiece === null || l.costPerPiece === 0,
        });
      }
    }
    return out;
  });

  protected readonly summary = computed(() => {
    const ls = this.lines();
    const revenue = ls.reduce((n, l) => n + l.revenue, 0);
    const cost = ls.reduce((n, l) => n + l.cost, 0);
    const profit = ls.reduce((n, l) => n + l.profit, 0);
    const retail = ls.filter((l) => l.type === 'PIECES');
    const retailRevenue = retail.reduce((n, l) => n + l.revenue, 0);
    return {
      count: this.sales().length,
      returned: this.sales().filter((s) => s.hasReturn && s.returnStatus === 'APPROVED').length,
      revenue,
      cost,
      profit,
      margin: revenue > 0 ? (profit / revenue) * 100 : 0,
      retailPct: revenue > 0 ? (retailRevenue / revenue) * 100 : 0,
      retailProfit: retail.reduce((n, l) => n + l.profit, 0),
      noCost: ls.filter((l) => l.noCost).length,
    };
  });

  protected readonly groups = computed<ProductProfit[]>(() => {
    const by = this.by();
    const m = new Map<string, ProductProfit>();
    for (const l of this.lines()) {
      const key = by === 'product' ? l.key : by === 'category' ? (l.category ?? '—') : l.type;
      const name =
        by === 'product' ? l.name : by === 'category' ? (l.category ?? this.i18n.t('No category', 'Bila kundi')) : this.typeName(l.type);
      const g = m.get(key) ?? { uid: key, name, category: by === 'product' ? l.category : null, pieces: 0, revenue: 0, cost: 0, profit: 0, margin: 0 };
      g.pieces += l.pieces;
      g.revenue += l.revenue;
      g.cost += l.cost;
      g.profit += l.profit;
      m.set(key, g);
    }
    return [...m.values()].map((g) => ({ ...g, margin: g.revenue > 0 ? (g.profit / g.revenue) * 100 : 0 }));
  });

  private typeName(t: string): string {
    const x = SALE_TYPES[t as SaleType];
    return x ? (this.i18n.isSwahili() ? x.sw : x.en) : t;
  }
}
