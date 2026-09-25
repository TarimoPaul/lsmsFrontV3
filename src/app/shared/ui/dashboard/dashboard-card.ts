import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

import { Icon } from '../icon/icon';

/**
 * The single shared dashboard card shell — port of Flutter `DashboardCard`.
 * Thin header strip (icon + title + action icon) sitting on a tinted band,
 * and a body whose top border curves into the card. Every dashboard tile
 * (KPI, revenue chart, budget, peak hours …) renders through this.
 */
@Component({
  selector: 'lsms-dashboard-card',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="header">
      <lsms-icon [name]="icon()" [size]="14" />
      <span class="title">{{ title() }}</span>
      @if (actionable()) {
        <button type="button" class="action" [attr.aria-label]="title()" (click)="action.emit()">
          <lsms-icon [name]="actionIcon()" [size]="15" />
        </button>
      } @else {
        <lsms-icon [name]="actionIcon()" [size]="15" />
      }
    </div>
    <div class="body"><ng-content /></div>
  `,
  host: { '[style.--band]': 'band()' },
  styles: `
    @use 'typography' as t;
    :host {
      --band: var(--c-bg);
      display: flex;
      flex-direction: column;
      min-width: 0;
      height: 100%;
      overflow: hidden;
      border-radius: 12px;
      background: var(--band);
      border: 0.5px solid var(--c-border);
    }
    .header {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 7px 12px 6px 14px;
      color: var(--c-text-2);
    }
    .title { @include t.metric-label; @include t.ellipsis; flex: 1; letter-spacing: 0; }
    .action {
      display: inline-flex; padding: 0; border: 0; border-radius: 4px;
      background: none; color: inherit; cursor: pointer;
    }
    .action:hover { color: var(--c-primary); }
    .body {
      flex: 1;
      min-height: 0;
      display: flex;
      flex-direction: column;
      padding: 14px 16px;
      background: var(--c-surface);
      border-top: 0.5px solid var(--c-divider);
      border-radius: 11px 11px 0 0;
    }
  `,
})
export class DashboardCard {
  readonly icon = input.required<string>();
  readonly title = input.required<string>();
  /** `more_horiz` for KPI tiles, `open_in_full` for chart cards. */
  readonly actionIcon = input('more_horiz');
  /** Make the action icon a button that emits `action`. */
  readonly actionable = input(false);
  /** Per-card header tint (CSS colour). */
  readonly accentColor = input<string | undefined>(undefined);
  readonly action = output<void>();

  protected readonly band = computed(() => {
    const accent = this.accentColor();
    return accent ? `color-mix(in srgb, ${accent} 12%, var(--c-surface))` : 'var(--c-bg)';
  });
}

/** Up/down trend pill — green for up, red for down (port of `TrendBadge`). */
@Component({
  selector: 'lsms-trend-badge',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<lsms-icon [name]="isUp() ? 'arrow_upward' : 'arrow_downward'" [size]="12" />{{ text() }}`,
  host: { '[class.down]': '!isUp()' },
  styles: `
    @use 'typography' as t;
    :host {
      --fg: var(--c-success);
      display: inline-flex; align-items: center; gap: 3px;
      padding: 3px 8px; border-radius: 20px;
      color: var(--fg);
      background: color-mix(in srgb, var(--fg) 12%, transparent);
      @include t.badge-label;
      white-space: nowrap;
    }
    :host(.down) { --fg: var(--c-error); }
  `,
})
export class TrendBadge {
  readonly text = input.required<string>();
  readonly isUp = input(true);
}

export type TrendDirection = 'up' | 'down' | 'neutral' | 'warning';

/** KPI trend pill with 4 directions (port of `kpiTrendBadge`). */
@Component({
  selector: 'lsms-kpi-trend',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<lsms-icon [name]="icon()" [size]="12" />{{ label() }}`,
  host: { '[attr.data-dir]': 'direction()' },
  styles: `
    :host {
      display: inline-flex; align-items: center; gap: 3px;
      padding: 3px 8px; border-radius: 20px;
      font-size: 0.7rem; font-weight: 500; white-space: nowrap;
      color: var(--c-success); background: color-mix(in srgb, currentColor 12%, transparent);
    }
    :host([data-dir='down']) { color: var(--c-error); }
    :host([data-dir='warning']) { color: var(--c-warning); }
    :host([data-dir='neutral']) { color: var(--c-text-2); }
  `,
})
export class KpiTrend {
  readonly label = input.required<string>();
  readonly direction = input<TrendDirection>('up');
  protected readonly icon = computed(
    () =>
      ({ up: 'arrow_upward', down: 'arrow_downward', warning: 'arrow_upward', neutral: 'remove' })[
        this.direction()
      ],
  );
}
