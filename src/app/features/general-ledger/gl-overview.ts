import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal, untracked } from '@angular/core';

import { ApiError } from '@core/api/api.types';
import { AuthService } from '@core/auth/auth.service';
import { LanguageService } from '@core/i18n/language.service';
import { Button, EmptyState, Icon, Skeleton } from '@shared/ui';
import { parseLocal } from '@shared/utils/date-utils';
import { MoneyPipe } from '@shared/utils/money';
import { CONTROL_HELP, ControlCheck, FinancialPosition, GlStatus } from './gl.models';
import { GlService } from './gl.service';

/**
 * Health of the books: posting mode, the accounting equation, and every GL
 * control account against its operational sub-ledger (stock, customer debts,
 * supplier debts, staff debts, loans). A difference means postings are
 * missing; an accountant brings it in line with one audited true-up entry.
 */
@Component({
  selector: 'app-gl-overview',
  imports: [Button, Icon, EmptyState, Skeleton, MoneyPipe, DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (loading() && !position()) {
      <lsms-skeleton variant="list" [rows]="6" />
    } @else if (error()) {
      <lsms-empty-state icon="error" iconColor="var(--c-error)" [title]="i18n.t('Could not load', 'Imeshindwa kupakia')" [message]="error()!" [secondaryActionLabel]="i18n.t('Retry', 'Jaribu tena')" (secondaryAction)="load()" />
    } @else {
      @if (status(); as s) {
        <div class="status" [class.off]="!s.postingEnabled" [class.shadow]="s.postingEnabled && s.shadowMode">
          <lsms-icon [name]="s.postingEnabled ? (s.shadowMode ? 'visibility' : 'bolt') : 'pause_circle'" [size]="20" />
          <span>
            <b>{{ s.postingEnabled ? (s.shadowMode ? i18n.t('GL in shadow mode', 'GL iko shadow mode') : i18n.t('GL is live', 'GL iko hai')) : i18n.t('GL posting is off', 'GL imezimwa') }}</b>
            <small>{{ i18n.t(s.totalEntriesPosted + ' entries · last posting ', 'Maingizo ' + s.totalEntriesPosted + ' · la mwisho ') }}{{ day(s.lastPostingDate) | date: 'd MMM yyyy' }}@if (s.unbalancedEntries) { · <em>{{ i18n.t(s.unbalancedEntries + ' unbalanced', s.unbalancedEntries + ' hazilingani') }}</em> }</small>
          </span>
        </div>
      }

      @if (position(); as p) {
        <div class="eq">
          <div><small>{{ i18n.t('Assets', 'Mali') }}</small><b>{{ p.totalAssets | money: { decimals: 0 } }}</b></div>
          <span class="op">=</span>
          <div><small>{{ i18n.t('Liabilities', 'Madeni') }}</small><b>{{ p.totalLiabilities | money: { decimals: 0 } }}</b></div>
          <span class="op">+</span>
          <div><small>{{ i18n.t('Equity', 'Mtaji') }}</small><b>{{ p.totalEquity | money: { decimals: 0 } }}</b></div>
          <span class="chip" [class.ok]="p.isBalanced" [class.bad]="!p.isBalanced"><lsms-icon [name]="p.isBalanced ? 'verified' : 'error'" [size]="15" />{{ p.isBalanced ? i18n.t('Balanced', 'Inalingana') : i18n.t('Not balanced', 'Hailingani') }}</span>
        </div>
      }

      <section class="checks">
        <header>
          <h3><lsms-icon name="rule" [size]="18" />{{ i18n.t('GL vs operational records', 'GL dhidi ya kumbukumbu za kila siku') }}</h3>
          <small>{{ i18n.t('As of', 'Hadi') }} {{ day(asOf()) | date: 'd MMM yyyy' }} · {{ i18n.t(unreconciled() + ' need attention', unreconciled() + ' zinahitaji kurekebishwa') }}</small>
        </header>
        <div class="grid">
          @for (c of checks(); track c.key) {
            <article [class.ok]="c.reconciled" [class.bad]="!c.reconciled">
              <div class="top">
                <lsms-icon [name]="c.reconciled ? 'check_circle' : 'error'" [size]="18" />
                <b>{{ i18n.isSwahili() ? c.labelSw : c.label }}</b>
                <span class="code">{{ c.accountCode }}</span>
              </div>
              <p class="help">{{ help(c) }}</p>
              <dl>
                <div><dt>GL</dt><dd [class.neg]="c.glBalance < 0">{{ c.glBalance | money: { decimals: 0 } }}</dd></div>
                <div><dt>{{ i18n.t('Records', 'Kumbukumbu') }}</dt><dd>{{ c.subLedgerBalance | money: { decimals: 0 } }}</dd></div>
                <div class="diff"><dt>{{ i18n.t('Difference', 'Tofauti') }}</dt><dd>{{ c.difference | money: { decimals: 0 } }}</dd></div>
              </dl>
              <div class="acts">
                <button type="button" class="link" (click)="openAccount.emit(c.accountCode)">{{ i18n.t('Ledger', 'Leja') }}</button>
                @if (!c.reconciled && canWrite()) {
                  <button lsmsButton="secondary" size="sm" icon="build" (click)="trueUp.emit(c)">{{ i18n.t('Correct', 'Rekebisha') }}</button>
                }
              </div>
            </article>
          }
        </div>
      </section>

      @if (position(); as p) {
        <section class="checks">
          <header>
            <h3><lsms-icon name="savings" [size]="18" />{{ i18n.t('Cash, bank & mobile money', 'Pesa, benki na simu') }}</h3>
            <small>{{ i18n.t('No sub-ledger: compare with a physical count / statement', 'Linganisha na hesabu halisi / taarifa ya benki') }}</small>
          </header>
          <div class="cash">
            @for (a of p.cashAccounts; track a.code) {
              <div class="c" [class.bad]="a.amount < 0">
                <span><b>{{ i18n.isSwahili() ? (a.nameSw || a.name) : a.name }}</b><small>{{ a.code }}</small></span>
                <em>{{ a.amount | money: { decimals: 0 } }}</em>
                @if (canWrite()) {
                  <button type="button" class="link" (click)="cashCount.emit(a.code)">{{ i18n.t('Count', 'Hesabu') }}</button>
                }
              </div>
            } @empty {
              <p class="help">{{ i18n.t('No cash postings yet.', 'Hakuna maingizo ya pesa bado.') }}</p>
            }
          </div>
        </section>
      }
    }
  `,
  styles: `
    :host { display: flex; flex-direction: column; gap: 14px; }
    .status { display: flex; align-items: center; gap: 12px; padding: 12px 16px; border-radius: 14px; color: var(--c-success); background: color-mix(in srgb, var(--c-success) 8%, var(--c-surface)); border: 1px solid color-mix(in srgb, var(--c-success) 30%, transparent); }
    .status.shadow { color: var(--c-warning); background: color-mix(in srgb, var(--c-warning) 8%, var(--c-surface)); border-color: color-mix(in srgb, var(--c-warning) 30%, transparent); }
    .status.off { color: var(--c-text-2); background: var(--c-surface); border-color: var(--c-border); }
    .status span { display: flex; flex-direction: column; }
    .status b { font-size: 0.9rem; color: var(--c-text); }
    .status small { font-size: 0.74rem; color: var(--c-text-2); }
    .status em { font-style: normal; color: var(--c-error); font-weight: 600; }
    .eq { display: flex; align-items: center; flex-wrap: wrap; gap: 10px 14px; padding: 14px 16px; border-radius: 16px; border: 1px solid var(--c-border); background: var(--c-surface); }
    .eq > div { display: flex; flex-direction: column; }
    .eq small { font-size: 0.72rem; color: var(--c-text-2); }
    .eq b { font-size: 1.05rem; font-weight: 700; color: var(--c-text); font-variant-numeric: tabular-nums; }
    .op { font-size: 1.2rem; color: var(--c-text-2); }
    .chip { display: inline-flex; align-items: center; gap: 5px; margin-left: auto; padding: 4px 11px; border-radius: 100px; font-size: 0.76rem; font-weight: 600; }
    .chip.ok { color: var(--c-success); background: color-mix(in srgb, var(--c-success) 12%, transparent); }
    .chip.bad { color: var(--c-error); background: color-mix(in srgb, var(--c-error) 12%, transparent); }
    .checks header { display: flex; align-items: baseline; flex-wrap: wrap; gap: 4px 12px; margin-bottom: 10px; }
    .checks h3 { display: inline-flex; align-items: center; gap: 8px; margin: 0; font-size: 0.95rem; font-weight: 700; color: var(--c-text); }
    .checks h3 lsms-icon { color: var(--c-primary); }
    .checks header small { font-size: 0.76rem; color: var(--c-text-2); }
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 280px), 1fr)); gap: 12px; }
    article { display: flex; flex-direction: column; gap: 8px; padding: 14px; border-radius: 14px; border: 1px solid var(--c-border); background: var(--c-surface); }
    article.bad { border-color: color-mix(in srgb, var(--c-error) 40%, var(--c-border)); }
    .top { display: flex; align-items: center; gap: 8px; }
    .top b { flex: 1; font-size: 0.88rem; font-weight: 600; color: var(--c-text); }
    article.ok .top lsms-icon { color: var(--c-success); }
    article.bad .top lsms-icon { color: var(--c-error); }
    .code { font-size: 0.72rem; color: var(--c-text-2); }
    .help { margin: 0; font-size: 0.74rem; color: var(--c-text-2); }
    dl { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; margin: 0; }
    dl div { display: flex; flex-direction: column; }
    dt { font-size: 0.68rem; color: var(--c-text-2); }
    dd { margin: 0; font-size: 0.82rem; font-weight: 600; color: var(--c-text); font-variant-numeric: tabular-nums; }
    .diff dd { color: var(--c-error); }
    article.ok .diff dd { color: var(--c-success); }
    .neg { color: var(--c-error) !important; }
    .acts { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
    .link { padding: 0; border: 0; background: transparent; font: inherit; font-size: 0.8rem; font-weight: 600; color: var(--c-primary); cursor: pointer; }
    .cash { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 240px), 1fr)); gap: 10px; }
    .c { display: flex; align-items: center; gap: 10px; padding: 12px 14px; border-radius: 12px; border: 1px solid var(--c-border); background: var(--c-surface); }
    .c.bad { border-color: color-mix(in srgb, var(--c-error) 40%, var(--c-border)); }
    .c span { flex: 1; display: flex; flex-direction: column; }
    .c b { font-size: 0.84rem; font-weight: 500; color: var(--c-text); }
    .c small { font-size: 0.7rem; color: var(--c-text-2); }
    .c em { font-style: normal; font-weight: 700; color: var(--c-text); font-variant-numeric: tabular-nums; }
    .c.bad em { color: var(--c-error); }
  `,
})
export class GlOverview {
  protected readonly i18n = inject(LanguageService);
  private readonly gl = inject(GlService);
  private readonly auth = inject(AuthService);

  readonly asOf = input.required<string>();
  readonly openAccount = output<string>();
  readonly trueUp = output<ControlCheck>();
  readonly cashCount = output<string>();

  protected readonly status = signal<GlStatus | null>(null);
  protected readonly position = signal<FinancialPosition | null>(null);
  protected readonly checks = signal<ControlCheck[]>([]);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly canWrite = computed(() => this.auth.hasPermission('FINANCE_WRITE'));
  protected readonly unreconciled = computed(() => this.checks().filter((c) => !c.reconciled).length);

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
      const [s, p, c] = await Promise.all([this.gl.status(), this.gl.position(this.asOf()), this.gl.controlChecks(this.asOf())]);
      this.status.set(s);
      this.position.set(p);
      this.checks.set(c);
    } catch (e) {
      this.error.set(ApiError.from(e).message);
    } finally {
      this.loading.set(false);
    }
  }

  protected help(c: ControlCheck): string {
    const h = CONTROL_HELP[c.key];
    return h ? (this.i18n.isSwahili() ? h.sw : h.en) : '';
  }

  protected day(v: string | null): Date | null {
    return parseLocal(v);
  }
}
