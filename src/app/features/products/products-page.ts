import { ChangeDetectionStrategy, Component, computed, inject, signal, viewChild } from '@angular/core';

import { ApiError } from '@core/api/api.types';
import { AuthService } from '@core/auth/auth.service';
import { CanDirective } from '@core/auth/can.directive';
import { LanguageService } from '@core/i18n/language.service';
import {
  ActionMenu,
  Button,
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
import { downloadCsv, printReport } from '@shared/utils/export';
import { Money, MoneyPipe } from '@shared/utils/money';
import { categoryColor, categoryInitials } from '../categories/categories.models';
import { CategoriesService } from '../categories/categories.service';
import { MeasuresService } from '../items-measure/measures.service';
import { HEALTH_META, Product, ProductHealth, TIERS, TierDef, measureLabel, productHealth } from './products.models';
import { ProductsService } from './products.service';

type HealthFilter = 'ALL' | ProductHealth | 'NO_MEASURE';

/**
 * Product Management — port of Flutter `ProductSectionWidget` + `ProductTable`
 * (KPIs, quick filters, search, category/measure filters, add / edit /
 * duplicate / details / delete, bulk delete, export). v3 changes:
 * - the whole catalogue is shown (Flutter loaded only the first 50 products);
 * - readiness follows the backend (any complete tier sells) instead of
 *   requiring all four prices, which flagged carton-only items as unpriced;
 * - dropped actions whose backend endpoints are placeholders or never persist
 *   (activate/deactivate, barcode, bulk pricing, import/export, analytics);
 * - data comes from a shared cache and dialogs load on demand.
 */
@Component({
  selector: 'app-products-page',
  imports: [
    CanDirective,
    PageHeader,
    Button,
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
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './products-page.html',
  styleUrl: './products-page.scss',
})
export class ProductsPage {
  protected readonly auth = inject(AuthService);
  protected readonly i18n = inject(LanguageService);
  private readonly api = inject(ProductsService);
  private readonly categoriesApi = inject(CategoriesService);
  private readonly measuresApi = inject(MeasuresService);
  private readonly dialogs = inject(DialogService);
  private readonly toast = inject(ToastService);

  private readonly table = viewChild<DataTable<Product>>(DataTable);

  protected readonly products = computed(() => this.api.catalogue.value() ?? []);
  protected readonly loading = computed(() => this.api.catalogue.initialLoading());
  protected readonly error = signal<string | null>(null);
  protected readonly busy = signal(false);

  protected readonly search = signal('');
  protected readonly health = signal<HealthFilter>('ALL');
  protected readonly categoryUid = signal<string | null>(null);
  protected readonly measureUid = signal<string | null>(null);
  protected readonly selected = signal<Product[]>([]);

  protected readonly canCreate = computed(() => this.auth.hasPermission('PRODUCT_WRITE'));
  protected readonly canUpdate = computed(() => this.auth.hasPermission('PRODUCT_UPDATE'));
  protected readonly canDelete = computed(() => this.auth.hasPermission('PRODUCT_DELETE'));

  protected readonly tiers = TIERS;
  protected readonly healthMeta = HEALTH_META;
  /** Product tile takes its category's colour (same as on Categories). */
  protected readonly tileColor = (p: Product) => categoryColor(p.categoryName ?? p.productName);
  protected readonly initials = (p: Product) => categoryInitials(p.productName);
  protected readonly measureLabel = measureLabel;

  // Row accessors (stable references for the table)
  protected readonly rowId = (p: Product) => p.uid;
  protected readonly nameOf = (p: Product) => p.displayName;
  protected readonly categoryOf = (p: Product) => p.categoryName ?? '';
  protected readonly healthOf = (p: Product) => this.healthIndex[this.healthMap().get(p.uid) ?? 'NO_PRICE'];
  protected readonly priceOf = (t: TierDef) => (p: Product) => p[t.price];
  protected readonly sortPiece = this.priceOf(TIERS[0]);
  protected readonly sortQuarter = this.priceOf(TIERS[1]);
  protected readonly sortHalf = this.priceOf(TIERS[2]);
  protected readonly sortWhole = this.priceOf(TIERS[3]);
  private readonly healthIndex: Record<ProductHealth, number> = { ISSUES: 0, NO_PRICE: 1, READY: 2 };

  /** Health is computed once per catalogue change, not per cell render. */
  protected readonly healthMap = computed(() => new Map(this.products().map((p) => [p.uid, productHealth(p)])));

  protected readonly stats = computed(() => {
    const list = this.products();
    const h = this.healthMap();
    let ready = 0;
    let issues = 0;
    let noPrice = 0;
    for (const p of list) {
      const s = h.get(p.uid);
      if (s === 'READY') ready++;
      else if (s === 'ISSUES') issues++;
      else noPrice++;
    }
    return {
      total: list.length,
      categories: new Set(list.map((p) => p.categoryUid).filter(Boolean)).size,
      ready,
      issues,
      noPrice,
      noMeasure: list.filter((p) => !p.itemsMeasureUids.length).length,
      packaged: list.filter((p) => p.wholeSalePrice !== null || p.halfSalePrice !== null || p.quarterSalePrice !== null).length,
    };
  });

  protected readonly healthOptions = computed<SegmentOption<HealthFilter>[]>(() => {
    const s = this.stats();
    const lang = this.i18n.lang();
    return [
      { value: 'ALL', label: this.i18n.t('All', 'Zote'), count: s.total },
      { value: 'READY', label: HEALTH_META.READY[lang], icon: HEALTH_META.READY.icon, count: s.ready },
      { value: 'ISSUES', label: HEALTH_META.ISSUES[lang], icon: HEALTH_META.ISSUES.icon, count: s.issues },
      { value: 'NO_PRICE', label: HEALTH_META.NO_PRICE[lang], icon: HEALTH_META.NO_PRICE.icon, count: s.noPrice },
      { value: 'NO_MEASURE', label: this.i18n.t('No measure', 'Bila kipimo'), icon: 'straighten', count: s.noMeasure },
    ];
  });

  protected readonly categoryOptions = computed<SelectOption[]>(() =>
    (this.categoriesApi.list.value() ?? [])
      .map((c) => ({ value: c.uid, label: c.categoryName }))
      .sort((a, b) => a.label.localeCompare(b.label)),
  );

  /** Only measures that are actually used by a product. */
  protected readonly measureOptions = computed<SelectOption[]>(() => {
    const used = new Map<string, string>();
    for (const p of this.products()) for (const m of p.measures) used.set(m.uid, measureLabel(m));
    return [...used.entries()].map(([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true }));
  });

  protected readonly rows = computed(() => {
    const q = this.search().trim().toLowerCase();
    const f = this.health();
    const cat = this.categoryUid();
    const mea = this.measureUid();
    const h = this.healthMap();
    return this.products().filter((p) => {
      if (cat && p.categoryUid !== cat) return false;
      if (mea && !p.itemsMeasureUids.includes(mea)) return false;
      if (f === 'NO_MEASURE' ? p.itemsMeasureUids.length > 0 : f !== 'ALL' && h.get(p.uid) !== f) return false;
      if (!q) return true;
      return (
        p.displayName.toLowerCase().includes(q) ||
        (p.categoryName ?? '').toLowerCase().includes(q) ||
        (p.priceDescription ?? '').toLowerCase().includes(q)
      );
    });
  });

  protected readonly filtered = computed(
    () => !!this.search().trim() || this.health() !== 'ALL' || !!this.categoryUid() || !!this.measureUid(),
  );

  constructor() {
    void this.refresh(false);
    // Reference lists for filters and the form (cached, usually instant).
    if (this.auth.hasPermission('CATEGORY_READ')) this.categoriesApi.list.load().catch(() => undefined);
  }

  /** `force` from the header refresh button; otherwise a fresh cache is reused. */
  protected async refresh(force = true): Promise<void> {
    this.error.set(null);
    try {
      await this.api.catalogue.load(force);
    } catch (e) {
      const err = ApiError.from(e);
      this.error.set(err.isForbidden ? this.i18n.t('You are not allowed to view products.', 'Huruhusiwi kuona bidhaa.') : err.message);
    }
  }

  protected healthOfRow(p: Product): ProductHealth {
    return this.healthMap().get(p.uid) ?? 'NO_PRICE';
  }

  protected clearFilters(): void {
    this.health.set('ALL');
    this.categoryUid.set(null);
    this.measureUid.set(null);
  }

  protected actions(p: Product): MenuAction[] {
    const t = (en: string, sw: string) => this.i18n.t(en, sw);
    const list: MenuAction[] = [{ label: t('View details', 'Maelezo'), icon: 'visibility', run: () => void this.openDetails(p) }];
    if (this.canUpdate()) list.push({ label: t('Edit', 'Hariri'), icon: 'edit', run: () => void this.openForm(p) });
    if (this.canCreate()) list.push({ label: t('Duplicate', 'Nakili'), icon: 'content_copy', run: () => void this.openForm(p, true) });
    if (this.canDelete()) list.push({ label: t('Delete', 'Futa'), icon: 'delete', destructive: true, run: () => void this.remove(p) });
    return list;
  }

  // ── Dialogs (loaded on demand to keep the page chunk small) ────────────────
  protected async openForm(product?: Product, duplicate = false): Promise<void> {
    const { ProductFormDialog } = await import('./product-form-dialog');
    await this.dialogs.openAsync(ProductFormDialog, {
      size: 'lg',
      data: { product, duplicate, existing: this.products() },
    });
  }

  protected async openDetails(product: Product): Promise<void> {
    const { ProductDetailsDialog } = await import('./product-details-dialog');
    const res = await this.dialogs.openAsync<'edit' | 'duplicate', { product: Product; canEdit: boolean; canDuplicate: boolean }>(
      ProductDetailsDialog,
      { size: 'md', data: { product, canEdit: this.canUpdate(), canDuplicate: this.canCreate() } },
    );
    if (res === 'edit') await this.openForm(product);
    else if (res === 'duplicate') await this.openForm(product, true);
  }

  // ── Delete ────────────────────────────────────────────────────────────────
  protected async remove(p: Product): Promise<void> {
    const ok = await this.dialogs.confirmDelete({
      title: this.i18n.t(`Delete "${p.displayName}"?`, `Futa "${p.displayName}"?`),
      message: this.i18n.t(
        'This cannot be undone. Products that already have purchases cannot be deleted.',
        'Kitendo hiki hakiwezi kurudishwa. Bidhaa zenye manunuzi haziwezi kufutwa.',
      ),
    });
    if (!ok) return;
    try {
      await this.api.remove(p.uid);
      this.toast.success(this.i18n.t(`${p.displayName} deleted`, `${p.displayName} imefutwa`));
    } catch (e) {
      await this.dialogs.error(ApiError.from(e).message, this.i18n.t('Could not delete', 'Imeshindikana kufuta'));
    }
  }

  protected async bulkDelete(): Promise<void> {
    const picked = this.selected();
    const t = (en: string, sw: string) => this.i18n.t(en, sw);
    const ok = await this.dialogs.confirmDelete({
      title: t(`Delete ${picked.length} product${picked.length === 1 ? '' : 's'}?`, `Futa bidhaa ${picked.length}?`),
      message: t(
        'This cannot be undone. Products that already have purchases will be skipped.',
        'Kitendo hiki hakiwezi kurudishwa. Bidhaa zenye manunuzi zitarukwa.',
      ),
      confirmText: t(`Delete ${picked.length}`, `Futa ${picked.length}`),
    });
    if (!ok) return;
    this.busy.set(true);
    let done = 0;
    const failed: string[] = [];
    for (const p of picked) {
      try {
        await this.api.remove(p.uid);
        done++;
      } catch {
        failed.push(p.displayName);
      }
    }
    this.busy.set(false);
    this.table()?.clearSelection();
    if (done) this.toast.success(t(`${done} product${done === 1 ? '' : 's'} deleted`, `Bidhaa ${done} zimefutwa`));
    if (failed.length) {
      await this.dialogs.error(
        t(
          `${failed.length} could not be deleted (they have purchase records): ${failed.join(', ')}`,
          `${failed.length} hazikufutwa (zina rekodi za manunuzi): ${failed.join(', ')}`,
        ),
        t('Some products were kept', 'Baadhi ya bidhaa zimebaki'),
      );
    }
  }

  protected clearSelection(): void {
    this.table()?.clearSelection();
  }

  // ── Export ────────────────────────────────────────────────────────────────
  protected export(format: ExportFormat): void {
    const list = this.selected().length ? this.selected() : this.rows();
    if (!list.length) {
      this.toast.info(this.i18n.t('Nothing to export', 'Hakuna cha kuhamisha'));
      return;
    }
    const t = (en: string, sw: string) => this.i18n.t(en, sw);
    const lang = this.i18n.lang();
    const sorted = [...list].sort((a, b) => a.displayName.localeCompare(b.displayName));
    if (format === 'csv') {
      downloadCsv(
        'products',
        [
          t('Product', 'Bidhaa'),
          t('Category', 'Kategoria'),
          t('Measure', 'Kipimo'),
          t('Pieces/package', 'Vipande/paketi'),
          ...TIERS.flatMap((tier) => (tier.qty ? [`${tier.short[lang]} (TZS)`, `${tier.short[lang]} ${t('pcs', 'vipande')}`] : [`${tier.short[lang]} (TZS)`])),
          t('Status', 'Hali'),
        ],
        sorted.map((p) => [
          p.displayName,
          p.categoryName ?? '',
          p.measures.map(measureLabel).join(' / '),
          p.piecesPerPackage,
          ...TIERS.flatMap((tier) => (tier.qty ? [p[tier.price], p[tier.qty]] : [p[tier.price]])),
          HEALTH_META[this.healthOfRow(p)][lang],
        ]),
      );
      this.toast.success(t(`${list.length} products exported`, `Bidhaa ${list.length} zimehamishwa`));
      return;
    }
    const s = this.stats();
    const price = (v: number | null, qty?: number | null) => (v === null ? '—' : Money.format(v, { symbol: false }) + (qty ? ` (${qty})` : ''));
    printReport({
      title: t('Product Catalogue', 'Orodha ya Bidhaa'),
      subtitle: this.selected().length ? t('Selected products', 'Bidhaa zilizochaguliwa') : undefined,
      headers: ['#', t('Product', 'Bidhaa'), t('Category', 'Kategoria'), ...TIERS.map((tier) => tier.short[lang]), t('Status', 'Hali')],
      rows: sorted.map((p, i) => [
        i + 1,
        p.displayName,
        p.categoryName ?? '',
        ...TIERS.map((tier) => price(p[tier.price], tier.qty ? p[tier.qty] : null)),
        HEALTH_META[this.healthOfRow(p)][lang],
      ]),
      summary: [
        [t('Products', 'Bidhaa'), list.length],
        [HEALTH_META.READY[lang], s.ready],
        [HEALTH_META.ISSUES[lang], s.issues],
        [HEALTH_META.NO_PRICE[lang], s.noPrice],
      ],
      numeric: [0, 3, 4, 5, 6],
    });
  }
}
