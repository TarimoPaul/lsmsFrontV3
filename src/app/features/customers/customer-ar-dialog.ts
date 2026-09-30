import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';

import { ApiError } from '@core/api/api.types';
import { LanguageService } from '@core/i18n/language.service';
import { DialogService, DialogShell, EmptyState, Icon, SegmentOption, SegmentedFilterBar, Skeleton } from '@shared/ui';
import { parseLocal } from '@shared/utils/date-utils';
import { MoneyPipe } from '@shared/utils/money';
import { Customer } from './customers.models';
import { CustomersService } from './customers.service';
import { DebtPaymentsPanel } from './debt-payments-panel';
import { UnpaidTotalBar } from './unpaid-total-bar';

type View = 'owing' | 'paid';

/**
 * Customers by debt — port of Flutter `CustomerArScreen(embedded: true)`,
 * opened from the Reconciliation Debts tab so the cashier stays in context.
 * Owing = the shared customers cache, newest unpaid debt first like Flutter (no extra request when already loaded);
 * a row opens the customer statement, where unpaid sales can be paid.
 * Paid = the Customers module's debt-payments panel (each payment + its recon status). (Flutter's "Waived" tab
 * reads /debt-adjustments/report, which always fails server-side — skipped.)
 */
@Component({
  selector: 'app-customer-ar-dialog',
  imports: [DialogShell, SegmentedFilterBar, Icon, Skeleton, EmptyState, MoneyPipe, DatePipe, DebtPaymentsPanel, UnpaidTotalBar],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <lsms-dialog [title]="i18n.t('Customers by debt', 'Wateja kwa madeni')" icon="groups">
      <lsms-segmented-filter-bar [options]="views()" [(selected)]="view" [scrollable]="false" />
      @if (view() === 'owing') {
        <label class="search">
          <lsms-icon name="search" [size]="18" />
          <input type="search" [value]="q()" (input)="q.set($any($event.target).value)" [placeholder]="i18n.t('Search name or phone…', 'Tafuta jina au simu…')" />
        </label>
        <app-unpaid-total-bar class="bar" [total]="owedTotal()" [count]="owing().length" [search]="q().trim()" [loading]="customers.initialLoading()" />
        @if (customers.initialLoading()) {
          <lsms-skeleton variant="list" [rows]="5" />
        } @else if (error()) {
          <lsms-empty-state icon="error" iconColor="var(--c-error)" [title]="i18n.t('Could not load', 'Imeshindikana kupakia')" [message]="error()!" />
        } @else if (!owing().length) {
          <lsms-empty-state icon="task_alt" [title]="i18n.t('Nobody owes', 'Hakuna anayedaiwa')" />
        } @else {
          <ul class="rows">
            @for (c of owing(); track c.uid) {
              <li>
                <button type="button" (click)="openStatement(c)">
                  <span class="av">{{ initial(c.name) }}</span>
                  <span class="t"><b>{{ c.name }}</b><small>{{ c.phoneNumber || '—' }} · {{ i18n.t(c.salesCount + ' sale(s)', 'Mauzo ' + c.salesCount) }}@if (since(c.uid); as d) { · {{ i18n.t('since', 'tangu') }} {{ day(d) | date: 'dd MMM yyyy' }} }</small></span>
                  <b class="amt">{{ c.outstandingBalance | money }}</b>
                  <lsms-icon name="chevron_right" [size]="18" />
                </button>
              </li>
            }
          </ul>
        }
      } @else {
        <app-debt-payments-panel />
      }
    </lsms-dialog>
  `,
  styles: `
    lsms-segmented-filter-bar { display: block; margin-bottom: 12px; }
    .search { display: flex; align-items: center; gap: 8px; padding: 0 12px; height: 40px; border-radius: 12px; border: 1px solid var(--c-border); background: var(--c-surface); color: var(--c-text-2); }
    .search input { flex: 1; min-width: 0; border: 0; outline: 0; background: transparent; font: inherit; font-size: 0.86rem; color: var(--c-text); }
    .bar { margin: 10px 0; }
    .rows { list-style: none; margin: 0; padding: 0; border: 1px solid var(--c-border); border-radius: 14px; overflow: hidden; }
    .rows li + li { border-top: 1px solid var(--c-border); }
    .rows button { display: flex; align-items: center; gap: 10px; width: 100%; padding: 10px 12px; border: 0; background: var(--c-surface); font: inherit; color: var(--c-text); text-align: left; cursor: pointer; }
    .rows button:hover { background: var(--c-hover); }
    .av { display: grid; place-items: center; width: 34px; height: 34px; flex-shrink: 0; border-radius: 50%; font-weight: 700; font-size: 0.84rem; color: var(--c-error); background: color-mix(in srgb, var(--c-error) 12%, transparent); }
    .t { display: flex; flex-direction: column; flex: 1; min-width: 0; }
    .t b { font-size: 0.86rem; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .t small { font-size: 0.74rem; color: var(--c-text-2); }
    .amt { font-weight: 700; color: var(--c-error); font-variant-numeric: tabular-nums; }
    .rows button > lsms-icon { color: var(--c-text-2); }
  `,
})
export class CustomerArDialog {
  protected readonly i18n = inject(LanguageService);
  private readonly api = inject(CustomersService);
  private readonly dialogs = inject(DialogService);

  protected readonly customers = this.api.list;
  protected readonly view = signal<View>('owing');
  protected readonly q = signal('');
  protected readonly error = signal<string | null>(null);

  private readonly allOwing = computed(() => (this.customers.value() ?? []).filter((c) => c.outstandingBalance > 0).sort((a, b) => (this.since(b.uid) ?? '').localeCompare(this.since(a.uid) ?? '')));
  protected readonly owing = computed(() => {
    const q = this.q().trim().toLowerCase();
    return q ? this.allOwing().filter((c) => c.name.toLowerCase().includes(q) || (c.phoneNumber ?? '').includes(q)) : this.allOwing();
  });
  protected readonly owedTotal = computed(() => this.owing().reduce((n, c) => n + c.outstandingBalance, 0));
  protected readonly views = computed<SegmentOption<View>[]>(() => [
    { value: 'owing', label: this.i18n.t('Owing', 'Wanaodaiwa'), icon: 'account_balance_wallet', count: this.allOwing().length },
    { value: 'paid', label: this.i18n.t('Paid', 'Wamelipa'), icon: 'task_alt' },
  ]);

  constructor() {
    this.customers.load().catch((e) => this.error.set(ApiError.from(e).message));
    this.api.unpaidSince.load().catch(() => undefined);
  }

  protected since(uid: string): string | null {
    return this.api.unpaidSince.value()?.get(uid) ?? null;
  }

  protected day(v: string | null): Date | null {
    return parseLocal(v);
  }

  protected initial(name: string): string {
    return (name.trim()[0] ?? '?').toUpperCase();
  }

  /** The statement lists unpaid sales with Pay / Adjust; it invalidates the cache on change. */
  protected async openStatement(customer: Customer): Promise<void> {
    const { CustomerStatementDialog } = await import('./customer-statement-dialog');
    await this.dialogs.openAsync(CustomerStatementDialog, { size: 'lg', data: { customer } });
    this.customers.load().catch(() => undefined);
    this.api.unpaidSince.load().catch(() => undefined);
  }
}
