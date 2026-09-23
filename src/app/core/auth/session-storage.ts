import { AuthSession } from './auth.models';

/**
 * Session persistence — web port of Flutter's per-tab StorageService.
 *
 * - `sessionStorage` holds THIS tab's session, so two tabs can be signed in
 *   as different users (Flutter multi-tab support).
 * - `localStorage` keeps a copy of the most recent session so a newly opened
 *   tab starts signed in (Flutter's "global token" fallback).
 * - Remember-me email lives only in localStorage.
 */
const SESSION_KEY = 'lsms_session';
const GLOBAL_KEY = 'lsms_session_global';
const REMEMBER_KEY = 'rememberMe';
const SAVED_EMAIL_KEY = 'savedEmail';

function read(store: Storage | undefined, key: string): string | null {
  try {
    return store?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

function write(store: Storage | undefined, key: string, value: string | null): void {
  try {
    if (value === null) store?.removeItem(key);
    else store?.setItem(key, value);
  } catch {
    // storage blocked — session simply won't persist across reloads
  }
}

export const sessionStore = {
  load(): AuthSession | null {
    const raw = read(globalThis.sessionStorage, SESSION_KEY) ?? read(globalThis.localStorage, GLOBAL_KEY);
    if (!raw) return null;
    try {
      const s = JSON.parse(raw) as AuthSession;
      return s?.token ? s : null;
    } catch {
      return null;
    }
  },

  save(session: AuthSession): void {
    const json = JSON.stringify(session);
    write(globalThis.sessionStorage, SESSION_KEY, json);
    write(globalThis.localStorage, GLOBAL_KEY, json);
  },

  clear(): void {
    write(globalThis.sessionStorage, SESSION_KEY, null);
    write(globalThis.localStorage, GLOBAL_KEY, null);
  },

  /** Token only — read by the HTTP interceptor on every request. */
  token(): string | null {
    return this.load()?.token ?? null;
  },

  rememberedEmail(): string | null {
    return read(globalThis.localStorage, REMEMBER_KEY) === 'true'
      ? read(globalThis.localStorage, SAVED_EMAIL_KEY)
      : null;
  },

  remember(email: string | null): void {
    write(globalThis.localStorage, REMEMBER_KEY, email ? 'true' : 'false');
    write(globalThis.localStorage, SAVED_EMAIL_KEY, email);
  },
};
