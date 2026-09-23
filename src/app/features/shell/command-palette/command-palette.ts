import { DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';

import { AuthService } from '@core/auth/auth.service';
import { LanguageService } from '@core/i18n/language.service';
import { ACCOUNT_LINKS, APP_MODULES } from '@core/navigation/app-modules';
import { Icon } from '@shared/ui';

interface Entry {
  id: string;
  route: string;
  icon: string;
  title: string;
  hint: string;
  locked: boolean;
}

/**
 * Ctrl/⌘ + K quick switcher for modules and account pages (Flutter's toolbar
 * search opened a module search too). Arrow keys + Enter; locked modules are
 * listed but disabled.
 */
@Component({
  selector: 'app-command-palette',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="field">
      <lsms-icon name="search" [size]="20" />
      <input
        #q
        autofocus
        [value]="query()"
        [placeholder]="i18n.t('Search modules and pages…', 'Tafuta moduli na kurasa…')"
        (input)="query.set(q.value); index.set(0)"
        (keydown.arrowDown)="move(1, $event)"
        (keydown.arrowUp)="move(-1, $event)"
        (keydown.enter)="open(results()[index()])"
      />
      <kbd>Esc</kbd>
    </div>
    <ul class="results" role="listbox">
      @for (e of results(); track e.id; let i = $index) {
        <li
          role="option"
          [attr.aria-selected]="i === index()"
          [class.active]="i === index()"
          [class.locked]="e.locked"
          (mouseenter)="index.set(i)"
          (click)="open(e)"
        >
          <span class="ic"><lsms-icon [name]="e.icon" [size]="18" /></span>
          <span class="txt"><strong>{{ e.title }}</strong><small>{{ e.hint }}</small></span>
          @if (e.locked) {
            <lsms-icon name="lock" [size]="16" class="lock" />
          } @else {
            <lsms-icon name="keyboard_return" [size]="16" class="ret" />
          }
        </li>
      } @empty {
        <li class="empty">{{ i18n.t('No results', 'Hakuna matokeo') }}</li>
      }
    </ul>
  `,
  styles: `
    :host { display: flex; flex-direction: column; max-height: 70vh; }
    .field { display: flex; align-items: center; gap: 10px; padding: 14px 16px; border-bottom: 1px solid var(--c-divider); color: var(--c-text-2); }
    input { flex: 1; border: 0; outline: 0; background: none; font-size: 1rem; color: var(--c-text); }
    kbd { padding: 2px 6px; border-radius: 6px; border: 1px solid var(--c-border); font: 600 0.68rem var(--font-family); }
    .results { list-style: none; margin: 0; padding: 8px; overflow: auto; }
    li { display: flex; align-items: center; gap: 12px; padding: 10px 12px; border-radius: 10px; cursor: pointer; }
    li.active { background: color-mix(in srgb, var(--c-primary) 10%, transparent); }
    li.locked { opacity: 0.5; cursor: not-allowed; }
    .ic { display: inline-flex; padding: 7px; border-radius: 9px; color: var(--c-primary); background: color-mix(in srgb, var(--c-primary) 10%, transparent); }
    .txt { flex: 1; min-width: 0; display: flex; flex-direction: column; }
    .txt strong { font-size: 0.9rem; }
    .txt small { font-size: 0.74rem; color: var(--c-text-2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .lock, .ret { color: var(--c-text-2); }
    .empty { justify-content: center; color: var(--c-text-2); cursor: default; }
  `,
})
export class CommandPalette {
  protected readonly i18n = inject(LanguageService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly ref = inject(DialogRef);

  protected readonly query = signal('');
  protected readonly index = signal(0);

  private readonly entries = computed<Entry[]>(() => {
    const lang = this.i18n.lang();
    return [
      { id: 'dashboard', route: '/dashboard', icon: 'space_dashboard', title: lang === 'sw' ? 'Nyumbani' : 'Home', hint: lang === 'sw' ? 'Dashibodi kuu' : 'Main dashboard', locked: false },
      ...APP_MODULES.map((m) => ({
        id: m.id,
        route: m.route,
        icon: m.icon,
        title: m.title[lang],
        hint: m.description[lang],
        locked: !this.auth.canAccessSection(m.id),
      })),
      ...ACCOUNT_LINKS.map((a) => ({ id: a.id, route: a.route, icon: a.icon, title: a.title[lang], hint: lang === 'sw' ? 'Akaunti' : 'Account', locked: false })),
    ];
  });

  protected readonly results = computed(() => {
    const q = this.query().trim().toLowerCase();
    // Rank: title prefix > title contains > id contains > description contains.
    const score = (e: Entry) => {
      const t = e.title.toLowerCase();
      if (!q) return 1;
      if (t.startsWith(q)) return 4;
      if (t.includes(q)) return 3;
      if (e.id.includes(q)) return 2;
      return e.hint.toLowerCase().includes(q) ? 1 : 0;
    };
    return this.entries()
      .map((e) => ({ e, s: score(e) }))
      .filter((x) => x.s > 0)
      // Accessible first, then by relevance.
      .sort((a, b) => Number(a.e.locked) - Number(b.e.locked) || b.s - a.s)
      .map((x) => x.e);
  });

  protected move(delta: number, e: Event): void {
    e.preventDefault();
    const n = this.results().length;
    if (n) this.index.update((i) => (i + delta + n) % n);
  }

  protected open(e: Entry | undefined): void {
    if (!e || e.locked) return;
    this.ref.close();
    void this.router.navigateByUrl(e.route);
  }
}
