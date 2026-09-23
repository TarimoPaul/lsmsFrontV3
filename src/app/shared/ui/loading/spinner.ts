import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Circular indeterminate spinner — port of `LoadingIndicators.circular`.
 * With `message` it renders centred with a caption (`centeredCircular`).
 */
@Component({
  selector: 'lsms-spinner',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg
      class="spin-ring"
      [attr.width]="size()"
      [attr.height]="size()"
      viewBox="0 0 50 50"
      role="progressbar"
      aria-label="Loading"
    >
      <circle cx="25" cy="25" r="20" fill="none" [attr.stroke-width]="(stroke() * 50) / size()" />
    </svg>
    @if (message()) {
      <span class="msg">{{ message() }}</span>
    }
  `,
  host: {
    '[class.centered]': 'centered() || !!message()',
    '[style.--spinner-color]': 'color()',
  },
  styles: `
    :host {
      --spinner-color: var(--c-primary);
      display: inline-flex;
      flex-direction: column;
      align-items: center;
      gap: 16px;
      color: var(--spinner-color);
    }
    :host(.centered) {
      display: flex;
      justify-content: center;
      padding: 16px;
      width: 100%;
      height: 100%;
    }
    .spin-ring { animation: rotate 1.4s linear infinite; }
    circle {
      stroke: currentColor;
      stroke-linecap: round;
      stroke-dasharray: 90 150;
      stroke-dashoffset: 0;
      animation: dash 1.4s ease-in-out infinite;
    }
    .msg { font-size: 0.875rem; color: var(--c-text-2); text-align: center; }
    @keyframes rotate { to { transform: rotate(360deg); } }
    @keyframes dash {
      0% { stroke-dasharray: 1 150; stroke-dashoffset: 0; }
      50% { stroke-dasharray: 90 150; stroke-dashoffset: -35; }
      100% { stroke-dasharray: 90 150; stroke-dashoffset: -124; }
    }
  `,
})
export class Spinner {
  readonly size = input(24);
  readonly stroke = input(3);
  readonly color = input<string | undefined>(undefined);
  readonly message = input<string | undefined>(undefined);
  readonly centered = input(false);
}
