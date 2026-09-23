import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { LanguageService } from './core/i18n/language.service';
import { ThemeService } from './core/theme/theme.service';
import { ToastHost } from './shared/ui/toast/toast-host';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, ToastHost],
  template: `
    <router-outlet />
    <lsms-toast-host />
  `,
})
export class App {
  // Instantiate early so theme + language attributes are applied before first paint.
  private readonly theme = inject(ThemeService);
  private readonly language = inject(LanguageService);
}
