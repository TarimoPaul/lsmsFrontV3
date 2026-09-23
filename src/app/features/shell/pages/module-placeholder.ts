import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';

import { CrudAction } from '@core/auth/access-resolver';
import { AuthService } from '@core/auth/auth.service';
import { LanguageService } from '@core/i18n/language.service';
import { findModule } from '@core/navigation/app-modules';
import { Button, Icon } from '@shared/ui';

/**
 * Landing for modules not yet ported to Angular. Confirms routing + RBAC work
 * end-to-end (the user reached it through the section guard) and shows the
 * CRUD rights the current role has on the module.
 */
@Component({
  selector: 'app-module-placeholder',
  imports: [RouterLink, Icon, Button],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (module(); as m) {
      <section class="card" [style.--accent]="m.color">
        <span class="ic"><lsms-icon [name]="m.icon" [size]="36" /></span>
        <h1>{{ m.title[i18n.lang()] }}</h1>
        <p class="desc">{{ m.description[i18n.lang()] }}</p>
        <span class="badge"><lsms-icon name="construction" [size]="16" />{{ i18n.t('Being ported to LSMS v3', 'Inahamishiwa LSMS v3') }}</span>

        <div class="rights">
          <h2>{{ i18n.t('Your access on this module', 'Ruhusa zako kwenye moduli hii') }}</h2>
          <div class="crud">
            @for (a of actions; track a.key) {
              <span class="right" [class.on]="auth.can(m.id, a.key)">
                <lsms-icon [name]="auth.can(m.id, a.key) ? 'check_circle' : 'block'" [size]="16" [filled]="auth.can(m.id, a.key)" />
                {{ i18n.isSwahili() ? a.sw : a.en }}
              </span>
            }
          </div>
        </div>
        <a lsmsButton="secondary" routerLink="/dashboard" icon="arrow_back">{{ i18n.t('Back to dashboard', 'Rudi kwenye dashibodi') }}</a>
      </section>
    }
  `,
  styles: `
    :host { display: flex; justify-content: center; padding: 48px 20px; }
    .card {
      --accent: var(--c-primary);
      width: 100%; max-width: 620px; padding: 40px 32px; border-radius: 24px; text-align: center;
      display: flex; flex-direction: column; align-items: center; gap: 12px;
      background: var(--c-surface); border: 1px solid var(--c-border); box-shadow: var(--shadow-md);
    }
    .ic { display: inline-flex; padding: 18px; border-radius: 22px; color: var(--accent); background: color-mix(in srgb, var(--accent) 12%, transparent); }
    h1 { font-size: 1.6rem; font-weight: 800; letter-spacing: -0.4px; }
    .desc { color: var(--c-text-2); max-width: 440px; }
    .badge { display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px; border-radius: 100px; font-size: 0.78rem; font-weight: 600; color: var(--c-warning); background: color-mix(in srgb, var(--c-warning) 12%, transparent); }
    .rights { width: 100%; margin: 16px 0 12px; padding: 16px; border-radius: 16px; background: var(--c-bg); }
    .rights h2 { font-size: 0.8rem; font-weight: 700; color: var(--c-text-2); margin-bottom: 10px; }
    .crud { display: flex; flex-wrap: wrap; justify-content: center; gap: 8px; }
    .right { display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px; border-radius: 10px; font-size: 0.8rem; font-weight: 600; color: var(--c-text-2); background: var(--c-surface); border: 1px solid var(--c-border); }
    .right.on { color: var(--c-success); border-color: color-mix(in srgb, var(--c-success) 35%, transparent); }
  `,
})
export class ModulePlaceholder {
  protected readonly auth = inject(AuthService);
  protected readonly i18n = inject(LanguageService);
  /** Route data `section` (withComponentInputBinding). */
  readonly section = input<string>('');
  protected readonly module = computed(() => findModule(this.section()));
  protected readonly actions: Array<{ key: CrudAction; en: string; sw: string }> = [
    { key: 'read', en: 'View', sw: 'Kuona' },
    { key: 'create', en: 'Create', sw: 'Kuongeza' },
    { key: 'update', en: 'Edit', sw: 'Kuhariri' },
    { key: 'delete', en: 'Delete', sw: 'Kufuta' },
  ];
}
