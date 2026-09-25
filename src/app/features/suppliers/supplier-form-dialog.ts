import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';

import { ApiError } from '@core/api/api.types';
import { LanguageService } from '@core/i18n/language.service';
import { LsmsValidators } from '@shared/forms/validators';
import { Button, DialogShell, Icon, TextField, ToastService } from '@shared/ui';
import { Supplier, SupplierRequest } from './suppliers.models';
import { SuppliersService } from './suppliers.service';

export interface SupplierFormData {
  supplier?: Supplier;
  existing: readonly Supplier[];
}

const TERMS = [7, 14, 30, 60];

/** Create / edit a supplier — port of Flutter `_SupplierFormDialog` with validation, duplicate check and term presets. */
@Component({
  selector: 'app-supplier-form-dialog',
  imports: [ReactiveFormsModule, DialogShell, TextField, Button, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <lsms-dialog [title]="data.supplier ? i18n.t('Edit supplier', 'Hariri msambazaji') : i18n.t('New supplier', 'Msambazaji mpya')" [icon]="data.supplier ? 'edit' : 'local_shipping'">
      <form id="supplier-form" [formGroup]="form" (ngSubmit)="save()" novalidate>
        <div class="grid">
          <lsms-text-field
            class="span2"
            formControlName="name"
            [label]="i18n.t('Supplier name', 'Jina la msambazaji')"
            prefixIcon="storefront"
            [required]="true"
            [maxLength]="120"
            [autofocus]="!data.supplier"
            [errorText]="duplicate() ? i18n.t('A supplier with this name already exists', 'Msambazaji mwenye jina hili tayari yupo') : undefined"
          />
          <lsms-text-field formControlName="phone" type="tel" [label]="i18n.t('Phone', 'Simu')" prefixIcon="call" placeholder="07xx xxx xxx" />
          <lsms-text-field formControlName="email" type="email" [label]="i18n.t('Email', 'Barua pepe')" prefixIcon="mail" />
          <lsms-text-field formControlName="tin" label="TIN" prefixIcon="badge" [maxLength]="30" />
          <lsms-text-field formControlName="address" [label]="i18n.t('Address', 'Anwani')" prefixIcon="location_on" [maxLength]="200" />
          <div>
            <lsms-text-field
              formControlName="paymentTermsDays"
              type="number"
              [label]="i18n.t('Payment terms (days)', 'Muda wa kulipa (siku)')"
              prefixIcon="event"
              [hint]="i18n.t('Invoices fall due after this many days', 'Ankara zinadaiwa baada ya siku hizi')"
            />
            <div class="terms">
              @for (t of terms; track t) {
                <button type="button" class="term" [class.on]="termValue() === t" (click)="form.controls.paymentTermsDays.setValue(t)">{{ t }}d</button>
              }
            </div>
          </div>
          <lsms-text-field
            formControlName="creditLimit"
            type="currency"
            [label]="i18n.t('Credit limit', 'Ukomo wa mkopo')"
            [hint]="i18n.t('Optional — warns when owed exceeds it', 'Si lazima — huonya deni likizidi')"
          />
          <lsms-text-field class="span2" formControlName="notes" type="textarea" [rows]="2" [label]="i18n.t('Notes', 'Maelezo')" [maxLength]="500" />
        </div>
        @if (data.supplier && data.supplier.outstanding > 0) {
          <p class="owed"><lsms-icon name="info" [size]="16" />{{ i18n.t('Currently owed', 'Deni la sasa') }}: <b>TZS {{ data.supplier.outstanding.toLocaleString('en-US') }}</b></p>
        }
      </form>
      <ng-container dialogActions>
        <button lsmsButton="secondary" type="button" (click)="ref.close()">{{ i18n.t('Cancel', 'Ghairi') }}</button>
        <button lsmsButton type="submit" form="supplier-form" icon="save" [loading]="busy()" [disabled]="duplicate()">
          {{ data.supplier ? i18n.t('Save changes', 'Hifadhi mabadiliko') : i18n.t('Add supplier', 'Ongeza msambazaji') }}
        </button>
      </ng-container>
    </lsms-dialog>
  `,
  styles: `
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 14px; }
    .span2 { grid-column: 1 / -1; }
    @media (max-width: 600px) { .grid { grid-template-columns: 1fr; } }
    .terms { display: flex; gap: 4px; margin: -4px 0 8px; }
    .term {
      padding: 2px 10px; border-radius: 100px; border: 1px solid var(--c-border); background: var(--c-surface);
      font: inherit; font-size: 0.72rem; font-weight: 700; color: var(--c-text-2); cursor: pointer;
      &.on, &:hover { color: var(--c-primary); border-color: var(--c-primary); background: color-mix(in srgb, var(--c-primary) 8%, transparent); }
    }
    .owed { display: flex; align-items: center; gap: 6px; margin-top: 4px; font-size: 0.82rem; color: var(--c-warning); }
  `,
})
export class SupplierFormDialog {
  protected readonly data = inject<SupplierFormData>(DIALOG_DATA);
  protected readonly ref = inject<DialogRef<boolean>>(DialogRef);
  protected readonly i18n = inject(LanguageService);
  private readonly api = inject(SuppliersService);
  private readonly toast = inject(ToastService);

  protected readonly terms = TERMS;
  protected readonly busy = signal(false);
  private readonly s = this.data.supplier;

  protected readonly form = inject(FormBuilder).group({
    name: [this.s?.name ?? '', [LsmsValidators.required('Supplier name'), LsmsValidators.minLength(2, 'Supplier name'), LsmsValidators.maxLength(120, 'Supplier name')]],
    phone: [this.s?.phone ?? '', [LsmsValidators.phone()]],
    email: [this.s?.email ?? '', [LsmsValidators.email()]],
    tin: [this.s?.tin ?? ''],
    address: [this.s?.address ?? ''],
    paymentTermsDays: [this.s?.paymentTermsDays ?? (30 as number | null), [LsmsValidators.integer('Payment terms', 1), LsmsValidators.numeric('Payment terms', 1, 365)]],
    creditLimit: [this.s?.creditLimit ?? (null as number | null), [LsmsValidators.currency('Credit limit', 0)]],
    notes: [this.s?.notes ?? ''],
  });

  private readonly value = toSignal(this.form.valueChanges, { initialValue: this.form.getRawValue() });
  protected readonly termValue = computed(() => Number(this.value().paymentTermsDays));
  private readonly taken = new Set(this.data.existing.filter((x) => x.uid !== this.s?.uid).map((x) => x.name.trim().toLowerCase()));
  protected readonly duplicate = computed(() => {
    const n = (this.value().name ?? '').trim().toLowerCase();
    return !!n && this.taken.has(n);
  });

  protected async save(): Promise<void> {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.duplicate() || this.busy()) return;
    this.busy.set(true);
    try {
      const v = this.form.getRawValue();
      const body: SupplierRequest = {
        name: (v.name ?? '').trim().replace(/\s+/g, ' '),
        phone: v.phone?.replaceAll(' ', '').trim() || null,
        email: v.email?.trim() || null,
        tin: v.tin?.trim() || null,
        address: v.address?.trim() || null,
        paymentTermsDays: Number(v.paymentTermsDays) || 30,
        creditLimit: v.creditLimit ?? null,
        notes: v.notes?.trim() || null,
      };
      if (this.s) await this.api.update(this.s.uid, body, this.s.outstanding);
      else await this.api.create(body);
      this.toast.success(this.s ? this.i18n.t(`${body.name} updated`, `${body.name} amesasishwa`) : this.i18n.t(`${body.name} added`, `${body.name} ameongezwa`));
      this.ref.close(true);
    } catch (e) {
      this.toast.error(ApiError.from(e).message);
    } finally {
      this.busy.set(false);
    }
  }
}
