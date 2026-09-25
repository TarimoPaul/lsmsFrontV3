import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { LanguageService } from '@core/i18n/language.service';
import { Button, DialogShell, Icon } from '@shared/ui';
import { ProductMiniList } from '../products/product-mini-list';
import { MeasureRef, Product } from '../products/products.models';

export interface MeasureDetailsData {
  measure: MeasureRef;
  /** Products using the measure; null when products cannot be read. */
  products: readonly Product[] | null;
  canEdit: boolean;
}

/** Measure details with the products that use it. */
@Component({
  selector: 'app-measure-details-dialog',
  imports: [DialogShell, Button, Icon, ProductMiniList],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <lsms-dialog [title]="i18n.t('Measure details', 'Maelezo ya kipimo')" icon="straighten">
      <section class="head">
        <span class="unit">{{ m.unitType || '—' }}</span>
        <div class="who">
          <h3>{{ m.packageType }}</h3>
          <p>
            @if (m.abbreviation) {
              <span class="abbr">{{ m.abbreviation }}</span>
            }
            <span [class.muted]="!m.description">{{ m.description || i18n.t('No description', 'Hakuna maelezo') }}</span>
          </p>
        </div>
        @if (data.products) {
          <div class="stat"><b>{{ data.products.length }}</b><small>{{ i18n.t('products', 'bidhaa') }}</small></div>
        }
      </section>
      <section class="block">
        <h4><lsms-icon name="inventory_2" [size]="15" />{{ i18n.t('Products using this measure', 'Bidhaa zinazotumia kipimo hiki') }}</h4>
        <app-product-mini-list
          [products]="data.products"
          [emptyText]="i18n.t('Not used by any product — it can be deleted safely.', 'Hakitumiwi na bidhaa yoyote — kinaweza kufutwa bila tatizo.')"
        />
      </section>
      <ng-container dialogActions>
        <button lsmsButton="secondary" (click)="ref.close()">{{ i18n.t('Close', 'Funga') }}</button>
        @if (data.canEdit) {
          <button lsmsButton icon="edit" (click)="ref.close('edit')">{{ i18n.t('Edit measure', 'Hariri kipimo') }}</button>
        }
      </ng-container>
    </lsms-dialog>
  `,
  styles: `
    .head { display: flex; align-items: center; gap: 14px; margin-bottom: 16px; }
    .unit {
      display: inline-flex; align-items: center; justify-content: center; min-width: 64px; height: 56px; padding: 0 12px;
      border-radius: 16px; color: #fff; font-weight: 800; background: var(--c-info);
      box-shadow: 0 6px 16px color-mix(in srgb, var(--c-info) 30%, transparent);
    }
    .who { flex: 1; min-width: 0; }
    .who h3 { font-size: 1.15rem; font-weight: 800; }
    .who p { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; font-size: 0.85rem; }
    .abbr { padding: 1px 7px; border-radius: 6px; font-size: 0.72rem; font-weight: 700; background: var(--c-bg); border: 1px solid var(--c-border); }
    .muted { color: var(--c-text-2); }
    .stat { display: flex; flex-direction: column; align-items: center; padding: 6px 14px; border-radius: 12px; background: var(--c-bg); border: 1px solid var(--c-border); }
    .stat b { font-size: 1.3rem; font-weight: 800; color: var(--c-info); line-height: 1.1; }
    .stat small { font-size: 0.7rem; color: var(--c-text-2); }
    .block { padding: 14px 16px; border-radius: 14px; background: var(--c-bg); border: 1px solid var(--c-border); }
    h4 {
      display: flex; align-items: center; gap: 6px; margin-bottom: 10px; font-size: 0.72rem; font-weight: 800;
      letter-spacing: 0.8px; text-transform: uppercase; color: var(--c-text-2);
      lsms-icon { color: var(--c-primary); }
    }
  `,
})
export class MeasureDetailsDialog {
  protected readonly data = inject<MeasureDetailsData>(DIALOG_DATA);
  protected readonly ref = inject<DialogRef<'edit'>>(DialogRef);
  protected readonly i18n = inject(LanguageService);
  protected readonly m = this.data.measure;
}
