import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

import { Icon } from '../icon/icon';
import { DashboardCard, TrendBadge } from './dashboard-card';

/**
 * Two-series comparison bars (today gradient bars in front of a faint
 * yesterday underlay) with sparse x-axis labels. Pure CSS — flexes to width,
 * never scrolls (port of `_ComparisonBars` / `_MiniBars`).
 */
@Component({
  selector: 'lsms-comparison-bars',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="bars">
      @for (b of bars(); track $index) {
        <div class="slot" [title]="b.label">
          @if (b.y !== null) {
            <div class="bar under" [style.height.%]="b.y"></div>
          }
          <div class="bar main" [style.height.%]="b.t"></div>
        </div>
      }
    </div>
    @if (showLabels()) {
      <div class="labels">
        @for (b of bars(); track $index) {
          <span>{{ b.showLabel ? b.label : '' }}</span>
        }
      </div>
    }
  `,
  styles: `
    @use 'typography' as t;
    :host { display: flex; flex-direction: column; flex: 1; min-height: 0; }
    .bars { flex: 1; min-height: 0; display: flex; align-items: flex-end; }
    .slot { position: relative; flex: 1; height: 100%; margin: 0 2px; }
    .bar { position: absolute; bottom: 0; left: 50%; transform: translateX(-50%); border-radius: 2px 2px 0 0; }
    .under { width: 72%; background: var(--c-border); }
    .main {
      width: 92%;
      background: linear-gradient(
        180deg,
        color-mix(in srgb, var(--c-text-2) 42%, transparent),
        color-mix(in srgb, var(--c-text-2) 5%, transparent)
      );
    }
    .labels { display: flex; margin-top: 6px; }
    .labels span {
      flex: 1; text-align: center; overflow: hidden; white-space: nowrap;
      @include t.metric-caption-compact; color: var(--c-text-2);
    }
  `,
})
export class ComparisonBars {
  readonly primary = input.required<number[]>();
  readonly secondary = input<number[]>([]);
  readonly labels = input<string[]>([]);
  /** Render an x-axis label only every Nth bar. */
  readonly labelEvery = input(2);
  readonly showLabels = input(true);
  /** Minimum visible height (%) for zero values; 0 hides them. */
  readonly minHeight = input(0);

  protected readonly bars = computed(() => {
    const p = this.primary();
    const s = this.secondary();
    const max = Math.max(1e-9, ...p, ...s);
    const min = this.minHeight();
    return p.map((v, i) => ({
      t: Math.max(min, Math.min(100, (v / max) * 100)),
      y: i < s.length ? Math.min(100, (s[i] / max) * 100) : null,
      label: this.labels()[i] ?? '',
      showLabel: i % this.labelEvery() === 0,
    }));
  });
}

/**
 * Gross Revenue card — hourly bar chart with optional today-vs-yesterday
 * comparison (headline figures + trend badge). Port of `DashboardRevenueCard`.
 * Callers pass already-formatted strings and raw series.
 */
@Component({
  selector: 'lsms-dashboard-revenue-card',
  imports: [DashboardCard, TrendBadge, ComparisonBars],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <lsms-dashboard-card
      icon="show_chart"
      [title]="title()"
      actionIcon="open_in_full"
      [actionable]="true"
      [accentColor]="accentColor()"
      (action)="action.emit()"
    >
      <div class="legend">
        <div class="blocks">
          <div class="block">
            <span class="key"><i class="dot today"></i>{{ todayLabel() }}</span>
            <span class="figure">{{ todayValueText() }}</span>
          </div>
          @if (yesterdayLabel() && yesterdayValueText()) {
            <div class="block">
              <span class="key"><i class="dot"></i>{{ yesterdayLabel() }}</span>
              <span class="figure">{{ yesterdayValueText() }}</span>
            </div>
          }
        </div>
        @if (changeText()) {
          <lsms-trend-badge [text]="changeText()!" [isUp]="isUp()" />
        }
      </div>
      <lsms-comparison-bars
        [primary]="todaySeries()"
        [secondary]="yesterdaySeries()"
        [labels]="barLabels()"
        [labelEvery]="labelEvery()"
      />
    </lsms-dashboard-card>
  `,
  styles: `
    @use 'typography' as t;
    :host { display: block; height: 100%; min-width: 0; }
    .legend { display: flex; align-items: flex-start; gap: 8px; margin-bottom: 14px; }
    .blocks { flex: 1; min-width: 0; display: flex; gap: 12px; }
    .block { min-width: 0; display: flex; flex-direction: column; gap: 4px; }
    .key { display: flex; align-items: center; gap: 6px; @include t.caption; color: var(--c-text-2); }
    .dot { width: 7px; height: 7px; border-radius: 50%; background: var(--c-border); flex-shrink: 0; }
    .dot.today { background: var(--c-text-2); }
    .figure { @include t.dashboard-title; @include t.ellipsis; color: var(--c-text); }
  `,
})
export class DashboardRevenueCard {
  readonly title = input('Gross Revenue');
  readonly todayLabel = input.required<string>();
  readonly yesterdayLabel = input<string | undefined>(undefined);
  readonly todayValueText = input.required<string>();
  readonly yesterdayValueText = input<string | undefined>(undefined);
  /** e.g. "17.0%". Omit for single-series mode. */
  readonly changeText = input<string | undefined>(undefined);
  readonly isUp = input(true);
  readonly todaySeries = input.required<number[]>();
  readonly yesterdaySeries = input<number[]>([]);
  readonly barLabels = input.required<string[]>();
  readonly labelEvery = input(2);
  readonly accentColor = input<string | undefined>(undefined);
  readonly action = output<void>();
}

/** Peak-hours card — busiest window + mini bars + optional footer stats. */
@Component({
  selector: 'lsms-dashboard-peak-card',
  imports: [DashboardCard, ComparisonBars, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <lsms-dashboard-card
      icon="schedule"
      [title]="title()"
      actionIcon="open_in_full"
      [actionable]="true"
      [accentColor]="accentColor()"
      (action)="action.emit()"
    >
      <span class="window">{{ windowText() }}</span>
      <span class="sub">{{ subtitleText() }}</span>
      <lsms-comparison-bars [primary]="series()" [showLabels]="false" [minHeight]="2" class="mini" />
      @if (salesCountText() || revenueText()) {
        <div class="footer">
          @if (salesCountText()) {
            <span><lsms-icon name="receipt_long" [size]="12" />{{ salesCountText() }}</span>
          }
          @if (revenueText()) {
            <span><lsms-icon name="payments" [size]="12" />{{ revenueText() }}</span>
          }
        </div>
      }
    </lsms-dashboard-card>
  `,
  styles: `
    @use 'typography' as t;
    :host { display: block; height: 100%; min-width: 0; }
    .window { @include t.h4; font-weight: 600; color: var(--c-text); }
    .sub { @include t.caption; color: var(--c-text-2); margin: 4px 0 10px; }
    .mini { flex: 1; }
    .footer {
      display: flex; justify-content: space-between; gap: 8px;
      margin-top: 8px; padding-top: 8px;
      border-top: 1px solid color-mix(in srgb, var(--c-divider) 50%, transparent);
      font-size: 0.6875rem; color: var(--c-text-2);
    }
    .footer span { display: inline-flex; align-items: center; gap: 4px; min-width: 0; @include t.ellipsis; }
  `,
})
export class DashboardPeakCard {
  readonly title = input('Peak hours');
  /** e.g. "11 AM – 1 PM" */
  readonly windowText = input.required<string>();
  readonly subtitleText = input.required<string>();
  readonly series = input.required<number[]>();
  readonly salesCountText = input<string | undefined>(undefined);
  readonly revenueText = input<string | undefined>(undefined);
  readonly accentColor = input<string | undefined>(undefined);
  readonly action = output<void>();
}
