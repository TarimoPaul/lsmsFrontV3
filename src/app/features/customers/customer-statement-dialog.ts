import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';

import { ApiError } from '@core/api/api.types';
import { AuthService } from '@core/auth/auth.service';
import { LanguageService } from '@core/i18n/language.service';
import { AgingBar, AgingBucket, Button, DialogService, DialogShell, Icon, Skeleton } from '@shared/ui';
import { parseLocal } from '@shared/utils/date-utils';
import { MoneyPipe } from '@shared/utils/money';
import type { Sale } from '../sales/sales.models';
import { SalesService } from '../sales/sales.service';
import { Customer, CustomerStatement } from './customers.models';
import { CustomersService } from './customers.service';

export interface CustomerStatementData {
  customer: Customer;
}

const ENTRY: Record<string, { en: string; sw: string; icon: string; color: string }> = {
  INVOICE: { en: 'Sale', sw: 'Mauzo', icon: 'receipt', color: 'var(--c-error)' },
  PAYMENT: { en: 'Payment', sw: 'Malipo', icon: 'payments', color: 'var(--c-success)' },
  RETURN: { en: 'Return', sw: 'Marejesho', icon: 'assignment_return', color: 'var(--c-info)' },
};

/**
 * Accounts-receivable statement — port of Flutter `CustomerStatementScreen`
 * (totals, aging, ledger with running balance) + the unpaid sales, each
 * payable / adjustable with the Sales module's dialogs.
 */
@Component({
  selector: 'app-customer-statement-dialog',
  imports: [DialogShell, Button, Icon, Skeleton, AgingBar, MoneyPipe, DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <lsms-dialog [title]="i18n.t('Statement', 'Taarifa ya akaunti') + ' · ' + data.customer.name" icon="receipt_long">
      @if (loading()) {
        <lsms-skeleton variant="list" [rows]="4" />
      } @else if (error()) {
        <p class="err"><lsms-icon name="error" [size]="18" />{{ error() }}</p>
      } @else if (st(); as s) {
        <section class="sum">
          <div class="big" [class.ok]="s.outstandingBalance <= 0">
            <small>{{ i18n.t('Owes us', 'Anadaiwa') }}</small>
            <b>{{ s.outstandingBalance | money }}</b>
            @if (s.overdueAmount > 0) {
              <span class="od"><lsms-icon name="schedule" [size]="14" />{{ s.overdueAmount | money }} {{ i18n.t('overdue', 'limechelewa') }}</span>
            }
          </div>
          <div><small>{{ i18n.t('Sold', 'Mauzo') }}</small><b>{{ s.totalInvoiced | money }}</b><small>{{ s.totalInvoices }} {{ i18n.t('sales', 'mauzo') }}</small></div>
          <div><small>{{ i18n.t('Paid', 'Amelipa') }}</small><b>{{ s.totalPaid | money }}</b></div>
          <div>
            <small>{{ i18n.t('Unpaid sales', 'Mauzo yasiyolipwa') }}</small><b>{{ s.unpaidInvoices }}</b>
            @if (s.oldestUnpaidAgeDays > 0) {
              <small>{{ i18n.t('oldest', 'la zamani') }} {{ s.oldestUnpaidAgeDays }} {{ i18n.t('days', 'siku') }}</small>
            }
          </div>
        </section>

        @if (s.outstandingBalance > 0) {
          <section class="block">
            <h4><lsms-icon name="hourglass_bottom" [size]="15" />{{ i18n.t('Debt age', 'Umri wa deni') }}</h4>
            <lsms-aging-bar [buckets]="aging()" />
          </section>
        }

        @if (unpaid().length) {
          <section class="block">
            <h4><lsms-icon name="pending_actions" [size]="15" />{{ i18n.t('Unpaid sales', 'Mauzo yasiyolipwa') }} <span class="count">{{ unpaid().length }}</span></h4>
            <ul class="unpaid">
              @for (u of unpaid(); track u.uid) {
                <li>
                  <span class="u-l">
                    <b>{{ u.receiptNumber }}</b>
                    <small>{{ date(u.saleDate) | date: 'dd MMM yyyy' }} · {{ i18n.t('total', 'jumla') }} {{ u.total | money: { symbol: false } }}</small>
                  </span>
                  <b class="u-owe">{{ u.balance | money }}</b>
                  <span class="u-a">
                    <button lsmsButton="text" size="sm" (click)="details(u)">{{ i18n.t('Details', 'Taarifa') }}</button>
                    @if (canAdjust) {
                      <button lsmsButton="secondary" size="sm" icon="money_off" (click)="adjust(u)">{{ i18n.t('Adjust', 'Rekebisha') }}</button>
                    }
                    @if (canPay) {
                      <button lsmsButton="success" size="sm" icon="payments" (click)="pay(u)">{{ i18n.t('Pay', 'Lipa') }}</button>
                    }
                  </span>
                </li>
              }
            </ul>
          </section>
        }

        <section class="block">
          <h4><lsms-icon name="list_alt" [size]="15" />{{ i18n.t('Ledger', 'Leja') }} <span class="count">{{ s.entries.length }}</span></h4>
          @if (s.entries.length) {
            <div class="scroll">
              <table>
                <thead>
                  <tr>
                    <th>{{ i18n.t('Date', 'Tarehe') }}</th>
                    <th>{{ i18n.t('Entry', 'Muamala') }}</th>
                    <th class="n">{{ i18n.t('Amount', 'Kiasi') }}</th>
                    <th class="n">{{ i18n.t('Balance', 'Salio') }}</th>
                  </tr>
                </thead>
                <tbody>
                  @for (e of entriesDesc(); track $index) {
                    @let m = meta(e.type);
                    <tr>
                      <td class="nowrap">{{ date(e.date) | date: 'dd MMM yyyy' }}</td>
                      <td>
                        <span class="pill" [style.--st]="m.color"><lsms-icon [name]="m.icon" [size]="13" />{{ i18n.isSwahili() ? m.sw : m.en }}</span>
                        @if (e.overdue) {
                          <span class="late">{{ i18n.t('overdue', 'imechelewa') }}</span>
                        }
                        <small class="ref">
                          {{ e.reference || '' }}
                          @if (e.paymentMethod) { · {{ e.paymentMethod }} }
                          @if (e.receivedByName) { · {{ e.receivedByName }} }
                        </small>
                      </td>
                      <td class="n" [class.debit]="e.debit > 0" [class.credit]="e.credit > 0">
                        {{ e.debit > 0 ? '+' : '−' }}{{ (e.debit > 0 ? e.debit : e.credit) | money: { symbol: false } }}
                      </td>
                      <td class="n strong">{{ e.runningBalance | money: { symbol: false } }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          } @else {
            <p class="muted">{{ i18n.t('No transactions yet.', 'Hakuna miamala bado.') }}</p>
          }
        </section>
      }
      <ng-container dialogActions>
        <button lsmsButton="secondary" (click)="ref.close(changed)">{{ i18n.t('Close', 'Funga') }}</button>
      </ng-container>
    </lsms-dialog>
  `,
  styles: `
    @use 'detail-dialog';
    @include detail-dialog.base;
    .unpaid { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
    .unpaid li { display: flex; align-items: center; flex-wrap: wrap; gap: 8px 12px; padding: 8px 10px; border-radius: 10px; background: var(--c-surface); border: 1px solid var(--c-border); }
    .u-l { display: flex; flex-direction: column; flex: 1; min-width: 140px; }
    .u-l b { font-family: ui-monospace, monospace; font-size: 0.78rem; }
    .u-l small { font-size: 0.7rem; color: var(--c-text-2); }
    .u-owe { color: var(--c-error); font-variant-numeric: tabular-nums; }
    .u-a { display: flex; gap: 6px; }
  `,
})
export class CustomerStatementDialog {
  protected readonly data = inject<CustomerStatementData>(DIALOG_DATA);
  protected readonly ref = inject<DialogRef>(DialogRef);
  protected readonly i18n = inject(LanguageService);
  private readonly api = inject(CustomersService);
  private readonly salesApi = inject(SalesService);
  private readonly dialogs = inject(DialogService);
  private readonly auth = inject(AuthService);
  protected readonly canPay = this.auth.hasPermission('PAYMENT_WRITE');
  protected readonly canAdjust = this.auth.hasAnyPermission(['DEBT_WRITE_OFF', 'DEBT_ADJUST_CREATE']);
  protected readonly unpaid = signal<Sale[]>([]);
  protected changed = false;

  protected readonly st = signal<CustomerStatement | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);

  protected readonly entriesDesc = computed(() => [...(this.st()?.entries ?? [])].reverse());
  protected readonly aging = computed<AgingBucket[]>(() => {
    const s = this.st();
    const t = (en: string, sw: string) => this.i18n.t(en, sw);
    return [
      { label: t('0–30 days', 'Siku 0–30'), value: s?.aging0to30 ?? 0, color: 'var(--c-info)' },
      { label: t('31–60 days', 'Siku 31–60'), value: s?.aging31to60 ?? 0, color: 'var(--c-warning)' },
      { label: t('61–90 days', 'Siku 61–90'), value: s?.aging61to90 ?? 0, color: '#e65100' },
      { label: t('90+ days', 'Siku 90+'), value: s?.aging90plus ?? 0, color: 'var(--c-error)' },
    ];
  });

  constructor() {
    void this.load();
  }

  private async load(): Promise<void> {
    const unpaid = this.auth.hasPermission('SALES_READ')
      ? this.salesApi.byCustomer(this.data.customer.uid).then((l) => this.unpaid.set(l.filter((x) => x.balance > 0))).catch(() => undefined)
      : Promise.resolve();
    try {
      this.st.set(await this.api.statement(this.data.customer.uid));
    } catch (e) {
      this.error.set(ApiError.from(e).message);
    } finally {
      this.loading.set(false);
    }
    await unpaid;
  }

  private async afterChange(): Promise<void> {
    this.changed = true;
    this.api.list.invalidate();
    await this.load();
  }

  protected async pay(sale: Sale): Promise<void> {
    const { SalePaymentDialog } = await import('../sales/sale-payment-dialog');
    if (await this.dialogs.openAsync(SalePaymentDialog, { size: 'sm', data: { sale } })) await this.afterChange();
  }

  protected async adjust(sale: Sale): Promise<void> {
    const { DebtAdjustDialog } = await import('../sales/debt-adjust-dialog');
    if (await this.dialogs.openAsync(DebtAdjustDialog, { size: 'md', data: { sale } })) await this.afterChange();
  }

  protected async details(sale: Sale): Promise<void> {
    const { SaleDetailsDialog } = await import('../sales/sale-details-dialog');
    if ((await this.dialogs.openAsync(SaleDetailsDialog, { size: 'lg', data: { sale } })) === 'changed') await this.afterChange();
  }

  protected meta(type: string) {
    return ENTRY[type] ?? ENTRY['INVOICE'];
  }

  protected date(v: string | null): Date | null {
    return parseLocal(v);
  }
}
