import { ChangeDetectionStrategy, Component, computed, inject, signal, viewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

import { AuthService } from '@core/auth/auth.service';
import { LanguageService } from '@core/i18n/language.service';
import { EmptyState, PageHeader, SegmentOption, SegmentedFilterBar } from '@shared/ui';
import { AssetsTab } from './assets/assets-tab';
import { CountTab } from './count-tab';
import { CountStore } from './count.store';
import { MyLiabilitiesTab } from './my-liabilities-tab';
import { SessionsTab } from './sessions-tab';
import { StaffLiabilitiesTab } from './staff-liabilities-tab';

type Tab = 'count' | 'approval' | 'history' | 'assets' | 'my-liabilities' | 'staff-liabilities';

/**
 * Stock count module — port of Flutter `CountingMainScreen`. Tabs appear only
 * for what the user can act on (hide, don't deny): Count (COUNTING_PERFORM),
 * Approval (COUNTING_APPROVE), History (either), Assets (COUNTING_PERFORM /
 * ASSET_COUNT_MANAGE / ASSET_COUNT_APPROVE — asset register + verification), My debts
 * (LIABILITY_READ_OWN), Staff debts (LIABILITY_READ_ALL / LIABILITY_MANAGE).
 * `?tab=` selects a tab (the dashboard's liability alert opens My debts).
 */
@Component({
  selector: 'app-counting-page',
  imports: [PageHeader, SegmentedFilterBar, EmptyState, CountTab, SessionsTab, AssetsTab, MyLiabilitiesTab, StaffLiabilitiesTab],
  providers: [CountStore],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="wrap">
      <lsms-page-header
        [title]="i18n.t('Stock count', 'Kuhesabu mali')"
        [subtitle]="i18n.t('Blind stock counts, asset verification, approvals and staff shortage debts', 'Kuhesabu stock kwa blind count, uhakiki wa mali za duka, uthibitisho na madeni ya uhaba ya wafanyakazi')"
        icon="checklist"
        [refreshable]="tabs().length > 0"
        (refresh)="refresh()"
      />
      @if (!tabs().length) {
        <lsms-empty-state icon="lock" [title]="i18n.t('No access', 'Huna ruhusa')" [message]="i18n.t('You have no Stock count permissions.', 'Huna ruhusa yoyote ya moduli ya Kuhesabu Mali.')" />
      } @else {
        <lsms-segmented-filter-bar class="tabs" [options]="tabs()" [selected]="tab()" (selectedChange)="setTab($event)" />
        @switch (tab()) {
          @case ('count') { <app-count-tab /> }
          @case ('approval') { <app-sessions-tab #sessions mode="queue" /> }
          @case ('history') { <app-sessions-tab #sessions mode="history" /> }
          @case ('assets') { <app-assets-tab #assets /> }
          @case ('my-liabilities') { <app-my-liabilities-tab #mine /> }
          @case ('staff-liabilities') { <app-staff-liabilities-tab #staff /> }
        }
      }
    </div>
  `,
  styles: `
    @use 'list-page';
    @include list-page.base;
    .tabs { display: flex; }
  `,
})
export class CountingPage {
  protected readonly i18n = inject(LanguageService);
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly store = inject(CountStore);

  private readonly sessions = viewChild<SessionsTab>('sessions');
  private readonly assets = viewChild<AssetsTab>('assets');
  private readonly mine = viewChild<MyLiabilitiesTab>('mine');
  private readonly staff = viewChild<StaffLiabilitiesTab>('staff');

  protected readonly tabs = computed<SegmentOption<Tab>[]>(() => {
    const has = (p: string) => this.auth.hasPermission(p);
    const t = (en: string, sw: string) => this.i18n.t(en, sw);
    const perform = has('COUNTING_PERFORM');
    const approve = has('COUNTING_APPROVE');
    return [
      ...(perform ? [{ value: 'count' as Tab, label: t('Count', 'Hesabu'), icon: 'checklist' }] : []),
      ...(approve ? [{ value: 'approval' as Tab, label: t('Approval', 'Kuthibitisha'), icon: 'fact_check' }] : []),
      ...(perform || approve ? [{ value: 'history' as Tab, label: t('History', 'Historia'), icon: 'history' }] : []),
      ...(perform || has('ASSET_COUNT_MANAGE') || has('ASSET_COUNT_APPROVE') ? [{ value: 'assets' as Tab, label: t('Assets', 'Mali za duka'), icon: 'chair' }] : []),
      ...(has('LIABILITY_READ_OWN') ? [{ value: 'my-liabilities' as Tab, label: t('My debts', 'Madeni yangu'), icon: 'account_balance_wallet' }] : []),
      ...(has('LIABILITY_READ_ALL') || has('LIABILITY_MANAGE') ? [{ value: 'staff-liabilities' as Tab, label: t('Staff debts', 'Madeni ya wafanyakazi'), icon: 'groups' }] : []),
    ];
  });

  protected readonly tab = signal<Tab>('count');

  constructor() {
    const wanted = this.route.snapshot.queryParamMap.get('tab') as Tab | null;
    const allowed = this.tabs().map((o) => o.value);
    this.tab.set(wanted && allowed.includes(wanted) ? wanted : (allowed[0] ?? 'count'));
  }

  protected setTab(t: Tab): void {
    this.tab.set(t);
    void this.router.navigate([], { queryParams: { tab: t }, replaceUrl: true });
  }

  protected refresh(): void {
    switch (this.tab()) {
      case 'count':
        void this.store.resume();
        break;
      case 'approval':
      case 'history':
        void this.sessions()?.load();
        break;
      case 'assets':
        this.assets()?.load();
        break;
      case 'my-liabilities':
        void this.mine()?.load();
        break;
      case 'staff-liabilities':
        void this.staff()?.load();
        break;
    }
  }
}
