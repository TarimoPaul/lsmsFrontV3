import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';

import { LanguageService } from '@core/i18n/language.service';
import { Icon } from '@shared/ui';
import { MoneyPipe } from '@shared/utils/money';
import { Product } from './products.models';

/**
 * Compact, searchable list of products with their piece price — used by
 * detail dialogs that show "products in this category / measure".
 *
 *   <app-product-mini-list [products]="list" [emptyText]="…" />
 */
@Component({
  selector: 'app-product-mini-list',
  imports: [Icon, MoneyPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (products() === null) {
      <p class="muted">{{ i18n.t('You are not allowed to view products.', 'Huruhusiwi kuona bidhaa.') }}</p>
    } @else if (!products()!.length) {
      <p class="muted">{{ emptyText() }}</p>
    } @else {
      @if (products()!.length > 8) {
        <label class="find">
          <lsms-icon name="search" [size]="16" />
          <input type="search" [placeholder]="i18n.t('Find a product…', 'Tafuta bidhaa…')" [value]="query()" (input)="query.set($any($event.target).value)" />
        </label>
      }
      <ul class="products">
        @for (p of shown(); track p.uid; let i = $index) {
          <li>
            <span class="n">{{ i + 1 }}</span>
            <span class="pn">{{ p.displayName }}</span>
            <span class="pp">{{ p.pieceSalePrice !== null ? (p.pieceSalePrice | money) : '—' }}</span>
          </li>
        } @empty {
          <li class="none">{{ i18n.t('No match', 'Hakuna inayolingana') }}</li>
        }
      </ul>
    }
  `,
  styles: `
    :host { display: block; }
    .muted { color: var(--c-text-2); font-size: 0.85rem; }
    .find {
      display: flex; align-items: center; gap: 6px; margin-bottom: 8px; padding: 0 10px; height: 36px; border-radius: 10px;
      background: var(--c-surface); border: 1px solid var(--c-border); color: var(--c-text-2);
      &:focus-within { border-color: var(--c-primary); }
      input { flex: 1; min-width: 0; border: 0; outline: 0; background: transparent; color: var(--c-text); font: inherit; font-size: 0.85rem; }
    }
    .products { list-style: none; margin: 0; padding: 0; max-height: 300px; overflow: auto; border-radius: 10px; background: var(--c-surface); border: 1px solid var(--c-border); }
    .products li { display: flex; align-items: center; gap: 10px; padding: 8px 12px; font-size: 0.84rem; border-bottom: 1px solid var(--c-border); }
    .products li:last-child { border-bottom: 0; }
    .n { width: 22px; flex-shrink: 0; color: var(--c-text-2); font-size: 0.72rem; text-align: right; }
    .pn { flex: 1; min-width: 0; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .pp { color: var(--c-text-2); font-variant-numeric: tabular-nums; white-space: nowrap; }
    .none { justify-content: center; color: var(--c-text-2); }
  `,
})
export class ProductMiniList {
  protected readonly i18n = inject(LanguageService);

  /** null = the user cannot read products. */
  readonly products = input.required<readonly Product[] | null>();
  readonly emptyText = input('');

  protected readonly query = signal('');
  protected readonly shown = computed(() => {
    const q = this.query().trim().toLowerCase();
    const list = [...(this.products() ?? [])].sort((a, b) => a.displayName.localeCompare(b.displayName));
    return q ? list.filter((p) => p.displayName.toLowerCase().includes(q)) : list;
  });
}
