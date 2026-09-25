import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, output, signal } from '@angular/core';

import { ApiError } from '@core/api/api.types';
import { AuthService } from '@core/auth/auth.service';
import { LanguageService } from '@core/i18n/language.service';
import { Button, EmptyState, Icon, Skeleton, TextField, ToastService } from '@shared/ui';
import { parseLocal } from '@shared/utils/date-utils';
import { MoneyPipe } from '@shared/utils/money';
import { DEBT_TYPES, DebtAdjustment, DebtAdjustmentType, DebtService } from './debt.service';

/**
 * Checker queue for large debt corrections — port of Flutter
 * `PendingDebtAdjustmentsDialog`. The requester cannot approve their own
 * request (backend rule), so their own items only show "waiting".
 */
@Component({
  selector: 'app-debt-approvals-panel',
  imports: [Button, Icon, Skeleton, EmptyState, TextField, MoneyPipe, DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="card">
      <header>
        <h3><lsms-icon name="how_to_reg" [size]="18" />{{ i18n.t('Debt corrections waiting for approval', 'Marekebisho ya madeni yanayosubiri idhini') }}</h3>
        <button lsmsButton="text" size="sm" icon="refresh" (click)="load()">{{ i18n.t('Refresh', 'Onyesha upya') }}</button>
      </header>
      @if (loading()) {
        <lsms-skeleton variant="list" [rows]="3" />
      } @else if (error()) {
        <lsms-empty-state icon="error" iconColor="var(--c-error)" [title]="i18n.t('Could not load', 'Imeshindikana kupakia')" [message]="error()!" />
      } @else if (!list().length) {
        <lsms-empty-state icon="task_alt" iconColor="var(--c-success)" [title]="i18n.t('Nothing to approve', 'Hakuna cha kuidhinisha')" [message]="i18n.t('Corrections above the limit appear here.', 'Marekebisho yaliyozidi kikomo yataonekana hapa.')" />
      } @else {
        <ul>
          @for (a of list(); track a.uid) {
            <li>
              <div class="top">
                <span class="who">
                  <b>{{ a.customerName || i18n.t('Walk-in', 'Kawaida') }}</b>
                  <small>{{ a.receiptNumber }} · {{ type(a.type) }}@if (a.isFullVoid) { · {{ i18n.t('full void', 'deni lote') }} }</small>
                </span>
                <span class="amt"><b>{{ a.amount | money }}</b><small>{{ i18n.t('of', 'kati ya') }} {{ a.outstandingAtRequest | money: { symbol: false } }}</small></span>
              </div>
              <p class="reason">“{{ a.reason }}” <small>— {{ a.requesterName || '—' }}, {{ date(a.requestedAt) | date: 'dd MMM, HH:mm' }}</small></p>
              @if (acting() === a.uid) {
                <lsms-text-field type="textarea" [rows]="2" [autofocus]="true" [label]="mode() === 'reject' ? i18n.t('Reason for rejecting', 'Sababu ya kukataa') : i18n.t('Note (optional)', 'Maelezo (hiari)')" (valueChange)="note.set($event)" />
                <div class="acts">
                  <button lsmsButton="secondary" size="sm" [disabled]="busy()" (click)="acting.set(null)">{{ i18n.t('Back', 'Rudi') }}</button>
                  <button [lsmsButton]="mode() === 'reject' ? 'danger' : 'success'" size="sm" [loading]="busy()" [disabled]="mode() === 'reject' && !note().trim()" (click)="confirm(a)">
                    {{ mode() === 'reject' ? i18n.t('Reject', 'Kataa') : i18n.t('Approve', 'Idhinisha') }}
                  </button>
                </div>
              } @else if (a.requesterUid === me) {
                <p class="mine"><lsms-icon name="hourglass_top" [size]="14" />{{ i18n.t('Your request — another manager must approve it.', 'Ombi lako — meneja mwingine lazima aliidhinishe.') }}</p>
              } @else {
                <div class="acts">
                  <button lsmsButton="secondary" size="sm" icon="cancel" (click)="start(a, 'reject')">{{ i18n.t('Reject', 'Kataa') }}</button>
                  <button lsmsButton="success" size="sm" icon="verified" (click)="start(a, 'approve')">{{ i18n.t('Approve', 'Idhinisha') }}</button>
                </div>
              }
            </li>
          }
        </ul>
      }
    </div>
  `,
  styles: `
    .card { border-radius: 16px; background: var(--c-surface); border: 1px solid var(--c-border); padding: 14px 16px; }
    header { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 10px; }
    h3 { display: flex; align-items: center; gap: 6px; font-size: 0.95rem; font-weight: 800; margin: 0; }
    h3 lsms-icon { color: var(--c-primary); }
    ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 10px; }
    li { padding: 12px 14px; border-radius: 14px; background: var(--c-bg); border: 1px solid var(--c-border); }
    .top { display: flex; justify-content: space-between; gap: 12px; }
    .who, .amt { display: flex; flex-direction: column; }
    .amt { align-items: flex-end; }
    .amt b { font-size: 1.05rem; font-weight: 800; color: var(--c-error); font-variant-numeric: tabular-nums; }
    small { font-size: 0.72rem; color: var(--c-text-2); }
    .reason { margin: 8px 0; font-size: 0.84rem; }
    .acts { display: flex; justify-content: flex-end; gap: 8px; margin-top: 8px; }
    .mine { display: flex; align-items: center; gap: 6px; font-size: 0.78rem; color: var(--c-warning); }
  `,
})
export class DebtApprovalsPanel {
  protected readonly i18n = inject(LanguageService);
  private readonly api = inject(DebtService);
  private readonly toast = inject(ToastService);

  readonly changed = output<void>();

  protected readonly me = inject(AuthService).user()?.uid ?? null;
  protected readonly list = signal<DebtAdjustment[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly acting = signal<string | null>(null);
  protected readonly mode = signal<'approve' | 'reject'>('approve');
  protected readonly note = signal('');
  protected readonly busy = signal(false);

  constructor() {
    void this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      this.list.set(await this.api.pending());
    } catch (e) {
      this.error.set(ApiError.from(e).message);
    } finally {
      this.loading.set(false);
    }
  }

  protected type(t: string): string {
    const x = DEBT_TYPES[t as DebtAdjustmentType];
    return x ? (this.i18n.isSwahili() ? x.sw : x.en) : t;
  }

  protected date(v: string | null): Date | null {
    return parseLocal(v);
  }

  protected start(a: DebtAdjustment, m: 'approve' | 'reject'): void {
    this.note.set('');
    this.mode.set(m);
    this.acting.set(a.uid);
  }

  protected async confirm(a: DebtAdjustment): Promise<void> {
    this.busy.set(true);
    try {
      if (this.mode() === 'approve') await this.api.approve(a.uid, this.note().trim() || null);
      else await this.api.reject(a.uid, this.note().trim());
      this.toast.success(this.mode() === 'approve' ? this.i18n.t('Correction approved', 'Marekebisho yameidhinishwa') : this.i18n.t('Correction rejected', 'Marekebisho yamekataliwa'));
      this.acting.set(null);
      this.changed.emit();
      await this.load();
    } catch (e) {
      this.toast.error(ApiError.from(e).message);
    } finally {
      this.busy.set(false);
    }
  }
}
