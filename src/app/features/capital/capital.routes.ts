import { Routes } from '@angular/router';

export const CAPITAL_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./capital-page').then((c) => c.CapitalPage),
  },
];
