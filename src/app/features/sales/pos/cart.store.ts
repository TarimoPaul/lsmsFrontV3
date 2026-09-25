import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';

import { AuthService } from '@core/auth/auth.service';
import { PosProduct, SaleType } from '../sales.models';

export interface CartLine {
  /** productUid + saleType (+ "*" when the price was changed by hand). */
  key: string;
  productUid: string;
  name: string;
  category: string | null;
  saleType: SaleType;
  /** Stock pieces in ONE unit of this sale type. */
  unitPieces: number;
  qty: number;
  unitPrice: number;
  defaultPrice: number;
  costPerPiece: number | null;
  piecesPerPackage: number | null;
  abbreviation: string | null;
  /** Set when the server refused this line on the last save. */
  error?: string | null;
}

export interface CartCustomer {
  uid: string | null;
  name: string;
  phone: string | null;
  outstanding?: number;
  creditLimit?: number | null;
}

interface Saved {
  lines: CartLine[];
  customer: CartCustomer | null;
  discount: number;
  /** When this order was first held (a resumed held order keeps its 12-hour clock). */
  heldSince?: string | null;
}

/**
 * The till's cart — port of the cart half of Flutter `SalesProvider`
 * (add / qty / price override / remove, totals, saved cart restored after a
 * reload). Kept per branch in localStorage so a refresh never loses a sale
 * in progress.
 */
@Injectable({ providedIn: 'root' })
export class CartStore {
  private readonly auth = inject(AuthService);

  readonly lines = signal<CartLine[]>([]);
  readonly customer = signal<CartCustomer | null>(null);
  readonly discount = signal(0);
  readonly heldSince = signal<string | null>(null);

  readonly count = computed(() => this.lines().length);
  readonly pieces = computed(() => this.lines().reduce((n, l) => n + l.qty * l.unitPieces, 0));
  readonly subtotal = computed(() => this.lines().reduce((n, l) => n + l.qty * l.unitPrice, 0));
  readonly total = computed(() => Math.max(0, this.subtotal() - this.discount()));
  /** Pieces of each product already in the cart (for stock checks). */
  readonly reserved = computed(() => {
    const m = new Map<string, number>();
    for (const l of this.lines()) m.set(l.productUid, (m.get(l.productUid) ?? 0) + l.qty * l.unitPieces);
    return m;
  });
  /** Units per product+type (for the "in cart" badge on price buttons). */
  readonly unitsByKey = computed(() => {
    const m = new Map<string, number>();
    for (const l of this.lines()) {
      const k = `${l.productUid}|${l.saleType}`;
      m.set(k, (m.get(k) ?? 0) + l.qty);
    }
    return m;
  });

  private loadedFor: string | null = null;

  constructor() {
    // Restore when the branch / user changes …
    effect(() => {
      const key = this.storageKey();
      if (key !== this.loadedFor) {
        this.loadedFor = key;
        untracked(() => this.restore(key));
      }
    });
    // … and save every change under the current key.
    effect(() => {
      const saved: Saved = { lines: this.lines(), customer: this.customer(), discount: this.discount(), heldSince: this.heldSince() };
      const key = this.loadedFor;
      if (!key) return;
      try {
        if (!saved.lines.length && !saved.customer && !saved.discount) localStorage.removeItem(key);
        else localStorage.setItem(key, JSON.stringify(saved));
      } catch {
        // Private mode / quota — the cart still works for this tab.
      }
    });
  }

  private storageKey(): string {
    return `lsms.cart.${this.auth.activeBranchUid() ?? 'none'}.${this.auth.user()?.uid ?? this.auth.user()?.email ?? 'me'}`;
  }

  private restore(key: string): void {
    let saved: Saved | null = null;
    try {
      saved = JSON.parse(localStorage.getItem(key) ?? 'null') as Saved | null;
    } catch {
      saved = null;
    }
    this.lines.set(saved?.lines ?? []);
    this.customer.set(saved?.customer ?? null);
    this.discount.set(saved?.discount ?? 0);
    this.heldSince.set(saved?.heldSince ?? null);
  }

  /** Add one unit of `type`; merges with the same product+type at the default price. */
  add(p: PosProduct, type: SaleType): void {
    const opt = p.options.find((o) => o.type === type);
    if (!opt) return;
    const key = `${p.uid}|${type}`;
    this.lines.update((ls) => {
      const i = ls.findIndex((l) => l.key === key);
      if (i >= 0) return ls.map((l, j) => (j === i ? { ...l, qty: l.qty + 1, error: null } : l));
      return [
        ...ls,
        {
          key,
          productUid: p.uid,
          name: p.name,
          category: p.category,
          saleType: type,
          unitPieces: opt.pieces,
          qty: 1,
          unitPrice: opt.price,
          defaultPrice: opt.price,
          costPerPiece: p.averageCost,
          piecesPerPackage: p.piecesPerPackage,
          abbreviation: p.abbreviation,
        },
      ];
    });
  }

  /** Add `qty` units at once (used by "Sell again"). */
  addMany(p: PosProduct, type: SaleType, qty: number): void {
    for (let i = 0; i < qty; i++) this.add(p, type);
  }

  setQty(key: string, qty: number): void {
    if (qty <= 0) return this.remove(key);
    this.lines.update((ls) => ls.map((l) => (l.key === key ? { ...l, qty: Math.floor(qty), error: null } : l)));
  }

  /** Change a line's unit price; a changed price gets its own line key so the next tap adds at the default price. */
  setPrice(key: string, price: number): void {
    this.lines.update((ls) => {
      const edited = ls.map((l) => {
        if (l.key !== key) return l;
        const base = `${l.productUid}|${l.saleType}`;
        return { ...l, unitPrice: price, key: price === l.defaultPrice ? base : `${base}*`, error: null };
      });
      // Two lines can now share a key (e.g. a price put back to default) — merge them.
      const merged: CartLine[] = [];
      for (const l of edited) {
        const same = merged.find((m) => m.key === l.key && m.unitPrice === l.unitPrice);
        if (same) same.qty += l.qty;
        else merged.push({ ...l });
      }
      return merged;
    });
  }

  remove(key: string): void {
    this.lines.update((ls) => ls.filter((l) => l.key !== key));
  }

  /** Keep only lines the server refused, with their reasons. */
  keepFailed(failed: Map<string, string>): void {
    this.lines.update((ls) => ls.filter((l) => failed.has(l.productUid)).map((l) => ({ ...l, error: failed.get(l.productUid) ?? null })));
  }

  /** Replace the whole cart (resuming a held order). */
  load(s: Saved): void {
    this.lines.set(s.lines);
    this.customer.set(s.customer);
    this.discount.set(s.discount);
    this.heldSince.set(s.heldSince ?? null);
  }

  clear(): void {
    this.lines.set([]);
    this.customer.set(null);
    this.discount.set(0);
    this.heldSince.set(null);
  }
}
