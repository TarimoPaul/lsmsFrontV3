import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';

import { ApiError } from '@core/api/api.types';
import { LanguageService } from '@core/i18n/language.service';
import { LsmsValidators } from '@shared/forms/validators';
import { Button, DialogShell, Icon, SelectField, SelectOption, TextField, ToastService } from '@shared/ui';
import { toLocalDateTime } from '@shared/utils/date-utils';
import { MoneyPipe } from '@shared/utils/money';
import { PAYMENT_METHODS, PaymentMethod, Supplier } from './suppliers.models';
import { SuppliersService } from './suppliers.service';

export interface SupplierPaymentData {
  supplier: Supplier;
  /** Amount currently owed (from the statement when available). */
  outstanding: number;
}

/**
 * Record a supplier payment — port of Flutter `showSupplierPaymentForm`
 * (amount pre-filled with the balance, method, provider, reference, notes)
 * with quick amounts and an over-payment guard (the server does not check).
 */
@Component({
  selector: 'app-supplier-payment-dialog',
  imports: [ReactiveFormsModule, DialogShell, TextField, SelectField, Button, Icon, MoneyPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <lsms-dialog [title]="i18n.t('Pay ' + data.supplier.name, 'Lipa ' + data.supplier.name)" icon="payments">
      <div class="owed" [class.zero]="data.outstanding <= 0">
        <span>{{ i18n.t('Currently owed', 'Deni la sasa') }}</span>
        <b>{{ data.outstanding | money }}</b>
      </div>
      <form id="pay-form" [formGroup]="form" (ngSubmit)="save()" novalidate>
        <lsms-text-field formControlName="amount" type="currency" [label]="i18n.t('Amount', 'Kiasi')" [required]="true" [autofocus]="true" />
        @if (data.outstanding > 0) {
          <div class="quick">
            <button type="button" (click)="setAmount(data.outstanding)">{{ i18n.t('Full', 'Yote') }}</button>
            <button type="button" (click)="setAmount(half())">½</button>
          </div>
        }
        <div class="grid">
          <lsms-select-field formControlName="paymentMethod" [label]="i18n.t('Method', 'Njia')" prefixIcon="account_balance_wallet" [options]="methodOptions()" />
          @if (value().paymentMethod !== 'CASH') {
            <lsms-text-field formControlName="paymentProvider" [label]="i18n.t('Provider', 'Mtoa huduma')" [placeholder]="value().paymentMethod === 'BANK_TRANSFER' ? 'CRDB, NMB…' : 'M-Pesa, Tigo Pesa…'" />
          }
          <lsms-text-field formControlName="reference" [label]="i18n.t('Reference', 'Kumbukumbu')" [placeholder]="i18n.t('Receipt / transaction no.', 'Namba ya risiti / muamala')" />
        </div>
        <lsms-text-field formControlName="notes" type="textarea" [rows]="2" [label]="i18n.t('Notes', 'Maelezo')" [maxLength]="255" />
        @if (overpay() > 0) {
          <p class="warn" role="alert">
            <lsms-icon name="warning" [size]="16" [filled]="true" />
            {{ i18n.t('This is more than owed by', 'Hii inazidi deni kwa') }} <b>{{ overpay() | money }}</b> — {{ i18n.t('the supplier will hold a credit.', 'msambazaji atakuwa na salio lako.') }}
          </p>
        }
      </form>
      <ng-container dialogActions>
        <button lsmsButton="secondary" type="button" (click)="ref.close()">{{ i18n.t('Cancel', 'Ghairi') }}</button>
        <button lsmsButton type="submit" form="pay-form" icon="check" [loading]="busy()">
          {{ i18n.t('Record payment', 'Hifadhi malipo') }}
        </button>
      </ng-container>
    </lsms-dialog>
  `,
  styles: `
    .owed {
      display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 14px; padding: 12px 14px; border-radius: 12px;
      color: var(--c-error); background: color-mix(in srgb, var(--c-error) 7%, var(--c-bg)); border: 1px solid color-mix(in srgb, var(--c-error) 25%, transparent);
      span { font-size: 0.8rem; color: var(--c-text-2); }
      b { font-size: 1.2rem; font-weight: 800; }
      &.zero { color: var(--c-success); background: color-mix(in srgb, var(--c-success) 7%, var(--c-bg)); border-color: color-mix(in srgb, var(--c-success) 25%, transparent); }
    }
    .quick { display: flex; gap: 6px; margin: -6px 0 8px; }
    .quick button {
      padding: 2px 12px; border-radius: 100px; border: 1px solid var(--c-border); background: var(--c-surface); cursor: pointer;
      font: inherit; font-size: 0.74rem; font-weight: 700; color: var(--c-primary);
    }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 14px; }
    @media (max-width: 600px) { .grid { grid-template-columns: 1fr; } }
    .warn { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; font-size: 0.8rem; color: var(--c-warning); }
  `,
})
export class SupplierPaymentDialog {
  protected readonly data = inject<SupplierPaymentData>(DIALOG_DATA);
  protected readonly ref = inject<DialogRef<boolean>>(DialogRef);
  protected readonly i18n = inject(LanguageService);
  private readonly api = inject(SuppliersService);
  private readonly toast = inject(ToastService);

  protected readonly busy = signal(false);
  protected readonly form = inject(FormBuilder).group({
    amount: [this.data.outstanding > 0 ? this.data.outstanding : (null as number | null), [LsmsValidators.required('Amount'), LsmsValidators.positive('Amount')]],
    paymentMethod: ['CASH' as PaymentMethod],
    paymentProvider: [''],
    reference: [''],
    notes: [''],
  });
  protected readonly value = toSignal(this.form.valueChanges, { initialValue: this.form.getRawValue() });

  protected readonly methodOptions = computed<SelectOption<PaymentMethod>[]>(() =>
    (Object.keys(PAYMENT_METHODS) as PaymentMethod[]).map((k) => ({ value: k, label: PAYMENT_METHODS[k][this.i18n.lang()] })),
  );
  protected readonly half = computed(() => Math.round(this.data.outstanding / 2));
  protected readonly overpay = computed(() => {
    const a = Number(this.value().amount ?? 0);
    return this.data.outstanding >= 0 && a > this.data.outstanding ? a - Math.max(0, this.data.outstanding) : 0;
  });

  protected setAmount(v: number): void {
    this.form.controls.amount.setValue(v);
  }

  protected async save(): Promise<void> {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.busy()) return;
    this.busy.set(true);
    try {
      const v = this.form.getRawValue();
      await this.api.recordPayment({
        supplierUid: this.data.supplier.uid,
        amount: Number(v.amount),
        paymentMethod: v.paymentMethod ?? 'CASH',
        paymentProvider: v.paymentMethod !== 'CASH' ? v.paymentProvider?.trim() || null : null,
        paymentDate: toLocalDateTime(),
        reference: v.reference?.trim() || null,
        notes: v.notes?.trim() || null,
      });
      this.toast.success(this.i18n.t('Payment recorded', 'Malipo yamehifadhiwa'));
      this.ref.close(true);
    } catch (e) {
      this.toast.error(ApiError.from(e).message);
    } finally {
      this.busy.set(false);
    }
  }
}
