import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { Icon } from '../icon/icon';

/**
 * Round icon button — port of `CustomButton.iconButton`.
 * `<button lsmsIconButton="refresh" aria-label="Refresh" (click)="load()"></button>`
 * Always give it an `aria-label` (and optionally `title` for a tooltip).
 */
@Component({
  selector: 'button[lsmsIconButton], a[lsmsIconButton]',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<lsms-icon [name]="lsmsIconButton()" [size]="iconSize()" [filled]="filled()" />`,
  host: {
    class: 'lsms-icon-button',
    '[style.--ib-color]': 'color()',
    '[style.width.px]': 'iconSize() + 16',
    '[style.height.px]': 'iconSize() + 16',
  },
  styles: `
    :host {
      --ib-color: var(--c-primary);
      position: relative;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      padding: 0;
      border: 0;
      border-radius: 50%;
      background: transparent;
      color: var(--ib-color);
      cursor: pointer;
      overflow: hidden;
      -webkit-tap-highlight-color: transparent;
    }
    :host::after {
      content: '';
      position: absolute;
      inset: 0;
      background: var(--ib-color);
      opacity: 0;
      transition: opacity 0.15s ease;
    }
    :host(:hover)::after { opacity: 0.08; }
    :host(:focus-visible)::after { opacity: 0.12; }
    :host(:active)::after { opacity: 0.16; }
    :host(:disabled) { opacity: 0.38; cursor: not-allowed; }
    :host(:disabled)::after { opacity: 0; }
  `,
})
export class IconButton {
  readonly lsmsIconButton = input.required<string>();
  readonly iconSize = input(24);
  readonly color = input<string | undefined>(undefined);
  readonly filled = input(false);
}
