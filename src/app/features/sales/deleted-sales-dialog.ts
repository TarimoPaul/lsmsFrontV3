import { DialogRef } from '@angular/cdk/dialog';
import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';

import { ApiError } from '@core/api/api.types';
import { AuthService } from '@core/auth/auth.service';
import { LanguageService } from '@core/i18n/language.service';
import { Button, DialogShell, Icon, SearchBar, Skeleton } from '@shared/ui';
import { parseLocal } from '@shared/utils/date-utils';
import { MoneyPipe } from '@shared/utils/money';
import { RemakeStore } from './pos/remake.store';
import { Sale } from './sales.models';
import { SalesService } from './sales.service';

/**
 * Deleted (soft) sales — GET /sales/deleted. A deleted sale cannot be restored (owner 31/10 bf: restore is
 * disabled on the server, like permanent delete). "Make again" opens the till with its lines and the old receipt
 * number in the new sale's notes (SALES_WRITE).
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
              @if (canRemake) {
                <button lsmsButton="secondary" size="sm" icon="replay" (click)="remake(s)">{{ i18n.t('Make again', 'Tengeneza upya') }}</button>
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

  private readonly router = inject(Router);
  private readonly remakeStore = inject(RemakeStore);
  protected readonly canRemake = inject(AuthService).hasPermission('SALES_WRITE');
  protected readonly list = signal<Sale[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
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

  /** The till, filled with this sale's lines; the new sale's notes name the deleted receipt. */
  protected remake(s: Sale): void {
    this.remakeStore.set(s);
    this.ref.close(this.changed);
    void this.router.navigate(['/sales/new']);
  }
}
