import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';

import { LanguageService } from '@core/i18n/language.service';
import { Button, DialogShell, Icon } from '@shared/ui';
import { MoneyPipe } from '@shared/utils/money';
import { RECON_BANKS, SafeBoxDeposit, SafeBoxDepositType } from './recon-extra.models';
import { DepositRequest } from './safe-box.service';

export interface SafeBoxDepositData {
  cashEntryUid: string | null;
  /** Still in the safe (confirmed deposits already taken off). */
  remaining: number;
  recipients: Array<{ uid: string; name: string }>;
  /** Edit this still-pending deposit. */
  editing?: SafeBoxDeposit;
}

/**
 * Submit / edit a Safe Box deposit — port of Flutter `_showSubmitDialog`:
 * how much (≤ what is still in the safe), banked (bank + receipt) or handed
 * to a manager (who). Closes with the request.
 */
@Component({
  selector: 'app-safe-box-deposit-dialog',
  imports: [DialogShell, Button, Icon, MoneyPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <lsms-dialog [title]="data.editing ? i18n.t('Edit deposit', 'Hariri deposit') : i18n.t('Submit a deposit', 'Wasilisha deposit')" icon="lock_open">
      <p class="left"><lsms-icon name="lock" [size]="16" />{{ i18n.t('Still in the safe', 'Bado safeni') }} <b>{{ data.remaining | money }}</b></p>

      <div class="form">
        <label>
          <span>{{ i18n.t('Amount', 'Kiasi') }} *</span>
          <input type="text" inputmode="numeric" [value]="amountText()" (input)="amountText.set($any($event.target).value)" />
          @if (tooMuch()) {
            <small class="err">{{ i18n.t('More than what is left', 'Kinazidi kilichobaki') }} ({{ data.remaining | money }})</small>
          }
        </label>

        <div class="seg" role="radiogroup">
          <button type="button" role="radio" [class.on]="type() === 'BANK_DEPOSIT'" (click)="type.set('BANK_DEPOSIT')"><lsms-icon name="account_balance" [size]="16" />{{ i18n.t('Bank deposit', 'Deposit benki') }}</button>
          <button type="button" role="radio" [class.on]="type() === 'HAND_OVER'" (click)="type.set('HAND_OVER')"><lsms-icon name="handshake" [size]="16" />{{ i18n.t('Hand to a manager', 'Kabidhi kwa meneja') }}</button>
        </div>

        @if (type() === 'BANK_DEPOSIT') {
          <div class="chips">
            @for (b of banks; track b) {
              <button type="button" [class.on]="bank() === b" (click)="bank.set(b)">{{ b === 'OTHER' ? i18n.t('Other', 'Nyingine') : b }}</button>
            }
          </div>
          @if (bank() === 'OTHER') {
            <label>
              <span>{{ i18n.t('Bank name', 'Jina la benki') }} *</span>
              <input type="text" maxlength="60" [value]="otherBank()" (input)="otherBank.set($any($event.target).value)" />
            </label>
          }
          <label>
            <span>{{ i18n.t('Receipt no. (optional)', 'Namba ya risiti (hiari)') }}</span>
            <input type="text" maxlength="60" [value]="receipt()" (input)="receipt.set($any($event.target).value)" />
          </label>
        } @else {
          <span class="lbl">{{ i18n.t('Received by', 'Anayepokea') }} *</span>
          @if (data.recipients.length) {
            <div class="chips">
              @for (r of data.recipients; track r.uid) {
                <button type="button" [class.on]="recipient() === r.uid" (click)="recipient.set(r.uid)"><lsms-icon name="person" [size]="14" />{{ r.name }}</button>
              }
            </div>
          } @else {
            <small class="err">{{ i18n.t('No manager can receive it.', 'Hakuna meneja wa kupokea.') }}</small>
          }
        }
      </div>

      <ng-container dialogActions>
        <button lsmsButton="secondary" (click)="ref.close()">{{ i18n.t('Cancel', 'Ghairi') }}</button>
        <button lsmsButton icon="send" [disabled]="!valid()" (click)="save()">{{ data.editing ? i18n.t('Save', 'Hifadhi') : i18n.t('Submit', 'Wasilisha') }}</button>
      </ng-container>
    </lsms-dialog>
  `,
  styles: `
    .left { display: flex; align-items: center; gap: 6px; margin-bottom: 12px; padding: 10px 12px; border-radius: 12px; font-size: 0.84rem; background: var(--c-bg); }
    .left b { margin-left: auto; font-variant-numeric: tabular-nums; }
    .form { display: flex; flex-direction: column; gap: 12px; }
    label { display: flex; flex-direction: column; gap: 4px; font-size: 0.76rem; font-weight: 600; color: var(--c-text-2); }
    .lbl { font-size: 0.76rem; font-weight: 600; color: var(--c-text-2); }
    input { padding: 9px 10px; border: 1px solid var(--c-border); border-radius: 10px; background: var(--c-input-fill); font: inherit; font-size: 0.86rem; color: var(--c-text); outline: none; }
    input:focus { border-color: var(--c-primary); }
    .err { color: var(--c-error); font-weight: 500; }
    .seg { display: inline-flex; align-self: flex-start; padding: 3px; border-radius: 12px; border: 1px solid var(--c-border); background: var(--c-surface); }
    .seg button { display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px; border: 0; border-radius: 9px; background: transparent; font: inherit; font-size: 0.8rem; font-weight: 600; color: var(--c-text-2); cursor: pointer; }
    .seg button.on { color: var(--c-on-primary); background: var(--c-primary); }
    .chips { display: flex; flex-wrap: wrap; gap: 6px; }
    .chips button { display: inline-flex; align-items: center; gap: 5px; padding: 6px 12px; border-radius: 100px; border: 1px solid var(--c-border); background: var(--c-bg); font: inherit; font-size: 0.78rem; font-weight: 600; color: var(--c-text); cursor: pointer; }
    .chips button.on { color: var(--c-on-primary); background: var(--c-primary); border-color: var(--c-primary); }
  `,
})
export class SafeBoxDepositDialog {
  protected readonly data = inject<SafeBoxDepositData>(DIALOG_DATA);
  protected readonly ref = inject<DialogRef<DepositRequest>>(DialogRef);
  protected readonly i18n = inject(LanguageService);

  protected readonly banks = RECON_BANKS;
  private readonly e = this.data.editing;
  protected readonly amountText = signal(String(this.e?.amount ?? Math.max(0, Math.round(this.data.remaining))));
  protected readonly type = signal<SafeBoxDepositType>(this.e?.type ?? 'BANK_DEPOSIT');
  protected readonly bank = signal(!this.e?.bankName ? 'NMB' : RECON_BANKS.includes(this.e.bankName) ? this.e.bankName : 'OTHER');
  protected readonly otherBank = signal(this.e?.bankName && !RECON_BANKS.includes(this.e.bankName) ? this.e.bankName : '');
  protected readonly receipt = signal(this.e?.receipt ?? '');
  protected readonly recipient = signal<string | null>(this.e?.recipientUid ?? null);

  protected readonly amount = computed(() => Number(this.amountText().replace(/[^\d.]/g, '')) || 0);
  /** "Remaining" only subtracts CONFIRMED deposits (like Flutter), so pending ones never need adding back. */
  protected readonly tooMuch = computed(() => this.amount() > this.data.remaining + 0.01);
  protected readonly valid = computed(() => {
    if (!(this.amount() > 0) || this.tooMuch()) return false;
    if (this.type() === 'HAND_OVER') return !!this.recipient();
    return this.bank() !== 'OTHER' || this.otherBank().trim().length >= 2;
  });

  protected save(): void {
    if (!this.valid()) return;
    const bankDeposit = this.type() === 'BANK_DEPOSIT';
    this.ref.close({
      cashEntryUid: this.data.cashEntryUid,
      submittedAmount: this.amount(),
      depositType: this.type(),
      bankName: bankDeposit ? (this.bank() === 'OTHER' ? this.otherBank().trim() : this.bank()) : null,
      receiptNumber: bankDeposit ? this.receipt().trim() || null : null,
      recipientUid: bankDeposit ? null : this.recipient(),
    });
  }
}
