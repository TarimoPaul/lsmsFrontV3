import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { LanguageService } from '@core/i18n/language.service';
import { EmptyState } from '@shared/ui';

/** Notifications inbox — ported together with the notifications module. */
@Component({
  selector: 'app-notifications-page',
  imports: [EmptyState],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <lsms-empty-state
      icon="notifications"
      [title]="i18n.t('No notifications yet', 'Hakuna arifa bado')"
      [message]="i18n.t('Alerts about sales, stock and approvals will appear here.', 'Arifa kuhusu mauzo, hisa na idhini zitaonekana hapa.')"
    />
  `,
  styles: `:host { display: block; padding: 48px 16px; }`,
})
export class NotificationsPage {
  protected readonly i18n = inject(LanguageService);
}
