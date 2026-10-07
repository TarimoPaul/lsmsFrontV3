import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';

import { LanguageService } from '../../../core/i18n/language.service';
import { BreakpointService } from '../../../core/layout/breakpoint.service';
import { ShellTitle, handPageTitle } from '../../../core/layout/shell-title.service';
import { IconButton } from '../button/icon-button';
import { Icon } from '../icon/icon';

/**
 * Standard CRUD page header — port of `SharedPageHeader`: leading icon,
 * title/subtitle (ellipsised), optional refresh, trailing actions (projected).
 *
 *   <lsms-page-header title="Categories" icon="category" [refreshable]="true" (refresh)="load()">
 *     <button lsmsButton icon="add" size="sm">Add</button>
 *   </lsms-page-header>
 */
@Component({
  selector: 'lsms-page-header',
  imports: [Icon, IconButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class.dup-title]': 'dupTitle()' },
  template: `
    @if (icon()) {
      <lsms-icon [name]="icon()!" class="lead" />
    }
    <div class="text">
      <h2 class="title">{{ title() }}</h2>
      @if (subtitle()) {
        <p class="subtitle">{{ subtitle() }}</p>
      }
    </div>
    <div class="actions">
      @if (refreshable()) {
        <button
          lsmsIconButton="refresh"
          [attr.aria-label]="i18n.t('Refresh', 'Onyesha upya')"
          [title]="i18n.t('Refresh', 'Onyesha upya')"
          (click)="refresh.emit()"
        ></button>
      }
      <ng-content />
    </div>
  `,
  styles: `
    @use 'typography' as t;
    :host { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; padding: 16px; min-width: 0; }
    .lead { color: var(--c-primary); }
    .text { flex: 1 1 180px; min-width: 0; }
    .title { @include t.h3; @include t.ellipsis; color: var(--c-text); }
    .subtitle { @include t.body-sm; @include t.ellipsis; color: var(--c-text-2); }
    /* Actions stay pinned right; on narrow screens they drop to their own row. */
    .actions { display: flex; align-items: center; justify-content: flex-end; gap: 8px; flex-wrap: wrap; margin-left: auto; }
    /* Phones: the app bar carries this title (ShellTitle), so only the actions stay, in one row that scrolls sideways. */
    :host(.dup-title) { padding-top: 0; padding-bottom: 0; }
    :host(.dup-title) :is(.lead, .text) { display: none; }
    /* flex-start + an auto margin (not flex-end): overflow to the left of a scroller cannot be reached. */
    :host(.dup-title) .actions { flex: 1; min-width: 0; margin-left: 0; justify-content: flex-start; flex-wrap: nowrap; overflow-x: auto; scrollbar-width: none; padding: 2px 0; }
    :host(.dup-title) .actions ::ng-deep > :first-child { margin-left: auto; }
    :host(.dup-title) .actions::-webkit-scrollbar { display: none; }
    :host(.dup-title) .actions ::ng-deep > * { flex-shrink: 0; }
    :host(.dup-title) .actions:empty { display: none; }
  `,
})
export class PageHeader {
  protected readonly i18n = inject(LanguageService);
  private readonly bp = inject(BreakpointService);
  private readonly shell = inject(ShellTitle);
  readonly title = input.required<string>();
  readonly subtitle = input<string | undefined>(undefined);
  readonly icon = input<string | undefined>(undefined);
  readonly refreshable = input(false);
  readonly refresh = output<void>();
  /** Phone inside the app shell: the app bar shows this title, the header keeps only its actions. */
  protected readonly dupTitle = computed(() => this.bp.isMobile() && this.shell.active());

  constructor() {
    handPageTitle(() => ({ title: this.title(), subtitle: this.subtitle() }));
  }
}
