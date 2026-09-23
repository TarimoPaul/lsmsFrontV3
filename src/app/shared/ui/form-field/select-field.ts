import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ControlValueAccessor, NgControl } from '@angular/forms';

import { LanguageService } from '../../../core/i18n/language.service';
import { formErrorMessage } from '../../forms/validators';
import { Icon } from '../icon/icon';

export interface SelectOption<T = string> {
  value: T;
  label: string;
  disabled?: boolean;
}

let nextId = 0;

/**
 * Labelled dropdown on a native <select> (best mobile UX, fully accessible),
 * styled like the text field — Flutter `DropdownButtonFormField` with
 * `isExpanded: true`. Works with Reactive Forms or standalone via
 * `[value]` / `(valueChange)`.
 *
 *   <lsms-select-field label="Category" [options]="categories()" formControlName="categoryUid" />
 *
 * `emptyLabel` adds a first option whose value is `null` ("All …" / "Select…").
 */
@Component({
  selector: 'lsms-select-field',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (label()) {
      <label class="label" [for]="id">
        {{ label() }}
        @if (required()) {
          <span class="req">*</span>
        }
      </label>
    }
    <div class="control" [class.dense]="dense()">
      @if (prefixIcon()) {
        <lsms-icon class="affix-icon" [name]="prefixIcon()!" [size]="18" />
      }
      <select
        [id]="id"
        [disabled]="disabled()"
        [attr.aria-label]="label() ? null : (ariaLabel() ?? null)"
        [attr.aria-invalid]="!!errorMessage()"
        (change)="onSelect($any($event.target).selectedIndex)"
        (focus)="focused.set(true)"
        (blur)="onBlur()"
      >
        @if (emptyLabel() !== undefined) {
          <option [selected]="selectedIndex() === -1">{{ emptyLabel() }}</option>
        }
        @for (o of options(); track $index) {
          <option [disabled]="!!o.disabled" [selected]="selectedIndex() === $index">{{ o.label }}</option>
        }
      </select>
      <lsms-icon class="chevron" name="expand_more" [size]="20" />
    </div>
    @if (errorMessage()) {
      <div class="msg"><span class="error">{{ errorMessage() }}</span></div>
    } @else if (hint()) {
      <div class="msg"><span class="hint">{{ hint() }}</span></div>
    }
  `,
  styleUrl: './form-field.scss',
  host: {
    '[class.invalid]': '!!errorMessage()',
    '[class.disabled]': 'disabled()',
    '[class.focused]': 'focused()',
  },
})
export class SelectField<T = string> implements ControlValueAccessor {
  private readonly i18n = inject(LanguageService);
  private readonly ngControl = inject(NgControl, { self: true, optional: true });
  private readonly destroyRef = inject(DestroyRef);

  readonly label = input('');
  readonly options = input.required<SelectOption<T>[]>();
  /** Accessible name when no visible label is shown. */
  readonly ariaLabel = input<string | undefined>(undefined);
  readonly emptyLabel = input<string | undefined>(undefined);
  readonly prefixIcon = input<string | undefined>(undefined);
  readonly hint = input<string | undefined>(undefined);
  readonly required = input(false);
  readonly dense = input(false);
  /** Standalone (non-form) usage. */
  readonly value = input<T | null | undefined>(undefined);
  readonly valueChange = output<T | null>();

  protected readonly id = `lsms-sf-${nextId++}`;
  protected readonly disabled = signal(false);
  protected readonly focused = signal(false);
  private readonly current = signal<T | null | undefined>(undefined);
  private readonly statusTick = signal(0);

  protected readonly selectedIndex = computed(() => {
    const v = this.current() !== undefined ? this.current() : this.value();
    return this.options().findIndex((o) => o.value === v);
  });

  protected readonly errorMessage = computed(() => {
    this.statusTick();
    const c = this.ngControl?.control;
    if (!c || !c.invalid || !c.touched) return null;
    return formErrorMessage(c.errors, this.i18n.lang(), this.label() || 'Field');
  });

  private onChange: (v: T | null) => void = () => {};
  private onTouched: () => void = () => {};

  constructor() {
    if (this.ngControl) this.ngControl.valueAccessor = this;
  }

  ngOnInit(): void {
    this.ngControl?.control?.events
      ?.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.statusTick.update((n) => n + 1));
  }

  writeValue(v: T | null): void {
    this.current.set(v);
  }
  registerOnChange(fn: (v: T | null) => void): void {
    this.onChange = fn;
  }
  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }
  setDisabledState(d: boolean): void {
    this.disabled.set(d);
  }

  protected onSelect(domIndex: number): void {
    const idx = this.emptyLabel() !== undefined ? domIndex - 1 : domIndex;
    const v = idx < 0 ? null : this.options()[idx].value;
    this.current.set(v);
    this.onChange(v);
    this.valueChange.emit(v);
  }

  protected onBlur(): void {
    this.focused.set(false);
    this.onTouched();
    this.statusTick.update((n) => n + 1);
  }
}
