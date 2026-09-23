import { ChangeDetectionStrategy, Component, DestroyRef, inject, input, model, output } from '@angular/core';

import { LanguageService } from '../../../core/i18n/language.service';
import { Icon } from '../icon/icon';

/**
 * Search field with debounce + clear button — port of `SharedSearchBar`.
 * `(search)` fires after `debounce` ms of no typing (and immediately on
 * clear / Enter). `[(value)]` tracks the raw text.
 *
 *   <lsms-search-bar [placeholder]="'Search products…'" (search)="filter.set($event)" />
 */
@Component({
  selector: 'lsms-search-bar',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <lsms-icon name="search" [size]="16" class="lead" />
    <input
      type="search"
      [value]="value()"
      [placeholder]="placeholder() ?? i18n.t('Search…', 'Tafuta…')"
      [attr.aria-label]="placeholder() ?? i18n.t('Search', 'Tafuta')"
      [autofocus]="autofocus()"
      (input)="onInput($any($event.target).value)"
      (keydown.enter)="flush()"
      (keydown.escape)="clear()"
    />
    @if (value()) {
      <button type="button" class="clear" [attr.aria-label]="i18n.t('Clear', 'Futa')" (click)="clear()">
        <lsms-icon name="close" [size]="16" />
      </button>
    }
  `,
  styles: `
    :host {
      display: flex; align-items: center; gap: 8px;
      height: 40px; padding: 0 8px 0 12px; min-width: 0;
      border: 1px solid var(--c-border); border-radius: 8px;
      background: var(--c-input-fill);
      transition: border-color 0.15s ease, box-shadow 0.15s ease;
    }
    :host(:focus-within) {
      border-color: var(--c-primary);
      box-shadow: 0 0 0 1px var(--c-primary);
    }
    .lead { color: var(--c-text-2); }
    input {
      flex: 1; min-width: 0; height: 100%;
      border: 0; outline: 0; background: transparent;
      font-size: 0.875rem; color: var(--c-text);
    }
    input::placeholder { color: var(--c-text-2); opacity: 0.8; }
    input::-webkit-search-cancel-button { display: none; }
    .clear {
      display: inline-flex; padding: 4px; border: 0; border-radius: 50%;
      background: none; color: var(--c-text-2); cursor: pointer;
    }
    .clear:hover { background: var(--c-hover); color: var(--c-text); }
  `,
})
export class SearchBar {
  protected readonly i18n = inject(LanguageService);

  readonly value = model('');
  readonly placeholder = input<string | undefined>(undefined);
  readonly debounce = input(300);
  readonly autofocus = input(false);
  /** Debounced search term. */
  readonly search = output<string>();
  readonly cleared = output<void>();

  private timer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    inject(DestroyRef).onDestroy(() => clearTimeout(this.timer));
  }

  protected onInput(text: string): void {
    this.value.set(text);
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.search.emit(text), this.debounce());
  }

  protected flush(): void {
    clearTimeout(this.timer);
    this.search.emit(this.value());
  }

  clear(): void {
    clearTimeout(this.timer);
    this.value.set('');
    this.search.emit('');
    this.cleared.emit();
  }
}
