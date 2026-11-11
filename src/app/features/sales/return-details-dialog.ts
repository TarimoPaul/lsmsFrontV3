import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';

import { ApiError } from '@core/api/api.types';
import { AuthService } from '@core/auth/auth.service';
import { LanguageService } from '@core/i18n/language.service';
import { Button, DialogService, DialogShell, Icon, MoneyInput, TextField, ToastService } from '@shared/ui';
import { parseLocal } from '@shared/utils/date-utils';
import { Money, MoneyPipe } from '@shared/utils/money';
import { PAYMENT_METHODS, RETURN_STATUS, RETURN_TYPES, ReturnCheck, ReturnType, SALE_TYPES, SaleType, SalesReturn, methodLabel, splitRefund } from './sales.models';
import { SalesService } from './sales.service';

export interface ReturnDetailsData {
  ret: SalesReturn;
}

/**
 * One return / exchange request with approve / reject. Approving restocks the
 * good items, lowers the sale, clears what is still owed on it first and pays
 * back only what was really paid (the manager picks how); an exchange also
 * becomes a new sale. Both actions confirm inline first; reject needs a reason.
 */
@Component({
  selector: 'app-return-details-dialog',
  imports: [DialogShell, Button, Icon, MoneyInput, TextField, MoneyPipe, DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let r = ret();
    @let st = status(r.status);
    @let exch = r.type === 'EXCHANGE';
    <lsms-dialog [title]="(exch ? i18n.t('Exchange', 'Kubadilisha') : i18n.t('Return', 'Marejesho')) + ' · ' + r.reference" [icon]="exch ? 'swap_horiz' : 'assignment_return'">
      <header class="head">
        <span class="pill big" [style.--st]="st.color"><lsms-icon [name]="st.icon" [size]="15" [filled]="true" />{{ i18n.isSwahili() ? st.sw : st.en }}</span>
        <span class="pill">{{ type(r.type) }}</span>
        <span class="grow"></span>
        <small class="muted">{{ date(r.requestedAt) | date: 'dd MMM yyyy, HH:mm' }}@if (r.requestedBy) { · {{ r.requestedBy }} }</small>
      </header>

      <section class="sum">
        <div class="big ok"><small>{{ i18n.t('Value back', 'Thamani inayorudi') }}</small><b>{{ r.refund | money }}</b></div>
        <div><small>{{ i18n.t('Pieces', 'Vipande') }}</small><b>{{ r.pieces }}</b></div>
        <div><small>{{ i18n.t('Sale', 'Mauzo') }}</small><b class="mono">{{ r.receiptNumber || '—' }}</b></div>
        <div><small>{{ i18n.t('Customer', 'Mteja') }}</small><b>{{ r.customerName || i18n.t('Walk-in', 'Kawaida') }}</b></div>
      </section>

      @if (done(r.status)) {
        <section class="settle">
          <div><small>{{ i18n.t('Paid back', 'Pesa iliyorudishwa') }}</small><b>{{ r.cash | money }}</b>@if (r.cash > 0) { <small>{{ method(r.refundMethod || 'CASH') }}</small> }</div>
          <div><small>{{ i18n.t('Debt cleared', 'Deni lililopunguzwa') }}</small><b>{{ max0(r.refund - r.cash) | money }}</b></div>
          @if (r.approvedBy) {
            <div><small>{{ i18n.t('Approved by', 'Imeidhinishwa na') }}</small><b>{{ r.approvedBy }}</b></div>
          }
        </section>
      }

      <section class="block">
        <h4><lsms-icon name="inventory_2" [size]="15" />{{ i18n.t('Coming back', 'Zinazorudi') }} <span class="count">{{ r.items.length }}</span></h4>
        <div class="scroll">
          <table>
            <thead>
              <tr>
                <th>{{ i18n.t('Product', 'Bidhaa') }}</th>
                <th class="n">{{ i18n.t('Returned', 'Zimerudi') }}</th>
                <th class="n">{{ i18n.t('Sold', 'Ziliuzwa') }}</th>
                <th class="n">{{ i18n.t('Value', 'Thamani') }}</th>
              </tr>
            </thead>
            <tbody>
              @for (i of r.items; track i.uid) {
                <tr>
                  <td><b>{{ i.productName }}</b>@if (i.category) { <small class="ref">{{ i.category }}</small> }</td>
                  <td class="n">{{ i.display || i.pieces }}<small class="ref" [class.bad]="!i.toStock">{{ i.toStock ? i18n.t('back to stock', 'inarudi stoo') : i18n.t('damaged — not restocked', 'imeharibika — hairudi stoo') }}</small></td>
                  <td class="n">{{ i.soldPieces }}</td>
                  <td class="n strong">{{ i.refund | money: { symbol: false } }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </section>

      @if (exch) {
        <section class="block">
          <h4><lsms-icon name="swap_horiz" [size]="15" />{{ i18n.t('New goods', 'Bidhaa mpya') }} <span class="count">{{ r.exchangeLines.length }}</span></h4>
          <ul class="xl">
            @for (l of r.exchangeLines; track $index) {
              <li><b>{{ productName(l.productUid) }}</b><span>{{ l.packageQuantity }} × {{ saleTypeLabel(l.saleType) }}</span>@if (estimate(l) !== null) { <span class="n">≈ {{ estimate(l)! | money: { symbol: false } }}</span> }</li>
            }
          </ul>
          @if (r.exchangeReceipt) {
            <p class="txt">
              {{ i18n.t('New sale', 'Mauzo mapya') }} <b class="mono">{{ r.exchangeReceipt }}</b> ·
              @if (r.exchangeDifference > 0) { {{ i18n.t('customer added', 'mteja aliongeza') }} {{ r.exchangeDifference | money }} }
              @else if (r.exchangeDifference < 0) { {{ i18n.t('customer got back', 'mteja alirudishiwa') }} {{ -r.exchangeDifference | money }} }
              @else { {{ i18n.t('same value', 'thamani sawa') }} }
            </p>
          } @else if (r.exchangeTopUp > 0) {
            <p class="txt muted">{{ i18n.t('Customer adds', 'Mteja anaongeza') }} {{ r.exchangeTopUp | money }} · {{ method(r.exchangeTopUpMethod || 'CASH') }}</p>
          }
        </section>
      }

      <section class="block">
        <h4><lsms-icon name="notes" [size]="15" />{{ i18n.t('Why', 'Sababu') }}</h4>
        <p class="txt">{{ r.reason || '—' }}</p>
        @if (r.comments) {
          <p class="txt muted">“{{ r.comments }}”</p>
        }
        @if (r.rejectionReason) {
          <p class="txt err">{{ i18n.t('Rejected:', 'Imekataliwa:') }} {{ r.rejectionReason }}</p>
        }
        @if (r.notes) {
          <p class="txt muted small">{{ r.notes }}</p>
        }
      </section>

      @if (step(); as s) {
        <section class="confirm" [class.danger]="s === 'reject'">
          @if (s === 'approve') {
            @if (check(); as c) {
              @let sp = split(c);
              <div class="ln"><span>{{ i18n.t('Clears debt on the sale', 'Inapunguza deni la mauzo') }}</span><b>{{ sp.debt | money }}</b></div>
              @if (exch) {
                <div class="ln"><span>{{ i18n.t('Goes towards the new goods', 'Inalipia bidhaa mpya') }}</span><b>{{ sp.cash | money }}</b></div>
                <div class="ln"><span>{{ i18n.t('New goods (about)', 'Bidhaa mpya (takriban)') }}</span><b>{{ newTotal() | money }}</b></div>
                @if (newTotal() > sp.cash) {
                  <span class="lbl">{{ i18n.t('Customer adds', 'Mteja anaongeza') }}</span>
                  <input lsmsMoneyInput class="amount" [value]="topUpText()" (input)="topUpText.set($any($event.target).value)" [attr.aria-label]="i18n.t('Customer adds', 'Mteja anaongeza')" />
                  <div class="methods" role="radiogroup">
                    @for (m of methods(); track m) {
                      <button type="button" role="radio" [attr.aria-checked]="topUpMethod() === m" [class.on]="topUpMethod() === m" (click)="topUpMethod.set(m)"><lsms-icon [name]="icon(m)" [size]="15" />{{ method(m) }}</button>
                    }
                  </div>
                } @else if (sp.cash > newTotal()) {
                  <div class="ln strong"><span>{{ i18n.t('Change to hand back (cash)', 'Chenji ya kurudisha (taslimu)') }}</span><b>{{ sp.cash - newTotal() | money }}</b></div>
                }
              } @else {
                <div class="ln strong"><span>{{ i18n.t('Money to hand back', 'Pesa ya kumrudishia mteja') }}</span><b>{{ sp.cash | money }}</b></div>
                @if (sp.cash > 0) {
                  <span class="lbl">{{ i18n.t('Paid back with', 'Inarudishwa kwa') }}</span>
                  <div class="methods" role="radiogroup">
                    @for (m of methods(); track m) {
                      <button type="button" role="radio" [attr.aria-checked]="refundMethod() === m" [class.on]="refundMethod() === m" (click)="refundMethod.set(m)"><lsms-icon [name]="icon(m)" [size]="15" />{{ method(m) }}</button>
                    }
                  </div>
                }
              }
            } @else {
              <p class="muted">{{ i18n.t('Working out the money…', 'Inahesabu pesa…') }}</p>
            }
            <p class="hint">
              <lsms-icon name="info" [size]="16" />
              {{ exch ? i18n.t('Good items go back into stock and the new goods become a sale.', 'Bidhaa nzuri zinarudi stoo na bidhaa mpya zinakuwa mauzo.') : i18n.t('Good items go back into stock; damaged ones do not.', 'Bidhaa nzuri zinarudi stoo; zilizoharibika hazirudi.') }}
            </p>
          } @else {
            <p class="hint"><lsms-icon name="warning" [size]="18" />{{ i18n.t('The customer keeps the goods; nothing is refunded.', 'Mteja anabaki na bidhaa; hakuna marejesho ya fedha.') }}</p>
          }
          <lsms-text-field type="textarea" [rows]="2" [maxLength]="300" [required]="s === 'reject'" [label]="s === 'reject' ? i18n.t('Reason for rejecting', 'Sababu ya kukataa') : i18n.t('Notes (optional)', 'Maelezo (hiari)')" (valueChange)="note.set($event)" />
        </section>
      }

      <ng-container dialogActions>
        @if (step()) {
          <button lsmsButton="secondary" [disabled]="busy()" (click)="step.set(null)">{{ i18n.t('Back', 'Rudi') }}</button>
          <button [lsmsButton]="step() === 'reject' ? 'danger' : 'success'" [icon]="step() === 'reject' ? 'cancel' : 'verified'" [loading]="busy()" [disabled]="(step() === 'reject' && !note().trim()) || (step() === 'approve' && !check())" (click)="confirm()">
            {{ step() === 'reject' ? i18n.t('Reject', 'Kataa') : i18n.t('Approve', 'Idhinisha') }}
          </button>
        } @else {
          <button lsmsButton="secondary" (click)="ref.close(changed)">{{ i18n.t('Close', 'Funga') }}</button>
          @if (r.exchangeSaleUid) {
            <button lsmsButton="secondary" icon="receipt_long" (click)="openNewSale()">{{ i18n.t('New sale', 'Mauzo mapya') }}</button>
          }
          @if (r.status === 'PENDING' && canApprove) {
            <button lsmsButton="secondary" icon="cancel" (click)="begin('reject')">{{ i18n.t('Reject', 'Kataa') }}</button>
            <button lsmsButton="success" icon="verified" (click)="begin('approve')">{{ i18n.t('Approve', 'Idhinisha') }}</button>
          }
        }
      </ng-container>
    </lsms-dialog>
  `,
  styles: `
    @use 'detail-dialog';
    @include detail-dialog.base;
    .head { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; margin-bottom: 12px; }
    .head .grow { flex: 1; }
    .pill.big { padding: 4px 12px; font-size: 0.8rem; }
    .mono { font-family: ui-monospace, monospace; font-size: 0.8rem !important; }
    .txt { font-size: 0.86rem; white-space: pre-wrap; }
    .txt + .txt { margin-top: 6px; }
    .txt.err { color: var(--c-error); font-weight: 500; }
    .txt.small { font-size: 0.74rem; }
    .ref.bad { color: var(--c-error); }
    .settle { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 8px; margin-bottom: 12px; }
    .settle div { display: flex; flex-direction: column; padding: 8px 12px; border-radius: 12px; background: var(--c-bg); border: 1px solid var(--c-border); }
    .settle small { font-size: 0.7rem; color: var(--c-text-2); }
    .settle b { font-variant-numeric: tabular-nums; }
    .xl { list-style: none; margin: 0 0 6px; padding: 0; display: flex; flex-direction: column; gap: 4px; }
    .xl li { display: flex; gap: 10px; align-items: baseline; font-size: 0.84rem; }
    .xl li b { flex: 1; min-width: 0; }
    .xl li span { color: var(--c-text-2); }
    .xl .n { font-variant-numeric: tabular-nums; }
    .confirm { display: flex; flex-direction: column; gap: 8px; padding: 12px 14px; border-radius: 14px; background: color-mix(in srgb, var(--c-success) 7%, var(--c-bg)); border: 1px solid color-mix(in srgb, var(--c-success) 25%, transparent); }
    .confirm.danger { background: color-mix(in srgb, var(--c-error) 6%, var(--c-bg)); border-color: color-mix(in srgb, var(--c-error) 25%, transparent); }
    .confirm .hint { display: flex; align-items: center; gap: 8px; margin: 0; font-size: 0.8rem; font-weight: 500; }
    .ln { display: flex; justify-content: space-between; gap: 12px; font-size: 0.84rem; }
    .ln b { font-variant-numeric: tabular-nums; }
    .ln.strong b { font-size: 1.1rem; color: var(--c-success); }
    .lbl { font-size: 0.78rem; font-weight: 500; color: var(--c-text-2); }
    .amount { padding: 8px 10px; border-radius: 10px; border: 1px solid var(--c-border); background: var(--c-surface); font: inherit; font-weight: 600; color: var(--c-text); }
    .methods { display: flex; flex-wrap: wrap; gap: 6px; }
    .methods button { display: inline-flex; align-items: center; gap: 5px; padding: 5px 10px; border-radius: 10px; border: 1px solid var(--c-border); background: var(--c-surface); font: inherit; font-size: 0.76rem; font-weight: 500; color: var(--c-text); cursor: pointer; }
    .methods button.on { color: #fff; background: var(--c-primary); border-color: var(--c-primary); }
  `,
})
export class ReturnDetailsDialog {
  protected readonly data = inject<ReturnDetailsData>(DIALOG_DATA);
  protected readonly ref = inject<DialogRef<boolean>>(DialogRef);
  protected readonly i18n = inject(LanguageService);
  private readonly api = inject(SalesService);
  private readonly dialogs = inject(DialogService);
  private readonly toast = inject(ToastService);

  protected readonly ret = signal<SalesReturn>(this.data.ret);
  protected readonly step = signal<'approve' | 'reject' | null>(null);
  protected readonly note = signal('');
  protected readonly busy = signal(false);
  protected readonly check = signal<ReturnCheck | null>(null);
  protected readonly refundMethod = signal('CASH');
  protected readonly topUpText = signal('');
  protected readonly topUpMethod = signal('CASH');
  protected readonly canApprove = inject(AuthService).hasPermission('SALES_RETURN_APPROVE');
  protected changed = false;

  protected readonly methods = computed(() => (this.api.paymentMethods.value() ?? Object.keys(PAYMENT_METHODS)).filter((m) => m !== 'CREDIT'));
  private readonly products = computed(() => new Map((this.api.posStock.value() ?? []).map((p) => [p.uid, p])));
  protected readonly newTotal = computed(() => this.ret().exchangeLines.reduce((n, l) => n + (this.estimate(l) ?? 0), 0));

  constructor() {
    void this.api.paymentMethods.load().catch(() => undefined);
    if (this.data.ret.type === 'EXCHANGE') void this.api.posStock.load().catch(() => undefined);
  }

  protected status(s: string) {
    return RETURN_STATUS[s] ?? RETURN_STATUS['PENDING'];
  }

  protected done(s: string): boolean {
    return ['APPROVED', 'PROCESSED', 'COMPLETED'].includes(s);
  }

  protected type(t: string): string {
    const x = RETURN_TYPES[t as ReturnType];
    return x ? (this.i18n.isSwahili() ? x.sw : x.en) : t;
  }

  protected saleTypeLabel(t: SaleType): string {
    const x = SALE_TYPES[t];
    return x ? (this.i18n.isSwahili() ? x.sw : x.en) : t;
  }

  protected productName(uid: string): string {
    return this.products().get(uid)?.name ?? this.i18n.t('Product', 'Bidhaa');
  }

  /** Till price of an exchange line — the server prices it the same way on approval. */
  protected estimate(l: { productUid: string; saleType: SaleType; packageQuantity: number }): number | null {
    const price = this.products().get(l.productUid)?.options.find((o) => o.type === l.saleType)?.price;
    return price === undefined ? null : price * l.packageQuantity;
  }

  protected method(m: string): string {
    return methodLabel(m, this.i18n.isSwahili());
  }

  protected icon(m: string): string {
    return PAYMENT_METHODS[m]?.icon ?? 'payments';
  }

  protected max0(n: number): number {
    return Math.max(0, n);
  }

  protected split(c: ReturnCheck) {
    return splitRefund(this.ret().refund, c.owedNow, c.paidNet);
  }

  protected date(v: string | null): Date | null {
    return parseLocal(v);
  }

  protected begin(s: 'approve' | 'reject'): void {
    this.note.set('');
    this.step.set(s);
    if (s !== 'approve') return;
    const r = this.ret();
    this.topUpText.set(r.exchangeTopUp > 0 ? Money.group(String(Math.round(r.exchangeTopUp))) : '');
    this.topUpMethod.set(r.exchangeTopUpMethod || 'CASH');
    // What is owed / paid on the sale NOW decides how much money really goes back.
    this.check.set(null);
    this.api
      .checkReturn(r.saleUid)
      .then((c) => this.check.set(c))
      .catch((e) => {
        this.toast.error(ApiError.from(e).message);
        this.step.set(null);
      });
  }

  protected async confirm(): Promise<void> {
    const s = this.step();
    if (!s) return;
    this.busy.set(true);
    try {
      const exch = this.ret().type === 'EXCHANGE';
      const fresh =
        s === 'approve'
          ? await this.api.approveReturn(this.ret().uid, {
              notes: this.note().trim() || null,
              refundMethod: exch ? 'CASH' : this.refundMethod(),
              ...(exch ? { exchangePaidAmount: Number(this.topUpText().replace(/[^\d.]/g, '')) || 0, exchangePaidMethod: this.topUpMethod() } : {}),
            })
          : await this.api.rejectReturn(this.ret().uid, this.note().trim());
      this.ret.set(fresh.uid ? fresh : { ...this.ret(), status: s === 'approve' ? 'APPROVED' : 'REJECTED' });
      this.toast.success(
        s === 'reject'
          ? this.i18n.t('Rejected', 'Imekataliwa')
          : exch
            ? this.i18n.t(`Exchange approved — new sale ${fresh.exchangeReceipt ?? ''}`, `Kubadilisha kumeidhinishwa — mauzo mapya ${fresh.exchangeReceipt ?? ''}`)
            : this.i18n.t('Return approved', 'Marejesho yameidhinishwa'),
      );
      this.changed = true;
      this.step.set(null);
    } catch (e) {
      this.toast.error(ApiError.from(e).message);
    } finally {
      this.busy.set(false);
    }
  }

  protected async openNewSale(): Promise<void> {
    const uid = this.ret().exchangeSaleUid;
    if (!uid) return;
    try {
      const sale = await this.api.get(uid);
      const { SaleDetailsDialog } = await import('./sale-details-dialog');
      await this.dialogs.openAsync(SaleDetailsDialog, { size: 'lg', data: { sale } });
    } catch (e) {
      this.toast.error(ApiError.from(e).message);
    }
  }
}
