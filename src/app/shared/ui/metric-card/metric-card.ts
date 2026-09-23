import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  inject,
  input,
  output,
  signal,
} from '@angular/core';

import { Icon } from '../icon/icon';

export interface MetricBreakdown {
  label: string;
  value: string;
}

/**
 * KPI tile in the app's signature style — port of Flutter `MetricCard`.
 * Soft card with a coloured left band + circular icon, bold value, optional
 * subtitle, and a top-left accent glow. Switches to a centred compact layout
 * when narrower than 110px. `urgent` tints the frame with the accent colour.
 * `breakdown` renders 1–2 extra columns (e.g. Mapato | Reja reja | Jumla).
 */
@Component({
  selector: 'lsms-metric-card',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './metric-card.html',
  styleUrl: './metric-card.scss',
  host: {
    '[style.--accent]': 'color()',
    '[class.urgent]': 'urgent()',
    '[class.compact]': 'compact()',
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

  protected readonly compact = signal(false);

  constructor() {
    const el = inject(ElementRef<HTMLElement>).nativeElement as HTMLElement;
    const ro = new ResizeObserver(([entry]) => this.compact.set(entry.contentRect.width < 110));
    afterNextRender(() => ro.observe(el));
    inject(DestroyRef).onDestroy(() => ro.disconnect());
  }
}
