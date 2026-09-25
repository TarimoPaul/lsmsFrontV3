import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { DatePipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';

import { ApiError } from '@core/api/api.types';
import { AuthService } from '@core/auth/auth.service';
import { BusinessService } from '@core/data/business.service';
import { LanguageService } from '@core/i18n/language.service';
import { ActionMenu, Button, DialogService, DialogShell, Icon, MenuAction, PaymentStatusBadge, ToastService } from '@shared/ui';
import { parseLocal } from '@shared/utils/date-utils';
import { Money, MoneyPipe } from '@shared/utils/money';
import { CartStore } from './pos/cart.store';
import { printReceipt } from './receipt';
import { SALE_TYPES, Sale, SaleType, methodLabel } from './sales.models';
import { SalesService } from './sales.service';

export interface SaleDetailsData {
  sale: Sale;
}

/** `changed` = paid or deleted, so the list refreshes. */
export type SaleDetailsResult = 'changed' | undefined;

/**
 * One sale — port of Flutter's sale details sheet (header, customer, items,
 * payments, summary) with the row actions: receipt, receive payment, delete.
 */
@Component({
  selector: 'app-sale-details-dialog',
  imports: [DialogShell, Button, Icon, ActionMenu, PaymentStatusBadge, MoneyPipe, DatePipe, DecimalPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let s = sale();
    <lsms-dialog [title]="i18n.t('Sale', 'Mauzo') + ' · ' + s.receiptNumber" icon="receipt_long">
      <header class="head">
        <lsms-payment-status-badge [paid]="s.paid" [total]="s.total" />
        @if (s.hasReturn) {
          <span class="pill" style="--st: var(--c-warning)"><lsms-icon name="assignment_return" [size]="13" />{{ s.isFullReturn ? i18n.t('Returned', 'Imerudishwa') : i18n.t('Partly returned', 'Imerudishwa sehemu') }}</span>
        }
        <span class="grow"></span>
        <small class="muted">{{ date(s.saleDate) | date: 'EEE dd MMM yyyy, HH:mm' }}</small>
      </header>

      <section class="sum">
        <div class="big" [class.ok]="s.balance === 0">
          <small>{{ i18n.t('Total', 'Jumla') }}</small><b>{{ s.total | money }}</b>
          @if (s.balance > 0) {
            <span class="od"><lsms-icon name="account_balance_wallet" [size]="13" />{{ i18n.t('Owes', 'Deni') }} {{ s.balance | money }}</span>
          } @else {
            <span class="od"><lsms-icon name="task_alt" [size]="13" />{{ i18n.t('Paid in full', 'Imelipwa yote') }}</span>
          }
        </div>
        <div><small>{{ i18n.t('Paid', 'Imelipwa') }}</small><b>{{ s.paid | money }}</b></div>
        <div><small>{{ i18n.t('Items', 'Bidhaa') }}</small><b>{{ s.lines.length }} · {{ pieces() }} {{ i18n.t('pcs', 'vip') }}</b></div>
        @if (canProfit && s.profit !== null) {
          <div><small>{{ i18n.t('Profit', 'Faida') }}</small><b class="credit">{{ s.profit | money }}</b></div>
        } @else {
          <div><small>{{ i18n.t('Discount', 'Punguzo') }}</small><b>{{ s.discount | money }}</b></div>
        }
      </section>

      <div class="who">
        <span><lsms-icon name="person" [size]="16" />{{ s.customerName || i18n.t('Walk-in customer', 'Mteja wa kawaida') }}@if (s.customerPhone) { <small>· {{ s.customerPhone }}</small> }</span>
        @if (s.seller) {
          <span><lsms-icon name="badge" [size]="16" />{{ i18n.t('Sold by', 'Ameuza') }} {{ s.seller }}</span>
        }
      </div>

      <section class="block">
        <h4><lsms-icon name="shopping_bag" [size]="15" />{{ i18n.t('Items', 'Bidhaa') }} <span class="count">{{ s.lines.length }}</span></h4>
        <div class="scroll">
          <table>
            <thead>
              <tr>
                <th>{{ i18n.t('Product', 'Bidhaa') }}</th>
                <th>{{ i18n.t('Sold as', 'Imeuzwa kama') }}</th>
                <th class="n">{{ i18n.t('Qty', 'Idadi') }}</th>
                <th class="n">{{ i18n.t('Price', 'Bei') }}</th>
                <th class="n">{{ i18n.t('Amount', 'Kiasi') }}</th>
                @if (canProfit) {
                  <th class="n">{{ i18n.t('Profit', 'Faida') }}</th>
                }
              </tr>
            </thead>
            <tbody>
              @for (l of s.lines; track l.uid) {
                @let t = type(l.saleType);
                <tr>
                  <td><b>{{ l.productName }}</b>@if (l.category) { <small class="ref">{{ l.category }}</small> }</td>
                  <td><span class="pill" [style.--st]="t.color">{{ i18n.isSwahili() ? t.sw : t.en }}</span>@if (l.priceOverridden) { <small class="ref">{{ i18n.t('custom price', 'bei maalum') }}</small> }</td>
                  <td class="n">{{ l.saleType === 'PIECES' ? l.pieces : l.packages }}<small class="ref">{{ l.pieces }} {{ i18n.t('pcs', 'vip') }}</small></td>
                  <td class="n">{{ l.unitPrice | money: { symbol: false } }}</td>
                  <td class="n strong">{{ l.subTotal | money: { symbol: false } }}</td>
                  @if (canProfit) {
                    <td class="n" [class.credit]="(l.profit ?? 0) > 0" [class.debit]="(l.profit ?? 0) < 0">
                      {{ l.profit === null ? '—' : (l.profit | money: { symbol: false }) }}
                      @if (l.margin !== null) { <small class="ref">{{ l.margin | number: '1.0-1' }}%</small> }
                    </td>
                  }
                </tr>
              }
            </tbody>
          </table>
        </div>
        @if (s.discount > 0) {
          <p class="line"><span>{{ i18n.t('Subtotal', 'Jumla ndogo') }}</span><b>{{ s.subtotal | money }}</b></p>
          <p class="line"><span>{{ i18n.t('Discount', 'Punguzo') }}</span><b class="debit">−{{ s.discount | money }}</b></p>
        }
      </section>

      <section class="block">
        <h4><lsms-icon name="payments" [size]="15" />{{ i18n.t('Payments', 'Malipo') }} <span class="count">{{ s.payments.length }}</span></h4>
        @if (s.payments.length) {
          <div class="scroll">
            <table>
              <thead>
                <tr>
                  <th>{{ i18n.t('Date', 'Tarehe') }}</th>
                  <th>{{ i18n.t('Method', 'Njia') }}</th>
                  <th>{{ i18n.t('Received by', 'Amepokea') }}</th>
                  <th class="n">{{ i18n.t('Amount', 'Kiasi') }}</th>
                </tr>
              </thead>
              <tbody>
                @for (p of s.payments; track p.uid) {
                  <tr>
                    <td class="nowrap">{{ date(p.date) | date: 'dd MMM yyyy, HH:mm' }}</td>
                    <td>{{ method(p.method) }}@if (p.reference) { <small class="ref">{{ p.reference }}</small> }</td>
                    <td class="muted">{{ p.receivedBy || '—' }}</td>
                    <td class="n credit">{{ p.amountPaid | money: { symbol: false } }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        } @else {
          <p class="muted">{{ i18n.t('No payment recorded — sold on credit.', 'Hakuna malipo — imeuzwa kwa mkopo.') }}</p>
        }
      </section>

      <ng-container dialogActions>
        @if (more().length) {
          <lsms-action-menu class="more" [actions]="more()" icon="more_horiz" [tooltip]="i18n.t('More actions', 'Vitendo zaidi')" />
        }
        <button lsmsButton="secondary" (click)="ref.close(changed ? 'changed' : undefined)">{{ i18n.t('Close', 'Funga') }}</button>
        <button lsmsButton="secondary" icon="print" (click)="print()">{{ i18n.t('Receipt', 'Risiti') }}</button>
        @if (s.balance > 0 && canPay) {
          <button lsmsButton="success" icon="payments" (click)="pay()">{{ i18n.t('Receive payment', 'Pokea malipo') }}</button>
        }
      </ng-container>
    </lsms-dialog>
  `,
  styles: `
    @use 'detail-dialog';
    @include detail-dialog.base;
    .head { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; margin-bottom: 12px; }
    .head .grow { flex: 1; }
    .who { display: flex; flex-wrap: wrap; gap: 6px 18px; margin-bottom: 12px; font-size: 0.86rem; font-weight: 600; }
    .who span { display: inline-flex; align-items: center; gap: 6px; }
    .who lsms-icon { color: var(--c-primary); }
    .who small { color: var(--c-text-2); font-weight: 500; }
    .scroll { max-height: 280px; }
    .line { display: flex; justify-content: space-between; margin-top: 6px; padding: 0 10px; font-size: 0.84rem; }
    .more { margin-right: auto; }
  `,
})
export class SaleDetailsDialog {
  protected readonly data = inject<SaleDetailsData>(DIALOG_DATA);
  protected readonly ref = inject<DialogRef<SaleDetailsResult>>(DialogRef);
  protected readonly i18n = inject(LanguageService);
  private readonly auth = inject(AuthService);
  private readonly api = inject(SalesService);
  private readonly business = inject(BusinessService);
  private readonly dialogs = inject(DialogService);
  private readonly toast = inject(ToastService);

  protected readonly sale = signal<Sale>(this.data.sale);
  protected readonly pieces = computed(() => this.sale().lines.reduce((n, l) => n + l.pieces, 0));
  /** Less common actions, behind "More". */
  protected readonly more = computed<MenuAction[]>(() => {
    const s = this.sale();
    const t = (en: string, sw: string) => this.i18n.t(en, sw);
    const list: MenuAction[] = [];
    if (this.canEdit && !s.hasReturn) list.push({ label: t('Edit sale', 'Hariri mauzo'), icon: 'edit', run: () => void this.edit() });
    if (this.canSell) list.push({ label: t('Sell again', 'Uza tena'), icon: 'content_copy', run: () => void this.sellAgain() });
    if (s.hasReturn && s.returnUid && this.canReadReturns) list.push({ label: t('View return', 'Angalia marejesho'), icon: 'assignment_return', run: () => void this.viewReturn() });
    else if (!s.hasReturn && this.canReturn) list.push({ label: t('Return items', 'Rudisha bidhaa'), icon: 'assignment_return', run: () => void this.requestReturn() });
    if (s.balance > 0 && this.canAdjust) list.push({ label: t('Adjust debt', 'Rekebisha deni'), icon: 'money_off', run: () => void this.adjust() });
    if (this.canDelete) list.push({ label: t('Delete sale', 'Futa mauzo'), icon: 'delete', destructive: true, run: () => void this.remove() });
    return list;
  });
  protected readonly canProfit = this.auth.hasAnyPermission(['SALES_VIEW_PROFIT', 'SALES_VIEW_NET_PROFIT']);
  protected readonly canPay = this.auth.hasPermission('PAYMENT_WRITE');
  protected readonly canDelete = this.auth.hasPermission('SALES_DELETE');
  protected readonly canReturn = this.auth.hasPermission('SALES_RETURN_CREATE');
  protected readonly canReadReturns = this.auth.hasPermission('SALES_RETURN_READ');
  protected readonly canAdjust = this.auth.hasAnyPermission(['DEBT_WRITE_OFF', 'DEBT_ADJUST_CREATE']);
  protected readonly canEdit = this.auth.hasPermission('SALES_UPDATE');
  protected readonly canSell = this.auth.hasPermission('SALES_WRITE');
  private readonly cart = inject(CartStore);
  private readonly router = inject(Router);
  protected changed = false;

  constructor() {
    void this.business.profile.load().catch(() => undefined);
  }

  protected type(t: string) {
    return SALE_TYPES[t as SaleType] ?? SALE_TYPES.PIECES;
  }

  protected method(m: string): string {
    return methodLabel(m, this.i18n.isSwahili());
  }

  protected date(v: string | null): Date | null {
    return parseLocal(v);
  }

  protected print(): void {
    printReceipt(this.sale(), this.business.profile.value(), this.i18n.isSwahili());
  }

  protected async pay(): Promise<void> {
    const { SalePaymentDialog } = await import('./sale-payment-dialog');
    const fresh = await this.dialogs.openAsync<Sale>(SalePaymentDialog, { size: 'sm', data: { sale: this.sale() } });
    if (fresh) {
      this.sale.set(fresh.lines.length ? fresh : { ...fresh, lines: this.sale().lines });
      this.changed = true;
    }
  }

  protected async edit(): Promise<void> {
    const { SaleEditDialog } = await import('./sale-edit-dialog');
    const fresh = await this.dialogs.openAsync<Sale>(SaleEditDialog, { size: 'lg', data: { sale: this.sale() } });
    if (fresh) {
      this.changed = true;
      this.sale.set(await this.api.get(this.sale().uid).catch(() => fresh));
    }
  }

  /** Put this sale's items into the till cart (default prices, current stock). */
  protected async sellAgain(): Promise<void> {
    try {
      const products = await this.api.posStock.load();
      let added = 0;
      for (const l of this.sale().lines) {
        const p = products.find((x) => x.uid === l.productUid);
        const type = l.saleType as SaleType;
        if (!p || !p.options.some((o) => o.type === type)) continue;
        this.cart.addMany(p, type, l.saleType === 'PIECES' ? l.pieces : l.packages);
        added++;
      }
      if (!added) {
        this.toast.error(this.i18n.t('None of these products can be sold now.', 'Hakuna bidhaa kati ya hizi inayoweza kuuzwa sasa.'));
        return;
      }
      if (added < this.sale().lines.length) this.toast.info(this.i18n.t('Some items are no longer for sale and were skipped.', 'Baadhi ya bidhaa hazipo tena na zimerukwa.'));
      this.ref.close();
      void this.router.navigate(['/sales/new']);
    } catch (e) {
      this.toast.error(ApiError.from(e).message);
    }
  }

  protected async adjust(): Promise<void> {
    const { DebtAdjustDialog } = await import('./debt-adjust-dialog');
    const done = await this.dialogs.openAsync<boolean>(DebtAdjustDialog, { size: 'md', data: { sale: this.sale() } });
    if (done) {
      this.changed = true;
      this.sale.set(await this.api.get(this.sale().uid).catch(() => this.sale()));
    }
  }

  protected async requestReturn(): Promise<void> {
    const { SaleReturnDialog } = await import('./sale-return-dialog');
    const done = await this.dialogs.openAsync<boolean>(SaleReturnDialog, { size: 'md', data: { sale: this.sale() } });
    if (done) {
      this.changed = true;
      this.sale.set(await this.api.get(this.sale().uid).catch(() => ({ ...this.sale(), hasReturn: true })));
    }
  }

  protected async viewReturn(): Promise<void> {
    try {
      const ret = await this.api.returnByUid(this.sale().returnUid!);
      const { ReturnDetailsDialog } = await import('./return-details-dialog');
      const moved = await this.dialogs.openAsync<boolean>(ReturnDetailsDialog, { size: 'lg', data: { ret } });
      if (moved) this.changed = true;
    } catch (e) {
      this.toast.error(ApiError.from(e).message);
    }
  }

  protected async remove(): Promise<void> {
    const s = this.sale();
    const ok = await this.dialogs.confirmDelete({
      title: this.i18n.t(`Delete sale ${s.receiptNumber}?`, `Futa mauzo ${s.receiptNumber}?`),
      message: this.i18n.t(
        `The ${s.lines.length} item(s) go back into stock and ${Money.format(s.total)} is removed from sales. It can be restored later.`,
        `Bidhaa ${s.lines.length} zitarudi stoo na ${Money.format(s.total)} vitaondolewa kwenye mauzo. Yanaweza kurejeshwa baadaye.`,
      ),
    });
    if (!ok) return;
    try {
      await this.api.remove(s.uid);
      this.toast.success(this.i18n.t('Sale deleted', 'Mauzo yamefutwa'));
      this.ref.close('changed');
    } catch (e) {
      this.toast.error(ApiError.from(e).message);
    }
  }
}
