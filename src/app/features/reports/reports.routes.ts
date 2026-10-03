import { inject } from '@angular/core';
import { CanActivateFn, Router, Routes } from '@angular/router';

import { AuthService } from '@core/auth/auth.service';
import { ReportId, reportDef } from './reports.models';

/** A report opens only with one of its permissions; otherwise back to the hub. */
const reportGuard =
  (id: ReportId): CanActivateFn =>
  () =>
    inject(AuthService).hasAnyPermission(reportDef(id)!.permissions) || inject(Router).createUrlTree(['/reports']);

export const REPORTS_ROUTES: Routes = [
  { path: '', loadComponent: () => import('./reports-hub').then((c) => c.ReportsHub) },
  { path: 'financial', canActivate: [reportGuard('financial')], loadComponent: () => import('./financial-report').then((c) => c.FinancialReport) },
  { path: 'profit', canActivate: [reportGuard('profit')], loadComponent: () => import('./profit-report').then((c) => c.ProfitReport) },
  { path: 'sales', canActivate: [reportGuard('sales')], loadComponent: () => import('./sales-report').then((c) => c.SalesReport) },
  { path: 'inventory', canActivate: [reportGuard('inventory')], loadComponent: () => import('./inventory-report').then((c) => c.InventoryReport) },
  { path: 'purchases', canActivate: [reportGuard('purchases')], loadComponent: () => import('./purchases-report').then((c) => c.PurchasesReport) },
  { path: 'receivables', canActivate: [reportGuard('receivables')], loadComponent: () => import('./receivables-report').then((c) => c.ReceivablesReport) },
  { path: 'expenses', canActivate: [reportGuard('expenses')], loadComponent: () => import('./expenses-report').then((c) => c.ExpensesReport) },
  { path: 'deleted-debts', canActivate: [reportGuard('deleted-debts')], loadComponent: () => import('./deleted-debts-report').then((c) => c.DeletedDebtsReport) },
  { path: '**', redirectTo: '' },
];
