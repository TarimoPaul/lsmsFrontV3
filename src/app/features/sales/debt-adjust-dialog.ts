import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { map } from 'rxjs';

import { ApiError } from '@core/api/api.types';
import { AuthService } from '@core/auth/auth.service';
import { LanguageService } from '@core/i18n/language.service';
import { Button, DialogShell, Icon, TextField, ToastService } from '@shared/ui';
import { parseLocal } from '@shared/utils/date-utils';
import { Money, MoneyPipe } from '@shared/utils/money';
import { DEBT_STATUS, DEBT_TYPES, DebtAdjustment, DebtAdjustmentType, DebtService } from './debt.service';
import { Sale } from './sales.models';

export interface DebtAdjustData {
  sale: Sale;
}

/**
 * Reduce a sale's balance without cash — port of Flutter's debt adjustment
 * request (waive / write off / correction) plus the sale's adjustment history.
 * Shows up front whether the request applies at once or needs a checker.
 */
@Component({
  selector: 'app-debt-adjust-dialog',
  imports: [ReactiveFormsModule, DialogShell, Button, Icon, TextField, MoneyPipe, DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <lsms-dialog [title]="i18n.t('Adjust debt', 'Rekebisha deni') + ' · ' + data.sale.receiptNumber" icon="money_off">
      <div class="due">
        <span><small>{{ i18n.t('Customer', 'Mteja') }}</small><b>{{ data.sale.customerName || i18n.t('Walk-in', 'Kawaida') }}</b></span>
        <span class="amt"><small>{{ i18n.t('Balance', 'Deni') }}</small><b>{{ data.sale.balance | money }}</b></span>
      </div>

      @if (allowed().length) {
        <span class="lbl">{{ i18n.t('What kind?', 'Aina gani?') }}</span>
        <div class="types" role="radiogroup">
          @for (t of allowed(); track t) {
            <button type="button" role="radio" [attr.aria-checked]="type() === t" [class.on]="type() === t" (click)="type.set(t)">
              <b>{{ i18n.isSwahili() ? types[t].sw : types[t].en }}</b>
              <small>{{ i18n.isSwahili() ? types[t].hint.sw : types[t].hint.en }}</small>
            </button>
          }
        </div>

        <lsms-text-field type="currency" [formControl]="amountCtrl" [label]="i18n.t('Amount', 'Kiasi')" [required]="true" [hint]="i18n.t('Up to ', 'Hadi ') + money(data.sale.balance)" />
        <div class="quick">
          <button type="button" (click)="amountCtrl.setValue(data.sale.balance)">{{ i18n.t('Whole balance', 'Deni lote') }}</button>
        </div>
        <lsms-text-field type="textarea" [rows]="2" [maxLength]="500" [required]="true" [label]="i18n.t('Reason', 'Sababu')" (valueChange)="reason.set($event)" />

        @if (amount() > 0) {
          <p class="flow" [class.wait]="needsChecker()">
            <lsms-icon [name]="needsChecker() ? 'how_to_reg' : 'bolt'" [size]="16" />
            @if (needsChecker()) {
              {{ i18n.t('Above the limit — another manager must approve it.', 'Juu ya kikomo — meneja mwingine lazima aidhinishe.') }}
            } @else {
              {{ i18n.t('Applied at once and recorded in the ledger.', 'Inatumika mara moja na kurekodiwa kwenye leja.') }}
            }
          </p>
        }
      } @else {
        <p class="muted">{{ i18n.t('You are not allowed to adjust debts.', 'Huruhusiwi kurekebisha madeni.') }}</p>
      }

      @if (history().length) {
        <section class="hist">
          <h4><lsms-icon name="history" [size]="15" />{{ i18n.t('Earlier adjustments', 'Marekebisho ya awali') }}</h4>
          @for (h of history(); track h.uid) {
            @let st = status(h.status);
            <div class="h">
              <span><b>{{ typeName(h.type) }}</b> · {{ h.amount | money }}<small>{{ h.reason }}</small></span>
              <span class="r"><span class="pill" [style.--st]="st.color">{{ i18n.isSwahili() ? st.sw : st.en }}</span><small>{{ date(h.requestedAt) | date: 'dd MMM yyyy' }} · {{ h.requesterName || '—' }}</small></span>
            </div>
          }
        </section>
      }

      <ng-container dialogActions>
        <button lsmsButton="secondary" (click)="ref.close()">{{ i18n.t('Cancel', 'Ghairi') }}</button>
        <button lsmsButton icon="money_off" [loading]="busy()" [disabled]="!canSend()" (click)="send()">{{ needsChecker() ? i18n.t('Send for approval', 'Tuma kwa idhini') : i18n.t('Apply', 'Tumia') }}</button>
      </ng-container>
    </lsms-dialog>
  `,
  styles: `
    :host { display: block; }
    .due { display: flex; justify-content: space-between; gap: 12px; margin-bottom: 12px; padding: 12px 14px; border-radius: 14px; background: var(--c-bg); border: 1px solid var(--c-border); }
    .due span { display: flex; flex-direction: column; }
    .due small { font-size: 0.72rem; color: var(--c-text-2); }
    .due .amt { align-items: flex-end; }
    .due .amt b { font-size: 1.2rem; font-weight: 800; color: var(--c-error); font-variant-numeric: tabular-nums; }
    .lbl { display: block; margin-bottom: 6px; font-size: 0.8rem; font-weight: 600; color: var(--c-text-2); }
    .types { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; margin-bottom: 10px; }
    .types button { display: flex; flex-direction: column; gap: 2px; padding: 10px; border-radius: 12px; border: 1px solid var(--c-border); background: var(--c-surface); font: inherit; text-align: left; color: var(--c-text); cursor: pointer; }
    .types button small { font-size: 0.7rem; color: var(--c-text-2); }
    .types button.on { border-color: var(--c-primary); box-shadow: 0 0 0 1px var(--c-primary); background: color-mix(in srgb, var(--c-primary) 6%, var(--c-surface)); }
    @media (max-width: 560px) { .types { grid-template-columns: 1fr; } }
    .quick { display: flex; gap: 6px; margin: -4px 0 8px; }
    .quick button { padding: 2px 10px; border-radius: 100px; border: 1px solid var(--c-border); background: var(--c-surface); font: inherit; font-size: 0.72rem; font-weight: 700; color: var(--c-primary); cursor: pointer; }
    .flow { display: flex; align-items: center; gap: 8px; margin-top: 8px; padding: 10px 12px; border-radius: 12px; font-size: 0.82rem; font-weight: 600; color: var(--c-success); background: color-mix(in srgb, var(--c-success) 8%, transparent); }
    .flow.wait { color: var(--c-warning); background: color-mix(in srgb, var(--c-warning) 10%, transparent); }
    .hist { margin-top: 14px; }
    .hist h4 { display: flex; align-items: center; gap: 6px; margin-bottom: 8px; font-size: 0.72rem; font-weight: 800; letter-spacing: 0.8px; text-transform: uppercase; color: var(--c-text-2); }
    .h { display: flex; justify-content: space-between; gap: 10px; padding: 8px 0; border-top: 1px dashed var(--c-border); font-size: 0.82rem; }
    .h span { display: flex; flex-direction: column; min-width: 0; }
    .h small { font-size: 0.7rem; color: var(--c-text-2); }
    .h .r { align-items: flex-end; }
    .pill { padding: 2px 8px; border-radius: 100px; font-size: 0.7rem; font-weight: 700; color: var(--st); background: color-mix(in srgb, var(--st) 11%, transparent); }
    .muted { color: var(--c-text-2); font-size: 0.86rem; }
  `,
})
export class DebtAdjustDialog {
  protected readonly data = inject<DebtAdjustData>(DIALOG_DATA);
  protected readonly ref = inject<DialogRef<boolean>>(DialogRef);
  protected readonly i18n = inject(LanguageService);
  private readonly auth = inject(AuthService);
  private readonly api = inject(DebtService);
  private readonly toast = inject(ToastService);

  protected readonly types = DEBT_TYPES;
  protected readonly allowed = computed(() => (Object.keys(DEBT_TYPES) as DebtAdjustmentType[]).filter((t) => this.auth.hasPermission(DEBT_TYPES[t].permission)));
  protected readonly type = signal<DebtAdjustmentType>(this.allowed()[0] ?? 'CORRECTION');
  protected readonly amountCtrl = new FormControl<number | null>(null);
  protected readonly amount = toSignal(this.amountCtrl.valueChanges.pipe(map((v) => Number(v) || 0)), { initialValue: 0 });
  protected readonly reason = signal('');
  protected readonly busy = signal(false);
  protected readonly history = signal<DebtAdjustment[]>([]);

  /** Backend rule: only CORRECTIONs above 100,000 (20,000 when voiding everything) need a checker. */
  protected readonly needsChecker = computed(() => {
    if (this.type() !== 'CORRECTION') return false;
    const full = Math.abs(this.amount() - this.data.sale.balance) < 0.01;
    return full ? this.amount() > 20_000 : this.amount() > 100_000;
  });
  protected readonly canSend = computed(
    () => !this.busy() && this.allowed().includes(this.type()) && this.amount() > 0 && this.amount() <= this.data.sale.balance + 0.01 && this.reason().trim().length >= 3,
  );

  constructor() {
    this.api
      .bySale(this.data.sale.uid)
      .then((h) => this.history.set(h))
      .catch(() => undefined);
  }

  protected money(v: number): string {
    return Money.format(v);
  }

  protected typeName(t: string): string {
    const x = DEBT_TYPES[t as DebtAdjustmentType];
    return x ? (this.i18n.isSwahili() ? x.sw : x.en) : t;
  }

  protected status(s: string) {
    return DEBT_STATUS[s] ?? DEBT_STATUS['PENDING'];
  }

  protected date(v: string | null): Date | null {
    return parseLocal(v);
  }

  protected async send(): Promise<void> {
    if (!this.canSend()) return;
    this.busy.set(true);
    try {
      const res = await this.api.create(this.data.sale.uid, this.type(), this.amount(), this.reason().trim());
      this.toast.success(
        res.status === 'PENDING'
          ? this.i18n.t('Sent — waiting for a checker', 'Imetumwa — inasubiri mkaguzi')
          : this.i18n.t(`Balance reduced by ${Money.format(res.amount)}`, `Deni limepunguzwa kwa ${Money.format(res.amount)}`),
      );
      this.ref.close(true);
    } catch (e) {
      this.toast.error(ApiError.from(e).message);
    } finally {
      this.busy.set(false);
    }
  }
}
