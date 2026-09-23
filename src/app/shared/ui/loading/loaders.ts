import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { Spinner } from './spinner';

/** Linear progress bar — determinate when `value` (0–1) is set. */
@Component({
  selector: 'lsms-linear-progress',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div class="bar" [class.indeterminate]="value() === undefined" [style.width.%]="pct()"></div>`,
  host: { role: 'progressbar', '[attr.aria-valuenow]': 'pct()' },
  styles: `
    :host {
      display: block;
      height: 4px;
      border-radius: 2px;
      overflow: hidden;
      background: color-mix(in srgb, var(--c-primary) 20%, transparent);
    }
    .bar { height: 100%; background: var(--c-primary); transition: width 0.25s ease; }
    .indeterminate { width: 40% !important; animation: slide 1.2s ease-in-out infinite; }
    @keyframes slide { from { transform: translateX(-100%); } to { transform: translateX(250%); } }
  `,
})
export class LinearProgress {
  readonly value = input<number | undefined>(undefined);
  protected readonly pct = computed(() => {
    const v = this.value();
    return v === undefined ? null : Math.round(Math.min(1, Math.max(0, v)) * 100);
  });
}

/**
 * Shimmering skeleton placeholder — port of `tableLoader` / `listLoader` /
 * `cardPlaceholder`. `variant="table"` draws `rows` lines, `list` draws rows
 * with an avatar, `card` a single block of `height`.
 */
@Component({
  selector: 'lsms-skeleton',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @switch (variant()) {
      @case ('card') {
        <div class="block shimmer" [style.height.px]="height()"></div>
      }
      @case ('list') {
        @for (r of rowsArr(); track $index) {
          <div class="list-row">
            <div class="avatar shimmer"></div>
            <div class="lines">
              <div class="line shimmer" style="width: 60%"></div>
              <div class="line shimmer" style="width: 35%"></div>
            </div>
          </div>
        }
      }
      @default {
        @for (r of rowsArr(); track $index) {
          <div class="line shimmer table-line"></div>
        }
      }
    }
  `,
  host: { 'aria-busy': 'true' },
  styles: `
    :host { display: flex; flex-direction: column; gap: 10px; padding: 8px; }
    .shimmer {
      border-radius: 6px;
      background: linear-gradient(90deg, var(--c-divider) 0%, var(--c-bg) 50%, var(--c-divider) 100%);
      background-size: 200% 100%;
      animation: shimmer 1.5s linear infinite;
    }
    .table-line { height: 40px; }
    .line { height: 12px; }
    .block { width: 100%; border-radius: 12px; }
    .list-row { display: flex; gap: 12px; align-items: center; }
    .avatar { width: 40px; height: 40px; border-radius: 50%; flex-shrink: 0; }
    .lines { flex: 1; display: flex; flex-direction: column; gap: 8px; }
    @keyframes shimmer { from { background-position: 200% 0; } to { background-position: -200% 0; } }
  `,
})
export class Skeleton {
  readonly variant = input<'table' | 'list' | 'card'>('table');
  readonly rows = input(5);
  readonly height = input(120);
  protected readonly rowsArr = computed(() => Array.from({ length: this.rows() }));
}

/**
 * Dims its content and shows a spinner while `loading` — port of
 * `LoadingOverlay` / `LoadingIndicators.overlay`.
 * `<lsms-loading-overlay [loading]="saving()"> …content… </lsms-loading-overlay>`
 */
@Component({
  selector: 'lsms-loading-overlay',
  imports: [Spinner],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ng-content />
    @if (loading()) {
      <div class="veil">
        <div class="box"><lsms-spinner [size]="36" [message]="message()" /></div>
      </div>
    }
  `,
  styles: `
    :host { position: relative; display: block; }
    .veil {
      position: absolute;
      inset: 0;
      z-index: 5;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgb(var(--c-shadow) / 0.3);
      border-radius: inherit;
    }
    .box { padding: 16px 24px; border-radius: 12px; background: var(--c-surface); box-shadow: var(--shadow-lg); }
  `,
})
export class LoadingOverlay {
  readonly loading = input(false);
  readonly message = input<string | undefined>(undefined);
}
