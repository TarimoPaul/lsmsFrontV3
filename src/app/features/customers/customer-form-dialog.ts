import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';

import { ApiError } from '@core/api/api.types';
import { LanguageService } from '@core/i18n/language.service';
import { LsmsValidators } from '@shared/forms/validators';
import { Button, DialogShell, Icon, TextField, ToastService } from '@shared/ui';
import { CUSTOMER_TYPES, Customer, CustomerType, phoneKey } from './customers.models';
import { CustomersService } from './customers.service';

export interface CustomerFormData {
  customer?: Customer;
  existing: readonly Customer[];
}

/**
 * Create / edit a customer — port of Flutter `DynamicCustomerForm` (name,
 * phone, email, address, type, credit limit) with a live duplicate-phone
 * check: the backend silently returns the existing customer on create.
 */
@Component({
  selector: 'app-customer-form-dialog',
  imports: [ReactiveFormsModule, DialogShell, TextField, Button, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <lsms-dialog [title]="data.customer ? i18n.t('Edit customer', 'Hariri mteja') : i18n.t('New customer', 'Mteja mpya')" [icon]="data.customer ? 'edit' : 'person_add'">
      <form id="customer-form" [formGroup]="form" (ngSubmit)="save()" novalidate>
        <div class="grid">
          <lsms-text-field
            class="span2"
            formControlName="name"
            [label]="i18n.t('Full name', 'Jina kamili')"
            prefixIcon="person"
            [required]="true"
            [maxLength]="100"
            [autofocus]="!data.customer"
          />
          <lsms-text-field
            formControlName="phoneNumber"
            type="tel"
            [label]="i18n.t('Phone', 'Simu')"
            prefixIcon="call"
            placeholder="07xx xxx xxx"
            [errorText]="phoneOwner() ? i18n.t('Already used by ' + phoneOwner()!.name, 'Tayari inatumiwa na ' + phoneOwner()!.name) : undefined"
          />
          <lsms-text-field formControlName="email" type="email" [label]="i18n.t('Email', 'Barua pepe')" prefixIcon="mail" />
          <lsms-text-field class="span2" formControlName="address" [label]="i18n.t('Address', 'Anwani')" prefixIcon="location_on" [maxLength]="200" />
        </div>

        <span class="lbl">{{ i18n.t('Customer type', 'Aina ya mteja') }}</span>
        <div class="types" role="radiogroup">
          @for (t of types; track t) {
            <button type="button" role="radio" class="type" [class.on]="value().customerType === t" [attr.aria-checked]="value().customerType === t" [style.--t]="meta[t].color" (click)="form.controls.customerType.setValue(t)">
              <lsms-icon [name]="meta[t].icon" [size]="16" />{{ meta[t][i18n.lang()] }}
            </button>
          }
        </div>

        <lsms-text-field
          formControlName="creditLimit"
          type="currency"
          [label]="i18n.t('Credit limit', 'Ukomo wa mkopo')"
          [hint]="i18n.t('Maximum debt allowed — leave empty for no limit', 'Deni la juu linaloruhusiwa — acha wazi kama hakuna')"
        />
      </form>
      <ng-container dialogActions>
        <button lsmsButton="secondary" type="button" (click)="ref.close()">{{ i18n.t('Cancel', 'Ghairi') }}</button>
        <button lsmsButton type="submit" form="customer-form" icon="save" [loading]="busy()" [disabled]="!!phoneOwner()">
          {{ data.customer ? i18n.t('Save changes', 'Hifadhi mabadiliko') : i18n.t('Add customer', 'Ongeza mteja') }}
        </button>
      </ng-container>
    </lsms-dialog>
  `,
  styles: `
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 14px; }
    .span2 { grid-column: 1 / -1; }
    @media (max-width: 600px) { .grid { grid-template-columns: 1fr; } }
    .lbl { display: block; margin: 2px 0 6px; font-size: 0.8rem; font-weight: 600; color: var(--c-text-2); }
    .types { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 14px; }
    .type {
      --t: var(--c-text-2);
      display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px; border-radius: 100px; cursor: pointer;
      font: inherit; font-size: 0.8rem; font-weight: 600; color: var(--c-text-2); background: var(--c-surface); border: 1px solid var(--c-border);
      &.on { color: var(--t); border-color: var(--t); background: color-mix(in srgb, var(--t) 10%, transparent); }
    }
  `,
})
export class CustomerFormDialog {
  protected readonly data = inject<CustomerFormData>(DIALOG_DATA);
  protected readonly ref = inject<DialogRef<boolean>>(DialogRef);
  protected readonly i18n = inject(LanguageService);
  private readonly api = inject(CustomersService);
  private readonly toast = inject(ToastService);

  protected readonly types = Object.keys(CUSTOMER_TYPES) as CustomerType[];
  protected readonly meta = CUSTOMER_TYPES;
  protected readonly busy = signal(false);
  private readonly c = this.data.customer;

  protected readonly form = inject(FormBuilder).group({
    name: [this.c?.name ?? '', [LsmsValidators.required('Name'), LsmsValidators.minLength(2, 'Name'), LsmsValidators.maxLength(100, 'Name')]],
    phoneNumber: [this.c?.phoneNumber ?? '', [LsmsValidators.phone()]],
    email: [this.c?.email ?? '', [LsmsValidators.email()]],
    address: [this.c?.address ?? ''],
    customerType: [(this.c?.customerType ?? 'REGULAR') as CustomerType],
    creditLimit: [this.c?.creditLimit ?? (null as number | null), [LsmsValidators.currency('Credit limit', 0)]],
  });
  protected readonly value = toSignal(this.form.valueChanges, { initialValue: this.form.getRawValue() });

  private readonly byPhone = new Map(
    this.data.existing.filter((x) => x.uid !== this.c?.uid && x.phoneNumber).map((x) => [phoneKey(x.phoneNumber), x] as const),
  );
  protected readonly phoneOwner = computed(() => this.byPhone.get(phoneKey(this.value().phoneNumber)) ?? null);

  protected async save(): Promise<void> {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.phoneOwner() || this.busy()) return;
    this.busy.set(true);
    try {
      const v = this.form.getRawValue();
      const body = {
        name: (v.name ?? '').trim().replace(/\s+/g, ' '),
        phoneNumber: v.phoneNumber?.replaceAll(' ', '').trim() || null,
        email: v.email?.trim() || null,
        address: v.address?.trim() || null,
        customerType: v.customerType ?? 'REGULAR',
        creditLimit: v.creditLimit ?? null,
      };
      if (this.c) {
        await this.api.update(this.c.uid, body);
        this.toast.success(this.i18n.t(`${body.name} updated`, `${body.name} amesasishwa`));
      } else {
        const { customer, existed } = await this.api.create(body);
        if (existed) this.toast.info(this.i18n.t(`${customer.name} already exists with this phone`, `${customer.name} tayari yupo kwa simu hii`));
        else this.toast.success(this.i18n.t(`${customer.name} added`, `${customer.name} ameongezwa`));
      }
      this.ref.close(true);
    } catch (e) {
      this.toast.error(ApiError.from(e).message);
    } finally {
      this.busy.set(false);
    }
  }
}
