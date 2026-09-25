import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';

import { ApiError } from '@core/api/api.types';
import { LanguageService } from '@core/i18n/language.service';
import { LsmsValidators } from '@shared/forms/validators';
import { Button, DialogShell, TextField, ToastService } from '@shared/ui';
import { CategoriesService } from './categories.service';
import { Category, DESCRIPTION_MAX, NAME_MAX, categoryColor, categoryInitials, nameKey } from './categories.models';

export interface CategoryFormData {
  category?: Category;
  /** Existing categories, for the duplicate-name check. */
  existing: readonly Category[];
}

/** Create / edit a category — port of Flutter `_showCategoryDialog`, plus live duplicate check and preview. */
@Component({
  selector: 'app-category-form-dialog',
  imports: [ReactiveFormsModule, DialogShell, TextField, Button],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <lsms-dialog
      [title]="data.category ? i18n.t('Edit category', 'Hariri kategoria') : i18n.t('New category', 'Kategoria mpya')"
      [icon]="data.category ? 'edit' : 'new_label'"
    >
      <div class="preview" [style.--cat]="color()">
        <span class="badge">{{ initials() }}</span>
        <span class="txt">
          <strong>{{ name().trim() || i18n.t('Category name', 'Jina la kategoria') }}</strong>
          <small>{{ description().trim() || i18n.t('No description', 'Hakuna maelezo') }}</small>
        </span>
      </div>

      <form id="category-form" [formGroup]="form" (ngSubmit)="save()" novalidate>
        <lsms-text-field
          formControlName="categoryName"
          [label]="i18n.t('Category name', 'Jina la kategoria')"
          prefixIcon="category"
          [placeholder]="i18n.t('e.g. Soft drinks', 'mf. Vinywaji baridi')"
          [required]="true"
          [maxLength]="nameMax"
          [autofocus]="true"
          [errorText]="duplicate() ? i18n.t('A category with this name already exists', 'Kategoria yenye jina hili tayari ipo') : undefined"
        />
        <lsms-text-field
          formControlName="description"
          type="textarea"
          [rows]="3"
          [label]="i18n.t('Description', 'Maelezo')"
          [maxLength]="descriptionMax"
          [placeholder]="i18n.t('What goes in this category? (optional)', 'Bidhaa za aina gani ziko hapa? (si lazima)')"
        />
      </form>
      <ng-container dialogActions>
        <button lsmsButton="secondary" type="button" (click)="ref.close()">{{ i18n.t('Cancel', 'Ghairi') }}</button>
        <button lsmsButton type="submit" form="category-form" icon="save" [loading]="busy()" [disabled]="duplicate() || unchanged()">
          {{ data.category ? i18n.t('Save changes', 'Hifadhi mabadiliko') : i18n.t('Create category', 'Unda kategoria') }}
        </button>
      </ng-container>
    </lsms-dialog>
  `,
  styles: `
    .preview {
      display: flex; align-items: center; gap: 12px; margin-bottom: 18px; padding: 12px 14px; border-radius: 14px;
      background: color-mix(in srgb, var(--cat) 7%, var(--c-bg)); border: 1px dashed color-mix(in srgb, var(--cat) 35%, transparent);
    }
    .badge {
      display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; width: 42px; height: 42px;
      border-radius: 12px; color: #fff; font-weight: 800; font-size: 0.85rem; background: var(--cat);
      transition: background 0.2s;
    }
    .txt { display: flex; flex-direction: column; min-width: 0; }
    .txt strong { font-size: 0.95rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .txt small { color: var(--c-text-2); font-size: 0.78rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    form { display: flex; flex-direction: column; gap: 4px; }
  `,
})
export class CategoryFormDialog {
  protected readonly data = inject<CategoryFormData>(DIALOG_DATA);
  protected readonly ref = inject<DialogRef<Category | true>>(DialogRef);
  protected readonly i18n = inject(LanguageService);
  private readonly api = inject(CategoriesService);
  private readonly toast = inject(ToastService);

  protected readonly nameMax = NAME_MAX;
  protected readonly descriptionMax = DESCRIPTION_MAX;
  protected readonly busy = signal(false);

  protected readonly form = inject(FormBuilder).nonNullable.group({
    categoryName: [
      this.data.category?.categoryName ?? '',
      [LsmsValidators.required('Category name'), LsmsValidators.minLength(2, 'Category name'), LsmsValidators.maxLength(NAME_MAX, 'Category name')],
    ],
    description: [this.data.category?.description ?? '', [LsmsValidators.maxLength(DESCRIPTION_MAX, 'Description')]],
  });

  private readonly value = toSignal(this.form.valueChanges, { initialValue: this.form.getRawValue() });
  protected readonly name = computed(() => this.value().categoryName ?? '');
  protected readonly description = computed(() => this.value().description ?? '');
  protected readonly color = computed(() => categoryColor(this.name() || '?'));
  protected readonly initials = computed(() => categoryInitials(this.name() || '?'));

  private readonly takenNames = new Set(
    this.data.existing.filter((c) => c.uid !== this.data.category?.uid).map((c) => nameKey(c.categoryName)),
  );
  protected readonly duplicate = computed(() => !!this.name().trim() && this.takenNames.has(nameKey(this.name())));
  protected readonly unchanged = computed(() => {
    const c = this.data.category;
    return !!c && this.name().trim() === c.categoryName && this.description().trim() === (c.description ?? '');
  });

  protected async save(): Promise<void> {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.duplicate() || this.busy()) return;
    this.busy.set(true);
    try {
      const { categoryName, description } = this.form.getRawValue();
      const body = { categoryName: categoryName.trim().replace(/\s+/g, ' '), description: description.trim() || null };
      const res = this.data.category ? await this.api.update(this.data.category.uid, body) : await this.api.create(body);
      this.toast.success(
        this.data.category
          ? this.i18n.t(`${body.categoryName} updated`, `${body.categoryName} imesasishwa`)
          : this.i18n.t(`${body.categoryName} created`, `${body.categoryName} imeundwa`),
      );
      this.ref.close(res.category ?? true);
    } catch (e) {
      this.toast.error(ApiError.from(e).message);
    } finally {
      this.busy.set(false);
    }
  }
}
