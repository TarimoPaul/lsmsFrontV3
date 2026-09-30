import { Injectable, computed, inject, signal } from '@angular/core';

import { ApiError } from '@core/api/api.types';
import { AuthService } from '@core/auth/auth.service';
import { ProductsService } from '../products/products.service';
import { StoreService } from '../store/store.service';
import { CountLine, CountSession, RecountLine, hasVariance } from './counting.models';
import { CountingService } from './counting.service';

export type CountSort = 'az' | 'stock' | 'best';

/**
 * State of the "Count" tab — port of Flutter `CountingProvider`: resume
 * today's session from the server (the only source of truth), start →
 * count → complete, the one blind recount round and the starter's variance
 * explanations. Provided by the page so switching tabs keeps it.
 *
 * Category / stock / best-seller lookups come from the shared caches and only
 * ever change FILTERING and ORDER — no stock number is ever shown on a blind
 * count.
 */
@Injectable()
export class CountStore {
  private readonly api = inject(CountingService);
  private readonly auth = inject(AuthService);
  private readonly products = inject(ProductsService);
  private readonly store = inject(StoreService);

  readonly session = signal<CountSession | null>(null);
  readonly resuming = signal(true);
  readonly starting = signal(false);
  readonly completing = signal(false);
  readonly error = signal<string | null>(null);

  /** Line uids being saved → spinner; last saved uid → brief tick. */
  readonly saving = signal<ReadonlySet<string>>(new Set());
  readonly explaining = signal<ReadonlySet<string>>(new Set());

  readonly recountLines = signal<RecountLine[]>([]);
  readonly loadingRecount = signal(false);
  readonly completingRecount = signal(false);
  readonly savingRecount = signal<ReadonlySet<string>>(new Set());
  /** uid → qty saved this visit (the blind DTO never echoes recountQty back). */
  readonly savedRecount = signal<ReadonlyMap<string, number>>(new Map());

  readonly search = signal('');
  readonly category = signal<string>('');
  readonly sort = signal<CountSort>('az');
  readonly onlyLeft = signal(false);

  private readonly sold = signal<Map<string, number>>(new Map());
  private loaded = false;

  private readonly categoryOf = computed(() => {
    const m = new Map<string, string>();
    for (const p of this.products.catalogue.value() ?? []) if (p.uid && p.categoryName) m.set(p.uid, p.categoryName);
    return m;
  });
  private readonly stockOf = computed(() => {
    const m = new Map<string, number>();
    for (const s of this.store.stock.value() ?? []) m.set(s.uid, s.currentStock);
    return m;
  });

  readonly isStarter = computed(() => {
    const s = this.session();
    return !!s?.startedByUid && s.startedByUid === this.auth.user()?.uid;
  });

  readonly progress = computed(() => {
    const s = this.session();
    const total = s?.totalItems || s?.lines.length || 0;
    const done = s ? s.lines.filter((l) => l.countedQty != null).length : 0;
    return { done, total, pct: total ? Math.round((done / total) * 100) : 0, all: total > 0 && done >= total };
  });

  readonly categories = computed(() => {
    const s = this.session();
    const counts = new Map<string, { n: number; left: number }>();
    for (const l of s?.lines ?? []) {
      const c = this.categoryOf().get(l.productUid);
      if (!c) continue;
      const e = counts.get(c) ?? { n: 0, left: 0 };
      e.n++;
      if (l.countedQty == null) e.left++;
      counts.set(c, e);
    }
    return [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([name, e]) => ({ name, ...e }));
  });

  readonly lines = computed(() => {
    const s = this.session();
    if (!s) return [];
    const cat = this.category();
    const q = this.search().trim().toLowerCase();
    let rows = s.lines;
    if (cat) rows = rows.filter((l) => this.categoryOf().get(l.productUid) === cat);
    if (q) rows = rows.filter((l) => l.productName.toLowerCase().includes(q));
    if (this.onlyLeft()) rows = rows.filter((l) => l.countedQty == null);
    return [...rows].sort(this.comparator());
  });

  /** Variance lines the starter must explain (visible once PENDING_APPROVAL). */
  readonly varianceLines = computed(() => (this.session()?.lines ?? []).filter(hasVariance));

  categoryName(productUid: string): string | null {
    return this.categoryOf().get(productUid) ?? null;
  }

  async resume(): Promise<void> {
    this.resuming.set(!this.loaded);
    this.error.set(null);
    try {
      const active = await this.api.active();
      // `active` carries lines already; refetch only if it came without them.
      const s = active && !active.lines.length && active.totalItems ? await this.api.session(active.uid) : active;
      this.session.set(s);
      if (s?.status === 'PENDING_RECOUNT') await this.loadRecount();
      this.loaded = true;
    } catch (e) {
      this.error.set(ApiError.from(e).message);
    } finally {
      this.resuming.set(false);
    }
    // Lookups for filter/sort — best effort, never block counting.
    void this.products.catalogue.load().catch(() => undefined);
    void this.store.stock.load().catch(() => undefined);
    if (!this.sold().size) void this.api.soldByName().then((m) => this.sold.set(m), () => undefined);
  }

  async start(): Promise<void> {
    this.starting.set(true);
    this.error.set(null);
    try {
      const started = await this.api.start();
      // start's response omits lines.
      this.session.set(await this.api.session(started.uid).catch(() => started));
    } finally {
      this.starting.set(false);
    }
  }

  /** Upsert one line's total. Returns false on failure (message thrown to the caller). */
  async submit(line: CountLine, qty: number): Promise<void> {
    const s = this.session();
    if (!s) return;
    this.saving.update((x) => new Set(x).add(line.uid));
    try {
      const updated = await this.api.submitLine(s.uid, line.productUid, qty);
      this.patchLine(updated);
    } finally {
      this.saving.update((x) => {
        const n = new Set(x);
        n.delete(line.uid);
        return n;
      });
    }
  }

  async complete(): Promise<void> {
    const s = this.session();
    if (!s) return;
    this.completing.set(true);
    try {
      const done = await this.api.complete(s.uid);
      // The starter turns sighted at PENDING_APPROVAL (not at PENDING_RECOUNT) → refetch lines.
      const full = await this.api.session(done.uid).catch(() => ({ ...done, lines: s.lines }));
      this.session.set(full);
      if (full.status === 'PENDING_RECOUNT') await this.loadRecount();
    } finally {
      this.completing.set(false);
    }
  }

  async loadRecount(): Promise<void> {
    const s = this.session();
    if (!s) return;
    this.loadingRecount.set(true);
    try {
      this.recountLines.set(await this.api.recountList(s.uid));
    } catch (e) {
      this.error.set(ApiError.from(e).message);
    } finally {
      this.loadingRecount.set(false);
    }
  }

  async recount(line: RecountLine, qty: number, reason: string): Promise<void> {
    const s = this.session();
    if (!s) return;
    this.savingRecount.update((x) => new Set(x).add(line.uid));
    try {
      const updated = await this.api.recount(s.uid, line.uid, qty, reason);
      this.recountLines.update((list) => list.map((l) => (l.uid === updated.uid ? updated : l)));
      this.savedRecount.update((m) => new Map(m).set(line.uid, qty));
    } finally {
      this.savingRecount.update((x) => {
        const n = new Set(x);
        n.delete(line.uid);
        return n;
      });
    }
  }

  async completeRecount(): Promise<void> {
    const s = this.session();
    if (!s) return;
    this.completingRecount.set(true);
    try {
      const done = await this.api.completeRecount(s.uid);
      this.session.set(await this.api.session(done.uid).catch(() => done));
      this.recountLines.set([]);
      this.savedRecount.set(new Map());
    } finally {
      this.completingRecount.set(false);
    }
  }

  async explain(line: CountLine, reason: string, note: string | null): Promise<void> {
    const s = this.session();
    if (!s) return;
    this.explaining.update((x) => new Set(x).add(line.uid));
    try {
      this.patchLine(await this.api.explain(s.uid, line.uid, reason, note));
    } finally {
      this.explaining.update((x) => {
        const n = new Set(x);
        n.delete(line.uid);
        return n;
      });
    }
  }

  private patchLine(updated: CountLine): void {
    this.session.update((s) => {
      if (!s) return s;
      const lines = s.lines.map((l) => (l.uid === updated.uid ? { ...l, ...updated } : l));
      return { ...s, lines, itemsCounted: lines.filter((l) => l.countedQty != null).length };
    });
  }

  private comparator(): (a: CountLine, b: CountLine) => number {
    const az = (a: CountLine, b: CountLine) => a.productName.localeCompare(b.productName, undefined, { sensitivity: 'base' });
    switch (this.sort()) {
      case 'stock': {
        // Lowest stock first (at-risk items); unknown stock last. Never displayed.
        const st = this.stockOf();
        return (a, b) => {
          const x = st.get(a.productUid);
          const y = st.get(b.productUid);
          if (x == null && y == null) return az(a, b);
          if (x == null) return 1;
          if (y == null) return -1;
          return x - y || az(a, b);
        };
      }
      case 'best': {
        const sold = this.sold();
        const q = (l: CountLine) => sold.get(l.productName.trim().toLowerCase()) ?? 0;
        return (a, b) => q(b) - q(a) || az(a, b);
      }
      default:
        return az;
    }
  }
}
