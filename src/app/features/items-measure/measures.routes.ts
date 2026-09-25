import { Routes } from '@angular/router';

export const MEASURES_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./measures-page').then((c) => c.MeasuresPage),
  },
];
