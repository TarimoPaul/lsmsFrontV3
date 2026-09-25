import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  computed,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ControlValueAccessor, NgControl } from '@angular/forms';

import { LanguageService } from '../../../core/i18n/language.service';
import { formErrorMessage } from '../../forms/validators';
import { Money } from '../../utils/money';
import { Icon } from '../icon/icon';

export type TextFieldType = 'text' | 'password' | 'email' | 'tel' | 'number' | 'currency' | 'textarea';

let nextId = 0;

/**
 * Labelled input — port of Flutter `CustomTextField` + `CustomInputFields`
 * (text / currency / multiline / password). Works with Reactive Forms and
 * renders the control's first validation error in the active language.
 *
 *   <lsms-text-field label="Product name" formControlName="name" prefixIcon="inventory_2" />
 *   <lsms-text-field label="Price" type="currency" formControlName="price" />
 *   <lsms-text-field label="Password" type="password" formControlName="password" />
 *   <lsms-text-field label="Notes" type="textarea" [rows]="3" [maxLength]="250" formControlName="notes" />
 *
 * `currency` emits a number (or null) and shows thousands separators on blur
 * with a "TZS" suffix (currency goes last, like Money.format). `number` emits a number (or null).
 */
@Component({
  selector: 'lsms-text-field',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './text-field.html',
  styleUrl: './form-field.scss',
  host: {
    '[class.invalid]': 'showError()',
    '[class.disabled]': 'disabled()',
    '[class.focused]': 'focused()',
  },
})
export class TextField implements ControlValueAccessor {
  protected readonly i18n = inject(LanguageService);
  private readonly ngControl = inject(NgControl, { self: true, optional: true });
  private readonly destroyRef = inject(DestroyRef);

  readonly label = input<string>('');
  readonly type = input<TextFieldType>('text');
  readonly placeholder = input<string>('');
  readonly hint = input<string | undefined>(undefined);
  /** Forces an error message regardless of control state. */
  readonly errorText = input<string | undefined>(undefined);
  readonly prefixIcon = input<string | undefined>(undefined);
  readonly prefixText = input<string | undefined>(undefined);
  readonly suffixText = input<string | undefined>(undefined);
  /** Shows the "*" marker. Validation itself comes from the form control. */
  readonly required = input(false);
  readonly clearable = input(false);
  readonly readonly = input(false);
  readonly maxLength = input<number | undefined>(undefined);
  readonly rows = input(3);
  readonly autocomplete = input<string | undefined>(undefined);
  readonly dense = input(false);
  readonly align = input<'start' | 'end'>('start');
  readonly autofocus = input(false);

  /** Standalone (non-form) usage: emits the parsed value on every change. */
  readonly valueChange = output<string>();
  readonly enter = output<void>();
  readonly blurred = output<void>();

  protected readonly id = `lsms-tf-${nextId++}`;
  protected readonly text = signal('');
  protected readonly disabled = signal(false);
  protected readonly focused = signal(false);
  protected readonly revealed = signal(false);
  private readonly touched = signal(false);
  /** Bumped on control events (touched/status/value) so `showError` recomputes (control isn't a signal). */
  private readonly statusTick = signal(0);

  protected readonly inputType = computed(() => {
    switch (this.type()) {
      case 'password':
        return this.revealed() ? 'text' : 'password';
      case 'currency':
      case 'number':
        return 'text';
      default:
        return this.type();
    }
  });
  protected readonly inputMode = computed(() =>
    this.type() === 'currency' || this.type() === 'number' ? 'decimal' : null,
  );
  protected readonly effectivePrefixText = computed(
    () => this.prefixText(),
  );
  protected readonly effectiveSuffixText = computed(
    () => this.suffixText() ?? (this.type() === 'currency' ? Money.currencyCode : undefined),
  );
  protected readonly effectivePrefixIcon = computed(
    () => this.prefixIcon() ?? (this.type() === 'password' ? 'lock' : undefined),
  );

  protected readonly errorMessage = computed(() => {
    this.statusTick();
    if (this.errorText()) return this.errorText()!;
    const c = this.ngControl?.control;
    if (!c || !c.invalid || !(c.touched || this.touched())) return null;
    return formErrorMessage(c.errors, this.i18n.lang(), this.label() || 'Field');
  });
  protected readonly showError = computed(() => !!this.errorMessage());

  private onChange: (v: unknown) => void = () => {};
  private onTouched: () => void = () => {};

  private readonly field = viewChild<ElementRef<HTMLInputElement | HTMLTextAreaElement>>('field');

  constructor() {
    if (this.ngControl) this.ngControl.valueAccessor = this;
    afterNextRender(() => {
      if (this.autofocus()) this.focus();
    });
  }

  /** Move keyboard focus into the field. */
  focus(): void {
    this.field()?.nativeElement.focus();
  }

  ngOnInit(): void {
    this.ngControl?.control?.events
      ?.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.statusTick.update((n) => n + 1));
  }

  writeValue(value: unknown): void {
    if (value === null || value === undefined) {
      this.text.set('');
    } else if (this.type() === 'currency' && typeof value === 'number') {
      this.text.set(Money.format(value, { symbol: false }));
    } else {
      this.text.set(String(value));
    }
  }

  registerOnChange(fn: (v: unknown) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled.set(isDisabled);
  }

  protected onInput(raw: string): void {
    this.text.set(raw);
    this.onChange(this.toModel(raw));
    this.valueChange.emit(raw);
  }

  protected onBlur(): void {
    this.focused.set(false);
    this.touched.set(true);
    if (this.type() === 'currency') {
      const n = Money.parse(this.text());
      if (n !== null) this.text.set(Money.format(n, { symbol: false }));
    }
    this.onTouched();
    this.statusTick.update((n) => n + 1);
    this.blurred.emit();
  }

  protected clear(): void {
    this.text.set('');
    this.onChange(this.toModel(''));
    this.valueChange.emit('');
  }

  private toModel(raw: string): unknown {
    const t = this.type();
    if (t === 'currency') return Money.parse(raw);
    if (t === 'number') {
      const clean = raw.replaceAll(',', '').trim();
      if (clean === '') return null;
      const n = Number(clean);
      return Number.isFinite(n) ? n : raw; // keep raw so the numeric validator can flag it
    }
    return raw;
  }
}
