import { Routes } from '@angular/router';

export const SETTINGS_APPROVALS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./settings-approvals-page').then((c) => c.SettingsApprovalsPage),
  },
];
