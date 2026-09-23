import { Routes } from '@angular/router';

import { environment } from '../environments/environment';
import { authGuard, guestGuard } from './core/auth/guards';

export const routes: Routes = [
  // ── Public (auth) ──
  {
    path: 'login',
    title: 'Sign in · LSMS',
    canActivate: [guestGuard],
    loadComponent: () => import('./features/auth/login/login-page').then((m) => m.LoginPage),
  },
  { path: 'register', redirectTo: '/login?view=register' },
  { path: 'forgot-password', redirectTo: '/login?view=forgot' },
  {
    path: 'reset-password',
    title: 'Reset password · LSMS',
    loadComponent: () =>
      import('./features/auth/reset-password/reset-password-page').then((m) => m.ResetPasswordPage),
  },

  // ── Dev showcase (not routable in production builds) ──
  {
    path: 'dev/ui',
    canMatch: [() => !environment.production],
    title: 'LSMS — Shared UI',
    loadComponent: () => import('./dev/ui-gallery/ui-gallery').then((m) => m.UiGallery),
  },

  // ── Authenticated app ──
  {
    path: '',
    canActivate: [authGuard],
    loadChildren: () => import('./features/shell/shell.routes').then((m) => m.SHELL_ROUTES),
  },
  { path: '**', redirectTo: '' },
];
