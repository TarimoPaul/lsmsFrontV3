import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';

import { LanguageService } from '@core/i18n/language.service';
import { Button, DialogService, Icon } from '@shared/ui';
import { MoneyPipe } from '@shared/utils/money';
import { SaleChangesService } from '../sales/sale-changes.service';

/**
 * Backend 2.4.0 A6 (owner 31/10 be): "N sales deleted / edited" strip for the CEO (SALE_DELETE_REVIEW), on every
 * page after every login until each change is marked "Nimeona" with a note. It has no close button on purpose.
 */
@Component({
  selector: 'app-sale-changes-banner',
  imports: [Button, Icon, MoneyPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (show()) {
      <div class="bar" role="status">
        <lsms-icon name="delete_history" [size]="20" />
        <span class="txt">
          <strong>{{ i18n.t(p().count + ' sale change(s) to review', 'Mabadiliko ' + p().count + ' ya mauzo ya kukagua') }}@if (p().amount > 0) { · {{ p().amount | money }} }</strong>
          <small>{{ i18n.t('Deleted or edited sales — who, when and why. Mark them “Seen” with a note.', 'Mauzo yaliyofutwa au kubadilishwa — nani, lini na kwa nini. Yaweke “Nimeona” na maelezo.') }}</small>
        </span>
        <button lsmsButton="secondary" size="sm" icon="manage_search" (click)="open()">{{ i18n.t('Review', 'Kagua') }}</button>
      </div>
    }
  `,
  styles: `
    :host { display: block; flex: none; }
    .bar {
      display: flex; align-items: center; gap: 12px; margin: 8px 16px 0; padding: 10px 14px; border-radius: 14px;
      color: var(--c-text); background: color-mix(in srgb, var(--c-warning) 9%, var(--c-surface));
      border: 1px solid color-mix(in srgb, var(--c-warning) 40%, var(--c-border)); box-shadow: inset 4px 0 0 var(--c-warning);
    }
    .bar > lsms-icon { flex: none; color: var(--c-warning); }
    .txt { flex: 1; display: flex; flex-direction: column; gap: 2px; min-width: 0; }
    .txt strong { font-size: 0.88rem; }
    .txt small { font-size: 0.76rem; color: var(--c-text-2); }
    @media (max-width: 600px) { .bar { flex-wrap: wrap; margin: 8px 12px 0; } .txt { flex-basis: calc(100% - 40px); } }
  `,
})
export class SaleChangesBanner {
  protected readonly i18n = inject(LanguageService);
  private readonly svc = inject(SaleChangesService);
  private readonly dialogs = inject(DialogService);

  protected readonly p = this.svc.pending;
  protected readonly show = computed(() => this.p().count > 0);

  constructor() {
    if (this.svc.allowed) void this.svc.loadPending().catch(() => undefined);
  }

  protected async open(): Promise<void> {
    const { SaleChangesDialog } = await import('../sales/sale-changes-dialog');
    await this.dialogs.openAsync(SaleChangesDialog, { size: 'md' });
  }
}
