import { ChangeDetectionStrategy, Component, inject, input, model } from '@angular/core';

import { LanguageService } from '@core/i18n/language.service';
import { Icon } from '@shared/ui';
import { MONEY_ACCOUNTS } from './money-accounts';

/**
 * "Where did the money move?" — cash, a bank or a mobile wallet. The choice
 * decides which GL account is debited / credited, so it is always explicit.
 */
@Component({
  selector: 'app-money-account-picker',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="lbl">{{ label() || i18n.t('Paid from', 'Imelipwa kutoka') }}</span>
    <div class="chips" role="radiogroup" [attr.aria-label]="label() || i18n.t('Paid from', 'Imelipwa kutoka')">
      @for (a of accounts; track a.method) {
        <button type="button" role="radio" [attr.aria-checked]="value() === a.method" [class.on]="value() === a.method" (click)="value.set(a.method)">
          <lsms-icon [name]="a.icon" [size]="15" />{{ i18n.isSwahili() ? a.sw : a.en }}
        </button>
      }
    </div>
  `,
  styles: `
    :host { display: block; margin-bottom: 12px; }
    .lbl { display: block; margin-bottom: 6px; font-size: 0.78rem; font-weight: 600; color: var(--c-text-2); }
    .chips { display: flex; flex-wrap: wrap; gap: 6px; }
    button { display: inline-flex; align-items: center; gap: 5px; padding: 6px 11px; border-radius: 100px; border: 1px solid var(--c-border); background: var(--c-surface); font: inherit; font-size: 0.78rem; color: var(--c-text); cursor: pointer; }
    button lsms-icon { color: var(--c-text-2); }
    button.on { border-color: var(--c-primary); color: var(--c-primary); font-weight: 600; background: color-mix(in srgb, var(--c-primary) 10%, var(--c-surface)); }
    button.on lsms-icon { color: var(--c-primary); }
  `,
})
export class MoneyAccountPicker {
  protected readonly i18n = inject(LanguageService);
  protected readonly accounts = MONEY_ACCOUNTS;
  readonly value = model<string>('CASH');
  readonly label = input<string | undefined>(undefined);
}
