import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

import { DashboardCard } from '../dashboard/dashboard-card';
import { CountUpText } from '../motion/count-up';

export interface MetricBreakdown {
  label: string;
  value: string;
}

/**
 * KPI tile — one look across the whole app: the Sales KPI tile style
 * (`lsms-dashboard-kpi-card`): header strip tinted with `color` holding the
 * icon + title, then a big value and an optional subtitle. `urgent` swaps the
 * header action for a warning icon, colours the value and rings the tile.
 * `breakdown` renders 1–2 extra columns (e.g. Mapato | Reja reja | Jumla).
 */
@Component({
  selector: 'lsms-metric-card',
  imports: [DashboardCard, CountUpText],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './metric-card.html',
  styleUrl: './metric-card.scss',
  host: {
    '[style.--accent]': 'color()',
    '[class.urgent]': 'urgent()',
    '[class.clickable]': 'clickable()',
    '[attr.role]': "clickable() ? 'button' : null",
    '[attr.tabindex]': 'clickable() ? 0 : null',
    '(click)': 'clickable() && tap.emit()',
    '(keydown.enter)': 'clickable() && tap.emit()',
  },
})
export class MetricCard {
  readonly title = input.required<string>();
  readonly value = input.required<string>();
  readonly subtitle = input<string | undefined>(undefined);
  readonly icon = input.required<string>();
  /** Accent (CSS colour or var), e.g. `var(--c-success)`. */
  readonly color = input('var(--c-primary)');
  readonly urgent = input(false);
  readonly clickable = input(false);
  readonly breakdown = input<MetricBreakdown[] | undefined>(undefined);
  readonly tap = output<void>();
}
