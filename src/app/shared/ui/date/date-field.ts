import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ControlValueAccessor, NgControl } from '@angular/forms';

import { LanguageService } from '../../../core/i18n/language.service';
import { formErrorMessage } from '../../forms/validators';
import { DateRange, addDays, dayOnly, formatLongDate } from '../../utils/date-utils';
import { DialogService } from '../dialog/dialog.service';
import { Icon } from '../icon/icon';
import { DatePickerDialog, DatePickerDialogData } from './date-picker-dialog';

let nextId = 0;

/**
 * Single-date form field — port of `UniversalDatePicker(FormField)`.
 * Value is a `Date` (day precision) or null. `min` should be the business
 * start date (DateConstraintsService, wired with the business-setup module);
 * `maxDaysInFuture` extends the max beyond today.
 *
 *   <lsms-date-field label="Sale date" formControlName="saleDate" [min]="businessStart()" />
 */
@Component({
  selector: 'lsms-date-field',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <label class="label" [for]="id">
      {{ label() ?? i18n.t('Date', 'Tarehe') }}
      @if (required()) {
        <span class="req">*</span>
      }
    </label>
    <div class="control" [class.dense]="dense()">
      <lsms-icon class="affix-icon" [name]="prefixIcon()" [size]="18" />
      <button
        type="button"
        class="picker"
        [id]="id"
        [disabled]="disabled()"
        [attr.aria-invalid]="!!errorMessage()"
        (click)="open()"
      >
        @if (value()) {
          <span>{{ display() }}</span>
        } @else {
          <span class="placeholder">{{ placeholder() ?? i18n.t('Choose date', 'Chagua tarehe') }}</span>
        }
      </button>
      @if (showToday() && !disabled()) {
        <button type="button" class="affix-btn" [title]="i18n.t('Today', 'Leo')" [attr.aria-label]="i18n.t('Today', 'Leo')" (click)="set(today())">
          <lsms-icon name="today" [size]="18" />
        </button>
      }
      @if (clearable() && value() && !disabled()) {
        <button type="button" class="affix-btn" [attr.aria-label]="i18n.t('Clear', 'Futa')" (click)="set(null)">
          <lsms-icon name="close" [size]="16" />
        </button>
      }
    </div>
    @if (errorMessage()) {
      <div class="msg"><span class="error">{{ errorMessage() }}</span></div>
    } @else if (hint()) {
      <div class="msg"><span class="hint">{{ hint() }}</span></div>
    }
  `,
  styleUrl: '../form-field/form-field.scss',
  styles: `
    .picker {
      flex: 1; min-width: 0; height: 46px; padding: 0;
      border: 0; background: none; text-align: left; cursor: pointer;
      font-size: 0.875rem; color: var(--c-text);
    }
    .dense .picker { height: 38px; }
    .picker:disabled { cursor: not-allowed; }
    .placeholder { color: var(--c-text-2); opacity: 0.7; }
  `,
  host: { '[class.invalid]': '!!errorMessage()', '[class.disabled]': 'disabled()' },
})
export class DateField implements ControlValueAccessor {
  protected readonly i18n = inject(LanguageService);
  private readonly dialogs = inject(DialogService);
  private readonly ngControl = inject(NgControl, { self: true, optional: true });
  private readonly destroyRef = inject(DestroyRef);

  readonly label = input<string | undefined>(undefined);
  readonly placeholder = input<string | undefined>(undefined);
  readonly hint = input<string | undefined>(undefined);
  readonly prefixIcon = input('calendar_today');
  readonly required = input(false);
  readonly clearable = input(false);
  readonly showToday = input(false);
  readonly dense = input(false);
  readonly min = input<Date | undefined>(undefined);
  readonly max = input<Date | undefined>(undefined);
  readonly maxDaysInFuture = input<number | undefined>(undefined);

  protected readonly id = `lsms-df-${nextId++}`;
  protected readonly value = signal<Date | null>(null);
  protected readonly disabled = signal(false);
  private readonly tick = signal(0);

  protected readonly display = computed(() => (this.value() ? formatLongDate(this.value()!) : ''));
  protected readonly effectiveMax = computed(() => {
    if (this.max()) return this.max()!;
    const days = this.maxDaysInFuture();
    return days && days > 0 ? addDays(new Date(), days) : new Date();
  });
  protected readonly errorMessage = computed(() => {
    this.tick();
    const c = this.ngControl?.control;
    if (!c || !c.invalid || !c.touched) return null;
    return formErrorMessage(c.errors, this.i18n.lang(), this.label() ?? 'Date');
  });

  private onChange: (v: Date | null) => void = () => {};
  private onTouched: () => void = () => {};

  constructor() {
    if (this.ngControl) this.ngControl.valueAccessor = this;
  }

  ngOnInit(): void {
    this.ngControl?.control?.events
      ?.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.tick.update((n) => n + 1));
  }

  writeValue(v: Date | string | null): void {
    this.value.set(v ? dayOnly(new Date(v)) : null);
  }
  registerOnChange(fn: (v: Date | null) => void): void {
    this.onChange = fn;
  }
  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }
  setDisabledState(d: boolean): void {
    this.disabled.set(d);
  }

  protected today(): Date {
    return dayOnly(new Date());
  }

  protected set(d: Date | null): void {
    this.value.set(d);
    this.onChange(d);
    this.onTouched();
  }

  protected async open(): Promise<void> {
    const picked = await this.dialogs.openAsync<DateRange, DatePickerDialogData>(DatePickerDialog, {
      size: 'sm',
      data: {
        mode: 'single',
        start: this.value() ?? new Date(),
        min: this.min() ?? addDays(new Date(), -365 * 5),
        max: this.effectiveMax(),
        helpText: this.i18n.t('Select Date', 'Chagua Tarehe'),
      },
    });
    if (picked) this.set(dayOnly(picked.start));
    else this.onTouched();
  }
}
