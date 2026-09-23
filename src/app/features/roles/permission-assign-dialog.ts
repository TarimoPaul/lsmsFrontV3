import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { MatCheckbox } from '@angular/material/checkbox';

import { ApiError } from '@core/api/api.types';
import { AuthService } from '@core/auth/auth.service';
import { LanguageService } from '@core/i18n/language.service';
import { Button, DialogService, DialogShell, Icon, SearchBar, Skeleton, ToastService } from '@shared/ui';
import { Permission, PermissionGroup, PermissionModule, Role, humanizeModule, humanizePermission } from './roles.models';
import { RolesService } from './roles.service';

export interface PermissionAssignData {
  role: Role;
  /** View-only when the user lacks ROLE_ASSIGN. */
  readOnly?: boolean;
}

/**
 * Assign permissions to a role — port of Flutter `PermissionAssignmentDialog`:
 * modules → groups → permissions with tri-state checkboxes, search, and a
 * live "x of y selected" summary. Saving REPLACES the role's permission set.
 */
@Component({
  selector: 'app-permission-assign-dialog',
  imports: [DialogShell, Button, Icon, SearchBar, Skeleton, MatCheckbox],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './permission-assign-dialog.html',
  styleUrl: './permission-assign-dialog.scss',
})
export class PermissionAssignDialog {
  protected readonly data = inject<PermissionAssignData>(DIALOG_DATA);
  protected readonly ref = inject<DialogRef<Role>>(DialogRef);
  protected readonly i18n = inject(LanguageService);
  private readonly roles = inject(RolesService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly dialogs = inject(DialogService);

  protected readonly humanizeModule = humanizeModule;
  protected readonly humanizePermission = humanizePermission;

  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly modules = signal<PermissionModule[]>([]);
  protected readonly selected = signal(new Set(this.data.role.permissions.map((p) => p.uid)));
  protected readonly search = signal('');
  protected readonly expanded = signal(new Set<string>());
  protected readonly onlySelected = signal(false);
  private readonly initial = new Set(this.data.role.permissions.map((p) => p.uid));

  protected readonly total = computed(() =>
    this.modules().reduce((n, m) => n + m.permissionGroups.reduce((k, g) => k + g.permissions.length, 0), 0),
  );
  protected readonly changed = computed(() => {
    const s = this.selected();
    if (s.size !== this.initial.size) return true;
    for (const id of s) if (!this.initial.has(id)) return true;
    return false;
  });

  /** Modules/groups filtered by search + "only selected". */
  protected readonly visible = computed<PermissionModule[]>(() => {
    const q = this.search().trim().toLowerCase();
    const only = this.onlySelected();
    const sel = this.selected();
    const match = (p: Permission, m: PermissionModule, g: PermissionGroup) =>
      (!only || sel.has(p.uid)) &&
      (!q ||
        p.name.toLowerCase().includes(q) ||
        (p.description ?? '').toLowerCase().includes(q) ||
        m.module.toLowerCase().includes(q) ||
        g.group.toLowerCase().includes(q));
    return this.modules()
      .map((m) => ({
        module: m.module,
        permissionGroups: m.permissionGroups
          .map((g) => ({ group: g.group, permissions: g.permissions.filter((p) => match(p, m, g)) }))
          .filter((g) => g.permissions.length),
      }))
      .filter((m) => m.permissionGroups.length);
  });

  constructor() {
    void this.load();
  }

  protected async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const mods = await this.roles.permissionModules();
      this.modules.set(mods);
      // Expand modules that already have selections (or the first one).
      const open = new Set(mods.filter((m) => this.moduleState(m) !== 'none').map((m) => m.module));
      if (!open.size && mods[0]) open.add(mods[0].module);
      this.expanded.set(open);
    } catch (e) {
      this.error.set(ApiError.from(e).message);
    } finally {
      this.loading.set(false);
    }
  }

  // ── Selection helpers ──
  private uidsOf(m: PermissionModule | PermissionGroup): string[] {
    return 'permissionGroups' in m ? m.permissionGroups.flatMap((g) => g.permissions.map((p) => p.uid)) : m.permissions.map((p) => p.uid);
  }

  protected moduleState(m: PermissionModule | PermissionGroup): 'all' | 'some' | 'none' {
    const ids = this.uidsOf(m);
    const sel = this.selected();
    const n = ids.filter((id) => sel.has(id)).length;
    return n === 0 ? 'none' : n === ids.length ? 'all' : 'some';
  }

  protected sizeOf(m: PermissionModule | PermissionGroup): number {
    return this.uidsOf(m).length;
  }

  protected countSelected(m: PermissionModule | PermissionGroup): number {
    const sel = this.selected();
    return this.uidsOf(m).filter((id) => sel.has(id)).length;
  }

  protected toggle(uid: string): void {
    if (this.data.readOnly) return;
    this.selected.update((s) => {
      const next = new Set(s);
      if (next.has(uid)) next.delete(uid);
      else next.add(uid);
      return next;
    });
  }

  protected toggleAll(m: PermissionModule | PermissionGroup, on: boolean): void {
    if (this.data.readOnly) return;
    const ids = this.uidsOf(m);
    this.selected.update((s) => {
      const next = new Set(s);
      ids.forEach((id) => (on ? next.add(id) : next.delete(id)));
      return next;
    });
  }

  protected selectAllVisible(on: boolean): void {
    this.visible().forEach((m) => this.toggleAll(m, on));
  }

  protected toggleExpanded(module: string): void {
    this.expanded.update((s) => {
      const next = new Set(s);
      if (next.has(module)) next.delete(module);
      else next.add(module);
      return next;
    });
  }

  protected isExpanded(module: string): boolean {
    return !!this.search().trim() || this.expanded().has(module);
  }

  protected async save(): Promise<void> {
    if (this.saving()) return;
    if (this.selected().size === 0) {
      const ok = await this.dialogs.confirm({
        title: this.i18n.t('Remove all permissions?', 'Ondoa ruhusa zote?'),
        message: this.i18n.t(
          `Users with the ${this.data.role.name} role will not be able to open any module.`,
          `Watumiaji wenye jukumu la ${this.data.role.name} hawataweza kufungua moduli yoyote.`,
        ),
      });
      if (!ok) return;
    }
    this.saving.set(true);
    try {
      const role = await this.roles.setPermissions(this.data.role.uid, [...this.selected()]);
      this.toast.success(
        this.i18n.t(`Permissions updated for ${this.data.role.name}`, `Ruhusa za ${this.data.role.name} zimesasishwa`),
      );
      // If I hold this role, my own access just changed — resync it.
      if (this.auth.hasRole(this.data.role.name)) void this.auth.verify(true);
      this.ref.close(role);
    } catch (e) {
      this.toast.error(ApiError.from(e).message);
    } finally {
      this.saving.set(false);
    }
  }
}
