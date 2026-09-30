import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';

import { LanguageService } from '@core/i18n/language.service';
import { Button, DialogShell, Icon } from '@shared/ui';

export interface PrintColumnsData {
  columns: { key: string; label: string; secret: boolean; on: boolean }[];
  count: number;
}

/** Choose the columns of a printed report (Flutter's inventory "print options"). Closes with the chosen keys. */
@Component({
  selector: 'app-print-columns-dialog',
  imports: [DialogShell, Button, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <lsms-dialog [title]="i18n.t('Columns to print', 'Safu za kuchapisha')" icon="print">
      <p class="hint">{{ i18n.t('Pick what goes on the paper.', 'Chagua kitakachoonekana kwenye karatasi.') }} {{ data.count }} {{ i18n.t('rows', 'mistari') }}.</p>
      <ul>
        @for (c of data.columns; track c.key) {
          <li>
            <label [class.secret]="c.secret">
              <input type="checkbox" [checked]="on().has(c.key)" (change)="toggle(c.key)" />
              <span>{{ c.label }}</span>
              @if (c.secret) { <small><lsms-icon name="visibility_off" [size]="13" />{{ i18n.t('buying price — keep private', 'bei ya kununua — siri') }}</small> }
            </label>
          </li>
        }
      </ul>
      <ng-container dialogActions>
        <button lsmsButton="secondary" (click)="ref.close()">{{ i18n.t('Cancel', 'Ghairi') }}</button>
        <button lsmsButton icon="print" [disabled]="!on().size" (click)="ref.close(keys())">{{ i18n.t('Print', 'Chapisha') }}</button>
      </ng-container>
    </lsms-dialog>
  `,
  styles: `
    .hint { margin: 0 0 8px; font-size: 0.82rem; color: var(--c-text-2); }
    ul { display: flex; flex-direction: column; margin: 0; padding: 0; list-style: none; }
    label { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; padding: 7px 4px; border-radius: 8px; cursor: pointer; font-size: 0.86rem; color: var(--c-text); }
    label:hover { background: var(--c-bg); }
    input { width: 16px; height: 16px; accent-color: var(--c-primary); }
    small { display: inline-flex; align-items: center; gap: 3px; font-size: 0.72rem; color: var(--c-warning); }
  `,
})
export class PrintColumnsDialog {
  protected readonly data = inject<PrintColumnsData>(DIALOG_DATA);
  protected readonly ref = inject<DialogRef<string[]>>(DialogRef);
  protected readonly i18n = inject(LanguageService);
  protected readonly on = signal(new Set(this.data.columns.filter((c) => c.on).map((c) => c.key)));
  protected readonly keys = computed(() => this.data.columns.map((c) => c.key).filter((k) => this.on().has(k)));

  protected toggle(key: string): void {
    this.on.update((s) => {
      const n = new Set(s);
      if (n.has(key)) n.delete(key);
      else n.add(key);
      return n;
    });
  }
}
