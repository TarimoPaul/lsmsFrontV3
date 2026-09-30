import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';

import { ApiError } from '@core/api/api.types';
import { AuthService } from '@core/auth/auth.service';
import { LanguageService } from '@core/i18n/language.service';
import { Button, DialogService, EmptyState, Icon, MetricCard, MetricsGrid, Skeleton, ToastService } from '@shared/ui';
import { parseLocal } from '@shared/utils/date-utils';
import { MoneyPipe } from '@shared/utils/money';
import { ReasonDialog, ReasonDialogData } from '../reconciliation/reason-dialog';
import type { MovementDialogData } from './capital-dialogs';
import { LOAN_STATUS, Loan, SOURCE_LABELS } from './capital.models';
import { CapitalService } from './capital.service';

/**
 * Loan register. A loan is a liability (Loans Payable), never income or
 * capital. Repayments split principal (reduces the loan) from interest (an
 * expense); a forgiven / converted loan moves to owner capital by journal.
 */
@Component({
  selector: 'app-loans-tab',
  imports: [Button, Icon, EmptyState, Skeleton, MetricCard, MetricsGrid, MoneyPipe, DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <lsms-metrics-grid [gap]="12">
      <lsms-metric-card [title]="i18n.t('Still owed', 'Bado tunadaiwa')" [value]="stats().owed | money: { decimals: 0 }" icon="request_quote" color="var(--c-warning)" [urgent]="stats().owed > 0" [subtitle]="i18n.t(stats().active + ' active loan(s)', 'Mikopo ' + stats().active + ' hai')" />
      <lsms-metric-card [title]="i18n.t('Borrowed (all time)', 'Iliyokopwa (jumla)')" [value]="stats().borrowed | money: { decimals: 0 }" icon="account_balance" color="var(--c-primary)" />
      <lsms-metric-card [title]="i18n.t('Principal repaid', 'Principal iliyolipwa')" [value]="stats().repaid | money: { decimals: 0 }" icon="check_circle" color="var(--c-success)" />
    </lsms-metrics-grid>

    <div class="bar">
      <span class="sp"></span>
      @if (canWrite()) {
        <button lsmsButton="primary" icon="add" (click)="newLoan()">{{ i18n.t('Loan received', 'Mkopo mpya') }}</button>
      }
    </div>

    @if (loading()) {
      <lsms-skeleton variant="list" [rows]="4" />
    } @else if (!loans().length) {
      <lsms-empty-state icon="verified" iconColor="var(--c-success)" [title]="i18n.t('No loans', 'Hakuna mikopo')" [message]="i18n.t('The business owes no lender.', 'Biashara haidaiwi na mkopeshaji yeyote.')" />
    } @else {
      <div class="list">
        @for (l of loans(); track l.uid) {
          @let st = status(l.status);
          <article>
            <div class="top">
              <span class="ic"><lsms-icon name="account_balance" [size]="18" /></span>
              <span class="nm"><b>{{ l.reason }}</b><small>{{ day(l.injectionDate) | date: 'd MMM yyyy' }} · {{ i18n.t('borrowed', 'ilikopwa') }} {{ l.loanAmount | money: { decimals: 0 } }}</small></span>
              <span class="pill" [style.--pc]="st.color">{{ i18n.isSwahili() ? st.sw : st.en }}</span>
            </div>
            <div class="bar2"><span [style.width.%]="pct(l)"></span></div>
            <div class="nums">
              <span><small>{{ i18n.t('Repaid', 'Imelipwa') }}</small><b>{{ l.totalRepaid | money: { decimals: 0 } }}</b></span>
              <span><small>{{ i18n.t('Still owed', 'Bado inadaiwa') }}</small><b [class.warn]="l.outstandingBalance > 0">{{ l.outstandingBalance | money: { decimals: 0 } }}</b></span>
            </div>
            @if (repayments(l).length) {
              <ul class="tx">
                @for (t of repayments(l); track t.uid) {
                  <li><span>{{ day(t.transaction_date) | date: 'dd MMM yy' }}</span><span>{{ i18n.t('principal', 'principal') }} {{ (t.principal_amount ?? t.amount) | money: { decimals: 0 } }}@if (t.interest_amount) { · {{ i18n.t('interest', 'riba') }} {{ t.interest_amount | money: { decimals: 0 } }} }</span></li>
                }
              </ul>
            }
            @if (canWrite() && l.outstandingBalance > 0 && l.status !== 'RECLASSIFIED') {
              <div class="acts">
                <button lsmsButton="text" size="sm" (click)="convert(l)">{{ i18n.t('Convert to capital', 'Geuza kuwa mtaji') }}</button>
                <button lsmsButton="primary" size="sm" icon="payments" (click)="repay(l)">{{ i18n.t('Repay', 'Lipa') }}</button>
              </div>
            }
          </article>
        }
      </div>
    }
  `,
  styles: `
    :host { display: flex; flex-direction: column; gap: 12px; }
    .bar { display: flex; align-items: center; gap: 10px; }
    .sp { flex: 1; }
    .list { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 360px), 1fr)); gap: 12px; }
    article { display: flex; flex-direction: column; gap: 10px; padding: 14px 16px; border-radius: 16px; border: 1px solid var(--c-border); background: var(--c-surface); }
    .top { display: flex; align-items: center; gap: 10px; }
    .ic { display: inline-flex; padding: 8px; border-radius: 12px; color: var(--c-warning); background: color-mix(in srgb, var(--c-warning) 12%, transparent); }
    .nm { flex: 1; display: flex; flex-direction: column; min-width: 0; }
    .nm b { font-size: 0.9rem; font-weight: 500; color: var(--c-text); }
    .nm small { font-size: 0.72rem; color: var(--c-text-2); }
    .pill { padding: 2px 9px; border-radius: 100px; font-size: 0.7rem; font-weight: 600; white-space: nowrap; color: var(--pc); background: color-mix(in srgb, var(--pc) 12%, transparent); }
    .bar2 { height: 7px; border-radius: 7px; background: color-mix(in srgb, var(--c-text-2) 14%, transparent); overflow: hidden; }
    .bar2 span { display: block; height: 100%; background: var(--c-success); }
    .nums { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
    .nums span { display: flex; flex-direction: column; }
    .nums small { font-size: 0.7rem; color: var(--c-text-2); }
    .nums b { font-size: 0.95rem; font-weight: 700; color: var(--c-text); font-variant-numeric: tabular-nums; }
    .nums b.warn { color: var(--c-warning); }
    .tx { display: flex; flex-direction: column; gap: 4px; margin: 0; padding: 8px 10px; border-radius: 10px; list-style: none; background: color-mix(in srgb, var(--c-text-2) 5%, transparent); }
    .tx li { display: flex; justify-content: space-between; gap: 10px; font-size: 0.76rem; color: var(--c-text-2); }
    .acts { display: flex; justify-content: flex-end; gap: 6px; }
  `,
})
export class LoansTab {
  protected readonly i18n = inject(LanguageService);
  private readonly api = inject(CapitalService);
  private readonly auth = inject(AuthService);
  private readonly dialogs = inject(DialogService);
  private readonly toast = inject(ToastService);

  protected readonly loans = computed(() => this.api.loans.value() ?? []);
  protected readonly loading = this.api.loans.initialLoading;
  protected readonly canWrite = computed(() => this.auth.hasPermission('CAPITAL_WRITE'));
  protected readonly stats = computed(() => {
    const live = this.loans().filter((l) => l.status !== 'RECLASSIFIED');
    return {
      owed: live.reduce((s, l) => s + l.outstandingBalance, 0),
      active: live.filter((l) => l.outstandingBalance > 0).length,
      borrowed: this.loans().reduce((s, l) => s + l.loanAmount, 0),
      repaid: live.reduce((s, l) => s + l.totalRepaid, 0),
    };
  });

  constructor() {
    void this.api.loans.load();
  }

  protected repayments(l: Loan) {
    return (l.transactions ?? []).filter((t) => t.source_type === 'LOAN_REPAYMENT');
  }

  protected pct(l: Loan): number {
    return l.loanAmount ? Math.min(100, (l.totalRepaid / l.loanAmount) * 100) : 0;
  }

  protected async newLoan(): Promise<void> {
    const { MovementDialog } = await import('./capital-dialogs');
    const ok = await this.dialogs.openAsync<boolean, MovementDialogData>(MovementDialog, { size: 'md', data: { kind: 'LOAN' }, disableClose: true });
    if (ok) {
      await this.api.loans.load(true);
      this.toast.success(this.i18n.t('Loan recorded', 'Mkopo umerekodiwa'));
    }
  }

  protected async repay(l: Loan): Promise<void> {
    const { RepayDialog } = await import('./capital-dialogs');
    const ok = await this.dialogs.openAsync<boolean, Loan>(RepayDialog, { size: 'md', data: l, disableClose: true });
    if (ok) {
      await this.api.loans.load(true);
      this.toast.success(this.i18n.t('Repayment recorded', 'Malipo ya mkopo yamerekodiwa'));
    }
  }

  protected async convert(l: Loan): Promise<void> {
    const reason = await this.dialogs.openAsync<string, ReasonDialogData>(ReasonDialog, {
      size: 'sm',
      data: {
        title: this.i18n.t('Convert loan to capital', 'Geuza mkopo kuwa mtaji'),
        message: this.i18n.t(
          'Only when the lender will never be repaid (e.g. the owner lent it). The outstanding amount moves from Loans to Owner capital.',
          'Pale tu mkopeshaji hatalipwa (mf. mmiliki ndiye aliyekopesha). Kiasi kilichobaki kinahamia kutoka Mikopo kwenda Mtaji wa mmiliki.',
        ),
        label: this.i18n.t('Reason (required)', 'Sababu (inahitajika)'),
        confirm: this.i18n.t('Convert', 'Geuza'),
        min: 5,
      },
    });
    if (!reason) return;
    try {
      await this.api.reclassifyLoan(l.uid, 'OWNER_EQUITY', reason);
      await this.api.loans.load(true);
      this.toast.success(this.i18n.t('Loan converted to capital', 'Mkopo umegeuzwa kuwa mtaji'));
    } catch (e) {
      this.toast.error(ApiError.from(e).message);
    }
  }

  protected status(s: string) {
    return LOAN_STATUS[s] ?? { en: s, sw: s, color: 'var(--c-text-2)' };
  }

  protected source(s: string) {
    return SOURCE_LABELS[s];
  }

  protected day(v: string | null): Date | null {
    return parseLocal(v);
  }
}
