import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';

import { ApiError } from '@core/api/api.types';
import { AuthService } from '@core/auth/auth.service';
import { LanguageService } from '@core/i18n/language.service';
import { Button, DialogService, DialogShell, Icon, Skeleton, TextField, ToastService } from '@shared/ui';
import { parseLocal } from '@shared/utils/date-utils';
import { MoneyPipe } from '@shared/utils/money';
import { PURCHASE_STATUS, Purchase, shortRef } from './purchases.models';
import { PurchasesService } from './purchases.service';

export interface PurchaseDetailsData {
  uid: string;
  /** Row already in hand — shown instantly while the fresh copy loads. */
  purchase?: Purchase;
}

/** `edit` / `buy` ask the page to open the form; `changed` = workflow moved or deleted. */
export type PurchaseDetailsResult = 'edit' | 'buy' | 'changed' | undefined;

type Step = 'approve' | 'receive' | 'cancel';

/**
 * One purchase — port of Flutter `PurchaseDetailsDialog` + the approve /
 * receive / cancel actions from `PurchaseActionsWidget`. v3 adds the status
 * timeline and the product's price history (last purchases, cost trend).
 */
@Component({
  selector: 'app-purchase-details-dialog',
  imports: [DialogShell, Button, Icon, Skeleton, TextField, MoneyPipe, DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <lsms-dialog [title]="i18n.t('Purchase', 'Manunuzi') + (p() ? ' · ' + p()!.productName : '')" icon="shopping_cart">
      @if (p(); as p) {
        @let st = status(p);
        <header class="head">
          <span class="pill big" [style.--st]="st.color"><lsms-icon [name]="st.icon" [size]="15" [filled]="true" />{{ i18n.isSwahili() ? st.sw : st.en }}</span>
          @if (p.reference) {
            <small class="ref-id">{{ ref_(p.reference) }}</small>
          }
          <span class="grow"></span>
          <small class="muted">{{ date(p.purchaseDate) | date: 'dd MMM yyyy, HH:mm' }}</small>
        </header>

        <section class="sum">
          <div class="big ok">
            <small>{{ i18n.t('Total cost', 'Gharama yote') }}</small><b>{{ p.totalCost | money }}</b>
            @if (p.amountPaid > 0) {
              <span class="od"><lsms-icon name="task_alt" [size]="13" />{{ i18n.t('Paid at purchase', 'Ililipwa wakati wa kununua') }} {{ p.amountPaid | money }}</span>
            }
          </div>
          <div><small>{{ i18n.t('Quantity', 'Idadi') }}</small><b>{{ p.quantityDisplay || p.quantity }}</b></div>
          <div><small>{{ i18n.t('Pieces', 'Vipande') }}</small><b>{{ p.totalPieces ?? '—' }}</b></div>
          <div><small>{{ i18n.t('Cost per piece', 'Gharama/kipande') }}</small><b>{{ p.costPerPiece === null ? '—' : (p.costPerPiece | money) }}</b></div>
        </section>

        <div class="cols">
          <section class="block">
            <h4><lsms-icon name="receipt_long" [size]="15" />{{ i18n.t('Details', 'Taarifa') }}</h4>
            <dl>
              <dt>{{ i18n.t('Product', 'Bidhaa') }}</dt><dd>{{ p.productName }}</dd>
              @if (p.categoryName) {
                <dt>{{ i18n.t('Category', 'Kundi') }}</dt><dd>{{ p.categoryName }}</dd>
              }
              <dt>{{ i18n.t('Bought as', 'Imenunuliwa kwa') }}</dt>
              <dd>{{ p.purchaseType === 'INDIVIDUAL_PIECES' ? i18n.t('Pieces', 'Vipande') : i18n.t('Packages', 'Paketi') }}@if (p.piecesPerPackage && p.purchaseType !== 'INDIVIDUAL_PIECES') { (×{{ p.piecesPerPackage }}) }</dd>
              <dt>{{ p.priceInputMode === 'PER_PIECE' ? i18n.t('Price per unit', 'Bei kwa kipimo') : i18n.t('Price entered (total)', 'Bei iliyoingizwa (jumla)') }}</dt>
              <dd>{{ p.purchasePrice | money }}</dd>
              @if (p.discountAmount || p.discountPercentage) {
                <dt>{{ i18n.t('Discount', 'Punguzo') }}</dt>
                <dd>{{ (p.discountAmount ?? 0) | money }}@if (p.discountPercentage) { ({{ p.discountPercentage }}%) }</dd>
              }
              <dt>{{ i18n.t('Supplier', 'Msambazaji') }}</dt><dd>{{ p.supplierName || '—' }}</dd>
              @if (p.minimumStockLevel !== null) {
                <dt>{{ i18n.t('Minimum stock', 'Kiwango cha chini') }}</dt><dd>{{ p.minimumStockLevel }}</dd>
              }
              @if (p.reorderPoint !== null) {
                <dt>{{ i18n.t('Re-order at', 'Agiza tena ikifika') }}</dt><dd>{{ p.reorderPoint }}</dd>
              }
              @if (p.stockDisplay || p.currentStock !== null) {
                <dt>{{ i18n.t('In stock now', 'Mzigo uliopo') }}</dt><dd>{{ p.stockDisplay || p.currentStock }}</dd>
              }
            </dl>
            @if (p.notes) {
              <p class="notes"><lsms-icon name="notes" [size]="14" />{{ p.notes }}</p>
            }
          </section>

          <section class="block">
            <h4><lsms-icon name="timeline" [size]="15" />{{ i18n.t('Progress', 'Hatua') }}</h4>
            <ul class="timeline">
              <li class="done">
                <b>{{ i18n.t('Recorded', 'Imerekodiwa') }}</b>
                <small>{{ date(p.purchaseDate) | date: 'dd MMM yyyy, HH:mm' }}</small>
              </li>
              @if (p.status === 'CANCELLED') {
                @if (p.approvalDate) {
                  <li class="done"><b>{{ i18n.t('Approved', 'Imeidhinishwa') }}</b><small>{{ date(p.approvalDate) | date: 'dd MMM yyyy, HH:mm' }} · {{ p.approvedBy || '—' }}</small></li>
                }
                <li class="bad">
                  <b>{{ i18n.t('Cancelled', 'Imefutwa') }}</b>
                  <small>{{ date(p.cancellationDate) | date: 'dd MMM yyyy, HH:mm' }} · {{ p.cancelledBy || '—' }}</small>
                  @if (p.cancellationReason) {
                    <small class="why">“{{ p.cancellationReason }}”</small>
                  }
                </li>
              } @else {
                <li [class.done]="!!p.approvalDate || p.status === 'APPROVED' || p.status === 'RECEIVED'" [class.now]="p.status === 'PENDING'">
                  <b>{{ i18n.t('Approved — stock added', 'Imeidhinishwa — mzigo umeongezwa') }}</b>
                  @if (p.approvalDate) {
                    <small>{{ date(p.approvalDate) | date: 'dd MMM yyyy, HH:mm' }} · {{ p.approvedBy || '—' }}</small>
                  } @else {
                    <small>{{ i18n.t('Waiting for approval', 'Inasubiri idhini') }}</small>
                  }
                </li>
                <li [class.done]="p.status === 'RECEIVED'" [class.now]="p.status === 'APPROVED'">
                  <b>{{ i18n.t('Received', 'Imepokelewa') }}</b>
                  @if (p.receivingDate) {
                    <small>{{ date(p.receivingDate) | date: 'dd MMM yyyy, HH:mm' }} · {{ p.receivedBy || '—' }}</small>
                  } @else {
                    <small>{{ i18n.t('Not received yet', 'Bado haijapokelewa') }}</small>
                  }
                </li>
              }
            </ul>
          </section>
        </div>

        <section class="block">
          <h4>
            <lsms-icon name="query_stats" [size]="15" />{{ i18n.t('Price history', 'Historia ya bei') }}
            @if (history(); as h) {
              <span class="count">{{ h.length }}</span>
            }
          </h4>
          @if (history(); as h) {
            @if (h.length > 1) {
              <div class="trend">
                <span><small>{{ i18n.t('Lowest', 'Chini') }}</small><b>{{ trend().min | money }}</b></span>
                <span><small>{{ i18n.t('Average', 'Wastani') }}</small><b>{{ trend().avg | money }}</b></span>
                <span><small>{{ i18n.t('Highest', 'Juu') }}</small><b>{{ trend().max | money }}</b></span>
                <span><small>{{ i18n.t('This one', 'Hii') }}</small><b [class.debit]="(p.costPerPiece ?? 0) > trend().avg" [class.credit]="(p.costPerPiece ?? 0) < trend().avg">{{ (p.costPerPiece ?? 0) | money }}</b></span>
              </div>
              <div class="scroll">
                <table>
                  <thead>
                    <tr>
                      <th>{{ i18n.t('Date', 'Tarehe') }}</th>
                      <th>{{ i18n.t('Supplier', 'Msambazaji') }}</th>
                      <th class="n">{{ i18n.t('Qty', 'Idadi') }}</th>
                      <th class="n">{{ i18n.t('Per piece', 'Kwa kipande') }}</th>
                      <th class="n">{{ i18n.t('Total', 'Jumla') }}</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (h of h.slice(0, 12); track h.uid) {
                      <tr [class.me]="h.uid === p.uid">
                        <td class="nowrap">{{ date(h.purchaseDate) | date: 'dd MMM yyyy' }}</td>
                        <td>{{ h.supplierName || '—' }}</td>
                        <td class="n">{{ h.quantityDisplay || h.quantity }}</td>
                        <td class="n strong">{{ h.costPerPiece === null ? '—' : (h.costPerPiece | money: { symbol: false }) }}</td>
                        <td class="n">{{ h.totalCost | money: { symbol: false } }}</td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            } @else {
              <p class="muted">{{ i18n.t('This is the only purchase of this product.', 'Haya ndiyo manunuzi pekee ya bidhaa hii.') }}</p>
            }
          } @else if (historyError()) {
            <p class="muted">{{ historyError() }}</p>
          } @else {
            <lsms-skeleton variant="list" [rows]="3" />
          }
        </section>

        @if (step(); as s) {
          <section class="confirm" [class.danger]="s === 'cancel'">
            <p>
              <lsms-icon [name]="s === 'cancel' ? 'warning' : 'info'" [size]="18" />
              @switch (s) {
                @case ('approve') { {{ i18n.t('Approving adds ' + (p.totalPieces ?? p.quantity) + ' pieces to stock and records the cost.', 'Kuidhinisha kunaongeza vipande ' + (p.totalPieces ?? p.quantity) + ' kwenye mzigo na kurekodi gharama.') }} }
                @case ('receive') { {{ i18n.t('Confirm the goods have arrived. This closes the purchase.', 'Thibitisha mzigo umefika. Hii inafunga manunuzi.') }} }
                @case ('cancel') { {{ p.status === 'APPROVED' ? i18n.t('The stock added on approval will be removed again.', 'Mzigo ulioongezwa wakati wa kuidhinisha utaondolewa.') : i18n.t('The purchase will be cancelled.', 'Manunuzi yatafutwa.') }} }
              }
            </p>
            <lsms-text-field
              type="textarea"
              [rows]="2"
              [maxLength]="500"
              [autofocus]="true"
              [required]="s === 'cancel'"
              [label]="s === 'cancel' ? i18n.t('Reason for cancelling', 'Sababu ya kufuta') : i18n.t('Notes (optional)', 'Maelezo (hiari)')"
              (valueChange)="note.set($event)"
            />
          </section>
        }
      } @else if (error()) {
        <p class="err"><lsms-icon name="error" [size]="18" />{{ error() }}</p>
      } @else {
        <lsms-skeleton variant="list" [rows]="6" />
      }

      <ng-container dialogActions>
        @if (step()) {
          <button lsmsButton="secondary" (click)="step.set(null)" [disabled]="busy()">{{ i18n.t('Back', 'Rudi') }}</button>
          <button
            [lsmsButton]="step() === 'cancel' ? 'danger' : 'primary'"
            [icon]="step() === 'approve' ? 'verified' : step() === 'receive' ? 'inventory' : 'block'"
            [loading]="busy()"
            [disabled]="step() === 'cancel' && !note().trim()"
            (click)="confirm()"
          >
            {{ step() === 'approve' ? i18n.t('Approve', 'Idhinisha') : step() === 'receive' ? i18n.t('Mark received', 'Thibitisha kupokelewa') : i18n.t('Cancel purchase', 'Futa manunuzi') }}
          </button>
        } @else {
          <button lsmsButton="secondary" (click)="ref.close(changed ? 'changed' : undefined)">{{ i18n.t('Close', 'Funga') }}</button>
          @if (p(); as p) {
            @if (p.status === 'PENDING' && can('PURCHASE_DELETE')) {
              <button lsmsButton="text" icon="delete" class="del" (click)="remove(p)">{{ i18n.t('Delete', 'Futa') }}</button>
            }
            @if ((p.status === 'PENDING' || p.status === 'APPROVED') && can('PURCHASE_CANCEL')) {
              <button lsmsButton="secondary" icon="block" (click)="begin('cancel')">{{ i18n.t('Cancel', 'Futa') }}</button>
            }
            @if (p.status === 'PENDING' && can('PURCHASE_UPDATE')) {
              <button lsmsButton="secondary" icon="edit" (click)="ref.close('edit')">{{ i18n.t('Edit', 'Hariri') }}</button>
            }
            @if (p.status === 'PENDING' && can('PURCHASE_APPROVE')) {
              <button lsmsButton icon="verified" (click)="begin('approve')">{{ i18n.t('Approve', 'Idhinisha') }}</button>
            } @else if (p.status === 'APPROVED' && can('PURCHASE_RECEIVE')) {
              <button lsmsButton icon="inventory" (click)="begin('receive')">{{ i18n.t('Mark received', 'Thibitisha kupokelewa') }}</button>
            } @else if ((p.status === 'RECEIVED' || p.status === 'CANCELLED') && can('PURCHASE_WRITE')) {
              <button lsmsButton icon="add_shopping_cart" (click)="ref.close('buy')">{{ i18n.t('Buy again', 'Nunua tena') }}</button>
            }
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
    .ref-id { font-family: ui-monospace, monospace; font-size: 0.74rem; color: var(--c-text-2); }
    .cols { display: grid; grid-template-columns: 1.3fr 1fr; gap: 12px; }
    .cols .block { margin-bottom: 12px; }
    @media (max-width: 700px) { .cols { grid-template-columns: 1fr; gap: 0; } }
    dl { display: grid; grid-template-columns: auto 1fr; gap: 8px 14px; margin: 0; font-size: 0.84rem; }
    dt { color: var(--c-text-2); }
    dd { margin: 0; font-weight: 600; text-align: right; }
    .notes { display: flex; gap: 6px; margin-top: 10px; padding-top: 10px; border-top: 1px dashed var(--c-border); font-size: 0.82rem; color: var(--c-text-2); white-space: pre-wrap; }
    .timeline { list-style: none; margin: 0; padding: 0 0 0 14px; border-left: 2px solid var(--c-border); }
    .timeline li { position: relative; padding: 0 0 14px 12px; font-size: 0.82rem; color: var(--c-text-2); }
    .timeline li:last-child { padding-bottom: 0; }
    .timeline li::before { content: ''; position: absolute; left: -21px; top: 3px; width: 12px; height: 12px; border-radius: 50%; background: var(--c-surface); border: 2px solid var(--c-border); }
    .timeline li.done { color: var(--c-text); }
    .timeline li.done::before { background: var(--c-success); border-color: var(--c-success); }
    .timeline li.now::before { background: var(--c-warning); border-color: var(--c-warning); box-shadow: 0 0 0 4px color-mix(in srgb, var(--c-warning) 25%, transparent); }
    .timeline li.bad { color: var(--c-error); }
    .timeline li.bad::before { background: var(--c-error); border-color: var(--c-error); }
    .timeline b { display: block; }
    .timeline small { display: block; color: var(--c-text-2); }
    .timeline .why { font-style: italic; }
    .trend { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; margin-bottom: 10px; }
    .trend span { display: flex; flex-direction: column; padding: 6px 10px; border-radius: 10px; background: var(--c-surface); border: 1px solid var(--c-border); }
    .trend small { font-size: 0.7rem; color: var(--c-text-2); }
    .trend b { font-size: 0.86rem; font-variant-numeric: tabular-nums; }
    @media (max-width: 600px) { .trend { grid-template-columns: 1fr 1fr; } }
    .scroll { max-height: 240px; }
    tr.me td { background: color-mix(in srgb, var(--c-primary) 8%, transparent); }
    .confirm { padding: 12px 14px; border-radius: 14px; background: color-mix(in srgb, var(--c-info) 7%, var(--c-bg)); border: 1px solid color-mix(in srgb, var(--c-info) 25%, transparent); }
    .confirm.danger { background: color-mix(in srgb, var(--c-error) 6%, var(--c-bg)); border-color: color-mix(in srgb, var(--c-error) 25%, transparent); }
    .confirm p { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; font-size: 0.84rem; font-weight: 600; }
    .del { --btn-fg: var(--c-error); margin-right: auto; }
  `,
})
export class PurchaseDetailsDialog {
  protected readonly data = inject<PurchaseDetailsData>(DIALOG_DATA);
  protected readonly ref = inject<DialogRef<PurchaseDetailsResult>>(DialogRef);
  protected readonly i18n = inject(LanguageService);
  private readonly auth = inject(AuthService);
  private readonly api = inject(PurchasesService);
  private readonly dialogs = inject(DialogService);
  private readonly toast = inject(ToastService);

  protected readonly p = signal<Purchase | null>(this.data.purchase ?? null);
  protected readonly error = signal<string | null>(null);
  protected readonly history = signal<Purchase[] | null>(null);
  protected readonly historyError = signal<string | null>(null);
  protected readonly step = signal<Step | null>(null);
  protected readonly note = signal('');
  protected readonly busy = signal(false);
  protected changed = false;

  protected readonly trend = computed(() => {
    const costs = (this.history() ?? []).map((h) => h.costPerPiece).filter((c): c is number => c !== null && c > 0);
    if (!costs.length) return { min: 0, max: 0, avg: 0 };
    return { min: Math.min(...costs), max: Math.max(...costs), avg: costs.reduce((a, b) => a + b, 0) / costs.length };
  });

  constructor() {
    void this.load();
  }

  private async load(): Promise<void> {
    try {
      const fresh = await this.api.get(this.data.uid);
      this.p.set(fresh);
      if (this.history() === null) void this.loadHistory(fresh.productUid);
    } catch (e) {
      if (!this.p()) this.error.set(ApiError.from(e).message);
      else if (this.history() === null) void this.loadHistory(this.p()!.productUid);
    }
  }

  private async loadHistory(productUid: string): Promise<void> {
    try {
      this.history.set(await this.api.byProduct(productUid));
    } catch (e) {
      this.historyError.set(ApiError.from(e).message);
    }
  }

  protected can(permission: string): boolean {
    return this.auth.hasPermission(permission);
  }

  protected status(p: Purchase) {
    return PURCHASE_STATUS[p.status];
  }

  protected date(v: string | null): Date | null {
    return parseLocal(v);
  }

  protected ref_(r: string): string {
    return shortRef(r);
  }

  protected begin(s: Step): void {
    this.note.set('');
    this.step.set(s);
  }

  protected async confirm(): Promise<void> {
    const s = this.step();
    const p = this.p();
    if (!s || !p) return;
    const note = this.note().trim();
    this.busy.set(true);
    try {
      if (s === 'approve') await this.api.approve(p.uid, note);
      else if (s === 'receive') await this.api.receive(p.uid, note);
      else await this.api.cancel(p.uid, note);
      const t = (en: string, sw: string) => this.i18n.t(en, sw);
      this.toast.success(
        s === 'approve' ? t('Purchase approved — stock updated', 'Manunuzi yameidhinishwa — mzigo umesasishwa') : s === 'receive' ? t('Purchase marked as received', 'Manunuzi yamepokelewa') : t('Purchase cancelled', 'Manunuzi yamefutwa'),
      );
      this.changed = true;
      this.step.set(null);
      await this.load();
    } catch (e) {
      this.toast.error(ApiError.from(e).message);
    } finally {
      this.busy.set(false);
    }
  }

  protected async remove(p: Purchase): Promise<void> {
    const ok = await this.dialogs.confirmDelete({
      title: this.i18n.t('Delete this purchase?', 'Futa manunuzi haya?'),
      message: this.i18n.t(`The pending purchase of ${p.productName} will be removed. Stock is not affected.`, `Manunuzi yanayosubiri ya ${p.productName} yataondolewa. Mzigo hauathiriki.`),
    });
    if (!ok) return;
    try {
      await this.api.remove(p.uid);
      this.toast.success(this.i18n.t('Purchase deleted', 'Manunuzi yamefutwa'));
      this.ref.close('changed');
    } catch (e) {
      this.toast.error(ApiError.from(e).message);
    }
  }
}
