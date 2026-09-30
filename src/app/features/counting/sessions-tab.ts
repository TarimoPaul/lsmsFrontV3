import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, input, output, signal } from '@angular/core';

import { ApiError } from '@core/api/api.types';
import { LanguageService } from '@core/i18n/language.service';
import { DataTable, DialogService, EmptyState, Icon, SegmentOption, SegmentedFilterBar, TableColumn } from '@shared/ui';
import { parseLocal } from '@shared/utils/date-utils';
import { MoneyPipe } from '@shared/utils/money';
import { CountSession, SESSION_STATUS, SessionStatus } from './counting.models';
import { CountingService } from './counting.service';
import type { SessionDialogData } from './session-dialog';

type Filter = 'ALL' | SessionStatus;

/**
 * Approval queue (`mode = 'queue'`, PENDING_APPROVAL only) and History (every
 * session) — port of Flutter `CountingApprovalListScreen` +
 * `CountingHistoryScreen`. A row opens the session detail; only the queue
 * opens it with the decision controls.
 */
@Component({
  selector: 'app-sessions-tab',
  imports: [DataTable, TableColumn, SegmentedFilterBar, EmptyState, Icon, DatePipe, MoneyPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (mode() === 'history' && rows().length) {
      <lsms-segmented-filter-bar [options]="filters()" [selected]="filter()" (selectedChange)="filter.set($event)" />
    }
    @if (error() && !rows().length) {
      <lsms-empty-state icon="error" iconColor="var(--c-error)" [title]="i18n.t('Could not load', 'Imeshindikana kupakia')" [message]="error()!" [secondaryActionLabel]="i18n.t('Retry', 'Jaribu tena')" (secondaryAction)="load()" />
    } @else if (!loading() && !rows().length) {
      @if (mode() === 'queue') {
        <lsms-empty-state icon="task_alt" iconColor="var(--c-success)" [title]="i18n.t('Nothing waiting', 'Hakuna kinachosubiri')" [message]="i18n.t('No stock count is waiting for approval right now.', 'Hakuna zoezi la kuhesabu linalosubiri uthibitisho kwa sasa.')" />
      } @else {
        <lsms-empty-state icon="history" [title]="i18n.t('No history', 'Hakuna historia')" [message]="i18n.t('No stock count has been done yet.', 'Hakuna zoezi la kuhesabu lililowahi kufanyika.')" />
      }
    } @else {
      <div class="table-card">
        <lsms-data-table
          [title]="mode() === 'queue' ? i18n.t('Awaiting approval', 'Yanasubiri uthibitisho') : i18n.t('Stock counts', 'Mazoezi ya kuhesabu')"
          [items]="shown()"
          [loading]="loading()"
          [pageSize]="15"
          [mobileTitle]="dateLabel"
          [mobileColumns]="['status', 'counted', 'variance', 'by']"
          [mobileCompactColumns]="['variance']"
          [emptyTitle]="i18n.t('No counts with this status', 'Hakuna mazoezi yenye hali hii')"
          emptyIcon="filter_alt_off"
          (rowClick)="open($event)"
        >
          <ng-template lsmsColumn="date" [label]="i18n.t('Count date', 'Tarehe')" [sortBy]="dateKey" [locked]="true" let-row>
            <span class="cell-stack">
              <strong>{{ day(row.sessionDate) | date: 'EEE, dd MMM yyyy' }}</strong>
              <small>{{ i18n.t('Started', 'Ilianza') }} {{ day(row.startedAt) | date: 'HH:mm' }}@if (row.completedAt) { · {{ i18n.t('done', 'ilimalizika') }} {{ day(row.completedAt) | date: 'HH:mm' }} }</small>
            </span>
          </ng-template>
          <ng-template lsmsColumn="status" [label]="i18n.t('Status', 'Hali')" [sortBy]="statusKey" let-row>
            @let st = status(row.status);
            <span class="pills">
              <span class="pill" [style.--pc]="st.color"><lsms-icon [name]="st.icon" [size]="13" />{{ i18n.isSwahili() ? st.sw : st.en }}</span>
              <span class="pill mode" [class.sighted]="row.countMode === 'SIGHTED'"><lsms-icon [name]="row.countMode === 'SIGHTED' ? 'visibility' : 'visibility_off'" [size]="13" />{{ row.countMode === 'SIGHTED' ? 'SIGHTED' : 'BLIND' }}</span>
            </span>
          </ng-template>
          <ng-template lsmsColumn="counted" [label]="i18n.t('Counted', 'Zimehesabiwa')" align="end" [sortBy]="countedKey" let-row>
            <span class="num">{{ row.itemsCounted }}/{{ row.totalItems }}</span>
          </ng-template>
          <ng-template lsmsColumn="items" [label]="i18n.t('Products with difference', 'Bidhaa zenye tofauti')" align="end" [sortBy]="itemsKey" let-row>
            <span class="num">{{ row.itemsWithVariance ?? '—' }}</span>
          </ng-template>
          <ng-template lsmsColumn="variance" [label]="i18n.t('Difference value', 'Thamani ya tofauti')" align="end" [sortBy]="valueKey" let-row>
            @if (row.totalVarianceValue !== null) {
              <span class="num strong" [class.neg]="row.totalVarianceValue < 0" [class.pos]="row.totalVarianceValue > 0">{{ row.totalVarianceValue > 0 ? '+' : '' }}{{ row.totalVarianceValue | money: { decimals: 0 } }}</span>
            } @else {
              <span class="muted">—</span>
            }
          </ng-template>
          <ng-template lsmsColumn="by" [label]="i18n.t('Counted by', 'Aliyehesabu')" let-row>
            <span class="cell-stack">
              <span>{{ name(row.startedByUid) }}</span>
              @if (row.status === 'APPROVED' && row.approvedByUid) {
                <small>{{ i18n.t('Approved by', 'Amethibitisha') }} {{ name(row.approvedByUid) }}</small>
              } @else if (row.status === 'FORCE_CLOSED' && row.forceClosedReason) {
                <small class="err" [title]="row.forceClosedReason">{{ row.forceClosedReason }}</small>
              }
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
    .pills { display: inline-flex; flex-wrap: wrap; gap: 6px; }
    .pill { display: inline-flex; align-items: center; gap: 4px; padding: 2px 9px; border-radius: 100px; font-size: 0.7rem; font-weight: 600; white-space: nowrap; color: var(--pc); background: color-mix(in srgb, var(--pc) 12%, transparent); }
    .pill.mode { --pc: var(--c-success); }
    .pill.mode.sighted { --pc: var(--c-warning); }
    .neg { color: var(--c-error); }
    .pos { color: var(--c-success); }
    .err { display: -webkit-box; max-width: 280px; overflow: hidden; -webkit-line-clamp: 2; -webkit-box-orient: vertical; color: var(--c-error); }
  `,
})
export class SessionsTab implements OnInit {
  protected readonly i18n = inject(LanguageService);
  private readonly api = inject(CountingService);
  private readonly dialogs = inject(DialogService);

  readonly mode = input<'queue' | 'history'>('history');
  /** Emits after an approve / force-close so the page can refresh counts. */
  readonly changed = output<void>();

  protected readonly rows = signal<CountSession[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly filter = signal<Filter>('ALL');

  protected readonly shown = computed(() => (this.filter() === 'ALL' ? this.rows() : this.rows().filter((r) => r.status === this.filter())));
  protected readonly filters = computed<SegmentOption<Filter>[]>(() => {
    const n = (s: SessionStatus) => this.rows().filter((r) => r.status === s).length;
    const all: Filter[] = ['ALL', 'PENDING_APPROVAL', 'APPROVED', 'FORCE_CLOSED', 'IN_PROGRESS', 'PENDING_RECOUNT'];
    return all
      .filter((f) => f === 'ALL' || n(f) > 0)
      .map((f) => ({
        value: f,
        label: f === 'ALL' ? this.i18n.t('All', 'Zote') : this.i18n.isSwahili() ? SESSION_STATUS[f].sw : SESSION_STATUS[f].en,
        count: f === 'ALL' ? this.rows().length : n(f),
      }));
  });

  protected readonly dateLabel = (r: CountSession) => r.sessionDate ?? '—';
  protected readonly dateKey = (r: CountSession) => r.startedAt ?? r.sessionDate;
  protected readonly statusKey = (r: CountSession) => r.status;
  protected readonly countedKey = (r: CountSession) => r.itemsCounted;
  protected readonly itemsKey = (r: CountSession) => r.itemsWithVariance ?? -1;
  protected readonly valueKey = (r: CountSession) => r.totalVarianceValue ?? 0;

  /** Not in the constructor: `mode` is only bound once inputs are set. */
  ngOnInit(): void {
    void this.load();
    void this.api.staff.load().catch(() => undefined);
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      this.rows.set(await this.api.list(this.mode() === 'queue' ? 'PENDING_APPROVAL' : undefined));
    } catch (e) {
      this.error.set(ApiError.from(e).message);
    } finally {
      this.loading.set(false);
    }
  }

  protected async open(row: CountSession): Promise<void> {
    const { SessionDialog } = await import('./session-dialog');
    const result = await this.dialogs.openAsync<boolean, SessionDialogData>(SessionDialog, {
      size: 'lg',
      data: { uid: row.uid, approvable: this.mode() === 'queue' },
    });
    if (result) this.changed.emit();
    // Also after Escape — a force-close may have happened before dismissing.
    void this.load();
  }

  protected status(s: SessionStatus) {
    return SESSION_STATUS[s] ?? SESSION_STATUS.IN_PROGRESS;
  }

  protected name(uid: string | null): string {
    return this.api.staffName(uid) ?? '—';
  }

  protected day(v: string | null): Date | null {
    return parseLocal(v);
  }
}
