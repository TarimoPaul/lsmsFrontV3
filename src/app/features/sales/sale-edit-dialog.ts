import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';

import { ApiError } from '@core/api/api.types';
import { AuthService } from '@core/auth/auth.service';
import { LanguageService } from '@core/i18n/language.service';
import { Button, DialogShell, Icon, ToastService } from '@shared/ui';
import { addDays, parseLocal, toIsoDate, toLocalDateTime } from '@shared/utils/date-utils';
import { MoneyPipe } from '@shared/utils/money';
import { SALE_TYPES, Sale, SaleLine, SaleType } from './sales.models';
import { SalesService } from './sales.service';

export interface SaleEditData {
  sale: Sale;
}

interface EditLine {
  line: SaleLine;
  /** Units of the sale type (packages, or pieces for retail). */
  qty: number;
  price: number;
  removed: boolean;
}

/**
 * Correct a recorded sale — port of Flutter `SaleEditDialog`: change line
 * quantities / prices, remove lines, discount, date and notes. The server
 * re-posts stock and the ledger for every changed line, so only what changed
 * is sent (remove → update → sale fields), exactly like Flutter.
 */
@Component({
  selector: 'app-sale-edit-dialog',
  imports: [DialogShell, Button, Icon, MoneyPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <lsms-dialog [title]="i18n.t('Edit sale', 'Hariri mauzo') + ' · ' + data.sale.receiptNumber" icon="edit">
      <p class="warn"><lsms-icon name="info" [size]="16" />{{ i18n.t('Changes adjust stock and the books. Payments already received stay as they are.', 'Mabadiliko yanarekebisha stoo na hesabu. Malipo yaliyopokelewa hayabadiliki.') }}</p>

      <ul class="lines">
        @for (e of lines(); track e.line.uid; let i = $index) {
          <li [class.removed]="e.removed">
            <span class="nm">
              <b>{{ e.line.productName }}</b>
              <small><span class="tp" [style.--pc]="color(e.line.saleType)">{{ typeName(e.line.saleType) }}</span> {{ e.qty * unitPieces(e.line) }} {{ i18n.t('pcs', 'vip') }}</small>
            </span>
            @if (!e.removed) {
              <span class="stepper">
                <button type="button" (click)="setQty(i, e.qty - 1)" [attr.aria-label]="i18n.t('Less', 'Punguza')"><lsms-icon name="remove" [size]="16" /></button>
                <input type="text" inputmode="numeric" [value]="e.qty" (change)="setQty(i, +$any($event.target).value)" [attr.aria-label]="i18n.t('Quantity', 'Idadi')" />
                <button type="button" (click)="setQty(i, e.qty + 1)" [attr.aria-label]="i18n.t('More', 'Ongeza')"><lsms-icon name="add" [size]="16" /></button>
              </span>
              <span class="x">×</span>
              <input class="price" type="text" inputmode="numeric" [value]="e.price" (change)="setPrice(i, $any($event.target).value)" [attr.aria-label]="i18n.t('Price', 'Bei')" />
              <b class="sub">{{ e.qty * e.price | money: { symbol: false } }}</b>
              <button type="button" class="rm" (click)="toggle(i)" [attr.aria-label]="i18n.t('Remove', 'Ondoa')" [title]="i18n.t('Remove', 'Ondoa')"><lsms-icon name="delete" [size]="17" /></button>
            } @else {
              <span class="gone">{{ i18n.t('Will be removed', 'Itaondolewa') }}</span>
              <button type="button" class="undo" (click)="toggle(i)">{{ i18n.t('Undo', 'Rudisha') }}</button>
            }
          </li>
        }
      </ul>

      <div class="fields">
        <label>
          <span>{{ i18n.t('Discount', 'Punguzo') }}</span>
          <input type="text" inputmode="numeric" [value]="discount()" (change)="discount.set(num($any($event.target).value))" />
        </label>
        @if (canBackdate) {
          <label>
            <span>{{ i18n.t('Sale date', 'Tarehe ya mauzo') }}</span>
            <input type="date" [min]="minDate" [max]="today" [value]="date()" (change)="date.set($any($event.target).value || date())" />
          </label>
        }
        <label class="wide">
          <span>{{ i18n.t('Notes', 'Maelezo') }}</span>
          <textarea rows="2" maxlength="1000" [value]="notes()" (input)="notes.set($any($event.target).value)"></textarea>
        </label>
      </div>

      <div class="totals">
        <span>{{ i18n.t('Was', 'Ilikuwa') }} <b>{{ data.sale.total | money }}</b></span>
        <lsms-icon name="arrow_forward" [size]="16" />
        <span>{{ i18n.t('Now', 'Sasa') }} <b [class.up]="total() > data.sale.total" [class.down]="total() < data.sale.total">{{ total() | money }}</b></span>
        @if (total() < data.sale.paid) {
          <small class="over">{{ i18n.t('Less than already paid — refund the difference.', 'Chini ya kilicholipwa — rudisha tofauti.') }}</small>
        }
      </div>

      <ng-container dialogActions>
        <button lsmsButton="secondary" (click)="ref.close()">{{ i18n.t('Cancel', 'Ghairi') }}</button>
        <button lsmsButton icon="save" [loading]="busy()" [disabled]="!dirty() || !valid()" (click)="save()">{{ i18n.t('Save changes', 'Hifadhi mabadiliko') }}</button>
      </ng-container>
    </lsms-dialog>
  `,
  styles: `
    .warn { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; padding: 10px 12px; border-radius: 12px; font-size: 0.8rem; color: var(--c-info); background: color-mix(in srgb, var(--c-info) 8%, var(--c-bg)); }
    .lines { list-style: none; margin: 0 0 12px; padding: 0; display: flex; flex-direction: column; gap: 6px; }
    .lines li { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; padding: 8px 10px; border-radius: 12px; background: var(--c-bg); border: 1px solid var(--c-border); }
    .lines li.removed { opacity: 0.6; background: color-mix(in srgb, var(--c-error) 5%, var(--c-bg)); }
    .nm { display: flex; flex-direction: column; flex: 1; min-width: 160px; }
    .nm b { font-size: 0.84rem; }
    .nm small { font-size: 0.7rem; color: var(--c-text-2); }
    .tp { --pc: var(--c-primary); margin-right: 4px; padding: 0 6px; border-radius: 6px; font-weight: 700; color: var(--pc); background: color-mix(in srgb, var(--pc) 12%, transparent); }
    .stepper { display: inline-flex; align-items: center; border-radius: 9px; border: 1px solid var(--c-border); background: var(--c-surface); overflow: hidden; }
    .stepper button { display: inline-flex; padding: 4px 6px; border: 0; background: transparent; color: var(--c-text); cursor: pointer; }
    .stepper input { width: 38px; border: 0; text-align: center; font: inherit; font-size: 0.84rem; font-weight: 700; background: transparent; color: var(--c-text); outline: none; }
    .x { color: var(--c-text-2); }
    .price, .fields input, .fields textarea { padding: 5px 8px; border: 1px solid var(--c-border); border-radius: 8px; font: inherit; font-size: 0.84rem; background: var(--c-surface); color: var(--c-text); outline: none; }
    .price { width: 90px; text-align: right; }
    .price:focus, .fields input:focus, .fields textarea:focus { border-color: var(--c-primary); }
    .sub { min-width: 80px; text-align: right; font-variant-numeric: tabular-nums; }
    .rm, .undo { display: inline-flex; padding: 4px; border: 0; border-radius: 8px; background: transparent; color: var(--c-error); cursor: pointer; font: inherit; font-size: 0.8rem; font-weight: 700; }
    .undo { color: var(--c-primary); }
    .gone { font-size: 0.78rem; font-weight: 600; color: var(--c-error); }
    .fields { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
    .fields label { display: flex; flex-direction: column; gap: 4px; font-size: 0.78rem; font-weight: 600; color: var(--c-text-2); }
    .fields .wide { grid-column: 1 / -1; }
    .fields textarea { resize: vertical; }
    @media (max-width: 560px) { .fields { grid-template-columns: 1fr; } }
    .totals { display: flex; align-items: center; flex-wrap: wrap; gap: 8px 12px; margin-top: 12px; padding: 12px 14px; border-radius: 12px; background: color-mix(in srgb, var(--c-primary) 6%, var(--c-bg)); font-size: 0.86rem; }
    .totals b { font-variant-numeric: tabular-nums; }
    .totals .up { color: var(--c-success); }
    .totals .down { color: var(--c-error); }
    .totals .over { flex-basis: 100%; color: var(--c-error); font-weight: 600; }
  `,
})
export class SaleEditDialog {
  protected readonly data = inject<SaleEditData>(DIALOG_DATA);
  protected readonly ref = inject<DialogRef<Sale>>(DialogRef);
  protected readonly i18n = inject(LanguageService);
  private readonly auth = inject(AuthService);
  private readonly api = inject(SalesService);
  private readonly toast = inject(ToastService);

  private readonly original = this.data.sale;
  protected readonly lines = signal<EditLine[]>(this.original.lines.map((l) => ({ line: l, qty: this.units(l), price: l.unitPrice, removed: false })));
  protected readonly discount = signal(this.original.discount);
  protected readonly notes = signal(this.original.notes ?? '');
  private readonly originalDate = toIsoDate(parseLocal(this.original.saleDate) ?? new Date());
  protected readonly date = signal(this.originalDate);
  protected readonly busy = signal(false);

  protected readonly canBackdate = this.auth.maxBackdateDays() > 0;
  protected readonly today = toIsoDate(new Date());
  protected readonly minDate = toIsoDate(addDays(new Date(), -Math.min(this.auth.maxBackdateDays(), 3650)));

  protected readonly total = computed(() => Math.max(0, this.lines().filter((e) => !e.removed).reduce((n, e) => n + e.qty * e.price, 0) - this.discount()));
  protected readonly dirty = computed(
    () =>
      this.lines().some((e) => e.removed || e.qty !== this.units(e.line) || e.price !== e.line.unitPrice) ||
      this.discount() !== this.original.discount ||
      this.notes() !== (this.original.notes ?? '') ||
      this.date() !== this.originalDate,
  );
  protected readonly valid = computed(() => this.lines().some((e) => !e.removed) && this.lines().every((e) => e.removed || (e.qty > 0 && e.price > 0)) && this.total() > 0);

  protected units(l: SaleLine): number {
    return l.saleType === 'PIECES' ? l.pieces : l.packages;
  }

  protected unitPieces(l: SaleLine): number {
    const u = this.units(l);
    return u > 0 ? Math.max(1, Math.round(l.pieces / u)) : 1;
  }

  protected typeName(t: string): string {
    const x = SALE_TYPES[t as SaleType];
    return x ? (this.i18n.isSwahili() ? x.sw : x.en) : t;
  }

  protected color(t: string): string {
    return SALE_TYPES[t as SaleType]?.color ?? 'var(--c-primary)';
  }

  protected num(v: string): number {
    return Math.max(0, Math.round(Number(String(v).replace(/[^\d.]/g, '')) || 0));
  }

  protected setQty(i: number, q: number): void {
    const v = Math.max(1, Math.floor(Number(q) || 1));
    this.lines.update((ls) => ls.map((e, j) => (j === i ? { ...e, qty: v } : e)));
  }

  protected setPrice(i: number, v: string): void {
    const p = this.num(v);
    if (p > 0) this.lines.update((ls) => ls.map((e, j) => (j === i ? { ...e, price: p } : e)));
  }

  protected toggle(i: number): void {
    this.lines.update((ls) => ls.map((e, j) => (j === i ? { ...e, removed: !e.removed } : e)));
  }

  protected async save(): Promise<void> {
    if (!this.dirty() || !this.valid() || this.busy()) return;
    this.busy.set(true);
    try {
      for (const e of this.lines().filter((x) => x.removed)) await this.api.removeLine(e.line.uid);
      for (const e of this.lines().filter((x) => !x.removed && (x.qty !== this.units(x.line) || x.price !== x.line.unitPrice))) {
        const l = e.line;
        await this.api.updateLine(l.uid, {
          uid: l.uid,
          productUid: l.productUid,
          productName: l.productName,
          saleType: l.saleType,
          pieceQuantity: e.qty * this.unitPieces(l),
          packageQuantity: e.qty,
          unitPrice: e.price,
          subTotal: e.qty * e.price,
          overrideUnitPrice: e.price !== l.unitPrice || l.priceOverridden ? e.price : null,
        });
      }
      const at = parseLocal(this.date()) ?? new Date();
      const old = parseLocal(this.original.saleDate) ?? new Date();
      at.setHours(old.getHours(), old.getMinutes(), old.getSeconds());
      const fresh = await this.api.updateSale(this.original.uid, {
        uid: this.original.uid,
        saleDate: toLocalDateTime(at),
        discountAmount: this.discount(),
        saleNotes: this.notes().trim() || null,
        customerUid: this.original.customerUid,
      });
      this.toast.success(this.i18n.t('Sale updated', 'Mauzo yamesasishwa'));
      this.ref.close(fresh);
    } catch (e) {
      this.toast.error(ApiError.from(e).message);
    } finally {
      this.busy.set(false);
    }
  }
}
