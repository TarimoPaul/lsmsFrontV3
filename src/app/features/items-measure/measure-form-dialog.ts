import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';

import { ApiError } from '@core/api/api.types';
import { LanguageService } from '@core/i18n/language.service';
import { LsmsValidators } from '@shared/forms/validators';
import { Button, DialogShell, TextField, ToastService } from '@shared/ui';
import { MeasureRef } from '../products/products.models';
import { MeasuresService } from './measures.service';

export interface MeasureFormData {
  measure?: MeasureRef;
  existing: readonly MeasureRef[];
}

const key = (v: string | null | undefined) => (v ?? '').trim().replace(/\s+/g, ' ').toLowerCase();

/**
 * Create / edit a measure — port of Flutter `ItemsMeasureForm` (package type,
 * unit type, abbreviation, description) with quick-pick package types, a
 * duplicate check, and the backend's update limits made explicit.
 */
@Component({
  selector: 'app-measure-form-dialog',
  imports: [ReactiveFormsModule, DialogShell, TextField, Button],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <lsms-dialog [title]="data.measure ? i18n.t('Edit measure', 'Hariri kipimo') : i18n.t('New measure', 'Kipimo kipya')" [icon]="data.measure ? 'edit' : 'straighten'">
      <div class="preview" [class.bad]="problem()">
        <span class="unit">{{ unit() || '—' }}</span>
        <span class="txt">
          <strong>{{ pkg() || i18n.t('Package type', 'Aina ya kifungashio') }}</strong>
          <small>{{ problem() || i18n.t('Products using it show as "Name ' + (unit() || 'UNIT') + '"', 'Bidhaa zitaonekana kama "Jina ' + (unit() || 'KIPIMO') + '"') }}</small>
        </span>
        @if (abbr()) {
          <span class="abbr">{{ abbr() }}</span>
        }
      </div>

      <form id="measure-form" [formGroup]="form" (ngSubmit)="save()" novalidate>
        <div class="grid">
          <div>
            <lsms-text-field
              formControlName="packageType"
              [label]="i18n.t('Package type', 'Aina ya kifungashio')"
              prefixIcon="package_2"
              [placeholder]="i18n.t('e.g. Carton, Crate, Bottle', 'mf. Katoni, Kreti, Chupa')"
              [required]="true"
              [maxLength]="50"
              [autofocus]="!data.measure"
            />
            @if (suggestions().length) {
              <div class="picks">
                @for (s of suggestions(); track s) {
                  <button type="button" class="pick" (click)="form.controls.packageType.setValue(s)">{{ s }}</button>
                }
              </div>
            }
          </div>
          <lsms-text-field
            formControlName="unitType"
            [label]="i18n.t('Unit / size', 'Kipimo / ukubwa')"
            prefixIcon="straighten"
            [placeholder]="i18n.t('e.g. 500ML, 1KG', 'mf. 500ML, 1KG')"
            [required]="true"
            [maxLength]="30"
            [hint]="i18n.t('Appended to product names', 'Huongezwa kwenye majina ya bidhaa')"
          />
          <lsms-text-field
            formControlName="abbreviation"
            [label]="i18n.t('Abbreviation', 'Kifupisho')"
            prefixIcon="short_text"
            [placeholder]="i18n.t('e.g. ctn, crt, btl', 'mf. ctn, crt, btl')"
            [required]="!data.measure"
            [readonly]="!!data.measure"
            [maxLength]="10"
            [hint]="data.measure ? i18n.t('Cannot be changed after creation', 'Hakiwezi kubadilishwa baada ya kuundwa') : undefined"
          />
          <lsms-text-field
            formControlName="description"
            [label]="i18n.t('Description', 'Maelezo')"
            prefixIcon="notes"
            [placeholder]="i18n.t('Optional', 'Si lazima')"
            [maxLength]="255"
          />
        </div>
      </form>

      <ng-container dialogActions>
        <button lsmsButton="secondary" type="button" (click)="ref.close()">{{ i18n.t('Cancel', 'Ghairi') }}</button>
        <button lsmsButton type="submit" form="measure-form" icon="save" [loading]="busy()" [disabled]="!!problem() || unchanged()">
          {{ data.measure ? i18n.t('Save changes', 'Hifadhi mabadiliko') : i18n.t('Create measure', 'Unda kipimo') }}
        </button>
      </ng-container>
    </lsms-dialog>
  `,
  styles: `
    .preview {
      display: flex; align-items: center; gap: 12px; margin-bottom: 16px; padding: 10px 14px; border-radius: 14px;
      background: color-mix(in srgb, var(--c-info) 7%, var(--c-bg)); border: 1px dashed color-mix(in srgb, var(--c-info) 35%, transparent);
      &.bad { background: color-mix(in srgb, var(--c-error) 7%, var(--c-bg)); border-color: color-mix(in srgb, var(--c-error) 40%, transparent); small { color: var(--c-error); } }
    }
    .unit {
      display: inline-flex; align-items: center; justify-content: center; min-width: 56px; height: 44px; padding: 0 10px; border-radius: 12px;
      font-weight: 800; font-size: 0.9rem; color: #fff; background: var(--c-info);
    }
    .txt { display: flex; flex-direction: column; min-width: 0; flex: 1; }
    .txt strong { font-size: 0.95rem; }
    .txt small { font-size: 0.74rem; color: var(--c-text-2); }
    .abbr { padding: 2px 8px; border-radius: 6px; font-size: 0.74rem; font-weight: 700; background: var(--c-surface); border: 1px solid var(--c-border); }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 14px; }
    @media (max-width: 600px) { .grid { grid-template-columns: 1fr; } }
    .picks { display: flex; flex-wrap: wrap; gap: 4px; margin: -6px 0 8px; }
    .pick {
      padding: 2px 9px; border-radius: 100px; border: 1px solid var(--c-border); background: var(--c-surface);
      font: inherit; font-size: 0.72rem; font-weight: 600; color: var(--c-text-2); cursor: pointer;
      &:hover { color: var(--c-primary); border-color: var(--c-primary); }
    }
  `,
})
export class MeasureFormDialog {
  protected readonly data = inject<MeasureFormData>(DIALOG_DATA);
  protected readonly ref = inject<DialogRef<boolean>>(DialogRef);
  protected readonly i18n = inject(LanguageService);
  private readonly api = inject(MeasuresService);
  private readonly toast = inject(ToastService);

  protected readonly busy = signal(false);
  private readonly m = this.data.measure;

  protected readonly form = inject(FormBuilder).nonNullable.group({
    packageType: [this.m?.packageType ?? '', [LsmsValidators.required('Package type'), LsmsValidators.minLength(2, 'Package type'), LsmsValidators.maxLength(50, 'Package type')]],
    unitType: [this.m?.unitType ?? '', [LsmsValidators.required('Unit'), LsmsValidators.maxLength(30, 'Unit')]],
    abbreviation: [this.m?.abbreviation ?? '', this.m ? [] : [LsmsValidators.required('Abbreviation'), LsmsValidators.maxLength(10, 'Abbreviation')]],
    description: [this.m?.description ?? '', [LsmsValidators.maxLength(255, 'Description')]],
  });

  private readonly value = toSignal(this.form.valueChanges, { initialValue: this.form.getRawValue() });
  protected readonly pkg = computed(() => (this.value().packageType ?? '').trim());
  protected readonly unit = computed(() => (this.value().unitType ?? '').trim());
  protected readonly abbr = computed(() => (this.value().abbreviation ?? '').trim());

  private readonly others = this.data.existing.filter((x) => x.uid !== this.m?.uid);

  /** Package types already in use, most common first. */
  protected readonly suggestions = computed(() => {
    const counts = new Map<string, { label: string; n: number }>();
    for (const x of this.data.existing) {
      const k = key(x.packageType);
      if (!k) continue;
      const c = counts.get(k) ?? { label: x.packageType, n: 0 };
      c.n++;
      counts.set(k, c);
    }
    const typed = key(this.pkg());
    return [...counts.values()]
      .sort((a, b) => b.n - a.n)
      .map((c) => c.label)
      .filter((l) => key(l) !== typed)
      .slice(0, 6);
  });

  protected readonly problem = computed(() => {
    const pkg = key(this.pkg());
    const unit = key(this.unit());
    if (!pkg || !unit) return '';
    if (!this.m) {
      const abbr = key(this.abbr());
      if (this.others.some((x) => key(x.packageType) === pkg && key(x.unitType) === unit && key(x.abbreviation) === abbr)) {
        return this.i18n.t('This measure already exists', 'Kipimo hiki tayari kipo');
      }
      return '';
    }
    // Backend rule on update: a changed package type must not be used by any other measure.
    if (pkg !== key(this.m.packageType) && this.others.some((x) => key(x.packageType) === pkg)) {
      return this.i18n.t(
        'Another measure already uses this package type — the server cannot rename to it',
        'Kipimo kingine tayari kinatumia aina hii — seva haiwezi kubadilisha kuwa hii',
      );
    }
    return '';
  });

  protected readonly unchanged = computed(
    () =>
      !!this.m &&
      this.pkg() === this.m.packageType &&
      this.unit() === this.m.unitType &&
      (this.value().description ?? '').trim() === (this.m.description ?? ''),
  );

  protected async save(): Promise<void> {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.problem() || this.busy()) return;
    this.busy.set(true);
    try {
      const v = this.form.getRawValue();
      const body = {
        packageType: v.packageType.trim(),
        unitType: v.unitType.trim(),
        abbreviation: (this.m?.abbreviation ?? v.abbreviation).trim(),
        description: v.description.trim() || null,
      };
      if (this.m) await this.api.update(this.m.uid, body);
      else await this.api.create(body);
      const label = `${body.packageType} · ${body.unitType}`;
      this.toast.success(this.m ? this.i18n.t(`${label} updated`, `${label} kimesasishwa`) : this.i18n.t(`${label} created`, `${label} kimeundwa`));
      this.ref.close(true);
    } catch (e) {
      this.toast.error(ApiError.from(e).message);
    } finally {
      this.busy.set(false);
    }
  }
}
