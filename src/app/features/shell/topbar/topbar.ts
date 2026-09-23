import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { MatBadge } from '@angular/material/badge';
import { MatRipple } from '@angular/material/core';
import { MatDivider } from '@angular/material/divider';
import { MatMenu, MatMenuItem, MatMenuTrigger } from '@angular/material/menu';
import { MatTooltip } from '@angular/material/tooltip';
import { RouterLink } from '@angular/router';

import { initials } from '@core/auth/auth.models';
import { AuthService } from '@core/auth/auth.service';
import { LanguageService } from '@core/i18n/language.service';
import { NotificationCountService } from '@core/notifications/notification-count.service';
import { ThemeService } from '@core/theme/theme.service';
import { Icon } from '@shared/ui';

/**
 * Top app bar — port of Flutter `DashboardToolbar` refined for v3:
 * breadcrumb + title on the left, a wide search trigger in the middle, and a
 * single grouped action cluster (refresh · notifications · theme · language)
 * followed by the user menu.
 */
@Component({
  selector: 'app-topbar',
  imports: [RouterLink, MatMenu, MatMenuItem, MatMenuTrigger, MatDivider, MatTooltip, MatBadge, MatRipple, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './topbar.html',
  styleUrl: './topbar.scss',
})
export class Topbar {
  protected readonly auth = inject(AuthService);
  protected readonly i18n = inject(LanguageService);
  protected readonly theme = inject(ThemeService);
  protected readonly notifications = inject(NotificationCountService);

  readonly title = input('');
  readonly subtitle = input<string | undefined>(undefined);
  /** Hide the "Home ›" crumb on the dashboard itself. */
  readonly isHome = input(false);
  readonly showMenuButton = input(false);

  readonly menu = output<void>();
  readonly search = output<void>();
  readonly refresh = output<void>();
  readonly switchBranch = output<void>();
  readonly logout = output<void>();

  protected readonly initials = computed(() => initials(this.auth.user()));
  protected readonly isMac = /Mac|iPhone|iPad/.test(globalThis.navigator?.platform ?? '');
}
