import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';

import { ApiError } from '@core/api/api.types';
import { LanguageService } from '@core/i18n/language.service';
import { Button, DialogShell, EmptyState, Icon, SearchBar, Skeleton, ToastService } from '@shared/ui';
import { parseLocal } from '@shared/utils/date-utils';
import { Money } from '@shared/utils/money';
import { packUnit, productDetail } from '@shared/utils/product-label';
import { AfterOrder, afterOrder, daysLabel, filterCandidates, qtyLabel, slowWarning, slowWords } from './order-math';
import { OrderCandidate, OrderSuggestion, PACK_WORDS } from './order.models';
import { OrderService } from './order.service';

export interface OrderAddData {
  orderUid: string;
}

/** Rows drawn at once; the buyer narrows a longer list by typing. */
const MAX_ROWS = 60;

/**
 * "+ Ongeza bidhaa": the products that are not on the order. Search by name or
 * category; every product shows its stock in its own package and the days that stock
 * lasts. A product the slow-movers report marks ("acha kuagiza", "punguza bei",
 * "rudisha") shows that warning with the days and the value — it informs, the buyer
 * still decides. Adding saves at once and the dialog stays open for the next product;
 * it closes with the order as it then stands (undefined when nothing was added).
 */
@Component({
  selector: 'app-order-add-dialog',
  imports: [DialogShell, Button, Icon, SearchBar, Skeleton, EmptyState],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <lsms-dialog [title]="i18n.t('Add a product', 'Ongeza bidhaa')" icon="add_shopping_cart">
      <lsms-search-bar [placeholder]="i18n.t('Search by name or category…', 'Tafuta kwa jina au kategoria…')" [debounce]="120" (search)="search($event)" />

      @if (error()) {
        <lsms-empty-state icon="cloud_off" [title]="i18n.t('Could not load the products', 'Bidhaa hazikupatikana')" [message]="error()" />
      } @else if (!all()) {
        <lsms-skeleton variant="list" [rows]="6" />
      } @else if (!shown().length) {
        <lsms-empty-state icon="search_off"
          [title]="all()!.length ? i18n.t('No product matches', 'Hakuna bidhaa inayolingana') : i18n.t('Every product is already on the order', 'Bidhaa zote ziko kwenye oda tayari')"
          [message]="all()!.length ? i18n.t('Try another name or category. Products already on the order are not listed.', 'Jaribu jina au kategoria nyingine. Bidhaa zilizo kwenye oda tayari hazionekani.') : ''" />
      } @else {
        <ul>
          @for (c of shown(); track c.productUid) {
            <li [class.open]="picked() === c.productUid">
              <button type="button" class="row" (click)="pick(c)" [attr.aria-expanded]="picked() === c.productUid">
                <span class="nm">
                  <b>{{ c.displayName }}</b>
                  <small>{{ detail(c) }} · {{ m(c.packCost) }}/{{ unit(c) }}</small>
                  @if (c.slowAction) { <small class="tag warn"><lsms-icon name="warning" [size]="12" />{{ action(c) }}</small> }
                </span>
                <span class="stk">
                  <b>{{ qty(c, c.stock) }}</b>
                  <small [class.low]="cover(c).low">{{ lasts(cover(c)) }}</small>
                </span>
              </button>
              @if (picked() === c.productUid) {
                <div class="add">
                  @if (warning(c); as w) {
                    <p class="warnbox" role="note"><lsms-icon name="warning" [size]="16" /><span>{{ w }}<small>{{ i18n.t('You can still add it.', 'Bado unaweza kuiongeza.') }}</small></span></p>
                  }
                  <small class="src">{{ source(c) }}</small>
                  <div class="act">
                    <span class="step">
                      <button type="button" (click)="bump(-1)" [disabled]="packs() <= 1" [attr.aria-label]="i18n.t('Less', 'Punguza')">−</button>
                      <input type="number" min="1" max="999" inputmode="numeric" [value]="packs()" (input)="set($any($event.target).value)" [attr.aria-label]="c.productName" />
                      <button type="button" (click)="bump(1)" [attr.aria-label]="i18n.t('More', 'Ongeza')">+</button>
                    </span>
                    <span class="unit">{{ unit(c) }}</span>
                    <b class="cost">{{ m(packs() * c.packCost) }}</b>
                    <button lsmsButton size="sm" icon="add" [loading]="saving()" (click)="add(c)">{{ i18n.t('Add', 'Ongeza') }}</button>
                  </div>
                  @let a = after(c);
                  <small class="after">{{ i18n.t('after order', 'baada ya oda') }}: <b>{{ qty(c, a.pieces) }}</b>@if (a.days !== null) { ≈ {{ days(a.days) }} }</small>
                </div>
              }
            </li>
          }
        </ul>
        @if (more() > 0) {
          <p class="more">{{ i18n.t('+ ' + more() + ' more — type to narrow the list', '+ ' + more() + ' zaidi — andika ili kupunguza orodha') }}</p>
        }
      }

      <ng-container dialogActions>
        @if (added()) { <span class="done"><lsms-icon name="task_alt" [size]="16" />{{ i18n.t(added() + ' added', added() + ' zimeongezwa') }}</span> }
        <button lsmsButton="secondary" (click)="ref.close(latest() ?? undefined)">{{ added() ? i18n.t('Done', 'Maliza') : i18n.t('Close', 'Funga') }}</button>
      </ng-container>
    </lsms-dialog>
  `,
  styles: `
    lsms-search-bar { margin-bottom: 10px; }
    ul { display: flex; flex-direction: column; margin: 0; padding: 0; list-style: none; }
    li { border-bottom: 1px solid var(--c-border); }
    li.open { background: color-mix(in srgb, var(--c-primary) 5%, transparent); border-radius: 10px; border-bottom-color: transparent; }
    .row { display: flex; align-items: center; gap: 12px; width: 100%; padding: 10px 8px; border: 0; background: none; font: inherit; text-align: left; color: var(--c-text); cursor: pointer; }
    .row:hover { background: var(--c-hover); border-radius: 10px; }
    .nm { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px; b { font-size: 0.88rem; font-weight: 600; } small { font-size: 0.72rem; color: var(--c-text-2); } }
    .stk { flex-shrink: 0; display: flex; flex-direction: column; align-items: flex-end; gap: 1px; text-align: right; font-variant-numeric: tabular-nums;
      b { font-size: 0.84rem; font-weight: 600; } small { font-size: 0.72rem; color: var(--c-text-2); } small.low { color: var(--c-warning); } }
    .nm small.tag { display: inline-flex; align-items: center; gap: 3px; width: fit-content; margin-top: 2px; padding: 1px 7px; border-radius: 100px; font-size: 0.68rem; }
    .nm small.tag.warn { color: var(--c-warning); background: color-mix(in srgb, var(--c-warning) 12%, transparent); }
    .add { display: flex; flex-direction: column; gap: 8px; padding: 2px 8px 12px; }
    .warnbox { display: flex; gap: 8px; margin: 0; padding: 9px 12px; border-radius: 10px; font-size: 0.8rem; color: var(--c-text);
      background: color-mix(in srgb, var(--c-warning) 9%, var(--c-surface)); border: 1px solid color-mix(in srgb, var(--c-warning) 35%, transparent);
      lsms-icon { color: var(--c-warning); flex-shrink: 0; } span { display: flex; flex-direction: column; gap: 2px; font-weight: 600; } small { font-weight: 400; color: var(--c-text-2); } }
    .src, .after { font-size: 0.72rem; color: var(--c-text-2); b { font-weight: 600; color: var(--c-text); } }
    .act { display: flex; align-items: center; flex-wrap: wrap; gap: 10px; }
    .unit { font-size: 0.8rem; color: var(--c-text-2); }
    .cost { flex: 1; text-align: right; font-size: 0.92rem; font-variant-numeric: tabular-nums; color: var(--c-text); }
    .step { display: inline-flex; align-items: center; border: 1px solid var(--c-border); border-radius: 10px; overflow: hidden; background: var(--c-surface); }
    .step button { width: 38px; height: 38px; border: 0; background: transparent; font-size: 1.15rem; color: var(--c-text); cursor: pointer; }
    .step button:disabled { opacity: 0.4; cursor: default; }
    .step button:hover:not(:disabled) { background: var(--c-bg); }
    .step input { width: 50px; height: 38px; border: 0; border-inline: 1px solid var(--c-border); text-align: center; font: inherit; font-weight: 700; font-variant-numeric: tabular-nums; color: var(--c-text); background: transparent; -moz-appearance: textfield; }
    .step input::-webkit-outer-spin-button, .step input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
    .more { margin: 10px 2px 0; font-size: 0.76rem; color: var(--c-text-2); }
    .done { display: inline-flex; align-items: center; gap: 5px; margin-right: auto; font-size: 0.8rem; color: var(--c-success); }
  `,
})
export class OrderAddDialog {
  protected readonly data = inject<OrderAddData>(DIALOG_DATA);
  protected readonly ref = inject<DialogRef<OrderSuggestion>>(DialogRef);
  protected readonly i18n = inject(LanguageService);
  private readonly api = inject(OrderService);
  private readonly toast = inject(ToastService);

  /** Products not on the order; null while loading. */
  protected readonly all = signal<OrderCandidate[] | null>(null);
  protected readonly error = signal('');
  private readonly query = signal('');
  protected readonly picked = signal<string | null>(null);
  protected readonly packs = signal(1);
  protected readonly saving = signal(false);
  protected readonly added = signal(0);
  /** The order after the last product added — what the dialog closes with. */
  protected readonly latest = signal<OrderSuggestion | null>(null);

  private readonly matches = computed(() => filterCandidates(this.all() ?? [], this.query()));
  protected readonly shown = computed(() => this.matches().slice(0, MAX_ROWS));
  protected readonly more = computed(() => Math.max(0, this.matches().length - MAX_ROWS));

  constructor() {
    void this.load();
  }

  private async load(): Promise<void> {
    try {
      this.all.set(await this.api.candidates(this.data.orderUid));
    } catch (e) {
      this.error.set(ApiError.from(e).message);
    }
  }

  protected search(text: string): void {
    this.query.set(text);
  }

  protected pick(c: OrderCandidate): void {
    const open = this.picked() === c.productUid;
    this.picked.set(open ? null : c.productUid);
    this.packs.set(1);
  }

  protected set(raw: string): void {
    this.packs.set(Math.max(1, Math.min(999, Math.floor(Number(raw) || 1))));
  }

  protected bump(by: number): void {
    this.set(String(this.packs() + by));
  }

  protected async add(c: OrderCandidate): Promise<void> {
    this.saving.set(true);
    try {
      this.latest.set(await this.api.addLine(this.data.orderUid, c.productUid, this.packs()));
      this.added.update((n) => n + 1);
      this.all.update((list) => (list ?? []).filter((x) => x.productUid !== c.productUid));
      this.picked.set(null);
      this.toast.success(this.i18n.t(`${c.displayName} added to the order`, `${c.displayName} imeongezwa kwenye oda`));
    } catch (e) {
      this.toast.error(ApiError.from(e).message);
    } finally {
      this.saving.set(false);
    }
  }

  // ── Labels ────────────────────────────────────────────────────────────────

  private w(key: keyof typeof PACK_WORDS): string {
    const [en, sw] = PACK_WORDS[key];
    return this.i18n.t(en, sw);
  }

  protected unit(c: OrderCandidate): string {
    return packUnit(c.packageAbbreviation, this.w('pkg'));
  }

  /** "SPIRIT · 30 pcs/ctn" — the shared product label without the name. */
  protected detail(c: OrderCandidate): string {
    return productDetail({ category: c.category, piecesPerPackage: c.piecesPerPack, abbreviation: c.packageAbbreviation }, { pkg: this.w('pkg') });
  }

  /** Pieces in the product's own package: "3 ctn + 5 pcs". */
  protected qty(c: OrderCandidate, pieces: number): string {
    return qtyLabel(pieces, c, { pkg: this.w('pkg'), pcs: this.i18n.t('pcs', 'vip') });
  }

  /** The stock as it is today, and how long it lasts. */
  protected cover(c: OrderCandidate): AfterOrder {
    return afterOrder(c, 0);
  }

  protected after(c: OrderCandidate): AfterOrder {
    return afterOrder(c, this.packs());
  }

  protected days(d: number): string {
    return this.i18n.t(`${daysLabel(d)} days`, `siku ${daysLabel(d)}`);
  }

  protected lasts(a: AfterOrder): string {
    return a.days === null ? this.i18n.t('not sold in 14 days', 'haijauzwa siku 14') : `≈ ${this.days(a.days)}`;
  }

  protected source(c: OrderCandidate): string {
    if (c.stockSource !== 'COUNT') return this.i18n.t('Stock: system estimate — not counted', 'Stoki: makadirio ya mfumo — counting haijafanyika');
    const d = parseLocal(c.stockCountedAt);
    const at = d ? `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` : '';
    return at ? this.i18n.t(`Stock: counted ${at}`, `Stoki: imehesabiwa ${at}`) : this.i18n.t('Stock: counted', 'Stoki: imehesabiwa');
  }

  /** The short name of the slow-movers verdict, for the tag on the row. */
  protected action(c: OrderCandidate): string {
    return c.slowAction ? this.slowWords().actions[c.slowAction] : '';
  }

  /** "Acha kuagiza — stoki ya siku 96 · thamani 126,000". */
  protected warning(c: OrderCandidate): string | null {
    return slowWarning(c, this.slowWords(), (v) => this.m(v));
  }

  private slowWords() {
    return slowWords((en, sw) => this.i18n.t(en, sw));
  }

  protected m(v: number): string {
    return Money.format(v, { decimals: 0 });
  }
}
