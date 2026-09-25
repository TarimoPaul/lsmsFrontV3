import { Routes } from '@angular/router';

export const SUPPLIERS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./suppliers-page').then((c) => c.SuppliersPage),
  },
];
