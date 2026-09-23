import { CdkMenu, CdkMenuItem, CdkMenuTrigger } from '@angular/cdk/menu';
import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';

import { LanguageService } from '../../../core/i18n/language.service';
import { IconButton } from '../button/icon-button';
import { Icon } from '../icon/icon';

export interface MenuAction {
  label: string;
  icon?: string;
  /** Renders in the error colour (delete, void …). */
  destructive?: boolean;
  disabled?: boolean;
  run: () => void;
}

/**
 * Overflow "⋮" row-actions menu — port of `SharedActionMenu`, built on CDK
 * Menu (keyboard navigation, focus return, click-outside close).
 *
 *   <lsms-action-menu [actions]="[
 *     { label: 'Edit', icon: 'edit', run: () => edit(row) },
 *     { label: 'Delete', icon: 'delete', destructive: true, run: () => remove(row) },
 *   ]" />
 */
@Component({
  selector: 'lsms-action-menu',
  imports: [CdkMenuTrigger, CdkMenu, CdkMenuItem, Icon, IconButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      [lsmsIconButton]="icon()"
      [iconSize]="20"
      [color]="'var(--c-text-2)'"
      [cdkMenuTriggerFor]="menu"
      [attr.aria-label]="tooltip() ?? i18n.t('Actions', 'Vitendo')"
      [title]="tooltip() ?? i18n.t('Actions', 'Vitendo')"
      (click)="$event.stopPropagation()"
    ></button>
    <ng-template #menu>
      <div class="lsms-menu" cdkMenu>
        @for (a of actions(); track a.label) {
          <button
            type="button"
            class="lsms-menu-item"
            cdkMenuItem
            [cdkMenuItemDisabled]="!!a.disabled"
            [class.destructive]="a.destructive"
            (cdkMenuItemTriggered)="a.run()"
          >
            @if (a.icon) {
              <lsms-icon [name]="a.icon" [size]="16" />
            }
            <span>{{ a.label }}</span>
          </button>
        }
      </div>
    </ng-template>
  `,
  styles: `:host { display: inline-flex; }`,
})
export class ActionMenu {
  protected readonly i18n = inject(LanguageService);
  readonly actions = input.required<MenuAction[]>();
  readonly icon = input('more_vert');
  readonly tooltip = input<string | undefined>(undefined);
}
