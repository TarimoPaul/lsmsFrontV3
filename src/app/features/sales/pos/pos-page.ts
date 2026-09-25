import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

import { ApiError } from '@core/api/api.types';
import { AuthService } from '@core/auth/auth.service';
import { LanguageService } from '@core/i18n/language.service';
import { Button, ComboOption, Combobox, DialogService, EmptyState, Icon, SearchBar, Skeleton, TextField, ToastService } from '@shared/ui';
import { addDays, dayOnly, isSameDay, parseLocal, toIsoDate, toLocalDateTime } from '@shared/utils/date-utils';
import { Money, MoneyPipe } from '@shared/utils/money';
import { CustomersService } from '../../customers/customers.service';
import { StoreService } from '../../store/store.service';
import { CartDraft, DraftsStore } from './drafts.store';
import { HeldOrders } from './held-orders';
import type { HoldData, HoldResult } from './hold-dialog';
import type { MissingDaysData, MissingDaysResult } from './missing-days-dialog';
import type { SaleDoneData } from './sale-done-dialog';
import { categoryColor, categoryInitials } from '../../categories/categories.models';
import { PAYMENT_METHODS, PosProduct, SALE_TYPE_ORDER, SALE_TYPES, SaleRequest, SaleType, methodLabel } from '../sales.models';
import { SalesService } from '../sales.service';
import { CartCustomer, CartLine, CartStore } from './cart.store';

type StockFilter = 'all' | 'in' | 'low';

/** Days checked for "no sales recorded" (Flutter getMissingSalesDays). */
const MISSING_LOOKBACK = 7;

/**
 * The till — port of Flutter `SalesTable` (the "Add sale" interface):
 * products with stock and their Retail / Quarter / Half / Wholesale price
 * buttons, a cart with quantities and price overrides, customer, discount,
 * backdating (SALES_BACKDATE), payment method + amount, then a partial-safe
 * save (items short of stock stay in the cart with the reason).
 */
@Component({
  selector: 'app-pos-page',
  imports: [RouterLink, Button, Icon, SearchBar, Skeleton, EmptyState, TextField, Combobox, MoneyPipe, HeldOrders],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './pos-page.html',
  styleUrl: './pos-page.scss',
})
export class PosPage {
  protected readonly i18n = inject(LanguageService);
  protected readonly auth = inject(AuthService);
  protected readonly cart = inject(CartStore);
  protected readonly drafts = inject(DraftsStore);
  private readonly api = inject(SalesService);
  private readonly customersApi = inject(CustomersService);
  private readonly store = inject(StoreService);
  private readonly dialogs = inject(DialogService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  protected readonly types = SALE_TYPES;
  protected readonly typeOrder = SALE_TYPE_ORDER;
  protected readonly products = computed(() => this.api.posStock.value() ?? []);
  protected readonly loading = computed(() => this.api.posStock.initialLoading());
  protected readonly error = signal<string | null>(null);
  protected readonly search = signal('');
  protected readonly category = signal<string | null>(null);
  protected readonly stockFilter = signal<StockFilter>('in');
  protected readonly limit = signal(60);
  protected readonly cartOpen = signal(false);
  protected readonly editingPrice = signal<string | null>(null);
  /** Recent days (before today) with no sale — drives the cart reminder. */
  protected readonly missingDays = signal<string[]>([]);
  /** Blinks the Customer field when an action (Hold) needs a customer. */
  protected readonly customerAttention = signal(false);

  // Customer
  protected readonly newCustomer = signal(false);
  protected readonly newName = signal('');
  protected readonly newPhone = signal('');

  // Payment
  protected readonly method = signal('CASH');
  /** null = "exact" (follows the total). */
  protected readonly received = signal<number | null>(null);
  protected readonly saleDate = signal<string>(toIsoDate(new Date()));
  protected readonly busy = signal(false);

  protected readonly canDiscount = computed(() => this.auth.hasAnyPermission(['SALES_DISCOUNT_APPLY', 'SALES_UPDATE']));
  protected readonly maxBackdate = computed(() => this.auth.maxBackdateDays());
  protected readonly minDate = computed(() => toIsoDate(addDays(new Date(), -Math.min(this.maxBackdate(), 3650))));
  protected readonly today = toIsoDate(new Date());

  protected readonly categories = computed(() => {
    const m = new Map<string, number>();
    for (const p of this.products()) if (p.category) m.set(p.category, (m.get(p.category) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  });

  protected readonly filtered = computed(() => {
    const q = this.search().trim().toLowerCase();
    const c = this.category();
    const f = this.stockFilter();
    const reserved = this.cart.reserved();
    return this.products().filter((p) => {
      if (c && p.category !== c) return false;
      // "In stock" keeps a product visible even when all of it is already in the cart.
      if (f === 'in' && p.stock <= 0) return false;
      const left = p.stock - (reserved.get(p.uid) ?? 0);
      if (f === 'low' && (left <= 0 || left > 10)) return false;
      return !q || p.search.includes(q);
    });
  });
  protected readonly shown = computed(() => this.filtered().slice(0, this.limit()));

  protected readonly customerOptions = computed<ComboOption[]>(() =>
    (this.customersApi.list.value() ?? []).map((c) => ({
      value: c.uid,
      label: c.name,
      hint: [c.phoneNumber, c.outstandingBalance > 0 ? `${this.i18n.t('owes', 'deni')} ${Money.format(c.outstandingBalance, { decimals: 0 })}` : ''].filter(Boolean).join(' · ') || undefined,
      keywords: c.phoneNumber ?? undefined,
    })),
  );
  protected readonly selectedCustomer = computed(() => {
    const uid = this.cart.customer()?.uid;
    return uid ? ((this.customersApi.list.value() ?? []).find((c) => c.uid === uid) ?? null) : null;
  });

  protected readonly allMethods = computed(() => this.api.paymentMethods.value() ?? ['CASH']);
  protected readonly moreMethods = signal(false);
  /** Common methods first; the rest behind "More" (the selected one always shows). */
  protected readonly methods = computed(() => {
    const all = this.allMethods();
    if (this.moreMethods()) return all;
    const common = ['CASH', 'VODACOM', 'TIGOPESA', 'AIRTELMONEY', 'CREDIT'];
    return all.filter((m) => common.includes(m) || m === this.method());
  });
  protected readonly paid = computed(() => {
    if (this.method() === 'CREDIT') return 0;
    const r = this.received();
    return r === null ? this.cart.total() : r;
  });
  protected readonly change = computed(() => Math.max(0, this.paid() - this.cart.total()));
  protected readonly owed = computed(() => Math.max(0, this.cart.total() - this.paid()));
  protected readonly hasCustomer = computed(() => !!this.cart.customer() || (this.newCustomer() && this.newName().trim().length >= 2));
  /** Flutter rule: a discount or an unpaid balance must be tied to a customer. */
  protected readonly needsCustomer = computed(() => this.cart.discount() > 0 || this.owed() > 0.01);
  protected readonly belowCost = computed(() => this.cart.lines().filter((l) => l.costPerPiece !== null && l.unitPrice < l.costPerPiece * l.unitPieces - 0.01));

  protected readonly blocker = computed<string | null>(() => {
    const t = (en: string, sw: string) => this.i18n.t(en, sw);
    if (!this.cart.count()) return t('Add products to the cart', 'Ongeza bidhaa kwenye kapu');
    if (this.cart.discount() > this.cart.subtotal()) return t('Discount is bigger than the total', 'Punguzo ni kubwa kuliko jumla');
    if (this.cart.total() <= 0) return t('The total must be above zero', 'Jumla lazima iwe zaidi ya sifuri');
    if (this.needsCustomer() && !this.hasCustomer()) {
      return this.owed() > 0.01 ? t('Choose the customer who will owe the balance', 'Chagua mteja atakayedaiwa salio') : t('A discount needs a customer', 'Punguzo linahitaji mteja');
    }
    if (this.newCustomer() && this.newName().trim().length < 2) return t('Enter the new customer name', 'Weka jina la mteja mpya');
    if (this.belowCost().length) return t('A price is below cost', 'Bei iko chini ya gharama');
    return null;
  });

  constructor() {
    void this.reload(false);
    void this.api.paymentMethods.load().catch(() => undefined);
    if (this.auth.hasPermission('CUSTOMER_READ')) void this.customersApi.list.load().catch(() => undefined);
    void this.loadMissing();
    // Announce held orders that closed after their 12 hours.
    effect(() => {
      const gone = this.drafts.expired();
      if (!gone.length) return;
      untracked(() => {
        this.toast.warning(
          this.i18n.t(`Held order(s) closed after 12 hours: ${gone.join(', ')}`, `Oda zilizohifadhiwa zimefungwa baada ya masaa 12: ${gone.join(', ')}`),
        );
        this.drafts.expired.set([]);
      });
    });
  }

  private async loadMissing(): Promise<string[]> {
    const days = await this.api.missingDays(MISSING_LOOKBACK);
    this.missingDays.set(days);
    return days;
  }

  /**
   * Calendar of recent days without sales. Resolves true only when the user
   * confirms the sale is for today; picking a missing day switches the cart
   * to it and stops, so the user reviews before completing (Flutter rule).
   */
  protected async showMissing(mode: MissingDaysData['mode']): Promise<boolean> {
    const { MissingDaysDialog } = await import('./missing-days-dialog');
    const res = await this.dialogs.openAsync<MissingDaysResult, MissingDaysData>(MissingDaysDialog, {
      size: 'sm',
      data: {
        missing: this.missingDays(),
        lookback: MISSING_LOOKBACK,
        minDate: this.maxBackdate() > 0 ? this.minDate() : null,
        selected: this.saleDate(),
        mode,
      },
    });
    if (!res) return false;
    if (res === 'today') return true;
    this.saleDate.set(res);
    const day = parseLocal(res)?.toLocaleDateString(this.i18n.isSwahili() ? 'sw-TZ' : 'en-GB', { weekday: 'long', day: 'numeric', month: 'long' }) ?? res;
    this.toast.info(this.i18n.t(`Sale date set to ${day}. Check the cart, then complete the sale.`, `Tarehe ya mauzo: ${day}. Kagua kapu kisha kamilisha mauzo.`));
    return false;
  }

  protected async reload(force = true): Promise<void> {
    this.error.set(null);
    try {
      await this.api.posStock.load(force);
    } catch (e) {
      this.error.set(ApiError.from(e).message);
    }
  }

  // ── Products ──────────────────────────────────────────────────────────────
  protected left(p: PosProduct): number {
    return p.stock - (this.cart.reserved().get(p.uid) ?? 0);
  }

  protected stockText(p: PosProduct): string {
    const left = this.left(p);
    const ppp = p.piecesPerPackage ?? 0;
    const pcs = this.i18n.t('pcs', 'vip');
    if (ppp > 1 && left >= ppp) {
      const whole = Math.floor(left / ppp);
      const rest = left % ppp;
      return `${whole} ${p.abbreviation ?? this.i18n.t('pkg', 'pkt')}${rest ? ` + ${rest} ${pcs}` : ''}`;
    }
    return `${left} ${pcs}`;
  }

  /** Pieces of this product already in the cart. */
  protected reservedOf(p: PosProduct): number {
    return this.cart.reserved().get(p.uid) ?? 0;
  }

  protected option(p: PosProduct, t: SaleType): PosProduct['options'][number] | undefined {
    return p.options.find((o) => o.type === t);
  }

  /** Same category-coloured initials tile as the Products list. */
  protected readonly tileColor = (p: PosProduct) => categoryColor(p.category ?? p.name);
  protected readonly initials = (p: PosProduct) => categoryInitials(p.name);

  protected inCart(p: PosProduct, t: SaleType): number {
    return this.cart.unitsByKey().get(`${p.uid}|${t}`) ?? 0;
  }

  protected add(p: PosProduct, t: SaleType, pieces: number): void {
    if (this.left(p) < pieces) {
      this.toast.error(this.i18n.t(`Not enough stock of ${p.name}: ${this.left(p)} pcs left`, `Stock ya ${p.name} haitoshi: vimebaki vipande ${this.left(p)}`));
      return;
    }
    this.cart.add(p, t);
  }

  protected typeLabel(t: SaleType | string): string {
    const x = SALE_TYPES[t as SaleType];
    return x ? (this.i18n.isSwahili() ? x.sw : x.en) : String(t);
  }

  // ── Cart ──────────────────────────────────────────────────────────────────
  protected product(uid: string): PosProduct | undefined {
    return this.products().find((p) => p.uid === uid);
  }

  protected inc(l: CartLine, d: number): void {
    if (d > 0) {
      const p = this.product(l.productUid);
      if (p && this.left(p) < l.unitPieces) {
        this.toast.error(this.i18n.t('Not enough stock', 'Stock haitoshi'));
        return;
      }
    }
    this.cart.setQty(l.key, l.qty + d);
  }

  protected typeQty(l: CartLine, v: string): void {
    const n = Math.floor(Number(v));
    if (!Number.isFinite(n) || n <= 0) return;
    const p = this.product(l.productUid);
    const extra = (n - l.qty) * l.unitPieces;
    if (p && extra > 0 && this.left(p) < extra) {
      this.toast.error(this.i18n.t(`Only ${this.left(p) + l.qty * l.unitPieces} pcs in stock`, `Vipande ${this.left(p) + l.qty * l.unitPieces} tu vipo stoo`));
      return;
    }
    this.cart.setQty(l.key, n);
  }

  protected setPrice(l: CartLine, v: string): void {
    const n = Math.round(Number(String(v).replace(/[^\d.]/g, '')));
    this.editingPrice.set(null);
    if (!Number.isFinite(n) || n <= 0 || n === l.unitPrice) return;
    this.cart.setPrice(l.key, n);
  }

  protected minPrice(l: CartLine): number | null {
    return l.costPerPiece === null ? null : Math.ceil(l.costPerPiece * l.unitPieces);
  }

  protected setDiscount(v: string): void {
    const n = Math.max(0, Math.round(Number(String(v).replace(/[^\d.]/g, '')) || 0));
    this.cart.discount.set(n);
  }

  protected setReceived(v: string): void {
    const raw = String(v).replace(/[^\d.]/g, '');
    this.received.set(raw === '' ? null : Math.round(Number(raw)));
  }

  protected pickMethod(m: string): void {
    this.method.set(m);
    if (m === 'CREDIT') this.received.set(null);
  }

  protected methodName(m: string): string {
    return methodLabel(m, this.i18n.isSwahili());
  }

  protected methodIcon(m: string): string {
    return PAYMENT_METHODS[m]?.icon ?? 'payments';
  }

  protected pickCustomer(uid: string | null): void {
    const c = uid ? (this.customersApi.list.value() ?? []).find((x) => x.uid === uid) : null;
    this.cart.customer.set(c ? { uid: c.uid, name: c.name, phone: c.phoneNumber, outstanding: c.outstandingBalance, creditLimit: c.creditLimit } : null);
  }

  protected toggleNewCustomer(): void {
    this.newCustomer.update((v) => !v);
    if (this.newCustomer()) this.cart.customer.set(null);
  }

  // ── Held orders (drafts) ──────────────────────────────────────────────────
  /**
   * The cart's customer, registering the one typed under "New customer"
   * first (the backend returns the existing customer for a known phone).
   */
  private async registerNewCustomer(): Promise<CartCustomer | null> {
    const t = (en: string, sw: string) => this.i18n.t(en, sw);
    if (!this.newCustomer() || this.newName().trim().length < 2) return this.cart.customer();
    const res = await this.customersApi.create({
      name: this.newName().trim(),
      phoneNumber: this.newPhone().trim() || null,
      email: null,
      address: null,
      customerType: 'REGULAR',
      creditLimit: null,
    });
    const customer: CartCustomer = { uid: res.customer.uid, name: res.customer.name, phone: res.customer.phoneNumber };
    if (res.existed) this.toast.info(t(`Existing customer used: ${res.customer.name}`, `Mteja aliyepo ametumika: ${res.customer.name}`));
    this.cart.customer.set(customer);
    this.newCustomer.set(false);
    return customer;
  }

  /**
   * Holding needs the customer from the cart's own Customer field (pick one or
   * register a new one there — no separate name box). Without one the field
   * blinks, scrolls into view and takes focus.
   */
  private async requireCustomer(): Promise<CartCustomer | null> {
    try {
      const c = await this.registerNewCustomer();
      if (c) return c;
    } catch (e) {
      this.toast.error(ApiError.from(e).message);
      return null;
    }
    this.cartOpen.set(true);
    this.customerAttention.set(false);
    requestAnimationFrame(() => {
      this.customerAttention.set(true);
      const box = document.querySelector<HTMLElement>('app-pos-page .cust');
      box?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      box?.querySelector<HTMLInputElement>('input')?.focus({ preventScroll: true });
    });
    setTimeout(() => this.customerAttention.set(false), 2000);
    this.toast.warning(
      this.newCustomer()
        ? this.i18n.t('Enter the new customer’s name (at least 2 letters) to hold this order.', 'Weka jina la mteja mpya (angalau herufi 2) ili kuhifadhi oda.')
        : this.i18n.t('Choose the customer — or register a new one — to hold this order.', 'Chagua mteja — au sajili mpya — ili kuhifadhi oda hii.'),
    );
    return null;
  }

  private park(label: string, note: string | null): CartDraft {
    const d = this.drafts.add({
      label,
      note,
      lines: this.cart.lines(),
      customer: this.cart.customer(),
      discount: this.cart.discount(),
      saleDate: this.saleDate() === this.today ? null : this.saleDate(),
    }, this.cart.heldSince());
    this.resetSale();
    return d;
  }

  /** Put the cart aside for its customer so the next customer can be served. */
  protected async holdCart(): Promise<void> {
    if (!this.cart.count() || this.busy()) return;
    this.busy.set(true);
    try {
      const customer = await this.requireCustomer();
      if (!customer) return;
      const { HoldDialog } = await import('./hold-dialog');
      const res = await this.dialogs.openAsync<HoldResult, HoldData>(HoldDialog, {
        size: 'sm',
        data: { customer: customer.name, phone: customer.phone, items: this.cart.count(), total: this.cart.total() },
      });
      if (!res) return;
      this.park(customer.name, res.note);
      this.toast.success(this.i18n.t(`“${customer.name}” held — start the next order.`, `“${customer.name}” imehifadhiwa — anza oda inayofuata.`));
    } finally {
      this.busy.set(false);
    }
  }

  /**
   * Bring a held order back. A cart in progress is held first for its
   * customer (never lost; without a customer the Customer field blinks and
   * nothing switches); lines at the normal price take today's price,
   * hand-set prices are kept, products no longer sold are flagged, and the
   * order keeps its 12-hour clock.
   */
  protected async resumeDraft(d: CartDraft): Promise<void> {
    const t = (en: string, sw: string) => this.i18n.t(en, sw);
    if (this.cart.count()) {
      const customer = await this.requireCustomer();
      if (!customer) return;
      this.park(customer.name, null);
      this.toast.info(t(`Current cart held for “${customer.name}”.`, `Kapu la sasa limehifadhiwa kwa “${customer.name}”.`));
    }
    if (!this.drafts.list().some((x) => x.id === d.id)) return; // closed on time meanwhile
    this.drafts.remove(d.id);
    const lines: CartLine[] = d.lines.map((l) => {
      const p = this.product(l.productUid);
      const o = p ? this.option(p, l.saleType) : undefined;
      if (!p || !o) return { ...l, error: t('No longer sold at this price — remove it', 'Haiuzwi tena kwa bei hii — iondoe') };
      const fresh = { ...l, unitPieces: o.pieces, defaultPrice: o.price, costPerPiece: p.averageCost, error: null };
      return l.key.endsWith('*') ? fresh : { ...fresh, unitPrice: o.price };
    });
    this.cart.load({ lines, customer: d.customer, discount: d.discount, heldSince: d.createdAt });
    if (d.saleDate && d.saleDate >= this.minDate() && this.maxBackdate() > 0) this.saleDate.set(d.saleDate);
    this.cartOpen.set(true);
    this.toast.success(t(`Resumed “${d.label}”.`, `Umefungua “${d.label}”.`));
  }

  protected async discardDraft(d: CartDraft): Promise<void> {
    const ok = await this.dialogs.confirmDelete({
      title: this.i18n.t('Discard held order?', 'Futa oda iliyohifadhiwa?'),
      message: this.i18n.t(`“${d.label}” (${d.lines.length} item(s)) will be removed. Nothing was sold.`, `“${d.label}” (bidhaa ${d.lines.length}) itaondolewa. Hakuna kilichouzwa.`),
      confirmText: this.i18n.t('Discard', 'Futa'),
    });
    if (ok) this.drafts.remove(d.id);
  }

  protected async clearCart(): Promise<void> {
    if (!this.cart.count()) return;
    const ok = await this.dialogs.confirm({
      title: this.i18n.t('Clear the cart?', 'Futa kapu?'),
      message: this.i18n.t(`${this.cart.count()} item(s) will be removed.`, `Bidhaa ${this.cart.count()} zitaondolewa.`),
      confirmText: this.i18n.t('Clear', 'Futa'),
    });
    if (ok) this.resetSale();
  }

  private resetSale(): void {
    this.cart.clear();
    this.received.set(null);
    this.method.set('CASH');
    this.newCustomer.set(false);
    this.newName.set('');
    this.newPhone.set('');
    this.saleDate.set(this.today);
  }

  // ── Save ──────────────────────────────────────────────────────────────────
  private buildRequest(customer: { uid: string | null; name: string; phone: string | null } | null): SaleRequest {
    const user = this.auth.user();
    const date = this.saleDateTime();
    const name = customer?.name ?? 'Walk-in Customer';
    return {
      saleDate: date,
      customerUid: customer?.uid ?? null,
      customerName: customer?.name ?? null,
      customerPhoneNumber: customer?.phone ?? null,
      userUid: user?.uid ?? null,
      userName: this.auth.displayName() || null,
      discountAmount: this.cart.discount(),
      saleNotes: [
        `Payment Method: ${methodLabel(this.method(), true)}`,
        `Total Items: ${this.cart.count()}`,
        `Total Pieces: ${this.cart.pieces()}`,
        this.cart.discount() ? `Discount Applied: ${Money.format(this.cart.discount())}` : '',
        this.owed() ? `Outstanding Balance: ${Money.format(this.owed())}` : '',
      ]
        .filter(Boolean)
        .join(' | '),
      saleDetails: this.cart.lines().map((l) => ({
        productUid: l.productUid,
        productName: l.name,
        productCategory: l.category,
        saleType: l.saleType,
        pieceQuantity: l.qty * l.unitPieces,
        packageQuantity: l.qty,
        unitPrice: l.unitPrice,
        subTotal: l.qty * l.unitPrice,
        overrideUnitPrice: l.unitPrice !== l.defaultPrice ? l.unitPrice : null,
        costPerPiece: l.costPerPiece,
        piecesPerPackage: l.piecesPerPackage,
        packageAbbreviation: l.abbreviation,
      })),
      payments: [
        {
          customerUid: customer?.uid ?? null,
          customerName: name,
          paymentMethod: this.method(),
          totalAmount: this.cart.total(),
          amountPaid: Math.min(this.paid(), this.cart.total()),
          paymentDate: date,
          paymentNotes: this.owed() > 0 ? `Partial payment — balance ${Money.format(this.owed())}` : null,
        },
      ],
    };
  }

  /** Today → now; a past day → that day at the current time of day. */
  private saleDateTime(): string {
    const now = new Date();
    const d = parseLocal(this.saleDate()) ?? now;
    if (isSameDay(d, now)) return toLocalDateTime(now);
    const at = dayOnly(d);
    at.setHours(now.getHours(), now.getMinutes(), now.getSeconds());
    return toLocalDateTime(at);
  }

  protected async checkout(): Promise<void> {
    if (this.busy() || this.blocker()) return;
    this.busy.set(true);
    const t = (en: string, sw: string) => this.i18n.t(en, sw);
    try {
      // 1 · Days without sales (only when selling for today).
      if (this.saleDate() === this.today && !sessionStorage.getItem('lsms.missingDaysAck')) {
        if ((await this.loadMissing()).length) {
          if (!(await this.showMissing('checkout'))) return;
          sessionStorage.setItem('lsms.missingDaysAck', '1');
        }
      }

      // 2 · New customer is created first (the partial endpoint only keeps a uid).
      const customer = await this.registerNewCustomer();

      // 3 · Dry-run stock check.
      const body = this.buildRequest(customer);
      const check = await this.api.preValidate(body).catch(() => null);
      if (check?.issues.length) {
        if (!check.validCount) {
          this.toast.error(t('None of the items has enough stock.', 'Bidhaa zote hazina stock ya kutosha.'));
          this.cart.keepFailed(new Map(check.issues.map((i) => [i.productUid, i.reason])));
          return;
        }
        const ok = await this.dialogs.confirm({
          title: t('Some items are short of stock', 'Baadhi ya bidhaa hazina stock ya kutosha'),
          message:
            check.issues.map((i) => `• ${i.productName}: ${i.reason}`).join('\n') +
            '\n\n' +
            t('Sell the rest now? The short items stay in the cart.', 'Uza zilizobaki sasa? Zenye upungufu zitabaki kwenye kapu.'),
          confirmText: t('Sell the rest', 'Uza zilizobaki'),
        });
        if (!ok) return;
      }

      // 4 · Save.
      const res = await this.api.createPartial(body);
      const change = this.change();
      this.api.posStock.invalidate();
      this.store.stock.invalidate();
      this.store.insights.invalidate();
      if (this.saleDate() !== this.today) void this.loadMissing();
      void this.api.posStock.load(true).catch(() => undefined);
      if (res.failed.length) {
        this.cart.keepFailed(new Map(res.failed.map((f) => [f.productUid, f.reason])));
        this.received.set(null);
      } else {
        this.resetSale();
      }
      if (res.sale) {
        const { SaleDoneDialog } = await import('./sale-done-dialog');
        const next = await this.dialogs.openAsync<'list', SaleDoneData>(SaleDoneDialog, { size: 'md', data: { sale: res.sale, change, failed: res.failed } });
        if (next === 'list') void this.router.navigate(['/sales']);
      } else {
        this.toast.error(res.message ?? t('Nothing was sold', 'Hakuna kilichouzwa'));
      }
    } catch (e) {
      this.toast.error(ApiError.from(e).message);
    } finally {
      this.busy.set(false);
    }
  }
}
