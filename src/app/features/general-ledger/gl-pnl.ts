import { DatePipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, effect, inject, input, output, signal, untracked } from '@angular/core';

import { ApiError } from '@core/api/api.types';
import { LanguageService } from '@core/i18n/language.service';
import { Button, EmptyState, Icon, Skeleton } from '@shared/ui';
import { printReport } from '@shared/utils/export';
import { parseLocal } from '@shared/utils/date-utils';
import { Money, MoneyPipe } from '@shared/utils/money';
import { IncomeStatement, PnlLine } from './gl.models';
import { GlService } from './gl.service';

/**
 * Profit & loss for a period, the way an accountant reads it: sales less
 * discounts/returns = net sales; less cost of sales (COGS + shrinkage) = gross
 * profit; less operating expenses = operating profit; plus other income = net
 * profit. Margins are on net sales.
 */
@Component({
  selector: 'app-gl-pnl',
  imports: [Button, Icon, EmptyState, Skeleton, MoneyPipe, DatePipe, DecimalPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (loading() && !pnl()) {
      <lsms-skeleton variant="list" [rows]="8" />
    } @else if (error()) {
      <lsms-empty-state icon="error" iconColor="var(--c-error)" [title]="i18n.t('Could not load profit & loss', 'Imeshindwa kupakia faida na hasara')" [message]="error()!" [secondaryActionLabel]="i18n.t('Retry', 'Jaribu tena')" (secondaryAction)="load()" />
    } @else if (pnl(); as p) {
      <div class="bar">
        <span class="asof"><lsms-icon name="date_range" [size]="16" />{{ day(p.periodStart) | date: 'd MMM yyyy' }} – {{ day(p.periodEnd) | date: 'd MMM yyyy' }}</span>
        <span class="sp"></span>
        <button lsmsButton="secondary" size="sm" icon="print" (click)="print()">{{ i18n.t('Print', 'Chapisha') }}</button>
      </div>
      <div class="kpis">
        <div><small>{{ i18n.t('Net sales', 'Mauzo halisi') }}</small><b>{{ p.netRevenue | money: { decimals: 0 } }}</b></div>
        <div><small>{{ i18n.t('Gross profit', 'Faida ghafi') }}</small><b [class.neg]="p.grossProfit < 0">{{ p.grossProfit | money: { decimals: 0 } }}</b><em>{{ p.grossMarginPct | number: '1.0-1' }}%</em></div>
        <div><small>{{ i18n.t('Operating expenses', 'Gharama za uendeshaji') }}</small><b>{{ p.operatingExpensesTotal | money: { decimals: 0 } }}</b></div>
        <div class="net" [class.loss]="p.netProfit < 0"><small>{{ p.netProfit < 0 ? i18n.t('Net loss', 'Hasara halisi') : i18n.t('Net profit', 'Faida halisi') }}</small><b>{{ p.netProfit | money: { decimals: 0 } }}</b><em>{{ p.netMarginPct | number: '1.0-1' }}%</em></div>
      </div>
      <div class="stmt">
        <section class="sec" style="--sc: var(--c-success)">
          <h3><lsms-icon name="trending_up" [size]="16" />{{ i18n.t('Sales', 'Mauzo') }}</h3>
          @for (l of p.revenue; track l.code) { <div class="row click" (click)="openAccount.emit(l.code)"><span class="code">{{ l.code }}</span><span class="nm">{{ name(l) }}</span><span class="amt">{{ l.amount | money: { decimals: 0 } }}</span></div> }
          @for (l of p.contraRevenue; track l.code) { <div class="row click indent" (click)="openAccount.emit(l.code)"><span class="code">{{ l.code }}</span><span class="nm">{{ i18n.t('Less', 'Toa') }}: {{ name(l) }}</span><span class="amt neg">{{ l.amount | money: { decimals: 0 } }}</span></div> }
          <div class="sub"><span>{{ i18n.t('Net sales', 'Mauzo halisi') }}</span><span>{{ p.netRevenue | money: { decimals: 0 } }}</span></div>
        </section>
        <section class="sec" style="--sc: var(--c-warning)">
          <h3><lsms-icon name="inventory_2" [size]="16" />{{ i18n.t('Cost of sales', 'Gharama ya bidhaa zilizouzwa') }}</h3>
          @for (l of p.costOfSales; track l.code) { <div class="row click" (click)="openAccount.emit(l.code)"><span class="code">{{ l.code }}</span><span class="nm">{{ name(l) }}</span><span class="amt">{{ l.amount | money: { decimals: 0 } }}</span></div> }
          @empty { <div class="empty-row">—</div> }
          <div class="sub"><span>{{ i18n.t('Gross profit', 'Faida ghafi') }} · {{ p.grossMarginPct | number: '1.0-1' }}%</span><span [class.neg]="p.grossProfit < 0">{{ p.grossProfit | money: { decimals: 0 } }}</span></div>
        </section>
        <section class="sec" style="--sc: var(--c-error)">
          <h3><lsms-icon name="receipt_long" [size]="16" />{{ i18n.t('Operating expenses', 'Gharama za uendeshaji') }}</h3>
          @for (l of p.operatingExpenses; track l.code) { <div class="row click" (click)="openAccount.emit(l.code)"><span class="code">{{ l.code }}</span><span class="nm">{{ name(l) }}</span><span class="amt" [class.pos]="l.amount < 0">{{ l.amount | money: { decimals: 0 } }}</span></div> }
          @empty { <div class="empty-row">{{ i18n.t('No expenses in this period', 'Hakuna gharama kipindi hiki') }}</div> }
          <div class="sub"><span>{{ i18n.t('Operating profit', 'Faida ya uendeshaji') }}</span><span [class.neg]="p.operatingProfit < 0">{{ p.operatingProfit | money: { decimals: 0 } }}</span></div>
        </section>
        @if (p.otherIncome.length) {
          <section class="sec" style="--sc: var(--c-info)">
            <h3><lsms-icon name="add_card" [size]="16" />{{ i18n.t('Other income', 'Mapato mengine') }}</h3>
            @for (l of p.otherIncome; track l.code) { <div class="row click" (click)="openAccount.emit(l.code)"><span class="code">{{ l.code }}</span><span class="nm">{{ name(l) }}</span><span class="amt">{{ l.amount | money: { decimals: 0 } }}</span></div> }
          </section>
        }
        <div class="grand" [style.--gc]="p.netProfit < 0 ? 'var(--c-error)' : 'var(--c-success)'">
          <span>{{ p.netProfit < 0 ? i18n.t('Net loss', 'Hasara halisi') : i18n.t('Net profit', 'Faida halisi') }}</span>
          <span class="amt">{{ p.netProfit | money: { decimals: 0 } }}</span>
        </div>
      </div>
    }
  `,
  styles: `
    @use 'statement';
    @include statement.base;
    :host { display: flex; flex-direction: column; gap: 14px; }
    .bar { display: flex; align-items: center; gap: 10px; }
    .asof { display: inline-flex; align-items: center; gap: 6px; font-size: 0.86rem; font-weight: 600; color: var(--c-text); }
    .asof lsms-icon { color: var(--c-primary); }
    .sp { flex: 1; }
    .kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 10px; }
    .kpis > div { display: flex; flex-direction: column; gap: 2px; padding: 12px 14px; border-radius: 14px; border: 1px solid var(--c-border); background: var(--c-surface); }
    .kpis small { font-size: 0.72rem; color: var(--c-text-2); }
    .kpis b { font-size: 1.05rem; font-weight: 700; color: var(--c-text); font-variant-numeric: tabular-nums; }
    .kpis em { font-style: normal; font-size: 0.74rem; font-weight: 600; color: var(--c-text-2); }
    .kpis .net { border-color: color-mix(in srgb, var(--c-success) 40%, var(--c-border)); }
    .kpis .net b { color: var(--c-success); }
    .kpis .net.loss { border-color: color-mix(in srgb, var(--c-error) 40%, var(--c-border)); }
    .kpis .net.loss b { color: var(--c-error); }
  `,
})
export class GlPnl {
  protected readonly i18n = inject(LanguageService);
  private readonly gl = inject(GlService);

  readonly start = input.required<string>();
  readonly end = input.required<string>();
  readonly openAccount = output<string>();

  protected readonly pnl = signal<IncomeStatement | null>(null);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);

  constructor() {
    effect(() => {
      this.start();
      this.end();
      this.gl.version();
      untracked(() => void this.load());
    });
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const p = await this.gl.incomeStatement(this.start(), this.end());
      // Accounts that netted to zero in the period (e.g. an expense and its reversal) add only noise.
      const nz = (ls: PnlLine[]) => ls.filter((l) => Math.abs(l.amount) >= 0.5);
      this.pnl.set({ ...p, revenue: nz(p.revenue), contraRevenue: nz(p.contraRevenue), costOfSales: nz(p.costOfSales), operatingExpenses: nz(p.operatingExpenses), otherIncome: nz(p.otherIncome) });
    } catch (e) {
      this.error.set(ApiError.from(e).message);
    } finally {
      this.loading.set(false);
    }
  }

  protected name(l: PnlLine): string {
    return (this.i18n.isSwahili() ? l.nameSw : l.name) || l.name;
  }

  protected day(v: string): Date | null {
    return parseLocal(v);
  }

  protected print(): void {
    const p = this.pnl();
    if (!p) return;
    const t = (en: string, sw: string) => this.i18n.t(en, sw);
    const f = (n: number) => Money.format(n, { decimals: 0 });
    const rows: (string | number)[][] = [];
    const add = (lines: PnlLine[]) => lines.forEach((l) => rows.push([l.code, this.name(l), f(l.amount)]));
    add(p.revenue);
    add(p.contraRevenue);
    rows.push(['', t('Net sales', 'Mauzo halisi'), f(p.netRevenue)]);
    add(p.costOfSales);
    rows.push(['', t('Gross profit', 'Faida ghafi'), f(p.grossProfit)]);
    add(p.operatingExpenses);
    rows.push(['', t('Operating profit', 'Faida ya uendeshaji'), f(p.operatingProfit)]);
    add(p.otherIncome);
    rows.push(['', t('Net profit', 'Faida halisi'), f(p.netProfit)]);
    printReport({
      title: t('Profit & loss', 'Faida na hasara'),
      subtitle: `${p.periodStart} – ${p.periodEnd}`,
      headers: [t('Code', 'Namba'), t('Account', 'Akaunti'), t('Amount', 'Kiasi')],
      rows,
      numeric: [2],
    });
  }
}
