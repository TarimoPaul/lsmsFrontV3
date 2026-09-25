import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { DatePipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';

import { ApiError } from '@core/api/api.types';
import { AuthService } from '@core/auth/auth.service';
import { LanguageService } from '@core/i18n/language.service';
import { Button, DialogShell, Icon, SegmentOption, SegmentedFilterBar, Skeleton } from '@shared/ui';
import { parseLocal } from '@shared/utils/date-utils';
import { MoneyPipe } from '@shared/utils/money';
import { AuditEntry, CUSTOMER_TYPES, Customer, CustomerAnalytics, PAYMENT_STATUS, PurchaseRecord, customerInitials } from './customers.models';
import { CustomersService } from './customers.service';

export interface CustomerDetailsData {
  customer: Customer;
}

export type CustomerDetailsResult = 'edit' | 'statement' | undefined;

type Tab = 'overview' | 'purchases' | 'history';

/**
 * Customer details — port of Flutter `CustomerDetailScreen` (profile,
 * purchases, activity, analytics, audit) as a tabbed dialog. Each tab loads
 * only when first opened; analytics / purchases / history need
 * CUSTOMER_ANALYTICS.
 */
@Component({
  selector: 'app-customer-details-dialog',
  imports: [DialogShell, Button, Icon, Skeleton, SegmentedFilterBar, MoneyPipe, DatePipe, DecimalPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './customer-details-dialog.html',
  styles: `
    @use 'detail-dialog';
    @include detail-dialog.base;
    .head { display: flex; align-items: center; gap: 14px; margin-bottom: 14px; }
    .avatar {
      display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; width: 56px; height: 56px; border-radius: 50%;
      font-size: 1.1rem; font-weight: 800; color: #fff; background: linear-gradient(135deg, var(--c-primary), var(--c-secondary));
    }
    .who { flex: 1; min-width: 0; }
    .who h3 { font-size: 1.2rem; font-weight: 800; }
    .who p { display: flex; flex-wrap: wrap; gap: 6px 12px; margin-top: 4px; font-size: 0.82rem; color: var(--c-text-2); }
    .who p span { display: inline-flex; align-items: center; gap: 4px; }
    .who a { color: inherit; }
    lsms-segmented-filter-bar { display: block; margin-bottom: 12px; }
    .kpis { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; margin-bottom: 12px; }
    @media (max-width: 700px) { .kpis { grid-template-columns: 1fr 1fr; } }
    .kpis div { display: flex; flex-direction: column; gap: 2px; padding: 10px 12px; border-radius: 12px; background: var(--c-bg); border: 1px solid var(--c-border); }
    .kpis small { font-size: 0.7rem; color: var(--c-text-2); }
    .kpis b { font-size: 1rem; font-weight: 800; font-variant-numeric: tabular-nums; }
    .kpis .owe b { color: var(--c-error); }
    .badges { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 10px; }
    .meter { margin-top: 6px; }
    .meter .track { height: 8px; border-radius: 4px; overflow: hidden; background: color-mix(in srgb, var(--c-error) 18%, transparent); }
    .meter .track i { display: block; height: 100%; background: var(--c-success); }
    .meter small { display: flex; justify-content: space-between; margin-top: 4px; font-size: 0.72rem; color: var(--c-text-2); }
    dl { display: grid; grid-template-columns: auto 1fr; gap: 8px 14px; margin: 0; font-size: 0.84rem; }
    dt { color: var(--c-text-2); }
    dd { margin: 0; font-weight: 600; text-align: right; }
    .timeline { list-style: none; margin: 0; padding: 0 0 0 14px; border-left: 2px solid var(--c-border); }
    .timeline li { position: relative; padding: 0 0 12px 12px; font-size: 0.82rem; }
    .timeline li::before { content: ''; position: absolute; left: -20px; top: 4px; width: 10px; height: 10px; border-radius: 50%; background: var(--c-primary); box-shadow: 0 0 0 3px var(--c-surface); }
    .timeline b { display: block; }
    .timeline small { color: var(--c-text-2); }
  `,
})
export class CustomerDetailsDialog {
  protected readonly data = inject<CustomerDetailsData>(DIALOG_DATA);
  protected readonly ref = inject<DialogRef<CustomerDetailsResult>>(DialogRef);
  protected readonly i18n = inject(LanguageService);
  private readonly auth = inject(AuthService);
  private readonly api = inject(CustomersService);

  protected readonly c = this.data.customer;
  protected readonly initials = customerInitials(this.c.name);
  protected readonly type = CUSTOMER_TYPES[this.c.customerType];
  protected readonly statusMeta = PAYMENT_STATUS;
  protected readonly canAnalytics = this.auth.hasPermission('CUSTOMER_ANALYTICS');
  protected readonly canStatement = this.auth.hasPermission('CUSTOMER_CREDIT_VIEW');
  protected readonly canEdit = this.auth.hasPermission('CUSTOMER_UPDATE');

  protected readonly tab = signal<Tab>('overview');
  protected readonly tabs = computed<SegmentOption<Tab>[]>(() => {
    const t = (en: string, sw: string) => this.i18n.t(en, sw);
    const list: SegmentOption<Tab>[] = [{ value: 'overview', label: t('Overview', 'Muhtasari'), icon: 'person' }];
    if (this.canAnalytics) {
      list.push(
        { value: 'purchases', label: t('Purchases', 'Manunuzi'), icon: 'shopping_bag', count: this.c.salesCount },
        { value: 'history', label: t('History', 'Historia'), icon: 'history' },
      );
    }
    return list;
  });

  protected readonly analytics = signal<CustomerAnalytics | null>(null);
  protected readonly purchases = signal<PurchaseRecord[] | null>(null);
  protected readonly audit = signal<AuditEntry[] | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly creditUse = this.c.creditLimit ? this.c.outstandingBalance / this.c.creditLimit : null;

  constructor() {
    // Load each tab's data the first time it is shown.
    effect(() => {
      const tab = this.tab();
      untracked(() => void this.loadFor(tab));
    });
  }

  private async loadFor(tab: Tab): Promise<void> {
    if (!this.canAnalytics) return;
    this.error.set(null);
    try {
      if (tab === 'overview' && !this.analytics() && this.c.salesCount > 0) this.analytics.set(await this.api.analytics(this.c.uid));
      if (tab === 'purchases' && !this.purchases()) this.purchases.set(await this.api.purchases(this.c.uid));
      if (tab === 'history' && !this.audit()) this.audit.set(await this.api.auditLog(this.c.uid));
    } catch (e) {
      this.error.set(ApiError.from(e).message);
    }
  }

  protected date(v: string | null): Date | null {
    return parseLocal(v);
  }

  protected status(s: string) {
    return this.statusMeta[s] ?? { en: s, sw: s, color: 'var(--c-text-2)' };
  }
}
