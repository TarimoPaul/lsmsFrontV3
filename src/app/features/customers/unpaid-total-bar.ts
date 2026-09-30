import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';

import { LanguageService } from '@core/i18n/language.service';
import { Icon } from '@shared/ui';
import { MoneyPipe } from '@shared/utils/money';

/**
 * "Jumla ya madeni" pinned above an owing-customers list — port of Flutter
 * `_UnpaidTotalBar`. Always the sum of the rows beneath it (same filter and
 * search), so it moves with every payment, write-off and new credit sale.
 */
@Component({
  selector: 'app-unpaid-total-bar',
  imports: [Icon, MoneyPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <lsms-icon name="account_balance_wallet" [size]="26" [filled]="true" />
    <span class="main">
      <small>{{ i18n.t('Total debts owed', 'Jumla ya madeni') }}</small>
      <b>{{ loading() ? '—' : (total() | money) }}</b>
      @if (search()) {
        <small class="q">{{ i18n.t('For search "' + search() + '"', 'Kwa utafutaji "' + search() + '"') }}</small>
      }
    </span>
    @if (!loading()) {
      <span class="n"><b>{{ count() }}</b><small>{{ i18n.t('Owing', 'Wanaodaiwa') }}</small></span>
    }
  `,
  styles: `
    :host { display: flex; align-items: center; gap: 12px; padding: 12px 16px; border-radius: 14px; color: var(--c-error); background: color-mix(in srgb, var(--c-error) 8%, var(--c-surface)); border: 1px solid color-mix(in srgb, var(--c-error) 35%, var(--c-border)); }
    span { display: flex; flex-direction: column; min-width: 0; }
    .main { flex: 1; }
    small { font-size: 0.74rem; color: var(--c-text-2); }
    .q { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    b { font-size: 1.2rem; font-weight: 800; font-variant-numeric: tabular-nums; }
    .n { align-items: flex-end; }
    .n b { color: var(--c-text); }
  `,
})
export class UnpaidTotalBar {
  protected readonly i18n = inject(LanguageService);
  readonly total = input.required<number>();
  readonly count = input.required<number>();
  readonly search = input('');
  readonly loading = input(false);
}
