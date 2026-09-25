import { ChangeDetectionStrategy, Component, computed, inject, output, signal } from '@angular/core';

import { ApiError } from '@core/api/api.types';
import { LanguageService } from '@core/i18n/language.service';
import { AgingBar, AgingBucket, DataTable, EmptyState, SegmentOption, SegmentedFilterBar, Skeleton, TableColumn } from '@shared/ui';
import { MoneyPipe } from '@shared/utils/money';
import { InsightRow, MOVEMENT_CLASS, RECOMMENDATIONS } from './store.models';
import { StoreService } from './store.service';

type ClassFilter = 'ALL' | 'DEAD' | 'SLOW' | 'NORMAL' | 'FAST';

/**
 * Inventory insights — port of Flutter `InventoryAnalyticsPage`: how fast each
 * product sells, how long stock has sat, dead-stock value and suggested
 * actions. Loaded (and cached) only when this view is opened.
 */
@Component({
  selector: 'app-insights-panel',
  imports: [AgingBar, DataTable, TableColumn, EmptyState, Skeleton, SegmentedFilterBar, MoneyPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (error()) {
      <lsms-empty-state icon="error" iconColor="var(--c-error)" [title]="i18n.t('Could not load insights', 'Imeshindikana kupakia uchambuzi')" [message]="error()!" [secondaryActionLabel]="i18n.t('Retry', 'Jaribu tena')" (secondaryAction)="load(true)" />
    } @else if (!data()) {
      <div class="pad"><lsms-skeleton variant="list" [rows]="5" /></div>
    } @else {
      @let d = data()!;
      <section class="top">
        <div class="tile dead">
          <small>{{ i18n.t('Money tied up in stock that is not selling', 'Pesa iliyokwama kwenye mzigo usiouzika') }}</small>
          <b>{{ d.totalDeadStockValue | money }}</b>
          <span>{{ d.deadStockCount }} {{ i18n.t('products', 'bidhaa') }} · {{ pct() }}% {{ i18n.t('of stock value', 'ya thamani ya mzigo') }}</span>
        </div>
        <div class="tile">
          <small>{{ i18n.t('Products by time since last sale', 'Bidhaa kwa muda tangu mauzo ya mwisho') }}</small>
          <lsms-aging-bar [buckets]="aging()" [unit]="i18n.t('products', 'bidhaa')" />
        </div>
      </section>

      <lsms-segmented-filter-bar class="seg" [options]="classOptions()" [(selected)]="cls" />
      <lsms-data-table
        [title]="i18n.t('Products needing action', 'Bidhaa zinazohitaji hatua')"
        [items]="rows()"
        [rowId]="rowId"
        defaultSortColumn="value"
        defaultSortDirection="desc"
        [mobileTitle]="nameOf"
        [mobileColumns]="['class', 'value', 'action']"
        emptyIcon="insights"
        (rowClick)="open.emit($event.uid)"
      >
        <ng-template lsmsColumn="name" [label]="i18n.t('Product', 'Bidhaa')" [sortBy]="nameOf" [locked]="true" let-row>
          <span class="prod"><strong>{{ row.productName }}</strong><small>{{ row.categoryName || '' }}</small></span>
        </ng-template>
        <ng-template lsmsColumn="class" [label]="i18n.t('Selling', 'Inavyouzika')" let-row>
          @let c = cmeta(row.movementClass);
          <span class="pill" [style.--st]="c.color">{{ i18n.isSwahili() ? c.sw : c.en }}</span>
        </ng-template>
        <ng-template lsmsColumn="idle" [label]="i18n.t('Last sold', 'Iliuzwa mwisho')" [sortBy]="idleOf" let-row>
          <span class="muted">{{ row.daysSinceLastOutbound < 0 ? i18n.t('Never', 'Haijawahi') : row.daysSinceLastOutbound + ' ' + i18n.t('days ago', 'siku zilizopita') }}</span>
        </ng-template>
        <ng-template lsmsColumn="sold" [label]="i18n.t('Sold 90 days', 'Iliuzwa siku 90')" [sortBy]="soldOf" align="end" let-row>
          <span class="num">{{ row.unitsSoldLast90Days }}</span>
        </ng-template>
        <ng-template lsmsColumn="stock" [label]="i18n.t('In stock', 'Iliyopo')" align="end" let-row>
          <span class="num">{{ row.currentStock }}</span>
        </ng-template>
        <ng-template lsmsColumn="value" [label]="i18n.t('Stock value', 'Thamani')" [sortBy]="valueOf" align="end" let-row>
          <span class="num strong">{{ row.currentStockValue | money: { symbol: false } }}</span>
        </ng-template>
        <ng-template lsmsColumn="action" [label]="i18n.t('Suggested action', 'Hatua inayoshauriwa')" let-row>
          <span class="recs">
            @for (r of row.recommendations; track r) {
              <span class="rec" [class.high]="row.recommendationPriority === 'HIGH'">{{ rec(r) }}</span>
            }
          </span>
        </ng-template>
      </lsms-data-table>
    }
  `,
  styles: `
    :host { display: block; }
    .pad { padding: 16px; }
    .top { display: grid; grid-template-columns: 1fr 1.6fr; gap: 12px; padding: 16px; border-top: 1px solid var(--c-border); }
    @media (max-width: 900px) { .top { grid-template-columns: 1fr; } }
    .tile { display: flex; flex-direction: column; gap: 8px; padding: 14px 16px; border-radius: 14px; background: var(--c-bg); border: 1px solid var(--c-border); }
    .tile small { font-size: 0.74rem; color: var(--c-text-2); }
    .tile b { font-size: 1.5rem; font-weight: 800; font-variant-numeric: tabular-nums; }
    .tile span { font-size: 0.78rem; color: var(--c-text-2); }
    .tile.dead { border-color: color-mix(in srgb, var(--c-error) 30%, transparent); background: color-mix(in srgb, var(--c-error) 5%, var(--c-bg)); b { color: var(--c-error); } }
    .seg { display: block; padding: 0 16px 12px; }
    lsms-data-table { border: 0; border-top: 1px solid var(--c-border); border-radius: 0; max-height: 60vh; }
    .prod { display: flex; flex-direction: column; }
    .pill { display: inline-flex; padding: 2px 8px; border-radius: 100px; font-size: 0.7rem; font-weight: 600; color: var(--st); background: color-mix(in srgb, var(--st) 12%, transparent); }
    .num { font-variant-numeric: tabular-nums; }
    .muted { color: var(--c-text-2); }
    .recs { display: flex; flex-wrap: wrap; gap: 4px; }
    .rec { padding: 1px 7px; border-radius: 6px; font-size: 0.7rem; font-weight: 600; background: var(--c-bg); border: 1px solid var(--c-border); &.high { color: var(--c-error); border-color: color-mix(in srgb, var(--c-error) 35%, transparent); } }
  `,
})
export class InsightsPanel {
  protected readonly i18n = inject(LanguageService);
  private readonly api = inject(StoreService);
  /** Emits a productUid when a row is clicked (opens its stock history). */
  readonly open = output<string>();

  protected readonly data = this.api.insights.value;
  protected readonly error = signal<string | null>(null);
  protected readonly cls = signal<ClassFilter>('ALL');

  protected readonly rowId = (r: InsightRow) => r.uid;
  protected readonly nameOf = (r: InsightRow) => r.productName;
  protected readonly idleOf = (r: InsightRow) => (r.daysSinceLastOutbound < 0 ? 99999 : r.daysSinceLastOutbound);
  protected readonly soldOf = (r: InsightRow) => r.unitsSoldLast90Days;
  protected readonly valueOf = (r: InsightRow) => r.currentStockValue;

  protected readonly pct = computed(() => {
    const d = this.data();
    return d && d.totalInventoryValue ? Math.round((d.totalDeadStockValue / d.totalInventoryValue) * 100) : 0;
  });
  protected readonly aging = computed<AgingBucket[]>(() => {
    const a = this.data()?.aging;
    const t = (en: string, sw: string) => this.i18n.t(en, sw);
    return [
      { label: t('0–30 days', 'Siku 0–30'), value: a?.d0to30 ?? 0, color: 'var(--c-success)' },
      { label: t('31–60 days', 'Siku 31–60'), value: a?.d31to60 ?? 0, color: 'var(--c-info)' },
      { label: t('61–90 days', 'Siku 61–90'), value: a?.d61to90 ?? 0, color: 'var(--c-warning)' },
      { label: t('90+ days', 'Siku 90+'), value: a?.d90plus ?? 0, color: 'var(--c-error)' },
    ];
  });
  protected readonly classOptions = computed<SegmentOption<ClassFilter>[]>(() => {
    const list = this.data()?.products ?? [];
    const n = (c: string) => list.filter((p) => p.movementClass === c).length;
    const lang = this.i18n.lang();
    const opts: SegmentOption<ClassFilter>[] = [{ value: 'ALL', label: this.i18n.t('All', 'Zote'), count: list.length }];
    for (const c of ['DEAD', 'SLOW', 'NORMAL', 'FAST'] as const) {
      if (n(c)) opts.push({ value: c, label: MOVEMENT_CLASS[c][lang], count: n(c) });
    }
    return opts;
  });
  protected readonly rows = computed(() => {
    const c = this.cls();
    const list = this.data()?.products ?? [];
    return c === 'ALL' ? list : list.filter((p) => p.movementClass === c);
  });

  constructor() {
    void this.load(false);
  }

  protected async load(force: boolean): Promise<void> {
    this.error.set(null);
    try {
      await this.api.insights.load(force);
    } catch (e) {
      this.error.set(ApiError.from(e).message);
    }
  }

  protected cmeta(c: string) {
    return MOVEMENT_CLASS[c] ?? { en: c, sw: c, color: 'var(--c-text-2)' };
  }

  protected rec(r: string): string {
    const m = RECOMMENDATIONS[r];
    return m ? m[this.i18n.lang()] : r.replaceAll('_', ' ').toLowerCase();
  }
}
