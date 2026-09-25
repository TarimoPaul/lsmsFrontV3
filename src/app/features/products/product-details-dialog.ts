import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { LanguageService } from '@core/i18n/language.service';
import { Button, DialogShell, Icon } from '@shared/ui';
import { MoneyPipe } from '@shared/utils/money';
import { HEALTH_META, Product, measureLabel, pricingIssues, productHealth, tierPrices } from './products.models';

export interface ProductDetailsData {
  product: Product;
  canEdit: boolean;
  canDuplicate: boolean;
}

/**
 * Product details — port of Flutter `_showProductDetailsDialog` merged with
 * its "Pricing Analysis" dialog: every sellable tier with pieces, per-piece
 * rate and saving vs. the single-piece price, plus any pricing issues.
 */
@Component({
  selector: 'app-product-details-dialog',
  imports: [DialogShell, Button, Icon, MoneyPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <lsms-dialog [title]="i18n.t('Product details', 'Maelezo ya bidhaa')" icon="inventory_2">
      <section class="head">
        <div class="who">
          <h3>{{ p.displayName }}</h3>
          <div class="chips">
            <span class="chip"><lsms-icon name="category" [size]="14" />{{ p.categoryName || '—' }}</span>
            @for (m of p.measures; track m.uid) {
              <span class="chip"><lsms-icon name="straighten" [size]="14" />{{ label(m) }}</span>
            } @empty {
              <span class="chip muted"><lsms-icon name="straighten" [size]="14" />{{ i18n.t('No measure', 'Bila kipimo') }}</span>
            }
            @if (p.piecesPerPackage) {
              <span class="chip"><lsms-icon name="deployed_code" [size]="14" />{{ p.piecesPerPackage }} {{ i18n.t('pcs / package', 'vipande / paketi') }}</span>
            }
          </div>
        </div>
        <span class="status" [style.--st]="health.color">
          <lsms-icon [name]="health.icon" [size]="14" [filled]="true" />{{ health[i18n.lang()] }}
        </span>
      </section>

      <section class="block">
        <h4><lsms-icon name="payments" [size]="15" />{{ i18n.t('Selling prices', 'Bei za kuuza') }}</h4>
        @if (rates.length) {
          <table>
            <thead>
              <tr>
                <th>{{ i18n.t('Tier', 'Ngazi') }}</th>
                <th class="n">{{ i18n.t('Pieces', 'Vipande') }}</th>
                <th class="n">{{ i18n.t('Price', 'Bei') }}</th>
                <th class="n">{{ i18n.t('Per piece', 'Kwa kipande') }}</th>
              </tr>
            </thead>
            <tbody>
              @for (r of rates; track r.tier.key) {
                <tr [style.--tier]="r.tier.color">
                  <td><span class="dot"></span>{{ i18n.isSwahili() ? r.tier.sw : r.tier.en }}</td>
                  <td class="n">{{ r.pieces }}</td>
                  <td class="n strong">{{ r.price | money }}</td>
                  <td class="n">
                    {{ r.perPiece | money }}
                    @if (r.savingPct > 0) {
                      <span class="save">−{{ r.savingPct }}%</span>
                    }
                  </td>
                </tr>
              }
            </tbody>
          </table>
        } @else {
          <p class="muted">{{ i18n.t('No selling price yet — this product cannot be sold.', 'Hakuna bei bado — bidhaa hii haiwezi kuuzwa.') }}</p>
        }
        @if (issues.length) {
          <ul class="issues">
            @for (i of issues; track i.en) {
              <li><lsms-icon name="warning" [size]="15" [filled]="true" />{{ i[i18n.lang()] }}</li>
            }
          </ul>
        }
        @if (p.priceDescription) {
          <p class="note"><lsms-icon name="sticky_note_2" [size]="15" />{{ p.priceDescription }}</p>
        }
      </section>

      <ng-container dialogActions>
        <button lsmsButton="secondary" (click)="ref.close()">{{ i18n.t('Close', 'Funga') }}</button>
        @if (data.canDuplicate) {
          <button lsmsButton="tonal" icon="content_copy" (click)="ref.close('duplicate')">{{ i18n.t('Duplicate', 'Nakili') }}</button>
        }
        @if (data.canEdit) {
          <button lsmsButton icon="edit" (click)="ref.close('edit')">{{ i18n.t('Edit', 'Hariri') }}</button>
        }
      </ng-container>
    </lsms-dialog>
  `,
  styles: `
    .head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin-bottom: 14px; }
    .who { min-width: 0; }
    .who h3 { font-size: 1.2rem; font-weight: 800; word-break: break-word; }
    .chips { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
    .chip {
      display: inline-flex; align-items: center; gap: 4px; padding: 3px 9px; border-radius: 100px; font-size: 0.74rem; font-weight: 600;
      background: var(--c-bg); border: 1px solid var(--c-border);
      lsms-icon { color: var(--c-primary); }
      &.muted { color: var(--c-text-2); }
    }
    .status {
      display: inline-flex; align-items: center; gap: 4px; flex-shrink: 0; padding: 4px 10px; border-radius: 100px;
      font-size: 0.74rem; font-weight: 700; color: var(--st); background: color-mix(in srgb, var(--st) 12%, transparent);
    }
    .block { padding: 14px 16px; border-radius: 14px; background: var(--c-bg); border: 1px solid var(--c-border); }
    h4 {
      display: flex; align-items: center; gap: 6px; margin-bottom: 10px; font-size: 0.72rem; font-weight: 800;
      letter-spacing: 0.8px; text-transform: uppercase; color: var(--c-text-2);
      lsms-icon { color: var(--c-primary); }
    }
    table { width: 100%; border-collapse: collapse; font-size: 0.85rem; background: var(--c-surface); border-radius: 10px; overflow: hidden; }
    th { padding: 8px 12px; text-align: left; font-size: 0.7rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.4px; color: var(--c-text-2); border-bottom: 1px solid var(--c-border); }
    td { padding: 9px 12px; border-bottom: 1px solid var(--c-border); }
    tr:last-child td { border-bottom: 0; }
    .n { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
    .strong { font-weight: 800; }
    .dot { display: inline-block; width: 8px; height: 8px; margin-right: 8px; border-radius: 50%; background: var(--tier); }
    .save { margin-left: 6px; padding: 1px 6px; border-radius: 100px; font-size: 0.7rem; font-weight: 800; color: var(--c-success); background: color-mix(in srgb, var(--c-success) 12%, transparent); }
    .muted { color: var(--c-text-2); font-size: 0.85rem; }
    .issues { list-style: none; margin: 10px 0 0; padding: 0; }
    .issues li { display: flex; align-items: center; gap: 6px; font-size: 0.8rem; color: var(--c-warning); }
    .note { display: flex; align-items: flex-start; gap: 6px; margin-top: 10px; font-size: 0.82rem; color: var(--c-text-2); lsms-icon { color: var(--c-primary); margin-top: 1px; } }
  `,
})
export class ProductDetailsDialog {
  protected readonly data = inject<ProductDetailsData>(DIALOG_DATA);
  protected readonly ref = inject<DialogRef<'edit' | 'duplicate'>>(DialogRef);
  protected readonly i18n = inject(LanguageService);

  protected readonly p = this.data.product;
  protected readonly rates = tierPrices(this.p);
  protected readonly issues = pricingIssues(this.p);
  protected readonly health = HEALTH_META[productHealth(this.p)];
  protected readonly label = measureLabel;
}
