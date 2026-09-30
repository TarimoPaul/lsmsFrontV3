import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

import { LanguageService } from '@core/i18n/language.service';
import { PageHeader, SegmentOption, SegmentedFilterBar } from '@shared/ui';
import { GlService } from '../general-ledger/gl.service';
import { AssetsTab } from './assets-tab';
import { CapitalOverview } from './capital-overview';
import { CapitalService } from './capital.service';
import { ExpensesTab } from './expenses-tab';
import { LoansTab } from './loans-tab';
import { OwnerTab } from './owner-tab';

type Tab = 'overview' | 'expenses' | 'assets' | 'loans' | 'owner';
const TABS: Tab[] = ['overview', 'expenses', 'assets', 'loans', 'owner'];

/**
 * Capital management — what the business is worth and where money goes:
 * position (from the GL), operating expenses (maker-checker), fixed assets
 * (depreciation), loans and owner capital. Every approved action is a journal.
 */
@Component({
  selector: 'app-capital-page',
  imports: [PageHeader, SegmentedFilterBar, CapitalOverview, ExpensesTab, AssetsTab, LoansTab, OwnerTab],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="wrap">
      <lsms-page-header
        [title]="i18n.t('Capital', 'Mtaji')"
        [subtitle]="i18n.t('Net worth, expenses, fixed assets, loans and owner capital', 'Thamani ya biashara, gharama, mali za kudumu, mikopo na mtaji wa mmiliki')"
        icon="account_balance"
        [refreshable]="true"
        (refresh)="refresh()"
      />
      <lsms-segmented-filter-bar class="tabs" [options]="tabs()" [selected]="tab()" (selectedChange)="setTab($event)" />
      @switch (tab()) {
        @case ('overview') { <app-capital-overview /> }
        @case ('expenses') { <app-expenses-tab /> }
        @case ('assets') { <app-assets-tab /> }
        @case ('loans') { <app-loans-tab /> }
        @case ('owner') { <app-owner-tab /> }
      }
    </div>
  `,
  styles: `
    @use 'list-page';
    @include list-page.base;
    .tabs { display: flex; }
  `,
})
export class CapitalPage {
  protected readonly i18n = inject(LanguageService);
  private readonly api = inject(CapitalService);
  private readonly gl = inject(GlService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly tab = signal<Tab>('overview');
  protected readonly tabs = computed<SegmentOption<Tab>[]>(() => {
    const t = (en: string, sw: string) => this.i18n.t(en, sw);
    const pending = (this.api.all.value() ?? []).filter((e) => e.status === 'PENDING' && e.capitalType !== 'PRODUCT_CAPITAL' && e.capitalType !== 'INVENTORY_CAPITAL').length;
    return [
      { value: 'overview', label: t('Position', 'Hali ya mtaji'), icon: 'account_balance' },
      { value: 'expenses', label: t('Expenses', 'Gharama'), icon: 'receipt_long', count: pending || undefined },
      { value: 'assets', label: t('Fixed assets', 'Mali za kudumu'), icon: 'chair' },
      { value: 'loans', label: t('Loans', 'Mikopo'), icon: 'request_quote' },
      { value: 'owner', label: t('Owner capital', 'Mtaji wa mmiliki'), icon: 'savings' },
    ];
  });

  constructor() {
    const wanted = this.route.snapshot.queryParamMap.get('tab') as Tab | null;
    if (wanted && TABS.includes(wanted)) this.tab.set(wanted);
    void this.api.all.load();
  }

  protected setTab(t: Tab): void {
    this.tab.set(t);
    void this.router.navigate([], { queryParams: { tab: t }, replaceUrl: true });
  }

  protected refresh(): void {
    void this.api.all.load(true);
    void this.api.loans.load(true);
    void this.api.movements.load(true);
    this.gl.touch();
  }
}
