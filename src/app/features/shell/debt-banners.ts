import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { filter, map } from 'rxjs';

import { LanguageService } from '@core/i18n/language.service';
import { NotificationCenter } from '@core/notifications/notification-center.service';
import { AppNotification } from '@core/notifications/notification.models';
import { Icon } from '@shared/ui';
import { parseLocal } from '@shared/utils/date-utils';
import { MoneyPipe } from '@shared/utils/money';
import { CustomerStatementLauncher } from '../customers/open-statement';

const MAX_VISIBLE = 3;

/**
 * "Deni limelipwa" banners — every unread debt collection, on whatever page the
 * user is on, until they close it (a banner that fades is missed by exactly the
 * person who stepped away). Tap = mark read + open the customer's statement.
 * Takes no layout space; mounted once in the shell.
 */
@Component({
  selector: 'app-debt-banners',
  imports: [Icon, MoneyPipe, DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (all().length && !onInbox()) {
      <div class="stack" role="status" aria-live="polite">
        @for (n of visible(); track n.uid) {
          <div class="banner">
            <button type="button" class="body" (click)="open(n)" [title]="i18n.t('Open statement', 'Fungua taarifa ya mteja')">
              <span class="ico"><lsms-icon name="payments" [size]="20" /></span>
              <span class="txt">
                <strong>{{ n.title || i18n.t('Debt collected', 'Deni limelipwa') }}</strong>
                <span>{{ n.message }}</span>
                <small>{{ date(n.createdAt) | date: 'dd MMM, HH:mm' }}@if (n.totalAmount) { · {{ n.totalAmount | money: { decimals: 0 } }} }</small>
              </span>
            </button>
            <button type="button" class="x" (click)="center.dismissBanner(n.uid)" [attr.aria-label]="i18n.t('Close', 'Funga')"><lsms-icon name="close" [size]="18" /></button>
          </div>
        }
        @if (all().length > 1) {
          <div class="foot">
            @if (hidden() > 0) {
              <span>{{ i18n.t('+' + hidden() + ' more', '+' + hidden() + ' zaidi') }}</span>
            }
            <button type="button" (click)="center.dismissAllBanners()">{{ i18n.t('Close all', 'Funga zote') }}</button>
          </div>
        }
      </div>
    }
  `,
  styles: `
    :host { position: fixed; bottom: calc(16px + var(--nav-space)); right: 16px; z-index: 900; width: min(380px, calc(100vw - 32px)); pointer-events: none; }
    .stack { display: flex; flex-direction: column; align-items: stretch; gap: 8px; }
    .banner, .foot { pointer-events: auto; }
    .banner {
      display: flex; align-items: stretch; border-radius: 14px; overflow: hidden;
      background: var(--c-float); border: 1px solid color-mix(in srgb, var(--c-success) 35%, var(--c-border));
      box-shadow: 0 12px 32px rgb(15 23 42 / 0.16), inset 4px 0 0 var(--c-success);
      animation: slide-in 0.22s ease-out;
    }
    .body { flex: 1; display: flex; gap: 10px; align-items: flex-start; min-width: 0; padding: 10px 6px 10px 14px; border: 0; background: transparent; color: var(--c-text); text-align: left; font: inherit; cursor: pointer; }
    .body:hover { background: color-mix(in srgb, var(--c-success) 5%, transparent); }
    .ico { flex: none; display: grid; place-items: center; width: 36px; height: 36px; border-radius: 10px; color: var(--c-success); background: color-mix(in srgb, var(--c-success) 12%, transparent); }
    .txt { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
    .txt strong { font-size: 0.9rem; }
    .txt span { font-size: 0.82rem; color: var(--c-text); overflow-wrap: anywhere; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
    .txt small { font-size: 0.72rem; color: var(--c-text-2); }
    .x { flex: none; width: 40px; border: 0; background: transparent; color: var(--c-text-2); cursor: pointer; display: grid; place-items: center; }
    .x:hover { color: var(--c-text); background: var(--c-surface-2, rgb(0 0 0 / 0.04)); }
    .foot { align-self: flex-end; display: flex; align-items: center; gap: 10px; padding: 4px 6px 4px 12px; border-radius: 10px; background: var(--c-float); border: 1px solid var(--c-border); font-size: 0.78rem; color: var(--c-text-2); box-shadow: 0 6px 16px rgb(15 23 42 / 0.1); }
    .foot button { border: 0; background: transparent; color: var(--c-primary); font: inherit; font-weight: 600; cursor: pointer; padding: 4px 6px; }
    @keyframes slide-in { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
    @media (max-width: 600px) { :host { bottom: calc(8px + var(--nav-space)); right: 12px; width: calc(100vw - 24px); } }
  `,
})
export class DebtBanners {
  protected readonly i18n = inject(LanguageService);
  protected readonly center = inject(NotificationCenter);
  private readonly statement = inject(CustomerStatementLauncher);

  protected readonly all = this.center.debtBanners;
  private readonly router = inject(Router);
  /** The inbox lists the same collections — no banners on top of it. */
  protected readonly onInbox = toSignal(
    this.router.events.pipe(
      filter((e) => e instanceof NavigationEnd),
      map(() => this.router.url.startsWith('/account/notifications')),
    ),
    { initialValue: this.router.url.startsWith('/account/notifications') },
  );
  protected readonly visible = computed(() => this.all().slice(0, MAX_VISIBLE));
  protected readonly hidden = computed(() => Math.max(0, this.all().length - MAX_VISIBLE));

  protected async open(n: AppNotification): Promise<void> {
    this.center.dismissBanner(n.uid);
    void this.center.markRead(n).catch(() => undefined);
    if (n.referenceUid) await this.statement.open(n.referenceUid);
  }

  protected date(v: string | null): Date | null {
    return parseLocal(v);
  }
}
