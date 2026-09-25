import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { Money } from '../../utils/money';

export interface AgingBucket {
  label: string;
  value: number;
  color: string;
}

/**
 * Stacked receivable / payable aging bar with a legend (Not due, 1–30, …).
 *
 *   <lsms-aging-bar [buckets]="[{ label: '0–30 days', value: 1200, color: 'var(--c-info)' }, …]" />
 *   <lsms-aging-bar [buckets]="…" unit="products" />   (plain counts instead of money)
 */
@Component({
  selector: 'lsms-aging-bar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="bar" role="img" [attr.aria-label]="summary()">
      @for (b of buckets(); track b.label) {
        @if (b.value > 0) {
          <i [style.flex-grow]="b.value" [style.background]="b.color" [title]="b.label + ': ' + fmt(b.value)"></i>
        }
      }
    </div>
    <div class="legend">
      @for (b of buckets(); track b.label) {
        <span [class.dim]="!b.value"><i [style.background]="b.color"></i>{{ b.label }} <b>{{ compact(b.value) }}</b></span>
      }
    </div>
  `,
  styles: `
    :host { display: block; }
    .bar { display: flex; gap: 2px; height: 12px; border-radius: 6px; overflow: hidden; background: color-mix(in srgb, var(--c-text-2) 10%, transparent); }
    .bar i { flex-basis: 0; min-width: 6px; }
    .legend { display: flex; flex-wrap: wrap; gap: 6px 16px; margin-top: 8px; font-size: 0.76rem; color: var(--c-text-2); }
    .legend span { display: inline-flex; align-items: center; gap: 5px; }
    .legend span.dim { opacity: 0.5; }
    .legend i { width: 9px; height: 9px; border-radius: 3px; }
    .legend b { color: var(--c-text); font-variant-numeric: tabular-nums; }
  `,
})
export class AgingBar {
  readonly buckets = input.required<AgingBucket[]>();
  /** Empty (default) = money; otherwise values are counts suffixed with this word. */
  readonly unit = input<string>('');

  protected readonly summary = computed(() => this.buckets().map((b) => `${b.label}: ${this.fmt(b.value)}`).join(', '));
  protected fmt(v: number): string {
    return this.unit() ? `${v} ${this.unit()}` : Money.format(v);
  }
  protected compact(v: number): string {
    return this.unit() ? String(v) : Money.format(v, { decimals: 0 });
  }
}
