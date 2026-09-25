import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatSlideToggle } from '@angular/material/slide-toggle';

import { LanguageService } from '@core/i18n/language.service';
import { ThemeService } from '@core/theme/theme.service';
import { Card, Icon } from '@shared/ui';

/** Appearance & language preferences (Flutter settings section / ThemeProvider). */
@Component({
  selector: 'app-settings-page',
  imports: [Card, Icon, MatSlideToggle],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="wrap">
      <lsms-card [title]="i18n.t('Appearance', 'Muonekano')" icon="palette">
        <div class="themes">
          @for (opt of themeOptions; track opt.key) {
            <button type="button" class="theme" [class.on]="currentTheme() === opt.key" (click)="applyTheme(opt.key)">
              <span class="swatch" [attr.data-theme-preview]="opt.key"><i></i><i></i></span>
              <lsms-icon [name]="opt.icon" [size]="18" />
              {{ i18n.isSwahili() ? opt.sw : opt.en }}
            </button>
          }
        </div>
        <div class="row">
          <div>
            <strong>{{ i18n.t('Follow system theme', 'Fuata mandhari ya kifaa') }}</strong>
            <small>{{ i18n.t('Match your device light/dark setting', 'Linganisha na mpangilio wa kifaa chako') }}</small>
          </div>
          <mat-slide-toggle [checked]="theme.followSystemTheme()" (change)="theme.toggleFollowSystemTheme()" />
        </div>
        <div class="row">
          <div>
            <strong>{{ i18n.t('Auto night mode', 'Hali ya usiku otomatiki') }}</strong>
            <small>{{ i18n.t('Dark theme from 18:00 to 06:00', 'Mandhari ya giza kuanzia saa 12 jioni hadi 12 asubuhi') }}</small>
          </div>
          <mat-slide-toggle [checked]="theme.autoNightMode()" (change)="theme.toggleAutoNightMode()" />
        </div>
        <div class="row">
          <div>
            <strong>{{ i18n.t('Animated background', 'Mandharinyuma yanayosogea') }}</strong>
            <small>{{ i18n.t('Soft drifting bubbles behind the main dashboard.', 'Viputo laini vinavyoelea nyuma ya dashboard kuu.') }}</small>
          </div>
          <mat-slide-toggle [checked]="theme.ambientMotion()" (change)="theme.toggleAmbientMotion()" />
        </div>
        <div class="row">
          <div>
            <strong>{{ i18n.t('Text size', 'Ukubwa wa maandishi') }}</strong>
            <small>{{ (theme.textSizeMultiplier() * 100).toFixed(0) }}%</small>
          </div>
          <div class="stepper">
            <button type="button" (click)="theme.decreaseTextSize()" [attr.aria-label]="i18n.t('Smaller', 'Punguza')"><lsms-icon name="text_decrease" [size]="18" /></button>
            <button type="button" (click)="theme.resetTextSize()">{{ i18n.t('Reset', 'Rudisha') }}</button>
            <button type="button" (click)="theme.increaseTextSize()" [attr.aria-label]="i18n.t('Larger', 'Ongeza')"><lsms-icon name="text_increase" [size]="18" /></button>
          </div>
        </div>
      </lsms-card>

      <lsms-card [title]="i18n.t('Language', 'Lugha')" icon="translate">
        <div class="themes">
          <button type="button" class="theme" [class.on]="i18n.lang() === 'sw'" (click)="i18n.setLanguage('sw')">🇹🇿 Kiswahili</button>
          <button type="button" class="theme" [class.on]="i18n.lang() === 'en'" (click)="i18n.setLanguage('en')">🇬🇧 English</button>
        </div>
      </lsms-card>
    </div>
  `,
  styles: `
    .wrap { max-width: 820px; margin: 0 auto; padding: 28px 24px; display: flex; flex-direction: column; gap: 20px; }
    .themes { display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 8px; }
    .theme {
      display: inline-flex; align-items: center; gap: 8px; padding: 10px 14px; border-radius: 12px;
      border: 1.5px solid var(--c-border); background: var(--c-surface); color: var(--c-text); font-weight: 600; cursor: pointer;
    }
    .theme.on { border-color: var(--c-primary); color: var(--c-primary); background: color-mix(in srgb, var(--c-primary) 8%, transparent); }
    .swatch { display: inline-flex; width: 28px; height: 18px; border-radius: 5px; overflow: hidden; border: 1px solid var(--c-border); }
    .swatch i { flex: 1; }
    [data-theme-preview='comfort'] i:first-child { background: #fafaf7; } [data-theme-preview='comfort'] i:last-child { background: #3b7597; }
    [data-theme-preview='light'] i:first-child { background: #eef4fb; } [data-theme-preview='light'] i:last-child { background: #3b7597; }
    [data-theme-preview='dark'] i:first-child { background: #0f1419; } [data-theme-preview='dark'] i:last-child { background: #96d4d4; }
    .row { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 14px 0; border-top: 1px solid var(--c-divider); }
    .row div:first-child { display: flex; flex-direction: column; }
    .row small { color: var(--c-text-2); font-size: 0.78rem; }
    .stepper { display: inline-flex; border: 1px solid var(--c-border); border-radius: 10px; overflow: hidden; }
    .stepper button { display: inline-flex; align-items: center; padding: 8px 12px; border: 0; background: var(--c-surface); color: var(--c-text); cursor: pointer; font-weight: 600; font-size: 0.8rem; }
    .stepper button + button { border-left: 1px solid var(--c-border); }
    .stepper button:hover { color: var(--c-primary); }
  `,
})
export class SettingsPage {
  protected readonly theme = inject(ThemeService);
  protected readonly i18n = inject(LanguageService);

  protected readonly themeOptions = [
    { key: 'comfort', icon: 'eco', en: 'Eye comfort', sw: 'Starehe ya macho' },
    { key: 'light', icon: 'light_mode', en: 'Light', sw: 'Mwanga' },
    { key: 'dark', icon: 'dark_mode', en: 'Dark', sw: 'Giza' },
  ] as const;

  protected currentTheme(): 'comfort' | 'light' | 'dark' {
    if (this.theme.isDarkMode()) return 'dark';
    return this.theme.eyeComfortMode() ? 'comfort' : 'light';
  }

  protected applyTheme(key: 'comfort' | 'light' | 'dark'): void {
    if (key === 'dark') {
      this.theme.setTheme(true);
      return;
    }
    this.theme.setTheme(false);
    this.theme.eyeComfortMode.set(key === 'comfort');
  }
}
