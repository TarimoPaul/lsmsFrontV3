import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';

import { ApiError } from '@core/api/api.types';
import { AuthService } from '@core/auth/auth.service';
import { LanguageService } from '@core/i18n/language.service';
import { Button, DataTable, DialogService, Icon, MetricCard, MetricsGrid, TableColumn, ToastService } from '@shared/ui';
import { parseLocal } from '@shared/utils/date-utils';
import { Money, MoneyPipe } from '@shared/utils/money';
import { Expenditure, ExpStatus, STATUS, typeIcon, typeLabel } from './capital.models';
import { CapitalService } from './capital.service';

/**
 * Fixed assets: cost on the balance sheet, depreciated straight-line one
 * journal per month (catch-up safe), net book value = cost − accumulated
 * depreciation. Disposal books the gain / loss against the book value.
 */
@Component({
  selector: 'app-assets-tab',
  imports: [DataTable, TableColumn, Button, Icon, MetricCard, MetricsGrid, MoneyPipe, DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <lsms-metrics-grid [gap]="12">
      <lsms-metric-card [title]="i18n.t('Cost of assets in use', 'Gharama ya mali zinazotumika')" [value]="stats().cost | money: { decimals: 0 }" icon="chair" color="var(--c-primary)" [subtitle]="i18n.t(stats().count + ' asset(s)', 'Mali ' + stats().count)" />
      <lsms-metric-card [title]="i18n.t('Depreciated so far', 'Uchakavu hadi sasa')" [value]="stats().acc | money: { decimals: 0 }" icon="trending_down" color="var(--c-warning)" />
      <lsms-metric-card [title]="i18n.t('Net book value', 'Thamani kitabuni')" [value]="stats().nbv | money: { decimals: 0 }" icon="account_balance" color="var(--c-success)" />
      <lsms-metric-card [title]="i18n.t('Depreciation per month', 'Uchakavu kwa mwezi')" [value]="stats().monthly | money: { decimals: 0 }" icon="event_repeat" color="var(--c-info)" />
    </lsms-metrics-grid>

    <div class="bar">
      <span class="sp"></span>
      @if (canManage()) {
        <button lsmsButton="secondary" icon="sync" [loading]="running()" (click)="depreciate()">{{ i18n.t('Bring depreciation up to date', 'Sasisha uchakavu') }}</button>
      }
      @if (canWrite()) {
        <button lsmsButton="primary" icon="add" (click)="create()">{{ i18n.t('New asset', 'Mali mpya') }}</button>
      }
    </div>

    <div class="table-card">
      <lsms-data-table
        [title]="i18n.t('Fixed assets', 'Mali za kudumu')"
        [items]="rows()"
        [loading]="loading()"
        [pageSize]="25"
        [mobileTitle]="descOf"
        [mobileColumns]="['nbv', 'status', 'actions']"
        [mobileCompactColumns]="['nbv']"
        [emptyTitle]="i18n.t('No fixed assets yet', 'Hakuna mali za kudumu bado')"
        emptyIcon="chair"
      >
        <ng-template lsmsColumn="asset" [label]="i18n.t('Asset', 'Mali')" [locked]="true" let-row>
          <span class="what">
            <span class="ic"><lsms-icon [name]="icon(row.capitalType)" [size]="17" /></span>
            <span class="cell-stack"><strong>{{ row.description }}</strong><small>{{ type(row.capitalType) }} · {{ day(row.transactionDate) | date: 'MMM yyyy' }}</small></span>
          </span>
        </ng-template>
        <ng-template lsmsColumn="cost" [label]="i18n.t('Cost', 'Gharama')" align="end" let-row>
          <span class="num">{{ row.amount | money: { decimals: 0 } }}</span>
        </ng-template>
        <ng-template lsmsColumn="life" [label]="i18n.t('Life used', 'Muda uliotumika')" let-row>
          <span class="life">
            <span class="track"><span [style.width.%]="usedPct(row)"></span></span>
            <small>{{ usedMonths(row) }}/{{ row.assetLifeMonths }} {{ i18n.t('mo', 'miezi') }}</small>
          </span>
        </ng-template>
        <ng-template lsmsColumn="acc" [label]="i18n.t('Depreciated', 'Uchakavu')" align="end" let-row>
          <span class="cell-stack num"><span>{{ row.accumulatedDepreciation ?? 0 | money: { decimals: 0 } }}</span><small>{{ row.monthlyDepreciation ?? 0 | money: { decimals: 0 } }}/{{ i18n.t('mo', 'mwezi') }}</small></span>
        </ng-template>
        <ng-template lsmsColumn="nbv" [label]="i18n.t('Book value', 'Thamani kitabuni')" align="end" let-row>
          <span class="num strong">{{ row.status === 'DISPOSED' ? '—' : (nbv(row) | money: { decimals: 0 }) }}</span>
        </ng-template>
        <ng-template lsmsColumn="status" [label]="i18n.t('Status', 'Hali')" let-row>
          @let st = status(row.status);
          <span class="pill" [style.--pc]="st.color"><lsms-icon [name]="st.icon" [size]="13" />{{ (i18n.isSwahili() ? st.sw : st.en).split(' · ')[0] }}</span>
        </ng-template>
        <ng-template lsmsColumn="actions" let-row>
          <span class="acts">
            @if (row.status === 'PENDING' && canApprove()) {
              <button lsmsButton="success" size="sm" icon="check" [loading]="busy() === row.uid" [disabled]="!!busy()" (click)="approve(row)">{{ i18n.t('Approve', 'Idhinisha') }}</button>
            }
            @if (row.status === 'APPROVED' && canManage()) {
              <button lsmsButton="text" size="sm" icon="delete_sweep" [disabled]="!!busy()" (click)="dispose(row)">{{ i18n.t('Dispose', 'Ondoa') }}</button>
            }
          </span>
        </ng-template>
      </lsms-data-table>
    </div>
  `,
  styles: `
    @use 'list-page';
    @include list-page.base;
    :host { display: flex; flex-direction: column; gap: 12px; }
    .bar { display: flex; align-items: center; flex-wrap: wrap; gap: 10px; }
    .sp { flex: 1; }
    .what { display: inline-flex; align-items: center; gap: 10px; }
    .ic { display: inline-flex; padding: 7px; border-radius: 10px; color: var(--c-secondary); background: color-mix(in srgb, var(--c-secondary) 10%, transparent); }
    .life { display: inline-flex; flex-direction: column; gap: 3px; min-width: 110px; }
    .track { height: 6px; border-radius: 6px; background: color-mix(in srgb, var(--c-text-2) 14%, transparent); overflow: hidden; }
    .track span { display: block; height: 100%; background: var(--c-warning); }
    .life small { font-size: 0.7rem; color: var(--c-text-2); }
    .pill { display: inline-flex; align-items: center; gap: 4px; padding: 2px 9px; border-radius: 100px; font-size: 0.7rem; font-weight: 600; white-space: nowrap; color: var(--pc); background: color-mix(in srgb, var(--pc) 12%, transparent); }
    .acts { display: inline-flex; gap: 4px; justify-content: flex-end; }
  `,
})
export class AssetsTab {
  protected readonly i18n = inject(LanguageService);
  private readonly api = inject(CapitalService);
  private readonly auth = inject(AuthService);
  private readonly dialogs = inject(DialogService);
  private readonly toast = inject(ToastService);

  protected readonly busy = signal<string | null>(null);
  protected readonly running = signal(false);
  protected readonly loading = this.api.all.initialLoading;

  protected readonly canWrite = computed(() => this.auth.hasPermission('CAPITAL_WRITE') || this.auth.hasPermission('CAPITAL_ASSET_WRITE'));
  protected readonly canApprove = computed(() => this.auth.hasPermission('CAPITAL_APPROVE'));
  protected readonly canManage = computed(() => this.auth.hasPermission('CAPITAL_ASSET_MANAGE'));

  protected readonly rows = computed(() =>
    (this.api.all.value() ?? []).filter((e) => e.asset && e.status !== 'REJECTED' && e.status !== 'CANCELLED'),
  );
  protected readonly stats = computed(() => {
    const live = this.rows().filter((e) => e.status === 'APPROVED');
    return {
      count: live.length,
      cost: live.reduce((s, e) => s + e.amount, 0),
      acc: live.reduce((s, e) => s + (e.accumulatedDepreciation ?? 0), 0),
      nbv: live.reduce((s, e) => s + this.nbv(e), 0),
      monthly: live.filter((e) => this.nbv(e) > (e.salvageValue ?? 0)).reduce((s, e) => s + (e.monthlyDepreciation ?? 0), 0),
    };
  });

  protected readonly descOf = (e: Expenditure) => e.description;

  constructor() {
    void this.api.all.load();
  }

  protected nbv(e: Expenditure): number {
    return e.amount - (e.accumulatedDepreciation ?? 0);
  }

  protected usedMonths(e: Expenditure): number {
    const m = e.monthlyDepreciation ?? 0;
    return m > 0 ? Math.min(e.assetLifeMonths ?? 0, Math.round((e.accumulatedDepreciation ?? 0) / m)) : 0;
  }

  protected usedPct(e: Expenditure): number {
    return e.assetLifeMonths ? Math.min(100, (this.usedMonths(e) / e.assetLifeMonths) * 100) : 0;
  }

  protected async create(): Promise<void> {
    const { AssetDialog } = await import('./capital-dialogs');
    const created = await this.dialogs.openAsync<Expenditure>(AssetDialog, { size: 'md', disableClose: true });
    if (created) {
      await this.api.all.load(true);
      this.toast.success(this.i18n.t('Asset saved — waiting for approval', 'Mali imehifadhiwa — inasubiri idhini'));
    }
  }

  protected async approve(e: Expenditure): Promise<void> {
    const ok = await this.dialogs.confirm({
      title: this.i18n.t('Approve asset', 'Idhinisha mali'),
      message: `${e.description} · ${Money.format(e.amount)}\n${this.i18n.t('Posts Dr fixed assets / Cr the paying account, then depreciates monthly.', 'Inaandika Dr mali za kudumu / Cr akaunti iliyolipa, kisha uchakavu kila mwezi.')}`,
      confirmText: this.i18n.t('Approve', 'Idhinisha'),
      cancelText: this.i18n.t('Cancel', 'Ghairi'),
    });
    if (!ok) return;
    this.busy.set(e.uid);
    try {
      await this.api.approve(e.uid);
      await this.api.runDepreciation().catch(() => undefined);
      await this.api.all.load(true);
      this.toast.success(this.i18n.t('Asset approved', 'Mali imeidhinishwa'));
    } catch (err) {
      this.toast.error(ApiError.from(err).message);
    } finally {
      this.busy.set(null);
    }
  }

  protected async dispose(e: Expenditure): Promise<void> {
    const { DisposeDialog } = await import('./capital-dialogs');
    const ok = await this.dialogs.openAsync<boolean, Expenditure>(DisposeDialog, { size: 'sm', data: e });
    if (ok) {
      await this.api.all.load(true);
      this.toast.success(this.i18n.t('Asset disposed', 'Mali imeondolewa'));
    }
  }

  protected async depreciate(): Promise<void> {
    this.running.set(true);
    try {
      await this.api.runDepreciation();
      await this.api.all.load(true);
      this.toast.success(this.i18n.t('Depreciation is up to date', 'Uchakavu umesasishwa'));
    } catch (err) {
      this.toast.error(ApiError.from(err).message);
    } finally {
      this.running.set(false);
    }
  }

  protected type(t: string): string {
    return typeLabel(t, this.i18n.isSwahili());
  }

  protected icon(t: string): string {
    return typeIcon(t);
  }

  protected status(s: ExpStatus) {
    return STATUS[s] ?? STATUS.PENDING;
  }

  protected day(v: string | null): Date | null {
    return parseLocal(v);
  }
}
