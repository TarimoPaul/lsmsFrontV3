import { Routes } from '@angular/router';

import { sectionGuard } from '@core/auth/guards';
import { APP_MODULES } from '@core/navigation/app-modules';
import { ShellLayout } from './shell-layout';

const page = (en: string, sw: string, subEn?: string, subSw?: string) => ({
  page: { title: { en, sw }, subtitle: subEn ? { en: subEn, sw: subSw ?? subEn } : undefined },
});

/** Module routes not yet ported render the placeholder (still RBAC-guarded). */
const placeholderRoutes: Routes = APP_MODULES.filter((m) => !m.ready).map((m) => ({
  path: m.route.slice(1),
  canActivate: [sectionGuard],
  data: { section: m.id },
  loadComponent: () => import('./pages/module-placeholder').then((c) => c.ModulePlaceholder),
}));

export const SHELL_ROUTES: Routes = [
  {
    path: '',
    component: ShellLayout,
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      {
        path: 'dashboard',
        title: 'Dashboard · LSMS',
        data: page('Dashboard', 'Dashibodi', 'Overview of your modules', 'Muhtasari wa moduli zako'),
        loadComponent: () => import('../dashboard/main-dashboard').then((c) => c.MainDashboard),
      },
      {
        path: 'roles',
        title: 'Roles · LSMS',
        canActivate: [sectionGuard],
        // The page renders its own header, so the toolbar shows only the crumb.
        data: { section: 'roles', hideSubtitle: true },
        loadChildren: () => import('../roles/roles.routes').then((r) => r.ROLES_ROUTES),
      },
      {
        path: 'users',
        title: 'Users · LSMS',
        canActivate: [sectionGuard],
        data: { section: 'users', hideSubtitle: true },
        loadChildren: () => import('../users/users.routes').then((r) => r.USERS_ROUTES),
      },
      ...placeholderRoutes,
      {
        path: 'account/profile',
        title: 'Profile · LSMS',
        data: page('My Profile', 'Wasifu Wangu', 'Account, roles and permissions', 'Akaunti, majukumu na ruhusa'),
        loadComponent: () => import('../account/profile-page').then((c) => c.ProfilePage),
      },
      {
        path: 'account/settings',
        title: 'Settings · LSMS',
        data: page('Settings', 'Mipangilio', 'Appearance and language', 'Muonekano na lugha'),
        loadComponent: () => import('../account/settings-page').then((c) => c.SettingsPage),
      },
      {
        path: 'account/security',
        title: 'Security · LSMS',
        data: page('Security', 'Usalama', 'Password and session', 'Nenosiri na kipindi'),
        loadComponent: () => import('../account/security-page').then((c) => c.SecurityPage),
      },
      {
        path: 'account/notifications',
        title: 'Notifications · LSMS',
        data: page('Notifications', 'Arifa'),
        loadComponent: () => import('../account/notifications-page').then((c) => c.NotificationsPage),
      },
      {
        path: 'access-denied',
        title: 'Access denied · LSMS',
        data: page('Access Denied', 'Ruhusa Imekataliwa'),
        loadComponent: () => import('./pages/access-denied').then((c) => c.AccessDenied),
      },
    ],
  },
];
