import { Directive, TemplateRef, inject, input } from '@angular/core';

export interface CellContext<T> {
  $implicit: T;
  row: T;
  index: number;
}

/**
 * Declares one column of `lsms-data-table`. The template renders the cell;
 * `let-row` gives the row item.
 *
 *   <ng-template lsmsColumn="price" label="Price" [sortBy]="byPrice" align="end" let-row>
 *     {{ row.price | money }}
 *   </ng-template>
 *
 * Column id `actions` is special on mobile (can sit inline with the title).
 */
@Directive({ selector: 'ng-template[lsmsColumn]' })
export class TableColumn<T = any> {
  readonly template = inject<TemplateRef<CellContext<T>>>(TemplateRef);

  readonly id = input.required<string>({ alias: 'lsmsColumn' });
  readonly label = input('');
  /** Enables header sorting using this key extractor. */
  readonly sortBy = input<((row: T) => string | number | Date | null | undefined) | undefined>(undefined);
  readonly align = input<'start' | 'center' | 'end'>('start');
  /** Starts hidden (user can enable it from the column picker). */
  readonly hidden = input(false);
  /** Fixed/min width, e.g. "120px". */
  readonly width = input<string | undefined>(undefined);
  /** Exclude from the column picker (always shown). */
  readonly locked = input(false);

  static ngTemplateContextGuard<T>(_dir: TableColumn<T>, ctx: unknown): ctx is CellContext<T> {
    return true;
  }
}

/** Optional full override of the mobile card: `<ng-template lsmsMobileCard let-row let-i="index">`. */
@Directive({ selector: 'ng-template[lsmsMobileCard]' })
export class TableMobileCard<T = any> {
  readonly template = inject<TemplateRef<CellContext<T>>>(TemplateRef);

  static ngTemplateContextGuard<T>(_dir: TableMobileCard<T>, ctx: unknown): ctx is CellContext<T> {
    return true;
  }
}
