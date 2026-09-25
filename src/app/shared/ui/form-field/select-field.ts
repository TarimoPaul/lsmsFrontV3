import { CdkConnectedOverlay, CdkOverlayOrigin, ConnectedPosition } from '@angular/cdk/overlay';
import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, computed, inject, input, output, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ControlValueAccessor, NgControl } from '@angular/forms';

import { LanguageService } from '../../../core/i18n/language.service';
import { formErrorMessage } from '../../forms/validators';
import { Icon } from '../icon/icon';

export interface SelectOption<T = string> {
  value: T;
  label: string;
  /** Leading icon in the list and the closed field. */
  icon?: string;
  /** Secondary text on the right (count, code …). */
  hint?: string;
  disabled?: boolean;
}

let nextId = 0;
const POSITIONS: ConnectedPosition[] = [
  { originX: 'start', originY: 'bottom', overlayX: 'start', overlayY: 'top', offsetY: 6 },
  { originX: 'start', originY: 'top', overlayX: 'start', overlayY: 'bottom', offsetY: -6 },
];
/** Lists longer than this get a search box. */
const SEARCH_AFTER = 8;

/**
 * Labelled dropdown — port of Flutter `DropdownButtonFormField` with a custom
 * panel (CDK overlay) instead of the browser's native list: selected check,
 * icons / hints, hover + keyboard highlight, type-ahead, and a search box for
 * long lists. Works with Reactive Forms or standalone via
 * `[value]` / `(valueChange)`.
 *
 *   <lsms-select-field label="Category" [options]="categories()" formControlName="categoryUid" />
 *
 * `emptyLabel` adds a first "none" choice whose value is `null` ("All …" / "Select…").
 * Keyboard: ↑ ↓ Home End Enter Esc, or type letters to jump.
 */
@Component({
  selector: 'lsms-select-field',
  imports: [Icon, CdkConnectedOverlay, CdkOverlayOrigin],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (label()) {
      <label class="label" [for]="id" (click)="toggle()">
        {{ label() }}
        @if (required()) {
          <span class="req">*</span>
        }
      </label>
    }
    <button
      #trigger
      type="button"
      class="control trigger"
      [class.dense]="dense()"
      [class.open]="open()"
      [id]="id"
      [disabled]="disabled()"
      role="combobox"
      aria-haspopup="listbox"
      [attr.aria-expanded]="open()"
      [attr.aria-controls]="id + '-list'"
      [attr.aria-label]="label() ? null : (ariaLabel() ?? null)"
      [attr.aria-invalid]="!!errorMessage()"
      cdkOverlayOrigin
      #origin="cdkOverlayOrigin"
      (click)="toggle()"
      (keydown)="onKey($event)"
      (focus)="focused.set(true)"
      (blur)="onBlur()"
    >
      @if (selected()?.icon ?? prefixIcon(); as ic) {
        <lsms-icon class="affix-icon" [name]="ic" [size]="18" />
      }
      <span class="value" [class.placeholder]="!selected()">{{ selected()?.label ?? emptyLabel() ?? placeholder() ?? '' }}</span>
      <lsms-icon class="chevron" [class.up]="open()" name="expand_more" [size]="20" />
    </button>
    @if (errorMessage()) {
      <div class="msg"><span class="error">{{ errorMessage() }}</span></div>
    } @else if (hint()) {
      <div class="msg"><span class="hint">{{ hint() }}</span></div>
    }

    <ng-template
      cdkConnectedOverlay
      [cdkConnectedOverlayOrigin]="origin"
      [cdkConnectedOverlayOpen]="open()"
      [cdkConnectedOverlayPositions]="positions"
      [cdkConnectedOverlayWidth]="width()"
      (overlayOutsideClick)="close()"
      (detach)="close()"
    >
      <div class="lsms-select-panel" (mousedown)="$event.preventDefault()">
        @if (searchable()) {
          <label class="search">
            <lsms-icon name="search" [size]="17" />
            <input #search type="text" [value]="query()" (input)="onSearch($any($event.target).value)" (keydown)="onKey($event)" [placeholder]="i18n.t('Search…', 'Tafuta…')" [attr.aria-label]="i18n.t('Search', 'Tafuta')" />
          </label>
        }
        <ul role="listbox" [id]="id + '-list'" [attr.aria-label]="label() || ariaLabel() || null">
          @for (o of shown(); track $index; let i = $index) {
            <li
              role="option"
              [attr.aria-selected]="o.value === current()"
              [class.active]="i === active()"
              [class.selected]="o.value === current()"
              [class.disabled]="!!o.disabled"
              [class.none]="o.value === null"
              (mouseenter)="active.set(i)"
              (click)="!o.disabled && pick(o.value)"
            >
              @if (o.icon) {
                <lsms-icon class="oi" [name]="o.icon" [size]="18" />
              }
              <span class="lbl">{{ o.label }}</span>
              @if (o.hint) {
                <span class="hint">{{ o.hint }}</span>
              }
              <lsms-icon class="check" name="check" [size]="18" />
            </li>
          } @empty {
            <li class="empty">{{ i18n.t('No match', 'Hakuna kinacholingana') }}</li>
          }
        </ul>
      </div>
    </ng-template>
  `,
  styleUrl: './form-field.scss',
  styles: `
    .trigger { width: 100%; font: inherit; text-align: left; cursor: pointer; color: var(--c-text); }
    .trigger:disabled { cursor: not-allowed; }
    .trigger:hover:not(:disabled) { border-color: color-mix(in srgb, var(--c-primary) 45%, var(--c-border)); }
    .trigger.open { border-color: var(--c-primary); box-shadow: 0 0 0 3px color-mix(in srgb, var(--c-primary) 14%, transparent); }
    .value { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 0.9rem; }
    .value.placeholder { color: var(--c-text-2); }
    .chevron { color: var(--c-text-2); transition: transform 0.18s ease; }
    .chevron.up { transform: rotate(180deg); color: var(--c-primary); }
  `,
  host: {
    '[class.invalid]': '!!errorMessage()',
    '[class.disabled]': 'disabled()',
    '[class.focused]': 'focused() || open()',
  },
})
export class SelectField<T = string> implements ControlValueAccessor {
  protected readonly i18n = inject(LanguageService);
  private readonly ngControl = inject(NgControl, { self: true, optional: true });
  private readonly destroyRef = inject(DestroyRef);
  private readonly triggerEl = viewChild('trigger', { read: ElementRef<HTMLButtonElement> });
  private readonly searchEl = viewChild<ElementRef<HTMLInputElement>>('search');

  readonly label = input('');
  readonly options = input.required<SelectOption<T>[]>();
  /** Accessible name when no visible label is shown. */
  readonly ariaLabel = input<string | undefined>(undefined);
  readonly emptyLabel = input<string | undefined>(undefined);
  readonly placeholder = input<string | undefined>(undefined);
  readonly prefixIcon = input<string | undefined>(undefined);
  readonly hint = input<string | undefined>(undefined);
  readonly required = input(false);
  readonly dense = input(false);
  /** Force the search box on / off (default: on for lists longer than 8). */
  readonly search = input<boolean | undefined>(undefined);
  /** Standalone (non-form) usage. */
  readonly value = input<T | null | undefined>(undefined);
  readonly valueChange = output<T | null>();

  protected readonly id = `lsms-sf-${nextId++}`;
  protected readonly positions = POSITIONS;
  protected readonly disabled = signal(false);
  protected readonly focused = signal(false);
  protected readonly open = signal(false);
  protected readonly active = signal(0);
  protected readonly query = signal('');
  protected readonly width = signal(220);
  private readonly written = signal<T | null | undefined>(undefined);
  private readonly statusTick = signal(0);
  private typed = '';
  private typedAt = 0;

  protected readonly current = computed(() => (this.written() !== undefined ? this.written() : (this.value() ?? null)));
  protected readonly selected = computed(() => this.options().find((o) => o.value === this.current()) ?? null);
  protected readonly searchable = computed(() => this.search() ?? this.options().length > SEARCH_AFTER);

  /** Options as shown in the panel ("none" first when `emptyLabel` is set), filtered by the search. */
  protected readonly shown = computed<SelectOption<T | null>[]>(() => {
    const all: SelectOption<T | null>[] = this.emptyLabel() !== undefined ? [{ value: null, label: this.emptyLabel()! }, ...this.options()] : [...this.options()];
    const q = this.query().trim().toLowerCase();
    return q ? all.filter((o) => o.value !== null && `${o.label} ${o.hint ?? ''}`.toLowerCase().includes(q)) : all;
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
    this.ngControl?.control?.events?.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.statusTick.update((n) => n + 1));
  }

  writeValue(v: T | null): void {
    this.written.set(v);
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

  protected toggle(): void {
    if (this.open()) this.close();
    else this.openPanel();
  }

  private openPanel(): void {
    if (this.disabled()) return;
    this.width.set(Math.max(200, this.triggerEl()?.nativeElement.getBoundingClientRect().width ?? 220));
    this.query.set('');
    const i = this.shown().findIndex((o) => o.value === this.current());
    this.active.set(Math.max(0, i));
    this.open.set(true);
    setTimeout(() => {
      this.searchEl()?.nativeElement.focus();
      document.querySelector(`#${this.id}-list li.active`)?.scrollIntoView({ block: 'nearest' });
    });
  }

  protected close(refocus = false): void {
    if (!this.open()) return;
    this.open.set(false);
    if (refocus) this.triggerEl()?.nativeElement.focus();
  }

  protected onBlur(): void {
    this.focused.set(false);
    if (!this.open()) {
      this.onTouched();
      this.statusTick.update((n) => n + 1);
    }
  }

  protected onSearch(v: string): void {
    this.query.set(v);
    this.active.set(0);
  }

  protected onKey(e: KeyboardEvent): void {
    const list = this.shown();
    const move = (i: number) => {
      this.active.set(Math.max(0, Math.min(list.length - 1, i)));
      setTimeout(() => document.querySelector(`#${this.id}-list li.active`)?.scrollIntoView({ block: 'nearest' }));
    };
    switch (e.key) {
      case 'ArrowDown':
      case 'ArrowUp':
        e.preventDefault();
        if (!this.open()) return this.openPanel();
        return move(this.active() + (e.key === 'ArrowDown' ? 1 : -1));
      case 'Home':
      case 'End':
        if (!this.open()) return;
        e.preventDefault();
        return move(e.key === 'Home' ? 0 : list.length - 1);
      case 'Enter':
      case ' ':
        if (e.key === ' ' && (e.target as HTMLElement).tagName === 'INPUT') return;
        e.preventDefault();
        if (!this.open()) return this.openPanel();
        if (list[this.active()] && !list[this.active()].disabled) this.pick(list[this.active()].value);
        return;
      case 'Escape':
        if (this.open()) {
          e.preventDefault();
          e.stopPropagation();
          this.close(true);
        }
        return;
      case 'Tab':
        this.close();
        return;
      default:
        // Type-ahead on the closed field / list without a search box.
        if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && (e.target as HTMLElement).tagName !== 'INPUT') {
          const now = Date.now();
          this.typed = now - this.typedAt > 700 ? e.key.toLowerCase() : this.typed + e.key.toLowerCase();
          this.typedAt = now;
          const i = list.findIndex((o) => !o.disabled && o.label.toLowerCase().startsWith(this.typed));
          if (i < 0) return;
          if (this.open()) move(i);
          else this.pick(list[i].value, false);
        }
    }
  }

  protected pick(v: T | null, closePanel = true): void {
    this.written.set(v);
    this.onChange(v);
    this.valueChange.emit(v);
    this.onTouched();
    this.statusTick.update((n) => n + 1);
    if (closePanel) this.close(true);
  }
}
