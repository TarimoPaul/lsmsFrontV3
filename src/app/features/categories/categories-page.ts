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
  TableColumn,
  ToastService,
} from '@shared/ui';
import { downloadCsv, printReport } from '@shared/utils/export';
import { CategoriesService } from './categories.service';
import { Product } from '../products/products.models';
import { ProductsService } from '../products/products.service';
import { Category, CategoryFilter, categoryColor, categoryInitials } from './categories.models';
import { CategoryDetailsData, CategoryDetailsDialog, CategoryDetailsResult } from './category-details-dialog';
import { CategoryFormData, CategoryFormDialog } from './category-form-dialog';

/**
 * Category Management — port of Flutter `CategoryDashboard` +
 * `CategoryDisplayTable` (stats, search, quick filters, add / edit / details /
 * delete, bulk delete / export) with v3 changes:
 * - product counts per category replace the Active/Inactive status, which the
 *   backend never stores (Flutter's toggle silently did nothing);
 * - delete is blocked while a category still has products, because the
 *   backend hard-deletes with cascade to products;
 * - exports really download (CSV) or print (PDF).
 */
@Component({
  selector: 'app-categories-page',
  imports: [
    CanDirective,
    PageHeader,
    Button,
    MetricCard,
    MetricsGrid,
    FilterPanel,
    SegmentedFilterBar,
    DataTable,
    TableColumn,
    ActionMenu,
    ExportToolbar,
    EmptyState,
    Icon,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './categories-page.html',
  styleUrl: './categories-page.scss',
})
export class CategoriesPage {
  protected readonly auth = inject(AuthService);
  protected readonly i18n = inject(LanguageService);
  private readonly api = inject(CategoriesService);
  private readonly productsApi = inject(ProductsService);
  private readonly dialogs = inject(DialogService);
  private readonly toast = inject(ToastService);

  private readonly table = viewChild<DataTable<Category>>(DataTable);

  /** Shared caches: revisiting the page renders instantly, then refreshes quietly. */
  private readonly canReadProducts = this.auth.hasPermission('PRODUCT_READ');
  protected readonly categories = computed(() => this.api.list.value() ?? []);
  /** null = products not readable (no PRODUCT_READ) or failed to load. */
  protected readonly products = computed<Product[] | null>(() =>
    this.canReadProducts && !this.productsFailed() ? (this.productsApi.catalogue.value() ?? null) : null,
  );
  private readonly productsFailed = signal(false);
  protected readonly loading = computed(() => this.api.list.initialLoading());
  protected readonly error = signal<string | null>(null);
  protected readonly busy = signal(false);

  protected readonly search = signal('');
  protected readonly filter = signal<CategoryFilter>('ALL');
  protected readonly selected = signal<Category[]>([]);

  protected readonly canCreate = computed(() => this.auth.hasPermission('CATEGORY_WRITE'));
  protected readonly canUpdate = computed(() => this.auth.hasPermission('CATEGORY_UPDATE'));
  protected readonly canDelete = computed(() => this.auth.hasPermission('CATEGORY_DELETE'));

  protected readonly rowId = (c: Category) => c.uid;
  protected readonly nameOf = (c: Category) => c.categoryName;
  protected readonly descriptionOf = (c: Category) => c.description ?? '';
  protected readonly countOf = (c: Category) => this.productCount(c) ?? -1;
  protected readonly color = categoryColor;
  protected readonly initials = categoryInitials;

  /** categoryUid → products */
  private readonly byCategory = computed(() => {
    const map = new Map<string, Product[]>();
    for (const p of this.products() ?? []) {
      if (!p.categoryUid) continue;
      (map.get(p.categoryUid) ?? map.set(p.categoryUid, []).get(p.categoryUid)!).push(p);
    }
    return map;
  });

  protected readonly stats = computed(() => {
    const cats = this.categories();
    const known = this.products() !== null;
    const empty = known ? cats.filter((c) => !this.byCategory().get(c.uid)?.length).length : null;
    const categorised = known ? cats.reduce((n, c) => n + (this.byCategory().get(c.uid)?.length ?? 0), 0) : null;
    return {
      total: cats.length,
      categorised,
      empty,
      noDescription: cats.filter((c) => !c.description).length,
    };
  });

  /** Largest categories first, for the product-mix bar. */
  protected readonly mix = computed(() => {
    if (this.products() === null) return [];
    const total = this.stats().categorised || 1;
    return this.categories()
      .map((c) => ({ category: c, count: this.byCategory().get(c.uid)?.length ?? 0 }))
      .filter((r) => r.count > 0)
      .sort((a, b) => b.count - a.count)
      .map((r) => ({ ...r, pct: Math.round((r.count / total) * 100), color: categoryColor(r.category.categoryName) }));
  });

  protected readonly maxCount = computed(() => Math.max(1, ...this.mix().map((m) => m.count)));

  protected readonly filterOptions = computed<SegmentOption<CategoryFilter>[]>(() => {
    const s = this.stats();
    const t = (en: string, sw: string) => this.i18n.t(en, sw);
    const opts: SegmentOption<CategoryFilter>[] = [{ value: 'ALL', label: t('All', 'Zote'), count: s.total }];
    if (s.empty !== null) {
      opts.push(
        { value: 'WITH_PRODUCTS', label: t('With products', 'Zenye bidhaa'), icon: 'inventory_2', count: s.total - s.empty },
        { value: 'EMPTY', label: t('Empty', 'Tupu'), icon: 'inbox', count: s.empty },
      );
    }
    opts.push({ value: 'NO_DESCRIPTION', label: t('No description', 'Bila maelezo'), icon: 'notes', count: s.noDescription });
    return opts;
  });

  protected readonly rows = computed(() => {
    const q = this.search().trim().toLowerCase();
    const f = this.filter();
    return this.categories().filter((c) => {
      if (q && !c.categoryName.toLowerCase().includes(q) && !(c.description ?? '').toLowerCase().includes(q)) return false;
      const n = this.byCategory().get(c.uid)?.length ?? 0;
      switch (f) {
        case 'WITH_PRODUCTS':
          return n > 0;
        case 'EMPTY':
          return n === 0;
        case 'NO_DESCRIPTION':
          return !c.description;
        default:
          return true;
      }
    });
  });

  constructor() {
    void this.refresh(false);
  }

  /** `force` = header refresh button; otherwise cached data is reused while fresh. */
  protected async refresh(force = true): Promise<void> {
    this.error.set(null);
    if (this.canReadProducts) {
      this.productsApi.catalogue.load(force).then(
        () => this.productsFailed.set(false),
        () => this.productsFailed.set(true),
      );
    }
    try {
      await this.api.list.load(force);
    } catch (e) {
      const err = ApiError.from(e);
      this.error.set(
        err.isForbidden ? this.i18n.t('You are not allowed to view categories.', 'Huruhusiwi kuona kategoria.') : err.message,
      );
    }
  }

  protected productCount(c: Category): number | null {
    return this.products() === null ? null : (this.byCategory().get(c.uid)?.length ?? 0);
  }

  protected actions(c: Category): MenuAction[] {
    const t = (en: string, sw: string) => this.i18n.t(en, sw);
    const list: MenuAction[] = [{ label: t('View details', 'Maelezo'), icon: 'visibility', run: () => void this.openDetails(c) }];
    if (this.canUpdate()) list.push({ label: t('Edit', 'Hariri'), icon: 'edit', run: () => void this.openForm(c) });
    if (this.canDelete()) {
      list.push({ label: t('Delete', 'Futa'), icon: 'delete', destructive: true, run: () => void this.remove(c) });
    }
    return list;
  }

  // ── Dialogs ───────────────────────────────────────────────────────────────
  protected async openForm(category?: Category): Promise<void> {
    const saved = await this.dialogs.openAsync<Category | true, CategoryFormData>(CategoryFormDialog, {
      size: 'md',
      data: { category, existing: this.categories() },
    });
    // The service already patched the cache; only refetch if it could not.
    if (saved === true) await this.refresh();
  }

  protected async openDetails(category: Category): Promise<void> {
    const res = await this.dialogs.openAsync<CategoryDetailsResult, CategoryDetailsData>(CategoryDetailsDialog, {
      size: 'md',
      data: {
        category,
        products: this.products() === null ? null : (this.byCategory().get(category.uid) ?? []),
        canEdit: this.canUpdate(),
      },
    });
    if (res === 'edit') await this.openForm(category);
  }

  // ── Delete ────────────────────────────────────────────────────────────────
  protected async remove(c: Category): Promise<void> {
    const n = this.productCount(c);
    if (n) {
      await this.dialogs.error(
        this.i18n.t(
          `"${c.categoryName}" still has ${n} product${n === 1 ? '' : 's'}. Move them to another category first — deleting it would remove those products too.`,
          `"${c.categoryName}" bado ina bidhaa ${n}. Hamishia bidhaa hizo kategoria nyingine kwanza — kuifuta kungefuta bidhaa hizo pia.`,
        ),
        this.i18n.t('Category is in use', 'Kategoria inatumika'),
      );
      return;
    }
    const ok = await this.dialogs.confirmDelete({
      title: this.i18n.t(`Delete "${c.categoryName}"?`, `Futa "${c.categoryName}"?`),
      message:
        n === 0
          ? this.i18n.t('This category has no products. This cannot be undone.', 'Kategoria hii haina bidhaa. Kitendo hiki hakiwezi kurudishwa.')
          : this.i18n.t(
              'Any products in this category will be deleted with it. This cannot be undone.',
              'Bidhaa zozote za kategoria hii zitafutwa pamoja nayo. Kitendo hiki hakiwezi kurudishwa.',
            ),
    });
    if (!ok) return;
    try {
      await this.api.remove(c.uid);
      this.toast.success(this.i18n.t(`${c.categoryName} deleted`, `${c.categoryName} imefutwa`));
    } catch (e) {
      this.toast.error(ApiError.from(e).message);
    }
  }

  protected async bulkDelete(): Promise<void> {
    const picked = this.selected();
    const deletable = picked.filter((c) => !this.productCount(c));
    const blocked = picked.length - deletable.length;
    const t = (en: string, sw: string) => this.i18n.t(en, sw);
    if (!deletable.length) {
      await this.dialogs.error(
        t(
          'Every selected category still has products. Move the products first.',
          'Kategoria zote ulizochagua bado zina bidhaa. Hamisha bidhaa kwanza.',
        ),
        t('Nothing to delete', 'Hakuna cha kufuta'),
      );
      return;
    }
    const ok = await this.dialogs.confirmDelete({
      title: t(`Delete ${deletable.length} categor${deletable.length === 1 ? 'y' : 'ies'}?`, `Futa kategoria ${deletable.length}?`),
      message:
        (blocked
          ? t(
              `${blocked} selected categor${blocked === 1 ? 'y has' : 'ies have'} products and will be skipped. `,
              `Kategoria ${blocked} zina bidhaa na zitarukwa. `,
            )
          : '') + t('This cannot be undone.', 'Kitendo hiki hakiwezi kurudishwa.'),
      confirmText: t(`Delete ${deletable.length}`, `Futa ${deletable.length}`),
    });
    if (!ok) return;

    this.busy.set(true);
    let done = 0;
    const failed: string[] = [];
    for (const c of deletable) {
      try {
        await this.api.remove(c.uid);
        done++;
      } catch {
        failed.push(c.categoryName);
      }
    }
    this.busy.set(false);
    if (done) this.toast.success(t(`${done} categor${done === 1 ? 'y' : 'ies'} deleted`, `Kategoria ${done} zimefutwa`));
    if (failed.length) this.toast.error(t(`Could not delete: ${failed.join(', ')}`, `Imeshindikana kufuta: ${failed.join(', ')}`));
    this.clearSelection();
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
    const withCounts = this.products() !== null;
    const headers = [t('Category', 'Kategoria'), t('Description', 'Maelezo'), ...(withCounts ? [t('Products', 'Bidhaa')] : [])];
    const rows = [...list]
      .sort((a, b) => a.categoryName.localeCompare(b.categoryName))
      .map((c) => [c.categoryName, c.description ?? '', ...(withCounts ? [this.productCount(c)] : [])]);

    if (format === 'csv') {
      downloadCsv('categories', headers, rows);
      this.toast.success(t(`${list.length} categories exported`, `Kategoria ${list.length} zimehamishwa`));
      return;
    }
    const summary: Array<[string, string | number]> = [[t('Categories', 'Kategoria'), list.length]];
    if (withCounts) {
      summary.push([t('Products', 'Bidhaa'), list.reduce((n, c) => n + (this.productCount(c) ?? 0), 0)]);
      summary.push([t('Empty', 'Tupu'), list.filter((c) => !this.productCount(c)).length]);
    }
    printReport({
      title: t('Product Categories', 'Kategoria za Bidhaa'),
      subtitle: this.selected().length ? t('Selected categories', 'Kategoria zilizochaguliwa') : undefined,
      headers: ['#', ...headers],
      rows: rows.map((r, i) => [i + 1, ...r]),
      summary,
      numeric: withCounts ? [0, 3] : [0],
    });
  }

  protected showFilter(f: CategoryFilter): void {
    this.filter.set(f);
  }
}
