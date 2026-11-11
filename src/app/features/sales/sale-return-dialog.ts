import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';

import { ApiError } from '@core/api/api.types';
import { LanguageService } from '@core/i18n/language.service';
import { Button, Combobox, ComboOption, DialogShell, Icon, MoneyInput, Skeleton, TextField, ToastService } from '@shared/ui';
import { Money, MoneyPipe } from '@shared/utils/money';
import { PAYMENT_METHODS, PosProduct, RETURN_TYPES, ReturnCheck, ReturnType, ReturnableLine, SALE_TYPES, Sale, SaleType, methodLabel, splitRefund } from './sales.models';
import { SalesService } from './sales.service';

export interface SaleReturnData {
  sale: Sale;
  /** Open straight on "Exchange". */
  exchange?: boolean;
}

/** One replacement product of an exchange, priced like the till would. */
interface NewLine {
  product: PosProduct;
  type: SaleType;
  qty: number;
}

/**
 * Request a return or an exchange for a sale. Every sale line is listed with what
 * can still come back (earlier and pending returns are taken off by the server);
 * a line can be marked damaged (refunded, not put back on the shelf). An exchange
 * also picks the replacement goods and what the customer adds. Nothing moves until
 * a manager approves: then the server lowers the sale, clears any debt on it first,
 * pays back only what was really paid, and makes the exchange sale.
 */
@Component({
  selector: 'app-sale-return-dialog',
  imports: [DialogShell, Button, Combobox, Icon, MoneyInput, Skeleton, TextField, MoneyPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <lsms-dialog [title]="(isExchange() ? i18n.t('Exchange goods', 'Badilisha bidhaa') : i18n.t('Return items', 'Rudisha bidhaa')) + ' · ' + data.sale.receiptNumber" [icon]="isExchange() ? 'swap_horiz' : 'assignment_return'">
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
          <span class="lbl">{{ i18n.t('What is happening', 'Kinachofanyika') }}</span>
          <div class="types" role="radiogroup">
            @for (t of typeKeys; track t) {
              <button type="button" role="radio" [attr.aria-checked]="type() === t" [class.on]="type() === t" (click)="setType(t)">
                <lsms-icon [name]="typeIcon[t]" [size]="18" />
                <b>{{ i18n.isSwahili() ? types[t].sw : types[t].en }}</b>
                <small>{{ i18n.isSwahili() ? types[t].hint.sw : types[t].hint.en }}</small>
              </button>
            }
          </div>

          <div class="rows-head">
            <span class="lbl">{{ i18n.t('Pieces coming back', 'Vipande vinavyorudi') }}</span>
            <button type="button" class="link" (click)="all()">{{ i18n.t('Everything left', 'Vyote vilivyobaki') }}</button>
          </div>
          <ul class="rows">
            @for (r of c.lines; track r.saleDetailUid) {
              <li [class.off]="r.returnablePieces === 0">
                <span class="nm">
                  <b>{{ r.productName }}</b>
                  <small>
                    {{ saleTypeLabel(r.saleType) }} · {{ i18n.t('sold', 'viliuzwa') }} {{ r.soldPieces }}
                    @if (r.returnablePieces < r.soldPieces) { · {{ i18n.t('left', 'vimebaki') }} {{ r.returnablePieces }} }
                    · {{ r.pricePerPiece | money: { symbol: false } }}/{{ i18n.t('pc', 'kip') }}
                  </small>
                </span>
                @if (r.returnablePieces > 0) {
                  @if (type() !== 'DAMAGED_RETURN' && qty(r) > 0) {
                    <button type="button" class="dmg" [class.on]="damaged()[r.saleDetailUid]" [attr.aria-pressed]="!!damaged()[r.saleDetailUid]" (click)="toggleDamaged(r)" [title]="i18n.t('Damaged — not put back on the shelf', 'Imeharibika — hairudi stoo')">
                      <lsms-icon name="heart_broken" [size]="14" />{{ i18n.t('Damaged', 'Imeharibika') }}
                    </button>
                  }
                  <span class="stepper">
                    <button type="button" (click)="set(r, qty(r) - 1)" [attr.aria-label]="i18n.t('Less', 'Punguza')"><lsms-icon name="remove" [size]="16" /></button>
                    <input type="text" inputmode="numeric" [value]="qty(r)" (change)="set(r, +$any($event.target).value)" [attr.aria-label]="r.productName" />
                    <button type="button" (click)="set(r, qty(r) + 1)" [attr.aria-label]="i18n.t('More', 'Ongeza')"><lsms-icon name="add" [size]="16" /></button>
                  </span>
                  <b class="amt">{{ qty(r) * r.pricePerPiece | money: { symbol: false } }}</b>
                } @else {
                  <small class="gone">{{ i18n.t('Already returned', 'Vimesharudishwa') }}</small>
                }
              </li>
            }
          </ul>

          @if (isExchange()) {
            <div class="rows-head">
              <span class="lbl">{{ i18n.t('New goods for the customer', 'Bidhaa mpya za mteja') }}</span>
              <small class="muted">{{ i18n.t('Priced as at the till', 'Bei kama ya kwenye mauzo') }}</small>
            </div>
            <!-- Re-created after each pick so the picker is empty again. -->
            @for (k of [pickKey()]; track k) {
            <lsms-combobox
              [options]="productOptions()"
              [value]="null"
              [dense]="true"
              prefixIcon="add_shopping_cart"
              [placeholder]="i18n.t('Add a product…', 'Ongeza bidhaa…')"
              [emptyText]="i18n.t('No product in stock matches', 'Hakuna bidhaa yenye stoo inayolingana')"
              (valueChange)="addNew($event)"
            />
            }
            @if (newLines().length) {
              <ul class="rows new">
                @for (n of newLines(); track n.product.uid + n.type; let i = $index) {
                  <li [class.bad]="!fits(n)">
                    <span class="nm">
                      <b>{{ n.product.name }}</b>
                      <small>{{ i18n.t('In stock', 'Stoo') }} {{ n.product.stockDisplay || n.product.stock }}@if (!fits(n)) { · <span class="err">{{ i18n.t('not enough stock', 'stoo haitoshi') }}</span> }</small>
                      @if (n.product.options.length > 1) {
                        <span class="opts">
                          @for (o of n.product.options; track o.type) {
                            <button type="button" [class.on]="n.type === o.type" (click)="setNewType(i, o.type)">{{ saleTypeLabel(o.type) }} · {{ o.price | money: { symbol: false } }}</button>
                          }
                        </span>
                      }
                    </span>
                    <span class="stepper">
                      <button type="button" (click)="setNewQty(i, n.qty - 1)" [attr.aria-label]="i18n.t('Less', 'Punguza')"><lsms-icon name="remove" [size]="16" /></button>
                      <input type="text" inputmode="numeric" [value]="n.qty" (change)="setNewQty(i, +$any($event.target).value)" [attr.aria-label]="n.product.name" />
                      <button type="button" (click)="setNewQty(i, n.qty + 1)" [attr.aria-label]="i18n.t('More', 'Ongeza')"><lsms-icon name="add" [size]="16" /></button>
                    </span>
                    <b class="amt">{{ price(n) * n.qty | money: { symbol: false } }}</b>
                    <button type="button" class="x" (click)="removeNew(i)" [attr.aria-label]="i18n.t('Remove', 'Ondoa')"><lsms-icon name="close" [size]="16" /></button>
                  </li>
                }
              </ul>
            }
          }

          <lsms-text-field type="textarea" [rows]="2" [maxLength]="300" [required]="true" [label]="i18n.t('Reason', 'Sababu')" (valueChange)="reason.set($event)" />
          <lsms-text-field [maxLength]="300" [label]="i18n.t('Customer comments (optional)', 'Maoni ya mteja (hiari)')" (valueChange)="comments.set($event)" />
        </fieldset>

        <section class="money">
          <div class="ln"><span>{{ i18n.t('Value coming back', 'Thamani inayorudi') }} <small>· {{ pieces() }} {{ i18n.t('pcs', 'vip') }}</small></span><b>{{ value() | money }}</b></div>
          @if (split().debt > 0) {
            <div class="ln sub"><span>{{ i18n.t('Clears debt on this sale', 'Inapunguza deni la mauzo haya') }}</span><b>{{ split().debt | money }}</b></div>
          }
          @if (!isExchange()) {
            <div class="ln total">
              <span>{{ i18n.t('Money back to the customer', 'Pesa anayorudishiwa mteja') }}</span>
              <b>{{ split().cash | money }}</b>
            </div>
          } @else {
            <div class="ln sub"><span>{{ i18n.t('Goes towards the new goods', 'Inalipia bidhaa mpya') }}</span><b>{{ split().cash | money }}</b></div>
            <div class="ln"><span>{{ i18n.t('New goods', 'Bidhaa mpya') }}</span><b>{{ newTotal() | money }}</b></div>
            @if (needed() > 0) {
              <div class="topup">
                <span class="lbl">{{ i18n.t('Customer adds', 'Mteja anaongeza') }} <small>({{ i18n.t('needed', 'kinachohitajika') }} {{ needed() | money: { symbol: false } }})</small></span>
                <input lsmsMoneyInput class="amount" [value]="topUpText()" (input)="topUpText.set($any($event.target).value)" [attr.aria-label]="i18n.t('Customer adds', 'Mteja anaongeza')" />
                <div class="methods" role="radiogroup">
                  @for (m of methods(); track m) {
                    <button type="button" role="radio" [attr.aria-checked]="topUpMethod() === m" [class.on]="topUpMethod() === m" (click)="topUpMethod.set(m)">
                      <lsms-icon [name]="methodIcon(m)" [size]="15" />{{ methodName(m) }}
                    </button>
                  }
                </div>
              </div>
              @if (stillOwed() > 0) {
                <p class="note" [class.err]="!data.sale.customerUid">
                  <lsms-icon [name]="data.sale.customerUid ? 'info' : 'block'" [size]="16" />
                  @if (data.sale.customerUid) {
                    {{ i18n.t('The rest becomes a debt of', 'Kilichobaki kitakuwa deni la') }} <b>{{ stillOwed() | money }}</b>
                  } @else {
                    {{ i18n.t('A walk-in customer cannot leave a debt — the customer must add', 'Mteja wa kawaida hawezi kuacha deni — aongeze') }} <b>{{ needed() | money }}</b>
                  }
                </p>
              }
            } @else if (change() > 0) {
              <div class="ln total"><span>{{ i18n.t('Change back to the customer', 'Chenji anayorudishiwa mteja') }}</span><b>{{ change() | money }}</b></div>
            }
          }
          <small class="foot">{{ i18n.t('Nothing moves until a manager approves.', 'Hakuna kinachobadilika hadi meneja aidhinishe.') }}</small>
        </section>
      }

      <ng-container dialogActions>
        <button lsmsButton="secondary" (click)="ref.close()">{{ i18n.t('Cancel', 'Ghairi') }}</button>
        <button lsmsButton [icon]="isExchange() ? 'swap_horiz' : 'send'" [loading]="busy()" [disabled]="!canSend()" (click)="send()">
          {{ isExchange() ? i18n.t('Request exchange', 'Omba kubadilisha') : i18n.t('Request return', 'Omba kurudisha') }}
        </button>
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
    .lbl { font-size: 0.8rem; font-weight: 500; color: var(--c-text-2); }
    .muted { font-size: 0.72rem; color: var(--c-text-2); }
    .err { color: var(--c-error); }
    .types { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; }
    .types button { display: flex; flex-direction: column; gap: 2px; padding: 10px; border-radius: 12px; border: 1px solid var(--c-border); background: var(--c-surface); font: inherit; text-align: left; color: var(--c-text); cursor: pointer; }
    .types button lsms-icon { color: var(--c-text-2); margin-bottom: 2px; }
    .types button b { font-size: 0.84rem; }
    .types button small { font-size: 0.7rem; color: var(--c-text-2); }
    .types button.on { border-color: var(--c-primary); box-shadow: 0 0 0 1px var(--c-primary); background: color-mix(in srgb, var(--c-primary) 6%, var(--c-surface)); }
    .types button.on lsms-icon { color: var(--c-primary); }
    @media (max-width: 640px) { .types { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
    .rows-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
    .link { padding: 0; border: 0; background: none; font: inherit; font-size: 0.78rem; font-weight: 600; color: var(--c-primary); cursor: pointer; }
    .rows { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
    .rows li { display: flex; align-items: center; flex-wrap: wrap; gap: 8px 10px; padding: 8px 10px; border-radius: 12px; background: var(--c-bg); border: 1px solid var(--c-border); }
    .rows li.off { opacity: 0.55; }
    .rows li.bad { border-color: color-mix(in srgb, var(--c-error) 45%, transparent); }
    .nm { display: flex; flex-direction: column; flex: 1 1 160px; min-width: 0; gap: 2px; }
    .nm b { font-size: 0.84rem; }
    .nm small { font-size: 0.7rem; color: var(--c-text-2); }
    .gone { font-size: 0.72rem; color: var(--c-text-2); }
    .amt { min-width: 70px; margin-left: auto; text-align: right; font-variant-numeric: tabular-nums; }
    .stepper { display: inline-flex; align-items: center; border-radius: 9px; border: 1px solid var(--c-border); background: var(--c-surface); overflow: hidden; }
    .stepper button { display: inline-flex; padding: 4px 6px; border: 0; background: transparent; color: var(--c-text); cursor: pointer; }
    .stepper input { width: 40px; border: 0; text-align: center; font: inherit; font-size: 0.84rem; font-weight: 600; background: transparent; color: var(--c-text); outline: none; }
    .dmg { display: inline-flex; align-items: center; gap: 4px; padding: 3px 8px; border-radius: 100px; border: 1px solid var(--c-border); background: var(--c-surface); font: inherit; font-size: 0.7rem; font-weight: 600; color: var(--c-text-2); cursor: pointer; }
    .dmg.on { color: #fff; background: var(--c-error); border-color: var(--c-error); }
    .opts { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 2px; }
    .opts button { padding: 2px 8px; border-radius: 100px; border: 1px solid var(--c-border); background: var(--c-surface); font: inherit; font-size: 0.68rem; color: var(--c-text-2); cursor: pointer; }
    .opts button.on { color: var(--c-primary); border-color: var(--c-primary); background: color-mix(in srgb, var(--c-primary) 7%, var(--c-surface)); font-weight: 600; }
    .x { display: inline-flex; padding: 4px; border: 0; border-radius: 8px; background: transparent; color: var(--c-text-2); cursor: pointer; }
    .money { display: flex; flex-direction: column; gap: 6px; margin-top: 12px; padding: 12px 14px; border-radius: 12px; background: color-mix(in srgb, var(--c-primary) 6%, var(--c-bg)); }
    .ln { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; font-size: 0.84rem; }
    .ln b { font-variant-numeric: tabular-nums; }
    .ln small { color: var(--c-text-2); }
    .ln.sub { color: var(--c-text-2); font-size: 0.8rem; }
    .ln.total b { font-size: 1.2rem; font-weight: 600; color: var(--c-primary); }
    .topup { display: flex; flex-direction: column; gap: 6px; padding-top: 6px; border-top: 1px dashed var(--c-border); }
    .topup .lbl small { font-weight: 400; }
    .amount { padding: 8px 10px; border-radius: 10px; border: 1px solid var(--c-border); background: var(--c-surface); font: inherit; font-size: 1rem; font-weight: 600; color: var(--c-text); font-variant-numeric: tabular-nums; }
    .methods { display: flex; flex-wrap: wrap; gap: 6px; }
    .methods button { display: inline-flex; align-items: center; gap: 5px; padding: 5px 10px; border-radius: 10px; border: 1px solid var(--c-border); background: var(--c-surface); font: inherit; font-size: 0.76rem; font-weight: 500; color: var(--c-text); cursor: pointer; }
    .methods button.on { color: #fff; background: var(--c-primary); border-color: var(--c-primary); }
    .note { display: flex; align-items: center; gap: 6px; margin: 0; font-size: 0.8rem; }
    .note.err { color: var(--c-error); font-weight: 500; }
    .foot { font-size: 0.7rem; color: var(--c-text-2); }
  `,
})
export class SaleReturnDialog {
  protected readonly data = inject<SaleReturnData>(DIALOG_DATA);
  protected readonly ref = inject<DialogRef<boolean>>(DialogRef);
  protected readonly i18n = inject(LanguageService);
  private readonly api = inject(SalesService);
  private readonly toast = inject(ToastService);

  protected readonly types = RETURN_TYPES;
  protected readonly typeKeys: ReturnType[] = ['FULL_RETURN', 'PARTIAL_RETURN', 'DAMAGED_RETURN', 'EXCHANGE'];
  protected readonly typeIcon: Record<ReturnType, string> = { FULL_RETURN: 'assignment_return', PARTIAL_RETURN: 'rule', DAMAGED_RETURN: 'heart_broken', EXCHANGE: 'swap_horiz' };
  protected readonly check = signal<ReturnCheck | null>(null);
  protected readonly type = signal<ReturnType>(this.data.exchange ? 'EXCHANGE' : 'FULL_RETURN');
  protected readonly reason = signal('');
  protected readonly comments = signal('');
  protected readonly busy = signal(false);
  private readonly qtys = signal<Record<string, number>>({});
  protected readonly damaged = signal<Record<string, boolean>>({});
  protected readonly newLines = signal<NewLine[]>([]);
  protected readonly topUpText = signal('');
  protected readonly topUpMethod = signal('CASH');
  protected readonly pickKey = signal(0);

  protected readonly isExchange = computed(() => this.type() === 'EXCHANGE');
  private readonly lines = computed(() => this.check()?.lines ?? []);
  protected readonly pieces = computed(() => Object.values(this.qtys()).reduce((a, b) => a + b, 0));
  protected readonly value = computed(() => this.lines().reduce((n, r) => n + (this.qtys()[r.saleDetailUid] ?? 0) * r.pricePerPiece, 0));
  protected readonly split = computed(() => splitRefund(this.value(), this.check()?.owedNow ?? 0, this.check()?.paidNet ?? 0));

  protected readonly methods = computed(() => (this.api.paymentMethods.value() ?? Object.keys(PAYMENT_METHODS)).filter((m) => m !== 'CREDIT'));
  protected readonly productOptions = computed<ComboOption<string>[]>(() =>
    (this.api.posStock.value() ?? [])
      .filter((p) => p.stock > 0 && p.options.length)
      .map((p) => ({ value: p.uid, label: p.name, hint: `${Money.format(p.options[0].price)} · ${p.stockDisplay || p.stock}`, keywords: p.category ?? '' })),
  );
  protected readonly newTotal = computed(() => this.newLines().reduce((n, l) => n + this.price(l) * l.qty, 0));
  /** What the customer must add so the new goods are fully paid. */
  protected readonly needed = computed(() => Math.max(0, this.newTotal() - this.split().cash));
  protected readonly change = computed(() => Math.max(0, this.split().cash - this.newTotal()));
  private readonly topUp = computed(() => Math.min(this.needed(), Math.max(0, Number(this.topUpText().replace(/[^\d.]/g, '')) || 0)));
  protected readonly stillOwed = computed(() => Math.max(0, this.needed() - this.topUp()));

  protected readonly canSend = computed(() => {
    if (!this.check()?.valid || this.pieces() <= 0 || this.reason().trim().length < 3 || this.busy()) return false;
    if (!this.isExchange()) return true;
    if (!this.newLines().length || !this.newLines().every((l) => this.fits(l))) return false;
    return !!this.data.sale.customerUid || this.stillOwed() < 0.01;
  });

  constructor() {
    void this.api.paymentMethods.load().catch(() => undefined);
    if (this.data.exchange) void this.api.posStock.load().catch(() => undefined);
    this.api
      .checkReturn(this.data.sale.uid)
      .then((c) => {
        this.check.set(c);
        if (this.type() === 'FULL_RETURN') this.all();
      })
      .catch((e) => this.check.set({ valid: false, errors: [ApiError.from(e).message], warnings: [], daysFromSale: null, withinWindow: false, estimatedRefund: null, lines: [], owedNow: 0, paidNet: 0 }));
  }

  protected qty(r: ReturnableLine): number {
    return this.qtys()[r.saleDetailUid] ?? 0;
  }

  protected set(r: ReturnableLine, n: number): void {
    const v = Math.max(0, Math.min(r.returnablePieces, Math.floor(Number(n) || 0)));
    this.qtys.update((q) => ({ ...q, [r.saleDetailUid]: v }));
    if (this.type() === 'FULL_RETURN' && !this.isEverything()) this.type.set('PARTIAL_RETURN');
    this.syncTopUp();
  }

  protected setType(t: ReturnType): void {
    this.type.set(t);
    if (t === 'FULL_RETURN') this.all();
    if (t === 'EXCHANGE') void this.api.posStock.load().catch(() => undefined);
    this.syncTopUp();
  }

  protected all(): void {
    this.qtys.set(Object.fromEntries(this.lines().map((r) => [r.saleDetailUid, r.returnablePieces])));
    this.syncTopUp();
  }

  private isEverything(): boolean {
    return this.lines().every((r) => (this.qtys()[r.saleDetailUid] ?? 0) === r.returnablePieces);
  }

  protected toggleDamaged(r: ReturnableLine): void {
    this.damaged.update((d) => ({ ...d, [r.saleDetailUid]: !d[r.saleDetailUid] }));
  }

  protected saleTypeLabel(t: string | null): string {
    const x = t ? SALE_TYPES[t as SaleType] : null;
    return x ? (this.i18n.isSwahili() ? x.sw : x.en) : (t ?? '');
  }

  // ── Exchange goods ─────────────────────────────────────────────────────────
  protected addNew(uid: string | null): void {
    const p = (this.api.posStock.value() ?? []).find((x) => x.uid === uid);
    if (!p) return;
    this.pickKey.update((k) => k + 1);
    const type = p.options[0].type;
    const at = this.newLines().findIndex((l) => l.product.uid === p.uid && l.type === type);
    if (at >= 0) this.setNewQty(at, this.newLines()[at].qty + 1);
    else this.newLines.update((l) => [...l, { product: p, type, qty: 1 }]);
    this.syncTopUp();
  }

  protected setNewType(i: number, t: SaleType): void {
    this.newLines.update((l) => l.map((x, j) => (j === i ? { ...x, type: t } : x)));
    this.syncTopUp();
  }

  protected setNewQty(i: number, n: number): void {
    const v = Math.floor(Number(n) || 0);
    if (v <= 0) return this.removeNew(i);
    this.newLines.update((l) => l.map((x, j) => (j === i ? { ...x, qty: v } : x)));
    this.syncTopUp();
  }

  protected removeNew(i: number): void {
    this.newLines.update((l) => l.filter((_, j) => j !== i));
    this.syncTopUp();
  }

  protected price(l: NewLine): number {
    return l.product.options.find((o) => o.type === l.type)?.price ?? 0;
  }

  /** Stock covers every line of this product together. */
  protected fits(l: NewLine): boolean {
    const used = this.newLines()
      .filter((x) => x.product.uid === l.product.uid)
      .reduce((n, x) => n + x.qty * (x.product.options.find((o) => o.type === x.type)?.pieces ?? 1), 0);
    return used <= l.product.stock;
  }

  /** The top-up follows what is needed until the cashier types something else. */
  private syncTopUp(): void {
    queueMicrotask(() => this.topUpText.set(this.needed() > 0 ? Money.group(String(Math.round(this.needed()))) : ''));
  }

  protected methodName(m: string): string {
    return methodLabel(m, this.i18n.isSwahili());
  }

  protected methodIcon(m: string): string {
    return PAYMENT_METHODS[m]?.icon ?? 'payments';
  }

  protected async send(): Promise<void> {
    if (!this.canSend()) return;
    this.busy.set(true);
    try {
      const allDamaged = this.type() === 'DAMAGED_RETURN';
      const items = this.lines()
        .filter((r) => this.qty(r) > 0)
        .map((r) => ({
          saleDetailUid: r.saleDetailUid,
          productUid: r.productUid,
          quantity: this.qty(r),
          reason: this.reason().trim(),
          itemCondition: (allDamaged || this.damaged()[r.saleDetailUid] ? 'DAMAGED' : 'GOOD') as 'GOOD' | 'DAMAGED',
        }));
      await this.api.createReturn({
        saleUid: this.data.sale.uid,
        returnType: this.type(),
        returnReason: this.reason().trim(),
        customerComments: this.comments().trim() || null,
        returnItems: items,
        ...(this.isExchange()
          ? {
              exchangeLines: this.newLines().map((l) => ({ productUid: l.product.uid, saleType: l.type, packageQuantity: l.qty })),
              exchangePaidAmount: this.topUp(),
              exchangePaidMethod: this.topUpMethod(),
            }
          : {}),
      });
      this.toast.success(
        this.isExchange()
          ? this.i18n.t('Exchange requested — waiting for approval', 'Ombi la kubadilisha limetumwa — linasubiri idhini')
          : this.i18n.t('Return requested — waiting for approval', 'Ombi la kurudisha limetumwa — linasubiri idhini'),
      );
      this.ref.close(true);
    } catch (e) {
      this.toast.error(ApiError.from(e).message);
    } finally {
      this.busy.set(false);
    }
  }
}
