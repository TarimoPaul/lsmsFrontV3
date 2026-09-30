import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';

import { ApiError } from '@core/api/api.types';
import { AuthService } from '@core/auth/auth.service';
import { LanguageService } from '@core/i18n/language.service';
import { DialogService, EmptyState, MetricCard, MetricsGrid, SearchBar, SegmentOption, SegmentedFilterBar, Skeleton, ToastService } from '@shared/ui';
import { Money, MoneyPipe } from '@shared/utils/money';
import { LIABILITY_STATUS, Liability, LiabilityStatus, isSurplusItem } from './counting.models';
import { CountingService } from './counting.service';
import { LiabilityCard } from './liability-card';
import type { LiabilityDialogData } from './liability-dialogs';

type Filter = 'ALL' | 'DISPUTED' | LiabilityStatus;

/**
 * "Staff debts" — port of Flutter `LiabilityAdminScreen`
 * (LIABILITY_READ_ALL or LIABILITY_MANAGE): one fetch, totals over everything,
 * status / dispute chips + search narrow only what is listed. Managers record
 * payments and set payroll deduction plans; accept/dispute is owner-only and
 * never offered here.
 */
@Component({
  selector: 'app-staff-liabilities-tab',
  imports: [LiabilityCard, MetricCard, MetricsGrid, SegmentedFilterBar, SearchBar, EmptyState, Skeleton, MoneyPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (loading() && !rows().length) {
      <lsms-skeleton variant="list" [rows]="4" />
    } @else if (error() && !rows().length) {
      <lsms-empty-state icon="error" iconColor="var(--c-error)" [title]="i18n.t('Could not load staff debts', 'Imeshindwa kupata madeni ya wafanyakazi')" [message]="error()!" [secondaryActionLabel]="i18n.t('Retry', 'Jaribu tena')" (secondaryAction)="load()" />
    } @else {
      <lsms-metrics-grid [gap]="12">
        <lsms-metric-card [title]="i18n.t('Open balance', 'Jumla wazi')" [value]="stats().open | money: { decimals: 0 }" icon="account_balance_wallet" color="var(--c-warning)" [urgent]="stats().open > 0" [subtitle]="i18n.t(stats().people + ' staff', 'Wafanyakazi ' + stats().people)" />
        <lsms-metric-card [title]="i18n.t('Paid', 'Jumla iliyolipwa')" [value]="stats().paid | money: { decimals: 0 }" icon="check_circle" color="var(--c-success)" />
        <lsms-metric-card [title]="i18n.t('Open disputes', 'Mizozo inayosubiri')" [value]="stats().disputes + ''" icon="report" color="var(--c-error)" [urgent]="stats().disputes > 0" />
        <lsms-metric-card [title]="i18n.t('Awaiting staff decision', 'Zinasubiri mfanyakazi')" [value]="stats().pending + ''" icon="hourglass_top" color="var(--c-primary)" />
      </lsms-metrics-grid>

      <div class="filters">
        <lsms-search-bar [placeholder]="i18n.t('Search staff or product…', 'Tafuta mfanyakazi au bidhaa…')" (search)="query.set($event)" (cleared)="query.set('')" />
      </div>
      <lsms-segmented-filter-bar [options]="filters()" [selected]="filter()" (selectedChange)="filter.set($event)" />

      @if (!shown().length) {
        <lsms-empty-state icon="inbox" [title]="i18n.t('No debts', 'Hakuna madeni')" [message]="rows().length ? i18n.t('No debt matches these filters.', 'Hakuna deni linalolingana na vichujio hivi.') : i18n.t('No staff shortage debts have been recorded.', 'Hakuna deni la uhaba la mfanyakazi lililoandikwa.')" />
      } @else {
        <div class="list">
          @for (l of shown(); track l.uid) {
            <app-liability-card [liability]="l" mode="staff" [owner]="owner(l)" [canManage]="canManage()" (pay)="pay(l)" (plan)="plan(l)" (voidSurplus)="voidSurplus(l)" />
          }
        </div>
      }
    }
  `,
  styles: `
    :host { display: flex; flex-direction: column; gap: 14px; }
    .filters { display: flex; gap: 10px; }
    .filters lsms-search-bar { flex: 1; max-width: 520px; }
    .list { display: flex; flex-direction: column; gap: 10px; }
  `,
})
export class StaffLiabilitiesTab {
  protected readonly i18n = inject(LanguageService);
  private readonly api = inject(CountingService);
  private readonly auth = inject(AuthService);
  private readonly dialogs = inject(DialogService);
  private readonly toast = inject(ToastService);

  protected readonly rows = signal<Liability[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly filter = signal<Filter>('ALL');
  protected readonly query = signal('');

  protected readonly canManage = computed(() => this.auth.hasPermission('LIABILITY_MANAGE'));

  private readonly disputed = (l: Liability) => l.items.some((i) => i.disputed && !i.acknowledgedAt);

  /** Totals always cover the full list — filters only narrow what is shown. */
  protected readonly stats = computed(() => {
    const rows = this.rows();
    const items = rows.flatMap((l) => l.items);
    return {
      open: rows.reduce((s, l) => s + l.balance, 0),
      paid: rows.reduce((s, l) => s + (l.amount - l.balance), 0),
      disputes: items.filter((i) => i.disputed && !i.acknowledgedAt).length,
      pending: items.filter((i) => !i.acknowledgedAt && !i.disputed).length,
      people: new Set(rows.filter((l) => l.balance > 0).map((l) => l.userUid)).size,
    };
  });

  protected readonly filters = computed<SegmentOption<Filter>[]>(() => {
    const rows = this.rows();
    const n = (s: LiabilityStatus) => rows.filter((l) => l.status === s).length;
    const t = (s: LiabilityStatus) => (this.i18n.isSwahili() ? LIABILITY_STATUS[s].sw : LIABILITY_STATUS[s].en);
    return [
      { value: 'ALL', label: this.i18n.t('All', 'Zote'), count: rows.length || undefined },
      { value: 'DISPUTED', label: this.i18n.t('Disputed', 'Zenye mzozo'), icon: 'report', count: rows.filter(this.disputed).length || undefined },
      ...(['OPEN', 'PARTIALLY_PAID', 'SETTLED', 'WAIVED'] as LiabilityStatus[]).map((s) => ({ value: s as Filter, label: t(s), count: n(s) || undefined })),
    ];
  });

  protected readonly shown = computed(() => {
    const f = this.filter();
    const q = this.query().trim().toLowerCase();
    let rows = [...this.rows()].sort((a, b) => Number(this.disputed(b)) - Number(this.disputed(a)) || (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));
    if (f === 'DISPUTED') rows = rows.filter(this.disputed);
    else if (f !== 'ALL') rows = rows.filter((l) => l.status === f);
    if (q) {
      rows = rows.filter(
        (l) => (this.owner(l) ?? '').toLowerCase().includes(q) || l.items.some((i) => i.productName.toLowerCase().includes(q)) || (l.sessionUid ?? '').toLowerCase().includes(q),
      );
    }
    return rows;
  });

  constructor() {
    void this.load();
    void this.api.staff.load().catch(() => undefined);
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      this.rows.set(await this.api.allLiabilities());
    } catch (e) {
      this.error.set(ApiError.from(e).message);
    } finally {
      this.loading.set(false);
    }
  }

  protected owner(l: Liability): string {
    return this.api.staffName(l.userUid) ?? this.i18n.t('Staff member', 'Mfanyakazi');
  }

  protected async pay(l: Liability): Promise<void> {
    const { LiabilityPaymentDialog } = await import('./liability-dialogs');
    const updated = await this.dialogs.openAsync<Liability, LiabilityDialogData>(LiabilityPaymentDialog, { size: 'sm', data: { liability: l, owner: this.owner(l) } });
    if (updated) {
      this.replace(updated);
      this.toast.success(this.i18n.t('Payment recorded', 'Malipo yamerekodiwa'));
    }
  }

  protected async plan(l: Liability): Promise<void> {
    const { DeductionPlanDialog } = await import('./liability-dialogs');
    const updated = await this.dialogs.openAsync<Liability, LiabilityDialogData>(DeductionPlanDialog, { size: 'sm', data: { liability: l, owner: this.owner(l) } });
    if (updated) {
      this.replace(updated);
      this.toast.success(this.i18n.t('Deduction plan saved', 'Mpango wa makato umewekwa'));
    }
  }

  protected async voidSurplus(l: Liability): Promise<void> {
    const { ReasonDialog } = await import('../reconciliation/reason-dialog');
    const surplus = l.items.filter(isSurplusItem);
    const mixed = surplus.length < l.items.length;
    const removed = Money.format(surplus.reduce((s, i) => s + i.lineAmount, 0), { decimals: 0 });
    const remaining = Money.format(l.amount - surplus.reduce((s, i) => s + i.lineAmount, 0), { decimals: 0 });
    const reason = await this.dialogs.openAsync<string>(ReasonDialog, {
      size: 'sm',
      data: mixed
        ? {
            title: this.i18n.t('Remove surplus lines', 'Ondoa ziada'),
            message: this.i18n.t(
              `${surplus.length} line(s) of this debt were counted MORE than expected (${removed}) — nothing was missing there. Those lines are removed; the real shortage of ${remaining} stays owed. No ledger entry is made.`,
              `Kipengele ${surplus.length} cha deni hili kilihesabiwa ZAIDI ya kilichotarajiwa (${removed}) — hapo hakuna kilichopotea. Vipengele hivyo vitaondolewa; upungufu halisi wa ${remaining} unabaki kudaiwa. Hakuna entry ya leja.`,
            ),
            label: this.i18n.t('Reason', 'Sababu'),
            confirm: this.i18n.t('Remove surplus', 'Ondoa ziada'),
            danger: true,
            min: 5,
          }
        : {
            title: this.i18n.t('Cancel surplus charge', 'Futa deni la ziada'),
            message: this.i18n.t(
              'Every line of this debt was counted MORE than expected, so nothing was missing. The debt is cancelled (Waived); no payment or ledger entry is made.',
              'Kila kipengele cha deni hili kilihesabiwa ZAIDI ya kilichotarajiwa, hivyo hakuna kilichopotea. Deni litafutwa (Limesamehewa) bila malipo wala entry ya leja.',
            ),
            label: this.i18n.t('Reason', 'Sababu'),
            confirm: this.i18n.t('Cancel debt', 'Futa deni'),
            danger: true,
            min: 5,
          },
    });
    if (!reason) return;
    try {
      this.replace(await this.api.voidSurplus(l.uid, reason));
      this.toast.success(
        mixed ? this.i18n.t('Surplus lines removed', 'Ziada imeondolewa') : this.i18n.t('Surplus charge cancelled', 'Deni la ziada limefutwa'),
      );
    } catch (e) {
      this.toast.error(ApiError.from(e).message);
    }
  }

  private replace(updated: Liability): void {
    this.rows.update((list) => list.map((l) => (l.uid === updated.uid ? updated : l)));
  }
}
