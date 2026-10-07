import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { MatBadge } from '@angular/material/badge';
import { MatRipple } from '@angular/material/core';
import { MatDivider } from '@angular/material/divider';
import { MatMenu, MatMenuItem, MatMenuTrigger } from '@angular/material/menu';
import { MatTooltip } from '@angular/material/tooltip';
import { RouterLink } from '@angular/router';

import { initials } from '@core/auth/auth.models';
import { AuthService } from '@core/auth/auth.service';
import { greeting } from '@core/i18n/greeting';
import { LanguageService } from '@core/i18n/language.service';
import { NotificationCenter } from '@core/notifications/notification-center.service';
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
  host: { '[class.phone]': 'phone()', '[class.on-hero]': 'onHero()' },
})
export class Topbar {
  protected readonly auth = inject(AuthService);
  protected readonly i18n = inject(LanguageService);
  protected readonly theme = inject(ThemeService);
  protected readonly notifications = inject(NotificationCenter);
  /** Avatar URL that failed to load (missing file) — show initials instead of a broken image. */
  protected readonly brokenImg = signal<string | null>(null);

  readonly title = input('');
  readonly subtitle = input<string | undefined>(undefined);
  /** Hide the "Home ›" crumb on the dashboard itself. */
  readonly isHome = input(false);
  readonly showMenuButton = input(false);
  /** Compact phone bar: back arrow instead of the menu, no search (both are in the bottom bar). */
  readonly phone = input(false);

  readonly menu = output<void>();
  readonly back = output<void>();
  readonly search = output<void>();
  readonly refresh = output<void>();
  readonly switchBranch = output<void>();
  readonly logout = output<void>();

  protected readonly initials = computed(() => initials(this.auth.user()));
  /** On the phone dashboard the bar is the top of the hero block (same colour, greeting inside). */
  protected readonly onHero = computed(() => this.phone() && this.isHome());
  protected readonly hello = computed(() => greeting(this.i18n));
  protected readonly firstName = computed(() => this.auth.user()?.firstName || this.auth.displayName());
  protected readonly isMac = /Mac|iPhone|iPad/.test(globalThis.navigator?.platform ?? '');
}
