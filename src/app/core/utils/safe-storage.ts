/**
 * localStorage wrapper that never throws (private mode, blocked storage, SSR).
 * Values are stored as JSON strings.
 */
export const safeStorage = {
  get(key: string): string | null {
    try {
      return globalThis.localStorage?.getItem(key) ?? null;
    } catch {
      return null;
    }
  },

  getBool(key: string): boolean | null {
    const raw = this.get(key);
    if (raw === 'true') return true;
    if (raw === 'false') return false;
    return null;
  },

  getNumber(key: string): number | null {
    const raw = this.get(key);
    if (raw === null) return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  },

  set(key: string, value: string | number | boolean): void {
    try {
      globalThis.localStorage?.setItem(key, String(value));
    } catch {
      // storage unavailable — preference simply isn't persisted
    }
  },

  remove(key: string): void {
    try {
      globalThis.localStorage?.removeItem(key);
    } catch {
      // ignore
    }
  },
};
