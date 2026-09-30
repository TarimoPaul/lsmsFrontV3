import { Routes } from '@angular/router';

export const COUNTING_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./counting-page').then((c) => c.CountingPage),
  },
];
