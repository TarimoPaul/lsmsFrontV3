import { DestroyRef, Injectable, effect, inject, signal } from '@angular/core';

import { BreakpointService } from './breakpoint.service';

export interface PageTitle {
  title: string;
  subtitle?: string;
}

/**
 * Phones have one title per screen: the app bar. A page header (`lsms-page-header`,
 * or a page with its own header such as the POS) hands its title to the bar and
 * hides its own, so "Sales" is not written twice and a sub-page ("New sale")
 * names itself instead of its module.
 */
@Injectable({ providedIn: 'root' })
export class ShellTitle {
  /** True while the app shell (and so an app bar) is on screen. */
  readonly active = signal(false);
  /** Title handed over by the current page (phones only), if any. */
  readonly page = signal<PageTitle | null>(null);
}

/**
 * Call in a page's injection context: on a phone inside the shell, the app bar
 * shows `get()` for as long as the page lives. Returns nothing; pages hide
 * their own title with CSS at the same breakpoint (767px).
 */
export function handPageTitle(get: () => PageTitle): void {
  const shell = inject(ShellTitle);
  const bp = inject(BreakpointService);
  let mine: PageTitle | null = null;
  effect(() => {
    mine = bp.isMobile() && shell.active() ? get() : null;
    shell.page.set(mine);
  });
  // Only clear what this page set: the next page may already have taken over.
  inject(DestroyRef).onDestroy(() => {
    if (mine && shell.page() === mine) shell.page.set(null);
  });
}
