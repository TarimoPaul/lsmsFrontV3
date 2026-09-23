import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';

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
  SelectField,
  SelectOption,
  TableColumn,
  ToastService,
} from '@shared/ui';
import { Role } from '../roles/roles.models';
import { RolesService } from '../roles/roles.service';
import { UserDetailsData, UserDetailsDialog, UserDetailsResult } from './user-details-dialog';
import { UserFormData, UserFormDialog } from './user-form-dialog';
import { STATUS_META, UserRow, UserStatistics, UserStatus, fullName, roleColor, userInitials } from './users.models';
import { UsersService } from './users.service';

type StatusFilter = 'ALL' | UserStatus;

/**
 * User Management — port of Flutter `UserDashboard` (stats, search, All /
 * Pending / Active, add / edit / details / approve / delete) with v3
 * additions: server-side search & filters, role filter, activate /
 * deactivate / unlock (dead code in Flutter), and self-protection.
 */
@Component({
  selector: 'app-users-page',
  imports: [
    CanDirective,
    PageHeader,
    Button,
    MetricCard,
    MetricsGrid,
    FilterPanel,
    SegmentedFilterBar,
    SelectField,
    DataTable,
    TableColumn,
    ActionMenu,
    EmptyState,
    Icon,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './users-page.html',
  styleUrl: './users-page.scss',
})
export class UsersPage {
  protected readonly auth = inject(AuthService);
  protected readonly i18n = inject(LanguageService);
  private readonly api = inject(UsersService);
  private readonly rolesApi = inject(RolesService);
  private readonly dialogs = inject(DialogService);
  private readonly toast = inject(ToastService);

  protected readonly users = signal<UserRow[]>([]);
  protected readonly stats = signal<UserStatistics | null>(null);
  protected readonly roles = signal<Role[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);

  protected readonly search = signal('');
  protected readonly status = signal<StatusFilter>('ALL');
  protected readonly roleUid = signal<string | null>(null);

  protected readonly rowId = (u: UserRow) => u.uid;
  protected readonly nameOf = (u: UserRow) => fullName(u);
  protected readonly emailOf = (u: UserRow) => u.email;
  protected readonly statusOf = (u: UserRow) => u.status;
  protected readonly createdOf = (u: UserRow) => u.createdAt ?? '';
  protected readonly lastLoginOf = (u: UserRow) => u.lastLoginAt ?? '';
  protected readonly initials = userInitials;
  protected readonly fullName = fullName;
  protected readonly roleColor = roleColor;
  protected readonly statusMeta = STATUS_META;

  protected readonly statusOptions = computed<SegmentOption<StatusFilter>[]>(() => {
    const s = this.stats();
    const lang = this.i18n.lang();
    return [
      { value: 'ALL', label: this.i18n.t('All users', 'Wote'), count: s ? s.total - s.terminated : undefined },
      { value: 'ACTIVE', label: STATUS_META.ACTIVE[lang], icon: 'check_circle', count: s?.active },
      { value: 'PENDING', label: STATUS_META.PENDING[lang], icon: 'hourglass_top', count: s?.pending },
      { value: 'INACTIVE', label: STATUS_META.INACTIVE[lang], icon: 'pause_circle', count: s?.inactive },
      { value: 'LOCKED', label: STATUS_META.LOCKED[lang], icon: 'lock', count: s?.locked },
    ];
  });

  protected readonly roleOptions = computed<SelectOption[]>(() =>
    this.roles().map((r) => ({ value: r.uid, label: r.name })),
  );

  protected readonly roleDistribution = computed(() => {
    const d = this.stats()?.roleDistribution ?? {};
    const total = Object.values(d).reduce((a, b) => a + b, 0) || 1;
    return Object.entries(d)
      .sort(([, a], [, b]) => b - a)
      .map(([name, count]) => ({ name, count, pct: Math.round((count / total) * 100), color: roleColor(name) }));
  });

  constructor() {
    // Reload whenever a server-side filter changes.
    effect(() => {
      const q = { search: this.search(), status: this.status(), roleUid: this.roleUid() };
      untracked(() => void this.loadUsers(q));
    });
    void this.loadStats();
    void this.loadRoles();
  }

  protected async refresh(): Promise<void> {
    await Promise.all([this.loadUsers(), this.loadStats()]);
  }

  private async loadUsers(
    q = { search: this.search(), status: this.status(), roleUid: this.roleUid() },
  ): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const { users } = await this.api.list({
        search: q.search,
        status: q.status === 'ALL' ? null : q.status,
        roleUid: q.roleUid,
      });
      this.users.set(users);
    } catch (e) {
      const err = ApiError.from(e);
      this.error.set(err.isForbidden ? this.i18n.t('You are not allowed to view users.', 'Huruhusiwi kuona watumiaji.') : err.message);
    } finally {
      this.loading.set(false);
    }
  }

  private async loadStats(): Promise<void> {
    try {
      this.stats.set(await this.api.statistics());
    } catch {
      this.stats.set(null);
    }
  }

  private async loadRoles(): Promise<void> {
    if (!this.auth.hasPermission('ROLE_READ')) return;
    try {
      this.roles.set(await this.rolesApi.list());
    } catch {
      this.roles.set([]);
    }
  }

  // ── Row helpers ───────────────────────────────────────────────────────────
  protected isSelf(u: UserRow): boolean {
    return u.uid === this.auth.user()?.uid || u.email === this.auth.user()?.email;
  }

  protected isRootLike(u: UserRow): boolean {
    return u.roleNames.some((r) => r.toUpperCase() === 'ROOT');
  }

  protected relative(v: string | null): string {
    if (!v) return this.i18n.t('Never', 'Bado');
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return v;
    const days = Math.floor((Date.now() - d.getTime()) / 86_400_000);
    if (days <= 0) return this.i18n.t('Today', 'Leo');
    if (days === 1) return this.i18n.t('Yesterday', 'Jana');
    if (days < 30) return this.i18n.t(`${days} days ago`, `Siku ${days} zilizopita`);
    return d.toLocaleDateString(this.i18n.isSwahili() ? 'sw-TZ' : 'en-GB', { dateStyle: 'medium' });
  }

  protected actions(u: UserRow): MenuAction[] {
    const t = (en: string, sw: string) => this.i18n.t(en, sw);
    const self = this.isSelf(u);
    const protectedUser = self || this.isRootLike(u);
    const list: MenuAction[] = [{ label: t('View details', 'Maelezo'), icon: 'visibility', run: () => void this.openDetails(u) }];
    if (this.auth.hasPermission('USER_UPDATE')) {
      list.push({ label: t('Edit', 'Hariri'), icon: 'edit', run: () => void this.openForm(u) });
    }
    if (u.status === 'PENDING' && this.auth.hasPermission('USER_APPROVE')) {
      list.push({ label: t('Approve', 'Idhinisha'), icon: 'how_to_reg', run: () => void this.approve(u) });
    }
    if (this.auth.hasPermission('USER_UPDATE')) {
      if (u.status === 'ACTIVE') {
        list.push({ label: t('Deactivate', 'Zima'), icon: 'pause_circle', disabled: protectedUser, run: () => void this.changeStatus(u, 'INACTIVE') });
      } else if (u.status === 'INACTIVE') {
        list.push({ label: t('Activate', 'Washa'), icon: 'play_circle', run: () => void this.changeStatus(u, 'ACTIVE') });
      } else if (u.status === 'LOCKED') {
        list.push({ label: t('Unlock', 'Fungua'), icon: 'lock_open', run: () => void this.changeStatus(u, 'ACTIVE') });
      }
    }
    if (this.auth.hasPermission('USER_DELETE')) {
      list.push({ label: t('Delete', 'Futa'), icon: 'delete', destructive: true, disabled: protectedUser, run: () => void this.remove(u) });
    }
    return list;
  }

  // ── Actions ───────────────────────────────────────────────────────────────
  protected async openForm(user?: UserRow): Promise<void> {
    const saved = await this.dialogs.openAsync<boolean, UserFormData>(UserFormDialog, { size: 'md', data: { user } });
    if (saved) await this.refresh();
  }

  protected async openDetails(user: UserRow): Promise<void> {
    const res = await this.dialogs.openAsync<UserDetailsResult, UserDetailsData>(UserDetailsDialog, {
      size: 'lg',
      data: { user, canEdit: this.auth.hasPermission('USER_UPDATE') },
    });
    if (res === 'edit') await this.openForm(user);
  }

  protected async approve(u: UserRow): Promise<void> {
    await this.run(() => this.api.approve(u.uid), this.i18n.t(`${fullName(u)} approved`, `${fullName(u)} ameidhinishwa`));
  }

  protected async changeStatus(u: UserRow, status: UserStatus): Promise<void> {
    if (status === 'INACTIVE') {
      const ok = await this.dialogs.confirm({
        title: this.i18n.t(`Deactivate ${fullName(u)}?`, `Zima ${fullName(u)}?`),
        message: this.i18n.t(
          'They will be signed out and cannot sign in until reactivated.',
          'Hataweza kuingia kwenye mfumo hadi awashwe tena.',
        ),
        confirmText: this.i18n.t('Deactivate', 'Zima'),
      });
      if (!ok) return;
    }
    const done = status === 'ACTIVE' ? this.i18n.t('User activated', 'Mtumiaji amewashwa') : this.i18n.t('User deactivated', 'Mtumiaji amezimwa');
    await this.run(() => this.api.setStatus(u.uid, status), done);
  }

  protected async remove(u: UserRow): Promise<void> {
    const ok = await this.dialogs.confirmDelete({
      title: this.i18n.t(`Delete ${fullName(u)}?`, `Futa ${fullName(u)}?`),
      message: this.i18n.t(
        'The account is deactivated and removed from the list. History (sales, audits) is kept.',
        'Akaunti itazimwa na kuondolewa kwenye orodha. Historia (mauzo, ukaguzi) itabaki.',
      ),
    });
    if (!ok) return;
    await this.run(() => this.api.remove(u.uid), this.i18n.t('User deleted', 'Mtumiaji amefutwa'));
  }

  private async run(fn: () => Promise<void>, success: string): Promise<void> {
    try {
      await fn();
      this.toast.success(success);
      await this.refresh();
    } catch (e) {
      this.toast.error(ApiError.from(e).message);
    }
  }

  protected filterPending(): void {
    this.status.set('PENDING');
  }
}
