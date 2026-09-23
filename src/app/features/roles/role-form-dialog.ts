import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';

import { ApiError } from '@core/api/api.types';
import { LanguageService } from '@core/i18n/language.service';
import { LsmsValidators } from '@shared/forms/validators';
import { Button, DialogShell, TextField, ToastService } from '@shared/ui';
import { Role } from './roles.models';
import { RolesService } from './roles.service';

export interface RoleFormData {
  role?: Role;
}

/** Create / edit a role (name 3–100, description 10–500 — backend RoleDto rules). */
@Component({
  selector: 'app-role-form-dialog',
  imports: [ReactiveFormsModule, DialogShell, TextField, Button],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <lsms-dialog
      [title]="data.role ? i18n.t('Edit role', 'Hariri jukumu') : i18n.t('New role', 'Jukumu jipya')"
      [icon]="data.role ? 'edit' : 'add_moderator'"
    >
      <form id="role-form" [formGroup]="form" (ngSubmit)="save()" novalidate>
        <lsms-text-field
          formControlName="name"
          [label]="i18n.t('Role name', 'Jina la jukumu')"
          prefixIcon="badge"
          placeholder="e.g. CASHIER"
          [required]="true"
          [maxLength]="100"
          [autofocus]="true"
          [hint]="i18n.t('Short, unique, e.g. CASHIER or STORE_KEEPER', 'Fupi na la kipekee, mf. CASHIER au STORE_KEEPER')"
        />
        <lsms-text-field
          formControlName="description"
          type="textarea"
          [rows]="4"
          [label]="i18n.t('Description', 'Maelezo')"
          [required]="true"
          [maxLength]="500"
          [placeholder]="i18n.t('What can people with this role do?', 'Watu wenye jukumu hili wanaweza kufanya nini?')"
        />
      </form>
      <ng-container dialogActions>
        <button lsmsButton="secondary" type="button" (click)="ref.close()">{{ i18n.t('Cancel', 'Ghairi') }}</button>
        <button lsmsButton type="submit" form="role-form" icon="save" [loading]="busy()">{{ i18n.t('Save', 'Hifadhi') }}</button>
      </ng-container>
    </lsms-dialog>
  `,
})
export class RoleFormDialog {
  protected readonly data = inject<RoleFormData>(DIALOG_DATA);
  protected readonly ref = inject<DialogRef<Role>>(DialogRef);
  protected readonly i18n = inject(LanguageService);
  private readonly roles = inject(RolesService);
  private readonly toast = inject(ToastService);

  protected readonly busy = signal(false);
  protected readonly form = inject(FormBuilder).nonNullable.group({
    name: [
      this.data.role?.name ?? '',
      [LsmsValidators.required('Role name'), LsmsValidators.minLength(3, 'Role name'), LsmsValidators.maxLength(100, 'Role name')],
    ],
    description: [
      this.data.role?.description ?? '',
      [
        LsmsValidators.required('Description'),
        LsmsValidators.minLength(10, 'Description'),
        LsmsValidators.maxLength(500, 'Description'),
      ],
    ],
  });

  protected async save(): Promise<void> {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.busy()) return;
    this.busy.set(true);
    try {
      const { name, description } = this.form.getRawValue();
      const { role, message } = await this.roles.save({
        uid: this.data.role?.uid,
        name: name.trim(),
        description: description.trim(),
      });
      this.toast.success(message ?? this.i18n.t('Role saved', 'Jukumu limehifadhiwa'));
      this.ref.close(role);
    } catch (e) {
      this.toast.error(ApiError.from(e).message);
    } finally {
      this.busy.set(false);
    }
  }
}
