import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';

import { ApiError } from '@core/api/api.types';
import { AuthService } from '@core/auth/auth.service';
import { CanDirective } from '@core/auth/can.directive';
import { LanguageService } from '@core/i18n/language.service';
import {
  ActionMenu,
  Button,
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
  Skeleton,
  ToastService,
} from '@shared/ui';
import { BRANCH_STATUS, Branch, BranchStatus, DAYS, location } from './branches.models';
import { BranchesService } from './branches.service';

type Filter = 'ALL' | BranchStatus | 'MINE';

/**
 * Branch management — port of Flutter `BranchManagementDashboard`
 * (stats, all / mine / active / suspended, add / edit / suspend / reactivate /
 * delete). v3 uses the backend's real branch fields, shows branches as cards,
 * marks the branch you are working in and lets you switch to it directly.
 */
@Component({
  selector: 'app-branches-page',
  imports: [CanDirective, PageHeader, Button, MetricCard, MetricsGrid, FilterPanel, SegmentedFilterBar, ActionMenu, EmptyState, Icon, Skeleton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './branches-page.html',
  styleUrl: './branches-page.scss',
})
export class BranchesPage {
  protected readonly auth = inject(AuthService);
  protected readonly i18n = inject(LanguageService);
  private readonly api = inject(BranchesService);
  private readonly dialogs = inject(DialogService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  protected readonly branches = computed(() => this.api.list.value() ?? []);
  protected readonly loading = computed(() => this.api.list.initialLoading());
  protected readonly error = signal<string | null>(null);
  protected readonly search = signal('');
  protected readonly filter = signal<Filter>('ALL');
  protected readonly statusMeta = BRANCH_STATUS;
  protected readonly location = location;

  /** Branches the signed-in user may work in (from the login session). */
  private readonly mine = computed(() => new Set(this.auth.branches().map((b) => b.uid)));

  protected readonly stats = computed(() => {
    const list = this.branches();
    const count = (s: BranchStatus) => list.filter((b) => b.status === s).length;
    return { total: list.length, active: count('ACTIVE'), suspended: count('SUSPENDED'), mine: list.filter((b) => this.mine().has(b.uid)).length };
  });

  protected readonly options = computed<SegmentOption<Filter>[]>(() => {
    const s = this.stats();
    const t = (en: string, sw: string) => this.i18n.t(en, sw);
    return [
      { value: 'ALL', label: t('All', 'Yote'), count: s.total },
      { value: 'MINE', label: t('My branches', 'Matawi yangu'), icon: 'person_pin', count: s.mine },
      { value: 'ACTIVE', label: t('Active', 'Yanayotumika'), icon: 'check_circle', count: s.active },
      { value: 'SUSPENDED', label: t('Suspended', 'Yaliyosimamishwa'), icon: 'pause_circle', count: s.suspended },
    ];
  });

  protected readonly rows = computed(() => {
    const q = this.search().trim().toLowerCase();
    const f = this.filter();
    return this.branches().filter((b) => {
      if (f === 'MINE' && !this.mine().has(b.uid)) return false;
      if (f !== 'ALL' && f !== 'MINE' && b.status !== f) return false;
      if (!q) return true;
      return [b.branchName, b.branchCode ?? '', b.city ?? '', b.region ?? '', b.phoneNumber ?? ''].some((x) => x.toLowerCase().includes(q));
    });
  });

  constructor() {
    void this.refresh(false);
  }

  protected async refresh(force = true): Promise<void> {
    this.error.set(null);
    try {
      await this.api.list.load(force);
    } catch (e) {
      const err = ApiError.from(e);
      this.error.set(err.isForbidden ? this.i18n.t('You are not allowed to view branches.', 'Huruhusiwi kuona matawi.') : err.message);
    }
  }

  protected isCurrent(b: Branch): boolean {
    return this.auth.activeBranchUid() === b.uid;
  }

  protected daysLabel(b: Branch): string {
    const set = new Set((b.operatingDays ?? '').split(',').filter(Boolean));
    if (!set.size) return '';
    if (set.size === 7) return this.i18n.t('Every day', 'Kila siku');
    return DAYS.filter((d) => set.has(d.code)).map((d) => (this.i18n.isSwahili() ? d.sw : d.en)).join(' · ');
  }

  protected actions(b: Branch): MenuAction[] {
    const t = (en: string, sw: string) => this.i18n.t(en, sw);
    const can = (p: string) => this.auth.hasPermission(p);
    const list: MenuAction[] = [];
    if (this.mine().has(b.uid) && !this.isCurrent(b) && b.status === 'ACTIVE') {
      list.push({ label: t('Work in this branch', 'Fanya kazi tawi hili'), icon: 'swap_horiz', run: () => void this.switchTo(b) });
    }
    if (can('BRANCH_UPDATE')) list.push({ label: t('Edit', 'Hariri'), icon: 'edit', run: () => void this.openForm(b) });
    if (b.status === 'ACTIVE' && can('BRANCH_SUSPEND')) {
      list.push({ label: t('Suspend', 'Simamisha'), icon: 'pause_circle', disabled: b.isMainBranch, run: () => void this.suspend(b) });
    }
    if (b.status !== 'ACTIVE' && can('BRANCH_ACTIVATE')) list.push({ label: t('Reactivate', 'Rejesha'), icon: 'play_circle', run: () => void this.reactivate(b) });
    if (can('BRANCH_DELETE')) list.push({ label: t('Delete', 'Futa'), icon: 'delete', destructive: true, disabled: b.isMainBranch || this.isCurrent(b), run: () => void this.remove(b) });
    return list;
  }

  protected async openForm(branch?: Branch): Promise<void> {
    const { BranchFormDialog } = await import('./branch-form-dialog');
    await this.dialogs.openAsync(BranchFormDialog, { size: 'lg', data: { branch, existing: this.branches() } });
  }

  private async switchTo(b: Branch): Promise<void> {
    try {
      await this.auth.selectBranch(b.uid);
      this.toast.success(this.i18n.t(`Now working in ${b.branchName}`, `Sasa unafanya kazi ${b.branchName}`));
      await this.router.navigateByUrl('/dashboard');
    } catch (e) {
      this.toast.error(ApiError.from(e).message);
    }
  }

  private async suspend(b: Branch): Promise<void> {
    const ok = await this.dialogs.confirm({
      title: this.i18n.t(`Suspend ${b.branchName}?`, `Simamisha ${b.branchName}?`),
      message: this.i18n.t('Staff will not be able to work in this branch until it is reactivated.', 'Wafanyakazi hawataweza kufanya kazi tawi hili hadi lirejeshwe.'),
      confirmText: this.i18n.t('Suspend', 'Simamisha'),
    });
    if (!ok) return;
    await this.run(() => this.api.suspend(b.uid, null), this.i18n.t(`${b.branchName} suspended`, `${b.branchName} limesimamishwa`));
  }

  private async reactivate(b: Branch): Promise<void> {
    await this.run(() => this.api.reactivate(b.uid), this.i18n.t(`${b.branchName} reactivated`, `${b.branchName} limerejeshwa`));
  }

  private async remove(b: Branch): Promise<void> {
    const ok = await this.dialogs.confirmDelete({
      title: this.i18n.t(`Delete ${b.branchName}?`, `Futa ${b.branchName}?`),
      message: this.i18n.t('The branch is removed from lists; its records are kept.', 'Tawi litaondolewa kwenye orodha; kumbukumbu zake zitabaki.'),
    });
    if (!ok) return;
    await this.run(() => this.api.remove(b.uid), this.i18n.t(`${b.branchName} deleted`, `${b.branchName} limefutwa`));
  }

  private async run(fn: () => Promise<void>, done: string): Promise<void> {
    try {
      await fn();
      this.toast.success(done);
    } catch (e) {
      this.toast.error(ApiError.from(e).message);
    }
  }
}
