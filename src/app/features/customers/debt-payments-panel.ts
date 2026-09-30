import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';

import { ApiError } from '@core/api/api.types';
import { LanguageService } from '@core/i18n/language.service';
import { Button, DataTable, DialogService, EmptyState, FilterPanel, Icon, SegmentOption, SegmentedFilterBar, SelectField, SelectOption, TableColumn, ToastService } from '@shared/ui';
import { addDays, dayOnly, parseLocal, toLocalDateTime } from '@shared/utils/date-utils';
import { MoneyPipe } from '@shared/utils/money';
import { SalesService } from '../sales/sales.service';
import { DebtPayment, DebtPaymentQuery, DebtPaymentSummary, ReconState } from './customers.models';
import { CustomersService } from './customers.service';

const PAGE = 50;
type Period = '90' | '30' | '7' | 'all';
type StateFilter = 'ALL' | ReconState;

/** Label + colour for a payment's reconciliation position (raw recon status when it is in one). */
const RECON: Record<string, { en: string; sw: string; color: string; icon: string }> = {
  NONE: { en: 'Not in any recon', sw: 'Haijaingia reco', color: 'var(--c-error)', icon: 'report' },
  DRAFT: { en: 'Recon not submitted', sw: 'Reco haijatumwa', color: 'var(--c-warning)', icon: 'edit_note' },
  SUBMITTED: { en: 'Submitted', sw: 'Imetumwa', color: 'var(--c-info)', icon: 'send' },
  REVIEWED: { en: 'Reviewed', sw: 'Imekaguliwa', color: 'var(--c-info)', icon: 'fact_check' },
  REOPENED: { en: 'Reopened', sw: 'Imefunguliwa tena', color: 'var(--c-warning)', icon: 'lock_open' },
  APPROVED: { en: 'Approved', sw: 'Imeidhinishwa', color: 'var(--c-success)', icon: 'verified' },
  CLOSED: { en: 'Closed', sw: 'Imefungwa', color: 'var(--c-success)', icon: 'verified' },
};

/**
 * "Malipo ya madeni" — every debt payment (partial or final) a customer made on
 * a later day than the sale: when, how much, who received it, and whether that
 * money reached the receiver's reconciliation and how far that recon got.
 * Server-paged + server-side filters; the totals strip covers every match.
 */
@Component({
  selector: 'app-debt-payments-panel',
  imports: [FilterPanel, DataTable, TableColumn, EmptyState, Button, Icon, SegmentedFilterBar, SelectField, MoneyPipe, DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <lsms-filter-panel [searchPlaceholder]="i18n.t('Search customer, phone or receipt…', 'Tafuta mteja, simu au risiti…')" (search)="onSearch($event)">
      <lsms-segmented-filter-bar filterSegments [options]="periods()" [selected]="period()" (selectedChange)="setPeriod($event)" />
      @if (receiverOptions().length > 1) {
        <lsms-select-field class="receiver" [dense]="true" prefixIcon="person" [options]="receiverOptions()" [value]="receiver()" (valueChange)="setReceiver($event)" [ariaLabel]="i18n.t('Received by', 'Mpokeaji')" />
      }
    </lsms-filter-panel>

    <div class="stats">
      @for (s of stats(); track s.state) {
        <button type="button" class="stat" [class.on]="state() === s.state" [style.--tone]="s.color" (click)="setState(s.state)">
          <span class="lbl"><lsms-icon [name]="s.icon" [size]="16" />{{ s.label }}</span>
          <strong>{{ s.amount | money: { decimals: 0 } }}</strong>
          <small>{{ s.note }}</small>
        </button>
      }
    </div>

    @if (error()) {
      <lsms-empty-state icon="error" iconColor="var(--c-error)" [title]="i18n.t('Could not load debt payments', 'Imeshindikana kupakia malipo ya madeni')" [message]="error()!" [secondaryActionLabel]="i18n.t('Retry', 'Jaribu tena')" (secondaryAction)="reload()" />
    } @else {
      <lsms-data-table
        [title]="i18n.t('Debt payments', 'Malipo ya madeni') + ' · ' + total()"
        [items]="items()"
        [rowId]="rowId"
        [loading]="loading() && !items().length"
        [showPagination]="false"
        [mobileTitle]="nameOf"
        [mobileColumns]="['amount', 'paid', 'by', 'recon']"
        [mobileCompactColumns]="['amount']"
        [emptyTitle]="i18n.t('No debt payments found', 'Hakuna malipo ya madeni yaliyopatikana')"
        emptyIcon="task_alt"
        (rowClick)="openSale($event)"
      >
        <ng-template lsmsColumn="paid" [label]="i18n.t('Paid on', 'Tarehe ya malipo')" let-row>
          <span class="cell-stack"><span class="nowrap">{{ date(row.paymentDate) | date: 'dd MMM yyyy' }}</span><small>{{ date(row.paymentDate) | date: 'HH:mm' }}</small></span>
        </ng-template>
        <ng-template lsmsColumn="customer" [label]="i18n.t('Customer', 'Mteja')" [locked]="true" let-row>
          <span class="cell-stack"><strong>{{ row.customerName }}</strong><small>{{ row.customerPhone || '' }}</small></span>
        </ng-template>
        <ng-template lsmsColumn="receipt" [label]="i18n.t('Sale', 'Mauzo')" let-row>
          <span class="cell-stack"><span class="muted nowrap">{{ row.receiptNumber || '—' }}</span><small>{{ i18n.t('sold', 'aliuziwa') }} {{ date(row.saleDate) | date: 'dd MMM yyyy' }}</small></span>
        </ng-template>
        <ng-template lsmsColumn="amount" [label]="i18n.t('Amount', 'Kiasi')" align="end" let-row>
          <span class="cell-stack end"><span class="num strong ok">{{ row.amount | money: { symbol: false } }}</span><small>{{ method(row.paymentMethod) }}</small></span>
        </ng-template>
        <ng-template lsmsColumn="by" [label]="i18n.t('Received by', 'Mpokeaji')" let-row>
          <span>{{ row.receivedByName || '—' }}</span>
        </ng-template>
        <ng-template lsmsColumn="recon" [label]="i18n.t('Reconciliation', 'Hali ya reco')" let-row>
          <span class="cell-stack">
            <span class="pill" [style.--tone]="recon(row).color"><lsms-icon [name]="recon(row).icon" [size]="14" />{{ i18n.isSwahili() ? recon(row).sw : recon(row).en }}</span>
            @if (row.reconUid) {
              <small>{{ i18n.t('Recon', 'Reco') }} {{ date(row.reconDate) | date: 'dd MMM' }}@if (row.reconOwnerName) { · {{ row.reconOwnerName }} }@if (row.approvedByName) { · {{ i18n.t('by', 'na') }} {{ row.approvedByName }} }</small>
            }
          </span>
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
    .receiver { min-width: 190px; }
    .stats { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; padding: 0 16px 16px; }
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
    .ok { color: var(--c-success); }
    .pill {
      --tone: var(--c-text-2);
      display: inline-flex; align-items: center; gap: 4px; width: fit-content; padding: 2px 8px; border-radius: 999px;
      font-size: 0.72rem; font-weight: 600; white-space: nowrap;
      color: var(--tone); background: color-mix(in srgb, var(--tone) 10%, transparent);
    }
    .more { display: flex; justify-content: center; padding: 12px; border-top: 1px solid var(--c-border); }
    @media (max-width: 860px) { .stats { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
  `,
})
export class DebtPaymentsPanel {
  protected readonly i18n = inject(LanguageService);
  private readonly api = inject(CustomersService);
  private readonly sales = inject(SalesService);
  private readonly dialogs = inject(DialogService);
  private readonly toast = inject(ToastService);

  protected readonly items = signal<DebtPayment[]>([]);
  protected readonly summary = signal<DebtPaymentSummary | null>(null);
  protected readonly page = signal(0);
  protected readonly pages = signal(1);
  protected readonly total = signal(0);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly period = signal<Period>('90');
  protected readonly state = signal<StateFilter>('ALL');
  protected readonly receiver = signal<string>('');
  private search = '';
  private seq = 0;

  protected readonly rowId = (p: DebtPayment) => p.paymentUid;
  protected readonly nameOf = (p: DebtPayment) => p.customerName;

  protected readonly periods = computed<SegmentOption<Period>[]>(() => [
    { value: '90', label: this.i18n.t('3 months', 'Miezi 3') },
    { value: '30', label: this.i18n.t('30 days', 'Siku 30') },
    { value: '7', label: this.i18n.t('7 days', 'Siku 7') },
    { value: 'all', label: this.i18n.t('All', 'Yote') },
  ]);

  protected readonly receiverOptions = computed<SelectOption<string>[]>(() => [
    { value: '', label: this.i18n.t('Everyone', 'Wapokeaji wote'), icon: 'groups' },
    ...(this.summary()?.receivers ?? []).map((r) => ({ value: r.uid, label: r.name, icon: 'person' })),
  ]);

  /** Totals strip — always over every state, so clicking one shows its share. */
  protected readonly stats = computed(() => {
    const s = this.summary();
    const t = (en: string, sw: string) => this.i18n.t(en, sw);
    const n = (count: number, en: string, sw: string) => t(`${count} ${en}`, `${sw} ${count}`);
    return [
      { state: 'ALL' as StateFilter, label: t('Collected', 'Yaliyopokelewa'), icon: 'payments', color: 'var(--c-primary)', amount: s?.totalAmount ?? 0, note: s ? t(`${s.count} payments · ${s.customers} customers`, `Malipo ${s.count} · wateja ${s.customers}`) : '—' },
      { state: 'APPROVED' as StateFilter, label: t('Approved in recon', 'Imeidhinishwa kwenye reco'), icon: 'verified', color: 'var(--c-success)', amount: s?.approvedAmount ?? 0, note: t('Recon approved or closed', 'Reco imeidhinishwa / imefungwa') },
      { state: 'PENDING' as StateFilter, label: t('Awaiting approval', 'Inasubiri idhini'), icon: 'hourglass_top', color: 'var(--c-warning)', amount: s?.pendingAmount ?? 0, note: t('In a recon not yet approved', 'Iko kwenye reco isiyoidhinishwa') },
      { state: 'NONE' as StateFilter, label: t('Not in any recon', 'Haijaingia reco'), icon: 'report', color: 'var(--c-error)', amount: s?.notInReconAmount ?? 0, note: s ? n(s.notInReconCount, 'payments', 'Malipo') : '—' },
    ];
  });

  constructor() {
    void this.reload();
  }

  protected onSearch(q: string): void {
    this.search = q;
    void this.reload();
  }

  protected setPeriod(p: Period): void {
    this.period.set(p);
    void this.reload();
  }

  protected setState(s: StateFilter): void {
    // Clicking the active card again goes back to "all".
    this.state.set(this.state() === s ? 'ALL' : s);
    void this.reload(false);
  }

  protected setReceiver(uid: string | null): void {
    this.receiver.set(uid ?? '');
    void this.reload();
  }

  private query(withState: boolean): DebtPaymentQuery {
    const p = this.period();
    return {
      from: p === 'all' ? null : toLocalDateTime(dayOnly(addDays(new Date(), -(Number(p) - 1)))),
      search: this.search,
      receivedBy: this.receiver() || null,
      reconState: withState && this.state() !== 'ALL' ? (this.state() as ReconState) : null,
    };
  }

  /** `withSummary` = false when only the state filter changed (the strip covers every state). */
  protected async reload(withSummary = true): Promise<void> {
    this.items.set([]);
    this.page.set(0);
    if (withSummary) {
      const mine = this.seq + 1;
      this.api.debtPaymentSummary(this.query(false)).then(
        (s) => mine === this.seq && this.summary.set(s),
        () => undefined,
      );
    }
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
      const res = await this.api.debtPayments(page, PAGE, this.query(true));
      if (mine !== this.seq) return; // a newer filter superseded this one
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

  protected async openSale(p: DebtPayment): Promise<void> {
    if (!p.saleUid) return;
    try {
      const [sale, { SaleDetailsDialog }] = await Promise.all([this.sales.get(p.saleUid), import('../sales/sale-details-dialog')]);
      if ((await this.dialogs.openAsync(SaleDetailsDialog, { size: 'lg', data: { sale } })) === 'changed') void this.reload();
    } catch (e) {
      this.toast.error(ApiError.from(e).message);
    }
  }

  protected recon(p: DebtPayment) {
    return RECON[p.reconState === 'NONE' ? 'NONE' : (p.reconStatus ?? 'SUBMITTED')] ?? RECON['SUBMITTED'];
  }

  protected method(m: string | null): string {
    return m ? m.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase()) : '—';
  }

  protected date(v: string | null): Date | null {
    return parseLocal(v);
  }
}
