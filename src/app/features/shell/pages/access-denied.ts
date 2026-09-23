import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';

import { AuthService } from '@core/auth/auth.service';
import { LanguageService } from '@core/i18n/language.service';
import { findModule } from '@core/navigation/app-modules';
import { Button, Icon } from '@shared/ui';

/** Shown when a route guard blocks a module the user has no read access to. */
@Component({
  selector: 'app-access-denied',
  imports: [RouterLink, Icon, Button],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="card">
      <span class="ic"><lsms-icon name="lock" [size]="36" [filled]="true" /></span>
      <h1>{{ i18n.t('Access Denied', 'Ruhusa Imekataliwa') }}</h1>
      <p>
        {{
          moduleName()
            ? i18n.t("You don't have permission to access " + moduleName() + '.', 'Huna ruhusa ya kufungua ' + moduleName() + '.')
            : i18n.t("You don't have permission to view this page.", 'Huna ruhusa ya kuona ukurasa huu.')
        }}
      </p>
      <p class="hint">{{ i18n.t('Contact your administrator to request access.', 'Wasiliana na msimamizi wako kuomba ruhusa.') }}</p>
      <div class="row">
        <a lsmsButton="secondary" routerLink="/dashboard" icon="home">{{ i18n.t('Dashboard', 'Dashibodi') }}</a>
        <button lsmsButton icon="refresh" (click)="refresh()">{{ i18n.t('Refresh permissions', 'Sasisha ruhusa') }}</button>
      </div>
    </section>
  `,
  styles: `
    :host { display: flex; justify-content: center; padding: 64px 20px; }
    .card { max-width: 480px; text-align: center; display: flex; flex-direction: column; align-items: center; gap: 10px; }
    .ic { display: inline-flex; padding: 20px; border-radius: 50%; color: var(--c-error); background: color-mix(in srgb, var(--c-error) 10%, transparent); margin-bottom: 8px; }
    h1 { font-size: 1.5rem; font-weight: 800; }
    p { color: var(--c-text-2); }
    .hint { font-size: 0.85rem; }
    .row { display: flex; gap: 10px; margin-top: 16px; flex-wrap: wrap; justify-content: center; }
  `,
})
export class AccessDenied {
  protected readonly i18n = inject(LanguageService);
  private readonly auth = inject(AuthService);
  readonly section = input<string | undefined>(undefined);
  protected readonly moduleName = computed(() => {
    const m = this.section() ? findModule(this.section()!) : undefined;
    return m ? m.title[this.i18n.lang()] : null;
  });

  protected async refresh(): Promise<void> {
    await this.auth.verify(true);
    history.back();
  }
}
