import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';

import { LanguageService } from '../../../core/i18n/language.service';
import { DateRange, dayOnly, endOfDay, formatDayMonthYear, formatLongDate } from '../../utils/date-utils';
import { Button } from '../button/button';
import { Calendar } from './calendar';

export interface DatePickerDialogData {
  mode: 'range' | 'single';
  start?: Date;
  end?: Date;
  min?: Date;
  max?: Date;
  helpText?: string;
  confirmText?: string;
  cancelText?: string;
}

/**
 * Small (non full-screen) date / date-range picker dialog — port of
 * `showCompactDateRangePicker`. Closes with a `DateRange` (end normalised to
 * 23:59:59; `start === end` day in single mode) or `undefined` if cancelled.
 * Initial values are clamped into [min, max] so it never opens invalid.
 */
@Component({
  selector: 'lsms-date-picker-dialog',
  imports: [Calendar, Button],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (data.helpText) {
      <span class="help">{{ data.helpText }}</span>
    }
    <span class="summary">{{ summary() }}</span>
    <lsms-calendar
      [mode]="data.mode"
      [min]="min"
      [max]="max"
      [(start)]="start"
      [(end)]="end"
    />
    <div class="actions">
      <button lsmsButton="text" (click)="ref.close()">{{ data.cancelText ?? i18n.t('Cancel', 'Ghairi') }}</button>
      <button lsmsButton size="sm" (click)="confirm()">{{ data.confirmText ?? i18n.t('OK', 'Sawa') }}</button>
    </div>
  `,
  styles: `
    @use 'typography' as t;
    :host { display: flex; flex-direction: column; padding: 16px 16px 8px; }
    .help { @include t.badge-label-compact; color: var(--c-text-2); margin-bottom: 6px; }
    .summary { @include t.body; font-weight: 700; color: var(--c-primary); margin-bottom: 8px; }
    .actions {
      display: flex; justify-content: flex-end; gap: 8px;
      margin-top: 8px; padding-top: 8px; border-top: 1px solid var(--c-divider);
    }
  `,
})
export class DatePickerDialog {
  protected readonly i18n = inject(LanguageService);
  protected readonly data = inject<DatePickerDialogData>(DIALOG_DATA);
  protected readonly ref = inject<DialogRef<DateRange>>(DialogRef);

  protected readonly min = dayOnly(this.data.min ?? new Date(2000, 0, 1));
  protected readonly max = dayOnly(this.data.max ?? new Date());
  protected readonly start = signal(this.clamp(this.data.start ?? new Date()));
  protected readonly end = signal(this.clamp(this.data.end ?? this.data.start ?? new Date(), this.start()));

  protected readonly summary = computed(() =>
    this.data.mode === 'single'
      ? formatLongDate(this.start())
      : `${formatDayMonthYear(this.start())}  –  ${formatDayMonthYear(this.end())}`,
  );

  protected confirm(): void {
    this.ref.close({ start: dayOnly(this.start()), end: endOfDay(this.end()) });
  }

  private clamp(d: Date, floor?: Date): Date {
    let v = dayOnly(d);
    if (v < this.min) v = this.min;
    if (v > this.max) v = this.max;
    if (floor && v < floor) v = floor;
    return v;
  }
}
