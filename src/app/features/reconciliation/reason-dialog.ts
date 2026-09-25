import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';

import { LanguageService } from '@core/i18n/language.service';
import { Button, DialogShell, Icon } from '@shared/ui';

export interface ReasonDialogData {
  title: string;
  message?: string;
  label: string;
  confirm: string;
  danger?: boolean;
  /** Minimum characters before confirming (default 3). */
  min?: number;
}

/** Asks for a required reason (delete a debt, reject a deposit …). Closes with the trimmed text. */
@Component({
  selector: 'app-reason-dialog',
  imports: [DialogShell, Button, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <lsms-dialog [title]="data.title" [icon]="data.danger ? 'warning' : 'edit_note'">
      @if (data.message) {
        <p class="msg" [class.danger]="data.danger"><lsms-icon [name]="data.danger ? 'warning' : 'info'" [size]="17" />{{ data.message }}</p>
      }
      <label>
        <span>{{ data.label }}</span>
        <textarea rows="3" maxlength="500" [value]="text()" (input)="text.set($any($event.target).value)" autofocus></textarea>
      </label>
      <ng-container dialogActions>
        <button lsmsButton="secondary" (click)="ref.close()">{{ i18n.t('Cancel', 'Ghairi') }}</button>
        <button [lsmsButton]="data.danger ? 'danger' : 'primary'" [disabled]="text().trim().length < (data.min ?? 3)" (click)="ref.close(text().trim())">{{ data.confirm }}</button>
      </ng-container>
    </lsms-dialog>
  `,
  styles: `
    .msg { display: flex; align-items: flex-start; gap: 8px; margin-bottom: 12px; padding: 10px 12px; border-radius: 12px; font-size: 0.84rem; color: var(--c-text); background: color-mix(in srgb, var(--c-info) 7%, var(--c-bg)); }
    .msg.danger { background: color-mix(in srgb, var(--c-error) 7%, var(--c-bg)); }
    .msg lsms-icon { flex-shrink: 0; color: var(--c-info); }
    .msg.danger lsms-icon { color: var(--c-error); }
    label { display: flex; flex-direction: column; gap: 4px; font-size: 0.78rem; font-weight: 600; color: var(--c-text-2); }
    textarea { padding: 9px 10px; border: 1px solid var(--c-border); border-radius: 10px; background: var(--c-input-fill); font: inherit; font-size: 0.86rem; color: var(--c-text); outline: none; resize: vertical; }
    textarea:focus { border-color: var(--c-primary); }
  `,
})
export class ReasonDialog {
  protected readonly data = inject<ReasonDialogData>(DIALOG_DATA);
  protected readonly ref = inject<DialogRef<string>>(DialogRef);
  protected readonly i18n = inject(LanguageService);
  protected readonly text = signal('');
}
