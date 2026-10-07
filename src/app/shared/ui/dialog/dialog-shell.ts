import { DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, afterNextRender, inject, input } from '@angular/core';

import { LanguageService } from '../../../core/i18n/language.service';
import { IconButton } from '../button/icon-button';
import { Icon } from '../icon/icon';

/**
 * Standard dialog layout: header (icon + title + close), scrollable body,
 * sticky footer for actions. Use inside any component opened through
 * `DialogService.open()`.
 *
 *   <lsms-dialog title="Add category" icon="category">
 *     <form …>…</form>
 *     <ng-container dialogActions>
 *       <button lsmsButton="secondary" (click)="ref.close()">Cancel</button>
 *       <button lsmsButton (click)="save()">Save</button>
 *     </ng-container>
 *   </lsms-dialog>
 *
 * Phones: a plain `<table>` with four or more columns inside a dialog cannot fit a
 * 360px sheet. The shell marks such tables `lsms-stacked` and copies each column
 * heading onto its cells (`data-label`); styles/_mobile.scss then shows every row as
 * a small card (first cell = title, the rest as labelled values). Dialogs need no
 * change; desktop is untouched (the styles apply under 600px only).
 */
@Component({
  selector: 'lsms-dialog',
  imports: [Icon, IconButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (title()) {
      <header class="head">
        @if (icon()) {
          <span class="icon-wrap"><lsms-icon [name]="icon()!" [size]="20" /></span>
        }
        <h2 class="title">{{ title() }}</h2>
        @if (closable()) {
          <button
            lsmsIconButton="close"
            [iconSize]="20"
            color="var(--c-text-2)"
            [attr.aria-label]="i18n.t('Close', 'Funga')"
            (click)="ref?.close()"
          ></button>
        }
      </header>
    }
    <div class="body"><ng-content /></div>
    <footer class="foot"><ng-content select="[dialogActions]" /></footer>
  `,
  styles: `
    @use 'typography' as t;
    :host { display: flex; flex-direction: column; max-height: inherit; height: 100%; min-height: 0; }
    .head {
      display: flex; align-items: center; gap: 12px;
      padding: 16px 16px 12px 20px;
      border-bottom: 1px solid var(--c-divider);
    }
    .icon-wrap {
      display: inline-flex; padding: 8px; border-radius: 10px;
      color: var(--c-primary); background: color-mix(in srgb, var(--c-primary) 12%, transparent);
    }
    .title { @include t.h4; font-weight: 600; flex: 1; min-width: 0; @include t.ellipsis; }
    .body { flex: 1; min-height: 0; overflow: auto; padding: 20px; }
    .foot {
      display: flex; justify-content: flex-end; gap: 8px; flex-wrap: wrap;
      padding: 12px 20px; border-top: 1px solid var(--c-divider);
    }
    .foot:empty { display: none; }
    /* Phones (bottom sheet): the title and the actions stay in place while a long form
       scrolls between them; the main action spans the width left by the others. */
    @media (max-width: 599px) {
      .head { position: sticky; top: 0; z-index: 3; padding: 10px 12px 10px 16px; background: var(--c-surface); }
      .body { padding: 16px; }
      .foot {
        position: sticky; bottom: 0; z-index: 3; flex-wrap: nowrap; gap: 10px;
        padding: 10px 16px; background: var(--c-surface);
        box-shadow: 0 -6px 16px -10px rgb(15 23 42 / 0.25);
      }
      /* The last action (the main one) takes the room that is left; the others keep their own width. */
      .foot ::ng-deep > :is(button, a) { flex: 0 1 auto; min-width: 0; min-height: 48px; }
      .foot ::ng-deep > :is(button, a):last-child { flex: 1 1 auto; }
    }
  `,
})
export class DialogShell {
  protected readonly i18n = inject(LanguageService);
  protected readonly ref = inject(DialogRef, { optional: true });
  readonly title = input<string | undefined>(undefined);
  readonly icon = input<string | undefined>(undefined);
  readonly closable = input(true);

  constructor() {
    const host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      let frame = 0;
      const run = () => {
        cancelAnimationFrame(frame);
        frame = requestAnimationFrame(() => labelTables(host));
      };
      // Content arrives later (data loads, tabs, language switch): re-label on change.
      const observer = new MutationObserver(run);
      observer.observe(host, { childList: true, subtree: true, characterData: true });
      run();
      destroyRef.onDestroy(() => {
        observer.disconnect();
        cancelAnimationFrame(frame);
      });
    });
  }
}

/** Fewer columns than this fit a phone as they are. */
const STACK_FROM_COLUMNS = 4;

function labelTables(host: HTMLElement): void {
  for (const table of Array.from(host.querySelectorAll('table'))) {
    // The shared data table has its own phone cards.
    if (table.closest('lsms-data-table')) continue;
    const heads = Array.from(table.querySelectorAll(':scope > thead th')).map((th) => th.textContent?.trim() ?? '');
    if (heads.length < STACK_FROM_COLUMNS) continue;
    table.classList.add('lsms-stacked');
    for (const row of Array.from(table.querySelectorAll<HTMLTableRowElement>(':scope > tbody > tr, :scope > tfoot > tr'))) {
      const cells = Array.from(row.cells);
      // Rows with merged cells (totals, notes, empty states) keep their own layout.
      if (cells.length !== heads.length || cells.some((c) => c.colSpan > 1)) continue;
      cells.forEach((cell, i) => {
        if (i > 0 && cell.dataset['label'] !== heads[i]) cell.dataset['label'] = heads[i];
      });
    }
  }
}
