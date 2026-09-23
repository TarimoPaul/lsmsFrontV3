import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

import { Button } from '../button/button';
import { IconButton } from '../button/icon-button';

export type ExportFormat = 'pdf' | 'csv' | 'excel';

/**
 * Standard export cluster (PDF / CSV / Excel) — port of
 * `SharedExportToolbar`. Only the `formats` you list render.
 *
 *   <lsms-export-toolbar [formats]="['pdf', 'csv']" [loading]="exporting()" (export)="doExport($event)" />
 */
@Component({
  selector: 'lsms-export-toolbar',
  imports: [Button, IconButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @for (f of formats(); track f) {
      @if (dense()) {
        <button
          [lsmsIconButton]="meta[f].icon"
          [attr.aria-label]="meta[f].label"
          [title]="meta[f].label"
          [disabled]="loading()"
          (click)="export.emit(f)"
        ></button>
      } @else {
        <button lsmsButton="secondary" size="sm" [icon]="meta[f].icon" [disabled]="loading()" (click)="export.emit(f)">
          {{ meta[f].label }}
        </button>
      }
    }
  `,
  styles: `:host { display: inline-flex; align-items: center; gap: 8px; flex-wrap: wrap; }`,
})
export class ExportToolbar {
  readonly formats = input<ExportFormat[]>(['pdf', 'csv', 'excel']);
  readonly loading = input(false);
  /** Icon-only buttons for tight toolbars. */
  readonly dense = input(false);
  readonly export = output<ExportFormat>();

  protected readonly meta: Record<ExportFormat, { icon: string; label: string }> = {
    pdf: { icon: 'picture_as_pdf', label: 'PDF' },
    csv: { icon: 'grid_on', label: 'CSV' },
    excel: { icon: 'table_chart', label: 'Excel' },
  };
}
