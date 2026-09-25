import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { LanguageService } from '@core/i18n/language.service';
import { Button, DialogShell, Icon } from '@shared/ui';
import { ProductMiniList } from '../products/product-mini-list';
import { Product } from '../products/products.models';
import { Category, categoryColor, categoryInitials } from './categories.models';

export interface CategoryDetailsData {
  category: Category;
  /** Products in this category; null when the user cannot read products. */
  products: readonly Product[] | null;
  canEdit: boolean;
}

export type CategoryDetailsResult = 'edit' | undefined;

/** Category details — port of Flutter `_showCategoryDetailsDialog`, plus the products it holds. */
@Component({
  selector: 'app-category-details-dialog',
  imports: [DialogShell, Button, Icon, ProductMiniList],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <lsms-dialog [title]="i18n.t('Category details', 'Maelezo ya kategoria')" icon="category">
      <section class="head" [style.--cat]="color">
        <span class="badge">{{ initials }}</span>
        <div class="who">
          <h3>{{ data.category.categoryName }}</h3>
          <p [class.muted]="!data.category.description">
            {{ data.category.description || i18n.t('No description', 'Hakuna maelezo') }}
          </p>
        </div>
        @if (data.products) {
          <div class="stat">
            <b>{{ data.products.length }}</b>
            <small>{{ i18n.t('products', 'bidhaa') }}</small>
          </div>
        }
      </section>

      <section class="block">
        <h4>
          <lsms-icon name="inventory_2" [size]="15" />{{ i18n.t('Products in this category', 'Bidhaa za kategoria hii') }}
          @if (data.products?.length) {
            <span class="count">{{ data.products!.length }}</span>
          }
        </h4>
        <app-product-mini-list
          [products]="data.products"
          [emptyText]="i18n.t('No products yet — this category can be deleted safely.', 'Hakuna bidhaa bado — kategoria hii inaweza kufutwa bila tatizo.')"
        />
      </section>

      <ng-container dialogActions>
        <button lsmsButton="secondary" (click)="ref.close()">{{ i18n.t('Close', 'Funga') }}</button>
        @if (data.canEdit) {
          <button lsmsButton icon="edit" (click)="ref.close('edit')">{{ i18n.t('Edit category', 'Hariri kategoria') }}</button>
        }
      </ng-container>
    </lsms-dialog>
  `,
  styles: `
    .head { display: flex; align-items: center; gap: 14px; margin-bottom: 16px; }
    .badge {
      display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; width: 56px; height: 56px;
      border-radius: 16px; color: #fff; font-size: 1.1rem; font-weight: 800; background: var(--cat);
      box-shadow: 0 6px 16px color-mix(in srgb, var(--cat) 30%, transparent);
    }
    .who { flex: 1; min-width: 0; }
    .who h3 { font-size: 1.2rem; font-weight: 800; word-break: break-word; }
    .who p { color: var(--c-text); font-size: 0.86rem; word-break: break-word; }
    .stat { display: flex; flex-direction: column; align-items: center; padding: 6px 14px; border-radius: 12px; background: var(--c-bg); border: 1px solid var(--c-border); }
    .stat b { font-size: 1.3rem; font-weight: 800; color: var(--cat); line-height: 1.1; }
    .stat small { font-size: 0.7rem; color: var(--c-text-2); }
    .block { padding: 14px 16px; border-radius: 14px; background: var(--c-bg); border: 1px solid var(--c-border); }
    h4 {
      display: flex; align-items: center; gap: 6px; margin-bottom: 10px; font-size: 0.72rem; font-weight: 800;
      letter-spacing: 0.8px; text-transform: uppercase; color: var(--c-text-2);
      lsms-icon { color: var(--c-primary); }
    }
    .count { padding: 1px 8px; border-radius: 100px; font-size: 0.7rem; letter-spacing: 0; color: var(--c-primary); background: color-mix(in srgb, var(--c-primary) 10%, transparent); }
    .muted { color: var(--c-text-2); font-size: 0.85rem; }
  `,
})
export class CategoryDetailsDialog {
  protected readonly data = inject<CategoryDetailsData>(DIALOG_DATA);
  protected readonly ref = inject<DialogRef<CategoryDetailsResult>>(DialogRef);
  protected readonly i18n = inject(LanguageService);

  protected readonly color = categoryColor(this.data.category.categoryName);
  protected readonly initials = categoryInitials(this.data.category.categoryName);
}
