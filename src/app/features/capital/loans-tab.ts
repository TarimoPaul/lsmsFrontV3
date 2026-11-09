import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';

import { AuthService } from '@core/auth/auth.service';
import { LanguageService } from '@core/i18n/language.service';
import { Button, DialogService, EmptyState, Icon, MetricCard, MetricsGrid, Skeleton, ToastService } from '@shared/ui';
import { parseLocal } from '@shared/utils/date-utils';
import { MoneyPipe } from '@shared/utils/money';
import { INSTALLMENT_STATE, LOAN_STATUS, Loan } from './capital.models';
import { CapitalService } from './capital.service';

const done = (l: Loan) => l.card!.loanStatus === 'CLOSED' || (l.card!.owed < 0.005 && l.card!.interestRemaining < 0.005);

/**
 * Loan register (2.3.0). A loan is a liability with a contract: the whole amount owed (principal + interest) is
 * Cr 2100 on the day it is received, the interest waits in 1150 and is spread every day into 6600, and a repayment
 * reduces 2100 only. The card shows the contract from the record and the money from the GL; the "reserve" is a
 * memo (principal ÷ loan days), never a journal. Every write needs FINANCE_WRITE (the server checks it too).
 */
@Component({
  selector: 'app-loans-tab',
  imports: [Button, Icon, EmptyState, Skeleton, MetricCard, MetricsGrid, MoneyPipe, DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <lsms-metrics-grid [gap]="12">
      <lsms-metric-card [title]="i18n.t('Still owed', 'Bado tunadaiwa')" [value]="stats().owed | money: { decimals: 0 }" icon="request_quote" color="var(--c-warning)" [urgent]="stats().owed > 0" [subtitle]="i18n.t(stats().active + ' active loan(s)', 'Mikopo ' + stats().active + ' hai')" />
      <lsms-metric-card [title]="i18n.t('Cost per day', 'Makato ya siku')" [value]="stats().daily | money: { decimals: 0 }" icon="event_repeat" color="var(--c-error)" [subtitle]="i18n.t('interest ' , 'riba ') + (stats().interest | money: { decimals: 0 }) + ' + ' + i18n.t('reserve ', 'akiba ') + (stats().reserve | money: { decimals: 0 })" />
      <lsms-metric-card [title]="i18n.t('Repaid', 'Imelipwa')" [value]="stats().repaid | money: { decimals: 0 }" icon="check_circle" color="var(--c-success)" />
    </lsms-metrics-grid>

    <div class="bar">
      <span class="sp"></span>
      @if (canWrite()) {
        <button lsmsButton="primary" icon="add" (click)="newLoan()">{{ i18n.t('Loan received', 'Mkopo mpya') }}</button>
      }
    </div>

    @if (loading()) {
      <lsms-skeleton variant="list" [rows]="4" />
    } @else if (!active().length && !history().length) {
      <lsms-empty-state icon="verified" iconColor="var(--c-success)" [title]="i18n.t('No loans', 'Hakuna mikopo')" [message]="i18n.t('The business owes no lender.', 'Biashara haidaiwi na mkopeshaji yeyote.')" />
    } @else {
      @if (!active().length) {
        <p class="none"><lsms-icon name="verified" [size]="16" />{{ i18n.t('No active loan: the business owes no lender now.', 'Hakuna mkopo hai: biashara haidaiwi sasa.') }}</p>
      }
      <div class="list">
        @for (l of active(); track l.uid) {
          @let c = l.card!;
          <article [attr.data-loan]="l.uid">
            <div class="top">
              <span class="ic"><lsms-icon name="account_balance" [size]="18" /></span>
              <span class="nm"><b>{{ l.reason }}</b>@if (l.notes) { <small>{{ l.notes }}</small> }</span>
              <span class="pill" [style.--pc]="c.owed > 0 ? 'var(--c-warning)' : 'var(--c-info)'">{{ c.owed > 0 ? i18n.t('Active', 'Unadaiwa') : c.stateLabel }}</span>
            </div>
            <div class="bar2" [title]="i18n.t('Repaid of the total owed', 'Kilicholipwa kati ya deni lote')"><span [style.width.%]="pct(c.repaid, c.total)"></span></div>
            <div class="nums">
              <span><small>{{ i18n.t('Principal', 'Kiasi') }}</small><b>{{ c.principal | money: { decimals: 0 } }}</b></span>
              <span><small>{{ i18n.t('Interest', 'Riba') }}</small><b>{{ c.interestTotal | money: { decimals: 0 } }}</b></span>
              <span><small>{{ i18n.t('Total owed', 'Jumla') }}</small><b>{{ c.total | money: { decimals: 0 } }}</b></span>
              <span><small>{{ i18n.t('Repaid', 'Imelipwa') }}</small><b class="ok">{{ c.repaid | money: { decimals: 0 } }}</b></span>
              <span><small>{{ i18n.t('Still owed', 'Deni') }}</small><b [class.warn]="c.owed > 0">{{ c.owed | money: { decimals: 0 } }}</b></span>
              <span><small>{{ i18n.t('Interest booked / left', 'Riba iliyogawanywa / iliyobaki') }}</small><b>{{ c.interestBooked | money: { decimals: 0 } }} / {{ c.interestRemaining | money: { decimals: 0 } }}</b></span>
            </div>
            <div class="meta">
              <span><lsms-icon name="date_range" [size]="14" />{{ day(c.startDate) | date: 'd MMM yyyy' }} → {{ day(c.endDate) | date: 'd MMM yyyy' }}@if (c.endDate) { · {{ i18n.t(c.daysLeft + ' days left', 'siku ' + c.daysLeft + ' zimebaki') }} }</span>
              <span><lsms-icon name="repeat" [size]="14" />{{ c.repaymentType === 'ONCE' ? i18n.t('Once, at the end', 'Mara moja, mwishoni') : c.repaymentType === 'MONTHLY' ? i18n.t('Every month', 'Kila mwezi') : '—' }}</span>
            </div>
            @if (c.dailyCharge > 0) {
              <div class="daily">
                <span>{{ i18n.t('Per day', 'Kwa siku') }}</span>
                <span>{{ i18n.t('interest', 'riba') }} <b>{{ c.interestDaily | money }}</b></span>
                <span>+ {{ i18n.t('reserve', 'akiba') }} <b>{{ c.reserveDaily | money }}</b></span>
                <span>= <b>{{ c.dailyCharge | money }}</b></span>
              </div>
            }
            @if (c.installments.length) {
              <ul class="inst">
                @for (i of c.installments; track i.seq) {
                  @let s = state(i.state);
                  <li [attr.data-seq]="i.seq">
                    <span class="seq">#{{ i.seq }}</span>
                    <span class="due">{{ day(i.dueDate) | date: 'd MMM yyyy' }}</span>
                    <span class="amt">{{ i.amount | money: { decimals: 0 } }}@if (i.paidAmount > 0 && i.paidAmount < i.amount) { <small> · {{ i18n.t('paid', 'imelipwa') }} {{ i.paidAmount | money: { decimals: 0 } }}</small> }</span>
                    <span class="pill" [style.--pc]="s.color">{{ i18n.isSwahili() ? s.sw : s.en }}@if (i.state === 'IMECHELEWA') { · {{ i18n.t(i.daysLate + ' d', 'siku ' + i.daysLate) }} }</span>
                  </li>
                }
              </ul>
            }
            @if (repayments(l).length) {
              <ul class="tx">
                @for (t of repayments(l); track t.uid) {
                  <li><span>{{ day(t.transaction_date) | date: 'dd MMM yy' }} · {{ i18n.t('paid', 'imelipwa') }}</span><span>{{ t.amount | money: { decimals: 0 } }}</span></li>
                }
              </ul>
            }
            @if (canWrite()) {
              <div class="acts">
                <button lsmsButton="text" size="sm" icon="edit_note" (click)="details(l)">{{ i18n.t('Details', 'Maelezo') }}</button>
                @if (canConvert() && c.owed > 0) {
                  <button lsmsButton="text" size="sm" (click)="convert(l)">{{ i18n.t('Convert to capital', 'Geuza kuwa mtaji') }}</button>
                }
                @if (c.owed > 0) {
                  <button lsmsButton="primary" size="sm" icon="payments" (click)="repay(l)">{{ i18n.t('Repay', 'Lipa mkopo') }}</button>
                }
              </div>
            }
          </article>
        }
      </div>

      @if (history().length) {
        <details class="hist">
          <summary>{{ i18n.t('History', 'Historia') }} ({{ history().length }})</summary>
          <ul>
            @for (l of history(); track l.uid) {
              @let st = status(l.card ? (l.card.loanStatus === 'CLOSED' ? 'CLOSED' : 'FULLY_REPAID') : l.status);
              <li>
                <span class="nm"><b>{{ l.reason }}</b><small>{{ day(l.injectionDate) | date: 'd MMM yyyy' }} · {{ (l.card?.total ?? l.loanAmount) | money: { decimals: 0 } }}@if (l.card?.closedAt) { · {{ i18n.t('closed', 'umefungwa') }} {{ day(l.card!.closedAt) | date: 'd MMM yyyy' }} }</small></span>
                <span class="pill" [style.--pc]="st.color">{{ i18n.isSwahili() ? st.sw : st.en }}</span>
              </li>
            }
          </ul>
        </details>
      }
    }
  `,
  styles: `
    :host { display: flex; flex-direction: column; gap: 12px; }
    .bar { display: flex; align-items: center; gap: 10px; }
    .sp { flex: 1; }
    .none { display: flex; align-items: center; gap: 8px; margin: 0; font-size: 0.82rem; color: var(--c-text-2); }
    .none lsms-icon { color: var(--c-success); }
    .list { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 420px), 1fr)); gap: 12px; }
    article { display: flex; flex-direction: column; gap: 10px; padding: 14px 16px; border-radius: 16px; border: 1px solid var(--c-border); background: var(--c-surface); }
    .top { display: flex; align-items: center; gap: 10px; }
    .ic { display: inline-flex; padding: 8px; border-radius: 12px; color: var(--c-warning); background: color-mix(in srgb, var(--c-warning) 12%, transparent); }
    .nm { flex: 1; display: flex; flex-direction: column; min-width: 0; }
    .nm b { font-size: 0.9rem; font-weight: 500; color: var(--c-text); }
    .nm small { font-size: 0.72rem; color: var(--c-text-2); }
    .pill { padding: 2px 9px; border-radius: 100px; font-size: 0.7rem; font-weight: 500; white-space: nowrap; color: var(--pc); background: color-mix(in srgb, var(--pc) 12%, transparent); }
    .bar2 { height: 7px; border-radius: 7px; background: color-mix(in srgb, var(--c-text-2) 14%, transparent); overflow: hidden; }
    .bar2 span { display: block; height: 100%; background: var(--c-success); }
    .nums { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px 10px; }
    .nums span { display: flex; flex-direction: column; min-width: 0; }
    .nums small { font-size: 0.7rem; color: var(--c-text-2); }
    .nums b { font-size: 0.9rem; font-weight: 600; color: var(--c-text); font-variant-numeric: tabular-nums; }
    .nums b.warn { color: var(--c-warning); }
    .nums b.ok { color: var(--c-success); }
    .meta { display: flex; flex-wrap: wrap; gap: 6px 14px; font-size: 0.75rem; color: var(--c-text-2); }
    .meta span { display: inline-flex; align-items: center; gap: 5px; }
    .daily { display: flex; flex-wrap: wrap; gap: 4px 10px; padding: 8px 10px; border-radius: 10px; font-size: 0.76rem; color: var(--c-text-2); background: color-mix(in srgb, var(--c-error) 6%, transparent); }
    .daily b { color: var(--c-text); font-variant-numeric: tabular-nums; }
    .inst, .tx { display: flex; flex-direction: column; gap: 4px; margin: 0; padding: 8px 10px; border-radius: 10px; list-style: none; background: color-mix(in srgb, var(--c-text-2) 5%, transparent); }
    .inst li { display: grid; grid-template-columns: 28px 1fr auto auto; align-items: center; gap: 8px; font-size: 0.78rem; color: var(--c-text); }
    .inst .seq { color: var(--c-text-2); }
    .inst .amt { font-variant-numeric: tabular-nums; text-align: right; }
    .inst small { color: var(--c-text-2); }
    .tx li { display: flex; justify-content: space-between; gap: 10px; font-size: 0.76rem; color: var(--c-text-2); }
    .acts { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 6px; }
    .hist { border: 1px solid var(--c-border); border-radius: 14px; background: var(--c-surface); padding: 10px 14px; }
    .hist summary { cursor: pointer; font-size: 0.82rem; font-weight: 500; color: var(--c-text-2); }
    .hist ul { display: flex; flex-direction: column; gap: 8px; margin: 10px 0 0; padding: 0; list-style: none; }
    .hist li { display: flex; align-items: center; gap: 10px; }
    @media (max-width: 520px) {
      .nums { grid-template-columns: repeat(2, 1fr); }
      .inst li { grid-template-columns: 24px 1fr auto; }
      .inst .pill { grid-column: 2 / -1; justify-self: start; }
    }
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
  /** Register, repay, describe: FINANCE_WRITE (2.3.0). Converting to capital needs CAPITAL_WRITE as well. */
  protected readonly canWrite = computed(() => this.auth.hasPermission('FINANCE_WRITE'));
  protected readonly canConvert = computed(() => this.canWrite() && this.auth.hasPermission('CAPITAL_WRITE'));
  /**
   * A loan stays here until its 2100 and 1150 are both 0 (paid early = interest still spreading). Both 0 but not
   * CLOSED yet only means the scheduler has not run since (it closes such a loan at 00:05): history already.
   */
  protected readonly active = computed(() => this.loans().filter((l) => l.card && !done(l)));
  protected readonly history = computed(() => this.loans().filter((l) => !l.card || done(l)));
  protected readonly stats = computed(() => {
    const a = this.active().map((l) => l.card!);
    return {
      owed: a.reduce((s, c) => s + c.owed, 0),
      active: a.filter((c) => c.owed > 0).length,
      interest: a.reduce((s, c) => s + c.interestDaily, 0),
      reserve: a.reduce((s, c) => s + c.reserveDaily, 0),
      daily: a.reduce((s, c) => s + c.dailyCharge, 0),
      repaid: this.loans().reduce((s, l) => s + (l.card?.repaid ?? 0), 0),
    };
  });

  constructor() {
    void this.api.loans.load();
  }

  protected repayments(l: Loan) {
    return (l.transactions ?? []).filter((t) => t.source_type === 'LOAN_REPAYMENT');
  }

  protected pct(part: number, whole: number): number {
    return whole ? Math.min(100, (part / whole) * 100) : 0;
  }

  protected async newLoan(): Promise<void> {
    const { LoanRegisterDialog } = await import('./loan-dialogs');
    if (await this.dialogs.openAsync<boolean>(LoanRegisterDialog, { size: 'md', disableClose: true })) {
      await this.api.loans.load(true);
      this.toast.success(this.i18n.t('Loan recorded', 'Mkopo umerekodiwa'));
    }
  }

  protected async details(l: Loan): Promise<void> {
    const { LoanDetailsDialog } = await import('./loan-dialogs');
    if (await this.dialogs.openAsync<boolean, Loan>(LoanDetailsDialog, { size: 'md', data: l, disableClose: true })) {
      await this.api.loans.load(true);
      this.toast.success(this.i18n.t('Loan details saved', 'Maelezo ya mkopo yamehifadhiwa'));
    }
  }

  protected async repay(l: Loan): Promise<void> {
    const { RepayDialog } = await import('./loan-dialogs');
    if (await this.dialogs.openAsync<boolean, Loan>(RepayDialog, { size: 'md', data: l, disableClose: true })) {
      await this.api.loans.load(true);
      this.toast.success(this.i18n.t('Repayment recorded', 'Malipo ya mkopo yamerekodiwa'));
    }
  }

  protected async convert(l: Loan): Promise<void> {
    const { ConvertDialog } = await import('./loan-dialogs');
    if (await this.dialogs.openAsync<boolean, Loan>(ConvertDialog, { size: 'md', data: l, disableClose: true })) {
      await this.api.loans.load(true);
      this.toast.success(this.i18n.t('Loan converted to capital', 'Mkopo umegeuzwa kuwa mtaji'));
    }
  }

  protected status(s: string) {
    return LOAN_STATUS[s] ?? { en: s, sw: s, color: 'var(--c-text-2)' };
  }

  protected state(s: string) {
    return INSTALLMENT_STATE[s] ?? { en: s, sw: s, color: 'var(--c-text-2)' };
  }

  protected day(v: string | null): Date | null {
    return parseLocal(v);
  }
}
