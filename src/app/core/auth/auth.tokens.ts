import { HttpContextToken } from '@angular/common/http';

/** Don't force-logout on 401 for this request (login, logout, refresh). */
export const SKIP_AUTH_REDIRECT = new HttpContextToken<boolean>(() => false);

/** Opt a request out of the network-error retry (e.g. non-idempotent calls). */
export const SKIP_RETRY = new HttpContextToken<boolean>(() => false);
