import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';

import { ApiError } from '@core/api/api.types';
import { AuthService } from '@core/auth/auth.service';
import { LanguageService } from '@core/i18n/language.service';
import { EmptyState, Icon, Skeleton } from '@shared/ui';
import { toIsoDate } from '@shared/utils/date-utils';
import { MoneyPipe } from '@shared/utils/money';
import { ControlCheck, FinancialPosition, IncomeStatement } from '../general-ledger/gl.models';
import { GlService } from '../general-ledger/gl.service';

/**
 * Capital position from the General Ledger — the owner's view of the balance
 * sheet: what the business owns, what it owes, and what is truly the owner's
 * (capital put in − drawings + profit kept). Capital = assets − liabilities,
 * never a formula on stock alone.
 */
@Component({
  selector: 'app-capital-overview',
  imports: [Icon, EmptyState, Skeleton, MoneyPipe, DecimalPipe, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (loading() && !pos()) {
      <lsms-skeleton variant="list" [rows]="6" />
    } @else if (error()) {
      <lsms-empty-state icon="error" iconColor="var(--c-error)" [title]="i18n.t('Could not load the capital position', 'Imeshindwa kupakia hali ya mtaji')" [message]="error()!" [secondaryActionLabel]="i18n.t('Retry', 'Jaribu tena')" (secondaryAction)="load()" />
    } @else if (pos(); as p) {
      @if (unreconciled().length) {
        <a class="alert" [routerLink]="canGl() ? '/general-ledger' : null" [queryParams]="{ tab: 'overview' }">
          <lsms-icon name="report" [size]="20" />
          <span>
            <b>{{ i18n.t('The books need correcting before these figures can be trusted', 'Vitabu vinahitaji kurekebishwa kabla takwimu hizi hazijaaminika') }}</b>
            <small>{{ i18n.t('GL differs from the records for: ', 'GL inatofautiana na kumbukumbu kwa: ') }}{{ unreconciledNames() }}</small>
          </span>
          @if (canGl()) { <lsms-icon name="chevron_right" [size]="20" /> }
        </a>
      }

      <section class="hero">
        <div class="eqt">
          <small>{{ i18n.t('Owner’s equity (net worth)', 'Mtaji halisi wa mmiliki') }}</small>
          <b [class.neg]="p.totalEquity < 0">{{ p.totalEquity | money: { decimals: 0 } }}</b>
          <span class="formula">{{ i18n.t('Assets', 'Mali') }} {{ p.totalAssets | money: { decimals: 0 } }} − {{ i18n.t('Liabilities', 'Madeni') }} {{ p.totalLiabilities | money: { decimals: 0 } }}</span>
        </div>
        <ul class="comp">
          <li><span>{{ i18n.t('Capital put in', 'Mtaji uliowekwa') }}</span><b>{{ p.ownerCapital + p.openingBalanceEquity | money: { decimals: 0 } }}</b></li>
          <li><span>{{ i18n.t('Less drawings', 'Toa: mmiliki alichotoa') }}</span><b class="neg">−{{ p.drawings | money: { decimals: 0 } }}</b></li>
          <li><span>{{ i18n.t('Profit kept in the business', 'Faida iliyobaki kwenye biashara') }}</span><b [class.neg]="p.retainedEarnings < 0">{{ p.retainedEarnings | money: { decimals: 0 } }}</b></li>
        </ul>
      </section>

      <div class="cols">
        <section class="card">
          <h3><lsms-icon name="account_balance_wallet" [size]="17" />{{ i18n.t('What the business owns', 'Mali za biashara') }}</h3>
          <ul>
            <li [class.bad]="p.cash < 0"><span>{{ i18n.t('Cash, bank & mobile', 'Pesa, benki na simu') }}</span><b>{{ p.cash | money: { decimals: 0 } }}</b></li>
            <li [class.bad]="p.inventory < 0"><span>{{ i18n.t('Stock (at cost)', 'Stock (kwa bei ya kununua)') }}</span><b>{{ p.inventory | money: { decimals: 0 } }}</b></li>
            <li [class.bad]="p.receivables < 0"><span>{{ i18n.t('Customers owe us', 'Wateja wanadaiwa') }}</span><b>{{ p.receivables | money: { decimals: 0 } }}</b></li>
            @if (p.staffReceivables) { <li><span>{{ i18n.t('Staff owe us', 'Wafanyakazi wanadaiwa') }}</span><b>{{ p.staffReceivables | money: { decimals: 0 } }}</b></li> }
            <li><span>{{ i18n.t('Fixed assets (after depreciation)', 'Mali za kudumu (baada ya uchakavu)') }}</span><b>{{ p.fixedAssetsNet | money: { decimals: 0 } }}</b></li>
          </ul>
          <div class="tot"><span>{{ i18n.t('Total assets', 'Jumla ya mali') }}</span><b>{{ p.totalAssets | money: { decimals: 0 } }}</b></div>
        </section>
        <section class="card">
          <h3><lsms-icon name="credit_card" [size]="17" />{{ i18n.t('What the business owes', 'Madeni ya biashara') }}</h3>
          <ul>
            <li><span>{{ i18n.t('Suppliers', 'Wasambazaji') }}</span><b>{{ p.payables | money: { decimals: 0 } }}</b></li>
            <li><span>{{ i18n.t('Loans', 'Mikopo') }}</span><b>{{ p.loans | money: { decimals: 0 } }}</b></li>
            @if (p.otherLiabilities) { <li><span>{{ i18n.t('Other (tax …)', 'Mengine (kodi …)') }}</span><b>{{ p.otherLiabilities | money: { decimals: 0 } }}</b></li> }
          </ul>
          <div class="tot"><span>{{ i18n.t('Total liabilities', 'Jumla ya madeni') }}</span><b>{{ p.totalLiabilities | money: { decimals: 0 } }}</b></div>
          <div class="ratios">
            <span><small>{{ i18n.t('Working capital', 'Mtaji wa kufanyia kazi') }}</small><b [class.neg]="p.workingCapital < 0">{{ p.workingCapital | money: { decimals: 0 } }}</b></span>
            <span><small>{{ i18n.t('Debt ÷ equity', 'Madeni ÷ mtaji') }}</small><b>{{ p.debtToEquity === null ? '—' : (p.debtToEquity | number: '1.0-2') }}</b></span>
          </div>
        </section>
      </div>

      @if (month(); as m) {
        <section class="card">
          <h3><lsms-icon name="query_stats" [size]="17" />{{ i18n.t('This month so far', 'Mwezi huu hadi sasa') }}</h3>
          <div class="kpis">
            <span><small>{{ i18n.t('Net sales', 'Mauzo halisi') }}</small><b>{{ m.netRevenue | money: { decimals: 0 } }}</b></span>
            <span><small>{{ i18n.t('Gross profit', 'Faida ghafi') }}</small><b>{{ m.grossProfit | money: { decimals: 0 } }}</b><em>{{ m.grossMarginPct | number: '1.0-1' }}%</em></span>
            <span><small>{{ i18n.t('Expenses', 'Gharama') }}</small><b>{{ m.operatingExpensesTotal | money: { decimals: 0 } }}</b></span>
            <span class="net" [class.loss]="m.netProfit < 0"><small>{{ m.netProfit < 0 ? i18n.t('Net loss', 'Hasara') : i18n.t('Net profit', 'Faida halisi') }}</small><b>{{ m.netProfit | money: { decimals: 0 } }}</b></span>
          </div>
        </section>
      }
    }
  `,
  styles: `
    :host { display: flex; flex-direction: column; gap: 14px; }
    .alert { display: flex; align-items: center; gap: 12px; padding: 12px 16px; border-radius: 14px; text-decoration: none; color: var(--c-error); background: color-mix(in srgb, var(--c-error) 7%, var(--c-surface)); border: 1px solid color-mix(in srgb, var(--c-error) 35%, transparent); }
    .alert span { flex: 1; display: flex; flex-direction: column; }
    .alert b { font-size: 0.88rem; color: var(--c-text); }
    .alert small { font-size: 0.76rem; color: var(--c-text-2); }
    .hero { display: flex; flex-wrap: wrap; gap: 16px 28px; align-items: center; padding: 18px 20px; border-radius: 18px; border: 1px solid color-mix(in srgb, var(--c-primary) 30%, var(--c-border)); background: color-mix(in srgb, var(--c-primary) 6%, var(--c-surface)); }
    .eqt { display: flex; flex-direction: column; gap: 2px; min-width: 240px; }
    .eqt small { font-size: 0.76rem; font-weight: 600; color: var(--c-text-2); }
    .eqt b { font-size: 1.6rem; font-weight: 700; color: var(--c-primary); font-variant-numeric: tabular-nums; }
    .formula { font-size: 0.74rem; color: var(--c-text-2); }
    .comp { flex: 1; display: flex; flex-direction: column; gap: 6px; min-width: 260px; margin: 0; padding: 0; list-style: none; }
    .comp li, .card li { display: flex; gap: 10px; font-size: 0.86rem; color: var(--c-text); }
    .comp li span, .card li span { flex: 1; }
    .comp b, .card b { font-weight: 600; font-variant-numeric: tabular-nums; }
    .neg { color: var(--c-error) !important; }
    .cols { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 380px), 1fr)); gap: 14px; }
    .card { display: flex; flex-direction: column; gap: 10px; padding: 16px; border-radius: 16px; border: 1px solid var(--c-border); background: var(--c-surface); }
    .card h3 { display: flex; align-items: center; gap: 8px; margin: 0; font-size: 0.9rem; font-weight: 700; color: var(--c-text); }
    .card h3 lsms-icon { color: var(--c-primary); }
    .card ul { display: flex; flex-direction: column; gap: 8px; margin: 0; padding: 0; list-style: none; }
    .card li.bad b, .card li.bad span { color: var(--c-error); }
    .tot { display: flex; gap: 10px; padding-top: 10px; border-top: 1px solid var(--c-border); font-size: 0.9rem; font-weight: 700; color: var(--c-text); }
    .tot span { flex: 1; }
    .ratios, .kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 10px; }
    .ratios span, .kpis span { display: flex; flex-direction: column; padding: 10px 12px; border-radius: 12px; background: color-mix(in srgb, var(--c-text-2) 6%, transparent); }
    .ratios small, .kpis small { font-size: 0.7rem; color: var(--c-text-2); }
    .ratios b, .kpis b { font-size: 0.95rem; font-weight: 700; color: var(--c-text); }
    .kpis em { font-style: normal; font-size: 0.72rem; color: var(--c-text-2); }
    .kpis .net b { color: var(--c-success); }
    .kpis .net.loss b { color: var(--c-error); }
  `,
})
export class CapitalOverview {
  protected readonly i18n = inject(LanguageService);
  private readonly gl = inject(GlService);
  private readonly auth = inject(AuthService);

  protected readonly pos = signal<FinancialPosition | null>(null);
  protected readonly month = signal<IncomeStatement | null>(null);
  protected readonly checks = signal<ControlCheck[]>([]);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly canGl = computed(() => this.auth.hasPermission('FINANCE_READ'));
  protected readonly unreconciled = computed(() => this.checks().filter((c) => !c.reconciled));
  protected readonly unreconciledNames = computed(() =>
    this.unreconciled().map((c) => (this.i18n.isSwahili() ? c.labelSw : c.label)).join(', '),
  );

  constructor() {
    effect(() => {
      this.gl.version();
      untracked(() => void this.load());
    });
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    const now = new Date();
    const today = toIsoDate(now);
    const first = toIsoDate(new Date(now.getFullYear(), now.getMonth(), 1));
    try {
      const [p, c] = await Promise.all([this.gl.position(today), this.gl.controlChecks(today)]);
      this.pos.set(p);
      this.checks.set(c);
      // P&L needs FINANCE_READ; the capital view works without it.
      this.month.set(this.canGl() ? await this.gl.incomeStatement(first, today).catch(() => null) : null);
    } catch (e) {
      this.error.set(ApiError.from(e).message);
    } finally {
      this.loading.set(false);
    }
  }
}
