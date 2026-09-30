import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, effect, inject, input, output, signal, untracked } from '@angular/core';

import { ApiError } from '@core/api/api.types';
import { LanguageService } from '@core/i18n/language.service';
import { Button, EmptyState, Icon, Skeleton } from '@shared/ui';
import { printReport } from '@shared/utils/export';
import { parseLocal } from '@shared/utils/date-utils';
import { Money, MoneyPipe } from '@shared/utils/money';
import { BalanceSheet, BsAccount } from './gl.models';
import { GlService } from './gl.service';

/**
 * Balance sheet as of a date: Assets = Liabilities + Equity. Contra accounts
 * (accumulated depreciation, drawings) show as negatives inside their section;
 * retained earnings = profit to date. Balances on the wrong side (negative
 * stock, bank or receivables) are flagged — they always mean missing postings.
 */
@Component({
  selector: 'app-gl-balance-sheet',
  imports: [Button, Icon, EmptyState, Skeleton, MoneyPipe, DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (loading() && !bs()) {
      <lsms-skeleton variant="list" [rows]="8" />
    } @else if (error()) {
      <lsms-empty-state icon="error" iconColor="var(--c-error)" [title]="i18n.t('Could not load the balance sheet', 'Imeshindwa kupakia mizania')" [message]="error()!" [secondaryActionLabel]="i18n.t('Retry', 'Jaribu tena')" (secondaryAction)="load()" />
    } @else if (bs(); as b) {
      <div class="bar">
        <span class="asof"><lsms-icon name="event" [size]="16" />{{ i18n.t('As of', 'Hadi') }} {{ day(b.asOfDate) | date: 'd MMMM yyyy' }}</span>
        <span class="chip" [class.ok]="b.isBalanced" [class.bad]="!b.isBalanced">
          <lsms-icon [name]="b.isBalanced ? 'verified' : 'error'" [size]="15" />
          {{ b.isBalanced ? i18n.t('Balanced', 'Inalingana') : i18n.t('NOT balanced', 'HAILINGANI') }}
        </span>
        <span class="sp"></span>
        <button lsmsButton="secondary" size="sm" icon="print" (click)="print()">{{ i18n.t('Print', 'Chapisha') }}</button>
      </div>
      <div class="stmt cols">
        <div class="stmt">
          <section class="sec" style="--sc: var(--c-info)">
            <h3><lsms-icon name="account_balance_wallet" [size]="16" />{{ i18n.t('Assets', 'Mali') }}</h3>
            @for (a of b.assets.accounts; track a.code) {
              <div class="row click" [class.warn-row]="abnormal(a, 'asset')" (click)="openAccount.emit(a.code)">
                <span class="code">{{ a.code }}</span>
                <span class="nm">{{ name(a) }}@if (abnormal(a, 'asset')) { <small class="neg">{{ i18n.t('Wrong-side balance — postings are missing', 'Salio upande usio sahihi — kuna maingizo yaliyokosekana') }}</small> }</span>
                <span class="amt" [class.neg]="a.amount < 0">{{ a.amount | money: { decimals: 0 } }}</span>
              </div>
            } @empty { <div class="empty-row">—</div> }
            <div class="sub"><span>{{ i18n.t('Total assets', 'Jumla ya mali') }}</span><span>{{ b.totalAssets | money: { decimals: 0 } }}</span></div>
          </section>
        </div>
        <div class="stmt">
          <section class="sec" style="--sc: var(--c-warning)">
            <h3><lsms-icon name="credit_card" [size]="16" />{{ i18n.t('Liabilities', 'Madeni') }}</h3>
            @for (a of b.liabilities.accounts; track a.code) {
              <div class="row click" [class.warn-row]="abnormal(a, 'liability')" (click)="openAccount.emit(a.code)">
                <span class="code">{{ a.code }}</span><span class="nm">{{ name(a) }}</span>
                <span class="amt" [class.neg]="a.amount < 0">{{ a.amount | money: { decimals: 0 } }}</span>
              </div>
            } @empty { <div class="empty-row">{{ i18n.t('No liabilities', 'Hakuna madeni') }}</div> }
            <div class="sub"><span>{{ i18n.t('Total liabilities', 'Jumla ya madeni') }}</span><span>{{ b.liabilities.subtotal | money: { decimals: 0 } }}</span></div>
          </section>
          <section class="sec" style="--sc: var(--c-secondary)">
            <h3><lsms-icon name="savings" [size]="16" />{{ i18n.t('Equity', 'Mtaji') }}</h3>
            @for (a of b.equity.accounts; track a.code) {
              <div class="row" [class.click]="a.code !== 'NI'" (click)="a.code !== 'NI' && openAccount.emit(a.code)">
                <span class="code">{{ a.code === 'NI' ? '' : a.code }}</span><span class="nm">{{ name(a) }}</span>
                <span class="amt" [class.neg]="a.amount < 0">{{ a.amount | money: { decimals: 0 } }}</span>
              </div>
            }
            <div class="sub"><span>{{ i18n.t('Total equity', 'Jumla ya mtaji') }}</span><span>{{ b.equity.subtotal | money: { decimals: 0 } }}</span></div>
          </section>
          <div class="grand" [style.--gc]="b.isBalanced ? 'var(--c-success)' : 'var(--c-error)'">
            <span>{{ i18n.t('Liabilities + equity', 'Madeni + mtaji') }}</span>
            <span class="amt">{{ b.totalLiabilitiesAndEquity | money: { decimals: 0 } }}</span>
          </div>
        </div>
      </div>
    }
  `,
  styles: `
    @use 'statement';
    @include statement.base;
    :host { display: flex; flex-direction: column; gap: 14px; }
    .bar { display: flex; align-items: center; flex-wrap: wrap; gap: 10px; }
    .asof { display: inline-flex; align-items: center; gap: 6px; font-size: 0.86rem; font-weight: 600; color: var(--c-text); }
    .asof lsms-icon { color: var(--c-primary); }
    .chip { display: inline-flex; align-items: center; gap: 5px; padding: 3px 10px; border-radius: 100px; font-size: 0.74rem; font-weight: 600; }
    .chip.ok { color: var(--c-success); background: color-mix(in srgb, var(--c-success) 12%, transparent); }
    .chip.bad { color: var(--c-error); background: color-mix(in srgb, var(--c-error) 12%, transparent); }
    .sp { flex: 1; }
    .cols { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 420px), 1fr)); align-items: start; }
  `,
})
export class GlBalanceSheet {
  protected readonly i18n = inject(LanguageService);
  private readonly gl = inject(GlService);

  readonly asOf = input.required<string>();
  readonly openAccount = output<string>();

  protected readonly bs = signal<BalanceSheet | null>(null);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);

  constructor() {
    effect(() => {
      this.asOf();
      this.gl.version();
      untracked(() => void this.load());
    });
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      this.bs.set(await this.gl.balanceSheet(this.asOf()));
    } catch (e) {
      this.error.set(ApiError.from(e).message);
    } finally {
      this.loading.set(false);
    }
  }

  protected name(a: BsAccount): string {
    return (this.i18n.isSwahili() ? a.nameSw : a.name) || a.name;
  }

  /** Assets and liabilities below zero (except the contra account 1590). */
  protected abnormal(a: BsAccount, kind: 'asset' | 'liability'): boolean {
    if (a.code === '1590') return false;
    return a.amount < -0.5 && (kind === 'asset' || kind === 'liability');
  }

  protected day(v: string): Date | null {
    return parseLocal(v);
  }

  protected print(): void {
    const b = this.bs();
    if (!b) return;
    const t = (en: string, sw: string) => this.i18n.t(en, sw);
    const rows: (string | number)[][] = [];
    const section = (title: string, accounts: BsAccount[], total: number) => {
      rows.push([title, '', '']);
      for (const a of accounts) rows.push([a.code === 'NI' ? '' : a.code, this.name(a), Money.format(a.amount, { decimals: 0 })]);
      rows.push(['', t('Total', 'Jumla') + ' ' + title.toLowerCase(), Money.format(total, { decimals: 0 })]);
    };
    section(t('Assets', 'Mali'), b.assets.accounts, b.totalAssets);
    section(t('Liabilities', 'Madeni'), b.liabilities.accounts, b.liabilities.subtotal);
    section(t('Equity', 'Mtaji'), b.equity.accounts, b.equity.subtotal);
    printReport({
      title: t('Balance sheet', 'Mizania'),
      subtitle: t('As of ', 'Hadi ') + b.asOfDate,
      headers: [t('Code', 'Namba'), t('Account', 'Akaunti'), t('Amount', 'Kiasi')],
      rows,
      numeric: [2],
      summary: [
        [t('Total assets', 'Jumla ya mali'), Money.format(b.totalAssets, { decimals: 0 })],
        [t('Liabilities + equity', 'Madeni + mtaji'), Money.format(b.totalLiabilitiesAndEquity, { decimals: 0 })],
      ],
    });
  }
}
