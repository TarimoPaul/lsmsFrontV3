import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';

import { AuthService } from '@core/auth/auth.service';
import { LanguageService } from '@core/i18n/language.service';
import { Button, DialogService, EmptyState, Icon, MetricCard, MetricsGrid, Skeleton, ToastService } from '@shared/ui';
import { parseLocal } from '@shared/utils/date-utils';
import { MoneyPipe } from '@shared/utils/money';
import { moneyAccountByMethod } from '../general-ledger/money-accounts';
import type { MovementDialogData } from './capital-dialogs';
import { CapitalMovement, SOURCE_LABELS } from './capital.models';
import { CapitalService } from './capital.service';

/**
 * Owner capital register: new money put in (Dr cash / Cr Owner capital) and
 * money taken out (Dr Drawings / Cr cash). Loans and repayments are listed in
 * the Loans tab; voided entries stay visible, struck through.
 */
@Component({
  selector: 'app-owner-tab',
  imports: [Button, Icon, EmptyState, Skeleton, MetricCard, MetricsGrid, MoneyPipe, DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <lsms-metrics-grid [gap]="12">
      <lsms-metric-card [title]="i18n.t('Capital put in', 'Mtaji uliowekwa')" [value]="stats().in | money: { decimals: 0 }" icon="south_west" color="var(--c-success)" />
      <lsms-metric-card [title]="i18n.t('Taken out (drawings)', 'Kilichotolewa')" [value]="stats().out | money: { decimals: 0 }" icon="north_east" color="var(--c-error)" />
      <lsms-metric-card [title]="i18n.t('Net contributed', 'Mchango halisi')" [value]="stats().in - stats().out | money: { decimals: 0 }" icon="savings" color="var(--c-primary)" />
    </lsms-metrics-grid>

    <div class="bar">
      <span class="sp"></span>
      @if (canWrite()) {
        <button lsmsButton="secondary" icon="north_east" (click)="record('OUT')">{{ i18n.t('Withdrawal', 'Kutoa pesa') }}</button>
        <button lsmsButton="primary" icon="south_west" (click)="record('IN')">{{ i18n.t('Add capital', 'Ongeza mtaji') }}</button>
      }
    </div>

    @if (loading()) {
      <lsms-skeleton variant="list" [rows]="4" />
    } @else if (!rows().length) {
      <lsms-empty-state icon="savings" [title]="i18n.t('No capital movements', 'Hakuna harakati za mtaji')" />
    } @else {
      <ul class="list">
        @for (m of rows(); track m.uid) {
          @let src = source(m.source_type);
          <li [class.void]="m.injection_type === 'VOID'">
            <span class="dir" [class.out]="m.injection_type === 'WITHDRAWAL'"><lsms-icon [name]="m.injection_type === 'WITHDRAWAL' ? 'north_east' : 'south_west'" [size]="17" /></span>
            <span class="nm">
              <b>{{ m.reason }}</b>
              <small>{{ day(m.transaction_date) | date: 'd MMM yyyy' }} · {{ src ? (i18n.isSwahili() ? src.sw : src.en) : m.source_type }} · {{ method(m.payment_method) }}@if (m.created_by) { · {{ m.created_by }} }</small>
            </span>
            <em [class.out]="m.injection_type === 'WITHDRAWAL'">{{ m.injection_type === 'WITHDRAWAL' ? '−' : '+' }}{{ m.amount | money: { decimals: 0 } }}</em>
          </li>
        }
      </ul>
    }
  `,
  styles: `
    :host { display: flex; flex-direction: column; gap: 12px; }
    .bar { display: flex; align-items: center; gap: 10px; }
    .sp { flex: 1; }
    .list { display: flex; flex-direction: column; margin: 0; padding: 0; list-style: none; border-radius: 16px; border: 1px solid var(--c-border); background: var(--c-surface); overflow: hidden; }
    .list li { display: flex; align-items: center; gap: 12px; padding: 12px 16px; border-bottom: 1px solid var(--c-border); }
    .list li:last-child { border-bottom: 0; }
    .list li.void { opacity: 0.55; }
    .list li.void b, .list li.void em { text-decoration: line-through; }
    .dir { display: inline-flex; padding: 8px; border-radius: 12px; color: var(--c-success); background: color-mix(in srgb, var(--c-success) 12%, transparent); }
    .dir.out { color: var(--c-error); background: color-mix(in srgb, var(--c-error) 10%, transparent); }
    .nm { flex: 1; display: flex; flex-direction: column; min-width: 0; }
    .nm b { font-size: 0.88rem; font-weight: 500; color: var(--c-text); }
    .nm small { font-size: 0.72rem; color: var(--c-text-2); }
    em { font-style: normal; font-weight: 700; color: var(--c-success); font-variant-numeric: tabular-nums; }
    em.out { color: var(--c-error); }
  `,
})
export class OwnerTab {
  protected readonly i18n = inject(LanguageService);
  private readonly api = inject(CapitalService);
  private readonly auth = inject(AuthService);
  private readonly dialogs = inject(DialogService);
  private readonly toast = inject(ToastService);

  protected readonly loading = this.api.movements.initialLoading;
  protected readonly canWrite = computed(() => this.auth.hasPermission('CAPITAL_WRITE'));

  /** Owner / partner movements (loans live in their own tab). */
  protected readonly rows = computed(() =>
    (this.api.movements.value() ?? [])
      .filter((m) => m.source_type !== 'LOAN' && m.source_type !== 'LOAN_REPAYMENT' && !m.reclassified_from)
      .sort((a, b) => (b.transaction_date ?? '').localeCompare(a.transaction_date ?? '')),
  );
  protected readonly stats = computed(() => {
    const live = this.rows().filter((m) => m.injection_type !== 'VOID');
    return {
      in: live.filter((m) => m.injection_type === 'INJECTION').reduce((s, m) => s + m.amount, 0),
      out: live.filter((m) => m.injection_type === 'WITHDRAWAL').reduce((s, m) => s + m.amount, 0),
    };
  });

  constructor() {
    void this.api.movements.load();
  }

  protected async record(kind: 'IN' | 'OUT'): Promise<void> {
    const { MovementDialog } = await import('./capital-dialogs');
    const ok = await this.dialogs.openAsync<boolean, MovementDialogData>(MovementDialog, { size: 'md', data: { kind }, disableClose: true });
    if (ok) {
      await this.api.movements.load(true);
      this.toast.success(kind === 'IN' ? this.i18n.t('Capital recorded', 'Mtaji umerekodiwa') : this.i18n.t('Withdrawal recorded', 'Utoaji umerekodiwa'));
    }
  }

  protected source(s: string) {
    return SOURCE_LABELS[s];
  }

  protected method(m: string | null): string {
    const a = moneyAccountByMethod(m);
    return this.i18n.isSwahili() ? a.sw : a.en;
  }

  protected day(v: string | null): Date | null {
    return parseLocal(v);
  }

  protected movement(m: CapitalMovement): CapitalMovement {
    return m;
  }
}
