import { ChangeDetectionStrategy, Component, computed, inject, output } from '@angular/core';
import { MatRipple } from '@angular/material/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

import { AuthService } from '@core/auth/auth.service';
import { LanguageService } from '@core/i18n/language.service';
import { findModule } from '@core/navigation/app-modules';
import { Icon } from '@shared/ui';

interface NavItem {
  key: string;
  icon: string;
  label: string;
  /** Missing for the two actions (search, menu). */
  route?: string;
}

/** Modules offered as thumb shortcuts, most used first; the first two the user may open are shown. */
const SHORTCUTS: { id: string; icon: string }[] = [
  { id: 'sales', icon: 'point_of_sale' },
  { id: 'products', icon: 'inventory_2' },
  { id: 'customers', icon: 'group' },
  { id: 'purchases', icon: 'shopping_cart' },
  { id: 'store-management', icon: 'warehouse' },
  { id: 'reports', icon: 'analytics' },
];

/**
 * Floating bottom bar — the main navigation on phones and tablets, where the
 * sidebar is a drawer: Home · shortcut · Search · shortcut · Menu, all within
 * thumb reach. Only the current page shows its label, so five targets stay
 * wide on a 320px screen. "Menu" opens the full sidebar (with its RBAC locks).
 * On a phone held sideways it becomes a rail on the left (see --nav-rail).
 */
@Component({
  selector: 'app-bottom-nav',
  imports: [RouterLink, RouterLinkActive, MatRipple, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <nav class="bar" [attr.aria-label]="i18n.t('Quick navigation', 'Menyu ya haraka')">
      @for (it of items(); track it.key) {
        @if (it.route) {
          <a class="it" matRipple [routerLink]="it.route" routerLinkActive="on" #rla="routerLinkActive" [attr.aria-label]="it.label" [attr.aria-current]="rla.isActive ? 'page' : null">
            <lsms-icon [name]="it.icon" [size]="22" [filled]="rla.isActive" />
            <span class="lbl">{{ it.label }}</span>
          </a>
        } @else {
          <button type="button" class="it" matRipple [attr.aria-label]="it.label" (click)="it.key === 'search' ? search.emit() : menu.emit()">
            <lsms-icon [name]="it.icon" [size]="22" />
          </button>
        }
      }
    </nav>
  `,
  styles: `
    :host {
      position: absolute; z-index: 15; left: 0; right: 0; bottom: 0;
      display: flex; justify-content: center;
      padding: 0 calc(12px + var(--safe-r)) max(12px, var(--safe-b)) calc(12px + var(--safe-l));
      pointer-events: none;
    }
    .bar {
      pointer-events: auto;
      display: flex; align-items: center; justify-content: space-between; gap: 4px;
      width: 100%; max-width: 440px; height: 60px; padding: 0 8px;
      border-radius: 30px;
      background: var(--c-sidebar-bg), var(--c-sidebar);
      box-shadow: 0 12px 28px -8px rgb(20 40 58 / 0.55), 0 2px 6px rgb(20 40 58 / 0.18), inset 0 1px 0 rgb(255 255 255 / 0.1);
    }
    :host-context([data-theme='dark']) .bar {
      background: rgb(22 29 37 / 0.82);
      border: 1px solid rgb(255 255 255 / 0.11);
      backdrop-filter: blur(18px) saturate(1.3);
      box-shadow: 0 14px 32px rgb(0 0 0 / 0.5), inset 0 1px 0 rgb(255 255 255 / 0.07);
    }
    .it {
      position: relative; overflow: hidden; flex: 0 1 auto;
      display: inline-flex; align-items: center; justify-content: center;
      min-width: 48px; height: 44px; padding: 0 13px;
      border: 0; border-radius: 22px; background: transparent;
      color: rgb(255 255 255 / 0.74); text-decoration: none; cursor: pointer;
      -webkit-tap-highlight-color: transparent;
      transition: background-color 0.22s ease, color 0.22s ease;
    }
    .it:active { background: rgb(255 255 255 / 0.1); }
    .lbl {
      max-width: 0; opacity: 0; overflow: hidden; white-space: nowrap;
      font-size: 0.8rem; font-weight: 700; letter-spacing: 0.1px;
      transition: max-width 0.28s cubic-bezier(0.2, 0.7, 0.2, 1), opacity 0.2s ease, margin-left 0.28s ease;
    }
    .it.on { background: rgb(255 255 255 / 0.15); color: #fff; }
    .it.on lsms-icon { color: var(--c-sidebar-accent); }
    .it.on .lbl { max-width: 110px; opacity: 1; margin-left: 8px; }
    .it:focus-visible { outline: 2px solid var(--c-sidebar-accent); outline-offset: -2px; }
    /* 320–359px phones: slimmer targets (still 44px) so the current label fits. */
    @media (max-width: 359px) {
      .bar { padding: 0 6px; gap: 0; }
      .it { min-width: 44px; padding: 0 10px; }
      .it.on .lbl { margin-left: 6px; }
    }
    /* Phone held sideways: a slim rail on the left instead of a bar that eats the short height. */
    @media (orientation: landscape) and (max-height: 520px) {
      :host {
        top: var(--topbar-h); right: auto; bottom: 0; width: var(--nav-rail);
        align-items: center; padding: 6px 0 max(6px, var(--safe-b)) var(--safe-l);
      }
      .bar { flex-direction: column; justify-content: center; width: 48px; height: auto; max-height: 100%; padding: 6px 0; gap: 2px; border-radius: 24px; }
      .it { width: 40px; min-width: 0; height: 40px; padding: 0; border-radius: 50%; }
      .lbl { display: none; }
    }
    @media (prefers-reduced-motion: reduce) { .it, .lbl { transition: none; } }
  `,
})
export class BottomNav {
  protected readonly i18n = inject(LanguageService);
  private readonly auth = inject(AuthService);

  readonly search = output<void>();
  readonly menu = output<void>();

  /** Home · shortcut · Search · shortcut · Menu. */
  protected readonly items = computed<NavItem[]>(() => {
    const lang = this.i18n.lang();
    const shortcuts: NavItem[] = [];
    for (const s of SHORTCUTS) {
      const m = findModule(s.id);
      if (m && this.auth.canAccessSection(m.id)) shortcuts.push({ key: m.id, route: m.route, icon: s.icon, label: m.short[lang] });
      if (shortcuts.length === 2) break;
    }
    return [
      { key: 'home', route: '/dashboard', icon: 'home', label: this.i18n.t('Home', 'Nyumbani') },
      ...shortcuts.slice(0, 1),
      { key: 'search', icon: 'search', label: this.i18n.t('Search', 'Tafuta') },
      ...shortcuts.slice(1),
      { key: 'menu', icon: 'apps', label: this.i18n.t('All modules', 'Moduli zote') },
    ];
  });
}
