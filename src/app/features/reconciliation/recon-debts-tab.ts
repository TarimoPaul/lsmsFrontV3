import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, signal, untracked } from '@angular/core';

import { ApiError } from '@core/api/api.types';
import { AuthService } from '@core/auth/auth.service';
import { LanguageService } from '@core/i18n/language.service';
import { Button, DialogService, Icon, Skeleton, ToastService } from '@shared/ui';
import { parseLocal } from '@shared/utils/date-utils';
import { Money, MoneyPipe } from '@shared/utils/money';
import { SalesService } from '../sales/sales.service';
import type { ReconDebtDialogData } from './recon-debt-dialog';
import { DebtItem, DebtSummary, RetailDebtRequest, priceTypeLabel } from './recon-extra.models';
import { ReconStore } from './recon.store';
import { ReconciliationService } from './reconciliation.service';

type StatusFilter = '' | 'UNPAID' | 'PARTIAL';

/**
 * Debts tab — port of Flutter `_DebtsTab`: record a walk-in debt (customer,
 * what they took, due date), the debt register for a sale-date window
 * (defaults to the reconciliation day) with search / status filters and
 * paging, take a payment on any debt, and edit / delete walk-in debts
 * (delete needs RECONCILIATION_DELETE and a reason — it voids the sale).
 */
@Component({
  selector: 'app-recon-debts-tab',
  imports: [Button, Icon, Skeleton, MoneyPipe, DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="totals">
      @if (store.current(); as r) {
        <div style="--tc: var(--c-warning)"><small>{{ i18n.t('Credit sales today (POS)', 'Madeni ya POS leo') }}</small><b>{{ r.posDebtsTotal | money }}</b></div>
        <div style="--tc: var(--c-warning)"><small>{{ i18n.t('Walk-in debts today', 'Madeni ya mkono leo') }}</small><b>{{ r.manualDebtsTotal | money }}</b></div>
      }
      @if (summary(); as s) {
        <div style="--tc: var(--c-error)"><small>{{ i18n.t('Outstanding in range', 'Yanayodaiwa kipindi hiki') }} · {{ s.count }}</small><b>{{ s.outstanding | money }}</b></div>
        <div style="--tc: var(--c-error)"><small>{{ i18n.t('Overdue', 'Yamepitwa na muda') }} · {{ s.overdueCount }}</small><b>{{ s.overdue | money }}</b></div>
        <div style="--tc: var(--c-success)"><small>{{ i18n.t('Paid today', 'Yamelipwa leo') }}</small><b>{{ s.paidToday | money }}</b></div>
      }
    </div>

    @if (canAdd()) {
      <div class="bar-add">
        <span><lsms-icon name="person_add" [size]="18" />{{ i18n.t('A customer took goods on credit and it is not in the POS?', 'Mteja amechukua mzigo kwa mkopo na haupo kwenye POS?') }}</span>
        <button lsmsButton size="sm" icon="add" [loading]="store.saving()" (click)="addDebt()">{{ i18n.t('Record a debt', 'Rekodi deni') }}</button>
      </div>
    }

    <div class="filters">
      <label class="range">
        <lsms-icon name="date_range" [size]="16" />
        <input type="date" [max]="toDate()" [value]="fromDate()" (change)="setFrom($any($event.target).value)" [attr.aria-label]="i18n.t('From', 'Kuanzia')" />
        <span>–</span>
        <input type="date" [min]="fromDate()" [value]="toDate()" (change)="setTo($any($event.target).value)" [attr.aria-label]="i18n.t('To', 'Hadi')" />
      </label>
      <label class="search">
        <lsms-icon name="search" [size]="16" />
        <input type="search" [value]="search()" (input)="typeSearch($any($event.target).value)" [placeholder]="i18n.t('Customer, phone or receipt…', 'Mteja, simu au risiti…')" />
      </label>
      <div class="chips">
        @for (f of statusFilters; track f.value) {
          <button type="button" [class.on]="status() === f.value" (click)="setStatus(f.value)">{{ i18n.isSwahili() ? f.sw : f.en }}</button>
        }
      </div>
    </div>

    @if (loading() && !summary()) {
      <lsms-skeleton variant="list" [rows]="5" />
    } @else if (error()) {
      <p class="empty err">{{ error() }} · <button type="button" (click)="load()">{{ i18n.t('Retry', 'Jaribu tena') }}</button></p>
    } @else if (!summary()?.debts?.length) {
      <p class="empty">{{ i18n.t('No debts in this period.', 'Hakuna madeni katika kipindi hiki.') }}</p>
    } @else {
      <ul class="debts" [class.busy]="loading()">
        @for (d of summary()!.debts; track d.saleUid) {
          @let manual = d.source === 'RECONCILIATION_MANUAL';
          <li [class.overdue]="d.overdue">
            <div class="d1">
              <span class="ic" [class.manual]="manual"><lsms-icon [name]="manual ? 'person' : 'point_of_sale'" [size]="17" /></span>
              <span class="t">
                <b>{{ d.customerName || i18n.t('Customer', 'Mteja') }}</b>
                <small>{{ d.customerPhone || '—' }} · {{ d.receipt || '—' }} · {{ day(d.saleDate) | date: 'dd MMM yyyy' }}</small>
              </span>
              <span class="tag" [style.--tc]="manual ? 'var(--c-info)' : 'var(--c-primary)'">{{ manual ? i18n.t('WALK-IN', 'MKONONI') : 'POS' }}</span>
              @if (d.ageDays > 0) {
                <span class="tag" [style.--tc]="d.overdue ? 'var(--c-error)' : 'var(--c-text-2)'" [title]="i18n.t('Days since the sale', 'Siku tangu mauzo')">{{ d.ageDays }}{{ i18n.t('d', 's') }}</span>
              }
              <span class="money">
                <b>{{ d.balance | money }}</b>
                <small>{{ i18n.t('of', 'kati ya') }} {{ d.total | money: { symbol: false } }}@if (d.paid > 0) { · {{ i18n.t('paid', 'imelipwa') }} {{ d.paid | money: { symbol: false } }} }</small>
              </span>
            </div>
            @if (d.products.length || d.notes || d.productNotes) {
              <div class="d2">
                @if (d.products.length) {
                  <span><lsms-icon name="inventory_2" [size]="13" />{{ productsText(d) }}</span>
                }
                @if (d.notes) {
                  <span><lsms-icon name="notes" [size]="13" />{{ d.notes }}</span>
                }
                @if (d.productNotes) {
                  <span><lsms-icon name="sell" [size]="13" />{{ d.productNotes }}</span>
                }
              </div>
            }
            <div class="d3">
              @if (canPay()) {
                <button lsmsButton size="sm" icon="payments" [loading]="paying() === d.saleUid" (click)="pay(d)">{{ i18n.t('Receive payment', 'Pokea malipo') }}</button>
              }
              @if (manual && store.canEdit() && d.status !== 'PAID') {
                <button lsmsButton="secondary" size="sm" icon="edit" (click)="edit(d)">{{ i18n.t('Edit', 'Hariri') }}</button>
              }
              @if (manual && store.canEdit() && canDelete()) {
                <button lsmsButton="text" size="sm" icon="delete" class="del" (click)="remove(d)">{{ i18n.t('Delete', 'Futa') }}</button>
              }
            </div>
          </li>
        }
      </ul>
      @if (summary()!.pages > 1) {
        <div class="pager">
          <small>{{ i18n.t('Page', 'Ukurasa') }} {{ page() + 1 }} / {{ summary()!.pages }} · {{ summary()!.total }} {{ i18n.t('debts', 'madeni') }}</small>
          <button lsmsButton="secondary" size="sm" icon="chevron_left" [disabled]="page() === 0" (click)="goPage(page() - 1)">{{ i18n.t('Prev', 'Nyuma') }}</button>
          <button lsmsButton="secondary" size="sm" icon="chevron_right" [disabled]="page() >= summary()!.pages - 1" (click)="goPage(page() + 1)">{{ i18n.t('Next', 'Mbele') }}</button>
        </div>
      }
    }
  `,
  styleUrl: './recon-tab.scss',
  styles: `
    .bar-add { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px; padding: 12px 14px; border-radius: 14px; background: color-mix(in srgb, var(--c-primary) 6%, var(--c-surface)); border: 1px dashed color-mix(in srgb, var(--c-primary) 35%, var(--c-border)); }
    .bar-add span { display: inline-flex; align-items: center; gap: 8px; font-size: 0.84rem; color: var(--c-text-2); }
    .bar-add lsms-icon { color: var(--c-primary); }
    .filters { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 10px; }
    .filters label { display: inline-flex; align-items: center; gap: 6px; height: 38px; padding: 0 10px; border-radius: 10px; border: 1px solid var(--c-border); background: var(--c-surface); }
    .filters label lsms-icon { color: var(--c-text-2); }
    .filters input { border: 0; outline: 0; background: transparent; font: inherit; font-size: 0.84rem; color: var(--c-text); }
    .filters .search { flex: 1; min-width: 200px; }
    .filters .search input { flex: 1; }
    .debts { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; border-radius: 16px; background: var(--c-surface); border: 1px solid var(--c-border); overflow: hidden; transition: opacity 0.15s; }
    .debts.busy { opacity: 0.6; }
    .debts li { display: flex; flex-direction: column; gap: 6px; padding: 12px 14px; border-top: 1px solid var(--c-border); }
    .debts li:first-child { border-top: 0; }
    .debts li.overdue { box-shadow: inset 3px 0 0 var(--c-error); }
    .d1 { display: flex; align-items: center; gap: 10px; }
    .ic { display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; width: 34px; height: 34px; border-radius: 10px; color: var(--c-primary); background: color-mix(in srgb, var(--c-primary) 10%, transparent); }
    .ic.manual { color: var(--c-info); background: color-mix(in srgb, var(--c-info) 10%, transparent); }
    .t { display: flex; flex-direction: column; flex: 1; min-width: 0; }
    .t b { font-size: 0.86rem; font-weight: 600; }
    .t small { font-size: 0.72rem; color: var(--c-text-2); }
    .money { display: flex; flex-direction: column; align-items: flex-end; text-align: right; }
    .money b { font-size: 0.92rem; font-weight: 700; color: var(--c-error); font-variant-numeric: tabular-nums; }
    .money small { font-size: 0.72rem; color: var(--c-text-2); white-space: nowrap; }
    .d2 { display: flex; flex-direction: column; gap: 2px; padding-left: 44px; font-size: 0.76rem; color: var(--c-text-2); }
    .d2 span { display: inline-flex; align-items: center; gap: 5px; }
    .d3 { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 6px; }
    .del { color: var(--c-error); }
    .pager { display: flex; align-items: center; justify-content: flex-end; gap: 8px; }
    .pager small { margin-right: auto; color: var(--c-text-2); }
    .err { color: var(--c-error); }
    .empty button { padding: 0; border: 0; background: none; font: inherit; font-weight: 600; color: var(--c-primary); cursor: pointer; }
    @media (max-width: 600px) { .d1 { flex-wrap: wrap; } .d2 { padding-left: 0; } }
  `,
})
export class ReconDebtsTab {
  protected readonly i18n = inject(LanguageService);
  protected readonly store = inject(ReconStore);
  private readonly auth = inject(AuthService);
  private readonly api = inject(ReconciliationService);
  private readonly sales = inject(SalesService);
  private readonly dialogs = inject(DialogService);
  private readonly toast = inject(ToastService);

  protected readonly statusFilters: Array<{ value: StatusFilter; en: string; sw: string }> = [
    { value: '', en: 'All', sw: 'Yote' },
    { value: 'UNPAID', en: 'Unpaid', sw: 'Hayajalipwa' },
    { value: 'PARTIAL', en: 'Part paid', sw: 'Sehemu' },
  ];

  protected readonly fromDate = signal(this.store.date());
  protected readonly toDate = signal(this.store.date());
  protected readonly search = signal('');
  protected readonly status = signal<StatusFilter>('');
  protected readonly page = signal(0);
  protected readonly summary = signal<DebtSummary | null>(null);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly paying = signal<string | null>(null);
  private searchTimer: ReturnType<typeof setTimeout> | null = null;
  private seq = 0;

  protected readonly canAdd = computed(() => {
    const r = this.store.current();
    return this.store.canEdit() && (!r || r.editable);
  });
  protected readonly canPay = computed(() => this.auth.hasAnyPermission(['PAYMENT_WRITE', 'SALES_UPDATE']));
  protected readonly canDelete = computed(() => this.auth.isRoot() || this.auth.hasPermission('RECONCILIATION_DELETE'));

  constructor() {
    // Follow the reconciliation day (like Flutter: the window resets to that day).
    effect(() => {
      const d = this.store.date();
      untracked(() => {
        this.fromDate.set(d);
        this.toDate.set(d);
        this.page.set(0);
        void this.load();
      });
    });
    inject(DestroyRef).onDestroy(() => this.searchTimer && clearTimeout(this.searchTimer));
  }

  protected async load(): Promise<void> {
    const n = ++this.seq;
    this.loading.set(true);
    this.error.set(null);
    try {
      const s = await this.api.debts({ fromDate: this.fromDate(), toDate: this.toDate(), search: this.search().trim(), status: this.status(), page: this.page() });
      if (n === this.seq) this.summary.set(s);
    } catch (e) {
      if (n === this.seq) this.error.set(ApiError.from(e).message);
    } finally {
      if (n === this.seq) this.loading.set(false);
    }
  }

  protected setFrom(v: string): void {
    if (!v) return;
    this.fromDate.set(v);
    this.goPage(0);
  }
  protected setTo(v: string): void {
    if (!v) return;
    this.toDate.set(v);
    this.goPage(0);
  }
  protected setStatus(s: StatusFilter): void {
    this.status.set(s);
    this.goPage(0);
  }
  protected typeSearch(v: string): void {
    this.search.set(v);
    if (this.searchTimer) clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => this.goPage(0), 350);
  }
  protected goPage(p: number): void {
    this.page.set(Math.max(0, p));
    void this.load();
  }

  protected day(v: string | null): Date | null {
    return parseLocal(v);
  }

  protected productsText(d: DebtItem): string {
    const sw = this.i18n.isSwahili();
    return d.products.map((p) => `${p.productName ?? '—'} ${p.quantity}× ${priceTypeLabel(p.priceType, sw)}`).join(', ');
  }

  protected async addDebt(): Promise<void> {
    const req = await this.openDialog({ date: this.store.date() });
    if (!req) return;
    const res = await this.store.act((uid) => this.api.addRetailDebt(uid, req), this.i18n.t(`Debt of ${Money.format(req.amount)} recorded`, `Deni la ${Money.format(req.amount)} limerekodiwa`));
    if (res.error) this.toast.error(res.error);
    else this.goPage(0);
  }

  protected async edit(d: DebtItem): Promise<void> {
    const req = await this.openDialog({ date: this.store.date(), debt: d });
    if (!req) return;
    const res = await this.api.updateManualDebt(d.saleUid, req);
    if (res.error) return void this.toast.error(res.error);
    this.toast.success(this.i18n.t('Debt updated', 'Deni limesasishwa'));
    await this.store.refresh();
    void this.load();
  }

  protected async remove(d: DebtItem): Promise<void> {
    const { ReasonDialog } = await import('./reason-dialog');
    const reason = await this.dialogs.openAsync<string>(ReasonDialog, {
      size: 'sm',
      data: {
        title: this.i18n.t('Delete this debt?', 'Futa deni hili?'),
        message: this.i18n.t(`${d.customerName ?? 'Customer'} · ${Money.format(d.balance)}. The walk-in sale is voided for good.`, `${d.customerName ?? 'Mteja'} · ${Money.format(d.balance)}. Mauzo haya ya mkononi yatafutwa kabisa.`),
        label: this.i18n.t('Reason (required)', 'Sababu (lazima)'),
        confirm: this.i18n.t('Delete', 'Futa'),
        danger: true,
      },
    });
    if (!reason) return;
    const res = await this.api.deleteManualDebt(d.saleUid, reason);
    if (res.error) return void this.toast.error(res.error);
    this.toast.success(this.i18n.t('Debt deleted', 'Deni limefutwa'));
    await this.store.refresh();
    void this.load();
  }

  /** Take money against the debt with the Sales payment dialog, then refresh — a paid debt becomes expected cash. */
  protected async pay(d: DebtItem): Promise<void> {
    this.paying.set(d.saleUid);
    try {
      const sale = await this.sales.get(d.saleUid);
      const { SalePaymentDialog } = await import('../sales/sale-payment-dialog');
      if (await this.dialogs.openAsync(SalePaymentDialog, { size: 'sm', data: { sale } })) {
        void this.load();
        await this.store.refresh();
      }
    } catch (e) {
      this.toast.error(ApiError.from(e).message);
    } finally {
      this.paying.set(null);
    }
  }

  private async openDialog(data: ReconDebtDialogData): Promise<RetailDebtRequest | undefined> {
    const { ReconDebtDialog } = await import('./recon-debt-dialog');
    return this.dialogs.openAsync<RetailDebtRequest>(ReconDebtDialog, { size: 'md', data });
  }
}
