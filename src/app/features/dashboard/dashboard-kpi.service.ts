import { Injectable, computed, inject, signal } from '@angular/core';

import { ApiService } from '@core/api/api.service';
import { AuthService } from '@core/auth/auth.service';
import { addDays, dayOnly } from '@shared/utils/date-utils';

/** GET /api/v1/sales/analytics/dashboard-summary (SALES_ANALYTICS). */
export interface SalesSummary {
  totalSalesCount: number;
  totalRevenue: number;
  totalDiscount: number;
  totalPaid: number;
  paidPct: number;
  pendingSalesCount: number;
  completedSalesCount: number;
  allTimeOutstandingAmount: number;
  allTimePendingSalesCount: number;
  windowedOutstandingAmount: number;
  lastActiveSalesDate: string | null;
  hourlyRevenue: number[];
  hourlyOrderCount: number[];
}

/** GET /api/store/display/dashboard/stats (STORE_READ) — the fields the dashboard uses. */
export interface StockStats {
  totalProductsInStock: number;
  lowStockAlerts: number;
  outOfStockAlerts: number;
  totalInventoryValue: number;
  overallStockHealth: string;
  soldPiecesToday: number;
}

/** Backend expects LocalDateTime: `yyyy-MM-ddTHH:mm:ss`. */
function isoLocal(d: Date, endOfDay = false): string {
  const p = (n: number) => String(n).padStart(2, '0');
  const t = endOfDay ? '23:59:59' : '00:00:00';
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${t}`;
}

/**
 * Business KPIs for the home dashboard. Each source loads only when the user
 * holds the permission the backend enforces, so a cashier never triggers a 403.
 */
@Injectable({ providedIn: 'root' })
export class DashboardKpiService {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);

  readonly canSeeSales = computed(() => this.auth.hasPermission('SALES_ANALYTICS'));
  readonly canSeeStock = computed(() => this.auth.hasPermission('STORE_READ'));

  readonly today = signal<SalesSummary | null>(null);
  readonly yesterday = signal<SalesSummary | null>(null);
  readonly stock = signal<StockStats | null>(null);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly loadedAt = signal<Date | null>(null);

  /** % change of today's revenue vs yesterday (null when there is no baseline). */
  readonly revenueChange = computed(() => {
    const t = this.today()?.totalRevenue ?? 0;
    const y = this.yesterday()?.totalRevenue ?? 0;
    if (!y) return null;
    return ((t - y) / y) * 100;
  });

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    const now = dayOnly(new Date());
    const tasks: Promise<unknown>[] = [];
    if (this.canSeeSales()) {
      tasks.push(this.summary(now).then((s) => this.today.set(s)));
      tasks.push(this.summary(addDays(now, -1)).then((s) => this.yesterday.set(s)));
    }
    if (this.canSeeStock()) {
      tasks.push(
        this.api.get<StockStats>('/api/store/display/dashboard/stats').then((s) => this.stock.set(s)),
      );
    }
    const results = await Promise.allSettled(tasks);
    const failed = results.find((r) => r.status === 'rejected') as PromiseRejectedResult | undefined;
    if (failed) this.error.set(String((failed.reason as Error)?.message ?? failed.reason));
    this.loadedAt.set(new Date());
    this.loading.set(false);
  }

  private summary(day: Date): Promise<SalesSummary> {
    return this.api.get<SalesSummary>('/api/v1/sales/analytics/dashboard-summary', {
      params: { startDate: isoLocal(day), endDate: isoLocal(day, true), includeHourly: true },
    });
  }
}
