import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';

import { AuthService } from '@core/auth/auth.service';
import { PurchaseType, RepurchaseLine, lineTotal } from '../purchases.models';

interface Saved {
  lines: RepurchaseLine[];
  notes: string;
}

const round2 = (v: number) => Math.round(v * 100) / 100;

/**
 * The repurchase cart — port of the cart half of Flutter `RepurchaseProvider`
 * (add from the last purchase, quantity / type / price / supplier edits,
 * totals). One line per product. Kept per branch + user in localStorage so a
 * refresh or a trip to another page never loses an order being prepared.
 */
@Injectable({ providedIn: 'root' })
export class RepurchaseCartStore {
  private readonly auth = inject(AuthService);

  readonly lines = signal<RepurchaseLine[]>([]);
  readonly notes = signal('');

  readonly count = computed(() => this.lines().length);
  readonly total = computed(() => this.lines().reduce((n, l) => n + lineTotal(l), 0));
  readonly uids = computed(() => new Set(this.lines().map((l) => l.productUid)));
  /** Lines that cannot be sent yet (no quantity / price). */
  readonly invalid = computed(() => this.lines().filter((l) => !(l.quantity > 0) || !(l.unitPrice > 0)).length);

  private loadedFor: string | null = null;

  constructor() {
    effect(() => {
      const key = this.storageKey();
      if (key !== this.loadedFor) {
        this.loadedFor = key;
        untracked(() => this.restore(key));
      }
    });
    effect(() => {
      const saved: Saved = { lines: this.lines(), notes: this.notes() };
      const key = this.loadedFor;
      if (!key) return;
      try {
        if (!saved.lines.length && !saved.notes) localStorage.removeItem(key);
        else localStorage.setItem(key, JSON.stringify(saved));
      } catch {
        // Private mode / quota — the cart still works for this tab.
      }
    });
  }

  private storageKey(): string {
    return `lsms.repurchase.${this.auth.activeBranchUid() ?? 'none'}.${this.auth.user()?.uid ?? this.auth.user()?.email ?? 'me'}`;
  }

  private restore(key: string): void {
    let saved: Saved | null = null;
    try {
      saved = JSON.parse(localStorage.getItem(key) ?? 'null') as Saved | null;
    } catch {
      saved = null;
    }
    this.lines.set(saved?.lines ?? []);
    this.notes.set(saved?.notes ?? '');
  }

  has(productUid: string): boolean {
    return this.uids().has(productUid);
  }

  add(line: RepurchaseLine): void {
    if (this.has(line.productUid)) return;
    this.lines.update((ls) => [line, ...ls]);
  }

  patch(productUid: string, patch: Partial<RepurchaseLine>): void {
    this.lines.update((ls) => ls.map((l) => (l.productUid === productUid ? { ...l, ...patch, error: null } : l)));
  }

  setQty(productUid: string, qty: number): void {
    if (!(qty > 0)) return this.remove(productUid);
    this.patch(productUid, { quantity: Math.round(qty) || 1 });
  }

  /** Line total typed by hand → unit price. */
  setTotal(productUid: string, total: number): void {
    const l = this.lines().find((x) => x.productUid === productUid);
    if (l && l.quantity > 0 && total > 0) this.patch(productUid, { unitPrice: round2(total / l.quantity) });
  }

  /**
   * Switch packages ↔ pieces keeping the money meaning: the unit price becomes
   * the last cost for the new unit, else the current cost converted.
   */
  setType(productUid: string, type: PurchaseType): void {
    const l = this.lines().find((x) => x.productUid === productUid);
    if (!l || l.purchaseType === type) return;
    const ppp = l.piecesPerPackage && l.piecesPerPackage > 1 ? l.piecesPerPackage : 1;
    const perPiece = l.purchaseType === 'WHOLE_PACKAGE' ? l.unitPrice / ppp : l.unitPrice;
    const unitPrice = type === 'WHOLE_PACKAGE' ? (l.lastCostPerPackage ?? perPiece * ppp) : (l.lastCostPerPiece ?? perPiece);
    this.patch(productUid, { purchaseType: type, unitPrice: round2(unitPrice) });
  }

  remove(productUid: string): void {
    this.lines.update((ls) => ls.filter((l) => l.productUid !== productUid));
  }

  /** After a submit: keep only the refused lines, with the server's reasons. */
  keepFailed(failed: Map<string, string>): void {
    this.lines.update((ls) => ls.filter((l) => failed.has(l.productUid)).map((l) => ({ ...l, error: failed.get(l.productUid) ?? null })));
    if (!failed.size) this.notes.set('');
  }

  clear(): void {
    this.lines.set([]);
    this.notes.set('');
  }
}
