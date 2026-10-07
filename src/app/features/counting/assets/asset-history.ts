import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, output, signal } from '@angular/core';

import { ApiError } from '@core/api/api.types';
import { LanguageService } from '@core/i18n/language.service';
import { DataTable, DialogService, EmptyState, Icon, SegmentOption, SegmentedFilterBar, TableColumn } from '@shared/ui';
import { parseLocal } from '@shared/utils/date-utils';
import { CountingService } from '../counting.service';
import type { AssetSessionDialogData } from './asset-dialogs';
import { ASSET_SESSION_STATUS, AssetSession, AssetSessionStatus } from './asset.models';
import { AssetService } from './asset.service';

type Filter = 'ALL' | AssetSessionStatus;

/** Every asset verification; a row opens its detail (where the CEO decides differences). */
@Component({
  selector: 'app-asset-history',
  imports: [DataTable, TableColumn, SegmentedFilterBar, EmptyState, Icon, DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (error() && !rows().length) {
      <lsms-empty-state icon="error" iconColor="var(--c-error)" [title]="i18n.t('Could not load', 'Imeshindikana kupakia')" [message]="error()!" [secondaryActionLabel]="i18n.t('Retry', 'Jaribu tena')" (secondaryAction)="load()" />
    } @else if (!loading() && !rows().length) {
      <lsms-empty-state icon="history" [title]="i18n.t('No verification yet', 'Hakuna uhakiki bado')" [message]="i18n.t('Asset verifications will be listed here.', 'Uhakiki wa mali utaorodheshwa hapa.')" />
    } @else {
      @if (filters().length > 2) {
        <lsms-segmented-filter-bar [options]="filters()" [selected]="filter()" (selectedChange)="filter.set($event)" />
      }
      <div class="table-card">
        <lsms-data-table
          [title]="i18n.t('Asset verifications', 'Uhakiki wa mali')"
          [items]="shown()"
          [loading]="loading()"
          [pageSize]="15"
          [mobileTitle]="dateLabel"
          [mobileColumns]="['status', 'counted', 'diff', 'by']"
          [mobileCompactColumns]="['diff']"
          [emptyTitle]="i18n.t('Nothing with this status', 'Hakuna yenye hali hii')"
          emptyIcon="filter_alt_off"
          (rowClick)="open($event)"
        >
          <ng-template lsmsColumn="date" [label]="i18n.t('Date', 'Tarehe')" [sortBy]="dateKey" [locked]="true" let-row>
            <span class="cell-stack">
              <strong>{{ day(row.sessionDate) | date: 'EEE, dd MMM yyyy' }}</strong>
              <small>{{ i18n.t('Started', 'Ilianza') }} {{ day(row.startedAt) | date: 'HH:mm' }}@if (row.completedAt) { · {{ i18n.t('done', 'ilimalizika') }} {{ day(row.completedAt) | date: 'HH:mm' }} }</small>
            </span>
          </ng-template>
          <ng-template lsmsColumn="status" [label]="i18n.t('Status', 'Hali')" let-row>
            @let st = status(row.status);
            <span class="pill" [style.--pc]="st.color"><lsms-icon [name]="st.icon" [size]="13" />{{ i18n.isSwahili() ? st.sw : st.en }}</span>
          </ng-template>
          <ng-template lsmsColumn="counted" [label]="i18n.t('Counted', 'Zimehesabiwa')" align="end" let-row>
            <span class="num">{{ row.itemsCounted }}/{{ row.totalItems }}</span>
          </ng-template>
          <ng-template lsmsColumn="diff" [label]="i18n.t('With difference', 'Zenye tofauti')" align="end" let-row>
            <span class="num strong" [class.neg]="row.itemsWithVariance">{{ row.itemsWithVariance ?? '—' }}</span>
          </ng-template>
          <ng-template lsmsColumn="by" [label]="i18n.t('Verified by', 'Aliyehakiki')" let-row>
            <span class="cell-stack">
              <span>{{ name(row.startedByUid) }}</span>
              @if (row.approvedByUid) { <small>{{ i18n.t('Decided by', 'Aliyeamua') }} {{ name(row.approvedByUid) }}</small> }
              @if (row.status === 'CANCELLED' && row.cancelledReason) { <small class="neg">{{ row.cancelledReason }}</small> }
            </span>
          </ng-template>
        </lsms-data-table>
      </div>
    }
  `,
  styles: `
    @use 'list-page';
    @include list-page.base;
    :host { display: flex; flex-direction: column; gap: 12px; }
    .pill { display: inline-flex; align-items: center; gap: 4px; padding: 2px 9px; border-radius: 100px; font-size: 0.7rem; font-weight: 600; white-space: nowrap; color: var(--pc); background: color-mix(in srgb, var(--pc) 12%, transparent); }
    .neg { color: var(--c-error); }
  `,
})
export class AssetHistory {
  protected readonly i18n = inject(LanguageService);
  private readonly api = inject(AssetService);
  private readonly counting = inject(CountingService);
  private readonly dialogs = inject(DialogService);

  /** A count was decided / cancelled. */
  readonly changed = output<void>();

  protected readonly rows = signal<AssetSession[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly filter = signal<Filter>('ALL');

  protected readonly shown = computed(() => (this.filter() === 'ALL' ? this.rows() : this.rows().filter((r) => r.status === this.filter())));
  protected readonly filters = computed<SegmentOption<Filter>[]>(() => {
    const n = (s: AssetSessionStatus) => this.rows().filter((r) => r.status === s).length;
    const all: Filter[] = ['ALL', 'PENDING_APPROVAL', 'MATCHED', 'APPROVED', 'IN_PROGRESS', 'CANCELLED'];
    return all
      .filter((f) => f === 'ALL' || n(f) > 0)
      .map((f) => ({
        value: f,
        label: f === 'ALL' ? this.i18n.t('All', 'Zote') : this.i18n.isSwahili() ? ASSET_SESSION_STATUS[f].sw : ASSET_SESSION_STATUS[f].en,
        count: f === 'ALL' ? this.rows().length : n(f),
      }));
  });

  protected readonly dateLabel = (r: AssetSession) => r.sessionDate ?? '—';
  protected readonly dateKey = (r: AssetSession) => r.startedAt ?? r.sessionDate;

  constructor() {
    void this.load();
    void this.counting.staff.load().catch(() => undefined);
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      this.rows.set(await this.api.list());
    } catch (e) {
      this.error.set(ApiError.from(e).message);
    } finally {
      this.loading.set(false);
    }
  }

  protected async open(row: AssetSession): Promise<void> {
    const { AssetSessionDialog } = await import('./asset-dialogs');
    const result = await this.dialogs.openAsync<boolean, AssetSessionDialogData>(AssetSessionDialog, { size: 'lg', data: { uid: row.uid } });
    if (result) this.changed.emit();
    void this.load();
  }

  protected status(s: AssetSessionStatus) {
    return ASSET_SESSION_STATUS[s] ?? ASSET_SESSION_STATUS.IN_PROGRESS;
  }

  protected name(uid: string | null): string {
    return this.counting.staffName(uid) ?? '—';
  }

  protected day(v: string | null): Date | null {
    return parseLocal(v);
  }
}
