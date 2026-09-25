import { CdkConnectedOverlay, CdkOverlayOrigin } from '@angular/cdk/overlay';
import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  contentChild,
  contentChildren,
  effect,
  inject,
  input,
  linkedSignal,
  output,
  signal,
} from '@angular/core';

import { LanguageService } from '../../../core/i18n/language.service';
import { BreakpointService } from '../../../core/layout/breakpoint.service';
import { Icon } from '../icon/icon';
import { Skeleton } from '../loading/loaders';
import { EmptyState } from '../page/empty-state';
import { TableColumn, TableMobileCard } from './table-column';

export type SortDirection = 'asc' | 'desc';

const PAGE_SIZES = [10, 15, 25, 50, 100];

/**
 * Shared table — port of Flutter `SharedTable<T>`.
 *
 * Desktop: sticky-header table with sortable headers, row numbers, bulk
 * checkboxes and a column picker. Mobile devices (shortest side < 768px):
 * card list with a title row and label-above-value fields.
 * Client-side sorting + pagination (10/15/25/50/100 per page).
 *
 *   <lsms-data-table [items]="rows()" [rowId]="rowId" title="Categories" [showRowNumbers]="true"
 *                    [mobileTitle]="nameOf" (rowClick)="open($event)">
 *     <ng-template lsmsColumn="name" label="Name" [sortBy]="nameOf" let-row>{{ row.categoryName }}</ng-template>
 *     <ng-template lsmsColumn="actions" let-row><lsms-action-menu [actions]="…" /></ng-template>
 *   </lsms-data-table>
 */
@Component({
  selector: 'lsms-data-table',
  imports: [NgTemplateOutlet, CdkConnectedOverlay, CdkOverlayOrigin, Icon, Skeleton, EmptyState],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './data-table.html',
  styleUrl: './data-table.scss',
  host: { '[class.mobile]': 'isMobile()' },
})
export class DataTable<T> {
  protected readonly i18n = inject(LanguageService);
  private readonly bp = inject(BreakpointService);

  // Data
  readonly items = input.required<readonly T[]>();
  readonly rowId = input<(row: T) => string | number>((row: T) => (row as { uid?: string }).uid ?? String(row));
  readonly loading = input(false);

  // Header / chrome
  readonly title = input('Records');
  readonly showHeader = input(true);
  readonly enableColumnSelection = input(true);

  // Sorting
  readonly defaultSortColumn = input<string | undefined>(undefined);
  readonly defaultSortDirection = input<SortDirection>('asc');

  // Pagination
  readonly pageSize = input(15);
  readonly showPagination = input(true);
  readonly pageSizeChange = output<number>();

  // Selection
  readonly bulkSelection = input(false);
  readonly selectionChange = output<T[]>();

  // Row numbers
  readonly showRowNumbers = input(true);
  readonly rowNumberLabel = input('S/No');

  // Mobile
  readonly mobileTitle = input<((row: T) => string) | undefined>(undefined);
  /** Columns shown in mobile cards (defaults to all visible). */
  readonly mobileColumns = input<string[] | undefined>(undefined);
  /** Columns squeezed onto the title line on mobile. */
  readonly mobileCompactColumns = input<string[]>([]);
  /** Render the `actions` cell next to the mobile card title. */
  readonly actionsInlineWithTitle = input(false);
  /** Force card layout regardless of device (e.g. inside a narrow panel). */
  readonly forceCards = input(false);

  // Empty state
  readonly emptyTitle = input<string | undefined>(undefined);
  readonly emptyMessage = input<string | undefined>(undefined);
  readonly emptyIcon = input('inbox');

  readonly rowClick = output<T>();

  protected readonly columns = contentChildren(TableColumn);
  protected readonly mobileCard = contentChild(TableMobileCard);

  protected readonly isMobile = computed(() => this.forceCards() || this.bp.isMobileDevice());

  // ── Column visibility ──────────────────────────────────────────────────────
  private readonly hiddenIds = linkedSignal(
    () => new Set(this.columns().filter((c) => c.hidden()).map((c) => c.id())),
  );
  protected readonly visibleColumns = computed(() => this.columns().filter((c) => !this.hiddenIds().has(c.id())));
  /** A left-aligned column right after a right-aligned (numeric) one gets extra room so they don't touch. */
  protected afterEnd(i: number): boolean {
    const cols = this.visibleColumns();
    return i > 0 && cols[i - 1].align() === 'end' && cols[i].align() !== 'end';
  }

  protected readonly pickableColumns = computed(() => this.columns().filter((c) => !c.locked() && c.id() !== 'actions'));
  protected readonly columnMenuOpen = signal(false);

  protected toggleColumn(id: string): void {
    this.hiddenIds.update((set) => {
      const next = new Set(set);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  protected isColumnVisible(id: string): boolean {
    return !this.hiddenIds().has(id);
  }

  // ── Sorting ────────────────────────────────────────────────────────────────
  protected readonly sortColumn = linkedSignal(() => this.defaultSortColumn());
  protected readonly sortDirection = linkedSignal(() => this.defaultSortDirection());

  protected readonly sorted = computed(() => {
    const items = this.items();
    const colId = this.sortColumn();
    const extractor = colId ? this.columns().find((c) => c.id() === colId)?.sortBy() : undefined;
    if (!extractor) return items;
    const dir = this.sortDirection() === 'asc' ? 1 : -1;
    return [...items].sort((a, b) => {
      const va = extractor(a);
      const vb = extractor(b);
      if (va == null && vb == null) return 0;
      if (va == null) return 1;
      if (vb == null) return -1;
      if (typeof va === 'string' && typeof vb === 'string') {
        return va.localeCompare(vb, undefined, { sensitivity: 'base', numeric: true }) * dir;
      }
      return (va < vb ? -1 : va > vb ? 1 : 0) * dir;
    });
  });

  protected sort(col: TableColumn<T>): void {
    if (!col.sortBy()) return;
    if (this.sortColumn() === col.id()) {
      this.sortDirection.update((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      this.sortColumn.set(col.id());
      this.sortDirection.set('asc');
    }
    this.page.set(0);
  }

  // ── Pagination ─────────────────────────────────────────────────────────────
  protected readonly pageSizes = PAGE_SIZES;
  protected readonly perPage = linkedSignal(() => this.pageSize());
  protected readonly page = signal(0);
  protected readonly totalPages = computed(() => Math.max(1, Math.ceil(this.sorted().length / this.perPage())));
  protected readonly startIndex = computed(() => this.page() * this.perPage());
  protected readonly endIndex = computed(() => Math.min(this.startIndex() + this.perPage(), this.sorted().length));
  protected readonly pageItems = computed(() =>
    this.showPagination() ? this.sorted().slice(this.startIndex(), this.endIndex()) : this.sorted(),
  );

  /** Page buttons: first, last and the current ±1, with gaps as null (e.g. 1 … 4 5 6 … 9). */
  protected readonly pageNumbers = computed<(number | null)[]>(() => {
    const n = this.totalPages();
    const cur = this.page();
    const keep = new Set([0, n - 1, cur - 1, cur, cur + 1].filter((p) => p >= 0 && p < n));
    const out: (number | null)[] = [];
    [...keep].sort((a, b) => a - b).forEach((p, i, arr) => {
      if (i && p - arr[i - 1] > 1) out.push(null);
      out.push(p);
    });
    return out;
  });
  protected goTo(p: number): void {
    this.page.set(Math.min(Math.max(0, p), this.totalPages() - 1));
  }

  protected prevPage(): void {
    if (this.page() > 0) this.page.update((p) => p - 1);
  }
  protected nextPage(): void {
    if (this.page() < this.totalPages() - 1) this.page.update((p) => p + 1);
  }
  protected setPageSize(size: number): void {
    this.perPage.set(size);
    this.page.set(0);
    this.pageSizeChange.emit(size);
  }

  // ── Selection ──────────────────────────────────────────────────────────────
  protected readonly selectedIds = signal(new Set<string | number>());
  protected readonly allPageSelected = computed(() => {
    const rows = this.pageItems();
    return rows.length > 0 && rows.every((r) => this.selectedIds().has(this.rowId()(r)));
  });
  protected readonly somePageSelected = computed(
    () => !this.allPageSelected() && this.pageItems().some((r) => this.selectedIds().has(this.rowId()(r))),
  );

  protected isSelected(row: T): boolean {
    return this.selectedIds().has(this.rowId()(row));
  }

  protected toggleRow(row: T): void {
    const id = this.rowId()(row);
    this.selectedIds.update((set) => {
      const next = new Set(set);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    this.emitSelection();
  }

  protected toggleAll(): void {
    const select = !this.allPageSelected();
    this.selectedIds.set(new Set(select ? this.pageItems().map((r) => this.rowId()(r)) : []));
    this.emitSelection();
  }

  /** Clear the bulk selection (e.g. after a bulk action completes). */
  clearSelection(): void {
    this.selectedIds.set(new Set());
    this.emitSelection();
  }

  private emitSelection(): void {
    const ids = this.selectedIds();
    this.selectionChange.emit(this.items().filter((r) => ids.has(this.rowId()(r))));
  }

  // ── Mobile helpers ─────────────────────────────────────────────────────────
  protected readonly mobileCompact = computed(() => {
    const cols = this.mobileColumns() ?? this.visibleColumns().map((c) => c.id());
    return this.visibleColumns().filter((c) => this.mobileCompactColumns().includes(c.id()) && cols.includes(c.id()));
  });
  protected readonly inlineActions = computed(() =>
    this.actionsInlineWithTitle() ? this.visibleColumns().find((c) => c.id() === 'actions') : undefined,
  );
  protected readonly mobileBody = computed(() => {
    const cols = this.mobileColumns() ?? this.visibleColumns().map((c) => c.id());
    const compact = this.mobileCompactColumns();
    const inline = this.inlineActions();
    return this.visibleColumns().filter(
      (c) => cols.includes(c.id()) && !compact.includes(c.id()) && !(inline && c.id() === 'actions'),
    );
  });

  protected rowTitle(row: T, index: number): string {
    return this.mobileTitle()?.(row) ?? `Item ${this.startIndex() + index + 1}`;
  }

  constructor() {
    // Keep the current page in range when data shrinks (e.g. after filtering).
    effect(() => {
      const last = this.totalPages() - 1;
      if (this.page() > last) this.page.set(last);
    });
    // Drop selections for rows that no longer exist.
    effect(() => {
      const ids = new Set(this.items().map((r) => this.rowId()(r)));
      const current = this.selectedIds();
      if ([...current].some((id) => !ids.has(id))) {
        this.selectedIds.set(new Set([...current].filter((id) => ids.has(id))));
      }
    });
  }
}
