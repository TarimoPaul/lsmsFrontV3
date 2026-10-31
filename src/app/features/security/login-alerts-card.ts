import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { LanguageService } from '@core/i18n/language.service';
import { Icon } from '@shared/ui';
import { LoginAuditService } from './login-audit.service';

/**
 * Dashboard card (design MUUNDO-LOGIN-AUDIT.md §6): "N logins need a look" — root logins, new devices,
 * VPN / datacenter / not-via-Cloudflare, 5+ failures — for LOGIN_AUDIT_VIEW holders. Hidden when nothing is open.
 */
@Component({
  selector: 'app-login-alerts-card',
  imports: [Icon, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (open() > 0) {
      <a class="card" routerLink="/security/logins" [queryParams]="{ tab: 'alerts' }">
        <lsms-icon name="shield_person" [size]="22" />
        <span class="txt">
          <strong>{{ i18n.t(open() + ' login(s) need a look', 'Login ' + open() + ' zinahitaji kuangaliwa') }}</strong>
          <small>{{ i18n.t('Root logins, new devices, VPN or repeated failures', 'Login za root, vifaa vipya, VPN au makosa ya kurudia') }}</small>
        </span>
        <lsms-icon name="chevron_right" [size]="20" />
      </a>
    }
  `,
  styles: `
    :host { display: block; }
    .card {
      display: flex; align-items: center; gap: 12px; padding: 12px 14px; border-radius: 14px; text-decoration: none; color: var(--c-text);
      background: color-mix(in srgb, var(--c-error) 7%, var(--c-surface)); border: 1px solid color-mix(in srgb, var(--c-error) 35%, var(--c-border));
    }
    .card > lsms-icon:first-child { color: var(--c-error); }
    .txt { flex: 1; display: flex; flex-direction: column; gap: 2px; }
    .txt strong { font-size: 0.9rem; }
    .txt small { font-size: 0.76rem; color: var(--c-text-2); }
  `,
})
export class LoginAlertsCard {
  protected readonly i18n = inject(LanguageService);
  private readonly svc = inject(LoginAuditService);
  protected readonly open = signal(0);

  constructor() {
    if (this.svc.canView) {
      this.svc.alerts(1).then((a) => this.open.set(a.open)).catch(() => undefined);
    }
  }
}
