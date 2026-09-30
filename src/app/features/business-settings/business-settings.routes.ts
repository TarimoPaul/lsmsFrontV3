import { Routes } from '@angular/router';

export const BUSINESS_SETTINGS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./business-settings-page').then((c) => c.BusinessSettingsPage),
  },
];
