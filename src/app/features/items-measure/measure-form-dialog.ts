import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';

import { ApiError } from '@core/api/api.types';
import { LanguageService } from '@core/i18n/language.service';
import { LsmsValidators } from '@shared/forms/validators';
import { Button, DialogService, DialogShell, Icon, TextField, ToastService } from '@shared/ui';
import { ABBREVIATION_MAX, MeasureRef } from '../products/products.models';
import { MeasuresService } from './measures.service';

export interface MeasureFormData {
  measure?: MeasureRef;
  existing: readonly MeasureRef[];
  /** Products using the measure being edited (null when unknown). */
  usedBy?: number | null;
}

const key = (v: string | null | undefined) => (v ?? '').trim().replace(/\s+/g, ' ').toLowerCase();
/** Same-measure key as the backend: case and spaces do not count. */
const same = (m: { packageType: string; unitType: string; abbreviation: string | null }) =>
  `${key(m.packageType)}|${key(m.unitType).replace(/ /g, '')}|${key(m.abbreviation).replace(/ /g, '')}`;

/**
 * Create / edit a measure (package type, unit, abbreviation, description) with
 * quick-pick package types and a duplicate check. Better than Flutter: all three
 * label fields can be edited, the abbreviation is held to the 5 characters the
 * database stores, and editing a measure that products use warns how many labels
 * will change before it saves.
 */
@Component({
  selector: 'app-measure-form-dialog',
  imports: [ReactiveFormsModule, DialogShell, TextField, Button, Icon],
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
            [required]="true"
            [maxLength]="abbrMax"
            [hint]="abbrHint()"
          />
          <lsms-text-field
            formControlName="description"
            [label]="i18n.t('Description', 'Maelezo')"
            prefixIcon="notes"
            [placeholder]="i18n.t('Optional', 'Si lazima')"
            [maxLength]="255"
          />
        </div>
        @if (affects()) {
          <p class="warn">
            <lsms-icon name="warning" [size]="17" />
            {{ i18n.t('Used by ' + affects() + ' product(s): their names and labels change everywhere the moment you save.', 'Kinatumiwa na bidhaa ' + affects() + ': majina na lebo zake zitabadilika kila mahali mara utakapohifadhi.') }}
          </p>
        }
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
    .warn { display: flex; align-items: center; gap: 8px; margin: 6px 0 0; padding: 10px 12px; border-radius: 12px; font-size: 0.82rem; color: var(--c-warning); background: color-mix(in srgb, var(--c-warning) 8%, var(--c-surface)); border: 1px solid color-mix(in srgb, var(--c-warning) 28%, var(--c-border)); }
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
  private readonly dialogs = inject(DialogService);

  protected readonly busy = signal(false);
  protected readonly abbrMax = ABBREVIATION_MAX;
  private readonly m = this.data.measure;

  protected readonly form = inject(FormBuilder).nonNullable.group({
    packageType: [this.m?.packageType ?? '', [LsmsValidators.required('Package type'), LsmsValidators.minLength(2, 'Package type'), LsmsValidators.maxLength(50, 'Package type')]],
    unitType: [this.m?.unitType ?? '', [LsmsValidators.required('Unit'), LsmsValidators.maxLength(30, 'Unit')]],
    abbreviation: [this.m?.abbreviation ?? '', [LsmsValidators.required('Abbreviation'), LsmsValidators.maxLength(ABBREVIATION_MAX, 'Abbreviation')]],
    description: [this.m?.description ?? '', [LsmsValidators.maxLength(255, 'Description')]],
  });

  private readonly value = toSignal(this.form.valueChanges, { initialValue: this.form.getRawValue() });
  protected readonly pkg = computed(() => (this.value().packageType ?? '').trim());
  protected readonly unit = computed(() => (this.value().unitType ?? '').trim());
  /** Stored lower-case with no spaces, like the backend saves it. */
  protected readonly abbr = computed(() => (this.value().abbreviation ?? '').replace(/\s+/g, '').toLowerCase());

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
    const mine = same({ packageType: this.pkg(), unitType: this.unit(), abbreviation: this.abbr() });
    if (this.others.some((x) => same(x) === mine)) return this.i18n.t('This measure already exists', 'Kipimo hiki tayari kipo');
    return '';
  });

  protected readonly abbrHint = computed(() => {
    const sample = `12 pcs/${this.abbr() || 'ctn'}`;
    return this.i18n.t(`Up to ${ABBREVIATION_MAX} letters — shown as "${sample}"`, `Herufi zisizozidi ${ABBREVIATION_MAX} — huonekana kama "${sample}"`);
  });

  /** The fields that end up on product labels differ from what is stored. */
  private readonly labelChanged = computed(
    () => !!this.m && (this.pkg() !== this.m.packageType || this.unit() !== this.m.unitType || this.abbr() !== (this.m.abbreviation ?? '')),
  );

  protected readonly unchanged = computed(() => !!this.m && !this.labelChanged() && (this.value().description ?? '').trim() === (this.m.description ?? ''));

  /** Products whose label this save changes (0 = nothing to warn about). */
  protected readonly affects = computed(() => (this.labelChanged() ? (this.data.usedBy ?? 0) : 0));

  protected async save(): Promise<void> {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.problem() || this.busy()) return;
    const n = this.affects();
    if (n > 0) {
      const ok = await this.dialogs.confirm({
        title: this.i18n.t(`Used by ${n} product(s)`, `Kinatumiwa na bidhaa ${n}`),
        message: this.i18n.t(
          `"${this.m!.packageType} · ${this.m!.unitType} (${this.m!.abbreviation ?? '—'})" becomes "${this.pkg()} · ${this.unit()} (${this.abbr()})". The names and labels of those ${n} product(s) change on every screen, receipt and report. The change is recorded in the audit log.`,
          `"${this.m!.packageType} · ${this.m!.unitType} (${this.m!.abbreviation ?? '—'})" kitakuwa "${this.pkg()} · ${this.unit()} (${this.abbr()})". Majina na lebo za bidhaa hizo ${n} zitabadilika kwenye kila skrini, risiti na ripoti. Mabadiliko yanahifadhiwa kwenye kumbukumbu.`,
        ),
        confirmText: this.i18n.t('Save changes', 'Hifadhi mabadiliko'),
      });
      if (!ok) return;
    }
    this.busy.set(true);
    try {
      const v = this.form.getRawValue();
      const body = {
        packageType: v.packageType.trim(),
        unitType: v.unitType.trim(),
        abbreviation: this.abbr(),
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
