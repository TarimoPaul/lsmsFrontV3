import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';

import { LanguageService } from '@core/i18n/language.service';
import { Button, DialogShell, Icon } from '@shared/ui';
import { MoneyPipe } from '@shared/utils/money';

export interface HoldData {
  /** The cart's customer — holding needs one (picked or just registered in the cart). */
  customer: string;
  phone: string | null;
  items: number;
  total: number;
}

export interface HoldResult {
  note: string | null;
}

/**
 * Confirms holding an order for the cart's customer (the customer itself is
 * chosen or registered in the cart's Customer field, never re-typed here),
 * with an optional note. The order closes 12 hours after it was first held.
 */
@Component({
  selector: 'app-hold-dialog',
  imports: [DialogShell, Button, Icon, MoneyPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <lsms-dialog [title]="i18n.t('Hold this order', 'Hifadhi oda hii')" icon="pause_circle">
      <div class="who">
        <span class="av"><lsms-icon name="person" [size]="20" /></span>
        <span class="nm">
          <b>{{ data.customer }}</b>
          <small>{{ data.phone || i18n.t('Customer', 'Mteja') }}</small>
        </span>
        <span class="amt">
          <b>{{ data.total | money }}</b>
          <small>{{ i18n.t(data.items + ' item(s)', 'Bidhaa ' + data.items) }}</small>
        </span>
      </div>
      <form (submit)="$event.preventDefault(); save()">
        <label>
          <span>{{ i18n.t('Note (optional)', 'Maelezo (si lazima)') }}</span>
          <input type="text" maxlength="140" [placeholder]="i18n.t('e.g. will pay at 5pm', 'mf. atalipa saa 11 jioni')" (input)="note.set($any($event.target).value)" autofocus />
        </label>
        <button type="submit" hidden></button>
      </form>
      <p class="hint">
        <lsms-icon name="info" [size]="15" />
        {{ i18n.t('Closes automatically after 12 hours. Nothing is sold and no stock is reserved until you complete it.', 'Itafungwa yenyewe baada ya masaa 12. Hakuna kinachouzwa wala stock kushikiliwa mpaka uikamilishe.') }}
      </p>
      <ng-container dialogActions>
        <button lsmsButton="secondary" (click)="ref.close()">{{ i18n.t('Cancel', 'Ghairi') }}</button>
        <button lsmsButton icon="pause_circle" (click)="save()">{{ i18n.t('Hold & new order', 'Hifadhi & oda mpya') }}</button>
      </ng-container>
    </lsms-dialog>
  `,
  styles: `
    .who { display: flex; align-items: center; gap: 10px; margin-bottom: 14px; padding: 10px 12px; border-radius: 12px; background: color-mix(in srgb, var(--c-primary) 7%, var(--c-bg)); }
    .av { display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; width: 38px; height: 38px; border-radius: 50%; color: var(--c-primary); background: color-mix(in srgb, var(--c-primary) 14%, transparent); }
    .nm, .amt { display: flex; flex-direction: column; min-width: 0; }
    .nm { flex: 1; }
    .nm b { font-size: 0.9rem; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .amt { align-items: flex-end; }
    .amt b { font-size: 0.9rem; font-variant-numeric: tabular-nums; }
    small { font-size: 0.72rem; color: var(--c-text-2); }
    label { display: flex; flex-direction: column; gap: 4px; font-size: 0.78rem; font-weight: 600; color: var(--c-text-2); }
    input { padding: 9px 11px; border: 1px solid var(--c-border); border-radius: 10px; background: var(--c-input-fill); font: inherit; font-size: 0.88rem; color: var(--c-text); outline: none; }
    input:focus { border-color: var(--c-primary); }
    .hint { display: flex; align-items: flex-start; gap: 6px; margin: 12px 0 0; font-size: 0.76rem; color: var(--c-text-2); }
    .hint lsms-icon { flex-shrink: 0; margin-top: 1px; }
  `,
})
export class HoldDialog {
  protected readonly data = inject<HoldData>(DIALOG_DATA);
  protected readonly ref = inject<DialogRef<HoldResult>>(DialogRef);
  protected readonly i18n = inject(LanguageService);
  protected readonly note = signal('');

  protected save(): void {
    this.ref.close({ note: this.note().trim() || null });
  }
}
