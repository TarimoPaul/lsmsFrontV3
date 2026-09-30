import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

import { LanguageService } from '@core/i18n/language.service';
import { DateRangeSelector, DialogService, PageHeader, SegmentOption, SegmentedFilterBar, ToastService } from '@shared/ui';
import { DateRange, rangeForPreset, toIsoDate } from '@shared/utils/date-utils';
import { GlAccounts } from './gl-accounts';
import { GlBalanceSheet } from './gl-balance-sheet';
import type { LedgerDialogData, TrueUpDialogData } from './gl-dialogs';
import { GlJournal } from './gl-journal';
import { GlOverview } from './gl-overview';
import { GlPnl } from './gl-pnl';
import { GlTrialBalance } from './gl-trial-balance';
import { ControlCheck } from './gl.models';
import { GlService } from './gl.service';

type Tab = 'overview' | 'balance-sheet' | 'pnl' | 'trial-balance' | 'journal' | 'accounts';
const TABS: Tab[] = ['overview', 'balance-sheet', 'pnl', 'trial-balance', 'journal', 'accounts'];

/**
 * General Ledger — the accountant's workspace. One period drives every tab:
 * statements "as of" use its end date; P&L, trial-balance movement and the
 * journal use the whole range. Any account opens its ledger.
 */
@Component({
  selector: 'app-gl-page',
  imports: [PageHeader, SegmentedFilterBar, DateRangeSelector, GlOverview, GlBalanceSheet, GlPnl, GlTrialBalance, GlJournal, GlAccounts],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="wrap">
      <lsms-page-header
        [title]="i18n.t('General Ledger', 'Leja Kuu')"
        [subtitle]="i18n.t('Double-entry books: statements, journal and health checks', 'Vitabu vya double-entry: taarifa, journal na ukaguzi wa afya')"
        icon="menu_book"
        [refreshable]="true"
        (refresh)="gl.touch()"
      />
      <div class="bar">
        <lsms-segmented-filter-bar class="tabs" [options]="tabs()" [selected]="tab()" (selectedChange)="setTab($event)" />
        <lsms-date-range-selector [range]="range()" [max]="today" (rangeChange)="range.set($event)" />
      </div>
      @switch (tab()) {
        @case ('overview') { <app-gl-overview [asOf]="end()" (openAccount)="ledger($event)" (trueUp)="trueUp($event)" (cashCount)="cashCount($event)" /> }
        @case ('balance-sheet') { <app-gl-balance-sheet [asOf]="end()" (openAccount)="ledger($event)" /> }
        @case ('pnl') { <app-gl-pnl [start]="start()" [end]="end()" (openAccount)="ledger($event)" /> }
        @case ('trial-balance') { <app-gl-trial-balance [start]="start()" [end]="end()" (openAccount)="ledger($event)" /> }
        @case ('journal') { <app-gl-journal [start]="start()" [end]="end()" (openAccount)="ledger($event)" (manual)="manual()" (transfer)="transfer()" /> }
        @case ('accounts') { <app-gl-accounts [start]="start()" [end]="end()" (openAccount)="ledger($event)" /> }
      }
    </div>
  `,
  styles: `
    @use 'list-page';
    @include list-page.base;
    .bar { display: flex; align-items: center; flex-wrap: wrap; gap: 10px 14px; }
    .tabs { flex: 1 1 520px; min-width: 0; display: flex; }
  `,
})
export class GlPage {
  protected readonly i18n = inject(LanguageService);
  protected readonly gl = inject(GlService);
  private readonly dialogs = inject(DialogService);
  private readonly toast = inject(ToastService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly today = new Date();
  protected readonly range = signal<DateRange>(rangeForPreset('thisYear'));
  protected readonly start = computed(() => toIsoDate(this.range().start));
  protected readonly end = computed(() => toIsoDate(this.range().end));
  protected readonly tab = signal<Tab>('overview');

  protected readonly tabs = computed<SegmentOption<Tab>[]>(() => {
    const t = (en: string, sw: string) => this.i18n.t(en, sw);
    return [
      { value: 'overview', label: t('Health', 'Afya ya vitabu'), icon: 'monitor_heart' },
      { value: 'balance-sheet', label: t('Balance sheet', 'Mizania'), icon: 'balance' },
      { value: 'pnl', label: t('Profit & loss', 'Faida na hasara'), icon: 'query_stats' },
      { value: 'trial-balance', label: t('Trial balance', 'Trial balance'), icon: 'table_rows' },
      { value: 'journal', label: t('Journal', 'Journal'), icon: 'receipt_long' },
      { value: 'accounts', label: t('Accounts', 'Akaunti'), icon: 'account_tree' },
    ];
  });

  constructor() {
    const wanted = this.route.snapshot.queryParamMap.get('tab') as Tab | null;
    if (wanted && TABS.includes(wanted)) this.tab.set(wanted);
  }

  protected setTab(t: Tab): void {
    this.tab.set(t);
    void this.router.navigate([], { queryParams: { tab: t }, replaceUrl: true });
  }

  protected async ledger(accountCode: string): Promise<void> {
    const { LedgerDialog } = await import('./gl-dialogs');
    this.dialogs.open<void, LedgerDialogData>(LedgerDialog, { size: 'lg', data: { accountCode, start: this.start(), end: this.end() } });
  }

  protected async manual(): Promise<void> {
    const { ManualJournalDialog } = await import('./gl-dialogs');
    const ok = await this.dialogs.openAsync<boolean>(ManualJournalDialog, { size: 'lg', disableClose: true });
    if (ok) this.toast.success(this.i18n.t('Journal posted', 'Journal imeandikwa'));
  }

  protected async transfer(): Promise<void> {
    const { TransferDialog } = await import('./gl-dialogs');
    const ok = await this.dialogs.openAsync<boolean>(TransferDialog, { size: 'md' });
    if (ok) this.toast.success(this.i18n.t('Transfer recorded', 'Uhamisho umeandikwa'));
  }

  protected async trueUp(check: ControlCheck): Promise<void> {
    const { TrueUpDialog } = await import('./gl-dialogs');
    const ok = await this.dialogs.openAsync<boolean, TrueUpDialogData>(TrueUpDialog, { size: 'md', data: { check, asOf: this.end() } });
    if (ok) this.toast.success(this.i18n.t('Correction posted', 'Marekebisho yameandikwa'));
  }

  protected async cashCount(code: string): Promise<void> {
    const [{ TrueUpDialog }, pos] = await Promise.all([import('./gl-dialogs'), this.gl.position(this.end())]);
    const bal = pos.cashAccounts.find((a) => a.code === code)?.amount ?? 0;
    const ok = await this.dialogs.openAsync<boolean, TrueUpDialogData>(TrueUpDialog, {
      size: 'md',
      data: { cashCode: code, cashBalance: bal, asOf: this.end() },
    });
    if (ok) this.toast.success(this.i18n.t('Cash balance corrected', 'Salio la pesa limerekebishwa'));
  }
}
