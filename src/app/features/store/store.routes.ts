import { Routes } from '@angular/router';

export const STORE_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./store-page').then((c) => c.StorePage),
  },
];
