import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal, viewChild } from '@angular/core';

import { ApiError } from '@core/api/api.types';
import { AuthService } from '@core/auth/auth.service';
import { LanguageService } from '@core/i18n/language.service';
import { Button, DataTable, DialogService, Icon, MetricCard, MetricsGrid, SearchBar, SegmentOption, SegmentedFilterBar, TableColumn, ToastService } from '@shared/ui';
import { parseLocal } from '@shared/utils/date-utils';
import { Money, MoneyPipe } from '@shared/utils/money';
import { ReasonDialog, ReasonDialogData } from '../reconciliation/reason-dialog';
import { moneyAccountByMethod } from '../general-ledger/money-accounts';
import { Expenditure, ExpStatus, STATUS, typeIcon, typeLabel } from './capital.models';
import { CapitalService } from './capital.service';

type Filter = 'ALL' | ExpStatus;
const NOT_EXPENSES = new Set(['PRODUCT_CAPITAL', 'INVENTORY_CAPITAL']);

/**
 * Operating expenses: recorded by anyone with CAPITAL_WRITE, approved by
 * someone else (maker-checker, enforced by the server) — approval posts
 * Dr expense / Cr the account the money left from. An approved expense is
 * never edited or deleted: cancelling it reverses its journal.
 */
@Component({
  selector: 'app-expenses-tab',
  imports: [DataTable, TableColumn, Button, Icon, MetricCard, MetricsGrid, SearchBar, SegmentedFilterBar, MoneyPipe, DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <lsms-metrics-grid [gap]="12">
      <lsms-metric-card [title]="i18n.t('Approved this month', 'Zilizoidhinishwa mwezi huu')" [value]="stats().month | money: { decimals: 0 }" icon="receipt_long" color="var(--c-primary)" [subtitle]="i18n.t(stats().monthCount + ' expense(s)', 'Gharama ' + stats().monthCount)" />
      <lsms-metric-card [title]="i18n.t('Awaiting approval', 'Zinasubiri idhini')" [value]="stats().pending + ''" icon="hourglass_top" color="var(--c-warning)" [urgent]="stats().pending > 0" [subtitle]="(stats().pendingAmount | money: { decimals: 0 }) + ''" />
      <lsms-metric-card [title]="i18n.t('Stock losses (all time)', 'Upotevu wa bidhaa (jumla)')" [value]="stats().shrinkage | money: { decimals: 0 }" icon="remove_shopping_cart" color="var(--c-error)" />
      <lsms-metric-card [title]="i18n.t('Cancelled / rejected', 'Zilizobatilishwa / kukataliwa')" [value]="stats().voided + ''" icon="undo" color="var(--c-text-2)" />
    </lsms-metrics-grid>

    <div class="bar">
      <lsms-search-bar [placeholder]="i18n.t('Search expense…', 'Tafuta gharama…')" (search)="q.set($event)" (cleared)="q.set('')" />
      <button lsmsButton="secondary" icon="event_repeat" (click)="budgets()">{{ i18n.t('Monthly budgets', 'Bajeti za kila mwezi') }}</button>
      @if (canWrite()) {
        <button lsmsButton="primary" icon="add" (click)="create()">{{ i18n.t('New expense', 'Gharama mpya') }}</button>
      }
    </div>
    <lsms-segmented-filter-bar [options]="filters()" [selected]="filter()" (selectedChange)="filter.set($event)" />

    @if (pendingPicked().length) {
      <div class="bulkbar">
        <span><lsms-icon name="checklist" [size]="18" />{{ i18n.t(pendingPicked().length + ' pending selected · ', 'Zinazosubiri ' + pendingPicked().length + ' zimechaguliwa · ') }}<b>{{ pickedTotal() | money: { decimals: 0 } }}</b></span>
        <span class="acts">
          <button lsmsButton="success" size="sm" icon="done_all" [loading]="bulkBusy()" (click)="approveSelected()">{{ i18n.t('Approve', 'Idhinisha') }} ({{ pendingPicked().length }})</button>
          <button lsmsButton="text" size="sm" [disabled]="bulkBusy()" (click)="table()?.clearSelection()">{{ i18n.t('Clear', 'Ondoa') }}</button>
        </span>
      </div>
    }

    <div class="table-card">
      <lsms-data-table
        [title]="i18n.t('Expenses', 'Gharama')"
        [rowId]="rowId"
        [bulkSelection]="canApprove()"
        (selectionChange)="picked.set($event)"
        [items]="rows()"
        [loading]="loading()"
        [pageSize]="25"
        defaultSortColumn="date"
        defaultSortDirection="desc"
        [mobileTitle]="descOf"
        [mobileColumns]="['amount', 'status', 'actions']"
        [mobileCompactColumns]="['amount']"
        [emptyTitle]="i18n.t('No expenses', 'Hakuna gharama')"
        emptyIcon="receipt_long"
      >
        <ng-template lsmsColumn="date" [label]="i18n.t('Date', 'Tarehe')" [sortBy]="dateOf" let-row>
          <span class="cell-stack"><span>{{ day(row.transactionDate) | date: 'dd MMM yyyy' }}</span><small>{{ row.referenceNumber }}</small></span>
        </ng-template>
        <ng-template lsmsColumn="what" [label]="i18n.t('Expense', 'Gharama')" [locked]="true" let-row>
          <span class="what">
            <span class="ic"><lsms-icon [name]="icon(row.capitalType)" [size]="17" /></span>
            <span class="cell-stack"><strong>{{ row.description }}</strong><small>{{ type(row.capitalType) }}</small></span>
          </span>
        </ng-template>
        <ng-template lsmsColumn="amount" [label]="i18n.t('Amount', 'Kiasi')" align="end" [sortBy]="amountOf" let-row>
          <span class="num strong">{{ row.amount | money: { decimals: 0 } }}</span>
        </ng-template>
        <ng-template lsmsColumn="method" [label]="i18n.t('Paid from', 'Imelipwa kutoka')" let-row>
          <span class="muted">{{ method(row.paymentMethod) }}</span>
        </ng-template>
        <ng-template lsmsColumn="status" [label]="i18n.t('Status', 'Hali')" [sortBy]="statusOf" let-row>
          @let st = status(row.status);
          <span class="cell-stack">
            <span class="pill" [style.--pc]="st.color"><lsms-icon [name]="st.icon" [size]="13" />{{ i18n.isSwahili() ? st.sw : st.en }}</span>
            <small>@if (row.status === 'APPROVED') { {{ row.approvedBy }} } @else if (row.createdBy) { {{ i18n.t('by', 'na') }} {{ row.createdBy }} }@if (row.statusChangeReason && row.status !== 'APPROVED' && row.status !== 'PENDING') { · {{ row.statusChangeReason }} }</small>
          </span>
        </ng-template>
        <ng-template lsmsColumn="actions" let-row>
          <span class="acts">
            @if (row.status === 'PENDING' && canApprove()) {
              <button lsmsButton="success" size="sm" icon="check" [loading]="busy() === row.uid" [disabled]="!!busy()" (click)="approve(row)">{{ i18n.t('Approve', 'Idhinisha') }}</button>
              <button lsmsButton="text" size="sm" [disabled]="!!busy()" (click)="reject(row)">{{ i18n.t('Reject', 'Kataa') }}</button>
            }
            @if (row.status === 'APPROVED' && canApprove() && row.capitalType !== 'SHRINKAGE_LOSS') {
              <button lsmsButton="text" size="sm" icon="undo" [disabled]="!!busy()" (click)="cancel(row)">{{ i18n.t('Cancel', 'Batilisha') }}</button>
            }
          </span>
        </ng-template>
      </lsms-data-table>
    </div>
  `,
  styles: `
    @use 'list-page';
    @include list-page.base;
    :host { display: flex; flex-direction: column; gap: 12px; }
    .bar { display: flex; align-items: center; gap: 10px; }
    .bar lsms-search-bar { flex: 1; max-width: 520px; }
    .bar button { margin-left: auto; }
    /* Phones: search on its own row, the two actions share the next one. */
    @media (max-width: 599px) {
      .bar { flex-wrap: wrap; }
      .bar lsms-search-bar { flex: 1 1 100%; max-width: none; }
      .bar button { flex: 1 1 0; margin-left: 0; }
    }
    .what { display: inline-flex; align-items: center; gap: 10px; }
    .ic { display: inline-flex; padding: 7px; border-radius: 10px; color: var(--c-primary); background: color-mix(in srgb, var(--c-primary) 10%, transparent); }
    .pill { display: inline-flex; align-items: center; gap: 4px; padding: 2px 9px; border-radius: 100px; font-size: 0.7rem; font-weight: 600; white-space: nowrap; color: var(--pc); background: color-mix(in srgb, var(--pc) 12%, transparent); }
    .acts { display: inline-flex; gap: 4px; justify-content: flex-end; }
    .bulkbar { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; padding: 10px 14px; border-radius: 12px; border: 1px solid color-mix(in srgb, var(--c-success) 35%, var(--c-border)); background: color-mix(in srgb, var(--c-success) 6%, var(--c-surface)); font-size: 0.86rem; }
    .bulkbar > span:first-child { display: inline-flex; align-items: center; gap: 8px; }
  `,
})
export class ExpensesTab {
  protected readonly i18n = inject(LanguageService);
  private readonly api = inject(CapitalService);
  private readonly auth = inject(AuthService);
  private readonly dialogs = inject(DialogService);
  private readonly toast = inject(ToastService);

  protected readonly q = signal('');
  protected readonly filter = signal<Filter>('ALL');
  protected readonly busy = signal<string | null>(null);
  protected readonly table = viewChild<DataTable<Expenditure>>(DataTable);
  protected readonly picked = signal<Expenditure[]>([]);
  protected readonly bulkBusy = signal(false);
  protected readonly rowId = (e: Expenditure) => e.uid;
  /** Only PENDING rows can be approved; other selected rows are ignored. */
  protected readonly pendingPicked = computed(() => this.picked().filter((e) => e.status === 'PENDING'));
  protected readonly pickedTotal = computed(() => this.pendingPicked().reduce((n, e) => n + e.amount, 0));
  protected readonly loading = this.api.all.initialLoading;

  protected readonly canWrite = computed(() => this.auth.hasPermission('CAPITAL_WRITE'));
  protected readonly canApprove = computed(() => this.auth.hasPermission('CAPITAL_APPROVE'));

  /** Operating expenses only: stock purchases live in Purchases, assets have their own tab. */
  private readonly expenses = computed(() => (this.api.all.value() ?? []).filter((e) => !e.asset && !NOT_EXPENSES.has(e.capitalType)));

  protected readonly stats = computed(() => {
    const now = new Date();
    const inMonth = (e: Expenditure) => {
      const d = parseLocal(e.transactionDate);
      return !!d && d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    };
    const approved = this.expenses().filter((e) => e.status === 'APPROVED');
    const pending = this.expenses().filter((e) => e.status === 'PENDING');
    return {
      month: approved.filter(inMonth).filter((e) => e.capitalType !== 'SHRINKAGE_LOSS').reduce((s, e) => s + e.amount, 0),
      monthCount: approved.filter(inMonth).length,
      pending: pending.length,
      pendingAmount: pending.reduce((s, e) => s + e.amount, 0),
      shrinkage: approved.filter((e) => e.capitalType === 'SHRINKAGE_LOSS').reduce((s, e) => s + e.amount, 0),
      voided: this.expenses().filter((e) => e.status === 'CANCELLED' || e.status === 'REJECTED').length,
    };
  });

  protected readonly filters = computed<SegmentOption<Filter>[]>(() => {
    const c = (s: ExpStatus) => this.expenses().filter((e) => e.status === s).length || undefined;
    const l = (s: ExpStatus) => (this.i18n.isSwahili() ? STATUS[s].sw : STATUS[s].en).split(' · ')[0];
    return [
      { value: 'ALL', label: this.i18n.t('All', 'Zote'), count: this.expenses().length || undefined },
      { value: 'PENDING', label: l('PENDING'), count: c('PENDING'), icon: 'hourglass_top' },
      { value: 'APPROVED', label: l('APPROVED'), count: c('APPROVED'), icon: 'verified' },
      { value: 'CANCELLED', label: l('CANCELLED'), count: c('CANCELLED') },
      { value: 'REJECTED', label: l('REJECTED'), count: c('REJECTED') },
    ];
  });

  protected readonly rows = computed(() => {
    const q = this.q().trim().toLowerCase();
    const f = this.filter();
    return this.expenses().filter(
      (e) => (f === 'ALL' || e.status === f) && (!q || e.description.toLowerCase().includes(q) || (e.referenceNumber ?? '').toLowerCase().includes(q)),
    );
  });

  protected readonly descOf = (e: Expenditure) => e.description;
  protected readonly dateOf = (e: Expenditure) => e.transactionDate ?? '';
  protected readonly amountOf = (e: Expenditure) => e.amount;
  protected readonly statusOf = (e: Expenditure) => e.status;

  constructor() {
    void this.api.all.load();
  }

  protected async create(): Promise<void> {
    const { ExpenseDialog } = await import('./capital-dialogs');
    const created = await this.dialogs.openAsync<Expenditure>(ExpenseDialog, { size: 'md', disableClose: true });
    if (created) {
      await this.api.all.load(true);
      this.toast.success(
        created.recurring
          ? this.i18n.t('Monthly budget started', 'Bajeti ya kila mwezi imeanzishwa')
          : this.i18n.t('Expense saved — waiting for approval', 'Gharama imehifadhiwa — inasubiri idhini'),
      );
    }
  }

  protected async budgets(): Promise<void> {
    const { RecurringBudgetsDialog } = await import('./capital-dialogs');
    const changed = await this.dialogs.openAsync<boolean>(RecurringBudgetsDialog, {
      size: 'md',
      data: { canEdit: this.auth.hasPermission('CAPITAL_WRITE'), canStop: this.auth.hasPermission('CAPITAL_APPROVE') },
    });
    if (changed) await this.api.all.load(true);
  }

  protected async approve(e: Expenditure): Promise<void> {
    const ok = await this.dialogs.confirm({
      title: this.i18n.t('Approve expense', 'Idhinisha gharama'),
      message: `${e.description}\n${Money.format(e.amount)} · ${this.method(e.paymentMethod)}\n\n${this.i18n.t('It will be posted to the books (GL).', 'Itaandikwa kwenye vitabu (GL).')}`,
      confirmText: this.i18n.t('Approve', 'Idhinisha'),
      cancelText: this.i18n.t('Cancel', 'Ghairi'),
    });
    if (!ok) return;
    await this.run(e, () => this.api.approve(e.uid), this.i18n.t('Approved and posted', 'Imeidhinishwa na kuandikwa GL'));
  }

  protected async reject(e: Expenditure): Promise<void> {
    const reason = await this.reason(this.i18n.t('Reject expense', 'Kataa gharama'), e, false);
    if (reason) await this.run(e, () => this.api.setStatus(e.uid, 'REJECTED', reason), this.i18n.t('Rejected', 'Imekataliwa'));
  }

  protected async cancel(e: Expenditure): Promise<void> {
    const reason = await this.reason(this.i18n.t('Cancel approved expense', 'Batilisha gharama iliyoidhinishwa'), e, true);
    if (reason) await this.run(e, () => this.api.setStatus(e.uid, 'CANCELLED', reason), this.i18n.t('Cancelled — journal reversed', 'Imebatilishwa — GL imerekebishwa'));
  }

  private reason(title: string, e: Expenditure, posted: boolean): Promise<string | undefined> {
    return this.dialogs.openAsync<string, ReasonDialogData>(ReasonDialog, {
      size: 'sm',
      data: {
        title,
        message: `${e.description} · ${Money.format(e.amount)}${posted ? '\n' + this.i18n.t('A reversing journal will be posted.', 'Journal ya kurudisha itaandikwa.') : ''}`,
        label: this.i18n.t('Reason (required)', 'Sababu (inahitajika)'),
        confirm: this.i18n.t('Confirm', 'Thibitisha'),
        danger: true,
        min: 5,
      },
    });
  }

  /**
   * One approve call per expense (the bulk endpoint returns its per-item reasons as one
   * flattened string), so every refusal — e.g. approving your own entry — is reported by name.
   */
  protected async approveSelected(): Promise<void> {
    const list = this.pendingPicked();
    const t = (en: string, sw: string) => this.i18n.t(en, sw);
    const ok = await this.dialogs.confirm({
      title: t(`Approve ${list.length} expense(s)`, `Idhinisha gharama ${list.length}`),
      message: `${Money.format(this.pickedTotal())}\n\n${t('Each one is posted to the books (GL).', 'Kila moja itaandikwa kwenye vitabu (GL).')}`,
      confirmText: t('Approve', 'Idhinisha'),
      cancelText: t('Cancel', 'Ghairi'),
    });
    if (!ok) return;
    this.bulkBusy.set(true);
    const failed: string[] = [];
    for (const e of list) {
      try {
        await this.api.approve(e.uid);
      } catch (err) {
        failed.push(`${e.description}: ${ApiError.from(err).message}`);
      }
    }
    await this.api.all.load(true).catch(() => undefined);
    this.table()?.clearSelection();
    this.bulkBusy.set(false);
    const done = list.length - failed.length;
    if (done) this.toast.success(t(`${done} approved and posted`, `${done} zimeidhinishwa na kuandikwa GL`));
    if (failed.length) {
      await this.dialogs.confirm({
        title: t(`${failed.length} not approved`, `${failed.length} hazikuidhinishwa`),
        message: failed.join('\n'),
        confirmText: t('OK', 'Sawa'),
        cancelText: t('Close', 'Funga'),
      });
    }
  }

  private async run(e: Expenditure, action: () => Promise<unknown>, done: string): Promise<void> {
    this.busy.set(e.uid);
    try {
      await action();
      await this.api.all.load(true);
      this.toast.success(done);
    } catch (err) {
      this.toast.error(ApiError.from(err).message);
    } finally {
      this.busy.set(null);
    }
  }

  protected type(t: string): string {
    return typeLabel(t, this.i18n.isSwahili());
  }

  protected icon(t: string): string {
    return typeIcon(t);
  }

  protected method(m: string | null): string {
    const a = moneyAccountByMethod(m);
    return this.i18n.isSwahili() ? a.sw : a.en;
  }

  protected status(s: ExpStatus) {
    return STATUS[s] ?? STATUS.PENDING;
  }

  protected day(v: string | null): Date | null {
    return parseLocal(v);
  }
}
