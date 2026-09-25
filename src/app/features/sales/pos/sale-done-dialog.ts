import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { BusinessService } from '@core/data/business.service';
import { LanguageService } from '@core/i18n/language.service';
import { Button, DialogShell, Icon } from '@shared/ui';
import { MoneyPipe } from '@shared/utils/money';
import { printReceipt } from '../receipt';
import { Sale, StockIssue, lineQtyLabel, methodLabel } from '../sales.models';

export interface SaleDoneData {
  sale: Sale;
  change: number;
  failed: StockIssue[];
}

/**
 * After a sale — replaces Flutter's receipt screen + "skipped products"
 * warning: receipt summary, change to give, print, and what was NOT sold.
 * Closes with 'list' to go to the sales list, else stays at the till.
 */
@Component({
  selector: 'app-sale-done-dialog',
  imports: [DialogShell, Button, Icon, MoneyPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let s = data.sale;
    <lsms-dialog [title]="i18n.t('Sale completed', 'Mauzo yamekamilika')" icon="task_alt">
      <div class="hero">
        <span class="tick"><lsms-icon name="check" [size]="30" /></span>
        <b>{{ s.total | money }}</b>
        <small>{{ i18n.t('Receipt', 'Risiti') }} {{ s.receiptNumber }}@if (s.customerName) { · {{ s.customerName }} }</small>
      </div>

      @if (data.change > 0) {
        <p class="state ok"><lsms-icon name="savings" [size]="18" />{{ i18n.t('Give change', 'Toa chenji') }} <b>{{ data.change | money }}</b></p>
      }
      @if (s.balance > 0) {
        <p class="state due"><lsms-icon name="account_balance_wallet" [size]="18" />{{ i18n.t('Balance owed', 'Deni') }} <b>{{ s.balance | money }}</b></p>
      }

      <ul class="lines">
        @for (l of s.lines; track l.uid) {
          <li><span>{{ l.productName }} <small>{{ qty(l) }}</small></span><b>{{ l.subTotal | money: { symbol: false } }}</b></li>
        }
        @for (p of s.payments; track p.uid) {
          <li class="pay"><span>{{ method(p.method) }}</span><b>{{ p.amountPaid | money: { symbol: false } }}</b></li>
        }
      </ul>

      @if (data.failed.length) {
        <div class="failed">
          <p><lsms-icon name="inventory_2" [size]="16" /><b>{{ i18n.t(data.failed.length + ' item(s) were not sold — still in the cart', 'Bidhaa ' + data.failed.length + ' hazikuuzwa — bado ziko kwenye kapu') }}</b></p>
          @for (f of data.failed; track f.productUid) {
            <small>• {{ f.productName }}: {{ f.reason }}</small>
          }
        </div>
      }

      <ng-container dialogActions>
        <button lsmsButton="secondary" (click)="ref.close('list')">{{ i18n.t('View sales', 'Angalia mauzo') }}</button>
        <button lsmsButton="secondary" icon="print" (click)="print()">{{ i18n.t('Print receipt', 'Chapisha risiti') }}</button>
        <button lsmsButton icon="add_shopping_cart" [autofocus]="true" (click)="ref.close()">{{ i18n.t('Next sale', 'Mauzo yanayofuata') }}</button>
      </ng-container>
    </lsms-dialog>
  `,
  styles: `
    .hero { display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 8px 0 14px; text-align: center; }
    .tick { display: inline-flex; align-items: center; justify-content: center; width: 56px; height: 56px; margin-bottom: 6px; border-radius: 50%; color: #fff; background: var(--c-success); box-shadow: 0 0 0 8px color-mix(in srgb, var(--c-success) 16%, transparent); }
    .hero b { font-size: 1.7rem; font-weight: 800; font-variant-numeric: tabular-nums; }
    .hero small { font-size: 0.78rem; color: var(--c-text-2); }
    .state { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; padding: 10px 12px; border-radius: 12px; font-size: 0.9rem; font-weight: 600; }
    .state b { margin-left: auto; font-size: 1.1rem; font-variant-numeric: tabular-nums; }
    .state.ok { color: var(--c-success); background: color-mix(in srgb, var(--c-success) 10%, transparent); }
    .state.due { color: var(--c-error); background: color-mix(in srgb, var(--c-error) 8%, transparent); }
    .lines { list-style: none; margin: 0; padding: 10px 12px; border-radius: 12px; background: var(--c-bg); border: 1px solid var(--c-border); max-height: 240px; overflow: auto; }
    .lines li { display: flex; justify-content: space-between; gap: 10px; padding: 4px 0; font-size: 0.84rem; }
    .lines li small { color: var(--c-text-2); }
    .lines li b { font-variant-numeric: tabular-nums; }
    .lines li.pay { margin-top: 4px; padding-top: 8px; border-top: 1px dashed var(--c-border); color: var(--c-success); }
    .failed { display: flex; flex-direction: column; gap: 3px; margin-top: 10px; padding: 10px 12px; border-radius: 12px; color: var(--c-warning); background: color-mix(in srgb, var(--c-warning) 9%, transparent); }
    .failed p { display: flex; align-items: center; gap: 6px; font-size: 0.84rem; }
    .failed small { font-size: 0.76rem; color: var(--c-text); }
  `,
})
export class SaleDoneDialog {
  protected readonly data = inject<SaleDoneData>(DIALOG_DATA);
  protected readonly ref = inject<DialogRef<'list'>>(DialogRef);
  protected readonly i18n = inject(LanguageService);
  private readonly business = inject(BusinessService);

  constructor() {
    void this.business.profile.load().catch(() => undefined);
  }

  protected qty(l: Sale['lines'][number]): string {
    return lineQtyLabel(l, this.i18n.isSwahili());
  }

  protected method(m: string): string {
    return methodLabel(m, this.i18n.isSwahili());
  }

  protected print(): void {
    printReceipt(this.data.sale, this.business.profile.value(), this.i18n.isSwahili());
  }
}
