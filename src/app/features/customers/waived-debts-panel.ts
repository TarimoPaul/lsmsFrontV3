import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';

import { ApiError } from '@core/api/api.types';
import { LanguageService } from '@core/i18n/language.service';
import { Button, DataTable, DialogService, EmptyState, FilterPanel, Icon, SegmentOption, SegmentedFilterBar, TableColumn, ToastService } from '@shared/ui';
import { addDays, dayOnly, parseLocal, toLocalDateTime } from '@shared/utils/date-utils';
import { downloadCsv } from '@shared/utils/export';
import { MoneyPipe } from '@shared/utils/money';
import { DEBT_TYPES, DebtAdjustmentRecord, DebtAdjustmentType, DebtService } from '../sales/debt.service';
import { SalesService } from '../sales/sales.service';

type Period = '90' | '30' | '7' | 'all';
type TypeFilter = 'ALL' | DebtAdjustmentType;

const TONE: Record<DebtAdjustmentType, { color: string; icon: string }> = {
  WAIVER: { color: 'var(--c-warning)', icon: 'volunteer_activism' },
  WRITE_OFF: { color: 'var(--c-error)', icon: 'money_off' },
  CORRECTION: { color: 'var(--c-info)', icon: 'edit_note' },
};

/**
 * Debts reduced WITHOUT money — approved waivers, write-offs and corrections.
 *
 * Kept apart from "Malipo ya madeni" on purpose: the debt is gone but the customer
 * paid nothing. v3 also keeps corrections apart from the loss figure — a correction
 * fixes a sale that was entered wrong, so it is not money the shop gave up; only
 * waivers + write-offs are ("Hasara ya madeni").
 *
 * /report is unpaged, so the view is bounded by a date window; within it every row
 * is loaded, which makes the totals exact rather than page sums.
 */
@Component({
  selector: 'app-waived-debts-panel',
  imports: [FilterPanel, DataTable, TableColumn, EmptyState, Button, Icon, SegmentedFilterBar, MoneyPipe, DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <lsms-filter-panel [searchPlaceholder]="i18n.t('Search customer, receipt or reason…', 'Tafuta mteja, risiti au sababu…')" (search)="search.set($event.trim().toLowerCase())">
      <lsms-segmented-filter-bar filterSegments [options]="periods()" [selected]="period()" (selectedChange)="setPeriod($event)" />
      <button lsmsButton="secondary" size="sm" icon="download" [disabled]="!shown().length" (click)="exportCsv()">CSV</button>
    </lsms-filter-panel>

    <div class="stats">
      @for (s of stats(); track s.type) {
        <button type="button" class="stat" [class.on]="type() === s.type" [style.--tone]="s.color" (click)="setType(s.type)">
          <span class="lbl"><lsms-icon [name]="s.icon" [size]="16" />{{ s.label }}</span>
          <strong>{{ s.amount | money: { decimals: 0 } }}</strong>
          <small>{{ s.note }}</small>
        </button>
      }
    </div>

    @if (error()) {
      <lsms-empty-state icon="error" iconColor="var(--c-error)" [title]="i18n.t('Could not load waived debts', 'Imeshindikana kupakia madeni yaliyofutwa')" [message]="error()!" [secondaryActionLabel]="i18n.t('Retry', 'Jaribu tena')" (secondaryAction)="reload()" />
    } @else {
      <lsms-data-table
        [title]="i18n.t('Debts cleared without payment', 'Madeni yaliyofutwa bila malipo') + ' · ' + shown().length"
        [items]="shown()"
        [rowId]="rowId"
        [loading]="loading() && !rows().length"
        [pageSize]="50"
        [mobileTitle]="nameOf"
        [mobileColumns]="['amount', 'date', 'type', 'by']"
        [mobileCompactColumns]="['amount']"
        [emptyTitle]="i18n.t('No debt was cleared without payment in this period', 'Hakuna deni lililofutwa bila malipo kipindi hiki')"
        emptyIcon="task_alt"
        (rowClick)="openSale($event)"
      >
        <ng-template lsmsColumn="date" [label]="i18n.t('Date', 'Tarehe')" let-row>
          <span class="cell-stack"><span class="nowrap">{{ date(row.date) | date: 'dd MMM yyyy' }}</span><small>{{ date(row.date) | date: 'HH:mm' }}</small></span>
        </ng-template>
        <ng-template lsmsColumn="customer" [label]="i18n.t('Customer', 'Mteja')" [locked]="true" let-row>
          <span class="cell-stack"><strong>{{ row.customerName || '—' }}</strong><small class="muted">{{ row.receiptNumber || '' }}</small></span>
        </ng-template>
        <ng-template lsmsColumn="type" [label]="i18n.t('Type', 'Aina')" let-row>
          <span class="pill" [style.--tone]="tone(row.type).color"><lsms-icon [name]="tone(row.type).icon" [size]="14" />{{ typeLabel(row.type) }}</span>
        </ng-template>
        <ng-template lsmsColumn="amount" [label]="i18n.t('Amount', 'Kiasi')" align="end" let-row>
          <span class="cell-stack end"><span class="num strong" [style.color]="tone(row.type).color">{{ row.amount | money: { symbol: false } }}</span><small>{{ i18n.t('left', 'imebaki') }} {{ row.resultingOutstanding | money: { symbol: false } }}</small></span>
        </ng-template>
        <ng-template lsmsColumn="reason" [label]="i18n.t('Reason', 'Sababu')" let-row>
          <span class="reason" [title]="row.reason">{{ row.reason || '—' }}</span>
        </ng-template>
        <ng-template lsmsColumn="by" [label]="i18n.t('Done by', 'Imefanywa na')" let-row>
          <span class="cell-stack"><span>{{ row.makerName || '—' }}</span>@if (row.checkerName && row.checkerName !== row.makerName) {<small>{{ i18n.t('approved by', 'imeidhinishwa na') }} {{ row.checkerName }}</small>}</span>
        </ng-template>
      </lsms-data-table>
    }
  `,
  styles: `
    :host { display: block; }
    .stats { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; padding: 0 16px 16px; }
    .stat {
      --tone: var(--c-primary);
      display: flex; flex-direction: column; align-items: flex-start; gap: 2px; min-width: 0;
      padding: 10px 12px; border: 1px solid var(--c-border); border-radius: 12px; background: var(--c-surface);
      font: inherit; color: var(--c-text); text-align: left; cursor: pointer; transition: border-color 0.15s, background 0.15s;
      &:hover { border-color: color-mix(in srgb, var(--tone) 50%, var(--c-border)); }
      &.on { border-color: var(--tone); background: color-mix(in srgb, var(--tone) 7%, var(--c-surface)); box-shadow: inset 3px 0 0 var(--tone); }
      .lbl { display: inline-flex; align-items: center; gap: 6px; font-size: 0.74rem; font-weight: 600; color: var(--c-text-2); lsms-icon { color: var(--tone); } }
      strong { font-size: 1.02rem; font-weight: 600; }
      small { font-size: 0.7rem; color: var(--c-text-2); }
    }
    lsms-data-table { border: 0; border-top: 1px solid var(--c-border); border-radius: 0; max-height: 64vh; }
    .end { align-items: flex-end; }
    .nowrap { white-space: nowrap; }
    .muted { color: var(--c-text-2); }
    .reason { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; max-width: 320px; font-size: 0.82rem; }
    .pill {
      --tone: var(--c-text-2);
      display: inline-flex; align-items: center; gap: 4px; width: fit-content; padding: 2px 8px; border-radius: 999px;
      font-size: 0.72rem; font-weight: 600; white-space: nowrap;
      color: var(--tone); background: color-mix(in srgb, var(--tone) 10%, transparent);
    }
    @media (max-width: 860px) { .stats { grid-template-columns: 1fr; } }
  `,
})
export class WaivedDebtsPanel {
  protected readonly i18n = inject(LanguageService);
  private readonly api = inject(DebtService);
  private readonly sales = inject(SalesService);
  private readonly dialogs = inject(DialogService);
  private readonly toast = inject(ToastService);

  protected readonly rows = signal<DebtAdjustmentRecord[]>([]);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly period = signal<Period>('90');
  protected readonly type = signal<TypeFilter>('ALL');
  protected readonly search = signal('');
  private seq = 0;

  protected readonly rowId = (r: DebtAdjustmentRecord) => r.uid;
  protected readonly nameOf = (r: DebtAdjustmentRecord) => r.customerName ?? '—';

  protected readonly periods = computed<SegmentOption<Period>[]>(() => [
    { value: '90', label: this.i18n.t('3 months', 'Miezi 3') },
    { value: '30', label: this.i18n.t('30 days', 'Siku 30') },
    { value: '7', label: this.i18n.t('7 days', 'Siku 7') },
    { value: 'all', label: this.i18n.t('All', 'Yote') },
  ]);

  /** Search applies to the cards too, so "mama lolo" shows exactly what that customer was let off. */
  private readonly matched = computed(() => {
    const q = this.search();
    if (!q) return this.rows();
    return this.rows().filter((r) => [r.customerName, r.receiptNumber, r.reason, r.makerName].some((v) => v?.toLowerCase().includes(q)));
  });

  protected readonly shown = computed(() => (this.type() === 'ALL' ? this.matched() : this.matched().filter((r) => r.type === this.type())));

  protected readonly stats = computed(() => {
    const t = (en: string, sw: string) => this.i18n.t(en, sw);
    const sum = (ty: DebtAdjustmentType) => {
      const l = this.matched().filter((r) => r.type === ty);
      return { amount: l.reduce((n, r) => n + r.amount, 0), count: l.length, customers: new Set(l.map((r) => r.customerUid)).size };
    };
    const card = (type: DebtAdjustmentType, en: string, sw: string, noteEn: string, noteSw: string) => {
      const s = sum(type);
      return { type: type as TypeFilter, label: t(en, sw), icon: TONE[type].icon, color: TONE[type].color, amount: s.amount, note: t(`${s.count} · ${s.customers} customers · ${noteEn}`, `${s.count} · wateja ${s.customers} · ${noteSw}`) };
    };
    return [
      card('WAIVER', 'Waived', 'Zilizosamehewa', 'lost', 'hasara'),
      card('WRITE_OFF', 'Written off', 'Zilizofutwa', 'lost', 'hasara'),
      card('CORRECTION', 'Corrections', 'Masahihisho', 'sale was wrong', 'mauzo yalikosewa'),
    ];
  });

  constructor() {
    void this.reload();
  }

  protected setPeriod(p: Period): void {
    this.period.set(p);
    void this.reload();
  }

  protected setType(t: TypeFilter): void {
    this.type.set(this.type() === t ? 'ALL' : t);
  }

  protected async reload(): Promise<void> {
    const mine = ++this.seq;
    const p = this.period();
    this.loading.set(true);
    this.error.set(null);
    try {
      const rows = await this.api.report({
        status: 'APPROVED',
        startDate: p === 'all' ? null : toLocalDateTime(dayOnly(addDays(new Date(), -(Number(p) - 1)))),
      });
      if (mine === this.seq) this.rows.set(rows);
    } catch (e) {
      if (mine === this.seq) this.error.set(ApiError.from(e).message);
    } finally {
      if (mine === this.seq) this.loading.set(false);
    }
  }

  protected async openSale(r: DebtAdjustmentRecord): Promise<void> {
    if (!r.saleUid) return;
    try {
      const [sale, { SaleDetailsDialog }] = await Promise.all([this.sales.get(r.saleUid), import('../sales/sale-details-dialog')]);
      if ((await this.dialogs.openAsync(SaleDetailsDialog, { size: 'lg', data: { sale } })) === 'changed') void this.reload();
    } catch (e) {
      this.toast.error(ApiError.from(e).message);
    }
  }

  protected exportCsv(): void {
    const t = (en: string, sw: string) => this.i18n.t(en, sw);
    downloadCsv(
      'debts-cleared-without-payment',
      [t('Date', 'Tarehe'), t('Customer', 'Mteja'), t('Receipt', 'Risiti'), t('Type', 'Aina'), t('Amount', 'Kiasi'), t('Left on sale', 'Imebaki'), t('Reason', 'Sababu'), t('Done by', 'Imefanywa na'), t('Approved by', 'Imeidhinishwa na')],
      this.shown().map((r) => [r.date ?? '', r.customerName ?? '', r.receiptNumber ?? '', this.typeLabel(r.type), r.amount, r.resultingOutstanding, r.reason, r.makerName ?? '', r.checkerName ?? '']),
    );
  }

  protected tone(t: DebtAdjustmentType) {
    return TONE[t] ?? TONE.CORRECTION;
  }

  protected typeLabel(t: DebtAdjustmentType): string {
    const d = DEBT_TYPES[t];
    if (!d) return t;
    const label = { WAIVER: { en: 'Waived', sw: 'Imesamehewa' }, WRITE_OFF: { en: 'Written off', sw: 'Imefutwa' }, CORRECTION: { en: 'Correction', sw: 'Sahihisho' } }[t];
    return this.i18n.t(label.en, label.sw);
  }

  protected date(v: string | null): Date | null {
    return parseLocal(v);
  }
}
