import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

import { DashboardCard } from './dashboard-card';

/**
 * KPI tile for a dashboard's primary stat row — port of `DashboardKpiCard`.
 * Big value + optional subtitle + trend slot, inside `lsms-dashboard-card`.
 * Project a trend badge with `<lsms-kpi-trend kpiTrend …/>` and an optional
 * right-side block with `[kpiTrailing]`.
 */
@Component({
  selector: 'lsms-dashboard-kpi-card',
  imports: [DashboardCard],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <lsms-dashboard-card [icon]="icon()" [title]="title()" [accentColor]="accentColor()">
      <div class="row">
        <div class="main">
          <span class="value" [class.hero]="hero()" [style.color]="valueColor()">{{ value() }}</span>
          @if (subtitle()) {
            <span class="subtitle">{{ subtitle() }}</span>
          }
          <div class="trend"><ng-content select="[kpiTrend]" /></div>
        </div>
        <ng-content select="[kpiTrailing]" />
      </div>
    </lsms-dashboard-card>
  `,
  host: {
    '[class.hero]': 'hero()',
    '[class.clickable]': 'clickable()',
    '[attr.role]': "clickable() ? 'button' : null",
    '[attr.tabindex]': 'clickable() ? 0 : null',
    '(click)': 'clickable() && tap.emit()',
    '(keydown.enter)': 'clickable() && tap.emit()',
  },
  styles: `
    @use 'typography' as t;
    :host { display: block; min-width: 0; height: 100%; border-radius: 12px; }
    :host(.hero) { box-shadow: 0 0 0 1.5px #64b5f6; }
    :host(.clickable) { cursor: pointer; }
    .row { display: flex; align-items: center; gap: 8px; height: 100%; }
    .main { flex: 1; min-width: 0; display: flex; flex-direction: column; justify-content: center; }
    .value { @include t.h3; @include t.ellipsis; color: var(--c-text); }
    .value.hero { font-size: 1.375rem; }
    .subtitle { @include t.caption; margin-top: 4px; color: var(--c-text-2); display: -webkit-box; -webkit-line-clamp: 2; line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
    .trend:not(:empty) { margin-top: 8px; }
  `,
})
export class DashboardKpiCard {
  readonly icon = input.required<string>();
  readonly title = input.required<string>();
  readonly value = input.required<string>();
  readonly subtitle = input<string | undefined>(undefined);
  readonly valueColor = input<string | undefined>(undefined);
  readonly accentColor = input<string | undefined>(undefined);
  /** Primary metric of the row: blue ring + slightly larger value. */
  readonly hero = input(false);
  readonly clickable = input(false);
  readonly tap = output<void>();
}

/**
 * The top KPI row — port of `DashboardKpiRow`: 4 columns in one short row
 * when ≥700px wide, 2×2 below that. Gap 12 (10 on narrow).
 */
@Component({
  selector: 'lsms-dashboard-kpi-row',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div class="grid"><ng-content /></div>`,
  styles: `
    :host { display: block; container-type: inline-size; }
    .grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      grid-auto-rows: minmax(110px, auto);
      gap: 10px;
    }
    @container (min-width: 600px) { .grid { gap: 12px; } }
    @container (min-width: 700px) { .grid { grid-template-columns: repeat(4, minmax(0, 1fr)); } }
  `,
})
export class DashboardKpiRow {}

/**
 * "Today" section — port of `DashboardTodaySection`.
 * Desktop/tablet (≥600): revenue (flex 16) | column of budget + peak (flex 10)
 * at `desktopHeight`. Mobile: stacked with fixed per-card heights.
 * Slots: `[todayRevenue]`, `[todayBudget]` (optional), `[todayPeak]`.
 */
@Component({
  selector: 'lsms-dashboard-today-section',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="wrap">
      <div class="revenue"><ng-content select="[todayRevenue]" /></div>
      <div class="side">
        <div class="budget"><ng-content select="[todayBudget]" /></div>
        <div class="peak"><ng-content select="[todayPeak]" /></div>
      </div>
    </div>
  `,
  host: { '[style.--desktop-h.px]': 'desktopHeight()' },
  styles: `
    :host { display: block; container-type: inline-size; }
    .wrap { display: flex; flex-direction: column; gap: 10px; }
    .side { display: flex; flex-direction: column; gap: 10px; }
    .revenue { height: 320px; }
    .budget { height: 150px; }
    .peak { height: 200px; }
    .budget:empty { display: none; }
    @container (min-width: 600px) {
      .wrap { flex-direction: row; gap: 12px; height: var(--desktop-h, 340px); }
      .revenue { flex: 16; height: auto; min-width: 0; }
      .side { flex: 10; gap: 12px; min-width: 0; }
      .budget, .peak { flex: 1; height: auto; min-height: 0; }
    }
  `,
})
export class DashboardTodaySection {
  readonly desktopHeight = input(340);
}
