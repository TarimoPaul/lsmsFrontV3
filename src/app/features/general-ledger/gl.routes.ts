import { Routes } from '@angular/router';

export const GL_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./gl-page').then((c) => c.GlPage),
  },
];
