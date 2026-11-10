import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { LanguageService } from '@core/i18n/language.service';
import { Button, DialogShell } from '@shared/ui';

export interface KupimaShortData {
  message: string;
  hasOpen: boolean;
  mlLeft: number;
}

/**
 * KUPIMA (owner ek): the open container has fewer ml than the measure. Nothing is closed by itself - the person
 * chooses: (i) SPLIT = use what is left + open a new one (no loss), (ii) FINISHED = the container is really finished
 * (what is left is a loss), then a new one. No container open: only "open a new one".
 */
@Component({
  selector: 'app-kupima-short-dialog',
  imports: [DialogShell, Button],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <lsms-dialog [title]="data.hasOpen ? i18n.t('The container is short', 'Chombo hakitoshi') : i18n.t('No open container', 'Hakuna chombo wazi')" icon="local_bar">
      <p class="msg">{{ data.message }}</p>
      @if (data.hasOpen && data.mlLeft > 0) {
        <div class="opts">
          <button type="button" class="opt" data-choice="SPLIT" (click)="ref.close('SPLIT')">
            <b>{{ i18n.t('Use what is left + open a new one', 'Tumia ml zilizobaki + fungua kipya') }}</b>
            <small>{{ i18n.t('The measure is split: the old container goes to 0, the rest comes from the new one. No loss.', 'Kipimo kinagawanywa: cha zamani kinafika 0, kinachobaki kinatoka kipya. Hakuna upotevu.') }}</small>
          </button>
          <button type="button" class="opt warn" data-choice="FINISHED" (click)="ref.close('FINISHED')">
            <b>{{ i18n.t('The container is really finished', 'Chombo kimeisha kweli') }}</b>
            <small>{{ i18n.t('What is left (' + data.mlLeft + 'ml) is written as a loss, then a new one is opened.', 'Zilizobaki (' + data.mlLeft + 'ml) zinaandikwa upotevu, kisha kipya kinafunguliwa.') }}</small>
          </button>
        </div>
      }
      <ng-container dialogActions>
        <button lsmsButton="secondary" (click)="ref.close()">{{ i18n.t('Cancel', 'Ghairi') }}</button>
        @if (!data.hasOpen || data.mlLeft <= 0) {
          <button lsmsButton="primary" data-choice="OPEN" (click)="ref.close('SPLIT')">{{ i18n.t('Open a new one', 'Fungua chombo kipya') }}</button>
        }
      </ng-container>
    </lsms-dialog>
  `,
  styles: `
    .msg { margin: 0 0 12px; font-size: 0.88rem; }
    .opts { display: grid; gap: 8px; }
    .opt { display: flex; flex-direction: column; gap: 3px; text-align: left; padding: 12px 14px; border-radius: 12px; border: 1px solid var(--c-border); background: var(--c-surface); font: inherit; color: var(--c-text); cursor: pointer; }
    .opt:hover { border-color: var(--c-primary); }
    .opt small { font-size: 0.76rem; color: var(--c-text-2); }
    .opt.warn:hover { border-color: var(--c-error); }
  `,
})
export class KupimaShortDialog {
  protected readonly ref = inject<DialogRef<'SPLIT' | 'FINISHED'>>(DialogRef);
  protected readonly data = inject<KupimaShortData>(DIALOG_DATA);
  protected readonly i18n = inject(LanguageService);
}
