import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

import { Button } from '../button/button';
import { Icon } from '../icon/icon';

/**
 * Empty / no-data placeholder — port of `SharedEmptyState`. Up to two
 * actions; `compact` for cards, tabs and tight panels.
 *
 *   <lsms-empty-state title="No sales yet" message="…" actionLabel="New sale" (action)="create()" />
 */
@Component({
  selector: 'lsms-empty-state',
  imports: [Icon, Button],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="circle">
      <lsms-icon [name]="icon()" [size]="compact() ? 32 : 48" />
    </div>
    <h3 class="title">{{ title() }}</h3>
    @if (message()) {
      <p class="message">{{ message() }}</p>
    }
    @if (actionLabel() || secondaryActionLabel()) {
      <div class="actions">
        @if (actionLabel()) {
          <button lsmsButton size="sm" [icon]="actionIcon()" (click)="action.emit()">{{ actionLabel() }}</button>
        }
        @if (secondaryActionLabel()) {
          <button lsmsButton size="sm" [icon]="secondaryActionIcon()" (click)="secondaryAction.emit()">
            {{ secondaryActionLabel() }}
          </button>
        }
      </div>
    }
  `,
  host: { '[class.compact]': 'compact()', '[style.--ic]': 'iconColor()' },
  styles: `
    @use 'typography' as t;
    :host {
      --ic: var(--c-primary);
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      padding: 32px; text-align: center;
    }
    :host(.compact) { padding: 16px; }
    .circle {
      display: flex; padding: 32px; border-radius: 50%;
      color: var(--ic); background: color-mix(in srgb, var(--ic) 10%, transparent);
    }
    :host(.compact) .circle { padding: 16px; }
    .title { @include t.h4; color: var(--c-text); margin-top: 24px; }
    :host(.compact) .title { @include t.body-lg; margin-top: 8px; }
    .message { @include t.body; color: var(--c-text-2); margin-top: 8px; max-width: 420px; }
    .actions { display: flex; gap: 16px; margin-top: 24px; flex-wrap: wrap; justify-content: center; }
    :host(.compact) .actions { margin-top: 16px; }
  `,
})
export class EmptyState {
  readonly title = input.required<string>();
  readonly message = input<string | undefined>(undefined);
  readonly icon = input('inbox');
  readonly iconColor = input<string | undefined>(undefined);
  readonly actionLabel = input<string | undefined>(undefined);
  readonly actionIcon = input('add');
  readonly secondaryActionLabel = input<string | undefined>(undefined);
  readonly secondaryActionIcon = input('refresh');
  readonly compact = input(false);
  readonly action = output<void>();
  readonly secondaryAction = output<void>();
}
