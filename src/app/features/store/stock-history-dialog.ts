import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';

import { ApiError } from '@core/api/api.types';
import { LanguageService } from '@core/i18n/language.service';
import { Button, DialogShell, Icon, SegmentOption, SegmentedFilterBar, Skeleton } from '@shared/ui';
import { parseLocal } from '@shared/utils/date-utils';
import { MoneyPipe } from '@shared/utils/money';
import { Movement, MovementGroup, StockItem, movementMeta, packagesLabel } from './store.models';
import { StoreService } from './store.service';

export interface StockHistoryData {
  item: StockItem;
  canChange: boolean;
}

type Filter = 'ALL' | MovementGroup;

/**
 * One product's stock movements — port of Flutter
 * `EnhancedMovementHistoryDialog`: totals in / out, filter by kind, running stock.
 */
@Component({
  selector: 'app-stock-history-dialog',
  imports: [DialogShell, Button, Icon, Skeleton, SegmentedFilterBar, MoneyPipe, DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <lsms-dialog [title]="i18n.t('Stock history', 'Historia ya mzigo') + ' · ' + data.item.productName" icon="history">
      <section class="sum">
        <div class="big ok"><small>{{ i18n.t('In stock now', 'Mzigo uliopo') }}</small><b>{{ label(data.item.currentStock) }}</b></div>
        <div><small>{{ i18n.t('Came in', 'Umeingia') }}</small><b class="in">+{{ totals().in }}</b></div>
        <div><small>{{ i18n.t('Went out', 'Umetoka') }}</small><b class="out">−{{ totals().out }}</b></div>
        <div><small>{{ i18n.t('Stock value', 'Thamani') }}</small><b>{{ (data.item.averageCostPrice ?? 0) * data.item.currentStock | money: { decimals: 0 } }}</b></div>
      </section>

      <lsms-segmented-filter-bar [options]="options()" [(selected)]="filter" />

      @if (loading()) {
        <lsms-skeleton variant="list" [rows]="5" />
      } @else if (error()) {
        <p class="err"><lsms-icon name="error" [size]="18" />{{ error() }}</p>
      } @else if (!shown().length) {
        <p class="muted">{{ i18n.t('No movements recorded.', 'Hakuna mabadiliko yaliyorekodiwa.') }}</p>
      } @else {
        <div class="scroll">
          <table>
            <thead>
              <tr>
                <th>{{ i18n.t('Date', 'Tarehe') }}</th>
                <th>{{ i18n.t('Movement', 'Mabadiliko') }}</th>
                <th class="n">{{ i18n.t('Change', 'Kiasi') }}</th>
                <th class="n">{{ i18n.t('Stock after', 'Mzigo baadaye') }}</th>
                <th>{{ i18n.t('By', 'Na') }}</th>
              </tr>
            </thead>
            <tbody>
              @for (m of shown(); track m.uid) {
                @let t = type(m.movementType);
                <tr>
                  <td class="nowrap">{{ date(m.movementDate) | date: 'dd MMM yyyy, HH:mm' }}</td>
                  <td>
                    <span class="pill" [style.--st]="t.color"><lsms-icon [name]="t.icon" [size]="13" />{{ i18n.isSwahili() ? t.sw : t.en }}</span>
                    @if (m.reference) {
                      <small class="ref">{{ m.reference }}</small>
                    }
                  </td>
                  <td class="n" [class.credit]="m.stockChange > 0" [class.debit]="m.stockChange < 0">{{ m.stockChange > 0 ? '+' : '' }}{{ m.stockChange }}</td>
                  <td class="n strong">{{ m.stockAfter ?? '—' }}</td>
                  <td class="muted nowrap">{{ m.initiatedBy || '—' }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
        @if (shown().length < filtered().length) {
          <button lsmsButton="text" size="sm" icon="expand_more" class="more" (click)="limit.set(limit() + 50)">{{ i18n.t('Show more', 'Onyesha zaidi') }} ({{ shown().length }} / {{ filtered().length }})</button>
        }
      }

      <ng-container dialogActions>
        <button lsmsButton="secondary" (click)="ref.close()">{{ i18n.t('Close', 'Funga') }}</button>
        @if (data.canChange) {
          <button lsmsButton icon="tune" (click)="ref.close('change')">{{ i18n.t('Change stock', 'Badilisha mzigo') }}</button>
        }
      </ng-container>
    </lsms-dialog>
  `,
  styles: `
    @use 'detail-dialog';
    @include detail-dialog.base;
    .in { color: var(--c-success); }
    .out { color: var(--c-error); }
    lsms-segmented-filter-bar { display: block; margin-bottom: 10px; }
    .scroll { max-height: 380px; }
    .more { margin-top: 8px; }
  `,
})
export class StockHistoryDialog {
  protected readonly data = inject<StockHistoryData>(DIALOG_DATA);
  protected readonly ref = inject<DialogRef<'change'>>(DialogRef);
  protected readonly i18n = inject(LanguageService);
  private readonly api = inject(StoreService);

  protected readonly movements = signal<Movement[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly filter = signal<Filter>('ALL');
  protected readonly limit = signal(50);

  protected readonly totals = computed(() => {
    let inQ = 0;
    let outQ = 0;
    for (const m of this.movements()) {
      if (m.stockChange > 0) inQ += m.stockChange;
      else outQ -= m.stockChange;
    }
    return { in: inQ, out: outQ };
  });
  protected readonly filtered = computed(() => {
    const f = this.filter();
    return f === 'ALL' ? this.movements() : this.movements().filter((m) => movementMeta(m.movementType).group === f);
  });
  protected readonly shown = computed(() => this.filtered().slice(0, this.limit()));
  protected readonly options = computed<SegmentOption<Filter>[]>(() => {
    const list = this.movements();
    const n = (g: MovementGroup) => list.filter((m) => movementMeta(m.movementType).group === g).length;
    const t = (en: string, sw: string) => this.i18n.t(en, sw);
    return [
      { value: 'ALL', label: t('All', 'Yote'), count: list.length },
      { value: 'IN', label: t('In', 'Kuingia'), icon: 'south_west', count: n('IN') },
      { value: 'OUT', label: t('Out', 'Kutoka'), icon: 'north_east', count: n('OUT') },
      { value: 'ADJ', label: t('Adjustments', 'Marekebisho'), icon: 'tune', count: n('ADJ') },
    ];
  });

  constructor() {
    this.api
      .productMovements(this.data.item.uid)
      .then((m) => this.movements.set(m))
      .catch((e) => this.error.set(ApiError.from(e).message))
      .finally(() => this.loading.set(false));
  }

  protected type(t: string) {
    return movementMeta(t);
  }

  protected date(v: string | null): Date | null {
    return parseLocal(v);
  }

  protected label(pieces: number): string {
    return packagesLabel(pieces, this.data.item.piecesPerPackage, this.data.item.packageAbbreviation, this.i18n.t('pcs', 'vip'));
  }
}
