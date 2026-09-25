import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';

import { LanguageService } from '@core/i18n/language.service';
import { Button, ComboOption, Combobox, DialogShell, Icon } from '@shared/ui';
import { MoneyPipe } from '@shared/utils/money';
import { CustomersService } from '../customers/customers.service';
import { Product } from '../products/products.models';
import { ProductsService } from '../products/products.service';
import { DebtItem, DebtPriceType, DebtProductLine, RetailDebtRequest, priceTypeLabel } from './recon-extra.models';

export interface ReconDebtDialogData {
  /** Reconciliation day — the debt's sale date. */
  date: string;
  /** Edit this walk-in debt (amount, notes, products). Omit to record a new one. */
  debt?: DebtItem;
}

const TIERS: Array<{ type: DebtPriceType; en: string; sw: string; price: (p: Product) => number | null }> = [
  { type: 'PIECES', en: 'Piece', sw: 'Kipande', price: (p) => p.pieceSalePrice },
  { type: 'QUARTER_PACKAGE', en: 'Quarter', sw: 'Robo', price: (p) => p.quarterSalePrice },
  { type: 'HALF_PACKAGE', en: 'Half', sw: 'Nusu', price: (p) => p.halfSalePrice },
  { type: 'WHOLE_PACKAGE', en: 'Whole', sw: 'Jumla', price: (p) => p.wholeSalePrice },
];


/**
 * Record / edit a walk-in debt from the reconciliation — port of Flutter's
 * Debts-tab add form and `_editRetailDebt`: existing customer (search) or a
 * new name + phone, due date, what they took (product × tier × qty, history
 * only — stock is not moved), amount (follows the products until typed by
 * hand) and a note. Closes with the request; the tab sends it.
 */
@Component({
  selector: 'app-recon-debt-dialog',
  imports: [DialogShell, Button, Icon, Combobox, MoneyPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <lsms-dialog [title]="editing ? i18n.t('Edit debt', 'Hariri deni') : i18n.t('Record a customer debt', 'Rekodi deni la mteja')" [icon]="editing ? 'edit' : 'person_add'">
      <div class="form">
        @if (editing) {
          <p class="who"><lsms-icon name="person" [size]="18" /><b>{{ data.debt!.customerName || '—' }}</b>@if (data.debt!.customerPhone) { <small>{{ data.debt!.customerPhone }}</small> }</p>
        } @else {
          <div class="seg" role="radiogroup">
            <button type="button" role="radio" [class.on]="!isNew()" (click)="isNew.set(false)"><lsms-icon name="person_search" [size]="16" />{{ i18n.t('Existing customer', 'Mteja aliyepo') }}</button>
            <button type="button" role="radio" [class.on]="isNew()" (click)="isNew.set(true); customerUid.set(null)"><lsms-icon name="person_add" [size]="16" />{{ i18n.t('New customer', 'Mteja mpya') }}</button>
          </div>
          @if (!isNew()) {
            <lsms-combobox
              [label]="i18n.t('Customer', 'Mteja')"
              prefixIcon="person"
              [placeholder]="i18n.t('Search name or phone…', 'Tafuta jina au simu…')"
              [options]="customerOptions()"
              [value]="customerUid()"
              [required]="true"
              (valueChange)="pickCustomer($event)"
            />
            @if (pickedCustomer(); as c) {
              @if (c.outstandingBalance > 0) {
                <p class="warn"><lsms-icon name="warning" [size]="15" />{{ i18n.t('Already owes', 'Tayari anadaiwa') }} <b>{{ c.outstandingBalance | money }}</b>@if (c.creditLimit) { · {{ i18n.t('limit', 'ukomo') }} {{ c.creditLimit | money }} }</p>
              }
            }
          } @else {
            <div class="grid">
              <label>
                <span>{{ i18n.t('Name', 'Jina') }} *</span>
                <input type="text" maxlength="100" [value]="name()" (input)="name.set($any($event.target).value)" />
              </label>
              <label>
                <span>{{ i18n.t('Phone', 'Simu') }}</span>
                <input type="tel" maxlength="20" [value]="phone()" (input)="phone.set($any($event.target).value)" placeholder="07…" />
              </label>
            </div>
          }
        }

        <section class="lines">
          <h5><lsms-icon name="inventory_2" [size]="16" />{{ i18n.t('What they took', 'Bidhaa alizochukua') }} <small>({{ i18n.t('optional — stock is not changed', 'si lazima — mzigo haubadiliki') }})</small></h5>
          <div class="pick">
            <lsms-combobox
              [dense]="true"
              prefixIcon="search"
              [placeholder]="i18n.t('Find product…', 'Tafuta bidhaa…')"
              [options]="productOptions()"
              [value]="productUid()"
              (valueChange)="pickProduct($event)"
            />
            @if (product(); as p) {
              <div class="tiers">
                @for (t of tiersOf(p); track t.type) {
                  <button type="button" [class.on]="tier() === t.type" (click)="tier.set(t.type)">
                    <small>{{ i18n.isSwahili() ? t.sw : t.en }}</small><b>{{ t.value | money: { symbol: false } }}</b>
                  </button>
                }
              </div>
              <div class="add-row">
                <label class="qty">
                  <span>{{ i18n.t('Qty', 'Idadi') }}</span>
                  <input type="text" inputmode="numeric" [value]="qty()" (input)="setQty($any($event.target).value)" />
                </label>
                <button lsmsButton="secondary" size="sm" icon="add" [disabled]="!canAddLine()" (click)="addLine()">{{ i18n.t('Add', 'Ongeza') }}</button>
              </div>
            }
          </div>
          @if (lines().length) {
            <ul>
              @for (l of lines(); track $index) {
                <li>
                  <span>{{ l.productName }} <small>{{ l.quantity }} × {{ l.unitPrice | money: { symbol: false } }} · {{ tierLabel(l.priceType) }}</small></span>
                  <b>{{ l.subTotal | money: { symbol: false } }}</b>
                  <button type="button" class="x" (click)="removeLine($index)" [attr.aria-label]="i18n.t('Remove', 'Ondoa')"><lsms-icon name="close" [size]="15" /></button>
                </li>
              }
              <li class="sum"><span>{{ i18n.t('Products total', 'Jumla ya bidhaa') }}</span><b>{{ linesTotal() | money }}</b></li>
            </ul>
          }
        </section>

        <div class="grid">
          <label>
            <span>{{ i18n.t('Amount owed (TZS)', 'Kiasi anachodaiwa (TZS)') }} *</span>
            <input type="text" inputmode="numeric" [value]="amountText()" (input)="typeAmount($any($event.target).value)" placeholder="0" />
          </label>
          @if (!editing) {
            <label>
              <span>{{ i18n.t('Pay by (optional)', 'Alipe kabla ya (hiari)') }}</span>
              <input type="date" [min]="data.date" [value]="dueDate()" (change)="dueDate.set($any($event.target).value)" />
            </label>
          }
          <label class="wide">
            <span>{{ editing ? i18n.t('Reason for the change (optional)', 'Sababu ya mabadiliko (hiari)') : i18n.t('Note (optional)', 'Maelezo (hiari)') }}</span>
            <input type="text" maxlength="300" [value]="notes()" (input)="notes.set($any($event.target).value)" />
          </label>
        </div>
        @if (linesTotal() > 0 && amount() !== linesTotal()) {
          <p class="hint"><lsms-icon name="info" [size]="14" />{{ i18n.t('Amount differs from the products total', 'Kiasi kinatofautiana na jumla ya bidhaa') }} ({{ linesTotal() | money }}) · <button type="button" (click)="useLinesTotal()">{{ i18n.t('use it', 'tumia hiyo') }}</button></p>
        }
      </div>

      <ng-container dialogActions>
        <button lsmsButton="secondary" (click)="ref.close()">{{ i18n.t('Cancel', 'Ghairi') }}</button>
        <button lsmsButton icon="save" [disabled]="!valid()" (click)="save()">{{ editing ? i18n.t('Save changes', 'Hifadhi mabadiliko') : i18n.t('Record debt', 'Rekodi deni') }}</button>
      </ng-container>
    </lsms-dialog>
  `,
  styles: `
    .form { display: flex; flex-direction: column; gap: 12px; }
    .who { display: flex; align-items: center; gap: 8px; padding: 10px 12px; border-radius: 12px; background: var(--c-bg); }
    .who small { color: var(--c-text-2); }
    .seg { display: inline-flex; align-self: flex-start; padding: 3px; border-radius: 12px; border: 1px solid var(--c-border); background: var(--c-surface); }
    .seg button { display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px; border: 0; border-radius: 9px; background: transparent; font: inherit; font-size: 0.8rem; font-weight: 600; color: var(--c-text-2); cursor: pointer; }
    .seg button.on { color: var(--c-on-primary); background: var(--c-primary); }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
    .grid .wide { grid-column: 1 / -1; }
    label { display: flex; flex-direction: column; gap: 4px; font-size: 0.76rem; font-weight: 600; color: var(--c-text-2); }
    input { padding: 9px 10px; border: 1px solid var(--c-border); border-radius: 10px; background: var(--c-input-fill); font: inherit; font-size: 0.86rem; color: var(--c-text); outline: none; }
    input:focus { border-color: var(--c-primary); }
    .warn { display: flex; align-items: center; gap: 6px; font-size: 0.78rem; color: var(--c-warning); }
    .lines { display: flex; flex-direction: column; gap: 8px; padding: 12px; border-radius: 14px; border: 1px solid var(--c-border); background: var(--c-bg); }
    .lines h5 { display: flex; align-items: center; gap: 6px; margin: 0; font-size: 0.82rem; font-weight: 700; }
    .lines h5 small { font-weight: 400; color: var(--c-text-2); }
    .lines h5 lsms-icon { color: var(--c-primary); }
    .pick { display: flex; flex-direction: column; gap: 8px; }
    .tiers { display: flex; flex-wrap: wrap; gap: 6px; }
    .tiers button { display: inline-flex; flex-direction: column; align-items: center; min-width: 76px; padding: 5px 10px; border-radius: 10px; border: 1px solid var(--c-border); background: var(--c-surface); font: inherit; cursor: pointer; color: var(--c-text); }
    .tiers button small { font-size: 0.7rem; color: var(--c-text-2); }
    .tiers button b { font-size: 0.84rem; font-variant-numeric: tabular-nums; }
    .tiers button.on { border-color: var(--c-primary); box-shadow: 0 0 0 1px var(--c-primary); }
    .add-row { display: flex; align-items: flex-end; gap: 8px; }
    .qty { width: 90px; }
    ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; }
    li { display: flex; align-items: center; gap: 8px; padding: 6px 0; font-size: 0.84rem; border-top: 1px dashed var(--c-border); }
    li span { flex: 1; display: flex; flex-direction: column; min-width: 0; }
    li small { color: var(--c-text-2); font-size: 0.72rem; }
    li b { font-variant-numeric: tabular-nums; }
    li.sum { font-weight: 600; }
    .x { display: inline-flex; padding: 2px; border: 0; background: transparent; color: var(--c-text-2); cursor: pointer; }
    .x:hover { color: var(--c-error); }
    .hint { display: flex; align-items: center; gap: 4px; font-size: 0.76rem; color: var(--c-text-2); }
    .hint button { padding: 0; border: 0; background: none; font: inherit; font-weight: 600; color: var(--c-primary); cursor: pointer; }
    @media (max-width: 520px) { .grid { grid-template-columns: 1fr; } }
  `,
})
export class ReconDebtDialog {
  protected readonly data = inject<ReconDebtDialogData>(DIALOG_DATA);
  protected readonly ref = inject<DialogRef<RetailDebtRequest>>(DialogRef);
  protected readonly i18n = inject(LanguageService);
  private readonly customersApi = inject(CustomersService);
  private readonly productsApi = inject(ProductsService);

  protected readonly editing = !!this.data.debt;
  protected readonly isNew = signal(false);
  protected readonly customerUid = signal<string | null>(null);
  protected readonly name = signal('');
  protected readonly phone = signal('');
  protected readonly dueDate = signal('');
  protected readonly notes = signal(this.data.debt?.notes ?? '');
  protected readonly amountText = signal(this.data.debt ? String(this.data.debt.balance) : '');
  /** Amount follows the products total until typed by hand. */
  private readonly amountTyped = signal(this.editing);
  protected readonly lines = signal<DebtProductLine[]>(this.data.debt?.products ?? []);
  protected readonly productUid = signal<string | null>(null);
  protected readonly tier = signal<DebtPriceType>('PIECES');
  protected readonly qty = signal(1);

  protected readonly customerOptions = computed<ComboOption[]>(() =>
    (this.customersApi.list.value() ?? []).map((c) => ({ value: c.uid, label: c.name, hint: c.phoneNumber ?? undefined, keywords: c.phoneNumber ?? undefined })),
  );
  protected readonly pickedCustomer = computed(() => (this.customersApi.list.value() ?? []).find((c) => c.uid === this.customerUid()) ?? null);
  protected readonly productOptions = computed<ComboOption[]>(() =>
    (this.productsApi.catalogue.value() ?? []).map((p) => ({ value: p.uid, label: p.displayName, hint: p.categoryName ?? undefined, keywords: p.productName })),
  );
  protected readonly product = computed(() => (this.productsApi.catalogue.value() ?? []).find((p) => p.uid === this.productUid()) ?? null);
  protected readonly linesTotal = computed(() => this.lines().reduce((n, l) => n + l.subTotal, 0));
  protected readonly amount = computed(() => Number(this.amountText().replace(/[^\d.]/g, '')) || 0);
  protected readonly canAddLine = computed(() => {
    const p = this.product();
    return !!p && this.qty() > 0 && !!this.tiersOf(p).find((t) => t.type === this.tier());
  });
  protected readonly valid = computed(() => {
    if (!(this.amount() > 0)) return false;
    if (this.editing) return true;
    return this.isNew() ? this.name().trim().length >= 2 : !!this.pickedCustomer();
  });

  constructor() {
    if (!this.editing) void this.customersApi.list.load().catch(() => undefined);
    void this.productsApi.catalogue.load().catch(() => undefined);
  }

  protected tiersOf(p: Product) {
    return TIERS.map((t) => ({ ...t, value: t.price(p) })).filter((t) => t.value !== null && t.value > 0) as Array<(typeof TIERS)[number] & { value: number }>;
  }

  protected tierLabel(t: string): string {
    return priceTypeLabel(t, this.i18n.isSwahili());
  }

  protected pickCustomer(uid: string | null): void {
    this.customerUid.set(uid);
  }

  protected pickProduct(uid: string | null): void {
    this.productUid.set(uid);
    this.qty.set(1);
    const p = this.product();
    if (p) this.tier.set(this.tiersOf(p)[0]?.type ?? 'PIECES');
  }

  protected addLine(): void {
    const p = this.product();
    if (!p || !this.canAddLine()) return;
    const t = this.tiersOf(p).find((x) => x.type === this.tier())!;
    const qty = this.qty();
    this.lines.update((ls) => [...ls, { productUid: p.uid, productName: p.displayName, quantity: qty, unitPrice: t.value, priceType: t.type, subTotal: qty * t.value }]);
    this.productUid.set(null);
    this.syncAmount();
  }

  protected removeLine(i: number): void {
    this.lines.update((ls) => ls.filter((_, j) => j !== i));
    this.syncAmount();
  }

  protected setQty(v: string): void {
    this.qty.set(Number(v.replace(/[^\d]/g, '')) || 0);
  }

  protected typeAmount(v: string): void {
    this.amountText.set(v);
    this.amountTyped.set(true);
  }

  protected useLinesTotal(): void {
    this.amountText.set(String(this.linesTotal()));
  }

  private syncAmount(): void {
    if (!this.amountTyped()) this.amountText.set(this.linesTotal() ? String(this.linesTotal()) : '');
  }

  protected save(): void {
    if (!this.valid()) return;
    const c = this.pickedCustomer();
    const d = this.data.debt;
    this.ref.close({
      customerUid: this.editing || this.isNew() ? null : (c?.uid ?? null),
      debtorName: d ? (d.customerName ?? '') : this.isNew() ? this.name().trim() : (c?.name ?? ''),
      debtorPhone: d ? d.customerPhone : this.isNew() ? this.phone().trim() || null : c?.phoneNumber ?? null,
      amount: this.amount(),
      notes: this.notes().trim() || null,
      saleDate: d ? null : this.data.date,
      dueDate: d ? null : this.dueDate() || null,
      isPaid: false,
      products: this.lines().map((l) => ({ productUid: l.productUid, quantity: l.quantity, unitPrice: l.unitPrice, priceType: l.priceType, subTotal: l.subTotal })),
    });
  }
}
