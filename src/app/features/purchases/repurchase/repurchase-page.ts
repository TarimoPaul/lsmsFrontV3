import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { ApiError } from '@core/api/api.types';
import { AuthService } from '@core/auth/auth.service';
import { LanguageService } from '@core/i18n/language.service';
import { Button, ComboOption, Combobox, DialogService, EmptyState, Icon, SearchBar, Skeleton, ToastService } from '@shared/ui';
import { Money, MoneyPipe } from '@shared/utils/money';
import { ReconciliationService } from '../../reconciliation/reconciliation.service';
import { StoreService } from '../../store/store.service';
import { HEALTH, StockHealth, StockItem, packagesLabel, stockHealth } from '../../store/store.models';
import { SuppliersService } from '../../suppliers/suppliers.service';
import type { PurchaseDetailsResult } from '../purchase-details-dialog';
import { PURCHASE_STATUS, Purchase, PurchaseStatus, PurchaseType, RepurchasableProduct, RepurchaseLine, linePieces, lineTotal } from '../purchases.models';
import { PurchasesService } from '../purchases.service';
import { RepurchaseCartStore } from './repurchase-cart.store';
import type { RepurchaseDoneData } from './repurchase-done-dialog';
import { buildInvoice } from './repurchase-invoice';

type Filter = 'all' | 'restock' | 'out' | 'in' | 'waiting';

/** Below this many pieces a product counts as "needs restock" (Store's default threshold). */
const LOW_AT = 10;
const round2 = (v: number) => Math.round(v * 100) / 100;

interface Row {
  p: RepurchasableProduct;
  stock: StockItem | null;
  health: StockHealth;
  /** A PENDING / APPROVED purchase of this product — it cannot be ordered again until done. */
  waiting: { uid: string; status: PurchaseStatus } | null;
}

/**
 * Repurchase — port of Flutter `RepurchasableProductsScreen`: products bought
 * before with their stock, filters (needs restock / out / in stock / waiting),
 * a cart pre-filled from each product's last purchase (quantity, unit, cost,
 * supplier), then one bulk order → PENDING purchases + a saved, printable
 * invoice. Unlike Flutter, products with a purchase still pending / approved
 * are blocked (the bulk endpoint skips that duplicate check).
 */
@Component({
  selector: 'app-repurchase-page',
  imports: [RouterLink, Button, Icon, SearchBar, Skeleton, EmptyState, Combobox, MoneyPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './repurchase-page.html',
  styleUrl: './repurchase-page.scss',
})
export class RepurchasePage {
  protected readonly i18n = inject(LanguageService);
  protected readonly cart = inject(RepurchaseCartStore);
  private readonly auth = inject(AuthService);
  private readonly api = inject(PurchasesService);
  private readonly store = inject(StoreService);
  private readonly suppliersApi = inject(SuppliersService);
  private readonly dialogs = inject(DialogService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly reconApi = inject(ReconciliationService);

  /** Opened from a reconciliation's Purchases tab: offer to link what gets ordered to that day's cash. */
  protected readonly recon = this.route.snapshot.queryParamMap.get('recon');
  protected readonly reconDate = this.route.snapshot.queryParamMap.get('reconDate');

  protected readonly health = HEALTH;
  protected readonly status = PURCHASE_STATUS;
  protected readonly linePieces = linePieces;
  protected readonly lineTotal = lineTotal;

  protected readonly error = signal<string | null>(null);
  protected readonly search = signal('');
  protected readonly filter = signal<Filter>('all');
  protected readonly category = signal<string | null>(null);
  protected readonly limit = signal(60);
  protected readonly cartOpen = signal(false);
  protected readonly adding = signal<Set<string>>(new Set());
  protected readonly busy = signal(false);
  private readonly queue = signal<Map<string, { uid: string; status: PurchaseStatus }>>(new Map());

  protected readonly loading = computed(() => this.api.repurchasable.initialLoading());

  protected readonly rows = computed<Row[]>(() => {
    const stock = new Map((this.store.stock.value() ?? []).map((s) => [s.uid, s]));
    const q = this.queue();
    return (this.api.repurchasable.value() ?? []).map((p) => {
      const s = stock.get(p.uid) ?? null;
      return { p, stock: s, health: s ? stockHealth(s, LOW_AT) : 'OUT', waiting: q.get(p.uid) ?? null };
    });
  });

  protected readonly counts = computed(() => {
    const r = this.rows();
    return {
      all: r.length,
      restock: r.filter((x) => x.health !== 'OK').length,
      out: r.filter((x) => x.health === 'OUT' || x.health === 'NEGATIVE').length,
      in: r.filter((x) => x.health === 'OK' || x.health === 'LOW').length,
      waiting: r.filter((x) => x.waiting).length,
    };
  });

  protected readonly categories = computed(() => {
    const m = new Map<string, number>();
    for (const r of this.rows()) if (r.p.category) m.set(r.p.category, (m.get(r.p.category) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  });

  protected readonly filtered = computed(() => {
    const q = this.search().trim().toLowerCase();
    const c = this.category();
    const f = this.filter();
    const list = this.rows().filter((r) => {
      if (c && r.p.category !== c) return false;
      if (f === 'restock' && r.health === 'OK') return false;
      if (f === 'out' && r.health !== 'OUT' && r.health !== 'NEGATIVE') return false;
      if (f === 'in' && r.health !== 'OK' && r.health !== 'LOW') return false;
      if (f === 'waiting' && !r.waiting) return false;
      return !q || r.p.name.toLowerCase().includes(q) || (r.p.category ?? '').toLowerCase().includes(q);
    });
    // Most urgent first when looking for what to restock.
    return f === 'restock' ? [...list].sort((a, b) => (a.stock?.currentStock ?? 0) - (b.stock?.currentStock ?? 0)) : list;
  });
  protected readonly shown = computed(() => this.filtered().slice(0, this.limit()));

  protected readonly supplierOptions = computed<ComboOption[]>(() => {
    const names = new Map<string, ComboOption>();
    for (const s of this.suppliersApi.list.value() ?? []) names.set(s.name.toLowerCase(), { value: s.name, label: s.name, hint: s.phone ?? undefined });
    for (const l of this.cart.lines()) {
      for (const n of [l.supplierName, l.lastSupplierName]) {
        if (n && !names.has(n.toLowerCase())) names.set(n.toLowerCase(), { value: n, label: n });
      }
    }
    return [...names.values()].sort((a, b) => a.label.localeCompare(b.label));
  });

  /** Cart lines whose product got a pending / approved purchase meanwhile. */
  protected readonly blockedInCart = computed(() => this.cart.lines().filter((l) => this.queue().has(l.productUid)).length);
  protected readonly canSubmit = computed(() => this.cart.count() > 0 && !this.cart.invalid() && !this.blockedInCart() && !this.busy());

  constructor() {
    void this.load();
    if (this.auth.hasPermission('SUPPLIER_READ')) void this.suppliersApi.list.load().catch(() => undefined);
  }

  protected async load(force = false): Promise<void> {
    this.error.set(null);
    const queue = this.loadQueue();
    void this.store.stock.load(force).catch(() => undefined);
    try {
      await this.api.repurchasable.load(force);
    } catch (e) {
      this.error.set(ApiError.from(e).message);
      return;
    }
    await queue;
    const add = this.route.snapshot.queryParamMap.get('add');
    if (add) {
      void this.router.navigate([], { queryParams: { add: null }, queryParamsHandling: 'merge', replaceUrl: true });
      const row = this.rows().find((r) => r.p.uid === add);
      if (row) {
        await this.add(row);
        this.cartOpen.set(true);
      } else this.toast.info(this.i18n.t('This product has no earlier purchase to repeat.', 'Bidhaa hii haina manunuzi ya awali ya kurudia.'));
    }
  }

  private async loadQueue(): Promise<void> {
    try {
      const [p, a] = await Promise.all([this.api.byStatus('PENDING'), this.api.byStatus('APPROVED')]);
      const m = new Map<string, { uid: string; status: PurchaseStatus }>();
      for (const x of [...a, ...p]) m.set(x.productUid, { uid: x.uid, status: x.status });
      this.queue.set(m);
    } catch {
      // Without the queue nothing is blocked client-side; the list still works.
    }
  }

  protected setFilter(f: Filter): void {
    this.filter.set(f);
    this.limit.set(60);
  }

  protected stockText(r: Row): string {
    if (!r.stock) return this.i18n.t('No stock', 'Hakuna');
    return packagesLabel(r.stock.currentStock, r.stock.piecesPerPackage ?? r.p.piecesPerPackage, r.stock.packageAbbreviation ?? r.p.abbreviation, this.i18n.t('pcs', 'vip'));
  }

  protected isAdding(uid: string): boolean {
    return this.adding().has(uid);
  }

  /** Add a product using its last purchase as the starting point (Flutter `addToCartFromTemplate`). */
  protected async add(r: Row): Promise<void> {
    if (r.waiting || this.cart.has(r.p.uid) || this.isAdding(r.p.uid)) return;
    this.adding.update((s) => new Set(s).add(r.p.uid));
    try {
      const t = await this.api.template(r.p.uid);
      const ppp = t.piecesPerPackage ?? r.p.piecesPerPackage;
      const packs = !!ppp && ppp > 1;
      const type: PurchaseType = packs && t.lastPurchaseType !== 'INDIVIDUAL_PIECES' ? 'WHOLE_PACKAGE' : 'INDIVIDUAL_PIECES';
      const perPiece = t.lastCostPerPiece ?? (t.lastCostPerPackage && packs ? t.lastCostPerPackage / ppp! : null) ?? r.p.averageCost ?? 0;
      const perPack = t.lastCostPerPackage ?? (packs ? perPiece * ppp! : null);
      const lastQty = t.lastQuantity && t.lastQuantity > 0 ? t.lastQuantity : 1;
      // The last quantity was in the last unit; convert when we switch unit.
      const qty = t.lastPurchaseType === type || !packs ? lastQty : type === 'WHOLE_PACKAGE' ? Math.max(1, Math.round(lastQty / ppp!)) : lastQty * ppp!;
      this.cart.add({
        productUid: r.p.uid,
        name: r.p.name,
        category: r.p.category,
        purchaseType: type,
        quantity: Math.round(qty) || 1,
        unitPrice: round2((type === 'WHOLE_PACKAGE' ? perPack : perPiece) ?? 0),
        supplierName: t.lastSupplierName,
        piecesPerPackage: ppp,
        abbreviation: t.packageAbbreviation ?? r.p.abbreviation,
        pieceSalePrice: r.p.pieceSalePrice,
        lastCostPerPiece: t.lastCostPerPiece,
        lastCostPerPackage: t.lastCostPerPackage,
        lastSupplierName: t.lastSupplierName,
      });
    } catch (e) {
      this.toast.error(ApiError.from(e).message);
    } finally {
      this.adding.update((s) => {
        const n = new Set(s);
        n.delete(r.p.uid);
        return n;
      });
    }
  }

  // ── Cart line helpers ─────────────────────────────────────────────────────
  protected unitName(l: RepurchaseLine): string {
    return l.purchaseType === 'WHOLE_PACKAGE' ? l.abbreviation || this.i18n.t('pkg', 'pkt') : this.i18n.t('pcs', 'vip');
  }

  protected costPerPiece(l: RepurchaseLine): number {
    const pcs = linePieces(l);
    return pcs > 0 ? lineTotal(l) / pcs : 0;
  }

  /** % change of the cost per piece vs the last purchase (null when unknown / same). */
  protected change(l: RepurchaseLine): number | null {
    const last = l.lastCostPerPiece;
    const now = this.costPerPiece(l);
    if (!last || !now) return null;
    const pct = Math.round(((now - last) / last) * 1000) / 10;
    return Math.abs(pct) < 0.1 ? null : pct;
  }

  protected margin(l: RepurchaseLine): number | null {
    const sell = l.pieceSalePrice;
    const cost = this.costPerPiece(l);
    return sell && cost ? Math.round(((sell - cost) / sell) * 1000) / 10 : null;
  }

  protected inc(l: RepurchaseLine, d: number): void {
    this.cart.setQty(l.productUid, l.quantity + d);
  }

  /** Typed numbers: a blank / zero entry is refused and the box shows the current value again. */
  private typed(el: HTMLInputElement, current: number, apply: (n: number) => void): void {
    const n = Number(el.value.replace(/[^\d.]/g, ''));
    if (n > 0) apply(n);
    else el.value = String(current);
  }

  protected typeQty(l: RepurchaseLine, el: HTMLInputElement): void {
    this.typed(el, l.quantity, (n) => this.cart.setQty(l.productUid, n));
  }

  protected typePrice(l: RepurchaseLine, el: HTMLInputElement): void {
    this.typed(el, l.unitPrice, (n) => this.cart.patch(l.productUid, { unitPrice: round2(n) }));
  }

  protected typeTotal(l: RepurchaseLine, el: HTMLInputElement): void {
    this.typed(el, lineTotal(l), (n) => this.cart.setTotal(l.productUid, n));
  }

  protected waitingFor(l: RepurchaseLine) {
    return this.queue().get(l.productUid) ?? null;
  }

  protected async clearCart(): Promise<void> {
    const ok = await this.dialogs.confirmDelete({
      title: this.i18n.t('Empty the cart?', 'Ondoa bidhaa zote kwenye kapu?'),
      message: this.i18n.t(`${this.cart.count()} product(s) will be removed from this order.`, `Bidhaa ${this.cart.count()} zitaondolewa kwenye agizo hili.`),
      confirmText: this.i18n.t('Empty cart', 'Ondoa zote'),
    });
    if (ok) this.cart.clear();
  }

  protected async openPurchase(uid: string): Promise<void> {
    const { PurchaseDetailsDialog } = await import('../purchase-details-dialog');
    const res = await this.dialogs.openAsync<PurchaseDetailsResult>(PurchaseDetailsDialog, { size: 'lg', data: { uid } });
    if (res === 'changed') void this.loadQueue();
  }

  /** Flutter `_confirmAndLinkRepurchased`: paid with that day's cash? → link each created purchase to the reconciliation. */
  private async linkToRecon(created: Purchase[]): Promise<boolean> {
    const total = created.reduce((n, p) => n + p.totalCost, 0);
    const ok = await this.dialogs.confirm({
      title: this.i18n.t('Paid with the day’s cash?', 'Umelipa kwa taslimu ya siku hiyo?'),
      message: this.i18n.t(
        `Link these ${created.length} purchase(s) (${Money.format(total)}) to the reconciliation of ${this.reconDate ?? ''}? The cash expected that day goes down by this amount.`,
        `Unganisha manunuzi haya ${created.length} (${Money.format(total)}) na upatanisho wa ${this.reconDate ?? ''}? Taslimu inayotarajiwa siku hiyo itapungua kwa kiasi hiki.`,
      ),
      confirmText: this.i18n.t('Yes, link them', 'Ndiyo, unganisha'),
      cancelText: this.i18n.t('No', 'Hapana'),
    });
    if (!ok) return false;
    let linked = 0;
    for (const p of created) {
      const r = await this.reconApi.addPurchase(this.recon!, { supplierName: p.supplierName, description: p.productName, amount: p.totalCost, purchaseUid: p.uid });
      if (r.recon) linked++;
      else if (r.error) this.toast.error(`${p.productName}: ${r.error}`);
    }
    if (linked) this.toast.success(this.i18n.t(`${linked} purchase(s) linked to the reconciliation`, `Manunuzi ${linked} yameunganishwa na upatanisho`));
    void this.router.navigate(['/reconciliation']);
    return true;
  }

  protected async submit(): Promise<void> {
    if (!this.canSubmit()) return;
    const lines = this.cart.lines();
    this.busy.set(true);
    try {
      const { created, failed } = await this.api.bulkRepurchase(lines);
      const done = new Set(created.map((p) => p.productUid));
      // Lines neither created nor reported failed would silently vanish — keep them with a note.
      for (const l of lines) if (!done.has(l.productUid) && !failed.has(l.productUid)) failed.set(l.productUid, this.i18n.t('Not created', 'Haijaundwa'));
      this.cart.keepFailed(failed);
      this.queue.update((m) => {
        const n = new Map(m);
        for (const p of created) n.set(p.productUid, { uid: p.uid, status: 'PENDING' });
        return n;
      });
      if (!created.length) {
        this.toast.error(this.i18n.t('No purchase was created — see the reasons in the cart.', 'Hakuna manunuzi yaliyoundwa — angalia sababu kwenye kapu.'));
        return;
      }
      const invoice = buildInvoice(
        lines.filter((l) => done.has(l.productUid)),
        this.auth.displayName() || this.auth.user()?.email || '',
        this.cart.notes() || null,
      );
      const data: RepurchaseDoneData = { invoice, failed: lines.filter((l) => failed.has(l.productUid)).map((l) => ({ name: l.name, reason: failed.get(l.productUid)! })) };
      const { RepurchaseDoneDialog } = await import('./repurchase-done-dialog');
      const res = await this.dialogs.openAsync<'list'>(RepurchaseDoneDialog, { size: 'md', disableClose: true, data });
      if (this.recon && (await this.linkToRecon(created))) return;
      if (res === 'list') void this.router.navigate(['/purchases']);
    } catch (e) {
      this.toast.error(ApiError.from(e).message);
    } finally {
      this.busy.set(false);
    }
  }
}
