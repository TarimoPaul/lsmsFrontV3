import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';

import { ApiError } from '@core/api/api.types';
import { AuthService } from '@core/auth/auth.service';
import { LanguageService } from '@core/i18n/language.service';
import { AgingBar, Button, DialogService, DialogShell, Icon, Skeleton, ToastService } from '@shared/ui';
import { parseLocal } from '@shared/utils/date-utils';
import { MoneyPipe } from '@shared/utils/money';
import { AGING_BUCKETS, PAYMENT_METHODS, PaymentMethod, Supplier, SupplierPayment, SupplierStatement } from './suppliers.models';
import { SuppliersService } from './suppliers.service';

export interface SupplierStatementData {
  supplier: Supplier;
}

/**
 * Accounts-payable statement — port of Flutter `SupplierStatementScreen`
 * (outstanding / purchased / paid, aging buckets, ledger, "Pay") as a dialog,
 * plus the payment list with undo (delete) for SUPPLIER_PAYMENT_PROCESS.
 */
@Component({
  selector: 'app-supplier-statement-dialog',
  imports: [DialogShell, Button, Icon, Skeleton, AgingBar, MoneyPipe, DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <lsms-dialog [title]="i18n.t('Statement', 'Taarifa ya akaunti') + ' · ' + data.supplier.name" icon="receipt_long">
      @if (loading()) {
        <lsms-skeleton variant="list" [rows]="4" />
      } @else if (error()) {
        <p class="err"><lsms-icon name="error" [size]="18" />{{ error() }}</p>
      } @else if (st(); as s) {
        <section class="sum">
          <div class="big" [class.ok]="s.outstanding <= 0">
            <small>{{ i18n.t('Outstanding', 'Deni') }}</small>
            <b>{{ s.outstanding | money }}</b>
            @if (s.overdueAmount > 0) {
              <span class="od"><lsms-icon name="schedule" [size]="14" />{{ s.overdueAmount | money }} {{ i18n.t('overdue', 'limechelewa') }}</span>
            }
          </div>
          <div class="mini"><small>{{ i18n.t('Purchased', 'Manunuzi') }}</small><b>{{ s.totalPurchased | money }}</b></div>
          <div class="mini"><small>{{ i18n.t('Paid', 'Imelipwa') }}</small><b>{{ s.totalPaid | money }}</b></div>
          <div class="mini"><small>{{ i18n.t('Terms', 'Muda') }}</small><b>{{ data.supplier.paymentTermsDays }} {{ i18n.t('days', 'siku') }}</b></div>
        </section>

        @if (agingTotal() > 0) {
          <section class="block">
            <h4><lsms-icon name="hourglass_bottom" [size]="15" />{{ i18n.t('Aging of unpaid invoices', 'Umri wa madeni') }}</h4>
            <lsms-aging-bar [buckets]="aging()" />
          </section>
        }

        <section class="block">
          <h4><lsms-icon name="list_alt" [size]="15" />{{ i18n.t('Ledger', 'Leja') }} <span class="count">{{ s.ledger.length }}</span></h4>
          @if (s.ledger.length) {
            <div class="scroll">
              <table>
                <thead>
                  <tr>
                    <th>{{ i18n.t('Date', 'Tarehe') }}</th>
                    <th>{{ i18n.t('Entry', 'Muamala') }}</th>
                    <th>{{ i18n.t('Due', 'Mwisho') }}</th>
                    <th class="n">{{ i18n.t('Amount', 'Kiasi') }}</th>
                    <th class="n">{{ i18n.t('Balance', 'Salio') }}</th>
                  </tr>
                </thead>
                <tbody>
                  @for (e of ledgerDesc(); track $index) {
                    @let isBuy = e.type === 'PURCHASE';
                    <tr>
                      <td class="nowrap">{{ date(e.date) | date: 'dd MMM yyyy' }}</td>
                      <td>
                        <span class="kind" [class.pay]="!isBuy">
                          <lsms-icon [name]="isBuy ? 'shopping_cart' : 'payments'" [size]="14" />
                          {{ isBuy ? i18n.t('Purchase', 'Manunuzi') : i18n.t('Payment', 'Malipo') }}
                        </span>
                        @if (e.reference) {
                          <small class="ref" [title]="e.reference">{{ shortRef(e.reference) }}</small>
                        }
                      </td>
                      <td class="nowrap">
                        @if (e.dueDate) {
                          {{ date(e.dueDate) | date: 'dd MMM' }}
                          @if (overdueDays(e.dueDate) > 0 && isBuy) {
                            <span class="late">+{{ overdueDays(e.dueDate) }}d</span>
                          }
                        } @else {
                          <span class="muted">—</span>
                        }
                      </td>
                      <td class="n" [class.debit]="isBuy" [class.credit]="!isBuy">{{ isBuy ? '+' : '−' }}{{ (isBuy ? e.debit : e.credit) | money: { symbol: false } }}</td>
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

        @if (payments().length) {
          <section class="block">
            <h4><lsms-icon name="payments" [size]="15" />{{ i18n.t('Payments', 'Malipo') }} <span class="count">{{ payments().length }}</span></h4>
            <ul class="pays">
              @for (p of payments(); track p.uid) {
                <li>
                  <lsms-icon [name]="methodIcon(p.paymentMethod)" [size]="18" />
                  <span class="pinfo">
                    <b>{{ p.amount | money }}</b>
                    <small>
                      {{ date(p.paymentDate) | date: 'dd MMM yyyy, HH:mm' }} · {{ methodLabel(p.paymentMethod) }}
                      @if (p.paymentProvider) { · {{ p.paymentProvider }} }
                      @if (p.reference) { · {{ p.reference }} }
                      @if (p.paidByName) { · {{ p.paidByName }} }
                    </small>
                  </span>
                  @if (canPay) {
                    <button lsmsButton="text" size="sm" icon="undo" (click)="undo(p)">{{ i18n.t('Undo', 'Rudisha') }}</button>
                  }
                </li>
              }
            </ul>
          </section>
        }
      }
      <ng-container dialogActions>
        <button lsmsButton="secondary" (click)="ref.close(changed)">{{ i18n.t('Close', 'Funga') }}</button>
        @if (canPay && st()) {
          <button lsmsButton icon="payments" (click)="pay()">{{ i18n.t('Record payment', 'Lipa') }}</button>
        }
      </ng-container>
    </lsms-dialog>
  `,
  styles: `
    @use 'detail-dialog';
    @include detail-dialog.base;
    .kind { display: inline-flex; align-items: center; gap: 4px; font-weight: 700; color: var(--c-error); &.pay { color: var(--c-success); } }
    .pays { list-style: none; margin: 0; padding: 0; border-radius: 10px; border: 1px solid var(--c-border); background: var(--c-surface); }
    .pays li { display: flex; align-items: center; gap: 10px; padding: 8px 12px; border-bottom: 1px solid var(--c-border); lsms-icon { color: var(--c-success); } }
    .pays li:last-child { border-bottom: 0; }
    .pinfo { flex: 1; min-width: 0; display: flex; flex-direction: column; }
    .pinfo small { font-size: 0.72rem; color: var(--c-text-2); }
  `,
})
export class SupplierStatementDialog {
  protected readonly data = inject<SupplierStatementData>(DIALOG_DATA);
  protected readonly ref = inject<DialogRef<boolean>>(DialogRef);
  protected readonly i18n = inject(LanguageService);
  private readonly api = inject(SuppliersService);
  private readonly dialogs = inject(DialogService);
  private readonly toast = inject(ToastService);

  protected readonly canPay = inject(AuthService).hasPermission('SUPPLIER_PAYMENT_PROCESS');
  protected readonly st = signal<SupplierStatement | null>(null);
  protected readonly payments = signal<SupplierPayment[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  /** Tells the caller whether the supplier list needs a refresh. */
  protected changed = false;

  protected readonly ledgerDesc = computed(() => [...(this.st()?.ledger ?? [])].reverse());
  protected readonly aging = computed(() => {
    const s = this.st();
    const lang = this.i18n.lang();
    return AGING_BUCKETS.map((b) => ({ label: b[lang], color: b.color, value: s ? (s[b.key] as number) : 0 }));
  });
  protected readonly agingTotal = computed(() => this.aging().reduce((n, b) => n + b.value, 0));

  constructor() {
    void this.load();
  }

  private async load(): Promise<void> {
    this.loading.set(this.st() === null);
    this.error.set(null);
    try {
      const [st, pays] = await Promise.all([this.api.statement(this.data.supplier.uid), this.api.payments(this.data.supplier.uid)]);
      this.st.set(st);
      this.payments.set(pays);
    } catch (e) {
      this.error.set(ApiError.from(e).message);
    } finally {
      this.loading.set(false);
    }
  }

  protected date(v: string | null): Date | null {
    return parseLocal(v);
  }

  protected overdueDays(due: string | null): number {
    const d = parseLocal(due);
    if (!d) return 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return Math.floor((today.getTime() - d.getTime()) / 86_400_000);
  }

  /** "PUR-<uuid>-20260622-090559" → "PUR-20260622-090559". */
  protected shortRef(ref: string): string {
    return ref.replace(/-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i, '');
  }

  protected methodLabel(m: string | null): string {
    const meta = m ? PAYMENT_METHODS[m as PaymentMethod] : undefined;
    return meta ? meta[this.i18n.lang()] : (m ?? '—');
  }

  protected methodIcon(m: string | null): string {
    return (m && PAYMENT_METHODS[m as PaymentMethod]?.icon) || 'payments';
  }

  protected async pay(): Promise<void> {
    const { SupplierPaymentDialog } = await import('./supplier-payment-dialog');
    const ok = await this.dialogs.openAsync<boolean>(SupplierPaymentDialog, {
      size: 'md',
      data: { supplier: this.data.supplier, outstanding: this.st()?.outstanding ?? this.data.supplier.outstanding },
    });
    if (ok) {
      this.changed = true;
      await this.load();
    }
  }

  protected async undo(p: SupplierPayment): Promise<void> {
    const ok = await this.dialogs.confirmDelete({
      title: this.i18n.t('Undo this payment?', 'Rudisha malipo haya?'),
      message: this.i18n.t(
        'The payment is removed from the statement and its ledger entry is reversed.',
        'Malipo yataondolewa kwenye taarifa na ingizo lake la leja litageuzwa.',
      ),
      confirmText: this.i18n.t('Undo payment', 'Rudisha'),
    });
    if (!ok) return;
    try {
      await this.api.deletePayment(p.uid);
      this.toast.success(this.i18n.t('Payment undone', 'Malipo yamerudishwa'));
      this.changed = true;
      await this.load();
    } catch (e) {
      this.toast.error(ApiError.from(e).message);
    }
  }
}
