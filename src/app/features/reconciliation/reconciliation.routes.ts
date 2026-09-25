import { Routes } from '@angular/router';

export const RECONCILIATION_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./reconciliation-page').then((c) => c.ReconciliationPage),
  },
];
