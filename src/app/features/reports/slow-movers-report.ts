import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';

import { ApiError } from '@core/api/api.types';
import { LanguageService } from '@core/i18n/language.service';
import { DataTable, EmptyState, Icon, SegmentOption, SegmentedFilterBar, Skeleton, TableColumn } from '@shared/ui';
import { parseLocal } from '@shared/utils/date-utils';
import { Cell, downloadCsv, printReport } from '@shared/utils/export';
import { Money } from '@shared/utils/money';
import { ReportFrame } from './report-frame';
import { SLOW_ACTIONS, SlowAction, SlowMover, SlowMovers } from './reports.models';
import { ReportsService } from './reports.service';

type Filter = 'STUCK' | 'ALL' | SlowAction;

/**
 * "Bidhaa zisizotembea": stock the order formula does not forecast (slow,
 * intermittent or dormant products), valued at purchase cost, with the cash
 * stuck in it on top and a suggested action per product. Read-only; every
 * figure and rule comes from GET /api/reports/slow-movers.
 */
@Component({
  selector: 'app-slow-movers-report',
  imports: [ReportFrame, SegmentedFilterBar, Skeleton, EmptyState, Icon, DataTable, TableColumn],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-report-frame report="slow-movers" [note]="note()" [hasFilters]="true" (refresh)="load()" (csv)="csv()" (print)="print()">
      <lsms-segmented-filter-bar filters [options]="filters()" [selected]="filter()" (selectedChange)="filter.set($event)" />

      @if (error()) {
        <lsms-empty-state icon="cloud_off" [title]="i18n.t('Could not load slow-moving stock', 'Bidhaa zisizotembea hazikupatikana')" [message]="error()" />
      } @else if (!data()) {
        <lsms-skeleton variant="list" [rows]="6" />
      } @else if (!data()!.stockDate) {
        <lsms-empty-state icon="fact_check" [title]="i18n.t('No stock count yet', 'Hakuna hesabu ya stoki')" [message]="i18n.t('This report needs a stock count from the last 60 days.', 'Ripoti hii inahitaji hesabu ya stoki ya siku 60 zilizopita.')" />
      } @else {
        @let d = data()!;
        @let t = d.totals;

        <section class="hero">
          <div class="sum">
            <header><lsms-icon name="hourglass_bottom" [size]="20" /><span>{{ i18n.t('Cash stuck in stock', 'Pesa iliyokwama kwenye stoki') }}</span></header>
            <b>{{ m(t.stuckValue) }}</b>
            <p>
              {{ t.stuckProducts }} {{ i18n.t('products at purchase cost', 'bidhaa, kwa bei ya kununua') }} ·
              {{ pct(t.stuckValue, t.stockValue) }} {{ i18n.t('of the', 'ya') }} {{ m(t.stockValue) }}
              {{ i18n.t('in the ' + t.products + ' slow products listed', 'ya bidhaa ' + t.products + ' zisizotembea zilizoorodheshwa') }}
            </p>
          </div>
          <ul class="acts">
            @for (a of t.actions; track a.action) {
              <li [style.--st]="color(a.action)">
                <button type="button" [class.on]="filter() === a.action" (click)="filter.set(a.action)">
                  <span class="lbl">{{ label(a.action) }}</span>
                  <b>{{ m(a.value) }}</b>
                  <small>{{ a.products }} {{ i18n.t('products', 'bidhaa') }}</small>
                </button>
              </li>
            }
          </ul>
        </section>

        @if (stale(); as s) {
          <p class="xcheck bad"><lsms-icon name="info" [size]="17" />{{ s }}</p>
        }

        <section class="card flush">
          <lsms-data-table [items]="visible()" [rowId]="rowId" title="slow-movers" [showHeader]="false" [pageSize]="25" defaultSortColumn="value" defaultSortDirection="desc" [mobileTitle]="title" [emptyTitle]="i18n.t('Nothing to show', 'Hakuna cha kuonyesha')">
            <ng-template lsmsColumn="product" [label]="i18n.t('Product', 'Bidhaa')" [sortBy]="byName" let-row>
              <span class="cell-stack"><strong>{{ row.name }}</strong><small>#{{ row.productId }}@if (row.category) { · {{ row.category }} }@if (row.orderClass === 'NONE') { · {{ i18n.t('no sale or purchase in 60 days', 'haijauzwa wala kununuliwa siku 60') }} }</small></span>
            </ng-template>
            <ng-template lsmsColumn="qty" [label]="i18n.t('Qty', 'Idadi')" align="end" [sortBy]="byQty" let-row><span class="num">{{ q(row.quantity) }}</span></ng-template>
            <ng-template lsmsColumn="value" [label]="i18n.t('Value at cost', 'Thamani (bei ya kununua)')" align="end" [sortBy]="byValue" let-row>
              <span class="cell-stack end"><strong class="num">{{ m(row.value) }}</strong><small>&#64; {{ m(row.unitCost) }}</small></span>
            </ng-template>
            <ng-template lsmsColumn="last" [label]="i18n.t('Last sale', 'Mauzo ya mwisho')" align="end" [sortBy]="bySince" let-row>
              @if (row.daysSinceLastSale === null) {
                <span class="muted">{{ i18n.t('never sold', 'haijawahi kuuzwa') }}</span>
              } @else {
                <span class="cell-stack end"><strong class="num" [class.neg]="row.daysSinceLastSale >= 60">{{ i18n.t(row.daysSinceLastSale + ' days', 'siku ' + row.daysSinceLastSale) }}</strong><small>{{ day(row.lastSaleDate) }}</small></span>
              }
            </ng-template>
            <ng-template lsmsColumn="sold30" [label]="i18n.t('Sold 30 d', 'Mauzo siku 30')" align="end" [sortBy]="by30" let-row><span class="num" [class.muted]="!row.sold30">{{ q(row.sold30) }}</span></ng-template>
            <ng-template lsmsColumn="sold60" [label]="i18n.t('Sold 60 d', 'Mauzo siku 60')" align="end" [sortBy]="by60" let-row><span class="num" [class.muted]="!row.sold60">{{ q(row.sold60) }}</span></ng-template>
            <ng-template lsmsColumn="cover" [label]="i18n.t('Stock lasts', 'Stoki inatosha')" align="end" [sortBy]="byCover" let-row>
              <span class="num" [class.muted]="row.coverDays === null">{{ row.coverDays === null ? '—' : i18n.t(round(row.coverDays) + ' days', 'siku ' + round(row.coverDays)) }}</span>
            </ng-template>
            <ng-template lsmsColumn="action" [label]="i18n.t('Suggested action', 'Hatua inayopendekezwa')" [sortBy]="byAction" let-row>
              <span class="status" [style.--st]="color(row.action)">{{ label(row.action) }}</span>
            </ng-template>
          </lsms-data-table>
        </section>

        <p class="pad muted">
          {{ i18n.t(
            'Listed: products with counted stock that sell too slowly or too irregularly for the order formula, or that were neither sold nor bought in 60 days. Action: nothing sold in 60 days → return / cut price; stock for more than 120 days → cut price; 46–120 days → stop ordering.',
            'Zilizoorodheshwa: bidhaa zenye stoki iliyohesabiwa zinazouzika polepole mno au bila mpangilio kwa formula ya oda, au ambazo hazikuuzwa wala kununuliwa kwa siku 60. Hatua: mauzo 0 kwa siku 60 → rudisha / punguza bei; stoki ya zaidi ya siku 120 → punguza bei; siku 46–120 → acha kuagiza.'
          ) }}
        </p>
      }
    </app-report-frame>
  `,
  styleUrl: './report.scss',
  styles: `
    .hero { display: grid; grid-template-columns: minmax(260px, 1fr) minmax(0, 2fr); gap: 16px; padding: 18px 20px; border-radius: 18px;
      background: color-mix(in srgb, var(--c-warning) 7%, var(--c-surface)); border: 1px solid color-mix(in srgb, var(--c-warning) 30%, var(--c-border)); }
    @media (max-width: 900px) { .hero { grid-template-columns: 1fr; } }
    .sum { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
    .sum header { display: flex; align-items: center; gap: 8px; font-size: 0.8rem; font-weight: 800; letter-spacing: 0.6px; text-transform: uppercase; color: var(--c-text-2); lsms-icon { color: var(--c-warning); } }
    .sum > b { font-size: clamp(1.7rem, 4vw, 2.4rem); font-weight: 800; font-variant-numeric: tabular-nums; color: var(--c-text); line-height: 1.15; }
    .sum p { margin: 0; font-size: 0.8rem; color: var(--c-text-2); }
    .acts { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px; margin: 0; padding: 0; list-style: none; }
    .acts button { display: flex; flex-direction: column; gap: 3px; width: 100%; height: 100%; padding: 10px 12px; border-radius: 12px; text-align: left; cursor: pointer; font: inherit;
      color: var(--c-text); background: var(--c-surface); border: 1px solid var(--c-border); border-left: 4px solid var(--st); }
    .acts button:hover, .acts button.on { border-color: var(--st); }
    .acts .lbl { font-size: 0.74rem; font-weight: 600; color: var(--c-text-2); }
    .acts b { font-size: 1.05rem; font-weight: 700; font-variant-numeric: tabular-nums; }
    .acts small { font-size: 0.72rem; color: var(--c-text-2); }
    .num { font-variant-numeric: tabular-nums; }
    .cell-stack.end { align-items: flex-end; }
  `,
})
export class SlowMoversReport {
  protected readonly i18n = inject(LanguageService);
  private readonly api = inject(ReportsService);

  protected readonly data = signal<SlowMovers | null>(null);
  protected readonly error = signal('');
  protected readonly filter = signal<Filter>('STUCK');

  protected readonly filters = computed<SegmentOption<Filter>[]>(() => {
    const t = this.data()?.totals;
    const count = (a: SlowAction) => t?.actions.find((x) => x.action === a)?.products ?? 0;
    return [
      { value: 'STUCK', label: this.i18n.t('Stuck', 'Zilizokwama'), count: t?.stuckProducts ?? 0 },
      ...SLOW_ACTIONS.map((a) => ({ value: a.key as Filter, label: this.short(a.key), count: count(a.key) })),
      { value: 'ALL', label: this.i18n.t('All', 'Zote'), count: t?.products ?? 0 },
    ];
  });

  protected readonly visible = computed(() => {
    const f = this.filter();
    return (this.data()?.items ?? []).filter((i) => f === 'ALL' || (f === 'STUCK' ? i.stuck : i.action === f));
  });

  protected readonly note = computed(() => {
    const d = this.data();
    if (!d?.stockDate) return null;
    return `${this.i18n.t('stock count of', 'hesabu ya stoki ya')} ${this.day(d.stockDate)} · ${this.i18n.t('sales to', 'mauzo hadi')} ${this.day(d.asOf)}`;
  });

  /** The quantities are only as good as the count they come from — say so when it is old or not approved. */
  protected readonly stale = computed(() => {
    const d = this.data();
    const count = parseLocal(d?.stockDate ?? null);
    const asOf = parseLocal(d?.asOf ?? null);
    if (!d || !count || !asOf) return null;
    const age = Math.round((asOf.getTime() - count.getTime()) / 86_400_000);
    if (age > 1) {
      return this.i18n.t(
        `The last stock count is from ${this.day(d.stockDate)} (${age} days before the sales shown) — quantities may have changed since.`,
        `Hesabu ya mwisho ya stoki ni ya ${this.day(d.stockDate)} (siku ${age} kabla ya mauzo yanayoonyeshwa) — idadi inaweza kuwa imebadilika.`,
      );
    }
    if (d.stockStatus !== 'APPROVED') {
      return this.i18n.t(
        `The stock count of ${this.day(d.stockDate)} is not approved yet — quantities are as counted.`,
        `Hesabu ya stoki ya ${this.day(d.stockDate)} bado haijaidhinishwa — idadi ni kama ilivyohesabiwa.`,
      );
    }
    return null;
  });

  protected readonly rowId = (r: SlowMover) => r.productUid;
  protected readonly title = (r: SlowMover) => `${r.name} · #${r.productId}`;
  protected readonly byName = (r: SlowMover) => r.name.toLowerCase();
  protected readonly byQty = (r: SlowMover) => r.quantity;
  protected readonly byValue = (r: SlowMover) => r.value;
  /** Never sold sorts as the longest wait. */
  protected readonly bySince = (r: SlowMover) => r.daysSinceLastSale ?? Number.MAX_SAFE_INTEGER;
  protected readonly by30 = (r: SlowMover) => r.sold30;
  protected readonly by60 = (r: SlowMover) => r.sold60;
  protected readonly byCover = (r: SlowMover) => r.coverDays ?? Number.MAX_SAFE_INTEGER;
  protected readonly byAction = (r: SlowMover) => SLOW_ACTIONS.findIndex((a) => a.key === r.action);

  constructor() {
    this.load();
  }

  protected load(): void {
    this.error.set('');
    this.data.set(null);
    this.api
      .slowMovers()
      .then((d) => this.data.set(d))
      .catch((e) => this.error.set(ApiError.from(e).message));
  }

  protected label(a: SlowAction): string {
    const def = SLOW_ACTIONS.find((x) => x.key === a)!;
    return this.i18n.isSwahili() ? def.sw : def.en;
  }

  private short(a: SlowAction): string {
    switch (a) {
      case 'RETURN_OR_DISCOUNT': return this.i18n.t('Return', 'Rudisha');
      case 'DISCOUNT': return this.i18n.t('Cut price', 'Punguza bei');
      case 'STOP_ORDERING': return this.i18n.t('Stop ordering', 'Acha kuagiza');
      default: return this.i18n.t('OK', 'Sawa');
    }
  }

  protected color(a: SlowAction): string {
    return SLOW_ACTIONS.find((x) => x.key === a)!.color;
  }

  protected m(v: number): string {
    return Money.format(v, { decimals: 0 });
  }

  protected q(v: number): string {
    return new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(v);
  }

  protected round(v: number): number {
    return Math.round(v);
  }

  protected pct(part: number, whole: number): string {
    return whole ? `${((part / whole) * 100).toFixed(0)}%` : '—';
  }

  protected day(v: string | null): string {
    const d = parseLocal(v);
    return d ? new Intl.DateTimeFormat(this.i18n.isSwahili() ? 'sw-TZ' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(d) : '—';
  }

  private table(): { headers: string[]; rows: Cell[][] } {
    const t = (en: string, sw: string) => this.i18n.t(en, sw);
    return {
      headers: [
        t('Product', 'Bidhaa'), 'product_id', t('Category', 'Aina'), t('Qty', 'Idadi'), t('Unit cost', 'Bei ya kununua'),
        t('Value at cost', 'Thamani'), t('Last sale', 'Mauzo ya mwisho'), t('Days since last sale', 'Siku tangu mauzo ya mwisho'),
        t('Sold 30 days', 'Mauzo siku 30'), t('Sold 60 days', 'Mauzo siku 60'), t('Stock lasts (days)', 'Stoki inatosha (siku)'),
        t('Suggested action', 'Hatua inayopendekezwa'),
      ],
      rows: this.visible().map((r) => [
        r.name, r.productId, r.category, r.quantity, r.unitCost, Math.round(r.value), r.lastSaleDate ?? '', r.daysSinceLastSale ?? '',
        r.sold30, r.sold60, r.coverDays === null ? '' : Math.round(r.coverDays), this.label(r.action),
      ]),
    };
  }

  protected csv(): void {
    const tb = this.table();
    downloadCsv(`bidhaa_zisizotembea_${this.data()?.asOf ?? ''}`, tb.headers, tb.rows);
  }

  protected print(): void {
    const d = this.data();
    if (!d) return;
    const tb = this.table();
    const keep = [0, 1, 3, 5, 7, 8, 9, 11];
    printReport({
      title: this.i18n.t('Slow-moving stock', 'Bidhaa zisizotembea'),
      subtitle: this.note() ?? '',
      headers: keep.map((i) => tb.headers[i]),
      rows: tb.rows.map((row) => keep.map((i) => (i === 5 ? this.m(row[i] as number) : row[i]))),
      numeric: [2, 3, 4, 5, 6],
      summary: [
        [this.i18n.t('Cash stuck', 'Pesa iliyokwama'), this.m(d.totals.stuckValue)],
        [this.i18n.t('Stuck products', 'Bidhaa zilizokwama'), d.totals.stuckProducts],
        ...d.totals.actions.filter((a) => a.action !== 'OK').map((a): [string, string] => [this.label(a.action), this.m(a.value)]),
      ],
    });
  }
}
