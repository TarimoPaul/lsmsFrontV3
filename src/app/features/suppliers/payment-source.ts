import { ChangeDetectionStrategy, Component, computed, inject, input, model } from '@angular/core';

import { LanguageService } from '@core/i18n/language.service';
import { Icon } from '@shared/ui';
import { MoneyUsageService } from '../general-ledger/money-usage.service';
import { PAYMENT_SOURCES, PaymentSource, SOURCE_ACCOUNTS, needsAccount, sourceProblem } from './payment-source.model';

export * from './payment-source.model';

@Component({
  selector: 'app-payment-source-picker',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="lbl">{{ label() || i18n.t('Paid from', 'Chanzo cha malipo') }} <i>*</i></span>
    <div class="chips" role="radiogroup" data-test="chanzo" [attr.aria-label]="label() || i18n.t('Paid from', 'Chanzo cha malipo')">
      @for (s of sources; track s) {
        <button type="button" role="radio" [attr.data-source]="s" [attr.aria-checked]="source() === s" [class.on]="source() === s" (click)="pick(s)">
          <lsms-icon [name]="meta[s].icon" [size]="15" />{{ i18n.isSwahili() ? meta[s].sw : meta[s].en }}
        </button>
      }
    </div>
    @if (accounts().length) {
      <div class="chips sub" role="radiogroup" data-test="akaunti" [attr.aria-label]="i18n.t('Account', 'Akaunti')">
        @for (a of accounts(); track a.code) {
          <button type="button" role="radio" [attr.data-account]="a.code" [attr.aria-checked]="account() === a.code" [class.on]="account() === a.code" (click)="pickAccount(a)">{{ a.name }}</button>
        }
      </div>
    }
    @if (source(); as s) { <p class="hint">{{ i18n.isSwahili() ? meta[s].hint.sw : meta[s].hint.en }}</p> }
    @if (showError() && problem(); as p) { <p class="err" role="alert">{{ p }}</p> }
  `,
  styles: `
    :host { display: block; margin-bottom: 12px; }
    .lbl { display: block; margin-bottom: 6px; font-size: 0.78rem; font-weight: 500; color: var(--c-text-2); }
    .lbl i { color: var(--c-error); font-style: normal; }
    .chips { display: flex; flex-wrap: wrap; gap: 6px; }
    .chips.sub { margin-top: 8px; padding-left: 10px; border-left: 2px solid var(--c-border); }
    button { display: inline-flex; align-items: center; gap: 5px; padding: 6px 11px; border-radius: 100px; border: 1px solid var(--c-border); background: var(--c-surface); font: inherit; font-size: 0.78rem; color: var(--c-text); cursor: pointer; }
    button lsms-icon { color: var(--c-text-2); }
    button.on { border-color: var(--c-primary); color: var(--c-primary); font-weight: 500; background: color-mix(in srgb, var(--c-primary) 10%, var(--c-surface)); }
    button.on lsms-icon { color: var(--c-primary); }
    .hint { margin: 6px 0 0; font-size: 0.74rem; color: var(--c-text-2); }
    .err { margin: 6px 0 0; font-size: 0.76rem; color: var(--c-error); }
  `,
})
export class PaymentSourcePicker {
  protected readonly i18n = inject(LanguageService);
  private readonly usage = inject(MoneyUsageService);
  readonly source = model<PaymentSource | null>(null);
  readonly account = model<string | null>(null);
  readonly label = input<string | undefined>(undefined);
  /** Set after a submit attempt: shows what is missing. */
  readonly showError = input(false);

  protected readonly sources = Object.keys(PAYMENT_SOURCES) as PaymentSource[];
  protected readonly meta = PAYMENT_SOURCES;
  protected readonly accounts = computed(() => {
    const s = this.source();
    // (fj) BENKI / SIMU: most used in the last 30 days first; the owners keep their order
    return !needsAccount(s) ? [] : s === 'MMILIKI' ? SOURCE_ACCOUNTS[s] : this.usage.rank(SOURCE_ACCOUNTS[s], (a) => a.code);
  });
  protected readonly problem = computed(() => sourceProblem(this.source(), this.account(), this.i18n.isSwahili()));

  /** (fj) an account not used for more than 60 days asks first. */
  protected async pickAccount(a: { code: string; name: string }): Promise<void> {
    if (this.account() === a.code || (await this.usage.confirmPick(a.code, a.name))) this.account.set(a.code);
  }

  protected pick(s: PaymentSource): void {
    if (this.source() !== s) this.account.set(null);
    this.source.set(s);
  }
}
