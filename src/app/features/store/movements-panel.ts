import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';

import { ApiError } from '@core/api/api.types';
import { LanguageService } from '@core/i18n/language.service';
import { Button, DataTable, EmptyState, FilterPanel, Icon, SegmentOption, SegmentedFilterBar, TableColumn } from '@shared/ui';
import { parseLocal } from '@shared/utils/date-utils';
import { MoneyPipe } from '@shared/utils/money';
import { Movement, MovementGroup, movementMeta } from './store.models';
import { StoreService } from './store.service';

const PAGE = 50;
type Filter = 'ALL' | MovementGroup;

/**
 * Stock movements across all products, newest first — port of Flutter
 * StoreDashboard's All / In / Out / Adjustments tabs. The backend's filtered
 * search endpoint is broken (always returns the latest 100), so pages are
 * loaded unfiltered and the kind / text filters apply to what is loaded.
 */
@Component({
  selector: 'app-movements-panel',
  imports: [FilterPanel, SegmentedFilterBar, DataTable, TableColumn, EmptyState, Button, Icon, MoneyPipe, DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <lsms-filter-panel [searchPlaceholder]="i18n.t('Search product, reference or person…', 'Tafuta bidhaa, kumbukumbu au mtu…')" (search)="search.set($event)">
      <lsms-segmented-filter-bar filterSegments [options]="options()" [(selected)]="filter" />
    </lsms-filter-panel>
    @if (error()) {
      <lsms-empty-state icon="error" iconColor="var(--c-error)" [title]="i18n.t('Could not load movements', 'Imeshindikana kupakia mabadiliko')" [message]="error()!" [secondaryActionLabel]="i18n.t('Retry', 'Jaribu tena')" (secondaryAction)="reload()" />
    } @else {
      <lsms-data-table
        [title]="i18n.t('Latest movements', 'Mabadiliko ya karibuni')"
        [items]="rows()"
        [rowId]="rowId"
        [loading]="loading() && !items().length"
        [showPagination]="false"
        [mobileTitle]="nameOf"
        [mobileColumns]="['change', 'type', 'date', 'by']"
        [mobileCompactColumns]="['change']"
        [emptyTitle]="i18n.t('No movements match', 'Hakuna mabadiliko yanayolingana')"
        emptyIcon="swap_vert"
      >
        <ng-template lsmsColumn="date" [label]="i18n.t('Date', 'Tarehe')" let-row>
          <span class="nowrap">{{ date(row.movementDate) | date: 'dd MMM, HH:mm' }}</span>
        </ng-template>
        <ng-template lsmsColumn="product" [label]="i18n.t('Product', 'Bidhaa')" [locked]="true" let-row>
          <span class="prod"><strong>{{ row.productName }}</strong><small>{{ row.categoryName || '' }}</small></span>
        </ng-template>
        <ng-template lsmsColumn="type" [label]="i18n.t('Movement', 'Aina')" let-row>
          @let t = type(row.movementType);
          <span class="pill" [style.--st]="t.color"><lsms-icon [name]="t.icon" [size]="13" />{{ i18n.isSwahili() ? t.sw : t.en }}</span>
        </ng-template>
        <ng-template lsmsColumn="change" [label]="i18n.t('Change', 'Kiasi')" align="end" let-row>
          <span class="chg" [class.in]="row.stockChange > 0" [class.out]="row.stockChange < 0">{{ row.stockChange > 0 ? '+' : '' }}{{ row.stockChange }}</span>
        </ng-template>
        <ng-template lsmsColumn="stock" [label]="i18n.t('Stock', 'Mzigo')" align="end" let-row>
          <span class="muted nowrap">{{ row.stockBefore ?? '?' }} → <b>{{ row.stockAfter ?? '?' }}</b></span>
        </ng-template>
        <ng-template lsmsColumn="value" [label]="i18n.t('Value', 'Thamani')" align="end" let-row>
          <span class="num">{{ row.totalValue ? (row.totalValue | money: { symbol: false }) : '—' }}</span>
        </ng-template>
        <ng-template lsmsColumn="by" [label]="i18n.t('By', 'Na')" let-row>
          <span class="muted">{{ row.initiatedBy || '—' }}</span>
        </ng-template>
        <ng-template lsmsColumn="ref" [label]="i18n.t('Reference', 'Kumbukumbu')" [hidden]="true" let-row>
          <span class="muted small">{{ row.reference || '—' }}</span>
        </ng-template>
      </lsms-data-table>
      <div class="more">
        <span class="hint"><lsms-icon name="info" [size]="14" />{{ i18n.t('Filters apply to the ' + items().length + ' most recent of ' + total() + ' movements.', 'Vichujio vinatumika kwa mabadiliko ' + items().length + ' ya karibuni kati ya ' + total() + '.') }}</span>
        @if (page() + 1 < pages()) {
          <button lsmsButton="secondary" size="sm" icon="expand_more" [loading]="loading()" (click)="loadMore()">{{ i18n.t('Load older', 'Pakia za zamani') }}</button>
        }
      </div>
    }
  `,
  styles: `
    :host { display: block; }
    lsms-data-table { border: 0; border-top: 1px solid var(--c-border); border-radius: 0; max-height: 64vh; }
    .prod { display: flex; flex-direction: column; min-width: 0; }
    .pill { display: inline-flex; align-items: center; gap: 4px; padding: 2px 8px; border-radius: 100px; font-size: 0.7rem; font-weight: 600; white-space: nowrap; color: var(--st); background: color-mix(in srgb, var(--st) 11%, transparent); }
    .chg { font-weight: 600; font-variant-numeric: tabular-nums; &.in { color: var(--c-success); } &.out { color: var(--c-error); } }
    .num { font-variant-numeric: tabular-nums; }
    .muted { color: var(--c-text-2); }
    .small { font-size: 0.72rem; }
    .nowrap { white-space: nowrap; }
    .more { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px; padding: 10px 16px; border-top: 1px solid var(--c-border); }
    .hint { display: inline-flex; align-items: center; gap: 6px; font-size: 0.76rem; color: var(--c-text-2); }
  `,
})
export class MovementsPanel {
  protected readonly i18n = inject(LanguageService);
  private readonly api = inject(StoreService);

  protected readonly items = signal<Movement[]>([]);
  protected readonly page = signal(-1);
  protected readonly pages = signal(1);
  protected readonly total = signal(0);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly filter = signal<Filter>('ALL');
  protected readonly search = signal('');

  protected readonly rowId = (m: Movement) => m.uid;
  protected readonly nameOf = (m: Movement) => m.productName;

  protected readonly options = computed<SegmentOption<Filter>[]>(() => {
    const list = this.items();
    const n = (g: MovementGroup) => list.filter((m) => movementMeta(m.movementType).group === g).length;
    const t = (en: string, sw: string) => this.i18n.t(en, sw);
    return [
      { value: 'ALL', label: t('All', 'Yote'), count: list.length },
      { value: 'IN', label: t('Stock in', 'Kuingia'), icon: 'south_west', count: n('IN') },
      { value: 'OUT', label: t('Stock out', 'Kutoka'), icon: 'north_east', count: n('OUT') },
      { value: 'ADJ', label: t('Adjustments', 'Marekebisho'), icon: 'tune', count: n('ADJ') },
    ];
  });

  protected readonly rows = computed(() => {
    const f = this.filter();
    const q = this.search().trim().toLowerCase();
    return this.items().filter((m) => {
      if (f !== 'ALL' && movementMeta(m.movementType).group !== f) return false;
      if (!q) return true;
      return [m.productName, m.reference ?? '', m.initiatedBy ?? '', m.notes ?? ''].some((x) => x.toLowerCase().includes(q));
    });
  });

  constructor() {
    void this.reload();
  }

  protected async reload(): Promise<void> {
    this.items.set([]);
    this.page.set(-1);
    await this.loadMore();
  }

  protected async loadMore(): Promise<void> {
    const next = this.page() + 1;
    this.loading.set(true);
    this.error.set(null);
    try {
      const res = await this.api.movements(next, PAGE);
      this.items.update((l) => [...l, ...res.items]);
      this.page.set(next);
      this.pages.set(res.pages);
      this.total.set(res.total);
    } catch (e) {
      this.error.set(ApiError.from(e).message);
    } finally {
      this.loading.set(false);
    }
  }

  protected type(t: string) {
    return movementMeta(t);
  }

  protected date(v: string | null): Date | null {
    return parseLocal(v);
  }
}
