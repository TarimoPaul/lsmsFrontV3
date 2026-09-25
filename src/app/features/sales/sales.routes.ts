import { Routes } from '@angular/router';

import { permissionGuard } from '@core/auth/guards';

export const SALES_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./sales-page').then((c) => c.SalesPage),
  },
  {
    path: 'new',
    title: 'New sale · LSMS',
    canMatch: [permissionGuard],
    data: { permissions: ['SALES_WRITE'] },
    loadComponent: () => import('./pos/pos-page').then((c) => c.PosPage),
  },
];
