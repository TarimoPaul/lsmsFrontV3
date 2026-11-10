import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';

import { ApiError } from '@core/api/api.types';
import { AuthService } from '@core/auth/auth.service';
import { LanguageService } from '@core/i18n/language.service';
import { DataTable, DialogService, EmptyState, Icon, MetricCard, MetricsGrid, SearchBar, SegmentOption, SegmentedFilterBar, Skeleton, TableColumn } from '@shared/ui';
import { Cell, downloadCsv, printReport } from '@shared/utils/export';
import { Money } from '@shared/utils/money';
import { ControlCheck } from '../general-ledger/gl.models';
import { GlService } from '../general-ledger/gl.service';
import { Product } from '../products/products.models';
import { ProductsService } from '../products/products.service';
import { HEALTH, StockHealth, packagesLabel, stockHealth } from '../store/store.models';
import { StoreService } from '../store/store.service';
import type { PrintColumnsData } from './print-columns-dialog';
import { ReportFrame } from './report-frame';

type Filter = 'ALL' | 'LOW' | 'OUT' | 'NEGATIVE';

export interface StockRow {
  uid: string;
  name: string;
  category: string;
  stock: number;
  stockLabel: string;
  avgCost: number | null;
  costValue: number;
  piece: number | null;
  quarter: number | null;
  half: number | null;
  whole: number | null;
  retailValue: number;
  health: StockHealth;
}

/**
 * Stock report from the Store's stock summary (stock × weighted average cost of
 * the last 6 months' purchases — the backend valuation the GL check uses)
 * joined with the product catalogue for the four selling prices. The value at
 * cost is compared with the GL inventory account. Flutter's server endpoints
 * (/api/v1/reports/inventory/*, reorder, top-moving) all fail, so this uses
 * the same data the Store page shows.
 */
@Component({
  selector: 'app-inventory-report',
  imports: [ReportFrame, SegmentedFilterBar, SearchBar, MetricCard, MetricsGrid, Skeleton, EmptyState, Icon, DataTable, TableColumn],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-report-frame report="inventory" [hasFilters]="true" [note]="i18n.t('as of now', 'kwa sasa')" (refresh)="load(true)" (csv)="csv()" (print)="print()">
      <div filters class="filters">
        <lsms-segmented-filter-bar [options]="filters()" [selected]="filter()" (selectedChange)="filter.set($event)" />
        <lsms-segmented-filter-bar [options]="thresholds()" [selected]="threshold()" (selectedChange)="threshold.set($event)" />
        <lsms-search-bar class="search" [(value)]="q" [placeholder]="i18n.t('Search product or category', 'Tafuta bidhaa au kategoria')" />
      </div>

      @if (error()) {
        <lsms-empty-state icon="cloud_off" [title]="i18n.t('Could not load stock', 'Stoki haikupatikana')" [message]="error()" />
      } @else if (!rows()) {
        <lsms-skeleton variant="list" [rows]="6" />
      } @else {
        @let k = kpi();
        <lsms-metrics-grid [gap]="12">
          <lsms-metric-card [title]="i18n.t('Stock at cost', 'Stoki kwa gharama')" [value]="m(k.cost)" icon="inventory_2" color="var(--c-info)" [subtitle]="k.noCost ? k.noCost + ' ' + i18n.t('products have no cost price', 'bidhaa hazina bei ya kununua') : i18n.t('stock × weighted buying price (6 months)', 'stoki × wastani wa bei ya kununua (miezi 6)')" />
          <lsms-metric-card [title]="i18n.t('At selling price', 'Kwa bei ya kuuza')" [value]="m(k.retail)" icon="sell" color="var(--c-success)" [subtitle]="i18n.t('possible gross profit ', 'faida inayowezekana ') + m(k.retail - k.cost)" />
          <lsms-metric-card [title]="i18n.t('Products in stock', 'Bidhaa zilizopo')" [value]="k.inStock + ' / ' + k.total" icon="category" color="var(--c-primary)" />
          <lsms-metric-card [title]="i18n.t('Need re-ordering', 'Zinahitaji kuagizwa')" [value]="'' + (k.low + k.out)" icon="shopping_cart_checkout" color="var(--c-warning)" [urgent]="k.out > 0" [subtitle]="k.low + ' ' + i18n.t('low', 'chache') + ' · ' + k.out + ' ' + i18n.t('out', 'zimeisha') + (k.negative ? ' · ' + k.negative + ' ' + i18n.t('negative', 'hasi') : '')" />
        </lsms-metrics-grid>

        @if (glCheck(); as g) {
          <p class="xcheck" [class.bad]="!g.reconciled">
            <lsms-icon [name]="g.reconciled ? 'verified' : 'info'" [size]="17" />
            {{ i18n.t('General Ledger stock (account', 'Stoki kwenye Leja Kuu (akaunti') }} {{ g.accountCode }}): <b>{{ m(g.glBalance) }}</b>
            @if (!g.reconciled) {
              — {{ i18n.t('store is higher by', 'stoo iko juu kwa') }} <b>{{ m(g.difference) }}</b>
              ({{ i18n.t('stock adjustments recorded without a cost; fix with a GL true-up', 'marekebisho ya stoki yasiyo na gharama; rekebisha kwa true-up ya GL') }})
            }
          </p>
        }

        <section class="card flush">
          <lsms-data-table [items]="visible()" title="stock" [showHeader]="false" [pageSize]="25" defaultSortColumn="name" [mobileTitle]="nameOf" [emptyTitle]="i18n.t('No products match', 'Hakuna bidhaa zinazolingana')">
            <ng-template lsmsColumn="name" [label]="i18n.t('Product', 'Bidhaa')" [sortBy]="byName" let-row>
              <span class="cell-stack"><strong>{{ row.name }}</strong><small>{{ row.category }}</small></span>
            </ng-template>
            <ng-template lsmsColumn="stock" [label]="i18n.t('In stock', 'Stoki')" align="end" [sortBy]="byStock" let-row>
              <span class="cell-stack end"><span class="num strong">{{ row.stockLabel }}</span>@if (row.stockLabel !== row.stock + ' pcs') {<small>{{ row.stock }} pcs</small>}</span>
            </ng-template>
            <ng-template lsmsColumn="avgCost" [label]="i18n.t('Buying price', 'Bei ya kununua')" align="end" let-row><span class="num muted">{{ row.avgCost !== null ? m(row.avgCost) : '—' }}</span></ng-template>
            <ng-template lsmsColumn="costValue" [label]="i18n.t('Value at cost', 'Thamani (gharama)')" align="end" [sortBy]="byCost" let-row><span class="num strong">{{ m(row.costValue) }}</span></ng-template>
            <ng-template lsmsColumn="piece" [label]="i18n.t('Retail', 'Rejareja')" align="end" let-row><span class="num">{{ price(row.piece) }}</span></ng-template>
            <ng-template lsmsColumn="quarter" [label]="i18n.t('Quarter', 'Robo')" align="end" [hidden]="true" let-row><span class="num">{{ price(row.quarter) }}</span></ng-template>
            <ng-template lsmsColumn="half" [label]="i18n.t('Half', 'Nusu')" align="end" [hidden]="true" let-row><span class="num">{{ price(row.half) }}</span></ng-template>
            <ng-template lsmsColumn="whole" [label]="i18n.t('Wholesale', 'Jumla')" align="end" let-row><span class="num">{{ price(row.whole) }}</span></ng-template>
            <ng-template lsmsColumn="retailValue" [label]="i18n.t('Value at retail', 'Thamani (kuuza)')" align="end" [sortBy]="byRetail" [hidden]="true" let-row><span class="num">{{ m(row.retailValue) }}</span></ng-template>
            <ng-template lsmsColumn="health" [label]="i18n.t('Status', 'Hali')" [sortBy]="byHealth" let-row>
              @let h = health(row.health);
              <span class="status" [style.--st]="h.color">{{ i18n.isSwahili() ? h.sw : h.en }}</span>
            </ng-template>
          </lsms-data-table>
        </section>
      }
    </app-report-frame>
  `,
  styleUrl: './report.scss',
  styles: `
    .search { flex: 1 1 220px; min-width: 200px; max-width: 360px; }
    .cell-stack.end { align-items: flex-end; }
  `,
})
export class InventoryReport {
  protected readonly i18n = inject(LanguageService);
  private readonly store = inject(StoreService);
  private readonly productsApi = inject(ProductsService);
  private readonly gl = inject(GlService);
  private readonly auth = inject(AuthService);
  private readonly dialogs = inject(DialogService);

  protected readonly filter = signal<Filter>('ALL');
  protected readonly threshold = signal(10);
  protected readonly q = signal('');
  protected readonly error = signal('');
  private readonly check = signal<ControlCheck | null>(null);

  protected readonly glCheck = this.check.asReadonly();

  private readonly stock = this.store.stock.value;
  private readonly catalogue = this.productsApi.catalogue.value;

  protected readonly rows = computed<StockRow[] | null>(() => {
    const stock = this.stock();
    if (!stock) return null;
    const byUid = new Map<string, Product>((this.catalogue() ?? []).map((p) => [p.uid, p]));
    const t = this.threshold();
    return stock.map((s) => {
      const p = byUid.get(s.uid);
      const piece = p?.pieceSalePrice ?? s.pieceSalePrice;
      const qty = Math.max(0, s.currentStock);
      const cost = s.averageCostPrice || null;
      return {
        uid: s.uid,
        name: s.productName,
        category: s.category ?? p?.categoryName ?? '—',
        stock: s.currentStock,
        stockLabel: packagesLabel(s.currentStock, s.piecesPerPackage, s.packageAbbreviation, 'pcs'),
        avgCost: cost,
        costValue: qty * (cost ?? 0),
        piece,
        quarter: p?.quarterSalePrice ?? null,
        half: p?.halfSalePrice ?? null,
        whole: p?.wholeSalePrice ?? null,
        retailValue: qty * (piece ?? 0),
        health: stockHealth(s, t),
      };
    });
  });

  protected readonly kpi = computed(() => {
    const r = this.rows() ?? [];
    return {
      total: r.length,
      inStock: r.filter((x) => x.stock > 0).length,
      cost: r.reduce((a, x) => a + x.costValue, 0),
      retail: r.reduce((a, x) => a + x.retailValue, 0),
      noCost: r.filter((x) => x.stock > 0 && !x.avgCost).length,
      low: r.filter((x) => x.health === 'LOW').length,
      out: r.filter((x) => x.health === 'OUT').length,
      negative: r.filter((x) => x.health === 'NEGATIVE').length,
    };
  });

  protected readonly filters = computed<SegmentOption<Filter>[]>(() => {
    const k = this.kpi();
    return [
      { value: 'ALL', label: this.i18n.t('All', 'Zote'), count: k.total },
      { value: 'LOW', label: this.i18n.t('Low', 'Chache'), count: k.low },
      { value: 'OUT', label: this.i18n.t('Out', 'Zimeisha'), count: k.out },
      { value: 'NEGATIVE', label: this.i18n.t('Negative', 'Hasi'), count: k.negative },
    ];
  });
  protected readonly thresholds = computed<SegmentOption<number>[]>(() =>
    [5, 10, 20].map((n) => ({ value: n, label: this.i18n.t(`Low ≤ ${n}`, `Chache ≤ ${n}`) })),
  );

  protected readonly visible = computed(() => {
    const f = this.filter();
    const q = this.q().trim().toLowerCase();
    return (this.rows() ?? []).filter((r) => (f === 'ALL' || r.health === f) && (!q || r.name.toLowerCase().includes(q) || r.category.toLowerCase().includes(q)));
  });

  protected readonly nameOf = (r: StockRow) => r.name;
  protected readonly byName = (r: StockRow) => r.name.toLowerCase();
  protected readonly byStock = (r: StockRow) => r.stock;
  protected readonly byCost = (r: StockRow) => r.costValue;
  protected readonly byRetail = (r: StockRow) => r.retailValue;
  protected readonly byHealth = (r: StockRow) => ['NEGATIVE', 'OUT', 'LOW', 'OK'].indexOf(r.health);

  constructor() {
    this.load(false);
  }

  protected load(force: boolean): void {
    this.error.set('');
    this.store.stock.load(force).catch((e) => this.error.set(ApiError.from(e).message));
    void this.productsApi.catalogue.load(force).catch(() => undefined);
    if (this.auth.hasPermission('FINANCE_READ')) {
      this.gl
        .controlChecks()
        .then((c) => this.check.set(c.find((x) => x.key === 'INVENTORY') ?? null))
        .catch(() => this.check.set(null));
    }
  }

  protected m(v: number): string {
    return Money.format(v, { decimals: 0 });
  }

  protected price(v: number | null): string {
    return v ? Money.format(v, { symbol: false, decimals: 0 }) : '—';
  }

  protected health(h: StockHealth) {
    return HEALTH[h];
  }

  private allColumns(): { key: keyof StockRow | 'sno'; label: string; money?: boolean; secret?: boolean }[] {
    const t = (en: string, sw: string) => this.i18n.t(en, sw);
    return [
      { key: 'sno', label: 'S/No' },
      { key: 'name', label: t('Product', 'Bidhaa') },
      { key: 'category', label: t('Category', 'Kategoria') },
      { key: 'stockLabel', label: t('In stock', 'Stoki') },
      { key: 'avgCost', label: t('Buying price', 'Bei ya kununua'), money: true, secret: true },
      { key: 'costValue', label: t('Value at cost', 'Thamani (gharama)'), money: true, secret: true },
      { key: 'piece', label: t('Retail', 'Rejareja'), money: true },
      { key: 'quarter', label: t('Quarter', 'Robo'), money: true },
      { key: 'half', label: t('Half', 'Nusu'), money: true },
      { key: 'whole', label: t('Wholesale', 'Jumla'), money: true },
      { key: 'retailValue', label: t('Value at retail', 'Thamani (kuuza)'), money: true },
      { key: 'health', label: t('Status', 'Hali') },
    ];
  }

  private cell(r: StockRow, key: string, i: number, forPrint: boolean): Cell {
    if (key === 'sno') return i + 1;
    if (key === 'health') {
      const h = HEALTH[r.health];
      return this.i18n.isSwahili() ? h.sw : h.en;
    }
    const v = r[key as keyof StockRow];
    if (typeof v === 'number' && forPrint && key !== 'stock') return v ? Money.format(v, { symbol: false, decimals: 0 }) : '—';
    return v ?? '';
  }

  protected csv(): void {
    const cols = this.allColumns().filter((c) => c.key !== 'sno');
    downloadCsv('stock_report', cols.map((c) => c.label), this.visible().map((r, i) => cols.map((c) => this.cell(r, c.key, i, false))));
  }

  /** Print with a column picker; buying prices are off by default (sensitive), as in Flutter. */
  protected async print(): Promise<void> {
    const cols = this.allColumns();
    const { PrintColumnsDialog } = await import('./print-columns-dialog');
    const picked = await this.dialogs.openAsync<string[], PrintColumnsData>(PrintColumnsDialog, {
      size: 'sm',
      data: {
        columns: cols.map((c) => ({ key: c.key, label: c.label, secret: !!c.secret, on: !c.secret && c.key !== 'category' && c.key !== 'retailValue' })),
        count: this.visible().length,
      },
    });
    if (!picked?.length) return;
    const use = cols.filter((c) => picked.includes(c.key));
    const k = this.kpi();
    const showCost = picked.includes('avgCost') || picked.includes('costValue');
    printReport({
      title: this.i18n.t('Stock report', 'Ripoti ya stoki'),
      subtitle: `${this.visible().length} ${this.i18n.t('products', 'bidhaa')}`,
      headers: use.map((c) => c.label),
      rows: this.visible().map((r, i) => use.map((c) => this.cell(r, c.key, i, true))),
      numeric: use.map((c, i) => (c.money || c.key === 'sno' ? i : -1)).filter((i) => i >= 0),
      summary: [
        ...(showCost ? ([[this.i18n.t('Stock at cost', 'Stoki kwa gharama'), this.m(k.cost)]] as [string, string][]) : []),
        [this.i18n.t('At selling price', 'Kwa bei ya kuuza'), this.m(k.retail)],
        [this.i18n.t('Low / out', 'Chache / zimeisha'), `${k.low} / ${k.out}`],
      ],
    });
  }
}
