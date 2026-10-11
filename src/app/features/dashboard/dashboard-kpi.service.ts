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

/** One day of the sales trend chart. */
export interface DayPoint {
  date: Date;
  revenue: number;
  sales: number;
}

/** Day requests running at once (the production server is small). */
const TREND_PARALLEL = 4;
/** How long a past day's total is reused before it is asked for again. */
const TREND_TTL_MS = 10 * 60_000;

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
  readonly canSeeDebts = computed(() => this.auth.hasPermission('CUSTOMER_CREDIT_VIEW'));

  readonly today = signal<SalesSummary | null>(null);
  readonly yesterday = signal<SalesSummary | null>(null);
  readonly stock = signal<StockStats | null>(null);
  /**
   * Customer debts from the receivables register (GET /customers/unpaid/total) —
   * the same figure as GL account 1100 and the AR report. The sales summary's
   * allTimeOutstandingAmount is built from stale sale-level balances and
   * disagreed with the books (859,000 vs 1,617,000 on 2026-09-28).
   */
  readonly debts = signal<{ total: number; customers: number } | null>(null);
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

  /** Sales of each of the last N days, oldest first (null while the first load runs). */
  readonly trend = signal<DayPoint[] | null>(null);
  readonly trendLoading = signal(false);
  /** True when a day could not be loaded — the chart is withheld rather than drawn with a false zero. */
  readonly trendFailed = signal(false);
  private readonly dayCache = new Map<string, { point: DayPoint; at: number }>();
  private trendRun = 0;

  /**
   * Daily totals for the trend chart. The backend has no day-by-day series
   * without the profit columns, so each day is one dashboard-summary call
   * (no hourly breakdown): at most TREND_PARALLEL at a time, and a day already
   * fetched is reused for TREND_TTL_MS (today: one minute).
   */
  async loadTrend(days: number): Promise<void> {
    if (!this.canSeeSales()) return;
    const run = ++this.trendRun;
    this.trendLoading.set(true);
    this.trendFailed.set(false);
    const now = dayOnly(new Date());
    const dates = Array.from({ length: days }, (_, i) => addDays(now, i - (days - 1)));
    const out: (DayPoint | null)[] = dates.map(() => null);
    let next = 0;
    const worker = async () => {
      while (next < dates.length) {
        const i = next++;
        out[i] = await this.day(dates[i], i === dates.length - 1).catch(() => null);
      }
    };
    await Promise.all(Array.from({ length: Math.min(TREND_PARALLEL, dates.length) }, worker));
    if (run !== this.trendRun) return; // a newer choice took over
    const complete = out.every((p) => p !== null);
    this.trendFailed.set(!complete);
    this.trend.set(complete ? (out as DayPoint[]) : null);
    this.trendLoading.set(false);
  }

  private async day(date: Date, isToday: boolean): Promise<DayPoint> {
    const key = `${this.auth.activeBranch()?.uid ?? ''}|${isoLocal(date)}`;
    const hit = this.dayCache.get(key);
    if (hit && Date.now() - hit.at < (isToday ? 60_000 : TREND_TTL_MS)) return hit.point;
    return this.remember(date, await this.summary(date));
  }

  private remember(date: Date, s: SalesSummary): DayPoint {
    const point = { date, revenue: Number(s?.totalRevenue ?? 0) || 0, sales: Number(s?.totalSalesCount ?? 0) || 0 };
    this.dayCache.set(`${this.auth.activeBranch()?.uid ?? ''}|${isoLocal(date)}`, { point, at: Date.now() });
    return point;
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    const now = dayOnly(new Date());
    const tasks: Promise<unknown>[] = [];
    if (this.canSeeSales()) {
      // Both days also seed the trend chart, so it does not ask for them again.
      tasks.push(this.summary(now).then((s) => (this.today.set(s), this.remember(now, s))));
      tasks.push(this.summary(addDays(now, -1)).then((s) => (this.yesterday.set(s), this.remember(addDays(now, -1), s))));
    }
    if (this.canSeeDebts()) {
      tasks.push(
        this.api
          .get<{ totalOutstanding: unknown; customerCount: unknown }>('/api/v1/customers/unpaid/total')
          .then((d) => this.debts.set({ total: Number(d?.totalOutstanding ?? 0) || 0, customers: Number(d?.customerCount ?? 0) || 0 })),
      );
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
      params: { startDate: isoLocal(day), endDate: isoLocal(day, true), includeHourly: false },
    });
  }
}
