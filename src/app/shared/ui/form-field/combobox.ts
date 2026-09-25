import { CdkConnectedOverlay, CdkOverlayOrigin, ConnectedPosition } from '@angular/cdk/overlay';
import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, computed, inject, input, output, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ControlValueAccessor, NgControl } from '@angular/forms';

import { LanguageService } from '../../../core/i18n/language.service';
import { formErrorMessage } from '../../forms/validators';
import { Icon } from '../icon/icon';

export interface ComboOption<T = string> {
  value: T;
  label: string;
  /** Secondary text on the right (price, stock, phone …). */
  hint?: string;
  /** Extra words matched by the search but not shown. */
  keywords?: string;
  disabled?: boolean;
}

let nextId = 0;
const POSITIONS: ConnectedPosition[] = [
  { originX: 'start', originY: 'bottom', overlayX: 'start', overlayY: 'top', offsetY: 4 },
  { originX: 'start', originY: 'top', overlayX: 'start', overlayY: 'bottom', offsetY: -4 },
];

/**
 * Searchable single-select ("type to filter") for long lists — products,
 * suppliers, customers. Works with reactive forms (ControlValueAccessor) or
 * standalone via `value` / `valueChange`. Keyboard: ↑ ↓ Enter Esc.
 *
 *   <lsms-combobox formControlName="productUid" label="Product" [options]="products()" />
 */
@Component({
  selector: 'lsms-combobox',
  imports: [Icon, CdkConnectedOverlay, CdkOverlayOrigin],
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
    <div class="control" [class.dense]="dense()" cdkOverlayOrigin #origin="cdkOverlayOrigin" (click)="openList()">
      @if (prefixIcon()) {
        <lsms-icon class="affix-icon" [name]="prefixIcon()!" [size]="18" />
      }
      <input
        #input
        [id]="id"
        role="combobox"
        autocomplete="off"
        [attr.aria-expanded]="open()"
        [attr.aria-controls]="id + '-list'"
        [attr.aria-invalid]="!!errorMessage()"
        [attr.aria-label]="label() ? null : (ariaLabel() ?? null)"
        [placeholder]="placeholder()"
        [disabled]="disabled()"
        [value]="open() ? query() : selectedLabel()"
        (input)="onType($any($event.target).value)"
        (focus)="onFocus()"
        (blur)="onBlur()"
        (keydown)="onKey($event)"
      />
      @if (current() !== null && current() !== undefined && !disabled() && clearable()) {
        <button type="button" class="clear" [attr.aria-label]="i18n.t('Clear', 'Futa')" (mousedown)="$event.preventDefault()" (click)="$event.stopPropagation(); pick(null)">
          <lsms-icon name="close" [size]="16" />
        </button>
      }
      <lsms-icon class="chevron" [class.up]="open()" name="expand_more" [size]="20" />
    </div>
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
      <ul class="lsms-combo-list" role="listbox" [id]="id + '-list'" (mousedown)="$event.preventDefault()">
        @for (o of filtered(); track $index; let i = $index) {
          <li
            role="option"
            [attr.aria-selected]="o.value === current()"
            [class.active]="i === active()"
            [class.selected]="o.value === current()"
            [class.disabled]="o.disabled"
            (mouseenter)="active.set(i)"
            (click)="!o.disabled && pick(o.value)"
          >
            <span class="lbl">{{ o.label }}</span>
            @if (o.hint) {
              <span class="hint">{{ o.hint }}</span>
            }
          </li>
        } @empty {
          <li class="none">{{ emptyText() ?? i18n.t('No match', 'Hakuna kinacholingana') }}</li>
        }
        @if (more() > 0) {
          <li class="none">{{ i18n.t('Keep typing to narrow ' + more() + ' more…', 'Endelea kuandika kupunguza ' + more() + ' zaidi…') }}</li>
        }
      </ul>
    </ng-template>
  `,
  styleUrl: './form-field.scss',
  styles: `
    .control { cursor: text; }
    input { flex: 1; min-width: 0; border: 0; outline: 0; background: transparent; color: var(--c-text); font: inherit; }
    .clear { display: inline-flex; padding: 2px; border: 0; border-radius: 50%; background: transparent; color: var(--c-text-2); cursor: pointer; &:hover { background: var(--c-hover); } }
    .chevron { color: var(--c-text-2); transition: transform 0.15s ease; &.up { transform: rotate(180deg); } }
  `,
  host: {
    '[class.invalid]': '!!errorMessage()',
    '[class.disabled]': 'disabled()',
    '[class.focused]': 'focused()',
  },
})
export class Combobox<T = string> implements ControlValueAccessor {
  protected readonly i18n = inject(LanguageService);
  private readonly ngControl = inject(NgControl, { self: true, optional: true });
  private readonly destroyRef = inject(DestroyRef);
  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly inputEl = viewChild<ElementRef<HTMLInputElement>>('input');

  readonly label = input('');
  readonly options = input.required<ComboOption<T>[]>();
  readonly placeholder = input('');
  readonly ariaLabel = input<string | undefined>(undefined);
  readonly hint = input<string | undefined>(undefined);
  readonly prefixIcon = input<string | undefined>(undefined);
  readonly required = input(false);
  readonly dense = input(false);
  readonly clearable = input(true);
  readonly emptyText = input<string | undefined>(undefined);
  /** Cap on rendered options — keeps long lists fast. */
  readonly maxResults = input(60);
  /** Standalone (non-form) usage. */
  readonly value = input<T | null | undefined>(undefined);
  readonly valueChange = output<T | null>();

  protected readonly id = `lsms-cb-${nextId++}`;
  protected readonly positions = POSITIONS;
  protected readonly open = signal(false);
  protected readonly query = signal('');
  protected readonly active = signal(0);
  protected readonly focused = signal(false);
  protected readonly disabled = signal(false);
  protected readonly width = signal(280);
  private readonly written = signal<T | null | undefined>(undefined);
  private readonly statusTick = signal(0);

  protected readonly current = computed(() => (this.written() !== undefined ? this.written() : this.value()));
  protected readonly selectedLabel = computed(() => this.options().find((o) => o.value === this.current())?.label ?? '');

  private readonly matches = computed(() => {
    const q = this.query().trim().toLowerCase();
    if (!q) return this.options();
    const words = q.split(/\s+/);
    return this.options().filter((o) => {
      const text = `${o.label} ${o.hint ?? ''} ${o.keywords ?? ''}`.toLowerCase();
      return words.every((w) => text.includes(w));
    });
  });
  protected readonly filtered = computed(() => this.matches().slice(0, this.maxResults()));
  protected readonly more = computed(() => Math.max(0, this.matches().length - this.maxResults()));

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

  protected openList(): void {
    if (this.disabled() || this.open()) return;
    this.width.set(Math.max(240, (this.host.nativeElement as HTMLElement).querySelector('.control')?.clientWidth ?? 280));
    this.query.set('');
    const i = this.options().findIndex((o) => o.value === this.current());
    this.active.set(Math.max(0, i));
    this.open.set(true);
    this.inputEl()?.nativeElement.focus();
  }

  protected close(): void {
    this.open.set(false);
  }

  protected onFocus(): void {
    this.focused.set(true);
    this.openList();
  }

  protected onBlur(): void {
    this.focused.set(false);
    this.onTouched();
    this.statusTick.update((n) => n + 1);
    // Let a click on an option land before closing.
    setTimeout(() => this.close(), 120);
  }

  protected onType(v: string): void {
    this.query.set(v);
    this.active.set(0);
    if (!this.open()) this.open.set(true);
  }

  protected onKey(e: KeyboardEvent): void {
    const list = this.filtered();
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!this.open()) this.openList();
      else this.active.set(Math.min(list.length - 1, this.active() + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      this.active.set(Math.max(0, this.active() - 1));
    } else if (e.key === 'Enter') {
      if (this.open() && list[this.active()] && !list[this.active()].disabled) {
        e.preventDefault();
        this.pick(list[this.active()].value);
      }
    } else if (e.key === 'Escape' && this.open()) {
      e.stopPropagation();
      this.close();
    }
  }

  protected pick(v: T | null): void {
    this.written.set(v);
    this.onChange(v);
    this.valueChange.emit(v);
    this.query.set('');
    this.close();
  }
}
