import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';

import { ApiError } from '@core/api/api.types';
import { LanguageService } from '@core/i18n/language.service';
import { Button, DataTable, EmptyState, FilterPanel, TableColumn } from '@shared/ui';
import { parseLocal } from '@shared/utils/date-utils';
import { MoneyPipe } from '@shared/utils/money';
import { Settlement } from './customers.models';
import { CustomersService } from './customers.service';

const PAGE = 50;

/**
 * Settled debts ("Wamelipa") — port of Flutter `CustomerArList(unpaid: false)`:
 * server-paged, newest first, server-side search, "load more".
 */
@Component({
  selector: 'app-settlements-panel',
  imports: [FilterPanel, DataTable, TableColumn, EmptyState, Button, MoneyPipe, DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <lsms-filter-panel [searchPlaceholder]="i18n.t('Search customer, phone or receipt…', 'Tafuta mteja, simu au risiti…')" (search)="onSearch($event)" />
    @if (error()) {
      <lsms-empty-state icon="error" iconColor="var(--c-error)" [title]="i18n.t('Could not load settlements', 'Imeshindikana kupakia malipo')" [message]="error()!" [secondaryActionLabel]="i18n.t('Retry', 'Jaribu tena')" (secondaryAction)="reload()" />
    } @else {
      <lsms-data-table
        [title]="i18n.t('Settled debts', 'Madeni yaliyolipwa') + ' · ' + total()"
        [items]="items()"
        [rowId]="rowId"
        [loading]="loading() && !items().length"
        [showPagination]="false"
        [mobileTitle]="nameOf"
        [mobileColumns]="['collected', 'settled', 'receipt']"
        [mobileCompactColumns]="['collected']"
        [emptyTitle]="i18n.t('No settled debts found', 'Hakuna madeni yaliyolipwa')"
        emptyIcon="task_alt"
      >
        <ng-template lsmsColumn="customer" [label]="i18n.t('Customer', 'Mteja')" [locked]="true" let-row>
          <span class="who"><strong>{{ row.customerName }}</strong><small>{{ row.customerPhone || '' }}</small></span>
        </ng-template>
        <ng-template lsmsColumn="receipt" [label]="i18n.t('Receipt', 'Risiti')" let-row>
          <span class="muted nowrap">{{ row.receiptNumber || '—' }}</span>
        </ng-template>
        <ng-template lsmsColumn="sold" [label]="i18n.t('Sold', 'Aliuziwa')" let-row>
          <span class="nowrap">{{ date(row.saleDate) | date: 'dd MMM yyyy' }}</span>
        </ng-template>
        <ng-template lsmsColumn="settled" [label]="i18n.t('Settled', 'Alilipa')" let-row>
          <span class="nowrap">{{ date(row.settledDate) | date: 'dd MMM yyyy' }}</span>
          @if (row.daysToSettle !== null) {
            <small class="days" [class.slow]="row.daysToSettle > 30">{{ row.daysToSettle }} {{ i18n.t('days', 'siku') }}</small>
          }
        </ng-template>
        <ng-template lsmsColumn="total" [label]="i18n.t('Sale total', 'Jumla')" align="end" let-row>
          <span class="num">{{ row.totalAmount | money: { symbol: false } }}</span>
        </ng-template>
        <ng-template lsmsColumn="collected" [label]="i18n.t('Collected', 'Kilicholipwa')" align="end" let-row>
          <span class="num ok">{{ row.amountCollected | money: { symbol: false } }}</span>
          @if (row.waivedAmount > 0) {
            <small class="waived">{{ i18n.t('waived', 'kimesamehewa') }} {{ row.waivedAmount | money: { symbol: false } }}</small>
          }
        </ng-template>
        <ng-template lsmsColumn="by" [label]="i18n.t('Received by', 'Alipokea')" let-row>
          <span class="muted">{{ row.receivedByName || '—' }}</span>
          @if (row.paymentMethod) {
            <small class="muted"> · {{ row.paymentMethod }}</small>
          }
        </ng-template>
      </lsms-data-table>
      @if (page() < pages()) {
        <div class="more">
          <button lsmsButton="secondary" size="sm" icon="expand_more" [loading]="loading()" (click)="loadMore()">
            {{ i18n.t('Load more', 'Pakia zaidi') }} ({{ items().length }} / {{ total() }})
          </button>
        </div>
      }
    }
  `,
  styles: `
    :host { display: block; }
    lsms-data-table { border: 0; border-top: 1px solid var(--c-border); border-radius: 0; max-height: 64vh; }
    .who { display: flex; flex-direction: column; }
    .muted { color: var(--c-text-2); }
    .nowrap { white-space: nowrap; }
    .num { font-weight: 600; }
    .ok { color: var(--c-success); }
    .days { display: block; font-size: 0.7rem; color: var(--c-text-2); &.slow { color: var(--c-warning); font-weight: 500; } }
    .waived { display: block; font-size: 0.7rem; color: var(--c-warning); }
    .more { display: flex; justify-content: center; padding: 12px; border-top: 1px solid var(--c-border); }
  `,
})
export class SettlementsPanel {
  protected readonly i18n = inject(LanguageService);
  private readonly api = inject(CustomersService);

  protected readonly items = signal<Settlement[]>([]);
  protected readonly page = signal(0);
  protected readonly pages = signal(1);
  protected readonly total = signal(0);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  private search = '';
  private seq = 0;

  protected readonly rowId = (s: Settlement) => `${s.saleUid}-${s.settledDate}`;
  protected readonly nameOf = (s: Settlement) => s.customerName;

  constructor() {
    void this.reload();
  }

  protected onSearch(q: string): void {
    this.search = q;
    void this.reload();
  }

  protected async reload(): Promise<void> {
    this.items.set([]);
    this.page.set(0);
    await this.fetch(1);
  }

  protected async loadMore(): Promise<void> {
    await this.fetch(this.page() + 1);
  }

  private async fetch(page: number): Promise<void> {
    const mine = ++this.seq;
    this.loading.set(true);
    this.error.set(null);
    try {
      const res = await this.api.settlements(page, PAGE, this.search);
      if (mine !== this.seq) return; // a newer search superseded this one
      this.items.update((l) => (page === 1 ? res.items : [...l, ...res.items]));
      this.page.set(res.page);
      this.pages.set(res.pages);
      this.total.set(res.total);
    } catch (e) {
      if (mine === this.seq) this.error.set(ApiError.from(e).message);
    } finally {
      if (mine === this.seq) this.loading.set(false);
    }
  }

  protected date(v: string | null): Date | null {
    return parseLocal(v);
  }
}
