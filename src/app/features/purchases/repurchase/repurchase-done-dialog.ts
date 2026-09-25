import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';

import { ApiError } from '@core/api/api.types';
import { BusinessService } from '@core/data/business.service';
import { LanguageService } from '@core/i18n/language.service';
import { Button, DialogShell, Icon } from '@shared/ui';
import { MoneyPipe } from '@shared/utils/money';
import { RepurchaseInvoice } from '../purchases.models';
import { PurchasesService } from '../purchases.service';
import { printInvoice, typeLabel } from './repurchase-invoice';

export interface RepurchaseDoneData {
  invoice: RepurchaseInvoice;
  failed: Array<{ name: string; reason: string }>;
}

/**
 * After a repurchase order — port of Flutter's `RepurchaseInvoiceDialog`: the
 * invoice of what was ordered (saved to /api/v1/invoices, retry on failure),
 * print, and the lines the server refused (still in the cart). Closes with
 * 'list' to go back to Purchases.
 */
@Component({
  selector: 'app-repurchase-done-dialog',
  imports: [DialogShell, Button, Icon, MoneyPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let inv = data.invoice;
    <lsms-dialog [title]="i18n.t('Order sent', 'Agizo limetumwa')" icon="task_alt">
      <div class="hero">
        <span class="tick"><lsms-icon name="check" [size]="30" /></span>
        <b>{{ inv.grandTotal | money }}</b>
        <small>{{ inv.invoiceNumber }} · {{ i18n.t(inv.items.length + ' purchase(s) waiting for approval', 'Manunuzi ' + inv.items.length + ' yanasubiri idhini') }}</small>
      </div>

      @switch (saveState()) {
        @case ('saving') {
          <p class="state info"><lsms-icon name="hourglass_top" [size]="18" />{{ i18n.t('Saving the invoice…', 'Inahifadhi ankara…') }}</p>
        }
        @case ('error') {
          <p class="state due">
            <lsms-icon name="error" [size]="18" />
            <span>{{ i18n.t('The purchases were created but the invoice was not saved', 'Manunuzi yameundwa lakini ankara haijahifadhiwa') }}<small>{{ saveError() }}</small></span>
            <button lsmsButton="secondary" size="sm" icon="refresh" (click)="save()">{{ i18n.t('Retry', 'Jaribu tena') }}</button>
          </p>
        }
      }

      <ul class="lines">
        @for (i of inv.items; track i.productUid) {
          <li>
            <span>{{ i.productDisplayName }} <small>{{ i.quantity }} × {{ i.unitPrice | money: { symbol: false } }} · {{ type(i.purchaseTypeLabel) }}@if (i.supplierName) { · {{ i.supplierName }} }</small></span>
            <b>{{ i.finalTotal | money: { symbol: false } }}</b>
          </li>
        }
      </ul>

      @if (data.failed.length) {
        <div class="failed">
          <p><lsms-icon name="report" [size]="16" /><b>{{ i18n.t(data.failed.length + ' item(s) were not ordered — still in the cart', 'Bidhaa ' + data.failed.length + ' hazikuagizwa — bado ziko kwenye kapu') }}</b></p>
          @for (f of data.failed; track f.name) {
            <small>• {{ f.name }}: {{ f.reason }}</small>
          }
        </div>
      }

      <ng-container dialogActions>
        <button lsmsButton="secondary" (click)="ref.close(data.failed.length ? undefined : 'list')">{{ data.failed.length ? i18n.t('Back to the cart', 'Rudi kwenye kapu') : i18n.t('View purchases', 'Angalia manunuzi') }}</button>
        <button lsmsButton icon="print" [autofocus]="true" (click)="print()">{{ i18n.t('Print order', 'Chapisha agizo') }}</button>
      </ng-container>
    </lsms-dialog>
  `,
  styles: `
    .hero { display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 8px 0 14px; text-align: center; }
    .tick { display: inline-flex; align-items: center; justify-content: center; width: 56px; height: 56px; margin-bottom: 6px; border-radius: 50%; color: #fff; background: var(--c-success); box-shadow: 0 0 0 8px color-mix(in srgb, var(--c-success) 16%, transparent); }
    .hero b { font-size: 1.7rem; font-weight: 800; font-variant-numeric: tabular-nums; }
    .hero small { font-size: 0.78rem; color: var(--c-text-2); }
    .state { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; padding: 10px 12px; border-radius: 12px; font-size: 0.84rem; font-weight: 600; }
    .state span { flex: 1; display: flex; flex-direction: column; }
    .state small { font-weight: 400; color: var(--c-text-2); }
    .state.info { color: var(--c-text-2); background: var(--c-bg); }
    .state.due { color: var(--c-error); background: color-mix(in srgb, var(--c-error) 8%, transparent); }
    .lines { list-style: none; margin: 0; padding: 10px 12px; border-radius: 12px; background: var(--c-bg); border: 1px solid var(--c-border); max-height: 280px; overflow: auto; }
    .lines li { display: flex; justify-content: space-between; gap: 10px; padding: 5px 0; font-size: 0.84rem; }
    .lines li + li { border-top: 1px dashed var(--c-border); }
    .lines li span { display: flex; flex-direction: column; min-width: 0; }
    .lines li small { color: var(--c-text-2); }
    .lines li b { font-variant-numeric: tabular-nums; white-space: nowrap; }
    .failed { display: flex; flex-direction: column; gap: 3px; margin-top: 10px; padding: 10px 12px; border-radius: 12px; color: var(--c-warning); background: color-mix(in srgb, var(--c-warning) 9%, transparent); }
    .failed p { display: flex; align-items: center; gap: 6px; font-size: 0.84rem; }
    .failed small { font-size: 0.76rem; color: var(--c-text); }
  `,
})
export class RepurchaseDoneDialog {
  protected readonly data = inject<RepurchaseDoneData>(DIALOG_DATA);
  protected readonly ref = inject<DialogRef<'list'>>(DialogRef);
  protected readonly i18n = inject(LanguageService);
  private readonly business = inject(BusinessService);
  private readonly api = inject(PurchasesService);

  protected readonly saveState = signal<'saving' | 'saved' | 'error'>('saving');
  protected readonly saveError = signal('');

  constructor() {
    void this.business.profile.load().catch(() => undefined);
    void this.save();
  }

  protected async save(): Promise<void> {
    this.saveState.set('saving');
    try {
      await this.api.saveInvoice(this.data.invoice);
      this.saveState.set('saved');
    } catch (e) {
      this.saveError.set(ApiError.from(e).message);
      this.saveState.set('error');
    }
  }

  protected type(label: string): string {
    return typeLabel(label, this.i18n.isSwahili());
  }

  protected print(): void {
    printInvoice(this.data.invoice, this.business.profile.value(), this.i18n.isSwahili());
  }
}
