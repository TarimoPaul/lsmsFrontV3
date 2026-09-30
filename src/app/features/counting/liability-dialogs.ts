import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';

import { ApiError } from '@core/api/api.types';
import { LanguageService } from '@core/i18n/language.service';
import { Button, DialogShell, Icon, MoneyInput } from '@shared/ui';
import { toIsoDate } from '@shared/utils/date-utils';
import { Money, MoneyPipe } from '@shared/utils/money';
import { Liability, LiabilityPaymentType, PAYMENT_TYPES } from './counting.models';
import { CountingService } from './counting.service';

export interface LiabilityDialogData {
  liability: Liability;
  owner: string;
}

const parseMoney = (t: string) => Money.parse(t) ?? 0;

const FORM_STYLES = `
  .who { display: flex; justify-content: space-between; gap: 10px; margin-bottom: 14px; padding: 10px 12px; border-radius: 12px; background: color-mix(in srgb, var(--c-primary) 7%, var(--c-bg)); font-size: 0.84rem; }
  .who b { font-weight: 600; }
  .who em { font-style: normal; font-weight: 700; color: var(--c-primary); }
  label { display: flex; flex-direction: column; gap: 4px; margin-bottom: 12px; font-size: 0.78rem; font-weight: 600; color: var(--c-text-2); }
  label small { font-weight: 400; }
  input, textarea { padding: 9px 10px; border: 1px solid var(--c-border); border-radius: 10px; background: var(--c-input-fill); font: inherit; font-size: 0.88rem; color: var(--c-text); outline: none; }
  input:focus, textarea:focus { border-color: var(--c-primary); }
  .chips { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 12px; }
  .chips button { display: inline-flex; align-items: center; gap: 5px; padding: 7px 12px; border-radius: 100px; border: 1px solid var(--c-border); background: var(--c-surface); font: inherit; font-size: 0.8rem; color: var(--c-text); cursor: pointer; }
  .chips button.on { border-color: var(--c-primary); color: var(--c-primary); font-weight: 600; background: color-mix(in srgb, var(--c-primary) 10%, var(--c-surface)); }
  .bad { color: var(--c-error); font-size: 0.76rem; font-weight: 500; }
  .info { display: flex; align-items: flex-start; gap: 6px; margin: 0 0 12px; padding: 8px 10px; border-radius: 10px; font-size: 0.8rem; color: var(--c-text); background: color-mix(in srgb, var(--c-info) 8%, transparent); }
  .info lsms-icon { color: var(--c-info); flex-shrink: 0; }
  .err { margin: 0; color: var(--c-error); font-size: 0.82rem; }
`;

/** Record a payment against a staff liability (LIABILITY_MANAGE) — Flutter `_handleRecordPayment`. Closes with the updated liability. */
@Component({
  selector: 'app-liability-payment-dialog',
  imports: [DialogShell, Button, Icon, MoneyInput, MoneyPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <lsms-dialog [title]="i18n.t('Record payment', 'Rekodi malipo')" icon="payments">
      <p class="who"><b>{{ data.owner }}</b><span>{{ i18n.t('Balance', 'Deni lililobaki') }}: <em>{{ data.liability.balance | money: { decimals: 0 } }}</em></span></p>
      <label>
        <span>{{ i18n.t('Amount', 'Kiasi') }} (TZS)</span>
        <input lsmsMoneyInput type="text" [value]="amount()" (input)="amount.set($any($event.target).value)" autofocus />
        @if (over()) { <span class="bad">{{ i18n.t('More than the balance', 'Zaidi ya deni lililobaki') }}</span> }
      </label>
      <div class="chips" role="radiogroup" [attr.aria-label]="i18n.t('Payment type', 'Aina ya malipo')">
        @for (t of types; track t.key) {
          <button type="button" role="radio" [attr.aria-checked]="type() === t.key" [class.on]="type() === t.key" (click)="type.set(t.key)"><lsms-icon [name]="t.icon" [size]="16" />{{ i18n.isSwahili() ? t.sw : t.en }}</button>
        }
      </div>
      <label>
        <span>{{ i18n.t('Payment date', 'Tarehe ya malipo') }} <small>({{ i18n.t('empty = now', 'tupu = sasa') }})</small></span>
        <input type="date" [max]="today" [value]="date()" (change)="date.set($any($event.target).value)" />
      </label>
      <label>
        <span>{{ i18n.t('Notes (optional)', 'Maelezo (hiari)') }}</span>
        <textarea rows="2" maxlength="300" [value]="notes()" (input)="notes.set($any($event.target).value)"></textarea>
      </label>
      @if (error()) { <p class="err">{{ error() }}</p> }
      <ng-container dialogActions>
        <button lsmsButton="secondary" (click)="ref.close()">{{ i18n.t('Cancel', 'Ghairi') }}</button>
        <button lsmsButton="primary" [disabled]="!valid()" [loading]="saving()" (click)="save()">{{ i18n.t('Record', 'Rekodi') }}</button>
      </ng-container>
    </lsms-dialog>
  `,
  styles: FORM_STYLES,
})
export class LiabilityPaymentDialog {
  protected readonly data = inject<LiabilityDialogData>(DIALOG_DATA);
  protected readonly ref = inject<DialogRef<Liability>>(DialogRef);
  protected readonly i18n = inject(LanguageService);
  private readonly api = inject(CountingService);

  protected readonly today = toIsoDate(new Date());
  protected readonly types = (Object.keys(PAYMENT_TYPES) as LiabilityPaymentType[]).map((key) => ({ key, ...PAYMENT_TYPES[key] }));
  protected readonly amount = signal('');
  protected readonly type = signal<LiabilityPaymentType>('CASH');
  protected readonly date = signal('');
  protected readonly notes = signal('');
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly over = computed(() => parseMoney(this.amount()) > this.data.liability.balance + 0.001);
  protected readonly valid = computed(() => parseMoney(this.amount()) > 0 && !this.over());

  protected async save(): Promise<void> {
    if (!this.valid()) return;
    this.saving.set(true);
    this.error.set(null);
    try {
      // A past day is stamped at noon (Spring LocalDateTime, no zone); empty/today = server "now".
      const d = this.date();
      const paidAt = d && d !== this.today ? `${d}T12:00:00` : null;
      const updated = await this.api.recordPayment(this.data.liability.uid, {
        amount: parseMoney(this.amount()),
        paymentType: this.type(),
        paidAt,
        notes: this.notes(),
      });
      this.ref.close(updated);
    } catch (e) {
      this.error.set(ApiError.from(e).message);
    } finally {
      this.saving.set(false);
    }
  }
}

/** Monthly payroll deduction plan (LIABILITY_MANAGE) — Flutter `_handleSetDeductionPlan`. Closes with the updated liability. */
@Component({
  selector: 'app-deduction-plan-dialog',
  imports: [DialogShell, Button, Icon, MoneyInput, MoneyPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <lsms-dialog [title]="i18n.t('Deduction plan', 'Mpango wa makato')" icon="event_repeat">
      <p class="who"><b>{{ data.owner }}</b><span>{{ i18n.t('Balance', 'Deni lililobaki') }}: <em>{{ data.liability.balance | money: { decimals: 0 } }}</em></span></p>
      <label>
        <span>{{ i18n.t('Monthly salary', 'Mshahara wa mwezi') }} (TZS)</span>
        <small>{{ i18n.t('Only used to check the deduction limit — not stored on the staff record.', 'Unatumika kuthibitisha kikomo cha makato tu — hauhifadhiwi kwenye rekodi ya mfanyakazi.') }}</small>
        <input lsmsMoneyInput type="text" [value]="salary()" (input)="salary.set($any($event.target).value)" autofocus />
      </label>
      <label>
        <span>{{ i18n.t('Deduction per month', 'Kato la mwezi') }} (TZS)</span>
        <input lsmsMoneyInput type="text" [value]="monthly()" (input)="monthly.set($any($event.target).value)" />
      </label>
      <label>
        <span>{{ i18n.t('First month', 'Mwezi wa kuanza') }}</span>
        <input type="month" [value]="month()" (change)="month.set($any($event.target).value)" />
      </label>
      @if (months(); as m) {
        <p class="info"><lsms-icon name="info" [size]="16" />{{ i18n.t('About ' + m + ' month(s) to clear the balance.', 'Takriban miezi ' + m + ' kumaliza deni.') }}</p>
      }
      <label>
        <span>{{ i18n.t('Reason (optional)', 'Sababu (hiari)') }}</span>
        <textarea rows="2" maxlength="300" [value]="reason()" (input)="reason.set($any($event.target).value)"></textarea>
      </label>
      @if (error()) { <p class="err">{{ error() }}</p> }
      <ng-container dialogActions>
        <button lsmsButton="secondary" (click)="ref.close()">{{ i18n.t('Cancel', 'Ghairi') }}</button>
        <button lsmsButton="primary" [disabled]="!valid()" [loading]="saving()" (click)="save()">{{ i18n.t('Save plan', 'Weka') }}</button>
      </ng-container>
    </lsms-dialog>
  `,
  styles: FORM_STYLES,
})
export class DeductionPlanDialog {
  protected readonly data = inject<LiabilityDialogData>(DIALOG_DATA);
  protected readonly ref = inject<DialogRef<Liability>>(DialogRef);
  protected readonly i18n = inject(LanguageService);
  private readonly api = inject(CountingService);

  private readonly next = (() => {
    const d = new Date();
    const n = new Date(d.getFullYear(), d.getMonth() + 1, 1);
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`;
  })();

  protected readonly salary = signal('');
  protected readonly monthly = signal(this.data.liability.monthlyDeduction ? String(this.data.liability.monthlyDeduction) : '');
  protected readonly month = signal(this.data.liability.deductionStartMonth?.slice(0, 7) ?? this.next);
  protected readonly reason = signal('');
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly valid = computed(() => parseMoney(this.salary()) > 0 && parseMoney(this.monthly()) > 0 && /^\d{4}-\d{2}$/.test(this.month()));
  protected readonly months = computed(() => {
    const m = parseMoney(this.monthly());
    return m > 0 ? Math.ceil(this.data.liability.balance / m) : null;
  });

  protected async save(): Promise<void> {
    if (!this.valid()) return;
    this.saving.set(true);
    this.error.set(null);
    try {
      const updated = await this.api.setDeductionPlan(this.data.liability.uid, {
        monthlyDeduction: parseMoney(this.monthly()),
        startMonth: `${this.month()}-01`,
        salary: parseMoney(this.salary()),
        reason: this.reason(),
      });
      this.ref.close(updated);
    } catch (e) {
      this.error.set(ApiError.from(e).message);
    } finally {
      this.saving.set(false);
    }
  }
}
