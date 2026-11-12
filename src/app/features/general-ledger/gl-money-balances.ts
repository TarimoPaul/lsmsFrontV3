import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal, untracked } from '@angular/core';

import { ApiError } from '@core/api/api.types';
import { LanguageService } from '@core/i18n/language.service';
import { EmptyState, Icon, Skeleton } from '@shared/ui';
import { parseLocal } from '@shared/utils/date-utils';
import { MoneyPipe } from '@shared/utils/money';
import { BalanceSheet } from './gl.models';
import { GlService } from './gl.service';
import { MONEY_ACCOUNTS } from './money-accounts';
import { MoneyUsageService } from './money-usage.service';

/**
 * (owner 12/11 fj 4) "Balance per account": every money account (cash, all banks, all wallets — none is switched off)
 * as the books show it on the chosen day (the period's end, e.g. a month end), next to what the owner types from the
 * statement. The difference is only shown, never posted and never saved: a correction is a journal, made on purpose.
 * Before the cut-over D bank / phone money is still inside 1000 (Cash), so the bank rows mean little until then.
 */
@Component({
  selector: 'app-gl-money-balances',
  imports: [EmptyState, Icon, Skeleton, MoneyPipe, DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (loading() && !bs()) {
      <lsms-skeleton variant="list" [rows]="6" />
    } @else if (error()) {
      <lsms-empty-state icon="error" iconColor="var(--c-error)" [title]="i18n.t('Could not load the balances', 'Imeshindwa kupakia salio')" [message]="error()!" [secondaryActionLabel]="i18n.t('Retry', 'Jaribu tena')" (secondaryAction)="load()" />
    } @else if (bs(); as b) {
      <p class="asof"><lsms-icon name="event" [size]="16" />{{ i18n.t('Balances as of', 'Salio hadi') }} <b>{{ day(b.asOfDate) | date: 'd MMMM yyyy' }}</b>
        <small>{{ i18n.t('Type the statement balance to see the difference. Nothing is saved or posted.', 'Andika salio la taarifa kuona tofauti. Hakuna kinachohifadhiwa wala kuandikwa.') }}</small></p>
      <table class="t" data-test="salio-kwa-akaunti">
        <thead><tr><th>{{ i18n.t('Account', 'Akaunti') }}</th><th class="n">{{ i18n.t('Books', 'Vitabu') }}</th><th class="n">{{ i18n.t('Statement', 'Taarifa') }}</th><th class="n">{{ i18n.t('Difference', 'Tofauti') }}</th><th>{{ i18n.t('Last used', 'Ilitumika mwisho') }}</th></tr></thead>
        <tbody>
          @for (r of rows(); track r.code) {
            <tr [attr.data-code]="r.code">
              <td><button type="button" class="lnk" (click)="openAccount.emit(r.code)"><span class="code">{{ r.code }}</span> {{ r.name }}</button></td>
              <td class="n">{{ r.books | money: { decimals: 0 } }}</td>
              <td class="n"><input type="text" inputmode="decimal" [value]="stmt()[r.code] ?? ''" (input)="setStmt(r.code, $any($event.target).value)" [attr.aria-label]="i18n.t('Statement', 'Taarifa') + ' ' + r.name" /></td>
              <td class="n" [class.bad]="diff(r) !== null && diff(r) !== 0" [class.ok]="diff(r) === 0">{{ diff(r) === null ? '—' : (diff(r)! | money: { decimals: 0 }) }}</td>
              <td class="muted">{{ r.lastUsed ?? '—' }}</td>
            </tr>
          }
        </tbody>
        <tfoot><tr><td>{{ i18n.t('Total', 'Jumla') }}</td><td class="n">{{ total() | money: { decimals: 0 } }}</td><td></td><td></td><td></td></tr></tfoot>
      </table>
    }
  `,
  styles: `
    :host { display: block; }
    .asof { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; margin: 4px 0 12px; font-size: 0.86rem; }
    .asof small { flex-basis: 100%; color: var(--c-text-2); font-size: 0.74rem; }
    .t { width: 100%; border-collapse: collapse; font-size: 0.84rem; }
    .t th, .t td { padding: 8px 10px; border-bottom: 1px solid var(--c-border); text-align: left; }
    .t th { font-size: 0.72rem; font-weight: 600; color: var(--c-text-2); text-transform: uppercase; letter-spacing: 0.03em; }
    .t .n { text-align: right; font-variant-numeric: tabular-nums; }
    .t tfoot td { font-weight: 600; }
    .t input { width: 130px; max-width: 100%; padding: 5px 8px; border: 1px solid var(--c-border); border-radius: 8px; background: var(--c-surface); color: var(--c-text); font: inherit; text-align: right; }
    .code { color: var(--c-text-2); font-variant-numeric: tabular-nums; margin-right: 4px; }
    .lnk { border: 0; background: none; padding: 0; font: inherit; color: var(--c-text); cursor: pointer; text-align: left; }
    .lnk:hover { color: var(--c-primary); }
    .bad { color: var(--c-error); font-weight: 600; }
    .ok { color: var(--c-success); }
    .muted { color: var(--c-text-2); font-size: 0.76rem; }
    @media (max-width: 640px) { .t th:nth-child(5), .t td:nth-child(5) { display: none; } .t input { width: 96px; } }
  `,
})
export class GlMoneyBalances {
  protected readonly i18n = inject(LanguageService);
  private readonly gl = inject(GlService);
  private readonly usage = inject(MoneyUsageService);
  readonly asOf = input.required<string>();
  readonly openAccount = output<string>();

  protected readonly bs = signal<BalanceSheet | null>(null);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  /** Typed statement balances (this screen only). */
  protected readonly stmt = signal<Record<string, string>>({});

  protected readonly rows = computed(() => {
    const assets = new Map((this.bs()?.assets.accounts ?? []).map((a) => [a.code, a.amount]));
    const used = new Map((this.usage.usage.value() ?? []).map((u) => [u.code, u.lastUsed]));
    return MONEY_ACCOUNTS.map((a) => ({ code: a.code, name: this.i18n.isSwahili() ? a.sw : a.en, books: assets.get(a.code) ?? 0, lastUsed: used.get(a.code) ?? null }));
  });
  protected readonly total = computed(() => this.rows().reduce((n, r) => n + r.books, 0));

  constructor() {
    effect(() => {
      this.asOf();
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

  protected setStmt(code: string, v: string): void {
    this.stmt.update((s) => ({ ...s, [code]: v }));
  }

  protected diff(r: { code: string; books: number }): number | null {
    const raw = (this.stmt()[r.code] ?? '').replace(/[,\s]/g, '');
    if (!raw || !/^-?\d+(\.\d+)?$/.test(raw)) return null;
    return Math.round((Number(raw) - r.books) * 100) / 100;
  }

  protected day(d: string): Date | null {
    return parseLocal(d);
  }
}
