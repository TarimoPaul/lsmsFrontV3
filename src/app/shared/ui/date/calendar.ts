import { ChangeDetectionStrategy, Component, computed, inject, input, model, signal } from '@angular/core';

import { LanguageService } from '../../../core/i18n/language.service';
import { dayOnly, formatMonthYear } from '../../utils/date-utils';
import { IconButton } from '../button/icon-button';
import { Icon } from '../icon/icon';

const WEEKDAYS = {
  sw: ['Jtt', 'Jnn', 'Jtn', 'Alh', 'Ijm', 'Jms', 'Jpl'],
  en: ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'],
};

interface DayCell {
  date: Date;
  day: number;
  selectable: boolean;
  inRange: boolean;
  edge: boolean;
  today: boolean;
}

/**
 * Inline month calendar — the grid from Flutter `CompactRangePickerDialog`:
 * Monday-first, `‹ ›` month arrows, and a tappable "Month Year" header that
 * opens a year grid to jump to any year.
 *
 * `mode="range"`: first tap starts a range, second tap closes it; tapping
 * after a complete range starts a new one. `mode="single"`: `start === end`.
 */
@Component({
  selector: 'lsms-calendar',
  imports: [Icon, IconButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './calendar.html',
  styleUrl: './calendar.scss',
})
export class Calendar {
  protected readonly i18n = inject(LanguageService);

  readonly mode = input<'range' | 'single'>('range');
  readonly min = input<Date>(new Date(2000, 0, 1));
  readonly max = input<Date>(new Date());
  readonly start = model<Date>(dayOnly(new Date()));
  readonly end = model<Date>(dayOnly(new Date()));

  protected readonly showYears = signal(false);
  protected readonly visibleMonth = signal(new Date(new Date().getFullYear(), new Date().getMonth(), 1));

  protected readonly weekdays = computed(() => WEEKDAYS[this.i18n.lang()]);
  protected readonly monthLabel = computed(() => formatMonthYear(this.visibleMonth()));

  protected readonly canPrev = computed(() => {
    const m = this.visibleMonth();
    const min = this.min();
    return m > new Date(min.getFullYear(), min.getMonth(), 1);
  });
  protected readonly canNext = computed(() => {
    const m = this.visibleMonth();
    const max = this.max();
    return m < new Date(max.getFullYear(), max.getMonth(), 1);
  });

  protected readonly years = computed(() => {
    const out: number[] = [];
    for (let y = this.max().getFullYear(); y >= this.min().getFullYear(); y--) out.push(y);
    return out;
  });

  protected readonly leadingBlanks = computed(() => {
    const first = this.visibleMonth();
    return Array.from({ length: (first.getDay() + 6) % 7 });
  });

  protected readonly days = computed<DayCell[]>(() => {
    const m = this.visibleMonth();
    const count = new Date(m.getFullYear(), m.getMonth() + 1, 0).getDate();
    const min = dayOnly(this.min()).getTime();
    const max = dayOnly(this.max()).getTime();
    const s = dayOnly(this.start()).getTime();
    const e = dayOnly(this.end()).getTime();
    const today = dayOnly(new Date()).getTime();
    return Array.from({ length: count }, (_, i) => {
      const date = new Date(m.getFullYear(), m.getMonth(), i + 1);
      const t = date.getTime();
      const selectable = t >= min && t <= max;
      return {
        date,
        day: i + 1,
        selectable,
        inRange: selectable && t >= s && t <= e,
        edge: t === s || t === e,
        today: t === today,
      };
    });
  });

  ngOnInit(): void {
    const e = this.end();
    this.visibleMonth.set(new Date(e.getFullYear(), e.getMonth(), 1));
  }

  protected prevMonth(): void {
    if (!this.canPrev()) return;
    const m = this.visibleMonth();
    this.visibleMonth.set(new Date(m.getFullYear(), m.getMonth() - 1, 1));
  }

  protected nextMonth(): void {
    if (!this.canNext()) return;
    const m = this.visibleMonth();
    this.visibleMonth.set(new Date(m.getFullYear(), m.getMonth() + 1, 1));
  }

  protected pickYear(y: number): void {
    this.visibleMonth.set(new Date(y, this.visibleMonth().getMonth(), 1));
    this.showYears.set(false);
  }

  protected pickDay(cell: DayCell): void {
    if (!cell.selectable) return;
    const day = cell.date;
    if (this.mode() === 'single') {
      this.start.set(day);
      this.end.set(day);
      return;
    }
    const s = dayOnly(this.start()).getTime();
    const e = dayOnly(this.end()).getTime();
    if (s !== e) {
      // A complete range exists — start fresh.
      this.start.set(day);
      this.end.set(day);
    } else if (day.getTime() < s) {
      this.start.set(day);
    } else {
      this.end.set(day);
    }
  }
}
