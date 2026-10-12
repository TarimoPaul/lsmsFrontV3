import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';

import { LanguageService } from '@core/i18n/language.service';
import { Button, Icon } from '@shared/ui';
import { MoneyPipe } from '@shared/utils/money';
import { SafeBoxReminder } from '../reconciliation/safe-box-reminder.service';

/**
 * "Safe box money still to bring" strip under the top bar, on every page, after every
 * login until the money is in: the cashier sees what they still owe from approved days,
 * a manager sees deposits waiting and what cashiers still hold. "Close" hides it until
 * the next login only.
 */
@Component({
  selector: 'app-safe-box-banner',
  imports: [Button, Icon, MoneyPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (show()) {
      <div class="bar" role="status">
        <lsms-icon name="lock" [size]="20" />
        <span class="txt">
          @if (r.myUnsubmitted() > 0.01) {
            <strong>{{ i18n.t('Safe box: you still owe ', 'Sefu: bado unadaiwa ') }}{{ r.myUnsubmitted() | money }}</strong>
            <small>{{ i18n.t('Left in the safe on ' + myDays() + ' approved day(s). Submit it when you bring it.', 'Imebaki sefu kwenye siku ' + myDays() + ' zilizoidhinishwa. Iwasilishe unapoileta.') }}</small>
          }
          @if (r.toConfirm().length) {
            <strong>{{ i18n.t(r.toConfirm().length + ' safe box deposit(s) waiting for you: ', 'Deposit ' + r.toConfirm().length + ' za sefu zinakusubiri: ') }}{{ r.toConfirmTotal() | money }}</strong>
          }
          @if (r.owedUnsubmitted() > 0.01) {
            <small>{{ i18n.t('Cashiers still hold ', 'Cashiers bado wanadaiwa ') }}<b>{{ r.owedUnsubmitted() | money }}</b>{{ i18n.t(' of safe box money from approved days.', ' ya sefu kutoka siku zilizoidhinishwa.') }}</small>
          }
        </span>
        <button lsmsButton="secondary" size="sm" icon="arrow_forward" (click)="open()">{{ i18n.t('Open safe box', 'Fungua sefu') }}</button>
        <button type="button" class="x" (click)="r.dismissed.set(true)" [attr.aria-label]="i18n.t('Close', 'Funga')"><lsms-icon name="close" [size]="18" /></button>
      </div>
    }
  `,
  styles: `
    :host { display: block; flex: none; }
    .bar {
      display: flex; align-items: center; gap: 12px; margin: 8px 16px 0; padding: 10px 8px 10px 14px; border-radius: 14px;
      color: var(--c-text); background: color-mix(in srgb, var(--c-error) 8%, var(--c-surface));
      border: 1px solid color-mix(in srgb, var(--c-error) 40%, var(--c-border)); box-shadow: inset 4px 0 0 var(--c-error);
    }
    .bar > lsms-icon { flex: none; color: var(--c-error); }
    .txt { flex: 1; display: flex; flex-direction: column; gap: 2px; min-width: 0; }
    .txt strong { font-size: 0.88rem; color: var(--c-error); }
    .txt small { font-size: 0.76rem; color: var(--c-text-2); }
    .txt small b { color: var(--c-error); }
    .x { flex: none; display: grid; place-items: center; width: 34px; height: 34px; border: 0; border-radius: 10px; background: transparent; color: var(--c-text-2); cursor: pointer; }
    .x:hover { color: var(--c-text); background: var(--c-hover); }
    @media (max-width: 600px) { .bar { flex-wrap: wrap; margin: 8px 12px 0; } .txt { flex-basis: calc(100% - 80px); } }
  `,
})
export class SafeBoxBanner {
  protected readonly i18n = inject(LanguageService);
  protected readonly r = inject(SafeBoxReminder);
  private readonly router = inject(Router);

  protected readonly myDays = computed(() => new Set(this.r.mine().filter((e) => e.unsubmitted > 0.01).map((e) => e.date)).size);
  protected readonly show = computed(
    () => !this.r.dismissed() && (this.r.myUnsubmitted() > 0.01 || this.r.toConfirm().length > 0 || this.r.owedUnsubmitted() > 0.01),
  );

  constructor() {
    this.r.start();
  }

  protected open(): void {
    void this.router.navigate(['/reconciliation'], { queryParams: { tab: 'safebox' } });
  }
}
