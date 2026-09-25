import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';

import { ApiError } from '@core/api/api.types';
import { LanguageService } from '@core/i18n/language.service';
import { LsmsValidators } from '@shared/forms/validators';
import { Button, DialogShell, Icon, TextField, ToastService } from '@shared/ui';
import { MoneyPipe } from '@shared/utils/money';
import { PAYMENT_METHODS, Sale, methodLabel } from './sales.models';
import { SalesService } from './sales.service';

export interface SalePaymentData {
  sale: Sale;
}

/**
 * Receive money against a sale's balance — port of Flutter's "Ongeza malipo"
 * dialog (`makeAdditionalPayment`). Closes with the refreshed sale.
 */
@Component({
  selector: 'app-sale-payment-dialog',
  imports: [ReactiveFormsModule, DialogShell, TextField, Button, Icon, MoneyPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <lsms-dialog [title]="i18n.t('Receive payment', 'Pokea malipo')" icon="payments">
      <form id="sale-pay-form" [formGroup]="form" (ngSubmit)="save()" novalidate>
        <div class="due">
          <span>
            <small>{{ i18n.t('Receipt', 'Risiti') }} {{ data.sale.receiptNumber }}</small>
            <b>{{ data.sale.customerName || i18n.t('Walk-in customer', 'Mteja wa kawaida') }}</b>
          </span>
          <span class="amt"><small>{{ i18n.t('Balance due', 'Deni lililobaki') }}</small><b>{{ data.sale.balance | money }}</b></span>
        </div>

        <lsms-text-field formControlName="amount" type="currency" [label]="i18n.t('Amount received', 'Kiasi kilichopokelewa')" [required]="true" [autofocus]="true" />
        <div class="quick">
          <button type="button" (click)="setAmount(data.sale.balance)">{{ i18n.t('Full balance', 'Deni lote') }}</button>
          @if (data.sale.balance >= 2000) {
            <button type="button" (click)="setAmount(half())">{{ i18n.t('Half', 'Nusu') }} · {{ half() | money: { symbol: false } }}</button>
          }
        </div>

        <span class="lbl">{{ i18n.t('Paid with', 'Njia ya malipo') }}</span>
        <div class="methods" role="radiogroup">
          @for (m of methods(); track m) {
            <button type="button" role="radio" [attr.aria-checked]="method() === m" [class.on]="method() === m" (click)="method.set(m)">
              <lsms-icon [name]="icon(m)" [size]="16" />{{ label(m) }}
            </button>
          }
        </div>

        <lsms-text-field formControlName="reference" [label]="i18n.t('Transaction reference (optional)', 'Namba ya muamala (hiari)')" prefixIcon="tag" [maxLength]="60" />

        @if (after() !== null) {
          <p class="after" [class.done]="after() === 0">
            <lsms-icon [name]="after() === 0 ? 'task_alt' : 'info'" [size]="16" />
            @if (after() === 0) {
              {{ i18n.t('This clears the sale in full.', 'Hii inamaliza deni lote la mauzo haya.') }}
            } @else {
              {{ i18n.t('Still owed after this:', 'Deni litakalobaki:') }} <b>{{ after()! | money }}</b>
            }
          </p>
        }
      </form>
      <ng-container dialogActions>
        <button lsmsButton="secondary" type="button" (click)="ref.close()">{{ i18n.t('Cancel', 'Ghairi') }}</button>
        <button lsmsButton="success" type="submit" form="sale-pay-form" icon="check_circle" [loading]="busy()" [disabled]="form.invalid">{{ i18n.t('Record payment', 'Rekodi malipo') }}</button>
      </ng-container>
    </lsms-dialog>
  `,
  styles: `
    form { display: flex; flex-direction: column; gap: 10px; }
    .due { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 12px 14px; border-radius: 14px; background: var(--c-bg); border: 1px solid var(--c-border); }
    .due span { display: flex; flex-direction: column; min-width: 0; }
    .due small { font-size: 0.72rem; color: var(--c-text-2); }
    .due b { font-size: 0.92rem; }
    .due .amt { align-items: flex-end; }
    .due .amt b { font-size: 1.2rem; font-weight: 800; color: var(--c-error); font-variant-numeric: tabular-nums; }
    .quick { display: flex; gap: 6px; margin: -6px 0 2px; }
    .quick button { padding: 2px 10px; border-radius: 100px; border: 1px solid var(--c-border); background: var(--c-surface); font: inherit; font-size: 0.72rem; font-weight: 700; color: var(--c-primary); cursor: pointer; }
    .lbl { font-size: 0.8rem; font-weight: 600; color: var(--c-text-2); }
    .methods { display: flex; flex-wrap: wrap; gap: 6px; }
    .methods button { display: inline-flex; align-items: center; gap: 6px; padding: 7px 12px; border-radius: 10px; border: 1px solid var(--c-border); background: var(--c-surface); font: inherit; font-size: 0.8rem; font-weight: 600; color: var(--c-text); cursor: pointer; }
    .methods button lsms-icon { color: var(--c-text-2); }
    .methods button.on { color: #fff; background: var(--c-primary); border-color: var(--c-primary); }
    .methods button.on lsms-icon { color: #fff; }
    .after { display: flex; align-items: center; gap: 8px; padding: 10px 12px; border-radius: 12px; font-size: 0.84rem; background: color-mix(in srgb, var(--c-warning) 9%, var(--c-bg)); }
    .after.done { background: color-mix(in srgb, var(--c-success) 9%, var(--c-bg)); color: var(--c-success); font-weight: 600; }
  `,
})
export class SalePaymentDialog {
  protected readonly data = inject<SalePaymentData>(DIALOG_DATA);
  protected readonly ref = inject<DialogRef<Sale>>(DialogRef);
  protected readonly i18n = inject(LanguageService);
  private readonly api = inject(SalesService);
  private readonly toast = inject(ToastService);

  protected readonly busy = signal(false);
  protected readonly method = signal('CASH');
  protected readonly methods = computed(() => (this.api.paymentMethods.value() ?? Object.keys(PAYMENT_METHODS)).filter((m) => m !== 'CREDIT'));
  protected readonly half = computed(() => Math.round(this.data.sale.balance / 2));

  protected readonly form = inject(FormBuilder).group({
    amount: [this.data.sale.balance as number | null, [LsmsValidators.required('Amount'), LsmsValidators.positive('Amount'), LsmsValidators.currency('Amount', 0, this.data.sale.balance)]],
    reference: [''],
  });
  private readonly amount = toSignal(this.form.controls.amount.valueChanges, { initialValue: this.form.controls.amount.value });
  protected readonly after = computed(() => {
    const a = Number(this.amount()) || 0;
    if (a <= 0 || a > this.data.sale.balance + 0.01) return null;
    const left = this.data.sale.balance - a;
    return left < 0.01 ? 0 : left;
  });

  constructor() {
    void this.api.paymentMethods.load().catch(() => undefined);
  }

  protected setAmount(v: number): void {
    this.form.controls.amount.setValue(v);
  }

  protected label(m: string): string {
    return methodLabel(m, this.i18n.isSwahili());
  }

  protected icon(m: string): string {
    return PAYMENT_METHODS[m]?.icon ?? 'payments';
  }

  protected async save(): Promise<void> {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    this.busy.set(true);
    try {
      const v = this.form.getRawValue();
      const sale = await this.api.addPayment(this.data.sale.uid, Number(v.amount), this.method(), v.reference?.trim());
      this.toast.success(this.i18n.t('Payment recorded', 'Malipo yamerekodiwa'));
      this.ref.close(sale);
    } catch (e) {
      this.toast.error(ApiError.from(e).message);
    } finally {
      this.busy.set(false);
    }
  }
}
