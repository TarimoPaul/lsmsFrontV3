import { inject } from '@angular/core';
import { CanActivateFn, CanMatchFn, Router } from '@angular/router';

import { AuthService } from './auth.service';

/** Requires a signed-in session; otherwise → /login?returnUrl=… */
export const authGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  if (auth.isAuthenticated()) return true;
  return inject(Router).createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
};

/** Login / register pages: signed-in users go straight to the dashboard. */
export const guestGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  return auth.isAuthenticated() ? inject(Router).createUrlTree(['/dashboard']) : true;
};

/**
 * Module access by section id (route `data.section`), e.g. `{ section: 'sales' }`.
 * Uses the same resolver as the sidebar and dashboard tiles.
 */
export const sectionGuard: CanActivateFn = (route) => {
  const auth = inject(AuthService);
  const section = route.data['section'] as string | undefined;
  if (!section || auth.canAccessSection(section)) return true;
  return inject(Router).createUrlTree(['/access-denied'], { queryParams: { section } });
};

/** Fine-grained permission check (route `data.permissions`: any-of). */
export const permissionGuard: CanMatchFn = (route) => {
  const auth = inject(AuthService);
  const perms = (route.data?.['permissions'] as string[] | undefined) ?? [];
  if (!perms.length || auth.hasAnyPermission(perms)) return true;
  return inject(Router).createUrlTree(['/access-denied']);
};
