import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { MatButton } from '@angular/material/button';
import { MatChipListbox, MatChipOption } from '@angular/material/chips';
import { MatRipple } from '@angular/material/core';
import { MatTooltip } from '@angular/material/tooltip';
import { Router, RouterLink } from '@angular/router';

import { AuthService } from '@core/auth/auth.service';
import { LanguageService } from '@core/i18n/language.service';
import { APP_MODULES, AppModule, CATEGORY_LABELS, CATEGORY_ORDER, ModuleCategory } from '@core/navigation/app-modules';
import { ModuleUsageService } from '@core/navigation/module-usage.service';
import { ComparisonBars, CountUp, DialogService, Icon, Skeleton } from '@shared/ui';
import { Money } from '@shared/utils/money';
import { OrderBanner } from '../order-suggestion/order-banner';
import { DashboardAlertsService } from './dashboard-alerts.service';
import { DashboardKpiService } from './dashboard-kpi.service';

type Filter = 'ALL' | ModuleCategory;
type AlertKey = 'recon' | 'liability' | 'debt';

/** Seconds a dashboard reminder stays before fading out (paused on hover). */
const ALERT_SECONDS = 15;

/**
 * Staged intro (user, 2026-09-28 — after a reference video): the important
 * things appear almost at once (greeting, actions, KPI cards counting up),
 * then the rest follows in order (charts → frequently used → modules), each
 * block coming in from a soft blur. Delays in ms; CSS does the rest.
 */
const INTRO = { kpiStart: 200, kpiStep: 90, tileStart: 880, tileStep: 35, tileMax: 16, total: 2000 };

interface Tile {
  module: AppModule;
  locked: boolean;
}

interface QuickAction {
  label: string;
  icon: string;
  route: string;
  permission: string;
  primary?: boolean;
}

/**
 * Home dashboard (v3). Keeps Flutter MainMenu's content — greeting,
 * permission-gated alerts, module launcher with RBAC locks — and adds a
 * business overview: KPI strip, hourly sales vs yesterday and stock health.
 */
@Component({
  selector: 'app-main-dashboard',
  imports: [RouterLink, MatButton, MatChipListbox, MatChipOption, MatRipple, MatTooltip, Icon, Skeleton, ComparisonBars, CountUp, OrderBanner],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './main-dashboard.html',
  styleUrl: './main-dashboard.scss',
})
export class MainDashboard {
  protected readonly auth = inject(AuthService);
  protected readonly i18n = inject(LanguageService);
  protected readonly alerts = inject(DashboardAlertsService);
  protected readonly kpi = inject(DashboardKpiService);
  protected readonly usage = inject(ModuleUsageService);
  private readonly dialogs = inject(DialogService);
  private readonly router = inject(Router);

  protected readonly filter = signal<Filter>('ALL');
  /** True during the first ~2 s: later re-renders (filter change, refresh) skip the long delays. */
  protected readonly intro = signal(true);
  protected readonly alertSeconds = ALERT_SECONDS;
  protected readonly categories = CATEGORY_ORDER;
  protected readonly categoryLabels = CATEGORY_LABELS;
  protected readonly money = (n: number | null | undefined) => Money.format(n ?? 0);
  protected readonly compact = (n: number | null | undefined) => Money.format(n ?? 0, { decimals: 0 });

  protected readonly greeting = computed(() => {
    const h = new Date().getHours();
    if (h < 12) return this.i18n.t('Good morning', 'Habari za asubuhi');
    if (h < 17) return this.i18n.t('Good afternoon', 'Habari za mchana');
    return this.i18n.t('Good evening', 'Habari za jioni');
  });

  protected readonly firstName = computed(() => this.auth.user()?.firstName || this.auth.displayName());

  protected readonly today = computed(() =>
    new Date().toLocaleDateString(this.i18n.isSwahili() ? 'sw-TZ' : 'en-GB', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }),
  );

  protected readonly quickActions = computed<QuickAction[]>(() =>
    [
      { label: this.i18n.t('New sale', 'Mauzo mapya'), icon: 'add_shopping_cart', route: '/sales', permission: 'SALES_CREATE', primary: true },
      { label: this.i18n.t('New purchase', 'Ununuzi mpya'), icon: 'shopping_cart', route: '/purchases', permission: 'PURCHASE_CREATE' },
      { label: this.i18n.t('Add product', 'Ongeza bidhaa'), icon: 'inventory_2', route: '/products', permission: 'PRODUCT_CREATE' },
      { label: this.i18n.t('Add customer', 'Ongeza mteja'), icon: 'person_add', route: '/customers', permission: 'CUSTOMER_CREATE' },
    ].filter((a) => this.auth.hasPermission(a.permission)),
  );

  // ── Intro timing ──────────────────────────────────────────────────────────
  protected readonly stockKpiIndex = computed(() => (this.kpi.canSeeSales() ? 3 : 0));

  protected kpiDelay(i: number): number {
    return INTRO.kpiStart + i * INTRO.kpiStep;
  }

  /** The count-up starts as its card finishes appearing (none after the intro). */
  protected countDelay(i: number): number {
    return this.intro() ? this.kpiDelay(i) + 150 : 0;
  }

  protected tileDelay(i: number): number {
    return this.intro() ? INTRO.tileStart + Math.min(i, INTRO.tileMax) * INTRO.tileStep : Math.min(i, 12) * 20;
  }

  // ── Launcher ──────────────────────────────────────────────────────────────
  private readonly tiles = computed<Tile[]>(() =>
    APP_MODULES.map((module) => ({ module, locked: !this.auth.canAccessSection(module.id) })),
  );
  protected readonly visibleTiles = computed(() => {
    const f = this.filter();
    return this.tiles().filter((t) => f === 'ALL' || t.module.category === f);
  });
  protected readonly counts = computed(() => {
    const out: Record<string, { open: number; total: number }> = { ALL: { open: 0, total: 0 } };
    for (const t of this.tiles()) {
      const c = (out[t.module.category] ??= { open: 0, total: 0 });
      c.total++;
      out['ALL'].total++;
      if (!t.locked) {
        c.open++;
        out['ALL'].open++;
      }
    }
    return out;
  });

  // ── KPIs ──────────────────────────────────────────────────────────────────
  protected readonly showOverview = computed(() => this.kpi.canSeeSales() || this.kpi.canSeeStock());
  /** Receivables register (= GL 1100) when allowed; the sales summary only as a fallback. */
  protected readonly debtTotal = computed<number | null>(() => {
    const d = this.kpi.debts();
    if (d) return d.total;
    if (this.kpi.canSeeDebts() && this.kpi.loading()) return null; // register still loading
    return this.kpi.today()?.allTimeOutstandingAmount ?? null;
  });
  protected readonly hours = Array.from({ length: 24 }, (_, i) => String(i));
  protected readonly peakHour = computed(() => {
    const series = this.kpi.today()?.hourlyRevenue ?? [];
    const max = Math.max(0, ...series);
    if (!max) return null;
    const h = series.indexOf(max);
    return `${String(h).padStart(2, '0')}:00 – ${String(h + 1).padStart(2, '0')}:00`;
  });
  protected readonly stockHealth = computed(() => {
    const s = this.kpi.stock();
    if (!s) return null;
    const total = Math.max(1, s.totalProductsInStock);
    const out = s.outOfStockAlerts;
    const low = Math.max(0, s.lowStockAlerts - out);
    const ok = Math.max(0, total - low - out);
    const pct = (n: number) => Math.round((n / total) * 100);
    return { total: s.totalProductsInStock, ok, low, out, okPct: pct(ok), lowPct: pct(low), outPct: pct(out), status: s.overallStockHealth };
  });

  // ── Alerts: closable (for the day) + auto-hide after a short reminder ─────
  /** Alerts that timed out in this visit (they return next time the dashboard opens). */
  private readonly autoHidden = signal(new Set<AlertKey>());
  protected readonly alertCounts = computed<Record<AlertKey, number>>(() => ({
    recon: this.alerts.reconApprovals()?.count ?? 0,
    liability: this.alerts.liabilities()?.count ?? 0,
    debt: this.alerts.debtAdjustments() ?? 0,
  }));

  protected showAlert(key: AlertKey): boolean {
    const n = this.alertCounts()[key];
    return n > 0 && !this.autoHidden().has(key) && !this.alerts.isDismissed(key, n);
  }

  protected readonly hasAlerts = computed(() =>
    (['recon', 'liability', 'debt'] as AlertKey[]).some((k) => this.showAlert(k)),
  );

  /** Close button — hide for the rest of the day (returns early if new items arrive). */
  protected closeAlert(key: AlertKey): void {
    this.alerts.dismiss(key, this.alertCounts()[key]);
    this.autoHidden.update((s) => new Set(s).add(key));
  }

  /** Reminder timer finished — hide for this visit only. */
  protected autoHide(key: AlertKey): void {
    this.autoHidden.update((s) => new Set(s).add(key));
  }

  constructor() {
    const t = setTimeout(() => this.intro.set(false), INTRO.total);
    inject(DestroyRef).onDestroy(() => clearTimeout(t));
  }

  ngOnInit(): void {
    this.alerts.load();
    void this.kpi.load();
  }

  protected setFilter(value: Filter | null | undefined): void {
    this.filter.set(value ?? 'ALL');
  }

  protected openModule(tile: Tile | AppModule): void {
    const module = 'module' in tile ? tile.module : tile;
    const locked = 'locked' in tile ? tile.locked : !this.auth.canAccessSection(module.id);
    if (locked) {
      void this.dialogs.error(
        this.i18n.t(
          `You don't have permission to access ${module.title.en}. Contact your administrator to request access.`,
          `Huna ruhusa ya kufungua ${module.title.sw}. Wasiliana na msimamizi wako kuomba ruhusa.`,
        ),
        this.i18n.t('Access Denied', 'Ruhusa Imekataliwa'),
      );
      return;
    }
    void this.router.navigateByUrl(module.route);
  }
}
