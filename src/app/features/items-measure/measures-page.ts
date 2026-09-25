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
import { MeasureRef, Product } from '../products/products.models';
import { ProductsService } from '../products/products.service';
import { MeasuresService } from './measures.service';

type UsageFilter = 'ALL' | 'IN_USE' | 'UNUSED';

/**
 * Items Measure management — port of Flutter `ItemsMeasureDashboard` +
 * `ItemsMeasureTable` (stats, search, add / edit / delete). v3 changes:
 * product usage per measure replaces the Active/Inactive tabs (the backend
 * never stores `isActive`), delete is blocked while products use a measure,
 * plus details, bulk delete and CSV/PDF export.
 */
@Component({
  selector: 'app-measures-page',
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
  templateUrl: './measures-page.html',
  styleUrl: './measures-page.scss',
})
export class MeasuresPage {
  protected readonly auth = inject(AuthService);
  protected readonly i18n = inject(LanguageService);
  private readonly api = inject(MeasuresService);
  private readonly productsApi = inject(ProductsService);
  private readonly dialogs = inject(DialogService);
  private readonly toast = inject(ToastService);

  private readonly table = viewChild<DataTable<MeasureRef>>(DataTable);

  private readonly canReadProducts = this.auth.hasPermission('PRODUCT_READ');
  private readonly productsFailed = signal(false);
  protected readonly measures = computed(() => this.api.list.value() ?? []);
  protected readonly products = computed<Product[] | null>(() =>
    this.canReadProducts && !this.productsFailed() ? (this.productsApi.catalogue.value() ?? null) : null,
  );
  protected readonly loading = computed(() => this.api.list.initialLoading());
  protected readonly error = signal<string | null>(null);
  protected readonly busy = signal(false);

  protected readonly search = signal('');
  protected readonly usage = signal<UsageFilter>('ALL');
  protected readonly selected = signal<MeasureRef[]>([]);

  protected readonly canCreate = computed(() => this.auth.hasPermission('MEASURE_WRITE'));
  protected readonly canUpdate = computed(() => this.auth.hasPermission('MEASURE_UPDATE'));
  protected readonly canDelete = computed(() => this.auth.hasPermission('MEASURE_DELETE'));

  protected readonly rowId = (m: MeasureRef) => m.uid;
  protected readonly unitOf = (m: MeasureRef) => m.unitType;
  protected readonly packageOf = (m: MeasureRef) => m.packageType;
  protected readonly titleOf = (m: MeasureRef) => `${m.unitType} · ${m.packageType}`;
  protected readonly countOf = (m: MeasureRef) => this.productCount(m) ?? -1;

  /** measureUid → products using it */
  private readonly byMeasure = computed(() => {
    const map = new Map<string, Product[]>();
    for (const p of this.products() ?? []) {
      for (const uid of p.itemsMeasureUids) (map.get(uid) ?? map.set(uid, []).get(uid)!).push(p);
    }
    return map;
  });

  protected readonly maxCount = computed(() => Math.max(1, ...this.measures().map((m) => this.byMeasure().get(m.uid)?.length ?? 0)));

  protected readonly stats = computed(() => {
    const list = this.measures();
    const known = this.products() !== null;
    const used = known ? list.filter((m) => this.byMeasure().get(m.uid)?.length).length : null;
    return {
      total: list.length,
      used,
      unused: used === null ? null : list.length - used,
      packageTypes: new Set(list.map((m) => m.packageType.trim().toLowerCase()).filter(Boolean)).size,
      productsWithout: known ? (this.products() ?? []).filter((p) => !p.itemsMeasureUids.length).length : null,
    };
  });

  protected readonly usageOptions = computed<SegmentOption<UsageFilter>[]>(() => {
    const s = this.stats();
    const opts: SegmentOption<UsageFilter>[] = [{ value: 'ALL', label: this.i18n.t('All', 'Vyote'), count: s.total }];
    if (s.used !== null) {
      opts.push(
        { value: 'IN_USE', label: this.i18n.t('In use', 'Vinatumika'), icon: 'inventory_2', count: s.used },
        { value: 'UNUSED', label: this.i18n.t('Unused', 'Havitumiki'), icon: 'inbox', count: s.unused ?? 0 },
      );
    }
    return opts;
  });

  protected readonly rows = computed(() => {
    const q = this.search().trim().toLowerCase();
    const f = this.usage();
    return this.measures().filter((m) => {
      const n = this.byMeasure().get(m.uid)?.length ?? 0;
      if (f === 'IN_USE' && !n) return false;
      if (f === 'UNUSED' && n) return false;
      if (!q) return true;
      return [m.packageType, m.unitType, m.abbreviation ?? '', m.description ?? ''].some((x) => x.toLowerCase().includes(q));
    });
  });

  constructor() {
    void this.refresh(false);
  }

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
      this.error.set(err.isForbidden ? this.i18n.t('You are not allowed to view measures.', 'Huruhusiwi kuona vipimo.') : err.message);
    }
  }

  protected productCount(m: MeasureRef): number | null {
    return this.products() === null ? null : (this.byMeasure().get(m.uid)?.length ?? 0);
  }

  protected actions(m: MeasureRef): MenuAction[] {
    const t = (en: string, sw: string) => this.i18n.t(en, sw);
    const list: MenuAction[] = [{ label: t('View details', 'Maelezo'), icon: 'visibility', run: () => void this.openDetails(m) }];
    if (this.canUpdate()) list.push({ label: t('Edit', 'Hariri'), icon: 'edit', run: () => void this.openForm(m) });
    if (this.canDelete()) list.push({ label: t('Delete', 'Futa'), icon: 'delete', destructive: true, run: () => void this.remove(m) });
    return list;
  }

  protected async openForm(measure?: MeasureRef): Promise<void> {
    const { MeasureFormDialog } = await import('./measure-form-dialog');
    const saved = await this.dialogs.openAsync<boolean>(MeasureFormDialog, { size: 'md', data: { measure, existing: this.measures() } });
    // Product names embed the unit, so refresh the shared catalogue after an edit.
    if (saved && measure && this.canReadProducts) {
      this.productsApi.catalogue.invalidate();
      this.productsApi.catalogue.load().catch(() => undefined);
    }
  }

  protected async openDetails(measure: MeasureRef): Promise<void> {
    const { MeasureDetailsDialog } = await import('./measure-details-dialog');
    const res = await this.dialogs.openAsync<'edit'>(MeasureDetailsDialog, {
      size: 'md',
      data: { measure, products: this.products() === null ? null : (this.byMeasure().get(measure.uid) ?? []), canEdit: this.canUpdate() },
    });
    if (res === 'edit') await this.openForm(measure);
  }

  protected async remove(m: MeasureRef): Promise<void> {
    const n = this.productCount(m);
    const label = `${m.packageType} · ${m.unitType}`;
    if (n) {
      await this.dialogs.error(
        this.i18n.t(
          `"${label}" is used by ${n} product${n === 1 ? '' : 's'}. Change their measure first.`,
          `"${label}" kinatumiwa na bidhaa ${n}. Badilisha kipimo cha bidhaa hizo kwanza.`,
        ),
        this.i18n.t('Measure is in use', 'Kipimo kinatumika'),
      );
      return;
    }
    const ok = await this.dialogs.confirmDelete({
      title: this.i18n.t(`Delete "${label}"?`, `Futa "${label}"?`),
      message: this.i18n.t('No product uses this measure. This cannot be undone.', 'Hakuna bidhaa inayotumia kipimo hiki. Kitendo hiki hakiwezi kurudishwa.'),
    });
    if (!ok) return;
    try {
      await this.api.remove(m.uid);
      this.toast.success(this.i18n.t(`${label} deleted`, `${label} kimefutwa`));
    } catch (e) {
      this.toast.error(ApiError.from(e).message);
    }
  }

  protected async bulkDelete(): Promise<void> {
    const t = (en: string, sw: string) => this.i18n.t(en, sw);
    const picked = this.selected();
    const deletable = picked.filter((m) => !this.productCount(m));
    const blocked = picked.length - deletable.length;
    if (!deletable.length) {
      await this.dialogs.error(t('Every selected measure is used by products.', 'Vipimo vyote ulivyochagua vinatumiwa na bidhaa.'), t('Nothing to delete', 'Hakuna cha kufuta'));
      return;
    }
    const ok = await this.dialogs.confirmDelete({
      title: t(`Delete ${deletable.length} measure${deletable.length === 1 ? '' : 's'}?`, `Futa vipimo ${deletable.length}?`),
      message:
        (blocked ? t(`${blocked} in use will be skipped. `, `${blocked} vinavyotumika vitarukwa. `) : '') +
        t('This cannot be undone.', 'Kitendo hiki hakiwezi kurudishwa.'),
      confirmText: t(`Delete ${deletable.length}`, `Futa ${deletable.length}`),
    });
    if (!ok) return;
    this.busy.set(true);
    let done = 0;
    for (const m of deletable) {
      try {
        await this.api.remove(m.uid);
        done++;
      } catch {
        /* reported below */
      }
    }
    this.busy.set(false);
    this.table()?.clearSelection();
    if (done) this.toast.success(t(`${done} measure${done === 1 ? '' : 's'} deleted`, `Vipimo ${done} vimefutwa`));
    if (done < deletable.length) this.toast.error(t(`${deletable.length - done} could not be deleted`, `${deletable.length - done} havikufutwa`));
  }

  protected clearSelection(): void {
    this.table()?.clearSelection();
  }

  protected export(format: ExportFormat): void {
    const t = (en: string, sw: string) => this.i18n.t(en, sw);
    const list = [...(this.selected().length ? this.selected() : this.rows())];
    if (!list.length) {
      this.toast.info(t('Nothing to export', 'Hakuna cha kuhamisha'));
      return;
    }
    const withCounts = this.products() !== null;
    const headers = [t('Unit', 'Kipimo'), t('Package type', 'Aina'), t('Abbreviation', 'Kifupisho'), t('Description', 'Maelezo'), ...(withCounts ? [t('Products', 'Bidhaa')] : [])];
    const rows = list.map((m) => [m.unitType, m.packageType, m.abbreviation ?? '', m.description ?? '', ...(withCounts ? [this.productCount(m)] : [])]);
    if (format === 'csv') {
      downloadCsv('measures', headers, rows);
      this.toast.success(t(`${list.length} measures exported`, `Vipimo ${list.length} vimehamishwa`));
      return;
    }
    const s = this.stats();
    printReport({
      title: t('Items Measures', 'Vipimo vya Bidhaa'),
      headers: ['#', ...headers],
      rows: rows.map((r, i) => [i + 1, ...r]),
      summary: [
        [t('Measures', 'Vipimo'), list.length],
        ...(s.used !== null ? ([[t('In use', 'Vinatumika'), s.used]] as Array<[string, number]>) : []),
      ],
      numeric: withCounts ? [0, 5] : [0],
    });
  }
}
