import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { MatRipple } from '@angular/material/core';
import { MatTooltip } from '@angular/material/tooltip';
import { NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map } from 'rxjs';

import { AuthService } from '@core/auth/auth.service';
import { LanguageService } from '@core/i18n/language.service';
import {
  ACCOUNT_LINKS,
  APP_MODULES,
  AppModule,
  CATEGORY_LABELS,
  CATEGORY_ORDER,
} from '@core/navigation/app-modules';
import { safeStorage } from '@core/utils/safe-storage';
import { Icon } from '@shared/ui';

interface NavItem {
  id: string;
  route: string;
  icon: string;
  label: string;
  locked: boolean;
  module?: AppModule;
}

interface NavSection {
  key: string;
  label: string;
  icon: string;
  items: NavItem[];
}

const OPEN_KEY = 'sidebar_open_sections';

/**
 * App sidebar — port of Flutter `CustomSidebar` (same sections, same RBAC
 * locks) with v3 refinements: collapsible section groups (remembered),
 * compact 36px rows, collapse control in the footer.
 */
@Component({
  selector: 'app-sidebar',
  imports: [RouterLink, RouterLinkActive, MatTooltip, MatRipple, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.scss',
  host: { '[class.collapsed]': 'collapsed()' },
})
export class Sidebar {
  protected readonly auth = inject(AuthService);
  protected readonly i18n = inject(LanguageService);
  private readonly router = inject(Router);

  readonly collapsed = input(false);
  /** Show the collapse control (desktop only). */
  readonly collapsible = input(true);
  readonly toggleCollapse = output<void>();
  readonly navigate = output<void>();
  readonly denied = output<AppModule>();

  private readonly url = toSignal(
    this.router.events.pipe(
      filter((e) => e instanceof NavigationEnd),
      map(() => this.router.url),
    ),
    { initialValue: this.router.url },
  );

  /** Expanded section keys (all open by default). */
  protected readonly open = signal<Set<string>>(this.readOpen());

  protected readonly home = computed<NavItem>(() => ({
    id: 'dashboard',
    route: '/dashboard',
    icon: 'space_dashboard',
    label: this.i18n.t('Home', 'Nyumbani'),
    locked: false,
  }));

  protected readonly sections = computed<NavSection[]>(() => {
    const lang = this.i18n.lang();
    const nav: NavSection[] = CATEGORY_ORDER.map((cat) => ({
      key: cat,
      label: CATEGORY_LABELS[cat][lang],
      icon: CATEGORY_LABELS[cat].icon,
      items: APP_MODULES.filter((m) => m.category === cat).map((m) => ({
        id: m.id,
        route: m.route,
        icon: m.icon,
        label: m.short[lang],
        locked: !this.auth.canAccessSection(m.id),
        module: m,
      })),
    }));
    nav.push({
      key: 'ACCOUNT',
      label: lang === 'sw' ? 'Akaunti' : 'Account',
      icon: 'person',
      items: ACCOUNT_LINKS.map((a) => ({ id: a.id, route: a.route, icon: a.icon, label: a.title[lang], locked: false })),
    });
    return nav;
  });

  constructor() {
    // Auto-expand the section that contains the current page.
    effect(() => {
      const url = this.url();
      const section = this.sections().find((s) => s.items.some((i) => url.startsWith(i.route)));
      if (section && !this.open().has(section.key)) {
        this.open.update((set) => new Set(set).add(section.key));
      }
    });
    effect(() => safeStorage.set(OPEN_KEY, JSON.stringify([...this.open()])));
  }

  protected isOpen(key: string): boolean {
    return this.collapsed() || this.open().has(key);
  }

  protected toggleSection(key: string): void {
    this.open.update((set) => {
      const next = new Set(set);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  protected activeIn(section: NavSection): boolean {
    const url = this.url();
    return section.items.some((i) => url.startsWith(i.route));
  }

  protected onItemClick(e: MouseEvent, item: NavItem): void {
    if (item.locked) {
      e.preventDefault();
      if (item.module) this.denied.emit(item.module);
      return;
    }
    this.navigate.emit();
  }

  private readOpen(): Set<string> {
    try {
      const raw = safeStorage.get(OPEN_KEY);
      if (raw) return new Set(JSON.parse(raw) as string[]);
    } catch {
      // fall through
    }
    return new Set([...CATEGORY_ORDER, 'ACCOUNT']);
  }
}
