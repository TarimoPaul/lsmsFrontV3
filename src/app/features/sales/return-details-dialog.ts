import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';

import { ApiError } from '@core/api/api.types';
import { AuthService } from '@core/auth/auth.service';
import { LanguageService } from '@core/i18n/language.service';
import { Button, DialogShell, Icon, TextField, ToastService } from '@shared/ui';
import { parseLocal } from '@shared/utils/date-utils';
import { MoneyPipe } from '@shared/utils/money';
import { RETURN_STATUS, RETURN_TYPES, ReturnType, SalesReturn } from './sales.models';
import { SalesService } from './sales.service';

export interface ReturnDetailsData {
  ret: SalesReturn;
}

/**
 * One return request — port of Flutter's return details + approve / reject
 * actions. Approving restocks the items and refunds (posts to the GL), so
 * both actions confirm inline first; reject needs a reason.
 */
@Component({
  selector: 'app-return-details-dialog',
  imports: [DialogShell, Button, Icon, TextField, MoneyPipe, DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let r = ret();
    @let st = status(r.status);
    <lsms-dialog [title]="i18n.t('Return', 'Marejesho') + ' · ' + r.reference" icon="assignment_return">
      <header class="head">
        <span class="pill big" [style.--st]="st.color"><lsms-icon [name]="st.icon" [size]="15" [filled]="true" />{{ i18n.isSwahili() ? st.sw : st.en }}</span>
        <span class="pill">{{ type(r.type) }}</span>
        <span class="grow"></span>
        <small class="muted">{{ date(r.requestedAt) | date: 'dd MMM yyyy, HH:mm' }}</small>
      </header>

      <section class="sum">
        <div class="big ok"><small>{{ i18n.t('Refund', 'Marejesho ya fedha') }}</small><b>{{ r.refund | money }}</b></div>
        <div><small>{{ i18n.t('Pieces', 'Vipande') }}</small><b>{{ r.pieces }}</b></div>
        <div><small>{{ i18n.t('Sale', 'Mauzo') }}</small><b class="mono">{{ r.receiptNumber || '—' }}</b></div>
        <div><small>{{ i18n.t('Customer', 'Mteja') }}</small><b>{{ r.customerName || i18n.t('Walk-in', 'Kawaida') }}</b></div>
      </section>

      <section class="block">
        <h4><lsms-icon name="inventory_2" [size]="15" />{{ i18n.t('Items', 'Bidhaa') }} <span class="count">{{ r.items.length }}</span></h4>
        <div class="scroll">
          <table>
            <thead>
              <tr>
                <th>{{ i18n.t('Product', 'Bidhaa') }}</th>
                <th class="n">{{ i18n.t('Returned', 'Zimerudi') }}</th>
                <th class="n">{{ i18n.t('Sold', 'Ziliuzwa') }}</th>
                <th class="n">{{ i18n.t('Refund', 'Marejesho') }}</th>
              </tr>
            </thead>
            <tbody>
              @for (i of r.items; track i.uid) {
                <tr>
                  <td><b>{{ i.productName }}</b>@if (i.category) { <small class="ref">{{ i.category }}</small> }</td>
                  <td class="n">{{ i.display || i.pieces }}<small class="ref">{{ i.toStock ? i18n.t('back to stock', 'inarudi stoo') : i18n.t('not restocked', 'hairudi stoo') }}</small></td>
                  <td class="n">{{ i.soldPieces }}</td>
                  <td class="n strong">{{ i.refund | money: { symbol: false } }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </section>

      <section class="block">
        <h4><lsms-icon name="notes" [size]="15" />{{ i18n.t('Why', 'Sababu') }}</h4>
        <p class="txt">{{ r.reason || '—' }}</p>
        @if (r.comments) {
          <p class="txt muted">“{{ r.comments }}”</p>
        }
        @if (r.rejectionReason) {
          <p class="txt err">{{ i18n.t('Rejected:', 'Imekataliwa:') }} {{ r.rejectionReason }}</p>
        }
        @if (r.notes) {
          <p class="txt muted small">{{ r.notes }}</p>
        }
      </section>

      @if (step(); as s) {
        <section class="confirm" [class.danger]="s === 'reject'">
          <p>
            <lsms-icon [name]="s === 'reject' ? 'warning' : 'info'" [size]="18" />
            {{ s === 'approve' ? i18n.t('The items go back into stock and the refund is recorded.', 'Bidhaa zitarudi stoo na marejesho ya fedha yatarekodiwa.') : i18n.t('The customer keeps the goods; nothing is refunded.', 'Mteja anabaki na bidhaa; hakuna marejesho ya fedha.') }}
          </p>
          <lsms-text-field type="textarea" [rows]="2" [maxLength]="300" [autofocus]="true" [required]="s === 'reject'" [label]="s === 'reject' ? i18n.t('Reason for rejecting', 'Sababu ya kukataa') : i18n.t('Notes (optional)', 'Maelezo (hiari)')" (valueChange)="note.set($event)" />
        </section>
      }

      <ng-container dialogActions>
        @if (step()) {
          <button lsmsButton="secondary" [disabled]="busy()" (click)="step.set(null)">{{ i18n.t('Back', 'Rudi') }}</button>
          <button [lsmsButton]="step() === 'reject' ? 'danger' : 'success'" [icon]="step() === 'reject' ? 'cancel' : 'verified'" [loading]="busy()" [disabled]="step() === 'reject' && !note().trim()" (click)="confirm()">
            {{ step() === 'reject' ? i18n.t('Reject return', 'Kataa') : i18n.t('Approve return', 'Idhinisha') }}
          </button>
        } @else {
          <button lsmsButton="secondary" (click)="ref.close(changed)">{{ i18n.t('Close', 'Funga') }}</button>
          @if (r.status === 'PENDING' && canApprove) {
            <button lsmsButton="secondary" icon="cancel" (click)="begin('reject')">{{ i18n.t('Reject', 'Kataa') }}</button>
            <button lsmsButton="success" icon="verified" (click)="begin('approve')">{{ i18n.t('Approve', 'Idhinisha') }}</button>
          }
        }
      </ng-container>
    </lsms-dialog>
  `,
  styles: `
    @use 'detail-dialog';
    @include detail-dialog.base;
    .head { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; margin-bottom: 12px; }
    .head .grow { flex: 1; }
    .pill.big { padding: 4px 12px; font-size: 0.8rem; }
    .mono { font-family: ui-monospace, monospace; font-size: 0.8rem !important; }
    .txt { font-size: 0.86rem; white-space: pre-wrap; }
    .txt + .txt { margin-top: 6px; }
    .txt.err { color: var(--c-error); font-weight: 600; }
    .txt.small { font-size: 0.74rem; }
    .confirm { padding: 12px 14px; border-radius: 14px; background: color-mix(in srgb, var(--c-success) 7%, var(--c-bg)); border: 1px solid color-mix(in srgb, var(--c-success) 25%, transparent); }
    .confirm.danger { background: color-mix(in srgb, var(--c-error) 6%, var(--c-bg)); border-color: color-mix(in srgb, var(--c-error) 25%, transparent); }
    .confirm p { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; font-size: 0.84rem; font-weight: 600; }
  `,
})
export class ReturnDetailsDialog {
  protected readonly data = inject<ReturnDetailsData>(DIALOG_DATA);
  protected readonly ref = inject<DialogRef<boolean>>(DialogRef);
  protected readonly i18n = inject(LanguageService);
  private readonly api = inject(SalesService);
  private readonly toast = inject(ToastService);

  protected readonly ret = signal<SalesReturn>(this.data.ret);
  protected readonly step = signal<'approve' | 'reject' | null>(null);
  protected readonly note = signal('');
  protected readonly busy = signal(false);
  protected readonly canApprove = inject(AuthService).hasPermission('SALES_RETURN_APPROVE');
  protected changed = false;

  protected status(s: string) {
    return RETURN_STATUS[s] ?? RETURN_STATUS['PENDING'];
  }

  protected type(t: string): string {
    const x = RETURN_TYPES[t as ReturnType];
    return x ? (this.i18n.isSwahili() ? x.sw : x.en) : t;
  }

  protected date(v: string | null): Date | null {
    return parseLocal(v);
  }

  protected begin(s: 'approve' | 'reject'): void {
    this.note.set('');
    this.step.set(s);
  }

  protected async confirm(): Promise<void> {
    const s = this.step();
    if (!s) return;
    this.busy.set(true);
    try {
      const fresh = s === 'approve' ? await this.api.approveReturn(this.ret().uid, this.note().trim() || null) : await this.api.rejectReturn(this.ret().uid, this.note().trim());
      this.ret.set(fresh.uid ? fresh : { ...this.ret(), status: s === 'approve' ? 'APPROVED' : 'REJECTED' });
      this.toast.success(s === 'approve' ? this.i18n.t('Return approved', 'Marejesho yameidhinishwa') : this.i18n.t('Return rejected', 'Marejesho yamekataliwa'));
      this.changed = true;
      this.step.set(null);
    } catch (e) {
      this.toast.error(ApiError.from(e).message);
    } finally {
      this.busy.set(false);
    }
  }
}
