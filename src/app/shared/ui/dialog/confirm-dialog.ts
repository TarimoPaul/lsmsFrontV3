import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { Button } from '../button/button';
import { Icon } from '../icon/icon';

export type ConfirmKind = 'confirm' | 'delete' | 'error' | 'success' | 'warning' | 'info';

export interface ConfirmDialogData {
  kind: ConfirmKind;
  title: string;
  message: string;
  confirmText: string;
  /** Omit for single-button notices (error / success / info). */
  cancelText?: string;
}

/** Port of Flutter `CustomDialogs` confirm / delete / error / success dialogs. */
@Component({
  selector: 'lsms-confirm-dialog',
  imports: [Button, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (icon) {
      <span class="icon" [attr.data-kind]="data.kind"><lsms-icon [name]="icon" [size]="32" /></span>
    }
    <h2 class="title">{{ data.title }}</h2>
    <p class="message">{{ data.message }}</p>
    <div class="actions">
      @if (data.cancelText) {
        <button lsmsButton="text" (click)="ref.close(false)">{{ data.cancelText }}</button>
      }
      <button [lsmsButton]="data.kind === 'delete' ? 'danger' : 'primary'" cdkFocusInitial (click)="ref.close(true)">
        {{ data.confirmText }}
      </button>
    </div>
  `,
  styles: `
    @use 'typography' as t;
    :host { display: flex; flex-direction: column; padding: 24px; }
    .icon { align-self: center; color: var(--c-primary); margin-bottom: 16px; }
    .icon[data-kind='delete'], .icon[data-kind='error'] { color: var(--c-error); }
    .icon[data-kind='success'] { color: var(--c-success); }
    .icon[data-kind='warning'] { color: var(--c-warning); }
    .icon[data-kind='info'] { color: var(--c-info); }
    .title { @include t.h3; }
    .icon + .title { text-align: center; }
    .message { @include t.body; color: var(--c-text-2); margin-top: 12px; white-space: pre-line; }
    .actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 24px; }
  `,
})
export class ConfirmDialog {
  protected readonly data = inject<ConfirmDialogData>(DIALOG_DATA);
  protected readonly ref = inject<DialogRef<boolean>>(DialogRef);
  protected readonly icon = (
    {
      delete: 'warning',
      error: 'error',
      success: 'check_circle',
      warning: 'warning',
      info: 'info',
    } as Record<ConfirmKind, string | undefined>
  )[this.data.kind];
}
