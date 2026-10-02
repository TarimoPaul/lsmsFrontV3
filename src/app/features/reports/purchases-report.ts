import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';

import { ApiError } from '@core/api/api.types';
import { AuthService } from '@core/auth/auth.service';
import { LanguageService } from '@core/i18n/language.service';
import { DataTable, EmptyState, Icon, MetricCard, MetricsGrid, SegmentOption, SegmentedFilterBar, Skeleton, TableColumn } from '@shared/ui';
import { DateRange, parseLocal, rangeForPreset, toIsoDate, toLocalDateTime } from '@shared/utils/date-utils';
import { Cell, downloadCsv, printReport } from '@shared/utils/export';
import { Money } from '@shared/utils/money';
import { BusinessService } from '@core/data/business.service';
import { Purchase, PurchaseStatus, RepurchaseInvoice } from '../purchases/purchases.models';
import { printInvoice } from '../purchases/repurchase/repurchase-invoice';
import { PurchasesService } from '../purchases/purchases.service';
import { SuppliersService } from '../suppliers/suppliers.service';
import { ReportFrame } from './report-frame';

type View = 'supplier' | 'product' | 'list' | 'invoices';

interface SupplierRow { uid: string; name: string; count: number; received: number; open: number; last: string | null; owed: number | null }
interface ProductRow { uid: string; name: string; category: string; count: number; pieces: number; cost: number; avgPiece: number | null; lastPiece: number | null; last: string | null }

const STATUS_META: Record<PurchaseStatus, { en: string; sw: string; color: string }> = {
  PENDING: { en: 'Pending', sw: 'Inasubiri', color: 'var(--c-warning)' },
  APPROVED: { en: 'Approved', sw: 'Imeidhinishwa', color: 'var(--c-info)' },
  RECEIVED: { en: 'Received', sw: 'Imepokelewa', color: 'var(--c-success)' },
  CANCELLED: { en: 'Cancelled', sw: 'Imefutwa', color: 'var(--c-text-2)' },
};

/**
 * Purchases in a period from the purchases register (the same list the
 * Purchases module uses). Cancelled orders are counted but never valued;
 * money owed per supplier comes from the suppliers' statements (AP).
 */
@Component({
  selector: 'app-purchases-report',
  imports: [ReportFrame, SegmentedFilterBar, MetricCard, MetricsGrid, Skeleton, EmptyState, Icon, DataTable, TableColumn],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-report-frame report="purchases" [range]="range()" [hasFilters]="true" (rangeChange)="setRange($event)" (refresh)="load()" (csv)="csv()" (print)="print()">
      <lsms-segmented-filter-bar filters [options]="views()" [selected]="view()" (selectedChange)="view.set($event)" />

      @if (error()) {
        <lsms-empty-state icon="cloud_off" [title]="i18n.t('Could not load purchases', 'Manunuzi hayakupatikana')" [message]="error()" />
      } @else if (!items()) {
        <lsms-skeleton variant="list" [rows]="6" />
      } @else {
        @let k = kpi();
        <lsms-metrics-grid [gap]="12">
          <lsms-metric-card [title]="i18n.t('Stock received', 'Mzigo uliopokelewa')" [value]="m(k.received)" icon="inventory" color="var(--c-success)" [subtitle]="k.receivedCount + ' ' + i18n.t('orders', 'oda')" />
          <lsms-metric-card [title]="i18n.t('Open orders', 'Oda zilizo wazi')" [value]="m(k.open)" icon="pending_actions" color="var(--c-warning)" [subtitle]="k.openCount + ' ' + i18n.t('pending / approved', 'zinasubiri / zimeidhinishwa')" />
          <lsms-metric-card [title]="i18n.t('Suppliers used', 'Wasambazaji')" [value]="'' + k.suppliers" icon="local_shipping" color="var(--c-info)" [subtitle]="k.products + ' ' + i18n.t('products bought', 'bidhaa zilizonunuliwa')" />
          <lsms-metric-card [title]="i18n.t('Owed to suppliers', 'Tunadaiwa na wasambazaji')" [value]="k.owed === null ? '—' : m(k.owed)" icon="account_balance_wallet" color="var(--c-error)" [subtitle]="i18n.t('all time, from statements', 'jumla, kutoka taarifa zao')" />
        </lsms-metrics-grid>
        @if (k.cancelled) {
          <p class="xcheck bad"><lsms-icon name="block" [size]="17" />{{ k.cancelled }} {{ i18n.t('cancelled orders in this period are not counted.', 'oda zilizofutwa katika kipindi hiki hazijahesabiwa.') }}</p>
        }

        @switch (view()) {
          @case ('supplier') {
            <section class="card flush">
              <lsms-data-table [items]="suppliers()" title="suppliers" [showHeader]="false" defaultSortColumn="received" defaultSortDirection="desc" [mobileTitle]="nameOf" [emptyTitle]="i18n.t('No purchases in this period', 'Hakuna manunuzi katika kipindi hiki')">
                <ng-template lsmsColumn="name" [label]="i18n.t('Supplier', 'Msambazaji')" [sortBy]="bySupplierName" let-row>
                  <span class="cell-stack"><strong>{{ row.name }}</strong><small>{{ i18n.t('last order', 'oda ya mwisho') }} {{ day(row.last) }}</small></span>
                </ng-template>
                <ng-template lsmsColumn="count" [label]="i18n.t('Orders', 'Oda')" align="end" [sortBy]="byCount" let-row><span class="num">{{ row.count }}</span></ng-template>
                <ng-template lsmsColumn="received" [label]="i18n.t('Received', 'Imepokelewa')" align="end" [sortBy]="byReceived" let-row><span class="num strong">{{ m(row.received) }}</span></ng-template>
                <ng-template lsmsColumn="open" [label]="i18n.t('Open', 'Wazi')" align="end" let-row><span class="num" [class.muted]="!row.open">{{ m(row.open) }}</span></ng-template>
                <ng-template lsmsColumn="owed" [label]="i18n.t('We owe (now)', 'Tunadaiwa (sasa)')" align="end" [sortBy]="byOwed" let-row><span class="num" [class.muted]="!row.owed">{{ row.owed === null ? '—' : m(row.owed) }}</span></ng-template>
              </lsms-data-table>
            </section>
          }
          @case ('product') {
            <section class="card flush">
              <lsms-data-table [items]="products()" title="products" [showHeader]="false" [pageSize]="25" defaultSortColumn="cost" defaultSortDirection="desc" [mobileTitle]="nameOf" [emptyTitle]="i18n.t('No purchases in this period', 'Hakuna manunuzi katika kipindi hiki')">
                <ng-template lsmsColumn="name" [label]="i18n.t('Product', 'Bidhaa')" [sortBy]="byProductName" let-row>
                  <span class="cell-stack"><strong>{{ row.name }}</strong><small>{{ row.category }}</small></span>
                </ng-template>
                <ng-template lsmsColumn="count" [label]="i18n.t('Orders', 'Oda')" align="end" [sortBy]="byCount" let-row><span class="num">{{ row.count }}</span></ng-template>
                <ng-template lsmsColumn="pieces" [label]="i18n.t('Pieces', 'Vipande')" align="end" [sortBy]="byPieces" let-row><span class="num">{{ row.pieces.toLocaleString() }}</span></ng-template>
                <ng-template lsmsColumn="cost" [label]="i18n.t('Total cost', 'Gharama')" align="end" [sortBy]="byCost" let-row><span class="num strong">{{ m(row.cost) }}</span></ng-template>
                <ng-template lsmsColumn="avg" [label]="i18n.t('Avg. per piece', 'Wastani/kipande')" align="end" let-row><span class="num">{{ row.avgPiece === null ? '—' : m(row.avgPiece) }}</span></ng-template>
                <ng-template lsmsColumn="lastp" [label]="i18n.t('Last price / piece', 'Bei ya mwisho/kipande')" align="end" let-row>
                  <span class="num" [class.up]="row.lastPiece !== null && row.avgPiece !== null && row.lastPiece > row.avgPiece + 0.5">{{ row.lastPiece === null ? '—' : m(row.lastPiece) }}</span>
                </ng-template>
              </lsms-data-table>
            </section>
          }
          @case ('invoices') {
            <section class="card flush">
              @if (!invoices()) {
                <lsms-skeleton variant="list" [rows]="5" />
              } @else {
                <lsms-data-table [items]="invoices()!" title="invoices" [showHeader]="false" [pageSize]="25" defaultSortColumn="date" defaultSortDirection="desc" [mobileTitle]="invNo" [emptyTitle]="i18n.t('No invoices in this period', 'Hakuna ankara katika kipindi hiki')" (rowClick)="reprint($event)">
                  <ng-template lsmsColumn="no" [label]="i18n.t('Invoice', 'Ankara')" [sortBy]="invNo" let-row>
                    <span class="cell-stack"><strong>{{ row.invoiceNumber }}</strong><small>{{ row.buyerName }}</small></span>
                  </ng-template>
                  <ng-template lsmsColumn="date" [label]="i18n.t('Date', 'Tarehe')" [sortBy]="invDate" let-row>{{ day(row.createdAt) }}</ng-template>
                  <ng-template lsmsColumn="items" [label]="i18n.t('Products', 'Bidhaa')" align="end" let-row><span class="num">{{ row.items.length }}</span></ng-template>
                  <ng-template lsmsColumn="suppliers" [label]="i18n.t('Suppliers', 'Wasambazaji')" let-row><span class="muted">{{ suppliersOf(row) }}</span></ng-template>
                  <ng-template lsmsColumn="total" [label]="i18n.t('Total', 'Jumla')" align="end" [sortBy]="invTotal" let-row><span class="num strong">{{ m(row.grandTotal) }}</span></ng-template>
                  <ng-template lsmsColumn="print" label="" align="end" let-row><lsms-icon name="print" [size]="18" class="muted" /></ng-template>
                </lsms-data-table>
              }
            </section>
          }
          @case ('list') {
            <section class="card flush">
              <lsms-data-table [items]="items()!" title="purchases" [showHeader]="false" [pageSize]="25" defaultSortColumn="date" defaultSortDirection="desc" [mobileTitle]="productOf" [emptyTitle]="i18n.t('No purchases in this period', 'Hakuna manunuzi katika kipindi hiki')">
                <ng-template lsmsColumn="date" [label]="i18n.t('Date', 'Tarehe')" [sortBy]="byDate" let-row>{{ day(row.purchaseDate) }}</ng-template>
                <ng-template lsmsColumn="product" [label]="i18n.t('Product', 'Bidhaa')" [sortBy]="productOf" let-row>
                  <span class="cell-stack"><strong>{{ row.productName }}</strong><small>{{ row.quantityDisplay ?? row.quantity }}</small></span>
                </ng-template>
                <ng-template lsmsColumn="supplier" [label]="i18n.t('Supplier', 'Msambazaji')" let-row>{{ row.supplierName ?? '—' }}</ng-template>
                <ng-template lsmsColumn="cost" [label]="i18n.t('Total cost', 'Gharama')" align="end" [sortBy]="byTotal" let-row><span class="num strong" [class.muted]="row.status === 'CANCELLED'">{{ m(row.totalCost) }}</span></ng-template>
                <ng-template lsmsColumn="status" [label]="i18n.t('Status', 'Hali')" let-row>
                  @let s = status(row.status);
                  <span class="status" [style.--st]="s.color">{{ i18n.isSwahili() ? s.sw : s.en }}</span>
                </ng-template>
              </lsms-data-table>
            </section>
          }
        }
      }
    </app-report-frame>
  `,
  styleUrl: './report.scss',
  styles: `.up { color: var(--c-warning); }`,
})
export class PurchasesReport {
  protected readonly i18n = inject(LanguageService);
  private readonly api = inject(PurchasesService);
  private readonly suppliersApi = inject(SuppliersService);
  private readonly auth = inject(AuthService);

  protected readonly range = signal<DateRange>(rangeForPreset('thisMonth'));
  protected readonly view = signal<View>('supplier');
  protected readonly items = signal<Purchase[] | null>(null);
  protected readonly error = signal('');
  private readonly suppliersList = this.suppliersApi.list.value;

  protected readonly views = computed<SegmentOption<View>[]>(() => [
    { value: 'supplier', label: this.i18n.t('By supplier', 'Kwa msambazaji'), icon: 'local_shipping' },
    { value: 'product', label: this.i18n.t('By product', 'Kwa bidhaa'), icon: 'inventory_2' },
    { value: 'list', label: this.i18n.t('All orders', 'Oda zote'), icon: 'list', count: this.items()?.length },
    { value: 'invoices', label: this.i18n.t('Invoices', 'Ankara'), icon: 'receipt_long', count: this.invoices()?.length },
  ]);

  /** Saved repurchase invoices (the order sheets) — loaded with the period, reprinted on click. */
  protected readonly invoices = signal<RepurchaseInvoice[] | null>(null);
  private readonly business = inject(BusinessService);
  protected readonly invNo = (r: RepurchaseInvoice) => r.invoiceNumber;
  protected readonly invDate = (r: RepurchaseInvoice) => r.createdAt;
  protected readonly invTotal = (r: RepurchaseInvoice) => r.grandTotal;

  private readonly live = computed(() => (this.items() ?? []).filter((p) => p.status !== 'CANCELLED'));
  private readonly owedBySupplier = computed(() => {
    const list = this.suppliersList();
    return list ? new Map(list.map((s) => [s.uid, s.outstanding])) : null;
  });

  protected readonly kpi = computed(() => {
    const all = this.items() ?? [];
    const live = this.live();
    const rec = live.filter((p) => p.status === 'RECEIVED');
    const open = live.filter((p) => p.status === 'PENDING' || p.status === 'APPROVED');
    const owed = this.suppliersList();
    return {
      received: rec.reduce((a, p) => a + p.totalCost, 0),
      receivedCount: rec.length,
      open: open.reduce((a, p) => a + p.totalCost, 0),
      openCount: open.length,
      cancelled: all.length - live.length,
      suppliers: new Set(live.map((p) => p.supplierUid ?? p.supplierName ?? '—')).size,
      products: new Set(live.map((p) => p.productUid)).size,
      owed: owed ? owed.reduce((a, s) => a + s.outstanding, 0) : null,
    };
  });

  protected readonly suppliers = computed<SupplierRow[]>(() => {
    const owed = this.owedBySupplier();
    const map = new Map<string, SupplierRow>();
    for (const p of this.live()) {
      const key = p.supplierUid ?? p.supplierName ?? '—';
      const row = map.get(key) ?? { uid: key, name: p.supplierName ?? this.i18n.t('No supplier', 'Bila msambazaji'), count: 0, received: 0, open: 0, last: null, owed: p.supplierUid && owed ? (owed.get(p.supplierUid) ?? 0) : null };
      row.count++;
      if (p.status === 'RECEIVED') row.received += p.totalCost;
      else row.open += p.totalCost;
      if ((p.purchaseDate ?? '') > (row.last ?? '')) row.last = p.purchaseDate;
      map.set(key, row);
    }
    return [...map.values()];
  });

  protected readonly products = computed<ProductRow[]>(() => {
    const map = new Map<string, ProductRow & { lastDate: string }>();
    for (const p of this.live()) {
      const pieces = p.totalPieces ?? p.quantity;
      const row = map.get(p.productUid) ?? { uid: p.productUid, name: p.productName, category: p.categoryName ?? '—', count: 0, pieces: 0, cost: 0, avgPiece: null, lastPiece: null, last: null, lastDate: '' };
      row.count++;
      row.pieces += pieces;
      row.cost += p.totalCost;
      const date = p.purchaseDate ?? '';
      if (date >= row.lastDate) {
        row.lastDate = date;
        row.last = p.purchaseDate;
        row.lastPiece = p.costPerPiece ?? (pieces ? p.totalCost / pieces : null);
      }
      row.avgPiece = row.pieces ? row.cost / row.pieces : null;
      map.set(p.productUid, row);
    }
    return [...map.values()];
  });

  protected readonly nameOf = (r: { name: string }) => r.name;
  protected readonly productOf = (r: Purchase) => r.productName;
  protected readonly bySupplierName = (r: SupplierRow) => r.name.toLowerCase();
  protected readonly byProductName = (r: ProductRow) => r.name.toLowerCase();
  protected readonly byCount = (r: { count: number }) => r.count;
  protected readonly byReceived = (r: SupplierRow) => r.received;
  protected readonly byOwed = (r: SupplierRow) => r.owed ?? 0;
  protected readonly byPieces = (r: ProductRow) => r.pieces;
  protected readonly byCost = (r: ProductRow) => r.cost;
  protected readonly byDate = (r: Purchase) => r.purchaseDate ?? '';
  protected readonly byTotal = (r: Purchase) => r.totalCost;

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
    this.items.set(null);
    this.api
      .byDateRange(toLocalDateTime(r.start), toLocalDateTime(r.end))
      .then((p) => this.items.set(p))
      .catch((e) => this.error.set(ApiError.from(e).message));
    this.invoices.set(null);
    this.api
      .invoices(toIsoDate(r.start), toIsoDate(r.end))
      .then((l) => this.invoices.set(l))
      .catch(() => this.invoices.set([]));
    void this.business.profile.load().catch(() => undefined);
    if (this.auth.hasPermission('SUPPLIER_READ')) void this.suppliersApi.list.load().catch(() => undefined);
  }

  protected m(v: number): string {
    return Money.format(v, { decimals: 0 });
  }

  protected day(v: string | null): string {
    const d = parseLocal(v);
    return d ? new Intl.DateTimeFormat(this.i18n.isSwahili() ? 'sw-TZ' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(d) : '—';
  }

  protected suppliersOf(inv: RepurchaseInvoice): string {
    const names = [...new Set(inv.items.map((i) => i.supplierName).filter((x): x is string => !!x))];
    return names.length ? names.join(', ') : '—';
  }

  protected reprint(inv: RepurchaseInvoice): void {
    printInvoice(inv, this.business.profile.value(), this.i18n.isSwahili());
  }

  protected status(s: PurchaseStatus) {
    return STATUS_META[s] ?? { en: s, sw: s, color: 'var(--c-text-2)' };
  }

  private table(): { title: string; headers: string[]; rows: Cell[][]; money: number[] } {
    const t = (en: string, sw: string) => this.i18n.t(en, sw);
    switch (this.view()) {
      case 'supplier':
        return {
          title: t('Purchases by supplier', 'Manunuzi kwa msambazaji'),
          headers: [t('Supplier', 'Msambazaji'), t('Orders', 'Oda'), t('Received', 'Imepokelewa'), t('Open', 'Wazi'), t('We owe (now)', 'Tunadaiwa (sasa)')],
          rows: [...this.suppliers()].sort((a, b) => b.received - a.received).map((r) => [r.name, r.count, r.received, r.open, r.owed ?? '']),
          money: [2, 3, 4],
        };
      case 'product':
        return {
          title: t('Purchases by product', 'Manunuzi kwa bidhaa'),
          headers: [t('Product', 'Bidhaa'), t('Category', 'Kategoria'), t('Orders', 'Oda'), t('Pieces', 'Vipande'), t('Total cost', 'Gharama'), t('Avg. per piece', 'Wastani/kipande'), t('Last price / piece', 'Bei ya mwisho/kipande')],
          rows: [...this.products()].sort((a, b) => b.cost - a.cost).map((r) => [r.name, r.category, r.count, r.pieces, r.cost, r.avgPiece === null ? '' : Math.round(r.avgPiece), r.lastPiece === null ? '' : Math.round(r.lastPiece)]),
          money: [4, 5, 6],
        };
      case 'invoices':
        return {
          title: t('Saved invoices', 'Ankara zilizohifadhiwa'),
          headers: [t('Invoice', 'Ankara'), t('Date', 'Tarehe'), t('Buyer', 'Mnunuzi'), t('Products', 'Bidhaa'), t('Suppliers', 'Wasambazaji'), t('Total', 'Jumla')],
          rows: (this.invoices() ?? []).map((i) => [i.invoiceNumber, i.createdAt.slice(0, 16).replace('T', ' '), i.buyerName, i.items.length, this.suppliersOf(i), i.grandTotal]),
          money: [5],
        };
      default:
        return {
          title: t('Purchase orders', 'Oda za manunuzi'),
          headers: [t('Date', 'Tarehe'), t('Product', 'Bidhaa'), t('Quantity', 'Kiasi'), t('Supplier', 'Msambazaji'), t('Total cost', 'Gharama'), t('Status', 'Hali')],
          rows: (this.items() ?? []).map((p) => [(p.purchaseDate ?? '').slice(0, 10), p.productName, p.quantityDisplay ?? p.quantity, p.supplierName ?? '', p.totalCost, this.i18n.isSwahili() ? this.status(p.status).sw : this.status(p.status).en]),
          money: [4],
        };
    }
  }

  protected csv(): void {
    const tb = this.table();
    downloadCsv(`purchases_${this.view()}`, tb.headers, tb.rows);
  }

  protected print(): void {
    const tb = this.table();
    const k = this.kpi();
    const r = this.range();
    printReport({
      title: tb.title,
      subtitle: `${toIsoDate(r.start)} – ${toIsoDate(r.end)}`,
      headers: tb.headers,
      rows: tb.rows.map((row) => row.map((c, i) => (typeof c === 'number' && tb.money.includes(i) ? this.m(c) : c))),
      numeric: tb.money,
      summary: [
        [this.i18n.t('Received', 'Imepokelewa'), this.m(k.received)],
        [this.i18n.t('Open orders', 'Oda wazi'), this.m(k.open)],
        ...(k.owed !== null ? ([[this.i18n.t('Owed to suppliers', 'Tunadaiwa'), this.m(k.owed)]] as [string, string][]) : []),
      ],
    });
  }
}
