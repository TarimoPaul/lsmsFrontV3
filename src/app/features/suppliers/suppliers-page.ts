import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';

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
import { Money, MoneyPipe } from '@shared/utils/money';
import { Supplier, creditUsage, supplierInitials } from './suppliers.models';
import { SuppliersService } from './suppliers.service';

type OwedFilter = 'ALL' | 'OWING' | 'SETTLED' | 'OVER_LIMIT';

/**
 * Supplier management — port of Flutter `SupplierManagementScreen` (list,
 * search, add / edit / delete, tap → AP statement + pay). v3 adds KPIs,
 * owed filters, credit-limit usage, export, and payment undo.
 */
@Component({
  selector: 'app-suppliers-page',
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
    MoneyPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './suppliers-page.html',
  styleUrl: './suppliers-page.scss',
})
export class SuppliersPage {
  protected readonly auth = inject(AuthService);
  protected readonly i18n = inject(LanguageService);
  private readonly api = inject(SuppliersService);
  private readonly dialogs = inject(DialogService);
  private readonly toast = inject(ToastService);

  protected readonly suppliers = computed(() => this.api.list.value() ?? []);
  protected readonly loading = computed(() => this.api.list.initialLoading());
  protected readonly error = signal<string | null>(null);
  protected readonly search = signal('');
  protected readonly owed = signal<OwedFilter>('ALL');

  protected readonly canUpdate = computed(() => this.auth.hasPermission('SUPPLIER_UPDATE'));
  protected readonly canDelete = computed(() => this.auth.hasPermission('SUPPLIER_DELETE'));
  protected readonly canStatement = computed(() => this.auth.hasPermission('SUPPLIER_PAYMENT_VIEW'));

  protected readonly rowId = (s: Supplier) => s.uid;
  protected readonly nameOf = (s: Supplier) => s.name;
  protected readonly owedOf = (s: Supplier) => s.outstanding;
  protected readonly termsOf = (s: Supplier) => s.paymentTermsDays;
  protected readonly limitOf = (s: Supplier) => s.creditLimit ?? -1;
  protected readonly initials = supplierInitials;
  protected readonly usage = creditUsage;

  protected readonly stats = computed(() => {
    const list = this.suppliers();
    const owing = list.filter((s) => s.outstanding > 0);
    return {
      total: list.length,
      owed: owing.reduce((n, s) => n + s.outstanding, 0),
      owing: owing.length,
      overLimit: list.filter((s) => (creditUsage(s) ?? 0) > 1).length,
      noContact: list.filter((s) => !s.phone && !s.email).length,
      top: [...owing].sort((a, b) => b.outstanding - a.outstanding)[0] ?? null,
    };
  });

  protected readonly options = computed<SegmentOption<OwedFilter>[]>(() => {
    const s = this.stats();
    const t = (en: string, sw: string) => this.i18n.t(en, sw);
    const opts: SegmentOption<OwedFilter>[] = [
      { value: 'ALL', label: t('All', 'Wote'), count: s.total },
      { value: 'OWING', label: t('We owe', 'Tunadaiwa'), icon: 'account_balance_wallet', count: s.owing },
      { value: 'SETTLED', label: t('Settled', 'Hakuna deni'), icon: 'task_alt', count: s.total - s.owing },
    ];
    if (s.overLimit) opts.push({ value: 'OVER_LIMIT', label: t('Over limit', 'Juu ya ukomo'), icon: 'warning', count: s.overLimit });
    return opts;
  });

  protected readonly rows = computed(() => {
    const q = this.search().trim().toLowerCase();
    const f = this.owed();
    return this.suppliers().filter((s) => {
      if (f === 'OWING' && s.outstanding <= 0) return false;
      if (f === 'SETTLED' && s.outstanding > 0) return false;
      if (f === 'OVER_LIMIT' && (creditUsage(s) ?? 0) <= 1) return false;
      if (!q) return true;
      return [s.name, s.phone ?? '', s.email ?? '', s.tin ?? '', s.address ?? ''].some((x) => x.toLowerCase().includes(q));
    });
  });

  constructor() {
    void this.refresh(false);
  }

  protected async refresh(force = true): Promise<void> {
    this.error.set(null);
    try {
      await this.api.list.load(force);
    } catch (e) {
      const err = ApiError.from(e);
      this.error.set(err.isForbidden ? this.i18n.t('You are not allowed to view suppliers.', 'Huruhusiwi kuona wasambazaji.') : err.message);
    }
  }

  protected actions(s: Supplier): MenuAction[] {
    const t = (en: string, sw: string) => this.i18n.t(en, sw);
    const list: MenuAction[] = [];
    if (this.canStatement()) list.push({ label: t('Statement & payments', 'Taarifa na malipo'), icon: 'receipt_long', run: () => void this.openStatement(s) });
    if (this.canUpdate()) list.push({ label: t('Edit', 'Hariri'), icon: 'edit', run: () => void this.openForm(s) });
    if (this.canDelete()) list.push({ label: t('Delete', 'Futa'), icon: 'delete', destructive: true, run: () => void this.remove(s) });
    return list;
  }

  protected async rowClick(s: Supplier): Promise<void> {
    if (this.canStatement()) await this.openStatement(s);
    else if (this.canUpdate()) await this.openForm(s);
  }

  protected async openForm(supplier?: Supplier): Promise<void> {
    const { SupplierFormDialog } = await import('./supplier-form-dialog');
    await this.dialogs.openAsync(SupplierFormDialog, { size: 'md', data: { supplier, existing: this.suppliers() } });
  }

  protected async openStatement(supplier: Supplier): Promise<void> {
    const { SupplierStatementDialog } = await import('./supplier-statement-dialog');
    await this.dialogs.openAsync(SupplierStatementDialog, { size: 'lg', data: { supplier } });
  }

  protected async remove(s: Supplier): Promise<void> {
    const ok = await this.dialogs.confirmDelete({
      title: this.i18n.t(`Delete ${s.name}?`, `Futa ${s.name}?`),
      message:
        (s.outstanding > 0
          ? this.i18n.t(`You still owe ${Money.format(s.outstanding)}. `, `Bado unadaiwa ${Money.format(s.outstanding)}. `)
          : '') +
        this.i18n.t('Past purchases stay linked to this supplier.', 'Manunuzi ya zamani yatabaki yameunganishwa na msambazaji huyu.'),
    });
    if (!ok) return;
    try {
      await this.api.remove(s.uid);
      this.toast.success(this.i18n.t(`${s.name} deleted`, `${s.name} amefutwa`));
    } catch (e) {
      this.toast.error(ApiError.from(e).message);
    }
  }

  protected export(format: ExportFormat): void {
    const t = (en: string, sw: string) => this.i18n.t(en, sw);
    const list = this.rows();
    if (!list.length) {
      this.toast.info(t('Nothing to export', 'Hakuna cha kuhamisha'));
      return;
    }
    const headers = [t('Supplier', 'Msambazaji'), t('Phone', 'Simu'), t('Email', 'Barua pepe'), 'TIN', t('Terms (days)', 'Muda (siku)'), t('Credit limit', 'Ukomo'), t('Owed', 'Deni')];
    const rows = list.map((s) => [s.name, s.phone ?? '', s.email ?? '', s.tin ?? '', s.paymentTermsDays, s.creditLimit ?? '', s.outstanding]);
    if (format === 'csv') {
      downloadCsv('suppliers', headers, rows);
      this.toast.success(t(`${list.length} suppliers exported`, `Wasambazaji ${list.length} wamehamishwa`));
      return;
    }
    const s = this.stats();
    printReport({
      title: t('Suppliers', 'Wasambazaji'),
      headers: ['#', ...headers],
      rows: rows.map((r, i) => [i + 1, ...r.map((v, j) => (j >= 5 && typeof v === 'number' ? Money.format(v, { symbol: false }) : v))]),
      summary: [
        [t('Suppliers', 'Wasambazaji'), list.length],
        [t('Total owed', 'Jumla ya deni'), Money.format(s.owed)],
        [t('We owe', 'Tunadaiwa'), s.owing],
      ],
      numeric: [0, 5, 6, 7],
    });
  }
}
