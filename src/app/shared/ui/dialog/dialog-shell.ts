import { DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';

import { LanguageService } from '../../../core/i18n/language.service';
import { IconButton } from '../button/icon-button';
import { Icon } from '../icon/icon';

/**
 * Standard dialog layout: header (icon + title + close), scrollable body,
 * sticky footer for actions. Use inside any component opened through
 * `DialogService.open()`.
 *
 *   <lsms-dialog title="Add category" icon="category">
 *     <form …>…</form>
 *     <ng-container dialogActions>
 *       <button lsmsButton="secondary" (click)="ref.close()">Cancel</button>
 *       <button lsmsButton (click)="save()">Save</button>
 *     </ng-container>
 *   </lsms-dialog>
 */
@Component({
  selector: 'lsms-dialog',
  imports: [Icon, IconButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (title()) {
      <header class="head">
        @if (icon()) {
          <span class="icon-wrap"><lsms-icon [name]="icon()!" [size]="20" /></span>
        }
        <h2 class="title">{{ title() }}</h2>
        @if (closable()) {
          <button
            lsmsIconButton="close"
            [iconSize]="20"
            color="var(--c-text-2)"
            [attr.aria-label]="i18n.t('Close', 'Funga')"
            (click)="ref?.close()"
          ></button>
        }
      </header>
    }
    <div class="body"><ng-content /></div>
    <footer class="foot"><ng-content select="[dialogActions]" /></footer>
  `,
  styles: `
    @use 'typography' as t;
    :host { display: flex; flex-direction: column; max-height: inherit; height: 100%; min-height: 0; }
    .head {
      display: flex; align-items: center; gap: 12px;
      padding: 16px 16px 12px 20px;
      border-bottom: 1px solid var(--c-divider);
    }
    .icon-wrap {
      display: inline-flex; padding: 8px; border-radius: 10px;
      color: var(--c-primary); background: color-mix(in srgb, var(--c-primary) 12%, transparent);
    }
    .title { @include t.h4; font-weight: 600; flex: 1; min-width: 0; @include t.ellipsis; }
    .body { flex: 1; min-height: 0; overflow: auto; padding: 20px; }
    .foot {
      display: flex; justify-content: flex-end; gap: 8px; flex-wrap: wrap;
      padding: 12px 20px; border-top: 1px solid var(--c-divider);
    }
    .foot:empty { display: none; }
  `,
})
export class DialogShell {
  protected readonly i18n = inject(LanguageService);
  protected readonly ref = inject(DialogRef, { optional: true });
  readonly title = input<string | undefined>(undefined);
  readonly icon = input<string | undefined>(undefined);
  readonly closable = input(true);
}
