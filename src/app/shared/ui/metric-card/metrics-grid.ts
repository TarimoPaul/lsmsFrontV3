import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Responsive grid for `lsms-metric-card`s — same rhythm as the Sales KPI row
 * (`lsms-dashboard-kpi-row`): 2 columns, 4 from 700px, rows at least 110px.
 * Uses container queries so it reflows by its own width, not the viewport.
 */
@Component({
  selector: 'lsms-metrics-grid',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div class="grid"><ng-content /></div>`,
  host: { '[style.--gap.px]': 'gap()' },
  styles: `
    :host { display: block; container-type: inline-size; }
    .grid { display: grid; gap: min(var(--gap, 10px), 10px); grid-template-columns: repeat(2, minmax(0, 1fr)); grid-auto-rows: minmax(110px, auto); }
    @container (min-width: 600px) { .grid { gap: var(--gap, 12px); } }
    @container (min-width: 700px) { .grid { grid-template-columns: repeat(4, minmax(0, 1fr)); } }
  `,
})
export class MetricsGrid {
  readonly gap = input(12);
}
