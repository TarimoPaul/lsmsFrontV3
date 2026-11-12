import { DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';

import { ApiError } from '@core/api/api.types';
import { AuthService } from '@core/auth/auth.service';
import { LanguageService } from '@core/i18n/language.service';
import { Button, DialogShell, Icon, MoneyInput } from '@shared/ui';
import { MoneyPipe } from '@shared/utils/money';
import { PaymentSource, PaymentSourcePicker, sourceLabel, sourceProblem } from '../suppliers/payment-source';
import { parse, today } from './capital-dialogs';
import { CapitalService, LiabilityOverview, LiabilityPaymentRow } from './capital.service';

/**
 * Kazi 2 / G6 (toleo 2, owner dt/dx): pay down 2400 (expenses owed) or 2200 (taxes owed). The money leaves a C3
 * source and the DEBT goes down — no new expense is booked. Never more than the balance; a closed period is refused.
 */
@Component({
  selector: 'app-liability-payment-dialog',
  imports: [DialogShell, Button, Icon, MoneyInput, MoneyPipe, PaymentSourcePicker],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <lsms-dialog [title]="i18n.t('Pay an expense debt', 'Lipa deni la gharama')" icon="payments">
      @if (loading()) {
        <p class="muted">{{ i18n.t('Loading…', 'Inapakia…') }}</p>
      } @else {
        <span class="lbl">{{ i18n.t('Which debt?', 'Deni lipi?') }}</span>
        <div class="debts">
          @for (a of data()?.accounts ?? []; track a.code) {
            <button type="button" [class.on]="code() === a.code" [disabled]="a.balance <= 0" (click)="code.set(a.code)">
              <span>{{ a.code }} · {{ a.name }}</span><b>{{ a.balance | money: { decimals: 0 } }}</b>
            </button>
          }
        </div>
        @if (canPay()) {
          <div class="two">
            <label><span>{{ i18n.t('Amount', 'Kiasi') }} (TZS)@if (owed() > 0) { <small>· {{ i18n.t('at most', 'isizidi') }} {{ owed() | money: { decimals: 0 } }}</small> }</span>
              <input lsmsMoneyInput type="text" [value]="amount()" (input)="amount.set($any($event.target).value)" /></label>
            <label><span>{{ i18n.t('Date paid', 'Tarehe ya malipo') }}</span><input type="date" [max]="today" [value]="date()" (change)="date.set($any($event.target).value)" /></label>
          </div>
          <app-payment-source-picker [(source)]="source" [(account)]="account" [showError]="tried()" />
          <label><span>{{ i18n.t('What is being paid', 'Nini kinalipwa') }} <small>({{ i18n.t('at least 10 letters', 'angalau herufi 10') }})</small></span>
            <input type="text" maxlength="300" [value]="desc()" (input)="desc.set($any($event.target).value)" /></label>
          @if (tooMuch()) { <p class="err">{{ i18n.t('More than the debt.', 'Kinazidi deni lililopo.') }}</p> }
          <p class="info"><lsms-icon name="info" [size]="16" />{{ i18n.t('The debt goes down and the money leaves the chosen source. No new expense is recorded.', 'Deni linapungua na pesa inatoka kwenye chanzo ulichochagua. Hakuna gharama mpya inayoandikwa.') }}</p>
        }
        @if (data()?.payments?.length) {
          <span class="lbl">{{ i18n.t('Latest payments', 'Malipo ya karibuni') }}</span>
          @for (p of data()!.payments.slice(0, 10); track p.uid) {
            <div class="pay" [class.off]="p.status === 'REVERSED'">
              <div><strong>{{ p.accountCode }} · {{ p.amount | money: { decimals: 0 } }}</strong>
                <small>{{ p.paymentDate }} · {{ src(p) }} · Cr {{ p.creditAccount }} · {{ p.description }}@if (p.createdBy) { · {{ p.createdBy }} }</small>
                @if (p.status === 'REVERSED') { <small>{{ i18n.t('Reversed', 'Imebatilishwa') }}: {{ p.reverseReason }}</small> }
              </div>
              @if (canPay() && p.status === 'POSTED') {
                @if (reversing() === p.uid) {
                  <span class="inline">
                    <input type="text" maxlength="300" [value]="why()" (input)="why.set($any($event.target).value)" [placeholder]="i18n.t('Reason (at least 10 letters)', 'Sababu (angalau herufi 10)')" />
                    <button lsmsButton="danger" size="sm" [disabled]="why().trim().length < 10" [loading]="busy()" (click)="reverse(p)">{{ i18n.t('Reverse it', 'Ibatilishe') }}</button>
                  </span>
                } @else {
                  <button lsmsButton="text" size="sm" icon="undo" (click)="reversing.set(p.uid); why.set('')">{{ i18n.t('Reverse', 'Batilisha') }}</button>
                }
              }
            </div>
          }
        }
      }
      @if (error()) { <p class="err">{{ error() }}</p> }
      <ng-container dialogActions>
        <button lsmsButton="secondary" (click)="ref.close(changed)">{{ i18n.t('Close', 'Funga') }}</button>
        @if (canPay()) {
          <button lsmsButton="primary" [disabled]="!valid()" [loading]="busy()" (click)="pay()">{{ i18n.t('Pay the debt', 'Lipa deni') }}</button>
        }
      </ng-container>
    </lsms-dialog>
  `,
  styles: `
    label { display: flex; flex-direction: column; gap: 4px; margin: 12px 0 0; font-size: 0.78rem; font-weight: 500; color: var(--c-text-2); }
    label small { font-weight: 400; }
    input { padding: 9px 10px; border: 1px solid var(--c-border); border-radius: 10px; background: var(--c-input-fill); font: inherit; font-size: 0.88rem; color: var(--c-text); }
    .two { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 12px; }
    .lbl { display: block; margin: 12px 0 6px; font-size: 0.78rem; font-weight: 500; color: var(--c-text-2); }
    .muted { color: var(--c-text-2); }
    .debts { display: grid; gap: 6px; }
    .debts button { display: flex; justify-content: space-between; gap: 10px; padding: 10px 12px; border-radius: 12px; border: 1px solid var(--c-border); background: var(--c-surface); font: inherit; font-size: 0.84rem; color: var(--c-text); cursor: pointer; text-align: left; }
    .debts button.on { border-color: var(--c-primary); background: color-mix(in srgb, var(--c-primary) 9%, var(--c-surface)); }
    .debts button:disabled { opacity: 0.55; cursor: default; }
    .info { display: flex; gap: 8px; margin: 12px 0 0; padding: 10px 12px; border-radius: 12px; font-size: 0.8rem; background: color-mix(in srgb, var(--c-info) 8%, transparent); }
    .err { margin: 8px 0 0; font-size: 0.82rem; color: var(--c-error); }
    .pay { display: flex; justify-content: space-between; align-items: center; gap: 8px; padding: 8px 10px; border: 1px solid var(--c-border); border-radius: 10px; margin-bottom: 6px; }
    .pay > div { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
    .pay small { font-size: 0.72rem; color: var(--c-text-2); }
    .pay.off { opacity: 0.6; }
    .inline { display: flex; gap: 6px; align-items: center; }
    @media (max-width: 599px) { .two { grid-template-columns: 1fr; } }
  `,
})
export class LiabilityPaymentDialog {
  protected readonly ref = inject<DialogRef<boolean>>(DialogRef);
  protected readonly i18n = inject(LanguageService);
  private readonly api = inject(CapitalService);
  private readonly auth = inject(AuthService);

  protected readonly today = today();
  protected readonly data = signal<LiabilityOverview | null>(null);
  protected readonly loading = signal(true);
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly tried = signal(false);
  protected readonly code = signal<string | null>(null);
  protected readonly amount = signal('');
  protected readonly date = signal(today());
  protected readonly source = signal<PaymentSource | null>(null);
  protected readonly account = signal<string | null>(null);
  protected readonly desc = signal('');
  protected readonly reversing = signal<string | null>(null);
  protected readonly why = signal('');
  protected changed = false;

  protected readonly canPay = computed(() => this.auth.hasPermission('FINANCE_WRITE'));
  protected readonly owed = computed(() => this.data()?.accounts.find((a) => a.code === this.code())?.balance ?? 0);
  protected readonly tooMuch = computed(() => parse(this.amount()) > this.owed() + 0.004 && !!this.code());
  protected readonly valid = computed(
    () =>
      !!this.code() &&
      parse(this.amount()) > 0 &&
      !this.tooMuch() &&
      !!this.date() &&
      this.desc().trim().length >= 10 &&
      !sourceProblem(this.source(), this.account(), this.i18n.isSwahili()),
  );

  constructor() {
    void this.load();
  }

  private async load(): Promise<void> {
    try {
      this.data.set(await this.api.liabilities());
    } catch (e) {
      this.error.set(ApiError.from(e).message);
    } finally {
      this.loading.set(false);
    }
  }

  protected src(p: LiabilityPaymentRow): string {
    return sourceLabel(p.paymentSource, p.sourceAccount, this.i18n.isSwahili()) ?? p.paymentSource;
  }

  protected async pay(): Promise<void> {
    this.tried.set(true);
    if (!this.valid()) return;
    this.busy.set(true);
    this.error.set(null);
    try {
      await this.api.payLiability({
        accountCode: this.code()!,
        amount: parse(this.amount()),
        paymentDate: this.date(),
        paymentSource: this.source()!,
        sourceAccount: this.account(),
        description: this.desc().trim(),
      });
      this.changed = true;
      this.amount.set('');
      this.desc.set('');
      this.tried.set(false);
      this.data.set(await this.api.liabilities());
    } catch (e) {
      this.error.set(ApiError.from(e).message);
    } finally {
      this.busy.set(false);
    }
  }

  protected async reverse(p: LiabilityPaymentRow): Promise<void> {
    this.busy.set(true);
    this.error.set(null);
    try {
      await this.api.reverseLiabilityPayment(p.uid, this.why().trim());
      this.changed = true;
      this.reversing.set(null);
      this.data.set(await this.api.liabilities());
    } catch (e) {
      this.error.set(ApiError.from(e).message);
    } finally {
      this.busy.set(false);
    }
  }
}
