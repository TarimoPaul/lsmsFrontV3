import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';

import { ApiError } from '@core/api/api.types';
import { LanguageService } from '@core/i18n/language.service';
import { Button, DialogShell, Icon, MoneyInput, SelectField, SelectOption, Skeleton } from '@shared/ui';
import { parseLocal, toIsoDate } from '@shared/utils/date-utils';
import { Money, MoneyPipe } from '@shared/utils/money';
import { AccountLedger, ControlCheck, eventLabel } from './gl.models';
import { GlService } from './gl.service';
import { MONEY_ACCOUNTS } from './money-accounts';

const parse = (t: string) => Money.parse(t) ?? 0;
const today = () => toIsoDate(new Date());

const FORM = `
  label { display: flex; flex-direction: column; gap: 4px; margin-bottom: 12px; font-size: 0.78rem; font-weight: 600; color: var(--c-text-2); }
  label small { font-weight: 400; }
  input, textarea { padding: 9px 10px; border: 1px solid var(--c-border); border-radius: 10px; background: var(--c-input-fill); font: inherit; font-size: 0.88rem; color: var(--c-text); outline: none; }
  input:focus, textarea:focus { border-color: var(--c-primary); }
  .info { display: flex; align-items: flex-start; gap: 8px; margin: 0 0 12px; padding: 10px 12px; border-radius: 12px; font-size: 0.8rem; color: var(--c-text); background: color-mix(in srgb, var(--c-info) 8%, transparent); }
  .info lsms-icon { color: var(--c-info); flex-shrink: 0; }
  .warn { background: color-mix(in srgb, var(--c-warning) 10%, transparent); }
  .warn lsms-icon { color: var(--c-warning); }
  .err { margin: 0; font-size: 0.82rem; color: var(--c-error); }
  .two { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .chips { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 12px; }
  .chips button { padding: 6px 12px; border-radius: 100px; border: 1px solid var(--c-border); background: var(--c-surface); font: inherit; font-size: 0.78rem; color: var(--c-text); cursor: pointer; }
  .chips button.on { border-color: var(--c-primary); color: var(--c-primary); font-weight: 600; background: color-mix(in srgb, var(--c-primary) 10%, var(--c-surface)); }
`;

// ── Account ledger ─────────────────────────────────────────────────────────

export interface LedgerDialogData {
  accountCode: string;
  start: string;
  end: string;
}

@Component({
  selector: 'app-gl-ledger-dialog',
  imports: [DialogShell, Skeleton, MoneyPipe, DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <lsms-dialog [title]="title()" icon="menu_book">
      @if (!ledger() && !error()) {
        <lsms-skeleton variant="list" [rows]="8" />
      } @else if (error()) {
        <p class="err">{{ error() }}</p>
      } @else if (ledger(); as l) {
        <div class="sum">
          <span><small>{{ i18n.t('Brought forward', 'Salio la mwanzo') }}</small><b>{{ l.openingBalance | money: { decimals: 0 } }}</b></span>
          <span><small>Σ Dr</small><b>{{ l.totalDebits | money: { decimals: 0 } }}</b></span>
          <span><small>Σ Cr</small><b>{{ l.totalCredits | money: { decimals: 0 } }}</b></span>
          <span class="close"><small>{{ i18n.t('Closing balance', 'Salio la mwisho') }}</small><b [class.neg]="l.closingBalance < 0">{{ l.closingBalance | money: { decimals: 0 } }}</b></span>
        </div>
        <div class="scroll">
          <table>
            <thead><tr><th>{{ i18n.t('Date', 'Tarehe') }}</th><th>{{ i18n.t('Entry', 'Ingizo') }}</th><th class="n">Dr</th><th class="n">Cr</th><th class="n">{{ i18n.t('Balance', 'Salio') }}</th></tr></thead>
            <tbody>
              @for (r of l.transactions; track $index) {
                <tr>
                  <td class="d">{{ day(r.entryDate) | date: 'dd MMM yy' }}</td>
                  <td><b>{{ label(r.referenceType) }}</b><small>{{ r.entryNumber }}@if (r.referenceNumber) { · {{ r.referenceNumber }} }</small></td>
                  <td class="n">{{ r.debit ? (r.debit | money: { decimals: 0, symbol: false }) : '' }}</td>
                  <td class="n">{{ r.credit ? (r.credit | money: { decimals: 0, symbol: false }) : '' }}</td>
                  <td class="n" [class.neg]="r.runningBalance < 0">{{ r.runningBalance | money: { decimals: 0, symbol: false } }}</td>
                </tr>
              } @empty {
                <tr><td colspan="5" class="none">{{ i18n.t('No movements in this period', 'Hakuna harakati kipindi hiki') }}</td></tr>
              }
            </tbody>
          </table>
        </div>
      }
    </lsms-dialog>
  `,
  styles: `
    .err { color: var(--c-error); }
    .sum { display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 8px; margin-bottom: 12px; }
    .sum span { display: flex; flex-direction: column; padding: 10px 12px; border-radius: 12px; background: color-mix(in srgb, var(--c-text-2) 6%, transparent); }
    .sum small { font-size: 0.7rem; color: var(--c-text-2); }
    .sum b { font-size: 0.92rem; font-weight: 700; color: var(--c-text); font-variant-numeric: tabular-nums; }
    .sum .close { background: color-mix(in srgb, var(--c-primary) 9%, transparent); }
    .neg { color: var(--c-error) !important; }
    .scroll { overflow-x: auto; }
    table { width: 100%; border-collapse: collapse; font-size: 0.8rem; }
    th { padding: 7px 8px; text-align: left; font-size: 0.68rem; font-weight: 700; text-transform: uppercase; color: var(--c-text-2); border-bottom: 1px solid var(--c-border); }
    td { padding: 7px 8px; border-bottom: 1px solid color-mix(in srgb, var(--c-border) 50%, transparent); color: var(--c-text); vertical-align: top; }
    td b { display: block; font-weight: 500; }
    td small { font-size: 0.7rem; color: var(--c-text-2); }
    .n { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
    .d { white-space: nowrap; color: var(--c-text-2); }
    .none { text-align: center; color: var(--c-text-2); }
  `,
})
export class LedgerDialog {
  protected readonly data = inject<LedgerDialogData>(DIALOG_DATA);
  protected readonly i18n = inject(LanguageService);
  private readonly gl = inject(GlService);

  protected readonly ledger = signal<AccountLedger | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly title = computed(() => {
    const l = this.ledger();
    const name = l ? (this.i18n.isSwahili() ? l.accountNameSw || l.accountName : l.accountName) : '';
    return `${this.data.accountCode} ${name}`.trim();
  });

  constructor() {
    this.gl.ledger(this.data.accountCode, this.data.start, this.data.end).then(
      (l) => this.ledger.set(l),
      (e) => this.error.set(ApiError.from(e).message),
    );
  }

  protected label(t: string | null): string {
    return t ? eventLabel(t, this.i18n.isSwahili()) : '';
  }

  protected day(v: string): Date | null {
    return parseLocal(v);
  }
}

// ── Manual journal ────────────────────────────────────────────────────────

interface Draft {
  account: string | null;
  dr: string;
  cr: string;
  note: string;
}

@Component({
  selector: 'app-gl-manual-journal-dialog',
  imports: [DialogShell, Button, Icon, SelectField, MoneyInput, MoneyPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <lsms-dialog [title]="i18n.t('Manual journal', 'Journal ya mkono')" icon="edit_note">
      <p class="info warn"><lsms-icon name="gavel" [size]="16" />{{ i18n.t('Use for corrections an accountant has checked. Every line is permanent; mistakes are fixed with another journal, never deleted.', 'Tumia kwa marekebisho yaliyokaguliwa na mhasibu. Kila mstari ni wa kudumu; kosa hurekebishwa kwa journal nyingine, halifutwi.') }}</p>
      <div class="two">
        <label><span>{{ i18n.t('Date', 'Tarehe') }}</span><input type="date" [max]="today" [value]="date()" (change)="date.set($any($event.target).value)" /></label>
        <label><span>{{ i18n.t('Reason / memo (required)', 'Sababu (inahitajika)') }}</span><input type="text" maxlength="200" [value]="memo()" (input)="memo.set($any($event.target).value)" /></label>
      </div>
      <div class="lines">
        @for (l of lines(); track $index; let i = $index) {
          <div class="ln">
            <lsms-select-field class="acct" [dense]="true" [options]="accountOptions()" [value]="l.account" [placeholder]="i18n.t('Account', 'Akaunti')" (valueChange)="patch(i, { account: $event })" [ariaLabel]="i18n.t('Account', 'Akaunti')" />
            <input lsmsMoneyInput type="text" placeholder="Dr" [value]="l.dr" (input)="patch(i, { dr: $any($event.target).value, cr: '' })" aria-label="Debit" />
            <input lsmsMoneyInput type="text" placeholder="Cr" [value]="l.cr" (input)="patch(i, { cr: $any($event.target).value, dr: '' })" aria-label="Credit" />
            <button type="button" class="x" [disabled]="lines().length <= 2" (click)="remove(i)" [attr.aria-label]="i18n.t('Remove line', 'Ondoa mstari')"><lsms-icon name="close" [size]="16" /></button>
          </div>
        }
        <button type="button" class="add" (click)="add()"><lsms-icon name="add" [size]="16" />{{ i18n.t('Add line', 'Ongeza mstari') }}</button>
      </div>
      <div class="tot" [class.bad]="!balanced()">
        <span>Σ Dr {{ totals().dr | money: { decimals: 0 } }}</span>
        <span>Σ Cr {{ totals().cr | money: { decimals: 0 } }}</span>
        <b>{{ balanced() ? i18n.t('Balanced', 'Inalingana') : i18n.t('Difference ', 'Tofauti ') + (diff() | money: { decimals: 0 }) }}</b>
      </div>
      @if (error()) { <p class="err">{{ error() }}</p> }
      <ng-container dialogActions>
        <button lsmsButton="secondary" (click)="ref.close()">{{ i18n.t('Cancel', 'Ghairi') }}</button>
        <button lsmsButton="primary" [disabled]="!valid()" [loading]="saving()" (click)="save()">{{ i18n.t('Post journal', 'Andika journal') }}</button>
      </ng-container>
    </lsms-dialog>
  `,
  styles: FORM + `
    .lines { display: flex; flex-direction: column; gap: 8px; margin-bottom: 12px; }
    .ln { display: grid; grid-template-columns: minmax(0, 1fr) 120px 120px 32px; gap: 6px; align-items: center; }
    .ln input { width: 100%; text-align: right; }
    .x, .add { display: inline-flex; align-items: center; justify-content: center; gap: 4px; border: 0; background: transparent; font: inherit; font-size: 0.8rem; font-weight: 600; color: var(--c-primary); cursor: pointer; }
    .x { color: var(--c-text-2); }
    .x:disabled { opacity: 0.3; cursor: default; }
    .add { align-self: flex-start; padding: 4px 0; }
    .tot { display: flex; flex-wrap: wrap; gap: 8px 16px; padding: 10px 12px; margin-bottom: 8px; border-radius: 12px; font-size: 0.82rem; color: var(--c-text); background: color-mix(in srgb, var(--c-success) 8%, transparent); }
    .tot.bad { background: color-mix(in srgb, var(--c-error) 8%, transparent); }
    .tot b { margin-left: auto; }
    @media (max-width: 560px) { .ln { grid-template-columns: 1fr 1fr 32px; } .ln .acct { grid-column: 1 / -1; } }
  `,
})
export class ManualJournalDialog {
  protected readonly ref = inject<DialogRef<boolean>>(DialogRef);
  protected readonly i18n = inject(LanguageService);
  private readonly gl = inject(GlService);

  protected readonly today = today();
  protected readonly date = signal(today());
  protected readonly memo = signal('');
  protected readonly lines = signal<Draft[]>([
    { account: null, dr: '', cr: '', note: '' },
    { account: null, dr: '', cr: '', note: '' },
  ]);
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly accountOptions = computed<SelectOption<string>[]>(() =>
    (this.gl.accounts.value() ?? []).map((a) => ({
      value: a.accountCode,
      label: `${a.accountCode} · ${this.i18n.isSwahili() ? a.accountNameSw || a.accountName : a.accountName}`,
    })),
  );
  protected readonly totals = computed(() =>
    this.lines().reduce((t, l) => ({ dr: t.dr + parse(l.dr), cr: t.cr + parse(l.cr) }), { dr: 0, cr: 0 }),
  );
  protected readonly diff = computed(() => Math.abs(this.totals().dr - this.totals().cr));
  protected readonly balanced = computed(() => this.totals().dr > 0 && this.diff() < 0.01);
  protected readonly valid = computed(() => {
    const used = this.lines().filter((l) => parse(l.dr) > 0 || parse(l.cr) > 0);
    return this.balanced() && used.length >= 2 && used.every((l) => !!l.account) && this.memo().trim().length >= 5;
  });

  constructor() {
    void this.gl.accounts.load();
  }

  protected patch(i: number, p: Partial<Draft>): void {
    this.lines.update((ls) => ls.map((l, j) => (j === i ? { ...l, ...p } : l)));
  }

  protected add(): void {
    this.lines.update((ls) => [...ls, { account: null, dr: '', cr: '', note: '' }]);
  }

  protected remove(i: number): void {
    this.lines.update((ls) => ls.filter((_, j) => j !== i));
  }

  protected async save(): Promise<void> {
    if (!this.valid()) return;
    this.saving.set(true);
    this.error.set(null);
    try {
      await this.gl.manualJournal({
        entryDate: this.date(),
        memo: this.memo().trim(),
        lines: this.lines()
          .filter((l) => l.account && (parse(l.dr) > 0 || parse(l.cr) > 0))
          .map((l) => ({ accountCode: l.account!, debit: parse(l.dr), credit: parse(l.cr) })),
      });
      this.ref.close(true);
    } catch (e) {
      this.error.set(ApiError.from(e).message);
    } finally {
      this.saving.set(false);
    }
  }
}

// ── Transfer between money accounts ───────────────────────────────────────

@Component({
  selector: 'app-gl-transfer-dialog',
  imports: [DialogShell, Button, Icon, MoneyInput],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <lsms-dialog [title]="i18n.t('Move money between accounts', 'Hamisha pesa kati ya akaunti')" icon="swap_horiz">
      <p class="info"><lsms-icon name="info" [size]="16" />{{ i18n.t('E.g. cash deposited to CRDB, or M-Pesa withdrawn to cash. Profit is not affected.', 'Mf. pesa taslimu zimewekwa CRDB, au M-Pesa imetolewa kuwa taslimu. Faida haiguswi.') }}</p>
      <span class="lbl">{{ i18n.t('From', 'Kutoka') }}</span>
      <div class="chips">@for (a of accounts; track a.code) { <button type="button" [class.on]="from() === a.code" (click)="from.set(a.code)">{{ i18n.isSwahili() ? a.sw : a.en }}</button> }</div>
      <span class="lbl">{{ i18n.t('To', 'Kwenda') }}</span>
      <div class="chips">@for (a of accounts; track a.code) { <button type="button" [class.on]="to() === a.code" [disabled]="from() === a.code" (click)="to.set(a.code)">{{ i18n.isSwahili() ? a.sw : a.en }}</button> }</div>
      <div class="two">
        <label><span>{{ i18n.t('Amount', 'Kiasi') }} (TZS)</span><input lsmsMoneyInput type="text" [value]="amount()" (input)="amount.set($any($event.target).value)" /></label>
        <label><span>{{ i18n.t('Date', 'Tarehe') }}</span><input type="date" [max]="today" [value]="date()" (change)="date.set($any($event.target).value)" /></label>
      </div>
      <label><span>{{ i18n.t('Note (optional)', 'Maelezo (hiari)') }}</span><input type="text" maxlength="200" [value]="note()" (input)="note.set($any($event.target).value)" /></label>
      @if (error()) { <p class="err">{{ error() }}</p> }
      <ng-container dialogActions>
        <button lsmsButton="secondary" (click)="ref.close()">{{ i18n.t('Cancel', 'Ghairi') }}</button>
        <button lsmsButton="primary" [disabled]="!valid()" [loading]="saving()" (click)="save()">{{ i18n.t('Record transfer', 'Andika uhamisho') }}</button>
      </ng-container>
    </lsms-dialog>
  `,
  styles: FORM + `
    .lbl { display: block; margin-bottom: 6px; font-size: 0.78rem; font-weight: 600; color: var(--c-text-2); }
    .chips button:disabled { opacity: 0.35; cursor: default; }
  `,
})
export class TransferDialog {
  protected readonly ref = inject<DialogRef<boolean>>(DialogRef);
  protected readonly i18n = inject(LanguageService);
  private readonly gl = inject(GlService);

  protected readonly accounts = MONEY_ACCOUNTS;
  protected readonly today = today();
  protected readonly from = signal('1000');
  protected readonly to = signal('1020');
  protected readonly amount = signal('');
  protected readonly date = signal(today());
  protected readonly note = signal('');
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly valid = computed(() => parse(this.amount()) > 0 && this.from() !== this.to());

  protected async save(): Promise<void> {
    if (!this.valid()) return;
    this.saving.set(true);
    this.error.set(null);
    try {
      await this.gl.transfer({ fromAccount: this.from(), toAccount: this.to(), amount: parse(this.amount()), date: this.date(), note: this.note() });
      this.ref.close(true);
    } catch (e) {
      this.error.set(ApiError.from(e).message);
    } finally {
      this.saving.set(false);
    }
  }
}

// ── True-up: control account → sub-ledger, or cash → physical count ────────

export interface TrueUpDialogData {
  check?: ControlCheck;
  /** Cash / bank / mobile account being counted. */
  cashCode?: string;
  cashBalance?: number;
  asOf: string;
}

@Component({
  selector: 'app-gl-true-up-dialog',
  imports: [DialogShell, Button, Icon, MoneyInput, MoneyPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <lsms-dialog [title]="data.check ? i18n.t('Correct the ledger', 'Rekebisha leja') : i18n.t('Cash count', 'Hesabu ya pesa')" icon="build">
      @if (data.check; as c) {
        <div class="cmp">
          <span><small>GL</small><b>{{ c.glBalance | money: { decimals: 0 } }}</b></span>
          <span><small>{{ i18n.t('Records', 'Kumbukumbu') }}</small><b>{{ c.subLedgerBalance | money: { decimals: 0 } }}</b></span>
          <span class="d"><small>{{ i18n.t('Adjustment', 'Marekebisho') }}</small><b>{{ c.difference | money: { decimals: 0 } }}</b></span>
        </div>
        <p class="info"><lsms-icon name="info" [size]="16" />{{ i18n.t('One journal moves ' + c.label + ' (' + c.accountCode + ') to what the records say. Choose where the other side goes:', 'Journal moja inaweka ' + c.labelSw + ' (' + c.accountCode + ') sawa na kumbukumbu. Chagua upande wa pili:') }}</p>
      } @else {
        <div class="cmp">
          <span><small>{{ i18n.t('GL balance', 'Salio la GL') }} · {{ data.cashCode }}</small><b>{{ data.cashBalance ?? 0 | money: { decimals: 0 } }}</b></span>
        </div>
        <label><span>{{ i18n.t('Actual balance counted / on the statement', 'Salio halisi lililohesabiwa / kwenye taarifa') }} (TZS)</span><input lsmsMoneyInput type="text" [value]="actual()" (input)="actual.set($any($event.target).value)" /></label>
      }
      <div class="opts">
        @for (o of offsets(); track o.code) {
          <button type="button" [class.on]="offset() === o.code" (click)="offset.set(o.code)">
            <b>{{ o.code }} · {{ i18n.isSwahili() ? o.sw : o.en }}</b>
            <small>{{ i18n.isSwahili() ? o.hintSw : o.hint }}</small>
          </button>
        }
      </div>
      <label><span>{{ i18n.t('Reason (required, kept in the audit trail)', 'Sababu (inahitajika, inahifadhiwa kwa ukaguzi)') }}</span><textarea rows="2" maxlength="300" [value]="reason()" (input)="reason.set($any($event.target).value)"></textarea></label>
      @if (error()) { <p class="err">{{ error() }}</p> }
      <ng-container dialogActions>
        <button lsmsButton="secondary" (click)="ref.close()">{{ i18n.t('Cancel', 'Ghairi') }}</button>
        <button lsmsButton="primary" [disabled]="!valid()" [loading]="saving()" (click)="save()">{{ i18n.t('Post correction', 'Andika marekebisho') }}</button>
      </ng-container>
    </lsms-dialog>
  `,
  styles: FORM + `
    .cmp { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 8px; margin-bottom: 12px; }
    .cmp span { display: flex; flex-direction: column; padding: 10px 12px; border-radius: 12px; background: color-mix(in srgb, var(--c-text-2) 6%, transparent); }
    .cmp small { font-size: 0.7rem; color: var(--c-text-2); }
    .cmp b { font-size: 0.92rem; font-weight: 700; color: var(--c-text); font-variant-numeric: tabular-nums; }
    .cmp .d { background: color-mix(in srgb, var(--c-warning) 10%, transparent); }
    .opts { display: flex; flex-direction: column; gap: 6px; margin-bottom: 12px; }
    .opts button { display: flex; flex-direction: column; gap: 2px; padding: 9px 12px; border-radius: 12px; border: 1px solid var(--c-border); background: var(--c-surface); font: inherit; text-align: left; color: var(--c-text); cursor: pointer; }
    .opts button.on { border-color: var(--c-primary); background: color-mix(in srgb, var(--c-primary) 8%, var(--c-surface)); }
    .opts b { font-size: 0.84rem; font-weight: 600; }
    .opts small { font-size: 0.74rem; color: var(--c-text-2); }
  `,
})
export class TrueUpDialog {
  protected readonly data = inject<TrueUpDialogData>(DIALOG_DATA);
  protected readonly ref = inject<DialogRef<boolean>>(DialogRef);
  protected readonly i18n = inject(LanguageService);
  private readonly gl = inject(GlService);

  protected readonly offset = signal('3900');
  protected readonly reason = signal('');
  protected readonly actual = signal('');
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly offsets = computed(() => {
    const o = [
      { code: '3900', en: 'Opening balance equity', sw: 'Salio la kuanzia', hint: 'History from before the GL was switched on', hintSw: 'Historia ya kabla GL haijawashwa' },
    ];
    const key = this.data.check?.key;
    if (key === 'INVENTORY' || key === 'STAFF_RECEIVABLES') {
      o.push({ code: '5100', en: 'Shrinkage', sw: 'Upotevu wa bidhaa', hint: 'A real stock loss / gain of this period', hintSw: 'Upotevu / ongezeko halisi la kipindi hiki' });
    }
    if (key === 'PAYABLES' || key === 'LOANS') {
      o.push({ code: '1000', en: 'Cash on hand', sw: 'Pesa mkononi', hint: 'It was actually paid in cash', hintSw: 'Ililipwa kwa taslimu' });
    }
    if (key === 'LOANS') {
      o.push({ code: '3100', en: 'Owner drawings', sw: 'Mmiliki kutoa pesa', hint: 'A repayment that was wrongly booked as a drawing', hintSw: 'Malipo ya mkopo yaliyoandikwa kimakosa kama mmiliki kutoa' });
    }
    if (key === 'RECEIVABLES') {
      o.push({ code: '6900', en: 'Other expense', sw: 'Gharama nyingine', hint: 'Debts that will not be collected', hintSw: 'Madeni yasiyolipika' });
    }
    if (!this.data.check) {
      o.push({ code: '6700', en: 'Cash over / short', sw: 'Tofauti ya pesa', hint: 'A genuine shortage or surplus found today', hintSw: 'Upungufu / ziada halisi ya leo' });
    }
    return o;
  });

  protected readonly valid = computed(
    () => this.reason().trim().length >= 5 && (!!this.data.check || this.actual().trim() !== ''),
  );

  protected async save(): Promise<void> {
    if (!this.valid()) return;
    this.saving.set(true);
    this.error.set(null);
    try {
      if (this.data.check) {
        await this.gl.trueUp({ key: this.data.check.key, asOfDate: this.data.asOf, offsetAccount: this.offset(), reason: this.reason().trim() });
      } else {
        await this.gl.trueUpCash({
          accountCode: this.data.cashCode!,
          actualBalance: parse(this.actual()),
          asOfDate: this.data.asOf,
          offsetAccount: this.offset(),
          reason: this.reason().trim(),
        });
      }
      this.ref.close(true);
    } catch (e) {
      this.error.set(ApiError.from(e).message);
    } finally {
      this.saving.set(false);
    }
  }
}
