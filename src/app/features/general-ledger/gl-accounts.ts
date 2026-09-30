import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal, untracked } from '@angular/core';

import { LanguageService } from '@core/i18n/language.service';
import { EmptyState, Icon, SearchBar, Skeleton } from '@shared/ui';
import { MoneyPipe } from '@shared/utils/money';
import { ACCOUNT_TYPES, GlAccount } from './gl.models';
import { GlService } from './gl.service';

interface Row {
  account: GlAccount;
  balance: number;
}

/** Chart of accounts grouped by type, each with its balance as of the period end. */
@Component({
  selector: 'app-gl-accounts',
  imports: [Icon, EmptyState, Skeleton, SearchBar, MoneyPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <lsms-search-bar [placeholder]="i18n.t('Search account…', 'Tafuta akaunti…')" (search)="q.set($event)" (cleared)="q.set('')" />
    @if (loading() && !groups().length) {
      <lsms-skeleton variant="list" [rows]="8" />
    } @else if (!groups().length) {
      <lsms-empty-state icon="search_off" [title]="i18n.t('No accounts', 'Hakuna akaunti')" />
    } @else {
      <div class="stmt">
        @for (g of groups(); track g.type) {
          <section class="sec" [style.--sc]="g.color">
            <h3><lsms-icon name="folder" [size]="16" />{{ g.label }}<span class="n">{{ g.rows.length }}</span></h3>
            @for (r of g.rows; track r.account.accountCode) {
              <div class="row click" (click)="openAccount.emit(r.account.accountCode)">
                <span class="code">{{ r.account.accountCode }}</span>
                <span class="nm">{{ name(r.account) }}<small>{{ r.account.accountCategory }} · {{ r.account.normalBalance === 'DEBIT' ? 'Dr' : 'Cr' }}</small></span>
                <span class="amt" [class.muted]="!r.balance" [class.neg]="r.balance < 0">{{ r.balance | money: { decimals: 0 } }}</span>
              </div>
            }
          </section>
        }
      </div>
    }
  `,
  styles: `
    @use 'statement';
    @include statement.base;
    :host { display: flex; flex-direction: column; gap: 12px; }
    .stmt { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 420px), 1fr)); align-items: start; }
    .n { margin-left: auto; font-size: 0.7rem; }
    .muted { color: var(--c-text-2); }
  `,
})
export class GlAccounts {
  protected readonly i18n = inject(LanguageService);
  private readonly gl = inject(GlService);

  readonly start = input.required<string>();
  readonly end = input.required<string>();
  readonly openAccount = output<string>();

  protected readonly q = signal('');
  protected readonly loading = signal(false);
  /** code → balance on the account's normal side. */
  private readonly balances = signal<Map<string, number>>(new Map());

  protected readonly groups = computed(() => {
    const q = this.q().trim().toLowerCase();
    const accts = (this.gl.accounts.value() ?? []).filter(
      (a) => !q || a.accountCode.includes(q) || a.accountName.toLowerCase().includes(q) || (a.accountNameSw ?? '').toLowerCase().includes(q),
    );
    return Object.entries(ACCOUNT_TYPES)
      .map(([type, l]) => ({
        type,
        color: l.color,
        label: this.i18n.isSwahili() ? l.sw : l.en,
        rows: accts
          .filter((a) => a.accountType === type)
          .sort((x, y) => x.accountCode.localeCompare(y.accountCode))
          .map<Row>((a) => ({ account: a, balance: this.balances().get(a.accountCode) ?? 0 })),
      }))
      .filter((g) => g.rows.length);
  });

  constructor() {
    void this.gl.accounts.load();
    effect(() => {
      this.start();
      this.end();
      this.gl.version();
      untracked(() => void this.load());
    });
  }

  private async load(): Promise<void> {
    this.loading.set(true);
    try {
      const tb = await this.gl.trialBalance(this.start(), this.end());
      const accts = await this.gl.accounts.load();
      const debitNormal = new Map(accts.map((a) => [a.accountCode, a.normalBalance === 'DEBIT']));
      this.balances.set(new Map(tb.lines.map((l) => [l.accountCode, debitNormal.get(l.accountCode) === false ? -l.netBalance : l.netBalance])));
    } catch {
      this.balances.set(new Map());
    } finally {
      this.loading.set(false);
    }
  }

  protected name(a: GlAccount): string {
    return (this.i18n.isSwahili() ? a.accountNameSw : a.accountName) || a.accountName;
  }
}
