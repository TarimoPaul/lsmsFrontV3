import { ChangeDetectionStrategy, Component, input, model } from '@angular/core';

import { Icon } from '../icon/icon';

export interface SegmentOption<T> {
  value: T;
  label: string;
  icon?: string;
  /** Trailing count pill, e.g. "Returned (3)". */
  count?: number;
}

/**
 * Single-choice filter pills with an unmistakable active state (filled
 * primary, white text) — port of `SegmentedFilterBar`. Two-way bind:
 *   <lsms-segmented-filter-bar [options]="opts" [(selected)]="filter" />
 */
@Component({
  selector: 'lsms-segmented-filter-bar',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @for (o of options(); track o.value) {
      <button
        type="button"
        class="chip"
        role="radio"
        [class.on]="o.value === selected()"
        [attr.aria-checked]="o.value === selected()"
        (click)="selected.set(o.value)"
      >
        @if (o.icon) {
          <lsms-icon [name]="o.icon" [size]="14" />
        }
        <span>{{ o.label }}</span>
        @if (o.count !== undefined && o.count !== null) {
          <span class="count">{{ o.count }}</span>
        }
      </button>
    }
  `,
  host: { role: 'radiogroup', '[class.wrap]': '!scrollable()' },
  styles: `
    :host {
      display: flex;
      gap: 8px;
      overflow-x: auto;
      scrollbar-width: none;
      padding: 1px;
    }
    :host(.wrap) { flex-wrap: wrap; overflow: visible; }
    :host::-webkit-scrollbar { display: none; }
    .chip {
      display: inline-flex; align-items: center; gap: 6px; flex-shrink: 0;
      padding: 8px 14px; border-radius: 24px;
      border: 1px solid color-mix(in srgb, var(--c-border) 60%, transparent);
      background: var(--c-surface); color: var(--c-text-2);
      font-size: 0.75rem; font-weight: 500; line-height: 1.2;
      cursor: pointer; white-space: nowrap;
      transition: background-color 0.15s ease, color 0.15s ease, border-color 0.15s ease;
    }
    .chip:hover:not(.on) { border-color: var(--c-primary); color: var(--c-primary); }
    .chip.on {
      background: var(--c-primary); border-color: var(--c-primary);
      color: var(--c-on-primary); font-weight: 700;
    }
    .count {
      padding: 1px 6px; border-radius: 10px;
      font-size: 0.625rem; font-weight: 700;
      background: color-mix(in srgb, var(--c-primary) 12%, transparent); color: var(--c-primary);
    }
    .on .count { background: color-mix(in srgb, currentColor 25%, transparent); color: inherit; }
  `,
})
export class SegmentedFilterBar<T> {
  readonly options = input.required<SegmentOption<T>[]>();
  readonly selected = model.required<T>();
  /** Scroll horizontally (default) instead of wrapping. */
  readonly scrollable = input(true);
}
