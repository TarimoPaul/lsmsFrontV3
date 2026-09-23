import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

import { SearchBar } from '../search-bar/search-bar';

/**
 * "Search + segment chips + extra filters" toolbar — port of
 * `SharedFilterPanel`. Stacks vertically below 768px, one row above.
 *
 *   <lsms-filter-panel searchPlaceholder="Search sales…" (search)="q.set($event)">
 *     <lsms-segmented-filter-bar filterSegments … />
 *     <lsms-date-range-selector … />      ← any other children = trailing controls
 *   </lsms-filter-panel>
 */
@Component({
  selector: 'lsms-filter-panel',
  imports: [SearchBar],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (showSearch()) {
      <lsms-search-bar class="search" [placeholder]="searchPlaceholder()" (search)="search.emit($event)" />
    }
    <div class="segments"><ng-content select="[filterSegments]" /></div>
    <div class="trailing"><ng-content /></div>
  `,
  styles: `
    :host { display: flex; align-items: center; gap: 16px; padding: 16px; container-type: inline-size; }
    .search { flex: 1 1 240px; }
    .segments { flex: 0 1 auto; min-width: 0; }
    .segments:empty, .trailing:empty { display: none; }
    .trailing { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
    @media (max-width: 767px) {
      :host { flex-direction: column; align-items: stretch; gap: 8px; }
      .search { flex: none; }
    }
  `,
})
export class FilterPanel {
  readonly searchPlaceholder = input<string | undefined>(undefined);
  readonly showSearch = input(true);
  readonly search = output<string>();
}
