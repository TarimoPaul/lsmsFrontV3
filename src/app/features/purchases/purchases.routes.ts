import { Routes } from '@angular/router';

import { permissionGuard } from '@core/auth/guards';

export const PURCHASES_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./purchases-page').then((c) => c.PurchasesPage),
  },
  {
    path: 'repurchase',
    title: 'Repurchase · LSMS',
    canMatch: [permissionGuard],
    data: { permissions: ['PURCHASE_WRITE'] },
    loadComponent: () => import('./repurchase/repurchase-page').then((c) => c.RepurchasePage),
  },
  {
    path: 'suggestion',
    title: 'Pendekezo la oda · LSMS',
    canMatch: [permissionGuard],
    data: { permissions: ['ORDER_SUGGESTION_VIEW'] },
    loadComponent: () => import('../order-suggestion/order-page').then((c) => c.OrderPage),
  },
];
