import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';

import { ApiError } from '@core/api/api.types';
import { parsePermission } from '@core/auth/access-resolver';
import { LanguageService } from '@core/i18n/language.service';
import { Button, DialogShell, Icon, Skeleton } from '@shared/ui';
import { STATUS_META, UserDetails, UserRow, fullName, roleColor, userInitials } from './users.models';
import { UsersService } from './users.service';

export interface UserDetailsData {
  user: UserRow;
  canEdit: boolean;
}

/** What the caller should do after the dialog closes. */
export type UserDetailsResult = 'edit' | undefined;

/**
 * User details — port of Flutter `_showUserDetailsDialog` (contact, roles,
 * account info) plus the effective permissions the user's roles grant.
 */
@Component({
  selector: 'app-user-details-dialog',
  imports: [DialogShell, Button, Icon, Skeleton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <lsms-dialog [title]="i18n.t('User details', 'Maelezo ya mtumiaji')" icon="badge">
      <section class="head">
        <span class="avatar">{{ initials }}</span>
        <div class="who">
          <h3>{{ name }}</h3>
          <p>{{ data.user.email }}</p>
          <span class="status" [style.--st]="status.color">
            <lsms-icon [name]="status.icon" [size]="14" [filled]="true" />{{ i18n.isSwahili() ? status.sw : status.en }}
          </span>
        </div>
      </section>

      <div class="cols">
        <section class="block">
          <h4>{{ i18n.t('Contact', 'Mawasiliano') }}</h4>
          <dl>
            <dt><lsms-icon name="mail" [size]="16" />{{ i18n.t('Email', 'Barua pepe') }}</dt>
            <dd>{{ data.user.email }}</dd>
            <dt><lsms-icon name="call" [size]="16" />{{ i18n.t('Phone', 'Simu') }}</dt>
            <dd>{{ data.user.phoneNumber || '—' }}</dd>
            <dt><lsms-icon name="verified" [size]="16" />{{ i18n.t('Email verified', 'Barua pepe imethibitishwa') }}</dt>
            <dd>{{ data.user.emailVerified ? i18n.t('Yes', 'Ndiyo') : i18n.t('No', 'Hapana') }}</dd>
          </dl>
        </section>
        <section class="block">
          <h4>{{ i18n.t('Account', 'Akaunti') }}</h4>
          <dl>
            <dt><lsms-icon name="event" [size]="16" />{{ i18n.t('Joined', 'Alijiunga') }}</dt>
            <dd>{{ date(data.user.createdAt) }}</dd>
            <dt><lsms-icon name="login" [size]="16" />{{ i18n.t('Last sign-in', 'Aliingia mwisho') }}</dt>
            <dd>{{ date(details()?.lastLoginAt ?? data.user.lastLoginAt) }}</dd>
            <dt><lsms-icon name="update" [size]="16" />{{ i18n.t('Last updated', 'Ilisasishwa mwisho') }}</dt>
            <dd>{{ date(data.user.updatedAt) }}</dd>
          </dl>
        </section>
      </div>

      <section class="block">
        <h4>{{ i18n.t('Roles', 'Majukumu') }}</h4>
        <div class="roles">
          @for (r of data.user.roleNames; track r) {
            <span class="role" [style.--role]="color(r)">{{ r }}</span>
          } @empty {
            <span class="muted">{{ i18n.t('No role assigned', 'Hakuna jukumu') }}</span>
          }
        </div>
      </section>

      <section class="block">
        <h4>
          {{ i18n.t('Effective permissions', 'Ruhusa anazopata') }}
          @if (details()) {
            <span class="count">{{ permissionCount() }}</span>
          }
        </h4>
        @if (loading()) {
          <lsms-skeleton variant="list" [rows]="2" />
        } @else if (error()) {
          <p class="muted">{{ error() }}</p>
        } @else if (!permissionCount()) {
          <p class="muted">{{ i18n.t('No permissions — this user cannot open any module.', 'Hakuna ruhusa — mtumiaji huyu hawezi kufungua moduli yoyote.') }}</p>
        } @else {
          <div class="perm-groups">
            @for (g of groups(); track g.module) {
              <div class="pg">
                <strong>{{ g.module }}</strong><small>{{ g.items.length }}</small>
                <div class="pills">
                  @for (p of g.items; track p) {
                    <code>{{ p }}</code>
                  }
                </div>
              </div>
            }
          </div>
        }
      </section>

      <ng-container dialogActions>
        <button lsmsButton="secondary" (click)="ref.close()">{{ i18n.t('Close', 'Funga') }}</button>
        @if (data.canEdit) {
          <button lsmsButton icon="edit" (click)="ref.close('edit')">{{ i18n.t('Edit user', 'Hariri mtumiaji') }}</button>
        }
      </ng-container>
    </lsms-dialog>
  `,
  styles: `
    .head { display: flex; align-items: center; gap: 16px; margin-bottom: 18px; }
    .avatar {
      display: inline-flex; align-items: center; justify-content: center; width: 60px; height: 60px; border-radius: 50%;
      flex-shrink: 0; color: #fff; font-size: 1.2rem; font-weight: 800;
      background: linear-gradient(135deg, var(--c-primary), var(--c-secondary));
    }
    .who h3 { font-size: 1.2rem; font-weight: 800; }
    .who p { color: var(--c-text-2); font-size: 0.85rem; }
    .status {
      display: inline-flex; align-items: center; gap: 4px; margin-top: 6px; padding: 3px 10px; border-radius: 100px;
      font-size: 0.72rem; font-weight: 700; color: var(--st); background: color-mix(in srgb, var(--st) 12%, transparent);
    }
    .cols { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    @media (max-width: 600px) { .cols { grid-template-columns: 1fr; } }
    .block { padding: 14px 16px; margin-bottom: 12px; border-radius: 14px; background: var(--c-bg); border: 1px solid var(--c-border); }
    h4 { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; font-size: 0.72rem; font-weight: 800; letter-spacing: 0.8px; text-transform: uppercase; color: var(--c-text-2); }
    .count { padding: 1px 8px; border-radius: 100px; font-size: 0.7rem; letter-spacing: 0; color: var(--c-primary); background: color-mix(in srgb, var(--c-primary) 10%, transparent); }
    dl { display: grid; grid-template-columns: auto 1fr; gap: 8px 14px; margin: 0; font-size: 0.85rem; }
    dt { display: flex; align-items: center; gap: 6px; color: var(--c-text-2); }
    dd { margin: 0; font-weight: 600; text-align: right; word-break: break-word; }
    .roles { display: flex; flex-wrap: wrap; gap: 6px; }
    .role { padding: 4px 10px; border-radius: 100px; font-size: 0.78rem; font-weight: 700; color: var(--role); background: color-mix(in srgb, var(--role) 12%, transparent); border: 1px solid color-mix(in srgb, var(--role) 30%, transparent); }
    .muted { color: var(--c-text-2); font-size: 0.85rem; }
    .perm-groups { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 10px; max-height: 280px; overflow: auto; }
    .pg strong { font-size: 0.78rem; text-transform: capitalize; }
    .pg small { margin-left: 6px; color: var(--c-text-2); }
    .pills { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 6px; }
    code { padding: 2px 6px; border-radius: 6px; font-size: 0.66rem; background: var(--c-surface); border: 1px solid var(--c-border); }
  `,
})
export class UserDetailsDialog {
  protected readonly data = inject<UserDetailsData>(DIALOG_DATA);
  protected readonly ref = inject<DialogRef<UserDetailsResult>>(DialogRef);
  protected readonly i18n = inject(LanguageService);
  private readonly users = inject(UsersService);

  protected readonly name = fullName(this.data.user);
  protected readonly initials = userInitials(this.data.user);
  protected readonly status = STATUS_META[this.data.user.status] ?? STATUS_META.ACTIVE;
  protected readonly color = roleColor;

  protected readonly details = signal<UserDetails | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);

  private readonly permissionNames = computed(() =>
    (this.details()?.permissions ?? []).map((p) => (typeof p === 'string' ? p : p.name)).filter(Boolean),
  );
  protected readonly permissionCount = computed(() => this.permissionNames().length);
  protected readonly groups = computed(() => {
    const map = new Map<string, string[]>();
    for (const p of this.permissionNames()) {
      const m = parsePermission(p)?.module ?? 'other';
      (map.get(m) ?? map.set(m, []).get(m)!).push(p);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([module, items]) => ({ module, items: items.sort() }));
  });

  constructor() {
    this.users
      .details(this.data.user.uid)
      .then((d) => this.details.set(d))
      .catch((e) => this.error.set(ApiError.from(e).message))
      .finally(() => this.loading.set(false));
  }

  protected date(v: string | null | undefined): string {
    if (!v) return '—';
    const d = new Date(v);
    return Number.isNaN(d.getTime())
      ? v
      : d.toLocaleString(this.i18n.isSwahili() ? 'sw-TZ' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short' });
  }
}
