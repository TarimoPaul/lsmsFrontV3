import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';

import { ApiError } from '@core/api/api.types';
import { LanguageService } from '@core/i18n/language.service';
import { Button, DialogShell, Icon, MoneyInput } from '@shared/ui';
import { MoneyPipe } from '@shared/utils/money';
import { MoneyAccountPicker } from '../general-ledger/money-account-picker';
import { FORM, parse, stamp, today } from './capital-dialogs';
import { Loan, ReclassResult } from './capital.models';
import { CapitalService } from './capital.service';

/** Interest days are [start, end): the same count the server's LoanScheduleCalculator uses. */
const daysBetween = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
const round2 = (v: number) => Math.round(v * 100) / 100;
const addMonths = (day: string, k: number) => {
  const [y, m, d] = day.split('-').map(Number);
  const first = new Date(Date.UTC(y, m - 1 + k, 1));
  const last = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  first.setUTCDate(Math.min(d, last));
  return first.toISOString().slice(0, 10);
};

const LOAN_FORM = `${FORM}
  .sum { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 8px; margin: 0 0 12px; padding: 10px 12px; border-radius: 12px; background: color-mix(in srgb, var(--c-text-2) 6%, transparent); }
  .sum span { display: flex; flex-direction: column; font-size: 0.72rem; color: var(--c-text-2); }
  .sum b { font-size: 0.9rem; font-weight: 600; color: var(--c-text); font-variant-numeric: tabular-nums; }
  .sum b.warn { color: var(--c-warning); }
  .check { flex-direction: row; align-items: center; gap: 8px; font-weight: 400; color: var(--c-text); }
  .check input { width: 16px; height: 16px; }
  .inst { display: flex; flex-direction: column; gap: 6px; margin-bottom: 12px; }
  .inst label { flex-direction: row; align-items: center; gap: 10px; margin: 0; }
  .inst label > span:first-child { flex: 1; font-weight: 400; color: var(--c-text); }
  .inst input { width: 160px; }
  .inst small { color: var(--c-success); }
`;

// ── New loan with its terms ────────────────────────────────────────────────

@Component({
  selector: 'app-loan-register-dialog',
  imports: [DialogShell, Button, Icon, MoneyInput, MoneyPipe, MoneyAccountPicker],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <lsms-dialog [title]="i18n.t('Loan received', 'Mkopo mpya')" icon="request_quote">
      <p class="info"><lsms-icon name="info" [size]="16" />{{ i18n.t('A loan is a liability with a contract: the whole amount owed (principal + interest) is booked now, and the interest is spread over the loan days as an expense. It is not income and not capital.', 'Mkopo ni deni lenye mkataba: deni lote (principal + riba) linaandikwa sasa, na riba inagawanywa kila siku ya mkopo kama gharama. Si mapato wala mtaji.') }}</p>
      <label><span>{{ i18n.t('Lender', 'Mkopeshaji') }}</span><input type="text" maxlength="200" [value]="lender()" (input)="lender.set($any($event.target).value)" /></label>
      <div class="two">
        <label><span>{{ i18n.t('Principal (TZS)', 'Kiasi cha mkopo (TZS)') }}</span><input lsmsMoneyInput type="text" [value]="principal()" (input)="principal.set($any($event.target).value)" /></label>
        <label><span>{{ i18n.t('Total interest (TZS)', 'Riba yote (TZS)') }} <small>{{ i18n.t('0 if none', '0 kama hakuna') }}</small></span><input lsmsMoneyInput type="text" [value]="interest()" (input)="interest.set($any($event.target).value)" /></label>
      </div>
      <span class="lbl">{{ i18n.t('Repaid', 'Inalipwa') }}</span>
      <div class="chips">
        <button type="button" [class.on]="type() === 'MONTHLY'" (click)="type.set('MONTHLY')">{{ i18n.t('Every month', 'Kila mwezi') }}</button>
        <button type="button" [class.on]="type() === 'ONCE'" (click)="type.set('ONCE')">{{ i18n.t('Once, at the end', 'Mara moja, mwishoni') }}</button>
      </div>
      <div class="two">
        <label><span>{{ i18n.t('Received on', 'Tarehe ya kupokea') }}</span><input type="date" [max]="today" [value]="start()" (change)="start.set($any($event.target).value)" /></label>
        @if (type() === 'MONTHLY') {
          <!-- the server needs the last installment on the same day of the month as the start: ask for months -->
          <label><span>{{ i18n.t('Number of months', 'Idadi ya miezi') }} <small>· {{ i18n.t('last', 'mwisho') }} {{ end() }}</small></span><input type="number" min="1" max="120" step="1" [value]="months()" (input)="months.set(+$any($event.target).value)" /></label>
        } @else {
          <label><span>{{ i18n.t('Paid back on', 'Tarehe ya kulipa') }}</span><input type="date" [min]="start()" [value]="onceEnd()" (change)="onceEnd.set($any($event.target).value)" /></label>
        }
      </div>
      <label class="check"><input type="checkbox" [checked]="toStock()" (change)="toStock.set($any($event.target).checked)" />{{ i18n.t('The money went straight to stock / a supplier', 'Pesa ilienda moja kwa moja kwenye mzigo / kwa msambazaji') }}</label>
      @if (!toStock()) {
        <app-money-account-picker [(value)]="method" [label]="i18n.t('Received into', 'Imeingia')" />
      }
      @if (days() > 0 && parse(principal()) > 0) {
        <div class="sum">
          <span>{{ i18n.t('Owed in total', 'Deni lote') }}<b>{{ total() | money: { decimals: 0 } }}</b></span>
          <span>{{ i18n.t('Loan days', 'Siku za mkopo') }}<b>{{ days() }}</b></span>
          <span>{{ i18n.t('Interest / day', 'Riba / siku') }}<b>{{ interestDaily() | money }}</b></span>
          <span>{{ i18n.t('Reserve / day', 'Akiba / siku') }}<b class="warn">{{ reserveDaily() | money }}</b></span>
        </div>
      }
      <label><span>{{ i18n.t('Notes (optional)', 'Maelezo (hiari)') }}</span><textarea rows="2" maxlength="500" [value]="notes()" (input)="notes.set($any($event.target).value)"></textarea></label>
      @if (error()) { <p class="err">{{ error() }}</p> }
      <ng-container dialogActions>
        <button lsmsButton="secondary" (click)="ref.close()">{{ i18n.t('Cancel', 'Ghairi') }}</button>
        <button lsmsButton="primary" [disabled]="!valid()" [loading]="saving()" (click)="save()">{{ i18n.t('Record loan', 'Rekodi mkopo') }}</button>
      </ng-container>
    </lsms-dialog>
  `,
  styles: LOAN_FORM,
})
export class LoanRegisterDialog {
  protected readonly ref = inject<DialogRef<boolean>>(DialogRef);
  protected readonly i18n = inject(LanguageService);
  private readonly api = inject(CapitalService);
  protected readonly parse = parse;

  protected readonly today = today();
  protected readonly lender = signal('');
  protected readonly principal = signal('');
  protected readonly interest = signal('');
  protected readonly start = signal(today());
  protected readonly months = signal(3);
  protected readonly onceEnd = signal('');
  /** MONTHLY: start + n months, clamped to the month's last day like java.time plusMonths (the server's rule). */
  protected readonly end = computed(() => (this.type() === 'MONTHLY' ? (this.start() && this.months() >= 1 ? addMonths(this.start(), Math.floor(this.months())) : '') : this.onceEnd()));
  protected readonly type = signal<'MONTHLY' | 'ONCE'>('MONTHLY');
  protected readonly toStock = signal(false);
  protected readonly method = signal('CASH');
  protected readonly notes = signal('');
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly days = computed(() => (this.start() && this.end() ? daysBetween(this.start(), this.end()) : 0));
  protected readonly total = computed(() => parse(this.principal()) + parse(this.interest()));
  protected readonly interestDaily = computed(() => (this.days() > 0 ? round2(parse(this.interest()) / this.days()) : 0));
  protected readonly reserveDaily = computed(() => (this.days() > 0 ? round2(parse(this.principal()) / this.days()) : 0));
  protected readonly valid = computed(
    () => this.lender().trim().length >= 3 && parse(this.principal()) > 0 && parse(this.interest()) >= 0 && this.days() > 0 && this.start() <= this.today,
  );

  protected async save(): Promise<void> {
    if (!this.valid()) return;
    this.saving.set(true);
    this.error.set(null);
    try {
      await this.api.registerLoan({
        lender: this.lender().trim(),
        notes: this.notes().trim() || undefined,
        principal: parse(this.principal()),
        interestTotal: parse(this.interest()),
        startDate: this.start(),
        endDate: this.end(),
        repaymentType: this.type(),
        ...(this.toStock() ? { receiveAccount: '1200' } : { paymentMethod: this.method() }),
      });
      this.ref.close(true);
    } catch (e) {
      this.error.set(ApiError.from(e).message);
    } finally {
      this.saving.set(false);
    }
  }
}

// ── Repay a loan ───────────────────────────────────────────────────────────

@Component({
  selector: 'app-repay-dialog',
  imports: [DialogShell, Button, Icon, MoneyInput, MoneyPipe, MoneyAccountPicker],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <lsms-dialog [title]="i18n.t('Repay loan', 'Lipa mkopo')" icon="payments">
      <p class="info"><lsms-icon name="info" [size]="16" />{{ i18n.t('The whole payment reduces the debt. Interest is not paid here — it is spread every day from the loan contract.', 'Malipo yote yanapunguza deni. Riba hailipwi hapa — inagawanywa kila siku kutoka kwenye mkataba wa mkopo.') }}</p>
      <div class="sum">
        <span>{{ data.reason }}<b>{{ i18n.t('owed', 'deni') }} {{ owed | money: { decimals: 0 } }}</b></span>
        @if (next) {
          <span>{{ i18n.t('Next installment', 'Awamu inayofuata') }}<b class="warn">#{{ next.seq }} · {{ next.dueDate }} · {{ (next.amount - next.paidAmount) | money: { decimals: 0 } }}</b></span>
        }
      </div>
      <div class="two">
        <label><span>{{ i18n.t('Amount paid (TZS)', 'Kiasi kilicholipwa (TZS)') }}</span><input lsmsMoneyInput type="text" [value]="amount()" (input)="amount.set($any($event.target).value)" /></label>
        <label><span>{{ i18n.t('Date paid', 'Tarehe ya kulipa') }}</span><input type="date" [min]="minDay" [max]="today" [value]="date()" (change)="date.set($any($event.target).value)" /></label>
      </div>
      <app-money-account-picker [(value)]="method" [groups]="['cash', 'bank']" [label]="i18n.t('Paid from', 'Imelipwa kutoka')" />
      <p class="gl">{{ i18n.t('Books: Dr 2100 Loans payable / Cr 1000 until bank accounts are tracked in the books (cut-over date); after it, Cr the bank chosen.', 'Vitabu: Dr 2100 Mikopo / Cr 1000 mpaka benki zianze kufuatiliwa kwenye vitabu (tarehe ya kuhamia); baada yake, Cr benki uliyochagua.') }}</p>
      @if (over()) {
        <p class="err">{{ i18n.t('More than is owed on this loan', 'Zaidi ya deni la mkopo huu') }} ({{ owed | money: { decimals: 0 } }}).</p>
      } @else if (parse(amount()) > 0) {
        <p class="gl">{{ i18n.t('After this payment', 'Baada ya malipo haya') }}: {{ i18n.t('owed', 'deni') }} <b>{{ (owed - parse(amount())) | money: { decimals: 0 } }}</b>@if (covers()) { · {{ covers() }} }</p>
      }
      <label><span>{{ i18n.t('Notes (optional)', 'Maelezo (hiari)') }}</span><input type="text" maxlength="300" [value]="notes()" (input)="notes.set($any($event.target).value)" /></label>
      @if (error()) { <p class="err">{{ error() }}</p> }
      <ng-container dialogActions>
        <button lsmsButton="secondary" (click)="ref.close()">{{ i18n.t('Cancel', 'Ghairi') }}</button>
        <button lsmsButton="primary" [disabled]="!valid()" [loading]="saving()" (click)="save()">{{ i18n.t('Record repayment', 'Rekodi malipo') }}</button>
      </ng-container>
    </lsms-dialog>
  `,
  styles: LOAN_FORM,
})
export class RepayDialog {
  protected readonly data = inject<Loan>(DIALOG_DATA);
  protected readonly ref = inject<DialogRef<boolean>>(DialogRef);
  protected readonly i18n = inject(LanguageService);
  private readonly api = inject(CapitalService);
  protected readonly parse = parse;

  protected readonly today = today();
  protected readonly owed = this.data.card?.owed ?? this.data.outstandingBalance;
  protected readonly minDay = this.data.card?.startDate ?? undefined;
  protected readonly next = (this.data.card?.installments ?? []).find((i) => i.paidAmount < i.amount) ?? null;
  protected readonly amount = signal(this.next ? String(Math.min(this.next.amount - this.next.paidAmount, this.owed)) : '');
  protected readonly date = signal(today());
  protected readonly method = signal('CASH');
  protected readonly notes = signal('');
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly over = computed(() => parse(this.amount()) > this.owed + 0.005);
  protected readonly valid = computed(() => parse(this.amount()) > 0 && !this.over() && !!this.date() && this.date() <= this.today);
  /** Which installments this payment settles (FIFO, as the server allocates it). */
  protected readonly covers = computed(() => {
    let left = parse(this.amount());
    const done: string[] = [];
    for (const i of this.data.card?.installments ?? []) {
      const open = i.amount - i.paidAmount;
      if (left <= 0 || open <= 0) continue;
      const take = Math.min(open, left);
      left -= take;
      done.push(take >= open - 0.005 ? `#${i.seq} ${this.i18n.t('paid', 'imelipwa')}` : `#${i.seq} ${this.i18n.t('part', 'sehemu')}`);
    }
    return done.join(', ');
  });

  protected async save(): Promise<void> {
    if (!this.valid()) return;
    this.saving.set(true);
    this.error.set(null);
    try {
      await this.api.repayLoan(this.data.uid, {
        amount: parse(this.amount()),
        payment_method: this.method(),
        transaction_date: stamp(this.date()),
        notes: this.notes().trim() || undefined,
      });
      this.ref.close(true);
    } catch (e) {
      this.error.set(ApiError.from(e).message);
    } finally {
      this.saving.set(false);
    }
  }
}

// ── Loan details (no journal) ──────────────────────────────────────────────

@Component({
  selector: 'app-loan-details-dialog',
  imports: [DialogShell, Button, Icon, MoneyPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <lsms-dialog [title]="i18n.t('Loan details', 'Maelezo ya mkopo')" icon="edit_note">
      <p class="info"><lsms-icon name="info" [size]="16" />{{ i18n.t('Description only — nothing in the books changes. A wrong amount, interest or loan date is fixed by a correction journal (Finance).', 'Maelezo tu — hakuna kinachobadilika kwenye vitabu. Kiasi, riba au tarehe ya mkopo iliyokosewa inarekebishwa kwa journal ya marekebisho (Fedha).') }}</p>
      <label><span>{{ i18n.t('Lender', 'Mkopeshaji') }}</span><input type="text" maxlength="200" [value]="lender()" (input)="lender.set($any($event.target).value)" /></label>
      <label><span>{{ i18n.t('Notes', 'Maelezo') }}</span><textarea rows="2" maxlength="500" [value]="notes()" (input)="notes.set($any($event.target).value)"></textarea></label>
      @if (dates().length) {
        <span class="lbl">{{ i18n.t('Installment due dates', 'Tarehe za awamu') }}</span>
        <div class="inst">
          @for (d of dates(); track d.seq; let k = $index) {
            <label>
              <span>#{{ d.seq }} · {{ d.amount | money: { decimals: 0 } }}@if (d.paid) { <small> · {{ i18n.t('paid', 'imelipwa') }}</small> }</span>
              <input type="date" [value]="d.dueDate" (change)="setDate(k, $any($event.target).value)" />
            </label>
          }
        </div>
      }
      @if (!ordered()) { <p class="err">{{ i18n.t('Each installment must fall after the one before it', 'Kila awamu lazima iwe baada ya iliyotangulia') }}</p> }
      @if (error()) { <p class="err">{{ error() }}</p> }
      <ng-container dialogActions>
        <button lsmsButton="secondary" (click)="ref.close()">{{ i18n.t('Cancel', 'Ghairi') }}</button>
        <button lsmsButton="primary" [disabled]="!valid()" [loading]="saving()" (click)="save()">{{ i18n.t('Save', 'Hifadhi') }}</button>
      </ng-container>
    </lsms-dialog>
  `,
  styles: LOAN_FORM,
})
export class LoanDetailsDialog {
  protected readonly data = inject<Loan>(DIALOG_DATA);
  protected readonly ref = inject<DialogRef<boolean>>(DialogRef);
  protected readonly i18n = inject(LanguageService);
  private readonly api = inject(CapitalService);

  private readonly original = (this.data.card?.installments ?? []).map((i) => ({ seq: i.seq, dueDate: i.dueDate, amount: i.amount, paid: i.status === 'PAID' }));
  protected readonly lender = signal(this.data.reason ?? '');
  protected readonly notes = signal(this.data.notes ?? '');
  protected readonly dates = signal(this.original.map((d) => ({ ...d })));
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly ordered = computed(() => this.dates().every((d, k, a) => !!d.dueDate && (k === 0 || d.dueDate > a[k - 1].dueDate)));
  private readonly changedDates = computed(() => this.dates().filter((d, k) => d.dueDate !== this.original[k].dueDate));
  protected readonly valid = computed(
    () =>
      this.lender().trim().length >= 3 &&
      this.ordered() &&
      (this.lender().trim() !== (this.data.reason ?? '') || this.notes().trim() !== (this.data.notes ?? '').trim() || this.changedDates().length > 0),
  );

  protected setDate(k: number, v: string): void {
    this.dates.update((a) => a.map((d, i) => (i === k ? { ...d, dueDate: v } : d)));
  }

  protected async save(): Promise<void> {
    if (!this.valid()) return;
    this.saving.set(true);
    this.error.set(null);
    try {
      await this.api.updateLoanDetails(this.data.uid, {
        lender: this.lender().trim(),
        notes: this.notes().trim(),
        ...(this.changedDates().length ? { installmentDates: this.dates().map((d) => ({ seq: d.seq, dueDate: d.dueDate })) } : {}),
      });
      this.ref.close(true);
    } catch (e) {
      this.error.set(ApiError.from(e).message);
    } finally {
      this.saving.set(false);
    }
  }
}

// ── Convert to capital: the journal is shown before it is written ──────────

const ACCOUNT_NAME: Record<string, { en: string; sw: string }> = {
  '2100': { en: 'Loans payable', sw: 'Mikopo (deni)' },
  '1150': { en: 'Loan interest not yet a cost', sw: 'Riba ya mkopo isiyoiva' },
  '3000': { en: 'Owner capital', sw: 'Mtaji wa mmiliki' },
};

@Component({
  selector: 'app-loan-convert-dialog',
  imports: [DialogShell, Button, Icon, MoneyPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <lsms-dialog [title]="i18n.t('Convert loan to capital', 'Geuza mkopo kuwa mtaji')" icon="swap_horiz">
      <p class="info"><lsms-icon name="info" [size]="16" />{{ i18n.t('Only when the lender will never be repaid (e.g. the owner lent it). What is still owed becomes capital, the interest not yet due is cancelled, and the loan closes. Interest already booked stays a cost.', 'Pale tu mkopeshaji hatalipwa (mf. mmiliki ndiye aliyekopesha). Deni lililobaki linakuwa mtaji, riba ambayo haijaiva inafutwa, na mkopo unafungwa. Riba iliyokwisha kuwa gharama inabaki.') }}</p>
      <span class="lbl">{{ i18n.t('Becomes', 'Unakuwa') }}</span>
      <div class="chips">
        <button type="button" [class.on]="type() === 'OWNER_EQUITY'" [disabled]="!!preview()" (click)="type.set('OWNER_EQUITY')">{{ i18n.t('Owner capital', 'Mtaji wa mmiliki') }}</button>
        <button type="button" [class.on]="type() === 'PARTNER_CONTRIBUTION'" [disabled]="!!preview()" (click)="type.set('PARTNER_CONTRIBUTION')">{{ i18n.t('Partner contribution', 'Mchango wa mbia') }}</button>
      </div>
      <label><span>{{ i18n.t('Reason (required)', 'Sababu (inahitajika)') }}</span><input type="text" maxlength="200" [readonly]="!!preview()" [value]="reason()" (input)="reason.set($any($event.target).value)" /></label>
      @if (preview(); as p) {
        <span class="lbl">{{ i18n.t('Journal to be written', 'Journal itakayoandikwa') }} · {{ p.date }}</span>
        <table class="jl">
          <thead><tr><th>{{ i18n.t('Account', 'Akaunti') }}</th><th>Dr</th><th>Cr</th></tr></thead>
          <tbody>
            @for (l of p.lines; track l.accountCode) {
              <tr [attr.data-acc]="l.accountCode">
                <td><b>{{ l.accountCode }}</b> {{ name(l.accountCode) }}</td>
                <td>{{ l.debit ? (l.debit | money) : '' }}</td>
                <td>{{ l.credit ? (l.credit | money) : '' }}</td>
              </tr>
            }
          </tbody>
        </table>
        <p class="gl">{{ i18n.t('Still owed', 'Deni lililobaki') }} {{ p.owed | money }} − {{ i18n.t('interest not yet due', 'riba isiyoiva') }} {{ p.prepaidInterest | money }} = {{ i18n.t('capital', 'mtaji') }} <b>{{ p.equity | money }}</b></p>
      }
      @if (error()) { <p class="err">{{ error() }}</p> }
      <ng-container dialogActions>
        <button lsmsButton="secondary" (click)="ref.close()">{{ i18n.t('Cancel', 'Ghairi') }}</button>
        @if (preview()) {
          <button lsmsButton="secondary" (click)="preview.set(null)">{{ i18n.t('Back', 'Rudi') }}</button>
          <button lsmsButton="primary" [loading]="saving()" (click)="convert()">{{ i18n.t('Convert to capital', 'Geuza kuwa mtaji') }}</button>
        } @else {
          <button lsmsButton="primary" [disabled]="reason().trim().length < 5" [loading]="saving()" (click)="show()">{{ i18n.t('Show journal', 'Onyesha journal') }}</button>
        }
      </ng-container>
    </lsms-dialog>
  `,
  styles: `${LOAN_FORM}
    .jl { width: 100%; border-collapse: collapse; margin-bottom: 10px; font-size: 0.8rem; }
    .jl th { text-align: left; font-weight: 500; font-size: 0.72rem; color: var(--c-text-2); padding: 4px 6px; border-bottom: 1px solid var(--c-border); }
    .jl td { padding: 6px; border-bottom: 1px solid color-mix(in srgb, var(--c-border) 60%, transparent); color: var(--c-text); }
    .jl th:not(:first-child), .jl td:not(:first-child) { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
  `,
})
export class ConvertDialog {
  protected readonly data = inject<Loan>(DIALOG_DATA);
  protected readonly ref = inject<DialogRef<boolean>>(DialogRef);
  protected readonly i18n = inject(LanguageService);
  private readonly api = inject(CapitalService);

  protected readonly type = signal<'OWNER_EQUITY' | 'PARTNER_CONTRIBUTION'>('OWNER_EQUITY');
  protected readonly reason = signal('');
  protected readonly preview = signal<ReclassResult | null>(null);
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);

  protected name(code: string): string {
    const a = ACCOUNT_NAME[code];
    return a ? (this.i18n.isSwahili() ? a.sw : a.en) : '';
  }

  /** The server's dry run: the exact lines it would write now. */
  protected async show(): Promise<void> {
    await this.run(true);
  }

  protected async convert(): Promise<void> {
    await this.run(false);
  }

  private async run(dryRun: boolean): Promise<void> {
    this.saving.set(true);
    this.error.set(null);
    try {
      const r = await this.api.reclassifyLoan(this.data.uid, this.type(), this.reason().trim(), dryRun);
      if (dryRun) this.preview.set(r);
      else this.ref.close(true);
    } catch (e) {
      this.error.set(ApiError.from(e).message);
    } finally {
      this.saving.set(false);
    }
  }
}
