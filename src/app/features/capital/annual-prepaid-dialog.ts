import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';

import { AuthService } from '@core/auth/auth.service';

import { ApiError } from '@core/api/api.types';
import { LanguageService } from '@core/i18n/language.service';
import { Button, DialogShell, Icon } from '@shared/ui';
import { MoneyPipe } from '@shared/utils/money';
import { moneyAccountByMethod } from '../general-ledger/money-accounts';
import { typeLabel } from './capital.models';
import { AnnualPrepaid, CapitalService } from './capital.service';

export interface AnnualPrepaidData {
  canApprove: boolean;
}

/**
 * G5 (toleo 2, owner dp): annual expenses paid up front. Each shows its months (in the books or planned) and what is
 * still in Prepaid (1160). Approve = Dr 1160 / Cr source + the monthly rows; cancel reverses all of it.
 */
@Component({
  selector: 'app-annual-prepaid-dialog',
  imports: [DialogShell, Button, Icon, MoneyPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <lsms-dialog [title]="i18n.t('Annual expenses (paid up front)', 'Gharama za mwaka (zilizolipwa mapema)')" icon="savings">
      @if (loading()) {
        <p class="muted">{{ i18n.t('Loading…', 'Inapakia…') }}</p>
      } @else if (!items().length) {
        <p class="info"><lsms-icon name="info" [size]="16" />{{ i18n.t('None yet. Record one from “New expense” → “Paid for the year up front”.', 'Hakuna bado. Iandike kwenye “Gharama mpya” → “Imelipwa kwa mwaka, mapema”.') }}</p>
      } @else {
        @if (selfCount()) {
          <div class="chips">
            <button type="button" [class.on]="!onlySelf()" (click)="onlySelf.set(false)">{{ i18n.t('All', 'Zote') }} ({{ items().length }})</button>
            <button type="button" [class.on]="onlySelf()" (click)="onlySelf.set(true)">{{ i18n.t('Self-approved', 'Zilizojiidhinisha') }} ({{ selfCount() }})</button>
          </div>
        }
        @for (p of shown(); track p.uid) {
          <div class="row" [class.off]="p.status === 'CANCELLED' || p.status === 'REJECTED'">
            <div class="head">
              <div class="main">
                <strong>{{ p.description }}</strong>
                <small>{{ p.referenceNumber }} · {{ type(p.capitalType) }} · {{ i18n.t('paid', 'imelipwa') }} {{ p.paymentDate }} {{ i18n.t('from', 'kutoka') }} {{ method(p.paymentMethod) }}@if (p.createdBy) { · {{ i18n.t('by', 'na') }} {{ p.createdBy }} }</small>
              </div>
              <div class="amt">
                <b>{{ p.totalAmount | money: { decimals: 0 } }}</b>
                <span class="pill" [attr.data-s]="p.status">{{ statusLabel(p.status) }}</span>
                @if (p.selfApproved) { <span class="pill self">{{ i18n.t('Self-approved', 'Imejiidhinisha') }}</span> }
              </div>
            </div>
            @if (p.status === 'APPROVED') {
              <small class="left">{{ i18n.t('In expenses so far', 'Imeingia gharama hadi sasa') }} <b>{{ p.expensed | money: { decimals: 0 } }}</b> · {{ i18n.t('still prepaid (1160)', 'bado imelipwa mapema (1160)') }} <b>{{ p.prepaidLeft | money: { decimals: 0 } }}</b></small>
            }
            @if (p.approvalReason) {
              <small class="left" [class.selfnote]="p.selfApproved">{{ p.selfApproved ? i18n.t('Approved by the maker', 'Imeidhinishwa na aliyeiingiza') : i18n.t('Approval note', 'Maelezo ya idhini') }} ({{ p.approvedBy }}@if (p.approvedAt) { · {{ p.approvedAt.slice(0, 16).replace('T', ' ') }} }): {{ p.approvalReason }}</small>
            }
            @if (p.closeReason) { <small class="left">{{ i18n.t('Reason', 'Sababu') }}: {{ p.closeReason }}</small> }
            <div class="months">
              @for (m of p.monthRows; track m.month) {
                <span class="m" [class.on]="m.inBooks" [title]="m.inBooks ? i18n.t('in the books', 'iko GL') : i18n.t('planned', 'imepangwa')">{{ m.month }}<i>{{ m.amount | money: { decimals: 0 } }}</i></span>
              }
            </div>
            @if (data.canApprove && (p.status === 'PENDING' || p.status === 'APPROVED')) {
              @if (approving() === p.uid) {
                <div class="inline">
                  <small class="selfnote">{{ i18n.t('You entered this yourself. Only a CEO may approve their own entry, with a reason (at least 10 letters). It is recorded and shown to reviewers.', 'Uliiingiza mwenyewe. CEO pekee anaweza kuidhinisha aliyoiingiza, kwa sababu (angalau herufi 10). Inarekodiwa na kuonekana kwa wakaguzi.') }}</small>
                  <input type="text" maxlength="300" [value]="reason()" (input)="reason.set($any($event.target).value)" [placeholder]="i18n.t('Why you approve it yourself', 'Kwa nini unaidhinisha mwenyewe')" />
                  <button lsmsButton="secondary" size="sm" (click)="approving.set(null)">{{ i18n.t('Back', 'Rudi') }}</button>
                  <button lsmsButton="success" size="sm" [disabled]="reason().trim().length < 10" [loading]="busy()" (click)="approve(p)">{{ i18n.t('Approve', 'Idhinisha') }}</button>
                </div>
              } @else if (acting() === p.uid) {
                <div class="inline">
                  <input type="text" maxlength="300" [value]="reason()" (input)="reason.set($any($event.target).value)" [placeholder]="i18n.t('Reason (at least 5 letters)', 'Sababu (angalau herufi 5)')" />
                  <button lsmsButton="secondary" size="sm" (click)="acting.set(null)">{{ i18n.t('Back', 'Rudi') }}</button>
                  <button lsmsButton="danger" size="sm" [disabled]="reason().trim().length < 5" [loading]="busy()" (click)="close(p)">{{ p.status === 'PENDING' ? i18n.t('Reject', 'Kataa') : i18n.t('Cancel it', 'Ibatilishe') }}</button>
                </div>
              } @else {
                <div class="acts">
                  @if (p.status === 'PENDING') {
                    <button lsmsButton="success" size="sm" icon="check" [loading]="busy()" (click)="mine(p) ? askApprove(p.uid) : approve(p)">{{ i18n.t('Approve', 'Idhinisha') }}</button>
                    <button lsmsButton="text" size="sm" (click)="ask(p.uid)">{{ i18n.t('Reject', 'Kataa') }}</button>
                  } @else {
                    <button lsmsButton="text" size="sm" icon="undo" (click)="ask(p.uid)">{{ i18n.t('Cancel', 'Batilisha') }}</button>
                  }
                </div>
              }
            }
          </div>
        }
      }
      @if (error()) { <p class="err">{{ error() }}</p> }
      <ng-container dialogActions>
        <button lsmsButton="secondary" (click)="ref.close(changed)">{{ i18n.t('Close', 'Funga') }}</button>
      </ng-container>
    </lsms-dialog>
  `,
  styles: `
    .muted { color: var(--c-text-2); }
    .info { display: flex; align-items: flex-start; gap: 8px; margin: 0; padding: 10px 12px; border-radius: 12px; font-size: 0.8rem; background: color-mix(in srgb, var(--c-info) 8%, transparent); }
    .err { margin: 8px 0 0; font-size: 0.82rem; color: var(--c-error); }
    .row { display: flex; flex-direction: column; gap: 8px; padding: 12px; border: 1px solid var(--c-border); border-radius: 12px; margin-bottom: 8px; }
    .row.off { opacity: 0.6; }
    .head { display: flex; justify-content: space-between; gap: 12px; }
    .main { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
    .main small, .left { font-size: 0.74rem; color: var(--c-text-2); }
    .amt { display: flex; flex-direction: column; align-items: flex-end; gap: 4px; }
    .pill { font-size: 0.7rem; font-weight: 500; padding: 2px 8px; border-radius: 999px; color: var(--c-text-2); background: color-mix(in srgb, var(--c-text) 6%, transparent); white-space: nowrap; }
    .pill[data-s='PENDING'] { color: var(--c-warning); background: color-mix(in srgb, var(--c-warning) 12%, transparent); }
    .pill[data-s='APPROVED'] { color: var(--c-success); background: color-mix(in srgb, var(--c-success) 12%, transparent); }
    .months { display: grid; grid-template-columns: repeat(auto-fill, minmax(86px, 1fr)); gap: 4px; }
    .m { display: flex; flex-direction: column; padding: 4px 6px; border-radius: 8px; font-size: 0.7rem; color: var(--c-text-2); border: 1px dashed var(--c-border); }
    .m i { font-style: normal; color: var(--c-text); }
    .m.on { border-style: solid; border-color: color-mix(in srgb, var(--c-success) 45%, var(--c-border)); background: color-mix(in srgb, var(--c-success) 6%, transparent); }
    .pill.self { color: var(--c-warning); background: color-mix(in srgb, var(--c-warning) 14%, transparent); }
    .selfnote { color: var(--c-warning); }
    .chips { display: flex; gap: 6px; margin-bottom: 10px; }
    .chips button { padding: 6px 12px; border-radius: 100px; border: 1px solid var(--c-border); background: var(--c-surface); font: inherit; font-size: 0.78rem; color: var(--c-text); cursor: pointer; }
    .chips button.on { border-color: var(--c-primary); color: var(--c-primary); font-weight: 500; }
    .acts, .inline { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
    .inline input { flex: 1; min-width: 180px; padding: 8px 10px; border: 1px solid var(--c-border); border-radius: 10px; background: var(--c-input-fill); font: inherit; font-size: 0.85rem; color: var(--c-text); }
  `,
})
export class AnnualPrepaidDialog {
  protected readonly ref = inject<DialogRef<boolean>>(DialogRef);
  protected readonly data = inject<AnnualPrepaidData>(DIALOG_DATA);
  protected readonly i18n = inject(LanguageService);
  private readonly api = inject(CapitalService);

  protected readonly items = signal<AnnualPrepaid[]>([]);
  protected readonly loading = signal(true);
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly acting = signal<string | null>(null);
  protected readonly reason = signal('');
  protected readonly approving = signal<string | null>(null);
  protected readonly onlySelf = signal(false);
  protected changed = false;
  private readonly auth = inject(AuthService);
  protected readonly selfCount = computed(() => this.items().filter((p) => p.selfApproved).length);
  protected readonly shown = computed(() => (this.onlySelf() ? this.items().filter((p) => p.selfApproved) : this.items()));

  constructor() {
    void this.load();
  }

  private async load(): Promise<void> {
    try {
      this.items.set(await this.api.annualPrepaid());
    } catch (e) {
      this.error.set(ApiError.from(e).message);
    } finally {
      this.loading.set(false);
    }
  }

  protected ask(uid: string): void {
    this.reason.set('');
    this.acting.set(uid);
  }

  /** (dz) the maker's own entry: createdBy is "First Last" of the user who recorded it. */
  protected mine(p: AnnualPrepaid): boolean {
    const u = this.auth.user();
    return !!u && !!p.createdBy && `${u.firstName} ${u.lastName}`.trim().toLowerCase() === p.createdBy.trim().toLowerCase();
  }

  protected askApprove(uid: string): void {
    this.reason.set('');
    this.acting.set(null);
    this.approving.set(uid);
  }

  protected async approve(p: AnnualPrepaid): Promise<void> {
    const why = this.approving() === p.uid ? this.reason().trim() : undefined;
    await this.run(() => this.api.approveAnnualPrepaid(p.uid, why));
  }

  protected async close(p: AnnualPrepaid): Promise<void> {
    const why = this.reason().trim();
    await this.run(() => (p.status === 'PENDING' ? this.api.rejectAnnualPrepaid(p.uid, why) : this.api.cancelAnnualPrepaid(p.uid, why)));
  }

  private async run(action: () => Promise<AnnualPrepaid>): Promise<void> {
    this.busy.set(true);
    this.error.set(null);
    try {
      const updated = await action();
      this.items.update((l) => l.map((x) => (x.uid === updated.uid ? updated : x)));
      this.changed = true;
      this.acting.set(null);
      this.approving.set(null);
    } catch (e) {
      this.error.set(ApiError.from(e).message);
    } finally {
      this.busy.set(false);
    }
  }

  protected type(t: string): string {
    return typeLabel(t, this.i18n.isSwahili());
  }

  protected method(m: string): string {
    const a = moneyAccountByMethod(m);
    return this.i18n.isSwahili() ? a.sw : a.en;
  }

  protected statusLabel(s: AnnualPrepaid['status']): string {
    const t = this.i18n.t.bind(this.i18n);
    return s === 'PENDING' ? t('Awaiting approval', 'Inasubiri idhini') : s === 'APPROVED' ? t('Approved', 'Imeidhinishwa') : s === 'REJECTED' ? t('Rejected', 'Imekataliwa') : t('Cancelled · reversed', 'Imebatilishwa · imerekebishwa');
  }
}
