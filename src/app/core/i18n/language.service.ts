import { DOCUMENT } from '@angular/common';
import { Injectable, computed, effect, inject, signal } from '@angular/core';

import { safeStorage } from '../utils/safe-storage';

export type AppLanguage = 'en' | 'sw';

/**
 * Current UI language — port of Flutter `LanguageProvider`.
 * Default English, persisted under the same `app_language` key.
 *
 * Shared UI components read `lang()` for their few built-in labels. The full
 * app-wide translation catalogue (appLocalizations.dart) is wired in later.
 */
@Injectable({ providedIn: 'root' })
export class LanguageService {
  private readonly doc = inject(DOCUMENT);

  readonly lang = signal<AppLanguage>(safeStorage.get('app_language') === 'sw' ? 'sw' : 'en');
  readonly isSwahili = computed(() => this.lang() === 'sw');
  readonly currentLanguageName = computed(() => (this.isSwahili() ? 'Kiswahili' : 'English'));

  constructor() {
    effect(() => {
      const lang = this.lang();
      safeStorage.set('app_language', lang);
      this.doc.documentElement.lang = lang;
    });
  }

  setLanguage(lang: AppLanguage): void {
    this.lang.set(lang);
  }

  toggleLanguage(): void {
    this.lang.update((l) => (l === 'en' ? 'sw' : 'en'));
  }

  /** Pick the string for the active language. */
  t(en: string, sw: string): string {
    return this.isSwahili() ? sw : en;
  }
}
