import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { Icon } from '../icon/icon';
import { Spinner } from '../loading/spinner';

export type ButtonVariant = 'primary' | 'secondary' | 'tonal' | 'danger' | 'success' | 'text';
export type ButtonSize = 'sm' | 'md' | 'lg';

/**
 * Shared button — port of Flutter `CustomButton` (primary / secondary /
 * tonal / danger / success / text) with the same size scale (36 / 48 / 56).
 *
 * Usage:
 *   <button lsmsButton (click)="save()">Save</button>
 *   <button lsmsButton="secondary" icon="refresh" size="sm">Refresh</button>
 *   <button lsmsButton="danger" [loading]="deleting()">Delete</button>
 *
 * `loading` keeps the button width, shows a spinner and swallows clicks
 * (pointer-events off) like the Flutter version.
 */
@Component({
  selector: 'button[lsmsButton], a[lsmsButton]',
  imports: [Icon, Spinner],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (loading()) {
      <lsms-spinner [size]="iconSize() + 2" [stroke]="2" color="currentColor" />
    } @else if (icon()) {
      <lsms-icon [name]="icon()!" [size]="iconSize()" />
    }
    <span class="label"><ng-content /></span>
    @if (trailingIcon() && !loading()) {
      <lsms-icon [name]="trailingIcon()!" [size]="iconSize()" />
    }
  `,
  host: {
    class: 'lsms-button',
    '[class.v-primary]': "variant() === 'primary'",
    '[class.v-secondary]': "variant() === 'secondary'",
    '[class.v-tonal]': "variant() === 'tonal'",
    '[class.v-danger]': "variant() === 'danger'",
    '[class.v-success]': "variant() === 'success'",
    '[class.v-text]': "variant() === 'text'",
    '[class.s-sm]': "size() === 'sm'",
    '[class.s-lg]': "size() === 'lg'",
    '[class.full]': 'fullWidth()',
    '[class.loading]': 'loading()',
    '[class.active]': 'active()',
    '[attr.aria-busy]': 'loading() || null',
  },
  styleUrl: './button.scss',
})
export class Button {
  /** Variant via the selector attribute value: `lsmsButton="secondary"`. */
  readonly lsmsButton = input<ButtonVariant | ''>('');
  readonly size = input<ButtonSize>('md');
  readonly icon = input<string | undefined>(undefined);
  readonly trailingIcon = input<string | undefined>(undefined);
  readonly loading = input(false);
  /** Stretch to container width (Flutter default was full width). */
  readonly fullWidth = input(false);
  /** Tonal only: render as the filled "active" state. */
  readonly active = input(false);

  protected readonly variant = computed<ButtonVariant>(() => this.lsmsButton() || 'primary');
  protected readonly iconSize = computed(() => ({ sm: 16, md: 18, lg: 20 })[this.size()]);
}
