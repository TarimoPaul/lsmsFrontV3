import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal, untracked } from '@angular/core';

import { ApiError } from '@core/api/api.types';
import { LanguageService } from '@core/i18n/language.service';
import { Button, DataTable, EmptyState, Icon, TableColumn } from '@shared/ui';
import { downloadCsv } from '@shared/utils/export';
import { MoneyPipe } from '@shared/utils/money';
import { ACCOUNT_TYPES, TrialBalance, TrialBalanceLine } from './gl.models';
import { GlService } from './gl.service';

/**
 * Trial balance as of the period end: every account's closing balance
 * (Dr or Cr), with the balance brought forward and the period's movement.
 * Σ Dr must equal Σ Cr. Wrong-side balances are flagged.
 */
@Component({
  selector: 'app-gl-trial-balance',
  imports: [DataTable, TableColumn, Button, Icon, EmptyState, MoneyPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (error()) {
      <lsms-empty-state icon="error" iconColor="var(--c-error)" [title]="i18n.t('Could not load the trial balance', 'Imeshindwa kupakia trial balance')" [message]="error()!" [secondaryActionLabel]="i18n.t('Retry', 'Jaribu tena')" (secondaryAction)="load()" />
    } @else {
      @if (tb(); as t) {
        <div class="bar">
          <span class="chip" [class.ok]="t.isBalanced" [class.bad]="!t.isBalanced">
            <lsms-icon [name]="t.isBalanced ? 'verified' : 'error'" [size]="15" />
            Σ Dr {{ t.totalDebits | money: { decimals: 0 } }} · Σ Cr {{ t.totalCredits | money: { decimals: 0 } }}
          </span>
          @if (abnormalCount()) {
            <span class="chip bad"><lsms-icon name="warning" [size]="15" />{{ i18n.t(abnormalCount() + ' wrong-side balance(s)', 'Salio ' + abnormalCount() + ' upande usio sahihi') }}</span>
          }
          <span class="sp"></span>
          <button lsmsButton="secondary" size="sm" icon="download" (click)="csv()">CSV</button>
        </div>
      }
      <div class="table-card">
        <lsms-data-table
          [title]="i18n.t('Trial balance', 'Trial balance')"
          [items]="tb()?.lines ?? []"
          [rowId]="rowId"
          [loading]="loading()"
          [pageSize]="100"
          [showRowNumbers]="false"
          [mobileTitle]="title"
          [mobileColumns]="['dr', 'cr']"
          [emptyTitle]="i18n.t('No postings', 'Hakuna maingizo')"
          (rowClick)="openAccount.emit($event.accountCode)"
        >
          <ng-template lsmsColumn="account" [label]="i18n.t('Account', 'Akaunti')" [sortBy]="byCode" [locked]="true" let-row>
            <span class="acc" [class.bad]="row.abnormal">
              <span class="code">{{ row.accountCode }}</span>
              <span class="cell-stack">
                <strong>{{ name(row) }}</strong>
                <small>{{ typeLabel(row.accountType) }}@if (row.abnormal) { · <em>{{ i18n.t('wrong side', 'upande usio sahihi') }}</em> }</small>
              </span>
            </span>
          </ng-template>
          <ng-template lsmsColumn="opening" [label]="i18n.t('Brought forward', 'Salio la mwanzo')" align="end" [hidden]="true" let-row>
            <span class="num">{{ row.openingBalance | money: { decimals: 0, symbol: false } }}</span>
          </ng-template>
          <ng-template lsmsColumn="pdr" [label]="i18n.t('Period Dr', 'Dr ya kipindi')" align="end" let-row>
            <span class="num muted">{{ row.periodDebit | money: { decimals: 0, symbol: false } }}</span>
          </ng-template>
          <ng-template lsmsColumn="pcr" [label]="i18n.t('Period Cr', 'Cr ya kipindi')" align="end" let-row>
            <span class="num muted">{{ row.periodCredit | money: { decimals: 0, symbol: false } }}</span>
          </ng-template>
          <ng-template lsmsColumn="dr" [label]="i18n.t('Debit', 'Debit')" align="end" [sortBy]="byDr" let-row>
            <span class="num strong">{{ row.debitBalance ? (row.debitBalance | money: { decimals: 0, symbol: false }) : '' }}</span>
          </ng-template>
          <ng-template lsmsColumn="cr" [label]="i18n.t('Credit', 'Credit')" align="end" [sortBy]="byCr" let-row>
            <span class="num strong">{{ row.creditBalance ? (row.creditBalance | money: { decimals: 0, symbol: false }) : '' }}</span>
          </ng-template>
        </lsms-data-table>
      </div>
    }
  `,
  styles: `
    @use 'list-page';
    @include list-page.base;
    :host { display: flex; flex-direction: column; gap: 12px; }
    .bar { display: flex; align-items: center; flex-wrap: wrap; gap: 10px; }
    .sp { flex: 1; }
    .chip { display: inline-flex; align-items: center; gap: 5px; padding: 4px 11px; border-radius: 100px; font-size: 0.76rem; font-weight: 600; }
    .chip.ok { color: var(--c-success); background: color-mix(in srgb, var(--c-success) 12%, transparent); }
    .chip.bad { color: var(--c-error); background: color-mix(in srgb, var(--c-error) 12%, transparent); }
    .acc { display: inline-flex; align-items: center; gap: 10px; }
    .acc .code { min-width: 40px; font-size: 0.74rem; color: var(--c-text-2); font-variant-numeric: tabular-nums; }
    .acc.bad strong, .acc.bad em { color: var(--c-error); }
    em { font-style: normal; }
  `,
})
export class GlTrialBalance {
  protected readonly i18n = inject(LanguageService);
  private readonly gl = inject(GlService);

  readonly start = input.required<string>();
  readonly end = input.required<string>();
  readonly openAccount = output<string>();

  protected readonly tb = signal<TrialBalance | null>(null);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly abnormalCount = computed(() => (this.tb()?.lines ?? []).filter((l) => l.abnormal).length);

  protected readonly rowId = (r: TrialBalanceLine) => r.accountCode;
  protected readonly title = (r: TrialBalanceLine) => `${r.accountCode} · ${this.name(r)}`;
  protected readonly byCode = (r: TrialBalanceLine) => r.accountCode;
  protected readonly byDr = (r: TrialBalanceLine) => r.debitBalance;
  protected readonly byCr = (r: TrialBalanceLine) => r.creditBalance;

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
      this.tb.set(await this.gl.trialBalance(this.start(), this.end()));
    } catch (e) {
      this.error.set(ApiError.from(e).message);
    } finally {
      this.loading.set(false);
    }
  }

  protected name(r: TrialBalanceLine): string {
    return (this.i18n.isSwahili() ? r.accountNameSw : r.accountName) || r.accountName;
  }

  protected typeLabel(t: string | null): string {
    const l = t ? ACCOUNT_TYPES[t] : null;
    return l ? (this.i18n.isSwahili() ? l.sw : l.en) : '';
  }

  protected csv(): void {
    const t = this.tb();
    if (!t) return;
    downloadCsv(
      `trial-balance-${t.periodEnd}`,
      ['Code', 'Account', 'Type', 'Opening (Dr-Cr)', 'Period Dr', 'Period Cr', 'Debit', 'Credit'],
      t.lines.map((l) => [l.accountCode, l.accountName, l.accountType ?? '', l.openingBalance, l.periodDebit, l.periodCredit, l.debitBalance, l.creditBalance]),
    );
  }
}
