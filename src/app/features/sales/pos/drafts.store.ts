import { DestroyRef, Injectable, computed, effect, inject, signal, untracked } from '@angular/core';

import { AuthService } from '@core/auth/auth.service';
import { CartCustomer, CartLine } from './cart.store';

/** A parked ("held") order: the cart put aside so the next customer can be served. */
export interface CartDraft {
  id: string;
  /** Customer name (required when holding). */
  label: string;
  note: string | null;
  lines: CartLine[];
  customer: CartCustomer | null;
  discount: number;
  /** Sale date (yyyy-mm-dd) the cart was on when it was held. */
  saleDate: string | null;
  /** First time this order was held — the 12-hour limit counts from here. */
  createdAt: string;
  updatedAt: string;
}

const MAX_DRAFTS = 30;
/** A held order closes this long after it was first held. */
export const DRAFT_TTL_MS = 12 * 60 * 60 * 1000;

/**
 * Held orders for the till. The backend has no draft/hold endpoint, so —
 * like the live cart — they live in localStorage per branch + user: nothing
 * is written server-side and no stock is reserved until the sale is made.
 * Each one closes (is removed) 12 hours after it was first held.
 */
@Injectable({ providedIn: 'root' })
export class DraftsStore {
  private readonly auth = inject(AuthService);

  /** Newest first. */
  readonly list = signal<CartDraft[]>([]);
  readonly count = computed(() => this.list().length);
  /** Ticks every 30s so "closes in …" labels and expiry stay current. */
  readonly now = signal(Date.now());
  /** Labels of orders that just closed on time (the till announces them, then clears this). */
  readonly expired = signal<string[]>([]);

  private loadedFor: string | null = null;

  constructor() {
    effect(() => {
      const key = `lsms.drafts.${this.auth.activeBranchUid() ?? 'none'}.${this.auth.user()?.uid ?? this.auth.user()?.email ?? 'me'}`;
      if (key === this.loadedFor) return;
      this.loadedFor = key;
      untracked(() => {
        try {
          this.list.set((JSON.parse(localStorage.getItem(key) ?? '[]') as CartDraft[]) ?? []);
        } catch {
          this.list.set([]);
        }
        this.prune();
      });
    });
    effect(() => {
      const drafts = this.list();
      const key = this.loadedFor;
      if (!key) return;
      try {
        if (drafts.length) localStorage.setItem(key, JSON.stringify(drafts));
        else localStorage.removeItem(key);
      } catch {
        // Private mode / quota — drafts still work for this tab.
      }
    });
    const timer = setInterval(() => {
      this.now.set(Date.now());
      this.prune();
    }, 30_000);
    inject(DestroyRef).onDestroy(() => clearInterval(timer));
  }

  static expiresAt(d: CartDraft): number {
    return Date.parse(d.createdAt) + DRAFT_TTL_MS;
  }

  static total(d: CartDraft): number {
    return Math.max(0, d.lines.reduce((n, l) => n + l.qty * l.unitPrice, 0) - d.discount);
  }

  /** `heldSince` keeps the original hold time when a resumed order is held again. */
  add(d: Omit<CartDraft, 'id' | 'createdAt' | 'updatedAt'>, heldSince?: string | null): CartDraft {
    const now = new Date().toISOString();
    const draft: CartDraft = { ...d, id: `d${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, createdAt: heldSince ?? now, updatedAt: now };
    this.list.update((ls) => [draft, ...ls].slice(0, MAX_DRAFTS));
    this.prune();
    return draft;
  }

  remove(id: string): void {
    this.list.update((ls) => ls.filter((d) => d.id !== id));
  }

  /** Close every order past its 12 hours. */
  prune(): void {
    const now = Date.now();
    const gone = this.list().filter((d) => DraftsStore.expiresAt(d) <= now);
    if (!gone.length) return;
    this.list.update((ls) => ls.filter((d) => DraftsStore.expiresAt(d) > now));
    this.expired.update((e) => [...e, ...gone.map((d) => d.label)]);
  }
}
