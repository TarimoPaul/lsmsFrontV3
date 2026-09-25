import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';

import { ApiError } from '@core/api/api.types';
import { AuthService } from '@core/auth/auth.service';
import { LanguageService } from '@core/i18n/language.service';
import {
  ActionMenu,
  DataTable,
  DialogService,
  EmptyState,
  ExportFormat,
  ExportToolbar,
  FilterPanel,
  Icon,
  MenuAction,
  MetricCard,
  MetricsGrid,
  PageHeader,
  SegmentOption,
  SegmentedFilterBar,
  SelectField,
  SelectOption,
  TableColumn,
  ToastService,
} from '@shared/ui';
import { parseLocal } from '@shared/utils/date-utils';
import { downloadCsv, printReport } from '@shared/utils/export';
import { Money, MoneyPipe } from '@shared/utils/money';
import { InsightsPanel } from './insights-panel';
import { MovementsPanel } from './movements-panel';
import { HEALTH, StockHealth, StockItem, movementMeta, packagesLabel, stockHealth } from './store.models';
import { StoreService } from './store.service';

type View = 'inventory' | 'movements' | 'insights';
type Filter = 'ALL' | StockHealth;

const THRESHOLDS = [5, 10, 20];
const DAY = 86_400_000;

/**
 * Store / inventory — port of Flutter `StoreDashboard` (stock summary, low
 * stock, movements All / In / Out / Adjustments, inventory analytics, stock
 * adjustments / damage / returns, per-product movement history).
 *
 * The inventory view is one cached request (current stock of every product);
 * low / out-of-stock and value are computed locally, so changing the low-stock
 * threshold costs nothing. Movements and Insights load only when opened.
 */
@Component({
  selector: 'app-store-page',
  imports: [
    PageHeader,
    MetricCard,
    MetricsGrid,
    FilterPanel,
    SegmentedFilterBar,
    SelectField,
    DataTable,
    TableColumn,
    ActionMenu,
    ExportToolbar,
    EmptyState,
    Icon,
    MoneyPipe,
    MovementsPanel,
    InsightsPanel,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './store-page.html',
  styleUrl: './store-page.scss',
})
export class StorePage {
  protected readonly auth = inject(AuthService);
  protected readonly i18n = inject(LanguageService);
  private readonly api = inject(StoreService);
  private readonly dialogs = inject(DialogService);
  private readonly toast = inject(ToastService);

  protected readonly items = computed(() => this.api.stock.value() ?? []);
  protected readonly loading = computed(() => this.api.stock.initialLoading());
  protected readonly error = signal<string | null>(null);
  protected readonly view = signal<View>('inventory');
  protected readonly filter = signal<Filter>('ALL');
  protected readonly search = signal('');
  protected readonly categoryUid = signal<string | null>(null);
  protected readonly threshold = signal(10);
  protected readonly thresholds = THRESHOLDS;

  protected readonly canChange = computed(() => this.auth.hasAnyPermission(['STORE_WRITE', 'INVENTORY_ADJUST', 'STORE_ADMIN']));
  protected readonly health = HEALTH;

  protected readonly rowId = (s: StockItem) => s.uid;
  protected readonly nameOf = (s: StockItem) => s.productName;
  protected readonly stockOf = (s: StockItem) => s.currentStock;
  protected readonly valueOf = (s: StockItem) => this.value(s);
  protected readonly healthOf = (s: StockItem) => ['NEGATIVE', 'OUT', 'LOW', 'OK'].indexOf(this.healthMap().get(s.uid) ?? 'OK');
  protected readonly lastOf = (s: StockItem) => s.lastMovementDate ?? '';

  protected readonly healthMap = computed(() => {
    const t = this.threshold();
    return new Map(this.items().map((s) => [s.uid, stockHealth(s, t)]));
  });

  protected readonly stats = computed(() => {
    const list = this.items();
    const h = this.healthMap();
    const count = (x: StockHealth) => list.filter((s) => h.get(s.uid) === x).length;
    return {
      products: list.length,
      inStock: list.filter((s) => s.currentStock > 0).length,
      value: list.reduce((n, s) => n + this.value(s), 0),
      retail: list.reduce((n, s) => n + Math.max(0, s.currentStock) * (s.pieceSalePrice ?? 0), 0),
      low: count('LOW'),
      out: count('OUT'),
      negative: count('NEGATIVE'),
      pieces: list.reduce((n, s) => n + Math.max(0, s.currentStock), 0),
    };
  });

  protected readonly viewOptions = computed<SegmentOption<View>[]>(() => [
    { value: 'inventory', label: this.i18n.t('Inventory', 'Mzigo uliopo'), icon: 'inventory' },
    { value: 'movements', label: this.i18n.t('Movements', 'Mabadiliko'), icon: 'swap_vert' },
    { value: 'insights', label: this.i18n.t('Insights', 'Uchambuzi'), icon: 'insights' },
  ]);

  protected readonly filterOptions = computed<SegmentOption<Filter>[]>(() => {
    const s = this.stats();
    const lang = this.i18n.lang();
    const opts: SegmentOption<Filter>[] = [
      { value: 'ALL', label: this.i18n.t('All', 'Zote'), count: s.products },
      { value: 'LOW', label: HEALTH.LOW[lang], icon: HEALTH.LOW.icon, count: s.low },
      { value: 'OUT', label: HEALTH.OUT[lang], icon: HEALTH.OUT.icon, count: s.out },
    ];
    if (s.negative) opts.push({ value: 'NEGATIVE', label: HEALTH.NEGATIVE[lang], icon: HEALTH.NEGATIVE.icon, count: s.negative });
    return opts;
  });

  protected readonly categoryOptions = computed<SelectOption[]>(() => {
    const m = new Map<string, string>();
    for (const s of this.items()) if (s.categoryUid && s.category) m.set(s.categoryUid, s.category);
    return [...m.entries()].map(([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label));
  });

  protected readonly rows = computed(() => {
    const f = this.filter();
    const q = this.search().trim().toLowerCase();
    const cat = this.categoryUid();
    const h = this.healthMap();
    return this.items().filter((s) => {
      if (f !== 'ALL' && h.get(s.uid) !== f) return false;
      if (cat && s.categoryUid !== cat) return false;
      return !q || s.productName.toLowerCase().includes(q) || (s.category ?? '').toLowerCase().includes(q);
    });
  });

  constructor() {
    void this.refresh(false);
  }

  protected async refresh(force = true): Promise<void> {
    this.error.set(null);
    try {
      await this.api.stock.load(force);
      if (force) this.api.insights.invalidate();
    } catch (e) {
      const err = ApiError.from(e);
      this.error.set(err.isForbidden ? this.i18n.t('You are not allowed to view the store.', 'Huruhusiwi kuona stoo.') : err.message);
    }
  }

  protected value(s: StockItem): number {
    return Math.max(0, s.currentStock) * (s.averageCostPrice ?? 0);
  }

  protected stockLabel(s: StockItem): string {
    return packagesLabel(s.currentStock, s.piecesPerPackage, s.packageAbbreviation, this.i18n.t('pcs', 'vip'));
  }

  protected lastMove(s: StockItem): { label: string; when: string } | null {
    if (!s.lastMovementDate) return null;
    const d = parseLocal(s.lastMovementDate);
    const m = movementMeta(s.lastMovementType ?? '');
    const days = d ? Math.floor((Date.now() - d.getTime()) / DAY) : null;
    const when =
      days === null ? '' : days <= 0 ? this.i18n.t('today', 'leo') : days === 1 ? this.i18n.t('yesterday', 'jana') : this.i18n.t(`${days}d ago`, `siku ${days}`);
    return { label: this.i18n.isSwahili() ? m.sw : m.en, when };
  }

  protected actions(s: StockItem): MenuAction[] {
    const t = (en: string, sw: string) => this.i18n.t(en, sw);
    const list: MenuAction[] = [{ label: t('Stock history', 'Historia ya mzigo'), icon: 'history', run: () => void this.openHistory(s) }];
    if (this.canChange()) {
      list.push(
        { label: t('Add stock', 'Ongeza mzigo'), icon: 'add_circle', run: () => void this.openChange(s, 'ADJUST_IN') },
        { label: t('Remove stock', 'Punguza mzigo'), icon: 'remove_circle', run: () => void this.openChange(s, 'ADJUST_OUT') },
        { label: t('Record damage', 'Rekodi uharibifu'), icon: 'broken_image', run: () => void this.openChange(s, 'DAMAGE') },
      );
    }
    return list;
  }

  protected async openHistory(s: StockItem): Promise<void> {
    const { StockHistoryDialog } = await import('./stock-history-dialog');
    const res = await this.dialogs.openAsync<'change'>(StockHistoryDialog, { size: 'lg', data: { item: s, canChange: this.canChange() } });
    if (res === 'change') await this.openChange(s);
  }

  protected openHistoryByUid(uid: string): void {
    const s = this.items().find((x) => x.uid === uid);
    if (s) void this.openHistory(s);
  }

  protected async openChange(s: StockItem, kind?: 'ADJUST_IN' | 'ADJUST_OUT' | 'DAMAGE' | 'RETURN'): Promise<void> {
    const { StockChangeDialog } = await import('./stock-change-dialog');
    await this.dialogs.openAsync(StockChangeDialog, { size: 'md', data: { item: s, kind } });
  }

  protected export(format: ExportFormat): void {
    const t = (en: string, sw: string) => this.i18n.t(en, sw);
    const list = this.rows();
    if (!list.length) {
      this.toast.info(t('Nothing to export', 'Hakuna cha kuhamisha'));
      return;
    }
    const lang = this.i18n.lang();
    const headers = [t('Product', 'Bidhaa'), t('Category', 'Kategoria'), t('Stock (pcs)', 'Mzigo (vip)'), t('Packages', 'Paketi'), t('Avg cost', 'Gharama wastani'), t('Stock value', 'Thamani'), t('Status', 'Hali')];
    const rows = list.map((s) => [
      s.productName,
      s.category ?? '',
      s.currentStock,
      this.stockLabel(s),
      s.averageCostPrice ?? '',
      Math.round(this.value(s)),
      HEALTH[this.healthMap().get(s.uid) ?? 'OK'][lang],
    ]);
    if (format === 'csv') {
      downloadCsv('stock', headers, rows);
      this.toast.success(t(`${list.length} products exported`, `Bidhaa ${list.length} zimehamishwa`));
      return;
    }
    const total = list.reduce((n, s) => n + this.value(s), 0);
    printReport({
      title: t('Stock Report', 'Ripoti ya Mzigo'),
      subtitle: `${this.auth.activeBranch()?.branchName ?? ''} · ${new Date().toLocaleDateString()}`,
      headers: ['#', ...headers],
      rows: rows.map((r, i) => [i + 1, ...r.map((v, j) => (j === 4 || j === 5) && typeof v === 'number' ? Money.format(v, { symbol: false }) : v)]),
      summary: [
        [t('Products', 'Bidhaa'), list.length],
        [t('Stock value (cost)', 'Thamani (gharama)'), Money.format(total)],
        [HEALTH.LOW[lang], list.filter((s) => this.healthMap().get(s.uid) === 'LOW').length],
        [HEALTH.OUT[lang], list.filter((s) => this.healthMap().get(s.uid) === 'OUT').length],
      ],
      numeric: [0, 3, 5, 6],
    });
  }
}
