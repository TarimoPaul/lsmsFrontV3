import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';

import { ApiError } from '@core/api/api.types';
import { AuthService } from '@core/auth/auth.service';
import { CanDirective } from '@core/auth/can.directive';
import { LanguageService } from '@core/i18n/language.service';
import {
  ActionMenu,
  Button,
  DataTable,
  DialogService,
  EmptyState,
  FilterPanel,
  Icon,
  MenuAction,
  MetricCard,
  MetricsGrid,
  PageHeader,
  SegmentOption,
  SegmentedFilterBar,
  StatusChip,
  TableColumn,
  ToastService,
} from '@shared/ui';
import { PermissionAssignData, PermissionAssignDialog } from './permission-assign-dialog';
import { RoleFormData, RoleFormDialog } from './role-form-dialog';
import { PROTECTED_ROLES, Role } from './roles.models';
import { RolesService } from './roles.service';

type StatusFilter = 'all' | 'active' | 'inactive';

/**
 * Role Management — port of Flutter `RoleDashboard` / `RoleTable`.
 * Actions are gated on the backend's role permissions:
 * ROLE_WRITE (create), ROLE_UPDATE (edit), ROLE_DELETE (delete),
 * ROLE_ASSIGN (assign permissions).
 */
@Component({
  selector: 'app-roles-page',
  imports: [
    CanDirective,
    PageHeader,
    Button,
    MetricCard,
    MetricsGrid,
    FilterPanel,
    SegmentedFilterBar,
    DataTable,
    TableColumn,
    StatusChip,
    ActionMenu,
    EmptyState,
    Icon,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './roles-page.html',
  styleUrl: './roles-page.scss',
})
export class RolesPage {
  protected readonly auth = inject(AuthService);
  protected readonly i18n = inject(LanguageService);
  private readonly rolesApi = inject(RolesService);
  private readonly dialogs = inject(DialogService);
  private readonly toast = inject(ToastService);

  protected readonly roles = signal<Role[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly search = signal('');
  protected readonly status = signal<StatusFilter>('all');

  protected readonly rowId = (r: Role) => r.uid;
  protected readonly nameOf = (r: Role) => r.name;
  protected readonly permCountOf = (r: Role) => r.permissions.length;
  protected readonly statusOf = (r: Role) => r.status;

  protected readonly filtered = computed(() => {
    const q = this.search().trim().toLowerCase();
    const st = this.status();
    return this.roles().filter(
      (r) =>
        (st === 'all' || (st === 'active' ? isActive(r) : !isActive(r))) &&
        (!q || r.name.toLowerCase().includes(q) || r.description.toLowerCase().includes(q)),
    );
  });

  protected readonly stats = computed(() => {
    const list = this.roles();
    const active = list.filter(isActive).length;
    const perms = list.reduce((n, r) => n + r.permissions.length, 0);
    const empty = list.filter((r) => r.permissions.length === 0).length;
    return { total: list.length, active, inactive: list.length - active, avg: list.length ? Math.round(perms / list.length) : 0, empty };
  });

  protected readonly statusOptions = computed<SegmentOption<StatusFilter>[]>(() => [
    { value: 'all', label: this.i18n.t('All roles', 'Majukumu yote'), count: this.stats().total },
    { value: 'active', label: this.i18n.t('Active', 'Hai'), icon: 'check_circle', count: this.stats().active },
    { value: 'inactive', label: this.i18n.t('Inactive', 'Hayatumiki'), icon: 'block', count: this.stats().inactive },
  ]);

  constructor() {
    void this.load();
  }

  protected async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      this.roles.set(await this.rolesApi.list());
    } catch (e) {
      const err = ApiError.from(e);
      this.error.set(err.isForbidden ? this.i18n.t('You are not allowed to view roles.', 'Huruhusiwi kuona majukumu.') : err.message);
    } finally {
      this.loading.set(false);
    }
  }

  protected isActive = isActive;
  protected isProtected(r: Role): boolean {
    return PROTECTED_ROLES.has(r.name.toUpperCase()) || !!r.isDefault;
  }

  protected actions(r: Role): MenuAction[] {
    const list: MenuAction[] = [];
    const canAssign = this.auth.hasPermission('ROLE_ASSIGN');
    list.push({
      label: canAssign ? this.i18n.t('Manage permissions', 'Simamia ruhusa') : this.i18n.t('View permissions', 'Ona ruhusa'),
      icon: 'admin_panel_settings',
      run: () => void this.openPermissions(r),
    });
    if (this.auth.hasPermission('ROLE_UPDATE') || this.auth.hasPermission('ROLE_WRITE')) {
      list.push({ label: this.i18n.t('Edit', 'Hariri'), icon: 'edit', run: () => void this.openForm(r) });
    }
    if (this.auth.hasPermission('ROLE_DELETE')) {
      list.push({
        label: this.i18n.t('Delete', 'Futa'),
        icon: 'delete',
        destructive: true,
        disabled: this.isProtected(r),
        run: () => void this.remove(r),
      });
    }
    return list;
  }

  protected async openForm(role?: Role): Promise<void> {
    const saved = await this.dialogs.openAsync<Role, RoleFormData>(RoleFormDialog, { size: 'md', data: { role } });
    if (!saved) return;
    await this.load();
    // New role: go straight to assigning its permissions.
    if (!role && saved.uid && this.auth.hasPermission('ROLE_ASSIGN')) {
      const fresh = this.roles().find((r) => r.uid === saved.uid) ?? saved;
      await this.openPermissions(fresh);
    }
  }

  protected async openPermissions(role: Role): Promise<void> {
    const updated = await this.dialogs.openAsync<Role, PermissionAssignData>(PermissionAssignDialog, {
      size: 'lg',
      data: { role, readOnly: !this.auth.hasPermission('ROLE_ASSIGN') },
    });
    if (updated) await this.load();
  }

  protected async remove(role: Role): Promise<void> {
    const ok = await this.dialogs.confirmDelete({
      title: this.i18n.t(`Delete ${role.name}?`, `Futa ${role.name}?`),
      message: this.i18n.t(
        'Users assigned this role will lose its permissions. This cannot be undone from here.',
        'Watumiaji wenye jukumu hili watapoteza ruhusa zake. Hili haliwezi kurudishwa hapa.',
      ),
    });
    if (!ok) return;
    try {
      await this.rolesApi.delete(role.uid);
      this.toast.success(this.i18n.t('Role deleted', 'Jukumu limefutwa'));
      await this.load();
    } catch (e) {
      this.toast.error(ApiError.from(e).message);
    }
  }
}

function isActive(r: Role): boolean {
  return (r.status ?? 'ACTIVE').toUpperCase() === 'ACTIVE';
}
