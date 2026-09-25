import { DialogRef } from '@angular/cdk/dialog';
import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';

import { ApiError } from '@core/api/api.types';
import { AuthService } from '@core/auth/auth.service';
import { LanguageService } from '@core/i18n/language.service';
import { Button, DialogShell, Icon, SearchBar, Skeleton, ToastService } from '@shared/ui';
import { parseLocal } from '@shared/utils/date-utils';
import { MoneyPipe } from '@shared/utils/money';
import { Sale } from './sales.models';
import { SalesService } from './sales.service';

/**
 * Deleted (soft) sales with restore — GET /sales/deleted + POST /{uid}/restore
 * (SALES_UPDATE). Restoring takes the stock out again and re-posts the sale.
 */
@Component({
  selector: 'app-deleted-sales-dialog',
  imports: [DialogShell, Button, Icon, SearchBar, Skeleton, MoneyPipe, DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <lsms-dialog [title]="i18n.t('Deleted sales', 'Mauzo yaliyofutwa')" icon="delete_history">
      <lsms-search-bar [placeholder]="i18n.t('Search receipt, customer or product…', 'Tafuta risiti, mteja au bidhaa…')" (search)="q.set($event)" />
      @if (loading()) {
        <lsms-skeleton variant="list" [rows]="5" />
      } @else if (error()) {
        <p class="err"><lsms-icon name="error" [size]="18" />{{ error() }}</p>
      } @else if (!shown().length) {
        <p class="muted">{{ i18n.t('No deleted sales.', 'Hakuna mauzo yaliyofutwa.') }}</p>
      } @else {
        <p class="muted small">{{ i18n.t(list().length + ' deleted sales', 'Mauzo ' + list().length + ' yaliyofutwa') }}@if (shown().length < filtered().length) { · {{ i18n.t('showing', 'yanaonyeshwa') }} {{ shown().length }} }</p>
        <ul>
          @for (s of shown(); track s.uid) {
            <li>
              <span class="l">
                <b>{{ s.receiptNumber }}</b>
                <small>{{ date(s.saleDate) | date: 'dd MMM yyyy, HH:mm' }} · {{ s.customerName || i18n.t('Walk-in', 'Kawaida') }} · {{ s.lines.length }} {{ i18n.t('items', 'bidhaa') }}</small>
              </span>
              <b class="amt">{{ s.total | money }}</b>
              @if (canRestore) {
                <button lsmsButton="secondary" size="sm" icon="restore" [loading]="busy() === s.uid" [disabled]="!!busy()" (click)="restore(s)">{{ i18n.t('Restore', 'Rejesha') }}</button>
              }
            </li>
          }
        </ul>
        @if (shown().length < filtered().length) {
          <button lsmsButton="text" size="sm" icon="expand_more" (click)="limit.set(limit() + 50)">{{ i18n.t('Show more', 'Onyesha zaidi') }}</button>
        }
      }
      <ng-container dialogActions>
        <button lsmsButton="secondary" (click)="ref.close(changed)">{{ i18n.t('Close', 'Funga') }}</button>
      </ng-container>
    </lsms-dialog>
  `,
  styles: `
    lsms-search-bar { display: block; margin-bottom: 10px; }
    ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
    li { display: flex; align-items: center; flex-wrap: wrap; gap: 8px 12px; padding: 8px 10px; border-radius: 12px; background: var(--c-bg); border: 1px solid var(--c-border); }
    .l { display: flex; flex-direction: column; flex: 1; min-width: 180px; }
    .l b { font-family: ui-monospace, monospace; font-size: 0.78rem; }
    .l small { font-size: 0.72rem; color: var(--c-text-2); }
    .amt { font-variant-numeric: tabular-nums; }
    .err { display: flex; align-items: center; gap: 6px; color: var(--c-error); }
    .muted { color: var(--c-text-2); font-size: 0.86rem; }
    .small { font-size: 0.76rem; margin-bottom: 6px; }
  `,
})
export class DeletedSalesDialog {
  protected readonly ref = inject<DialogRef<boolean>>(DialogRef);
  protected readonly i18n = inject(LanguageService);
  private readonly api = inject(SalesService);
  private readonly toast = inject(ToastService);

  protected readonly canRestore = inject(AuthService).hasPermission('SALES_UPDATE');
  protected readonly list = signal<Sale[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly busy = signal<string | null>(null);
  protected readonly q = signal('');
  protected readonly limit = signal(50);
  protected changed = false;

  protected readonly filtered = computed(() => {
    const q = this.q().trim().toLowerCase();
    return q ? this.list().filter((s) => s.haystack.includes(q)) : this.list();
  });
  protected readonly shown = computed(() => this.filtered().slice(0, this.limit()));

  constructor() {
    this.api
      .deleted()
      .then((l) => this.list.set(l))
      .catch((e) => this.error.set(ApiError.from(e).message))
      .finally(() => this.loading.set(false));
  }

  protected date(v: string | null): Date | null {
    return parseLocal(v);
  }

  protected async restore(s: Sale): Promise<void> {
    this.busy.set(s.uid);
    try {
      await this.api.restore(s.uid);
      this.list.update((l) => l.filter((x) => x.uid !== s.uid));
      this.changed = true;
      this.toast.success(this.i18n.t(`Sale ${s.receiptNumber} restored`, `Mauzo ${s.receiptNumber} yamerejeshwa`));
    } catch (e) {
      this.toast.error(ApiError.from(e).message);
    } finally {
      this.busy.set(null);
    }
  }
}
