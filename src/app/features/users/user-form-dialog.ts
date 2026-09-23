import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MatChipListbox, MatChipOption } from '@angular/material/chips';
import { MatTooltip } from '@angular/material/tooltip';

import { ApiError } from '@core/api/api.types';
import { AuthService } from '@core/auth/auth.service';
import { LanguageService } from '@core/i18n/language.service';
import { LsmsValidators } from '@shared/forms/validators';
import { Button, DialogShell, Icon, Skeleton, TextField, ToastService } from '@shared/ui';
import { Role } from '../roles/roles.models';
import { RolesService } from '../roles/roles.service';
import { UserRow, roleColor } from './users.models';
import { UsersService } from './users.service';

export interface UserFormData {
  user?: UserRow;
}

/**
 * Create / edit a user — port of Flutter `_showAddUserDialog` /
 * `_showEditUserDialog` (first/last name, email, phone, password on create,
 * one or more roles). Roles are replaced in one call (PUT /users/{uid}/roles).
 */
@Component({
  selector: 'app-user-form-dialog',
  imports: [ReactiveFormsModule, DialogShell, TextField, Button, Icon, Skeleton, MatChipListbox, MatChipOption, MatTooltip],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <lsms-dialog
      [title]="editing ? i18n.t('Edit user', 'Hariri mtumiaji') : i18n.t('New user', 'Mtumiaji mpya')"
      [icon]="editing ? 'manage_accounts' : 'person_add'"
    >
      <form id="user-form" [formGroup]="form" (ngSubmit)="save()" novalidate>
        <p class="section">{{ i18n.t('Personal details', 'Taarifa binafsi') }}</p>
        <div class="grid">
          <lsms-text-field formControlName="firstName" [label]="i18n.t('First name', 'Jina la kwanza')" prefixIcon="person" [required]="true" [autofocus]="true" />
          <lsms-text-field formControlName="lastName" [label]="i18n.t('Last name', 'Jina la mwisho')" [required]="true" />
          <lsms-text-field formControlName="email" type="email" [label]="i18n.t('Email', 'Barua pepe')" prefixIcon="mail" [required]="true" autocomplete="off" />
          <lsms-text-field formControlName="phoneNumber" type="tel" [label]="i18n.t('Phone', 'Simu')" prefixIcon="call" placeholder="07xx xxx xxx" />
        </div>

        @if (!editing) {
          <p class="section">{{ i18n.t('Sign-in', 'Kuingia') }}</p>
          <lsms-text-field
            formControlName="password"
            type="password"
            [label]="i18n.t('Temporary password', 'Nenosiri la muda')"
            [required]="true"
            autocomplete="new-password"
            [hint]="i18n.t('Share it with the user; they can change it under Security.', 'Mpe mtumiaji; anaweza kulibadilisha kwenye Usalama.')"
          >
            <button fieldSuffix type="button" class="gen" [matTooltip]="i18n.t('Generate strong password', 'Tengeneza nenosiri imara')" (click)="generate()">
              <lsms-icon name="password" [size]="18" />
            </button>
            @if (form.controls.password.value) {
              <button fieldSuffix type="button" class="gen" [matTooltip]="i18n.t('Copy', 'Nakili')" (click)="copy()">
                <lsms-icon [name]="copied() ? 'check' : 'content_copy'" [size]="18" />
              </button>
            }
          </lsms-text-field>
        }

        <p class="section">
          {{ i18n.t('Roles', 'Majukumu') }} <span class="req">*</span>
          @if (selected().length) {
            <span class="count">{{ selected().length }} {{ i18n.t('selected', 'zimechaguliwa') }}</span>
          }
        </p>
        @if (!canAssignRoles()) {
          <p class="note"><lsms-icon name="info" [size]="16" />{{ i18n.t('You need ROLE_ASSIGN to change roles.', 'Unahitaji ruhusa ya ROLE_ASSIGN kubadili majukumu.') }}</p>
        }
        @if (rolesLoading()) {
          <lsms-skeleton variant="list" [rows]="2" />
        } @else if (rolesError()) {
          <p class="note err"><lsms-icon name="error" [size]="16" />{{ rolesError() }}</p>
        } @else {
          <mat-chip-listbox
            class="roles"
            [multiple]="true"
            [disabled]="!canAssignRoles()"
            [value]="selected()"
            (change)="selected.set($event.value ?? [])"
            [attr.aria-label]="i18n.t('Roles', 'Majukumu')"
          >
            @for (r of roles(); track r.uid) {
              <mat-chip-option [value]="r.uid" [style.--role]="color(r.name)" [matTooltip]="r.description">
                {{ r.name }} <span class="perm">{{ r.permissions.length }}</span>
              </mat-chip-option>
            }
          </mat-chip-listbox>
          @if (triedSubmit() && !selected().length) {
            <p class="note err"><lsms-icon name="error" [size]="16" />{{ i18n.t('Select at least one role', 'Chagua angalau jukumu moja') }}</p>
          }
        }
      </form>

      <ng-container dialogActions>
        <button lsmsButton="secondary" type="button" (click)="ref.close()">{{ i18n.t('Cancel', 'Ghairi') }}</button>
        <button lsmsButton type="submit" form="user-form" [icon]="editing ? 'save' : 'person_add'" [loading]="busy()">
          {{ editing ? i18n.t('Save changes', 'Hifadhi mabadiliko') : i18n.t('Create user', 'Unda mtumiaji') }}
        </button>
      </ng-container>
    </lsms-dialog>
  `,
  styles: `
    .section { display: flex; align-items: center; gap: 6px; margin: 4px 0 10px; font-size: 0.74rem; font-weight: 800; letter-spacing: 0.8px; text-transform: uppercase; color: var(--c-text-2); }
    .section .req { color: var(--c-error); }
    .section .count { margin-left: auto; text-transform: none; letter-spacing: 0; font-weight: 700; color: var(--c-primary); }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0 16px; }
    @media (max-width: 600px) { .grid { grid-template-columns: 1fr; } }
    .gen { display: inline-flex; padding: 4px; border: 0; border-radius: 6px; background: none; color: var(--c-text-2); cursor: pointer; }
    .gen:hover { color: var(--c-primary); background: var(--c-hover); }
    .note { display: flex; align-items: center; gap: 6px; margin: 0 0 10px; font-size: 0.8rem; color: var(--c-text-2); }
    .note.err { color: var(--c-error); }
    .roles {
      --mat-chip-selected-container-color: color-mix(in srgb, var(--role) 16%, var(--c-surface));
      --mdc-chip-elevated-selected-container-color: color-mix(in srgb, var(--role) 16%, var(--c-surface));
      --mat-chip-selected-label-text-color: var(--c-text);
      --mdc-chip-selected-label-text-color: var(--c-text);
      --mat-chip-with-icon-selected-icon-color: var(--role);
      --mdc-chip-with-icon-selected-icon-color: var(--c-primary);
      --mat-chip-label-text-weight: 600;
    }
    .perm { margin-left: 6px; font-size: 0.72em; opacity: 0.6; }
  `,
})
export class UserFormDialog {
  protected readonly data = inject<UserFormData>(DIALOG_DATA);
  protected readonly ref = inject<DialogRef<boolean>>(DialogRef);
  protected readonly i18n = inject(LanguageService);
  private readonly auth = inject(AuthService);
  private readonly users = inject(UsersService);
  private readonly rolesApi = inject(RolesService);
  private readonly toast = inject(ToastService);

  protected readonly editing = !!this.data.user;
  protected readonly busy = signal(false);
  protected readonly triedSubmit = signal(false);
  protected readonly copied = signal(false);
  protected readonly roles = signal<Role[]>([]);
  protected readonly rolesLoading = signal(true);
  protected readonly rolesError = signal<string | null>(null);
  protected readonly selected = signal<string[]>(this.data.user?.roleUids ?? []);
  protected readonly canAssignRoles = computed(() =>
    this.editing ? this.auth.hasPermission('ROLE_ASSIGN') : true,
  );
  protected readonly color = roleColor;

  protected readonly form = inject(FormBuilder).nonNullable.group({
    firstName: [this.data.user?.firstName ?? '', [LsmsValidators.required('First name'), LsmsValidators.minLength(2, 'First name')]],
    lastName: [this.data.user?.lastName ?? '', [LsmsValidators.required('Last name'), LsmsValidators.minLength(2, 'Last name')]],
    email: [this.data.user?.email ?? '', [LsmsValidators.required('Email'), LsmsValidators.email()]],
    phoneNumber: [this.data.user?.phoneNumber ?? '', [LsmsValidators.phone()]],
    password: ['', this.editing ? [] : [LsmsValidators.required('Password'), LsmsValidators.minLength(6, 'Password')]],
  });

  constructor() {
    void this.loadRoles();
  }

  private async loadRoles(): Promise<void> {
    try {
      const list = (await this.rolesApi.list()).filter((r) => (r.status ?? 'ACTIVE').toUpperCase() === 'ACTIVE');
      this.roles.set(list);
      // New user: preselect the basic "user" role (Flutter took the first one, often a privileged role).
      const preset = list.find((r) => r.name.toLowerCase() === 'user') ?? list[0];
      if (!this.editing && !this.selected().length && preset) this.selected.set([preset.uid]);
    } catch (e) {
      const err = ApiError.from(e);
      this.rolesError.set(
        err.isForbidden
          ? this.i18n.t('You are not allowed to list roles (ROLE_READ).', 'Huruhusiwi kuona majukumu (ROLE_READ).')
          : err.message,
      );
    } finally {
      this.rolesLoading.set(false);
    }
  }

  protected generate(): void {
    const sets = ['ABCDEFGHJKLMNPQRSTUVWXYZ', 'abcdefghijkmnpqrstuvwxyz', '23456789', '!@#$%&*?'];
    const pick = (s: string) => s[crypto.getRandomValues(new Uint32Array(1))[0] % s.length];
    const chars = [...sets.map(pick), ...Array.from({ length: 8 }, () => pick(sets.join('')))];
    for (let i = chars.length - 1; i > 0; i--) {
      const j = crypto.getRandomValues(new Uint32Array(1))[0] % (i + 1);
      [chars[i], chars[j]] = [chars[j], chars[i]];
    }
    this.form.controls.password.setValue(chars.join(''));
    this.copied.set(false);
  }

  protected async copy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.form.controls.password.value);
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 1500);
    } catch {
      // clipboard blocked — user can still read it via the eye toggle
    }
  }

  protected async save(): Promise<void> {
    this.triedSubmit.set(true);
    this.form.markAllAsTouched();
    if (this.form.invalid || this.busy() || (!this.selected().length && !this.rolesError())) return;
    const v = this.form.getRawValue();
    const profile = {
      firstName: v.firstName.trim(),
      lastName: v.lastName.trim(),
      email: v.email.trim(),
      phoneNumber: v.phoneNumber.trim() || undefined,
    };
    this.busy.set(true);
    try {
      if (this.editing) {
        const user = this.data.user!;
        await this.users.updateProfile(user.uid, profile);
        const before = [...user.roleUids].sort().join();
        const after = [...this.selected()].sort().join();
        if (this.canAssignRoles() && before !== after) await this.users.setRoles(user.uid, this.selected());
        this.toast.success(this.i18n.t('User updated', 'Mtumiaji amesasishwa'));
        // Editing myself changes my own access — resync.
        if (user.uid === this.auth.user()?.uid) void this.auth.verify(true);
      } else {
        const msg = await this.users.create({ ...profile, password: v.password, roleUids: this.selected() });
        this.toast.success(msg ?? this.i18n.t('User created', 'Mtumiaji ameundwa'));
      }
      this.ref.close(true);
    } catch (e) {
      this.toast.error(ApiError.from(e).message);
    } finally {
      this.busy.set(false);
    }
  }
}
