import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { LanguageService } from '@core/i18n/language.service';
import { AppUpdateService } from '@core/update/app-update.service';
import { Button, Icon } from '@shared/ui';

/** "A new version is available" strip at the bottom of the shell. */
@Component({
  selector: 'app-update-banner',
  imports: [Button, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (updates.available(); as next) {
      <div class="bar" role="status">
        <lsms-icon name="system_update_alt" [size]="20" />
        <span class="txt">
          <strong>{{ i18n.t('A new version is available', 'Toleo jipya lipo') }} ({{ next.version }})</strong>
          <small>{{ i18n.t('Reload to get the latest fixes. Unsaved work in a form may be lost.', 'Pakia upya upate marekebisho mapya. Kazi isiyohifadhiwa kwenye fomu inaweza kupotea.') }}</small>
        </span>
        <button lsmsButton="text" size="sm" (click)="updates.dismiss()">{{ i18n.t('Later', 'Baadaye') }}</button>
        <button lsmsButton="primary" size="sm" icon="refresh" (click)="updates.reload()">{{ i18n.t('Reload', 'Pakia upya') }}</button>
      </div>
    }
  `,
  styles: `
    :host { position: fixed; left: 50%; top: 80px; transform: translateX(-50%); z-index: 950; width: min(640px, calc(100vw - 24px)); }
    .bar {
      display: flex; align-items: center; gap: 12px; padding: 10px 12px 10px 16px; border-radius: 14px;
      background: var(--c-float); border: 1px solid color-mix(in srgb, var(--c-primary) 40%, var(--c-border));
      box-shadow: 0 14px 34px rgb(15 23 42 / 0.2); color: var(--c-text); animation: up 0.25s ease-out;
    }
    lsms-icon { color: var(--c-primary); flex: none; }
    .txt { flex: 1; display: flex; flex-direction: column; min-width: 0; }
    .txt strong { font-size: 0.88rem; }
    .txt small { font-size: 0.74rem; color: var(--c-text-2); }
    @keyframes up { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: none; } }
    @media (max-width: 600px) { .bar { flex-wrap: wrap; } .txt { flex-basis: calc(100% - 40px); } }
  `,
})
export class UpdateBanner {
  protected readonly i18n = inject(LanguageService);
  protected readonly updates = inject(AppUpdateService);

  constructor() {
    this.updates.start();
  }
}
