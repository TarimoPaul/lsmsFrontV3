import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';

import { ApiError } from '@core/api/api.types';
import { LanguageService } from '@core/i18n/language.service';
import { DialogService, EmptyState, Icon, MetricCard, MetricsGrid, Skeleton, ToastService } from '@shared/ui';
import { parseLocal } from '@shared/utils/date-utils';
import { Money, MoneyPipe } from '@shared/utils/money';
import { DashboardAlertsService } from '../dashboard/dashboard-alerts.service';
import { ReasonDialog, ReasonDialogData } from '../reconciliation/reason-dialog';
import { Liability, LiabilityItem, isPendingItem, liabilityDay } from './counting.models';
import { CountingService } from './counting.service';
import { LiabilityCard } from './liability-card';

/**
 * "My debts" — port of Flutter `MadeniYanguScreen` (LIABILITY_READ_OWN): the
 * caller's own shortage debts grouped by day (newest open), each item
 * accepted ("Nakubali", with the server's exact consent sentence) or disputed
 * with a reason.
 */
@Component({
  selector: 'app-my-liabilities-tab',
  imports: [LiabilityCard, MetricCard, MetricsGrid, EmptyState, Skeleton, Icon, DatePipe, MoneyPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (loading() && !rows().length) {
      <lsms-skeleton variant="list" [rows]="4" />
    } @else if (error() && !rows().length) {
      <lsms-empty-state icon="error" iconColor="var(--c-error)" [title]="i18n.t('Could not load your debts', 'Imeshindwa kupata madeni yako')" [message]="error()!" [secondaryActionLabel]="i18n.t('Retry', 'Jaribu tena')" (secondaryAction)="load()" />
    } @else if (!rows().length) {
      <lsms-empty-state icon="verified" iconColor="var(--c-success)" [title]="i18n.t('No debts', 'Huna madeni')" [message]="i18n.t('No shortage debt has been recorded against you.', 'Hakuna deni la uhaba lililowekwa kwako kwa sasa.')" />
    } @else {
      <lsms-metrics-grid [gap]="12">
        <lsms-metric-card [title]="i18n.t('Balance owed', 'Deni lililobaki')" [value]="stats().balance | money: { decimals: 0 }" icon="account_balance_wallet" color="var(--c-warning)" [urgent]="stats().balance > 0" [subtitle]="i18n.t('of ' + total(), 'kati ya ' + total())" />
        <lsms-metric-card [title]="i18n.t('Awaiting your decision', 'Zinasubiri uamuzi wako')" [value]="stats().pending + ''" icon="pending_actions" color="var(--c-primary)" [urgent]="stats().pending > 0" />
        <lsms-metric-card [title]="i18n.t('Disputed', 'Ulizopinga')" [value]="stats().disputed + ''" icon="report" color="var(--c-error)" />
        <lsms-metric-card [title]="i18n.t('Paid so far', 'Umelipa')" [value]="stats().paid | money: { decimals: 0 }" icon="check_circle" color="var(--c-success)" />
      </lsms-metrics-grid>

      @for (g of groups(); track g.day; let first = $first) {
        <section class="day">
          <button type="button" class="d-head" (click)="toggle(g.day)" [attr.aria-expanded]="isOpen(g.day, first)">
            <lsms-icon name="calendar_today" [size]="17" />
            <b>{{ day(g.day) | date: 'EEEE, dd MMM yyyy' }}</b>
            <small>{{ g.items.length === 1 ? i18n.t('1 debt', 'Deni 1') : i18n.t(g.items.length + ' debts', 'Madeni ' + g.items.length) }}</small>
            <em [class.red]="g.disputed">{{ g.balance | money: { decimals: 0 } }}</em>
            <lsms-icon [name]="isOpen(g.day, first) ? 'expand_less' : 'expand_more'" [size]="20" />
          </button>
          @if (isOpen(g.day, first)) {
            @for (l of g.items; track l.uid) {
              <app-liability-card [liability]="l" mode="mine" [expanded]="true" [busy]="busy()" (accept)="accept($event)" (dispute)="dispute($event)" />
            }
          }
        </section>
      }
    }
  `,
  styles: `
    :host { display: flex; flex-direction: column; gap: 14px; }
    .day { display: flex; flex-direction: column; gap: 10px; }
    .d-head { display: flex; align-items: center; gap: 10px; padding: 12px 14px; border-radius: 14px; border: 1px solid var(--c-border); background: var(--c-surface); font: inherit; text-align: left; color: var(--c-text); cursor: pointer; }
    .d-head lsms-icon:first-child { color: var(--c-primary); }
    .d-head b { font-size: 0.92rem; font-weight: 600; }
    .d-head small { flex: 1; font-size: 0.76rem; color: var(--c-text-2); }
    .d-head em { font-style: normal; font-weight: 700; color: var(--c-primary); }
    .d-head em.red { color: var(--c-error); }
    .d-head em { white-space: nowrap; }
    @media (max-width: 480px) { .d-head small { display: none; } .d-head b { flex: 1; } }
  `,
})
export class MyLiabilitiesTab {
  protected readonly i18n = inject(LanguageService);
  private readonly api = inject(CountingService);
  private readonly dialogs = inject(DialogService);
  private readonly toast = inject(ToastService);
  private readonly alerts = inject(DashboardAlertsService);

  protected readonly rows = signal<Liability[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly busy = signal<string | null>(null);
  /** Days the user toggled away from their default (newest open, others closed). */
  private readonly flipped = signal<ReadonlySet<string>>(new Set());

  protected readonly stats = computed(() => {
    const items = this.rows().flatMap((l) => l.items);
    const balance = this.rows().reduce((s, l) => s + l.balance, 0);
    const amount = this.rows().reduce((s, l) => s + l.amount, 0);
    return {
      balance,
      amount,
      paid: amount - balance,
      pending: items.filter(isPendingItem).length,
      disputed: items.filter((i) => i.disputed && !i.acknowledgedAt).length,
    };
  });
  protected readonly total = computed(() => Money.format(this.stats().amount, { decimals: 0 }));

  protected readonly groups = computed(() => {
    const map = new Map<string, Liability[]>();
    for (const l of this.rows()) {
      const k = liabilityDay(l);
      map.set(k, [...(map.get(k) ?? []), l]);
    }
    return [...map.entries()]
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([day, items]) => ({
        day,
        items: items.sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? '')),
        balance: items.reduce((s, l) => s + l.balance, 0),
        disputed: items.some((l) => l.items.some((i) => i.disputed)),
      }));
  });

  constructor() {
    void this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      this.rows.set(await this.api.myLiabilities());
    } catch (e) {
      this.error.set(ApiError.from(e).message);
    } finally {
      this.loading.set(false);
    }
  }

  protected isOpen(day: string, first: boolean): boolean {
    return first !== this.flipped().has(day);
  }

  protected toggle(day: string): void {
    this.flipped.update((s) => {
      const n = new Set(s);
      if (n.has(day)) n.delete(day);
      else n.add(day);
      return n;
    });
  }

  protected async accept(item: LiabilityItem): Promise<void> {
    // The backend computes the exact consent sentence it will record — shown as-is.
    const consent = item.consentText ?? this.i18n.t('I agree this debt is correct.', 'Nakubali kuwa deni hili ni sahihi.');
    const ok = await this.dialogs.confirm({
      title: this.i18n.t('Accept debt', 'Kubali deni'),
      message: `${item.productName} — ${Money.format(item.lineAmount, { decimals: 0 })}\n\n${consent}`,
      confirmText: this.i18n.t('I accept', 'Nakubali'),
      cancelText: this.i18n.t('Cancel', 'Ghairi'),
    });
    if (!ok) return;
    this.busy.set(item.uid);
    try {
      const { item: updated } = await this.api.acknowledge(item.uid);
      this.patch(updated);
      this.toast.success(this.i18n.t('You accepted this debt.', 'Umekubali deni hili.'));
    } catch (e) {
      this.toast.error(ApiError.from(e).message || this.i18n.t('Could not accept', 'Imeshindwa kukubali deni'));
    } finally {
      this.busy.set(null);
    }
  }

  protected async dispute(item: LiabilityItem): Promise<void> {
    const reason = await this.dialogs.openAsync<string, ReasonDialogData>(ReasonDialog, {
      size: 'sm',
      data: {
        title: this.i18n.t('Dispute debt', 'Pinga deni'),
        message: `${item.productName} — ${Money.format(item.lineAmount, { decimals: 0 })}`,
        label: this.i18n.t('Why do you dispute it? (at least 10 characters)', 'Eleza kwa nini unapinga deni hili (angalau herufi 10)'),
        confirm: this.i18n.t('Dispute', 'Pinga'),
        danger: true,
        min: 10,
      },
    });
    if (!reason) return;
    this.busy.set(item.uid);
    try {
      this.patch(await this.api.dispute(item.uid, reason));
      this.toast.success(this.i18n.t('You disputed this item.', 'Umepinga kipengele hiki cha deni.'));
    } catch (e) {
      this.toast.error(ApiError.from(e).message || this.i18n.t('Could not dispute', 'Imeshindwa kupinga deni'));
    } finally {
      this.busy.set(null);
    }
  }

  private patch(item: LiabilityItem): void {
    this.rows.update((list) => list.map((l) => (l.items.some((i) => i.uid === item.uid) ? { ...l, items: l.items.map((i) => (i.uid === item.uid ? item : i)) } : l)));
    // Keep the dashboard nudge in step without another request.
    const pending = this.rows().flatMap((l) => l.items).filter(isPendingItem).length;
    this.alerts.liabilities.update((a) => (a ? { ...a, count: pending } : a));
  }

  protected day(v: string): Date | null {
    return parseLocal(v);
  }
}
