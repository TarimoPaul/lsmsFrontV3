import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';

import { LanguageService } from '@core/i18n/language.service';
import { Button, DateRangeSelector, Icon, IconButton } from '@shared/ui';
import { DateRange } from '@shared/utils/date-utils';
import { ReportId, reportDef } from './reports.models';

/**
 * Shared chrome for every report: back to the hub, title + source, the period
 * control (optional), projected filters, and CSV / print actions. Content is
 * projected below.
 */
@Component({
  selector: 'app-report-frame',
  imports: [RouterLink, Icon, IconButton, Button, DateRangeSelector],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="wrap">
      <header class="head">
        <a class="back" routerLink="/reports" [attr.aria-label]="i18n.t('All reports', 'Ripoti zote')" [title]="i18n.t('All reports', 'Ripoti zote')"><lsms-icon name="arrow_back" [size]="20" /></a>
        <span class="mark" [style.--c]="def()?.color"><lsms-icon [name]="def()?.icon ?? 'analytics'" [size]="22" /></span>
        <div class="txt">
          <h2>{{ title() }}</h2>
          <p>
            <lsms-icon name="database" [size]="13" />{{ i18n.t('Source', 'Chanzo') }}: {{ source() }}
            @if (note()) { <span class="dot">·</span>{{ note() }} }
          </p>
        </div>
        <div class="actions">
          <button lsmsIconButton="refresh" [attr.aria-label]="i18n.t('Refresh', 'Onyesha upya')" [title]="i18n.t('Refresh', 'Onyesha upya')" (click)="refresh.emit()"></button>
          @if (exportable()) {
            <button lsmsButton="secondary" size="sm" icon="table_view" (click)="csv.emit()">CSV</button>
            <button lsmsButton="secondary" size="sm" icon="print" (click)="print.emit()">{{ i18n.t('Print / PDF', 'Chapisha / PDF') }}</button>
          }
        </div>
      </header>

      @if (range() || hasFilters()) {
        <div class="bar">
          @if (range(); as r) {
            <lsms-date-range-selector [range]="r" [max]="today" (rangeChange)="rangeChange.emit($event)" />
          }
          <ng-content select="[filters]" />
        </div>
      }

      <ng-content />
    </div>
  `,
  styles: `
    @use 'list-page';
    @include list-page.base;
    .head { display: flex; align-items: center; flex-wrap: wrap; gap: 10px 12px; padding: 16px 0 0; }
    .back { display: inline-grid; place-items: center; width: 36px; height: 36px; border-radius: 10px; color: var(--c-text-2); text-decoration: none; border: 1px solid var(--c-border); background: var(--c-surface); }
    .back:hover { color: var(--c-primary); border-color: var(--c-primary); }
    .mark { --c: var(--c-primary); display: inline-grid; place-items: center; width: 42px; height: 42px; border-radius: 12px; color: var(--c); background: color-mix(in srgb, var(--c) 12%, transparent); }
    .txt { flex: 1 1 220px; min-width: 0; }
    h2 { margin: 0; font-size: 1.2rem; font-weight: 700; color: var(--c-text); }
    .txt p { display: flex; align-items: center; flex-wrap: wrap; gap: 4px; margin: 2px 0 0; font-size: 0.76rem; color: var(--c-text-2); }
    .dot { margin: 0 2px; }
    .actions { display: flex; align-items: center; gap: 8px; margin-left: auto; }
    .bar { display: flex; align-items: center; flex-wrap: wrap; gap: 10px; }
  `,
})
export class ReportFrame {
  protected readonly i18n = inject(LanguageService);
  readonly report = input.required<ReportId>();
  readonly range = input<DateRange | null>(null);
  readonly note = input<string | null>(null);
  readonly exportable = input(true);
  readonly hasFilters = input(false);
  readonly rangeChange = output<DateRange>();
  readonly refresh = output<void>();
  readonly csv = output<void>();
  readonly print = output<void>();

  protected readonly today = new Date();
  protected readonly def = computed(() => reportDef(this.report()));
  protected readonly title = computed(() => {
    const d = this.def();
    return d ? (this.i18n.isSwahili() ? d.title.sw : d.title.en) : '';
  });
  protected readonly source = computed(() => {
    const d = this.def();
    return d ? (this.i18n.isSwahili() ? d.source.sw : d.source.en) : '';
  });
}
