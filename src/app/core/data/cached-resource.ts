import { Signal, computed, signal } from '@angular/core';

/**
 * In-memory, signal-backed cache for reference data shared across modules
 * (products, categories, measures …). Replaces Flutter's pattern of every
 * screen re-downloading the same lists.
 *
 * - `load()` returns the cached value while it is fresh (TTL) and shares one
 *   in-flight request between concurrent callers.
 * - `value` stays populated while a reload runs, so pages render instantly
 *   from cache and refresh quietly (stale-while-revalidate).
 * - Mutations patch the cache (`upsert` / `remove`) instead of refetching.
 * - Every instance registers itself so `clearAllCaches()` can wipe them on
 *   logout / branch switch.
 *
 *   readonly products = new CachedResource(() => this.fetchAll(), 60_000);
 *   await this.products.load();          // fresh → no request
 *   await this.products.load(true);      // forced refresh
 */
export class CachedResource<T> {
  private readonly _value = signal<T | null>(null);
  private readonly _loading = signal(false);
  private inflight: Promise<T> | null = null;
  private loadedAt = 0;
  /** Bumped on clear() so a response that started before it is dropped. */
  private generation = 0;

  readonly value: Signal<T | null> = this._value.asReadonly();
  /** True while a request is running (also during background refreshes). */
  readonly loading: Signal<boolean> = this._loading.asReadonly();
  /** True only when there is nothing to show yet — use this for skeletons. */
  readonly initialLoading = computed(() => this._loading() && this._value() === null);

  constructor(
    private readonly fetcher: () => Promise<T>,
    private readonly ttlMs = 60_000,
  ) {
    registry.add(this as CachedResource<unknown>);
  }

  get isFresh(): boolean {
    return this._value() !== null && Date.now() - this.loadedAt < this.ttlMs;
  }

  load(force = false): Promise<T> {
    if (!force && this.isFresh) return Promise.resolve(this._value() as T);
    if (this.inflight) return this.inflight;
    const gen = this.generation;
    this._loading.set(true);
    this.inflight = this.fetcher()
      .then((v) => {
        if (gen === this.generation) {
          this._value.set(v);
          this.loadedAt = Date.now();
        }
        return v;
      })
      .finally(() => {
        if (gen === this.generation) {
          this.inflight = null;
          this._loading.set(false);
        }
      });
    return this.inflight;
  }

  /** Replace the cached value (e.g. after a mutation returned fresh data). */
  set(value: T): void {
    this._value.set(value);
    this.loadedAt = Date.now();
  }

  update(fn: (value: T) => T): void {
    const v = this._value();
    if (v !== null) this._value.set(fn(v));
  }

  /** Next `load()` hits the server; the current value stays visible. */
  invalidate(): void {
    this.loadedAt = 0;
  }

  clear(): void {
    this.generation++;
    this.inflight = null;
    this._loading.set(false);
    this._value.set(null);
    this.loadedAt = 0;
  }
}

/** Cache of a list keyed by `uid`, with helpers for mutation results. */
export class CachedList<T extends { uid: string }> extends CachedResource<T[]> {
  upsert(item: T): void {
    this.update((list) => {
      const i = list.findIndex((x) => x.uid === item.uid);
      if (i === -1) return [...list, item];
      const next = [...list];
      next[i] = item;
      return next;
    });
  }

  remove(uid: string): void {
    this.update((list) => list.filter((x) => x.uid !== uid));
  }
}

const registry = new Set<CachedResource<unknown>>();

/** Drop every cached dataset (logout, branch switch, user change). */
export function clearAllCaches(): void {
  for (const c of registry) c.clear();
}
