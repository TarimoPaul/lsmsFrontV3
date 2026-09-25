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
import { parseLocal } from '@shared/utils/date-utils';
import { downloadCsv, printReport } from '@shared/utils/export';
import { Money, MoneyPipe } from '@shared/utils/money';
import { CUSTOMER_TYPES, Customer, customerInitials } from './customers.models';
import { CustomersService } from './customers.service';
import { SettlementsPanel } from './settlements-panel';

type View = 'customers' | 'settlements';
type Filter = 'ALL' | 'OWING' | 'PAID_UP' | 'NO_SALES' | 'NEW' | 'TOP';

const DAY = 86_400_000;

/**
 * Customer management — port of Flutter `CustomerDashboard` (KPIs, tabs All /
 * Owing / Paid / Recent / Top / No sales, add / edit / delete / merge, details,
 * statement, export). v3 serves every tab from one cached list instead of one
 * request per tab; settlements are a separate server-paged view.
 */
@Component({
  selector: 'app-customers-page',
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
    SettlementsPanel,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './customers-page.html',
  styleUrl: './customers-page.scss',
})
export class CustomersPage {
  protected readonly auth = inject(AuthService);
  protected readonly i18n = inject(LanguageService);
  private readonly api = inject(CustomersService);
  private readonly dialogs = inject(DialogService);
  private readonly toast = inject(ToastService);

  private readonly table = viewChild<DataTable<Customer>>(DataTable);

  protected readonly customers = computed(() => this.api.list.value() ?? []);
  protected readonly loading = computed(() => this.api.list.initialLoading());
  protected readonly error = signal<string | null>(null);
  protected readonly view = signal<View>('customers');
  protected readonly search = signal('');
  protected readonly filter = signal<Filter>('ALL');
  protected readonly selected = signal<Customer[]>([]);

  protected readonly canUpdate = computed(() => this.auth.hasPermission('CUSTOMER_UPDATE'));
  protected readonly canDelete = computed(() => this.auth.hasPermission('CUSTOMER_DELETE'));
  protected readonly canCredit = computed(() => this.auth.hasPermission('CUSTOMER_CREDIT_VIEW'));
  protected readonly canMerge = computed(() => this.auth.hasPermission('CUSTOMER_MERGE'));

  protected readonly types = CUSTOMER_TYPES;
  protected readonly initials = customerInitials;
  protected readonly rowId = (c: Customer) => c.uid;
  protected readonly nameOf = (c: Customer) => c.name;
  protected readonly salesOf = (c: Customer) => c.salesCount;
  protected readonly spentOf = (c: Customer) => c.totalSpent;
  protected readonly owedOf = (c: Customer) => c.outstandingBalance;
  protected readonly sinceOf = (c: Customer) => c.createdAt ?? '';

  private readonly newSince = Date.now() - 30 * DAY;
  private isNew(c: Customer): boolean {
    const d = parseLocal(c.createdAt);
    return !!d && d.getTime() >= this.newSince;
  }

  protected readonly stats = computed(() => {
    const list = this.customers();
    const owing = list.filter((c) => c.outstandingBalance > 0);
    return {
      total: list.length,
      withSales: list.filter((c) => c.salesCount > 0).length,
      owed: owing.reduce((n, c) => n + c.outstandingBalance, 0),
      owing: owing.length,
      noSales: list.filter((c) => c.salesCount === 0).length,
      newCount: list.filter((c) => this.isNew(c)).length,
      revenue: list.reduce((n, c) => n + c.totalSpent, 0),
      top: [...list].sort((a, b) => b.totalSpent - a.totalSpent)[0] ?? null,
    };
  });

  protected readonly viewOptions = computed<SegmentOption<View>[]>(() => [
    { value: 'customers', label: this.i18n.t('Customers', 'Wateja'), icon: 'group', count: this.stats().total },
    { value: 'settlements', label: this.i18n.t('Settled debts', 'Madeni yaliyolipwa'), icon: 'task_alt' },
  ]);

  protected readonly filterOptions = computed<SegmentOption<Filter>[]>(() => {
    const s = this.stats();
    const t = (en: string, sw: string) => this.i18n.t(en, sw);
    return [
      { value: 'ALL', label: t('All', 'Wote'), count: s.total },
      { value: 'OWING', label: t('Owing', 'Wanaodaiwa'), icon: 'account_balance_wallet', count: s.owing },
      { value: 'PAID_UP', label: t('Paid up', 'Wamelipa'), icon: 'task_alt', count: s.withSales - s.owing },
      { value: 'TOP', label: t('Top spenders', 'Wanunuzi wakubwa'), icon: 'military_tech' },
      { value: 'NEW', label: t('New (30 days)', 'Wapya (siku 30)'), icon: 'person_add', count: s.newCount },
      { value: 'NO_SALES', label: t('No sales', 'Hawajanunua'), icon: 'remove_shopping_cart', count: s.noSales },
    ];
  });

  protected readonly rows = computed(() => {
    const q = this.search().trim().toLowerCase();
    const f = this.filter();
    let list = this.customers().filter((c) => {
      switch (f) {
        case 'OWING':
          if (c.outstandingBalance <= 0) return false;
          break;
        case 'PAID_UP':
          if (c.salesCount === 0 || c.outstandingBalance > 0) return false;
          break;
        case 'NO_SALES':
          if (c.salesCount > 0) return false;
          break;
        case 'NEW':
          if (!this.isNew(c)) return false;
          break;
      }
      if (!q) return true;
      return [c.name, c.phoneNumber ?? '', c.email ?? '', c.address ?? ''].some((x) => x.toLowerCase().includes(q));
    });
    if (f === 'TOP') list = [...list].sort((a, b) => b.totalSpent - a.totalSpent).slice(0, 20);
    return list;
  });

  protected readonly maxSpent = computed(() => Math.max(1, ...this.customers().map((c) => c.totalSpent)));

  constructor() {
    void this.refresh(false);
  }

  protected async refresh(force = true): Promise<void> {
    this.error.set(null);
    try {
      await this.api.list.load(force);
    } catch (e) {
      const err = ApiError.from(e);
      this.error.set(err.isForbidden ? this.i18n.t('You are not allowed to view customers.', 'Huruhusiwi kuona wateja.') : err.message);
    }
  }

  protected actions(c: Customer): MenuAction[] {
    const t = (en: string, sw: string) => this.i18n.t(en, sw);
    const list: MenuAction[] = [{ label: t('View details', 'Maelezo'), icon: 'visibility', run: () => void this.openDetails(c) }];
    if (this.canCredit() && c.salesCount > 0) list.push({ label: t('Statement', 'Taarifa ya akaunti'), icon: 'receipt_long', run: () => void this.openStatement(c) });
    if (this.canUpdate()) list.push({ label: t('Edit', 'Hariri'), icon: 'edit', run: () => void this.openForm(c) });
    if (this.canMerge()) list.push({ label: t('Merge into another…', 'Unganisha na mwingine…'), icon: 'merge_type', run: () => void this.openMerge(c) });
    if (this.canDelete()) {
      list.push({ label: t('Delete', 'Futa'), icon: 'delete', destructive: true, disabled: c.salesCount > 0, run: () => void this.remove(c) });
    }
    return list;
  }

  // ── Dialogs (lazy) ────────────────────────────────────────────────────────
  protected async openForm(customer?: Customer): Promise<void> {
    const { CustomerFormDialog } = await import('./customer-form-dialog');
    await this.dialogs.openAsync(CustomerFormDialog, { size: 'md', data: { customer, existing: this.customers() } });
  }

  protected async openDetails(customer: Customer): Promise<void> {
    const { CustomerDetailsDialog } = await import('./customer-details-dialog');
    const res = await this.dialogs.openAsync<'edit' | 'statement'>(CustomerDetailsDialog, { size: 'lg', data: { customer } });
    if (res === 'edit') await this.openForm(customer);
    else if (res === 'statement') await this.openStatement(customer);
  }

  protected async openStatement(customer: Customer): Promise<void> {
    const { CustomerStatementDialog } = await import('./customer-statement-dialog');
    await this.dialogs.openAsync(CustomerStatementDialog, { size: 'lg', data: { customer } });
  }

  protected async openMerge(source?: Customer): Promise<void> {
    const { CustomerMergeDialog } = await import('./customer-merge-dialog');
    await this.dialogs.openAsync(CustomerMergeDialog, { size: 'lg', data: { customers: this.customers(), source } });
  }

  protected async remove(c: Customer): Promise<void> {
    const ok = await this.dialogs.confirmDelete({
      title: this.i18n.t(`Delete ${c.name}?`, `Futa ${c.name}?`),
      message: this.i18n.t('This customer has no sales. This cannot be undone.', 'Mteja huyu hana mauzo. Kitendo hiki hakiwezi kurudishwa.'),
    });
    if (!ok) return;
    try {
      await this.api.remove(c.uid);
      this.toast.success(this.i18n.t(`${c.name} deleted`, `${c.name} amefutwa`));
    } catch (e) {
      this.toast.error(ApiError.from(e).message);
    }
  }

  protected async bulkDelete(): Promise<void> {
    const t = (en: string, sw: string) => this.i18n.t(en, sw);
    const picked = this.selected();
    const deletable = picked.filter((c) => c.salesCount === 0);
    if (!deletable.length) {
      await this.dialogs.error(t('Customers with sales cannot be deleted — merge duplicates instead.', 'Wateja wenye mauzo hawawezi kufutwa — unganisha nakala badala yake.'), t('Nothing to delete', 'Hakuna cha kufuta'));
      return;
    }
    const skipped = picked.length - deletable.length;
    const ok = await this.dialogs.confirmDelete({
      title: t(`Delete ${deletable.length} customer(s)?`, `Futa wateja ${deletable.length}?`),
      message: (skipped ? t(`${skipped} with sales will be skipped. `, `${skipped} wenye mauzo wataachwa. `) : '') + t('This cannot be undone.', 'Kitendo hiki hakiwezi kurudishwa.'),
      confirmText: t(`Delete ${deletable.length}`, `Futa ${deletable.length}`),
    });
    if (!ok) return;
    let done = 0;
    for (const c of deletable) {
      try {
        await this.api.remove(c.uid);
        done++;
      } catch {
        /* counted below */
      }
    }
    this.table()?.clearSelection();
    if (done) this.toast.success(t(`${done} customer(s) deleted`, `Wateja ${done} wamefutwa`));
    if (done < deletable.length) this.toast.error(t(`${deletable.length - done} could not be deleted`, `${deletable.length - done} hawakufutwa`));
  }

  protected clearSelection(): void {
    this.table()?.clearSelection();
  }

  protected export(format: ExportFormat): void {
    const t = (en: string, sw: string) => this.i18n.t(en, sw);
    const list = this.selected().length ? this.selected() : this.rows();
    if (!list.length) {
      this.toast.info(t('Nothing to export', 'Hakuna cha kuhamisha'));
      return;
    }
    const lang = this.i18n.lang();
    const headers = [t('Customer', 'Mteja'), t('Phone', 'Simu'), t('Type', 'Aina'), t('Sales', 'Mauzo'), t('Total spent', 'Jumla'), t('Owes', 'Deni')];
    const rows = list.map((c) => [c.name, c.phoneNumber ?? '', CUSTOMER_TYPES[c.customerType][lang], c.salesCount, c.totalSpent, c.outstandingBalance]);
    if (format === 'csv') {
      downloadCsv('customers', headers, rows);
      this.toast.success(t(`${list.length} customers exported`, `Wateja ${list.length} wamehamishwa`));
      return;
    }
    const owed = list.reduce((n, c) => n + c.outstandingBalance, 0);
    printReport({
      title: t('Customers', 'Wateja'),
      headers: ['#', ...headers],
      rows: rows.map((r, i) => [i + 1, ...r.map((v, j) => (j >= 4 && typeof v === 'number' ? Money.format(v, { symbol: false }) : v))]),
      summary: [
        [t('Customers', 'Wateja'), list.length],
        [t('Owing', 'Wanaodaiwa'), list.filter((c) => c.outstandingBalance > 0).length],
        [t('Total owed', 'Jumla ya madeni'), Money.format(owed)],
      ],
      numeric: [0, 4, 5, 6],
    });
  }
}
