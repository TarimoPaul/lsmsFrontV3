import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Responsive grid for `lsms-metric-card`s — port of Flutter `MetricsGrid`:
 * 2 columns on phones, 3 on tablets (≥768), 4 on desktop (≥1200).
 * Uses container queries so it reflows by its own width, not the viewport.
 */
@Component({
  selector: 'lsms-metrics-grid',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div class="grid"><ng-content /></div>`,
  host: { '[style.--gap.px]': 'gap()' },
  styles: `
    :host { display: block; container-type: inline-size; }
    .grid { display: grid; gap: var(--gap, 8px); grid-template-columns: repeat(2, minmax(0, 1fr)); }
    @container (min-width: 768px) { .grid { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
    @container (min-width: 1200px) { .grid { grid-template-columns: repeat(4, minmax(0, 1fr)); } }
  `,
})
export class MetricsGrid {
  readonly gap = input(8);
}
