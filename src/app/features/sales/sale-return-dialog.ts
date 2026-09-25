import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';

import { ApiError } from '@core/api/api.types';
import { LanguageService } from '@core/i18n/language.service';
import { Button, DialogShell, Icon, Skeleton, TextField, ToastService } from '@shared/ui';
import { MoneyPipe } from '@shared/utils/money';
import { RETURN_TYPES, ReturnCheck, ReturnType, Sale } from './sales.models';
import { SalesService } from './sales.service';

export interface SaleReturnData {
  sale: Sale;
}

interface Row {
  productUid: string;
  name: string;
  sold: number;
  /** Refund per piece (what the customer actually paid per piece). */
  perPiece: number;
}

/**
 * Request a return for a sale — port of Flutter's return dialog: pick the
 * pieces coming back per product, the kind of return and a reason. The
 * request waits for approval (SALES_RETURN_APPROVE), which restocks and
 * refunds. The backend's 30-day window / stock checks are shown up front.
 */
@Component({
  selector: 'app-sale-return-dialog',
  imports: [DialogShell, Button, Icon, Skeleton, TextField, MoneyPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <lsms-dialog [title]="i18n.t('Return items', 'Rudisha bidhaa') + ' · ' + data.sale.receiptNumber" icon="assignment_return">
      @if (check() === null) {
        <lsms-skeleton variant="list" [rows]="3" />
      } @else {
        @let c = check()!;
        @if (!c.valid) {
          <div class="banner err">
            <lsms-icon name="block" [size]="18" [filled]="true" />
            <span>
              <b>{{ i18n.t('This sale cannot be returned', 'Mauzo haya hayawezi kurudishwa') }}</b>
              @for (e of c.errors; track e) {
                <small>{{ e }}</small>
              }
            </span>
          </div>
        } @else if (c.warnings.length) {
          <div class="banner warn">
            <lsms-icon name="warning" [size]="18" />
            <span>
              @for (w of c.warnings; track w) {
                <small>{{ w }}</small>
              }
            </span>
          </div>
        }

        <fieldset [disabled]="!c.valid">
          <span class="lbl">{{ i18n.t('Kind of return', 'Aina ya kurudisha') }}</span>
          <div class="types" role="radiogroup">
            @for (t of typeKeys; track t) {
              <button type="button" role="radio" [attr.aria-checked]="type() === t" [class.on]="type() === t" (click)="setType(t)">
                <b>{{ i18n.isSwahili() ? types[t].sw : types[t].en }}</b>
                <small>{{ i18n.isSwahili() ? types[t].hint.sw : types[t].hint.en }}</small>
              </button>
            }
          </div>

          <div class="rows-head">
            <span class="lbl">{{ i18n.t('Pieces coming back', 'Vipande vinavyorudi') }}</span>
            <button type="button" class="link" (click)="all()">{{ i18n.t('Everything', 'Vyote') }}</button>
          </div>
          <ul class="rows">
            @for (r of rows; track r.productUid) {
              <li>
                <span class="nm"><b>{{ r.name }}</b><small>{{ i18n.t('Sold', 'Viliuzwa') }} {{ r.sold }} {{ i18n.t('pcs', 'vip') }} · {{ r.perPiece | money: { symbol: false } }}/{{ i18n.t('pc', 'kip') }}</small></span>
                <span class="stepper">
                  <button type="button" (click)="set(r, qty(r) - 1)" [attr.aria-label]="i18n.t('Less', 'Punguza')"><lsms-icon name="remove" [size]="16" /></button>
                  <input type="text" inputmode="numeric" [value]="qty(r)" (change)="set(r, +$any($event.target).value)" [attr.aria-label]="r.name" />
                  <button type="button" (click)="set(r, qty(r) + 1)" [attr.aria-label]="i18n.t('More', 'Ongeza')"><lsms-icon name="add" [size]="16" /></button>
                </span>
                <b class="amt">{{ qty(r) * r.perPiece | money: { symbol: false } }}</b>
              </li>
            }
          </ul>

          <lsms-text-field type="textarea" [rows]="2" [maxLength]="300" [required]="true" [label]="i18n.t('Reason', 'Sababu')" (valueChange)="reason.set($event)" />
          <lsms-text-field [maxLength]="300" [label]="i18n.t('Customer comments (optional)', 'Maoni ya mteja (hiari)')" (valueChange)="comments.set($event)" />
        </fieldset>

        <div class="refund">
          <span>{{ i18n.t('Refund if approved', 'Marejesho yakiidhinishwa') }} <small>· {{ pieces() }} {{ i18n.t('pcs', 'vip') }}</small></span>
          <b>{{ refund() | money }}</b>
        </div>
      }

      <ng-container dialogActions>
        <button lsmsButton="secondary" (click)="ref.close()">{{ i18n.t('Cancel', 'Ghairi') }}</button>
        <button lsmsButton icon="send" [loading]="busy()" [disabled]="!canSend()" (click)="send()">{{ i18n.t('Request return', 'Omba kurudisha') }}</button>
      </ng-container>
    </lsms-dialog>
  `,
  styles: `
    :host { display: block; }
    fieldset { display: flex; flex-direction: column; gap: 10px; margin: 0; padding: 0; border: 0; min-width: 0; }
    fieldset:disabled { opacity: 0.45; }
    .banner { display: flex; gap: 10px; margin-bottom: 12px; padding: 10px 12px; border-radius: 12px; font-size: 0.84rem; }
    .banner span { display: flex; flex-direction: column; gap: 2px; }
    .banner.err { color: var(--c-error); background: color-mix(in srgb, var(--c-error) 7%, var(--c-bg)); border: 1px solid color-mix(in srgb, var(--c-error) 28%, transparent); }
    .banner.warn { color: var(--c-warning); background: color-mix(in srgb, var(--c-warning) 8%, var(--c-bg)); }
    .lbl { font-size: 0.8rem; font-weight: 600; color: var(--c-text-2); }
    .types { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
    .types button { display: flex; flex-direction: column; gap: 2px; padding: 10px; border-radius: 12px; border: 1px solid var(--c-border); background: var(--c-surface); font: inherit; text-align: left; color: var(--c-text); cursor: pointer; }
    .types button b { font-size: 0.84rem; }
    .types button small { font-size: 0.7rem; color: var(--c-text-2); }
    .types button.on { border-color: var(--c-primary); box-shadow: 0 0 0 1px var(--c-primary); background: color-mix(in srgb, var(--c-primary) 6%, var(--c-surface)); }
    @media (max-width: 560px) { .types { grid-template-columns: 1fr; } }
    .rows-head { display: flex; align-items: center; justify-content: space-between; }
    .link { padding: 0; border: 0; background: none; font: inherit; font-size: 0.78rem; font-weight: 700; color: var(--c-primary); cursor: pointer; }
    .rows { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
    .rows li { display: flex; align-items: center; gap: 10px; padding: 8px 10px; border-radius: 12px; background: var(--c-bg); border: 1px solid var(--c-border); }
    .nm { display: flex; flex-direction: column; flex: 1; min-width: 0; }
    .nm b { font-size: 0.84rem; }
    .nm small { font-size: 0.7rem; color: var(--c-text-2); }
    .amt { min-width: 70px; text-align: right; font-variant-numeric: tabular-nums; }
    .stepper { display: inline-flex; align-items: center; border-radius: 9px; border: 1px solid var(--c-border); background: var(--c-surface); overflow: hidden; }
    .stepper button { display: inline-flex; padding: 4px 6px; border: 0; background: transparent; color: var(--c-text); cursor: pointer; }
    .stepper input { width: 40px; border: 0; text-align: center; font: inherit; font-size: 0.84rem; font-weight: 700; background: transparent; color: var(--c-text); outline: none; }
    .refund { display: flex; justify-content: space-between; align-items: baseline; margin-top: 12px; padding: 12px 14px; border-radius: 12px; background: color-mix(in srgb, var(--c-primary) 6%, var(--c-bg)); }
    .refund small { color: var(--c-text-2); }
    .refund b { font-size: 1.2rem; font-weight: 800; font-variant-numeric: tabular-nums; color: var(--c-primary); }
  `,
})
export class SaleReturnDialog {
  protected readonly data = inject<SaleReturnData>(DIALOG_DATA);
  protected readonly ref = inject<DialogRef<boolean>>(DialogRef);
  protected readonly i18n = inject(LanguageService);
  private readonly api = inject(SalesService);
  private readonly toast = inject(ToastService);

  protected readonly types = RETURN_TYPES;
  protected readonly typeKeys: ReturnType[] = ['FULL_RETURN', 'PARTIAL_RETURN', 'DAMAGED_RETURN'];
  protected readonly check = signal<ReturnCheck | null>(null);
  protected readonly type = signal<ReturnType>('FULL_RETURN');
  protected readonly reason = signal('');
  protected readonly comments = signal('');
  protected readonly busy = signal(false);
  private readonly qtys = signal<Record<string, number>>({});

  /** One row per product (a sale can sell the same product as pieces and as packs). */
  protected readonly rows: Row[] = (() => {
    const m = new Map<string, Row & { amount: number }>();
    for (const l of this.data.sale.lines) {
      const r = m.get(l.productUid) ?? { productUid: l.productUid, name: l.productName, sold: 0, perPiece: 0, amount: 0 };
      r.sold += l.pieces;
      r.amount += l.subTotal;
      m.set(l.productUid, r);
    }
    return [...m.values()].map((r) => ({ productUid: r.productUid, name: r.name, sold: r.sold, perPiece: r.sold ? Math.round((r.amount / r.sold) * 100) / 100 : 0 }));
  })();

  protected readonly pieces = computed(() => Object.values(this.qtys()).reduce((a, b) => a + b, 0));
  protected readonly refund = computed(() => this.rows.reduce((n, r) => n + (this.qtys()[r.productUid] ?? 0) * r.perPiece, 0));
  protected readonly canSend = computed(() => !!this.check()?.valid && this.pieces() > 0 && this.reason().trim().length >= 3 && !this.busy());

  constructor() {
    this.all();
    this.api
      .checkReturn(this.data.sale.uid)
      .then((c) => this.check.set(c))
      .catch((e) => this.check.set({ valid: false, errors: [ApiError.from(e).message], warnings: [], daysFromSale: null, withinWindow: false, estimatedRefund: null }));
  }

  protected qty(r: Row): number {
    return this.qtys()[r.productUid] ?? 0;
  }

  protected set(r: Row, n: number): void {
    const v = Math.max(0, Math.min(r.sold, Math.floor(Number(n) || 0)));
    this.qtys.update((q) => ({ ...q, [r.productUid]: v }));
    if (this.type() === 'FULL_RETURN' && !this.isEverything()) this.type.set('PARTIAL_RETURN');
  }

  protected setType(t: ReturnType): void {
    this.type.set(t);
    if (t === 'FULL_RETURN') this.all();
  }

  protected all(): void {
    this.qtys.set(Object.fromEntries(this.rows.map((r) => [r.productUid, r.sold])));
  }

  private isEverything(): boolean {
    return this.rows.every((r) => (this.qtys()[r.productUid] ?? 0) === r.sold);
  }

  protected async send(): Promise<void> {
    if (!this.canSend()) return;
    this.busy.set(true);
    try {
      const items = this.rows
        .filter((r) => (this.qtys()[r.productUid] ?? 0) > 0)
        .map((r) => ({ productUid: r.productUid, quantity: this.qtys()[r.productUid], reason: this.reason().trim(), unitPrice: r.perPiece }));
      await this.api.createReturn({
        saleUid: this.data.sale.uid,
        returnType: this.type(),
        returnReason: this.reason().trim(),
        customerComments: this.comments().trim() || null,
        returnItems: items,
      });
      this.toast.success(this.i18n.t('Return requested — waiting for approval', 'Ombi la kurudisha limetumwa — linasubiri idhini'));
      this.ref.close(true);
    } catch (e) {
      this.toast.error(ApiError.from(e).message);
    } finally {
      this.busy.set(false);
    }
  }
}
