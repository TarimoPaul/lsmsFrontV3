import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors } from '@angular/forms';

import { ApiError } from '@core/api/api.types';
import { LanguageService } from '@core/i18n/language.service';
import { LsmsValidators } from '@shared/forms/validators';
import { Button, DialogShell, Icon, TextField, ToastService } from '@shared/ui';
import { Branch, BranchRequest, DAYS } from './branches.models';
import { BranchesService } from './branches.service';

export interface BranchFormData {
  branch?: Branch;
  existing: readonly Branch[];
}

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const timeValidator = (c: AbstractControl): ValidationErrors | null =>
  !c.value || TIME.test(String(c.value).trim()) ? null : { date: { field: 'Time' } };

/**
 * Create / edit a branch with the fields the backend actually stores
 * (location, contacts, hours, working days, tax / registration numbers).
 */
@Component({
  selector: 'app-branch-form-dialog',
  imports: [ReactiveFormsModule, DialogShell, TextField, Button, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <lsms-dialog [title]="data.branch ? i18n.t('Edit branch', 'Hariri tawi') : i18n.t('New branch', 'Tawi jipya')" [icon]="data.branch ? 'edit' : 'add_business'">
      <form id="branch-form" [formGroup]="form" (ngSubmit)="save()" novalidate>
        <section class="sec">
          <h4><lsms-icon name="storefront" [size]="15" />{{ i18n.t('Branch', 'Tawi') }}</h4>
          <div class="grid">
            <lsms-text-field
              formControlName="branchName"
              [label]="i18n.t('Branch name', 'Jina la tawi')"
              prefixIcon="business"
              [required]="true"
              [maxLength]="100"
              [autofocus]="!data.branch"
              [errorText]="duplicate() ? i18n.t('A branch with this name already exists', 'Tawi lenye jina hili tayari lipo') : undefined"
            />
            <lsms-text-field
              formControlName="branchCode"
              [label]="i18n.t('Branch code', 'Msimbo wa tawi')"
              prefixIcon="tag"
              placeholder="DSM-01"
              [maxLength]="20"
              [readonly]="!!data.branch"
              [hint]="data.branch ? i18n.t('Set when the branch is created', 'Huwekwa tawi linapoundwa') : undefined"
            />
            <lsms-text-field class="span2" formControlName="description" type="textarea" [rows]="2" [label]="i18n.t('Description', 'Maelezo')" [maxLength]="255" />
          </div>
        </section>

        <section class="sec">
          <h4><lsms-icon name="location_on" [size]="15" />{{ i18n.t('Location & contact', 'Mahali na mawasiliano') }}</h4>
          <div class="grid">
            <lsms-text-field class="span2" formControlName="address" [label]="i18n.t('Street / building', 'Mtaa / jengo')" prefixIcon="home_pin" />
            <lsms-text-field formControlName="city" [label]="i18n.t('City / town', 'Mji')" />
            <lsms-text-field formControlName="region" [label]="i18n.t('Region', 'Mkoa')" />
            <lsms-text-field formControlName="phoneNumber" type="tel" [label]="i18n.t('Phone', 'Simu')" prefixIcon="call" />
            <lsms-text-field formControlName="email" type="email" [label]="i18n.t('Email', 'Barua pepe')" prefixIcon="mail" />
          </div>
        </section>

        <section class="sec">
          <h4><lsms-icon name="schedule" [size]="15" />{{ i18n.t('Opening hours', 'Saa za kazi') }}</h4>
          <div class="grid">
            <lsms-text-field formControlName="openingTime" [label]="i18n.t('Opens', 'Hufunguliwa')" prefixIcon="wb_sunny" placeholder="08:00" [maxLength]="5" />
            <lsms-text-field formControlName="closingTime" [label]="i18n.t('Closes', 'Hufungwa')" prefixIcon="bedtime" placeholder="22:00" [maxLength]="5" />
          </div>
          <div class="days" role="group" [attr.aria-label]="i18n.t('Working days', 'Siku za kazi')">
            @for (d of days; track d.code) {
              <button type="button" class="day" [class.on]="dayOn(d.code)" [attr.aria-pressed]="dayOn(d.code)" (click)="toggleDay(d.code)">{{ i18n.isSwahili() ? d.sw : d.en }}</button>
            }
          </div>
        </section>

        <section class="sec">
          <h4><lsms-icon name="gavel" [size]="15" />{{ i18n.t('Registration', 'Usajili') }}</h4>
          <div class="grid">
            <lsms-text-field formControlName="taxId" label="TIN" prefixIcon="badge" />
            <lsms-text-field formControlName="registrationNumber" [label]="i18n.t('Business licence / reg. no.', 'Leseni / namba ya usajili')" prefixIcon="description" />
          </div>
          <button type="button" class="main" [class.on]="value().isMainBranch" [disabled]="lockMain" (click)="form.controls.isMainBranch.setValue(!value().isMainBranch)">
            <lsms-icon [name]="value().isMainBranch ? 'star' : 'star_outline'" [size]="18" [filled]="!!value().isMainBranch" />
            <span>
              <b>{{ i18n.t('Main branch', 'Tawi kuu') }}</b>
              <small>{{ lockMain ? i18n.t('Make another branch main to change this', 'Fanya tawi jingine kuwa kuu kubadilisha hili') : i18n.t('Head office; it cannot be suspended or deleted', 'Makao makuu; haliwezi kusimamishwa wala kufutwa') }}</small>
            </span>
          </button>
        </section>
      </form>
      <ng-container dialogActions>
        <button lsmsButton="secondary" type="button" (click)="ref.close()">{{ i18n.t('Cancel', 'Ghairi') }}</button>
        <button lsmsButton type="submit" form="branch-form" icon="save" [loading]="busy()" [disabled]="duplicate()">
          {{ data.branch ? i18n.t('Save changes', 'Hifadhi mabadiliko') : i18n.t('Create branch', 'Unda tawi') }}
        </button>
      </ng-container>
    </lsms-dialog>
  `,
  styles: `
    form { display: flex; flex-direction: column; gap: 12px; }
    .sec { padding: 12px 14px 6px; border-radius: 14px; background: var(--c-bg); border: 1px solid var(--c-border); }
    h4 { display: flex; align-items: center; gap: 6px; margin-bottom: 8px; font-size: 0.72rem; font-weight: 800; letter-spacing: 0.8px; text-transform: uppercase; color: var(--c-text-2); lsms-icon { color: var(--c-primary); } }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0 14px; }
    .span2 { grid-column: 1 / -1; }
    @media (max-width: 600px) { .grid { grid-template-columns: 1fr; } }
    .days { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 8px; }
    .day {
      min-width: 46px; padding: 5px 10px; border-radius: 10px; cursor: pointer; font: inherit; font-size: 0.78rem; font-weight: 700;
      color: var(--c-text-2); background: var(--c-surface); border: 1px solid var(--c-border);
      &.on { color: #fff; background: var(--c-primary); border-color: var(--c-primary); }
    }
    .main {
      display: flex; align-items: center; gap: 10px; width: 100%; margin-bottom: 8px; padding: 10px 12px; border-radius: 12px; cursor: pointer; text-align: left;
      font: inherit; color: var(--c-text); background: var(--c-surface); border: 1px solid var(--c-border);
      lsms-icon { color: var(--c-text-2); }
      span { display: flex; flex-direction: column; }
      small { font-size: 0.72rem; color: var(--c-text-2); }
      &.on { border-color: #f5a623; background: color-mix(in srgb, #f5a623 8%, var(--c-surface)); lsms-icon { color: #f5a623; } }
      &:disabled { cursor: not-allowed; opacity: 0.8; }
    }
  `,
})
export class BranchFormDialog {
  protected readonly data = inject<BranchFormData>(DIALOG_DATA);
  protected readonly ref = inject<DialogRef<boolean>>(DialogRef);
  protected readonly i18n = inject(LanguageService);
  private readonly api = inject(BranchesService);
  private readonly toast = inject(ToastService);

  protected readonly days = DAYS;
  protected readonly busy = signal(false);
  private readonly b = this.data.branch;
  /** The backend never un-marks the only main branch; switch main by marking another one. */
  protected readonly lockMain = !!this.b?.isMainBranch;

  protected readonly form = inject(FormBuilder).group({
    branchName: [this.b?.branchName ?? '', [LsmsValidators.required('Branch name'), LsmsValidators.minLength(2, 'Branch name'), LsmsValidators.maxLength(100, 'Branch name')]],
    branchCode: [this.b?.branchCode ?? ''],
    description: [this.b?.description ?? ''],
    address: [this.b?.address ?? ''],
    city: [this.b?.city ?? ''],
    region: [this.b?.region ?? ''],
    phoneNumber: [this.b?.phoneNumber ?? '', [LsmsValidators.phone()]],
    email: [this.b?.email ?? '', [LsmsValidators.email()]],
    openingTime: [this.b?.openingTime ?? '', [timeValidator]],
    closingTime: [this.b?.closingTime ?? '', [timeValidator]],
    operatingDays: [this.b?.operatingDays ?? 'MON,TUE,WED,THU,FRI,SAT'],
    taxId: [this.b?.taxId ?? ''],
    registrationNumber: [this.b?.registrationNumber ?? ''],
    isMainBranch: [this.b?.isMainBranch ?? false],
  });
  protected readonly value = toSignal(this.form.valueChanges, { initialValue: this.form.getRawValue() });

  private readonly taken = new Set(this.data.existing.filter((x) => x.uid !== this.b?.uid).map((x) => x.branchName.toLowerCase()));
  protected readonly duplicate = computed(() => this.taken.has((this.value().branchName ?? '').trim().toLowerCase()));
  private readonly dayset = computed(() => new Set((this.value().operatingDays ?? '').split(',').filter(Boolean)));

  protected dayOn(code: string): boolean {
    return this.dayset().has(code);
  }

  protected toggleDay(code: string): void {
    const s = new Set(this.dayset());
    if (s.has(code)) s.delete(code);
    else s.add(code);
    this.form.controls.operatingDays.setValue(DAYS.map((d) => d.code).filter((c) => s.has(c)).join(','));
  }

  protected async save(): Promise<void> {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.duplicate() || this.busy()) return;
    this.busy.set(true);
    try {
      const v = this.form.getRawValue();
      const t = (x: string | null | undefined) => x?.trim() || null;
      const body: BranchRequest = {
        branchName: (v.branchName ?? '').trim().replace(/\s+/g, ' '),
        branchCode: t(v.branchCode),
        description: t(v.description),
        address: t(v.address),
        city: t(v.city),
        region: t(v.region),
        country: this.b?.country ?? 'Tanzania',
        phoneNumber: t(v.phoneNumber?.replaceAll(' ', '')),
        email: t(v.email),
        openingTime: t(v.openingTime),
        closingTime: t(v.closingTime),
        operatingDays: t(v.operatingDays),
        taxId: t(v.taxId),
        registrationNumber: t(v.registrationNumber),
        isMainBranch: !!v.isMainBranch,
      };
      if (this.b) await this.api.update(this.b.uid, body);
      else await this.api.create(body);
      this.toast.success(this.b ? this.i18n.t(`${body.branchName} updated`, `${body.branchName} limesasishwa`) : this.i18n.t(`${body.branchName} created`, `${body.branchName} limeundwa`));
      this.ref.close(true);
    } catch (e) {
      this.toast.error(ApiError.from(e).message);
    } finally {
      this.busy.set(false);
    }
  }
}
