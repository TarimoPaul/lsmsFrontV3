import { DOCUMENT } from '@angular/common';
import { Injectable, computed, effect, inject, signal } from '@angular/core';

import { safeStorage } from '../utils/safe-storage';

/**
 * Theme state — port of Flutter `ThemeProvider`.
 *
 * Applies the palette by setting attributes on <html> that `_tokens.scss`
 * keys off: `data-theme="light|dark"` and `data-comfort="on"`.
 * Preferences persist in localStorage under the same keys Flutter used.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly doc = inject(DOCUMENT);
  private readonly systemDark = this.doc.defaultView?.matchMedia?.('(prefers-color-scheme: dark)');

  /** Explicit user choice (ignored while following system / auto-night). */
  private readonly manualDark = signal(safeStorage.getBool('app_theme_mode') ?? false);
  readonly followSystemTheme = signal(safeStorage.getBool('follow_system_theme') ?? true);
  /** Warm-cream light variant; Flutter default is ON. */
  readonly eyeComfortMode = signal(safeStorage.getBool('eye_comfort_mode') ?? true);
  /** Dark between 18:00 and 06:00. */
  readonly autoNightMode = signal(safeStorage.getBool('auto_night_mode') ?? false);
  readonly textSizeMultiplier = signal(safeStorage.getNumber('text_size_multiplier') ?? 1);
  /** Soft drifting bubbles behind the main dashboard (as in Flutter main_menu). Module pages never show them. */
  readonly ambientMotion = signal(safeStorage.getBool('ambient_motion') ?? true);

  private readonly systemPrefersDark = signal(this.systemDark?.matches ?? false);

  readonly isDarkMode = computed(() => {
    if (this.autoNightMode()) {
      const hour = new Date().getHours();
      return hour >= 18 || hour <= 6;
    }
    if (this.followSystemTheme()) return this.systemPrefersDark();
    return this.manualDark();
  });

  constructor() {
    this.systemDark?.addEventListener('change', (e) => this.systemPrefersDark.set(e.matches));

    effect(() => {
      const root = this.doc.documentElement;
      root.setAttribute('data-theme', this.isDarkMode() ? 'dark' : 'light');
      if (this.eyeComfortMode()) root.setAttribute('data-comfort', 'on');
      else root.removeAttribute('data-comfort');
      root.style.setProperty('--text-scale', String(this.textSizeMultiplier()));
    });

    effect(() => {
      safeStorage.set('app_theme_mode', this.manualDark());
      safeStorage.set('follow_system_theme', this.followSystemTheme());
      safeStorage.set('eye_comfort_mode', this.eyeComfortMode());
      safeStorage.set('auto_night_mode', this.autoNightMode());
      safeStorage.set('text_size_multiplier', this.textSizeMultiplier());
      safeStorage.set('ambient_motion', this.ambientMotion());
    });
  }

  toggleTheme(): void {
    this.setTheme(!this.isDarkMode());
  }

  setTheme(isDark: boolean): void {
    this.followSystemTheme.set(false);
    this.autoNightMode.set(false);
    this.manualDark.set(isDark);
  }

  toggleFollowSystemTheme(): void {
    const next = !this.followSystemTheme();
    this.followSystemTheme.set(next);
    if (next) this.autoNightMode.set(false);
  }

  toggleEyeComfortMode(): void {
    this.eyeComfortMode.update((v) => !v);
  }

  toggleAmbientMotion(): void {
    this.ambientMotion.update((v) => !v);
  }

  toggleAutoNightMode(): void {
    const next = !this.autoNightMode();
    this.autoNightMode.set(next);
    if (next) this.followSystemTheme.set(false);
  }

  setTextSize(multiplier: number): void {
    if (multiplier >= 0.8 && multiplier <= 1.5) {
      this.textSizeMultiplier.set(Math.round(multiplier * 10) / 10);
    }
  }

  increaseTextSize(): void {
    this.setTextSize(Math.min(1.5, this.textSizeMultiplier() + 0.1));
  }

  decreaseTextSize(): void {
    this.setTextSize(Math.max(0.8, this.textSizeMultiplier() - 0.1));
  }

  resetTextSize(): void {
    this.setTextSize(1);
  }
}
