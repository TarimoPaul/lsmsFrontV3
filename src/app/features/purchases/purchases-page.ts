import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal, viewChild } from '@angular/core';
import { Router } from '@angular/router';

import { ApiError } from '@core/api/api.types';
import { AuthService } from '@core/auth/auth.service';
import { CanDirective } from '@core/auth/can.directive';
import { LanguageService } from '@core/i18n/language.service';
import {
  ActionMenu,
  Button,
  DataTable,
  DateRangeSelector,
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
import { DateRange, formatRangeLabel, parseLocal, rangeForPreset, toLocalDateTime } from '@shared/utils/date-utils';
import { downloadCsv, printReport } from '@shared/utils/export';
import { Money, MoneyPipe } from '@shared/utils/money';
import { StoreService } from '../store/store.service';
import { SuppliersService } from '../suppliers/suppliers.service';
import type { BulkStep, PurchaseBulkData } from './purchase-bulk-dialog';
import type { PurchaseDetailsResult } from './purchase-details-dialog';
import type { PurchaseFormResult } from './purchase-form-dialog';
import { PURCHASE_STATUS, Purchase, PurchaseStatus } from './purchases.models';
import { PurchasesService } from './purchases.service';
import { RepurchaseCartStore } from './repurchase/repurchase-cart.store';

const PAGE = 50;
type Filter = 'ALL' | PurchaseStatus;

/**
 * Purchases — port of Flutter `PurchaseManagementScreen` (list, add,
 * approve → receive, cancel). The list shows the latest purchases (server
 * paged) or a chosen period; pending / approved ones are always merged in so
 * the work queue is never hidden behind paging. Search and status filters are
 * client-side because the backend's search endpoints fail.
 */
@Component({
  selector: 'app-purchases-page',
  imports: [
    CanDirective,
    PageHeader,
    Button,
    MetricCard,
    MetricsGrid,
    FilterPanel,
    SegmentedFilterBar,
    DateRangeSelector,
    DataTable,
    TableColumn,
    ActionMenu,
    ExportToolbar,
    EmptyState,
    Icon,
    MoneyPipe,
    DatePipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './purchases-page.html',
  styleUrl: './purchases-page.scss',
})
export class PurchasesPage {
  protected readonly auth = inject(AuthService);
  protected readonly i18n = inject(LanguageService);
  private readonly api = inject(PurchasesService);
  private readonly suppliersApi = inject(SuppliersService);
  private readonly store = inject(StoreService);
  private readonly dialogs = inject(DialogService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  /** For the item count on the Repurchase button. */
  protected readonly repurchaseCart = inject(RepurchaseCartStore);

  // Latest (paged) mode.
  private readonly latest = signal<Purchase[]>([]);
  protected readonly page = signal(-1);
  protected readonly pages = signal(1);
  protected readonly total = signal<number | null>(null);
  // Work queue (always loaded).
  private readonly queue = signal<Purchase[]>([]);
  // Period mode (null = latest).
  protected readonly range = signal<DateRange | null>(null);
  protected readonly defaultRange = rangeForPreset('thisMonth');
  private readonly periodItems = signal<Purchase[]>([]);
  /** This month, for the spend KPI while in latest mode. */
  private readonly monthItems = signal<Purchase[] | null>(null);

  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly search = signal('');
  protected readonly filter = signal<Filter>('ALL');

  protected readonly canUpdate = computed(() => this.auth.hasPermission('PURCHASE_UPDATE'));
  protected readonly canDelete = computed(() => this.auth.hasPermission('PURCHASE_DELETE'));
  protected readonly canWrite = computed(() => this.auth.hasPermission('PURCHASE_WRITE'));
  protected readonly canApprove = computed(() => this.auth.hasPermission('PURCHASE_APPROVE'));
  protected readonly canReceive = computed(() => this.auth.hasPermission('PURCHASE_RECEIVE'));
  protected readonly canCancel = computed(() => this.auth.hasPermission('PURCHASE_CANCEL'));
  protected readonly canBulk = computed(() => this.canApprove() || this.canReceive() || this.canCancel());

  // Bulk selection (Flutter PurchaseTable bulk bar): tick rows → approve / receive / cancel them together.
  private readonly table = viewChild<DataTable<Purchase>>(DataTable);
  protected readonly selected = signal<Purchase[]>([]);
  protected readonly bulk = computed(() => {
    const sel = this.selected();
    const pending = sel.filter((p) => p.status === 'PENDING');
    const approved = sel.filter((p) => p.status === 'APPROVED');
    return { pending, approved, open: [...pending, ...approved], closed: sel.length - pending.length - approved.length };
  });

  protected readonly rowId = (p: Purchase) => p.uid;
  protected readonly nameOf = (p: Purchase) => p.productName;
  protected readonly dateOf = (p: Purchase) => p.purchaseDate ?? '';
  protected readonly totalOf = (p: Purchase) => p.totalCost;
  protected readonly cppOf = (p: Purchase) => p.costPerPiece ?? 0;
  protected readonly supOf = (p: Purchase) => p.supplierName ?? '';

  /** What the table works on: period results, or latest + queue (deduped). */
  protected readonly items = computed(() => {
    if (this.range()) return this.periodItems();
    const seen = new Set<string>();
    const out: Purchase[] = [];
    for (const p of [...this.queue(), ...this.latest()]) {
      if (seen.has(p.uid)) continue;
      seen.add(p.uid);
      out.push(p);
    }
    return out.sort((a, b) => (b.purchaseDate ?? '').localeCompare(a.purchaseDate ?? ''));
  });

  protected readonly periodLabel = computed(() => {
    const r = this.range();
    return r ? formatRangeLabel(r) : this.i18n.t('This month', 'Mwezi huu');
  });

  protected readonly stats = computed(() => {
    const q = this.queue();
    const spendList = this.range() ? this.periodItems() : this.monthItems();
    const live = (spendList ?? []).filter((p) => p.status !== 'CANCELLED');
    const suppliers = this.suppliersApi.list.value() ?? [];
    return {
      pending: q.filter((p) => p.status === 'PENDING').length,
      approved: q.filter((p) => p.status === 'APPROVED').length,
      spend: spendList ? live.reduce((n, p) => n + p.totalCost, 0) : null,
      spendCount: live.length,
      owedToSuppliers: suppliers.length ? suppliers.reduce((n, s) => n + s.outstanding, 0) : null,
      owing: suppliers.filter((s) => s.outstanding > 0).length,
    };
  });

  protected readonly options = computed<SegmentOption<Filter>[]>(() => {
    const list = this.items();
    const t = (en: string, sw: string) => this.i18n.t(en, sw);
    const n = (s: PurchaseStatus) => list.filter((p) => p.status === s).length;
    const opts: SegmentOption<Filter>[] = [{ value: 'ALL', label: t('All', 'Yote'), count: list.length }];
    for (const s of ['PENDING', 'APPROVED', 'RECEIVED', 'CANCELLED'] as PurchaseStatus[]) {
      const c = n(s);
      if (c || s === 'PENDING' || s === 'RECEIVED') opts.push({ value: s, label: this.i18n.isSwahili() ? PURCHASE_STATUS[s].sw : PURCHASE_STATUS[s].en, icon: PURCHASE_STATUS[s].icon, count: c });
    }
    return opts;
  });

  protected readonly rows = computed(() => {
    const q = this.search().trim().toLowerCase();
    const f = this.filter();
    return this.items().filter((p) => {
      if (f !== 'ALL' && p.status !== f) return false;
      if (!q) return true;
      return [p.productName, p.categoryName ?? '', p.supplierName ?? '', p.reference ?? '', p.notes ?? ''].some((x) => x.toLowerCase().includes(q));
    });
  });

  constructor() {
    void this.refresh();
    void this.suppliersApi.list.load().catch(() => undefined);
  }

  protected async refresh(): Promise<void> {
    this.error.set(null);
    void this.loadQueue();
    if (this.range()) await this.loadPeriod(this.range()!);
    else {
      void this.loadMonth();
      await this.reloadLatest();
    }
  }

  private async reloadLatest(): Promise<void> {
    this.latest.set([]);
    this.page.set(-1);
    await this.loadMore();
  }

  protected async loadMore(): Promise<void> {
    const next = this.page() + 1;
    this.loading.set(true);
    try {
      const res = await this.api.page(next, PAGE);
      this.latest.update((l) => [...l, ...res.items]);
      this.page.set(next);
      this.pages.set(res.pages);
      this.total.set(res.total);
    } catch (e) {
      this.fail(e);
    } finally {
      this.loading.set(false);
    }
  }

  private async loadQueue(): Promise<void> {
    try {
      const [p, a] = await Promise.all([this.api.byStatus('PENDING'), this.api.byStatus('APPROVED')]);
      this.queue.set([...p, ...a]);
    } catch {
      // The table still works; the queue KPIs just stay at zero.
    }
  }

  private async loadMonth(): Promise<void> {
    try {
      const r = rangeForPreset('thisMonth');
      this.monthItems.set(await this.api.byDateRange(toLocalDateTime(r.start), toLocalDateTime(r.end)));
    } catch {
      this.monthItems.set(null);
    }
  }

  private async loadPeriod(r: DateRange): Promise<void> {
    this.loading.set(true);
    try {
      this.periodItems.set(await this.api.byDateRange(toLocalDateTime(r.start), toLocalDateTime(r.end)));
    } catch (e) {
      this.fail(e);
    } finally {
      this.loading.set(false);
    }
  }

  private fail(e: unknown): void {
    const err = ApiError.from(e);
    this.error.set(err.isForbidden ? this.i18n.t('You are not allowed to view purchases.', 'Huruhusiwi kuona manunuzi.') : err.message);
  }

  protected setRange(r: DateRange | null): void {
    this.range.set(r);
    this.filter.set('ALL');
    this.periodItems.set([]);
    void this.refresh();
  }

  protected showQueue(s: PurchaseStatus): void {
    if (this.range()) this.setRange(null);
    this.filter.set(s);
  }

  protected status(p: Purchase) {
    return PURCHASE_STATUS[p.status];
  }

  protected date(v: string | null): Date | null {
    return parseLocal(v);
  }

  protected actions(p: Purchase): MenuAction[] {
    const t = (en: string, sw: string) => this.i18n.t(en, sw);
    const list: MenuAction[] = [{ label: t('View details', 'Angalia taarifa'), icon: 'visibility', run: () => void this.openDetails(p.uid, p) }];
    if (p.status === 'PENDING' && this.canUpdate()) list.push({ label: t('Edit', 'Hariri'), icon: 'edit', run: () => void this.openForm({ purchase: p }) });
    if ((p.status === 'RECEIVED' || p.status === 'CANCELLED') && this.canWrite()) list.push({ label: t('Buy again', 'Nunua tena'), icon: 'replay', run: () => void this.buyAgain(p) });
    if (p.status === 'PENDING' && this.canDelete()) list.push({ label: t('Delete', 'Futa'), icon: 'delete', destructive: true, run: () => void this.remove(p) });
    return list;
  }

  protected async openForm(data: { purchase?: Purchase; productUid?: string } = {}): Promise<void> {
    const { PurchaseFormDialog } = await import('./purchase-form-dialog');
    const res = await this.dialogs.openAsync<PurchaseFormResult>(PurchaseFormDialog, { size: 'lg', disableClose: true, data });
    if (res === true) this.changed();
    else if (res && 'repurchase' in res) this.repurchase(res.repurchase);
    else if (res && 'open' in res) await this.openDetails(res.open);
  }

  /** Open Repurchase, optionally with a product already added to the order. */
  protected repurchase(productUid?: string): void {
    void this.router.navigate(['/purchases/repurchase'], { queryParams: productUid ? { add: productUid } : {} });
  }

  /** A received product is re-ordered through Repurchase; a cancelled-only one may still be a first purchase. */
  private async buyAgain(p: Purchase): Promise<void> {
    if (p.status === 'RECEIVED') this.repurchase(p.productUid);
    else await this.openForm({ productUid: p.productUid });
  }

  protected async openDetails(uid: string, purchase?: Purchase): Promise<void> {
    const { PurchaseDetailsDialog } = await import('./purchase-details-dialog');
    const res = await this.dialogs.openAsync<PurchaseDetailsResult>(PurchaseDetailsDialog, { size: 'lg', data: { uid, purchase } });
    if (res === 'changed') this.changed();
    else if (res === 'edit') {
      const fresh = this.items().find((p) => p.uid === uid) ?? purchase ?? (await this.api.get(uid).catch(() => undefined));
      if (fresh) await this.openForm({ purchase: fresh });
    } else if (res === 'buy') {
      const p = this.items().find((x) => x.uid === uid) ?? purchase ?? (await this.api.get(uid).catch(() => undefined));
      if (p) await this.buyAgain(p);
    }
  }

  /** A purchase was saved / moved: refresh the list and the caches that depend on it. */
  private changed(): void {
    this.store.stock.invalidate();
    this.store.insights.invalidate();
    this.suppliersApi.list.invalidate();
    void this.suppliersApi.list.load().catch(() => undefined);
    void this.refresh();
  }

  protected clearSelection(): void {
    this.table()?.clearSelection();
  }

  protected async runBulk(step: BulkStep): Promise<void> {
    const b = this.bulk();
    const purchases = step === 'receive' ? b.approved : step === 'cancel' ? b.open : b.pending;
    if (!purchases.length) return;
    const { PurchaseBulkDialog } = await import('./purchase-bulk-dialog');
    const data: PurchaseBulkData = { step, purchases };
    const res = await this.dialogs.openAsync<'changed'>(PurchaseBulkDialog, { size: 'md', disableClose: true, data });
    if (res === 'changed') {
      this.clearSelection();
      this.changed();
    }
  }

  protected async remove(p: Purchase): Promise<void> {
    const ok = await this.dialogs.confirmDelete({
      title: this.i18n.t('Delete this purchase?', 'Futa manunuzi haya?'),
      message: this.i18n.t(`The pending purchase of ${p.productName} will be removed. Stock is not affected.`, `Manunuzi yanayosubiri ya ${p.productName} yataondolewa. Mzigo hauathiriki.`),
    });
    if (!ok) return;
    try {
      await this.api.remove(p.uid);
      this.toast.success(this.i18n.t('Purchase deleted', 'Manunuzi yamefutwa'));
      this.changed();
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
    const headers = [t('Date', 'Tarehe'), t('Product', 'Bidhaa'), t('Category', 'Kundi'), t('Supplier', 'Msambazaji'), t('Quantity', 'Idadi'), t('Pieces', 'Vipande'), t('Cost/piece', 'Gharama/kipande'), t('Total', 'Jumla'), t('Status', 'Hali')];
    const rows = list.map((p) => [
      (p.purchaseDate ?? '').replace('T', ' ').slice(0, 16),
      p.productName,
      p.categoryName ?? '',
      p.supplierName ?? '',
      p.quantityDisplay ?? p.quantity,
      p.totalPieces ?? '',
      p.costPerPiece ?? '',
      p.totalCost,
      this.i18n.isSwahili() ? PURCHASE_STATUS[p.status].sw : PURCHASE_STATUS[p.status].en,
    ]);
    if (format === 'csv') {
      downloadCsv('purchases', headers, rows);
      this.toast.success(t(`${list.length} purchases exported`, `Manunuzi ${list.length} yamehamishwa`));
      return;
    }
    const live = list.filter((p) => p.status !== 'CANCELLED');
    printReport({
      title: t('Purchases', 'Manunuzi'),
      subtitle: this.range() ? this.periodLabel() : t('Latest purchases', 'Manunuzi ya karibuni'),
      headers: ['#', ...headers],
      rows: rows.map((r, i) => [i + 1, ...r.map((v, j) => (j >= 6 && j <= 7 && typeof v === 'number' ? Money.format(v, { symbol: false }) : v))]),
      summary: [
        [t('Purchases', 'Manunuzi'), list.length],
        [t('Total cost', 'Gharama yote'), Money.format(live.reduce((n, p) => n + p.totalCost, 0))],
      ],
      numeric: [0, 5, 6, 7, 8],
    });
  }
}

