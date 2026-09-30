import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';

import { ApiError } from '@core/api/api.types';
import { LanguageService } from '@core/i18n/language.service';
import { Button, DialogShell, Icon, MoneyInput } from '@shared/ui';
import { toIsoDate } from '@shared/utils/date-utils';
import { Money, MoneyPipe } from '@shared/utils/money';
import { MoneyAccountPicker } from '../general-ledger/money-account-picker';
import { ASSET_TYPES, EXPENSE_CATEGORIES, Expenditure, Loan } from './capital.models';
import { CapitalService } from './capital.service';

const parse = (t: string) => Money.parse(t) ?? 0;
const today = () => toIsoDate(new Date());
/** A picked day (yyyy-MM-dd) → Spring LocalDateTime; today keeps the current time. */
const stamp = (d: string) => {
  const now = new Date();
  if (!d || d === today()) {
    const p = (x: number) => String(x).padStart(2, '0');
    return `${today()}T${p(now.getHours())}:${p(now.getMinutes())}:${p(now.getSeconds())}`;
  }
  return `${d}T12:00:00`;
};

const FORM = `
  label { display: flex; flex-direction: column; gap: 4px; margin-bottom: 12px; font-size: 0.78rem; font-weight: 600; color: var(--c-text-2); }
  label small { font-weight: 400; }
  input, textarea { padding: 9px 10px; border: 1px solid var(--c-border); border-radius: 10px; background: var(--c-input-fill); font: inherit; font-size: 0.88rem; color: var(--c-text); outline: none; }
  input:focus, textarea:focus { border-color: var(--c-primary); }
  .two { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .lbl { display: block; margin-bottom: 6px; font-size: 0.78rem; font-weight: 600; color: var(--c-text-2); }
  .cats { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 6px; margin-bottom: 12px; }
  .cats button { display: flex; align-items: center; gap: 8px; padding: 9px 10px; border-radius: 12px; border: 1px solid var(--c-border); background: var(--c-surface); font: inherit; font-size: 0.8rem; text-align: left; color: var(--c-text); cursor: pointer; }
  .cats button lsms-icon { color: var(--c-text-2); }
  .cats button.on { border-color: var(--c-primary); background: color-mix(in srgb, var(--c-primary) 9%, var(--c-surface)); font-weight: 600; }
  .cats button.on lsms-icon { color: var(--c-primary); }
  .info { display: flex; align-items: flex-start; gap: 8px; margin: 0 0 12px; padding: 10px 12px; border-radius: 12px; font-size: 0.8rem; color: var(--c-text); background: color-mix(in srgb, var(--c-info) 8%, transparent); }
  .info lsms-icon { color: var(--c-info); flex-shrink: 0; }
  .gl { font-size: 0.74rem; color: var(--c-text-2); margin: -4px 0 12px; }
  .err { margin: 0; font-size: 0.82rem; color: var(--c-error); }
  .chips { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 12px; }
  .chips button { padding: 6px 12px; border-radius: 100px; border: 1px solid var(--c-border); background: var(--c-surface); font: inherit; font-size: 0.78rem; color: var(--c-text); cursor: pointer; }
  .chips button.on { border-color: var(--c-primary); color: var(--c-primary); font-weight: 600; background: color-mix(in srgb, var(--c-primary) 10%, var(--c-surface)); }
`;

// ── New expense ────────────────────────────────────────────────────────────

@Component({
  selector: 'app-expense-dialog',
  imports: [DialogShell, Button, Icon, MoneyInput, MoneyAccountPicker],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <lsms-dialog [title]="i18n.t('New expense', 'Gharama mpya')" icon="receipt_long">
      <span class="lbl">{{ i18n.t('What was it for?', 'Ni ya nini?') }}</span>
      <div class="cats">
        @for (c of cats; track c.type) {
          <button type="button" [class.on]="type() === c.type" (click)="type.set(c.type)"><lsms-icon [name]="c.icon" [size]="18" />{{ i18n.isSwahili() ? c.sw : c.en }}</button>
        }
      </div>
      @if (cat(); as c) { <p class="gl">GL {{ c.gl }}@if (c.hint) { · {{ i18n.isSwahili() ? c.hint.sw : c.hint.en }} }</p> }
      <label><span>{{ i18n.t('Description', 'Maelezo') }} <small>({{ i18n.t('at least 5 letters', 'angalau herufi 5') }})</small></span><input type="text" maxlength="300" [value]="desc()" (input)="desc.set($any($event.target).value)" /></label>
      <div class="two">
        <label><span>{{ i18n.t('Amount', 'Kiasi') }} (TZS)</span><input lsmsMoneyInput type="text" [value]="amount()" (input)="amount.set($any($event.target).value)" /></label>
        <label><span>{{ i18n.t('Date paid', 'Tarehe ya malipo') }}</span><input type="date" [max]="today" [value]="date()" (change)="date.set($any($event.target).value)" /></label>
      </div>
      <app-money-account-picker [(value)]="method" />
      <p class="info"><lsms-icon name="verified_user" [size]="16" />{{ i18n.t('It reaches the books (GL) only when a supervisor approves it — never by the person who recorded it.', 'Inaingia vitabuni (GL) pale msimamizi anapoidhinisha — si aliyeiandika.') }}</p>
      @if (error()) { <p class="err">{{ error() }}</p> }
      <ng-container dialogActions>
        <button lsmsButton="secondary" (click)="ref.close()">{{ i18n.t('Cancel', 'Ghairi') }}</button>
        <button lsmsButton="primary" [disabled]="!valid()" [loading]="saving()" (click)="save()">{{ i18n.t('Save for approval', 'Hifadhi isubiri idhini') }}</button>
      </ng-container>
    </lsms-dialog>
  `,
  styles: FORM,
})
export class ExpenseDialog {
  protected readonly ref = inject<DialogRef<Expenditure>>(DialogRef);
  protected readonly i18n = inject(LanguageService);
  private readonly api = inject(CapitalService);

  protected readonly cats = EXPENSE_CATEGORIES;
  protected readonly today = today();
  protected readonly type = signal('OPERATIONAL_CAPITAL');
  protected readonly desc = signal('');
  protected readonly amount = signal('');
  protected readonly date = signal(today());
  protected readonly method = signal('CASH');
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly cat = computed(() => this.cats.find((c) => c.type === this.type()));
  protected readonly valid = computed(() => parse(this.amount()) > 0 && this.desc().trim().length >= 5);

  protected async save(): Promise<void> {
    if (!this.valid()) return;
    this.saving.set(true);
    this.error.set(null);
    try {
      const c = this.cat()!;
      const created = await this.api.create({
        capitalType: c.type,
        expenditureType: c.expType,
        expenditureFrequency: 'ONE_TIME',
        amount: parse(this.amount()),
        description: this.desc().trim(),
        transactionDate: stamp(this.date()),
        paymentMethod: this.method(),
        affectsDailyProfit: true,
      });
      this.ref.close(created);
    } catch (e) {
      this.error.set(ApiError.from(e).message);
    } finally {
      this.saving.set(false);
    }
  }
}

// ── New fixed asset ────────────────────────────────────────────────────────

@Component({
  selector: 'app-asset-dialog',
  imports: [DialogShell, Button, Icon, MoneyInput, MoneyPipe, MoneyAccountPicker],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <lsms-dialog [title]="i18n.t('New fixed asset', 'Mali mpya ya kudumu')" icon="chair">
      <p class="info"><lsms-icon name="info" [size]="16" />{{ i18n.t('Equipment used for years is not an expense: it goes on the balance sheet and its cost reaches profit month by month (depreciation).', 'Kifaa kinachotumika miaka mingi si gharama ya siku: kinakaa kwenye mizania na gharama yake inaingia kwenye faida kila mwezi (uchakavu).') }}</p>
      <div class="cats">
        @for (a of types; track a.type) {
          <button type="button" [class.on]="type() === a.type" (click)="pick(a.type, a.life)"><lsms-icon [name]="a.icon" [size]="18" />{{ i18n.isSwahili() ? a.sw : a.en }}</button>
        }
      </div>
      <label><span>{{ i18n.t('What is it?', 'Ni nini?') }}</span><input type="text" maxlength="300" [value]="desc()" (input)="desc.set($any($event.target).value)" /></label>
      <div class="two">
        <label><span>{{ i18n.t('Cost', 'Gharama') }} (TZS)</span><input lsmsMoneyInput type="text" [value]="amount()" (input)="amount.set($any($event.target).value)" /></label>
        <label><span>{{ i18n.t('Date bought', 'Tarehe ya kununua') }}</span><input type="date" [max]="today" [value]="date()" (change)="date.set($any($event.target).value)" /></label>
      </div>
      <div class="two">
        <label><span>{{ i18n.t('Useful life (months)', 'Muda wa matumizi (miezi)') }}</span><input type="number" min="1" max="600" [value]="life()" (input)="life.set(+$any($event.target).value)" /></label>
        <label><span>{{ i18n.t('Value at the end', 'Thamani ya mwisho') }} <small>({{ i18n.t('optional', 'hiari') }})</small></span><input lsmsMoneyInput type="text" [value]="salvage()" (input)="salvage.set($any($event.target).value)" /></label>
      </div>
      @if (monthly() > 0) { <p class="gl">{{ i18n.t('Depreciation', 'Uchakavu') }}: {{ monthly() | money: { decimals: 0 } }} / {{ i18n.t('month', 'mwezi') }}</p> }
      <app-money-account-picker [(value)]="method" />
      @if (error()) { <p class="err">{{ error() }}</p> }
      <ng-container dialogActions>
        <button lsmsButton="secondary" (click)="ref.close()">{{ i18n.t('Cancel', 'Ghairi') }}</button>
        <button lsmsButton="primary" [disabled]="!valid()" [loading]="saving()" (click)="save()">{{ i18n.t('Save for approval', 'Hifadhi isubiri idhini') }}</button>
      </ng-container>
    </lsms-dialog>
  `,
  styles: FORM,
})
export class AssetDialog {
  protected readonly ref = inject<DialogRef<Expenditure>>(DialogRef);
  protected readonly i18n = inject(LanguageService);
  private readonly api = inject(CapitalService);

  protected readonly types = ASSET_TYPES;
  protected readonly today = today();
  protected readonly type = signal('OFFICE_CAPITAL');
  protected readonly desc = signal('');
  protected readonly amount = signal('');
  protected readonly salvage = signal('');
  protected readonly life = signal(60);
  protected readonly date = signal(today());
  protected readonly method = signal('CASH');
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly monthly = computed(() => {
    const dep = parse(this.amount()) - parse(this.salvage());
    return this.life() > 0 && dep > 0 ? Math.round(dep / this.life()) : 0;
  });
  protected readonly valid = computed(
    () => parse(this.amount()) > 0 && this.desc().trim().length >= 5 && this.life() >= 1 && this.life() <= 600 && parse(this.salvage()) < parse(this.amount()),
  );

  protected pick(type: string, life: number): void {
    this.type.set(type);
    this.life.set(life);
  }

  protected async save(): Promise<void> {
    if (!this.valid()) return;
    this.saving.set(true);
    this.error.set(null);
    try {
      const created = await this.api.create({
        capitalType: this.type(),
        expenditureType: 'INVESTMENT',
        expenditureFrequency: 'ONE_TIME',
        amount: parse(this.amount()),
        description: this.desc().trim(),
        transactionDate: stamp(this.date()),
        paymentMethod: this.method(),
        asset: true,
        assetLifeMonths: this.life(),
        salvageValue: parse(this.salvage()),
        affectsDailyProfit: false,
      });
      this.ref.close(created);
    } catch (e) {
      this.error.set(ApiError.from(e).message);
    } finally {
      this.saving.set(false);
    }
  }
}

// ── Dispose asset ──────────────────────────────────────────────────────────

@Component({
  selector: 'app-dispose-dialog',
  imports: [DialogShell, Button, Icon, MoneyInput, MoneyPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <lsms-dialog [title]="i18n.t('Dispose asset', 'Ondoa mali')" icon="delete_sweep">
      <p class="info"><lsms-icon name="info" [size]="16" />{{ data.description }} · {{ i18n.t('book value', 'thamani kitabuni') }} {{ data.currentAssetValue ?? data.amount | money: { decimals: 0 } }}</p>
      <span class="lbl">{{ i18n.t('How', 'Kwa njia gani') }}</span>
      <div class="chips">
        @for (m of methods; track m.v) { <button type="button" [class.on]="method() === m.v" (click)="method.set(m.v)">{{ i18n.isSwahili() ? m.sw : m.en }}</button> }
      </div>
      @if (method() === 'SOLD') {
        <label><span>{{ i18n.t('Sold for', 'Imeuzwa kwa') }} (TZS)</span><input lsmsMoneyInput type="text" [value]="value()" (input)="value.set($any($event.target).value)" /></label>
        @if (gain() !== null) { <p class="gl">{{ gain()! >= 0 ? i18n.t('Gain', 'Faida') : i18n.t('Loss', 'Hasara') }}: {{ gain()! | money: { decimals: 0 } }}</p> }
      }
      <label><span>{{ i18n.t('Reason', 'Sababu') }}</span><textarea rows="2" maxlength="300" [value]="reason()" (input)="reason.set($any($event.target).value)"></textarea></label>
      @if (error()) { <p class="err">{{ error() }}</p> }
      <ng-container dialogActions>
        <button lsmsButton="secondary" (click)="ref.close()">{{ i18n.t('Cancel', 'Ghairi') }}</button>
        <button lsmsButton="danger" [disabled]="reason().trim().length < 5" [loading]="saving()" (click)="save()">{{ i18n.t('Dispose', 'Ondoa') }}</button>
      </ng-container>
    </lsms-dialog>
  `,
  styles: FORM,
})
export class DisposeDialog {
  protected readonly data = inject<Expenditure>(DIALOG_DATA);
  protected readonly ref = inject<DialogRef<boolean>>(DialogRef);
  protected readonly i18n = inject(LanguageService);
  private readonly api = inject(CapitalService);

  protected readonly methods = [
    { v: 'SOLD', en: 'Sold', sw: 'Imeuzwa' },
    { v: 'SCRAPPED', en: 'Scrapped', sw: 'Imetupwa' },
    { v: 'DONATED', en: 'Donated', sw: 'Imetolewa msaada' },
    { v: 'LOST', en: 'Lost / stolen', sw: 'Imepotea / imeibiwa' },
  ];
  protected readonly method = signal('SOLD');
  protected readonly value = signal('');
  protected readonly reason = signal('');
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly gain = computed(() => (this.value() ? parse(this.value()) - (this.data.currentAssetValue ?? this.data.amount) : null));

  protected async save(): Promise<void> {
    this.saving.set(true);
    this.error.set(null);
    try {
      await this.api.dispose(this.data.uid, this.method(), this.method() === 'SOLD' ? parse(this.value()) : 0, this.reason().trim());
      this.ref.close(true);
    } catch (e) {
      this.error.set(ApiError.from(e).message);
    } finally {
      this.saving.set(false);
    }
  }
}

// ── Owner capital in / out, or a new loan ─────────────────────────────────

export interface MovementDialogData {
  kind: 'IN' | 'OUT' | 'LOAN';
}

@Component({
  selector: 'app-movement-dialog',
  imports: [DialogShell, Button, Icon, MoneyInput, MoneyAccountPicker],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <lsms-dialog [title]="title()" [icon]="data.kind === 'OUT' ? 'north_east' : data.kind === 'LOAN' ? 'request_quote' : 'south_west'">
      <p class="info"><lsms-icon name="info" [size]="16" />{{ help() }}</p>
      @if (data.kind !== 'LOAN') {
        <div class="chips">
          @for (s of sources(); track s.v) { <button type="button" [class.on]="source() === s.v" (click)="source.set(s.v)">{{ i18n.isSwahili() ? s.sw : s.en }}</button> }
        </div>
      }
      <div class="two">
        <label><span>{{ i18n.t('Amount', 'Kiasi') }} (TZS)</span><input lsmsMoneyInput type="text" [value]="amount()" (input)="amount.set($any($event.target).value)" /></label>
        <label><span>{{ i18n.t('Date', 'Tarehe') }}</span><input type="date" [max]="today" [value]="date()" (change)="date.set($any($event.target).value)" /></label>
      </div>
      <label><span>{{ data.kind === 'LOAN' ? i18n.t('Lender & terms', 'Mkopeshaji na masharti') : i18n.t('Reason', 'Sababu') }}</span><input type="text" maxlength="200" [value]="reason()" (input)="reason.set($any($event.target).value)" /></label>
      <label><span>{{ i18n.t('Notes (optional)', 'Maelezo (hiari)') }}</span><textarea rows="2" maxlength="500" [value]="notes()" (input)="notes.set($any($event.target).value)"></textarea></label>
      <app-money-account-picker [(value)]="method" [label]="data.kind === 'OUT' ? i18n.t('Paid out from', 'Imetoka') : i18n.t('Received into', 'Imeingia')" />
      @if (error()) { <p class="err">{{ error() }}</p> }
      <ng-container dialogActions>
        <button lsmsButton="secondary" (click)="ref.close()">{{ i18n.t('Cancel', 'Ghairi') }}</button>
        <button lsmsButton="primary" [disabled]="!valid()" [loading]="saving()" (click)="save()">{{ i18n.t('Record', 'Rekodi') }}</button>
      </ng-container>
    </lsms-dialog>
  `,
  styles: FORM,
})
export class MovementDialog {
  protected readonly data = inject<MovementDialogData>(DIALOG_DATA);
  protected readonly ref = inject<DialogRef<boolean>>(DialogRef);
  protected readonly i18n = inject(LanguageService);
  private readonly api = inject(CapitalService);

  protected readonly today = today();
  protected readonly source = signal(this.data.kind === 'OUT' ? 'OWNER_DRAW' : this.data.kind === 'LOAN' ? 'LOAN' : 'OWNER_EQUITY');
  protected readonly amount = signal('');
  protected readonly date = signal(today());
  protected readonly reason = signal('');
  protected readonly notes = signal('');
  protected readonly method = signal('CASH');
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly sources = computed(() =>
    this.data.kind === 'OUT'
      ? [
          { v: 'OWNER_DRAW', en: 'Owner', sw: 'Mmiliki' },
          { v: 'PARTNER_DRAW', en: 'Partner', sw: 'Mshirika' },
        ]
      : [
          { v: 'OWNER_EQUITY', en: 'Owner', sw: 'Mmiliki' },
          { v: 'PARTNER_CONTRIBUTION', en: 'Partner', sw: 'Mshirika' },
        ],
  );
  protected readonly title = computed(() =>
    this.data.kind === 'OUT'
      ? this.i18n.t('Owner withdrawal', 'Mmiliki kutoa pesa')
      : this.data.kind === 'LOAN'
        ? this.i18n.t('Loan received', 'Mkopo umepokelewa')
        : this.i18n.t('Add capital', 'Ongeza mtaji'),
  );
  protected readonly help = computed(() =>
    this.data.kind === 'OUT'
      ? this.i18n.t('Money taken out of the business for personal use. Reduces equity — it is not an expense.', 'Pesa iliyotolewa kwenye biashara kwa matumizi binafsi. Inapunguza mtaji — si gharama.')
      : this.data.kind === 'LOAN'
        ? this.i18n.t('Borrowed money is a liability: it must be repaid. It is not income and not capital.', 'Pesa ya mkopo ni deni: lazima ilipwe. Si mapato wala mtaji.')
        : this.i18n.t('Only NEW money put into the business. Profit already earned is in retained earnings — never record it here.', 'Pesa MPYA tu inayowekwa kwenye biashara. Faida iliyopatikana tayari iko kwenye faida iliyobaki — usiiandike hapa.'),
  );
  protected readonly valid = computed(() => parse(this.amount()) > 0 && this.reason().trim().length >= 3);

  protected async save(): Promise<void> {
    if (!this.valid()) return;
    this.saving.set(true);
    this.error.set(null);
    try {
      await this.api.recordMovement({
        injection_type: this.data.kind === 'OUT' ? 'WITHDRAWAL' : 'INJECTION',
        source_type: this.source(),
        amount: parse(this.amount()),
        reason: this.reason().trim(),
        notes: this.notes().trim() || undefined,
        transaction_date: stamp(this.date()),
        payment_method: this.method(),
      });
      this.ref.close(true);
    } catch (e) {
      this.error.set(ApiError.from(e).message);
    } finally {
      this.saving.set(false);
    }
  }
}

// ── Loan repayment ─────────────────────────────────────────────────────────

@Component({
  selector: 'app-repay-dialog',
  imports: [DialogShell, Button, Icon, MoneyInput, MoneyPipe, MoneyAccountPicker],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <lsms-dialog [title]="i18n.t('Repay loan', 'Lipa mkopo')" icon="payments">
      <p class="info"><lsms-icon name="info" [size]="16" />{{ data.reason }} · {{ i18n.t('still owed', 'bado inadaiwa') }} <b>&nbsp;{{ data.outstandingBalance | money: { decimals: 0 } }}</b></p>
      <div class="two">
        <label><span>{{ i18n.t('Principal', 'Principal (mkopo wenyewe)') }}</span><input lsmsMoneyInput type="text" [value]="principal()" (input)="principal.set($any($event.target).value)" /></label>
        <label><span>{{ i18n.t('Interest', 'Riba') }} <small>({{ i18n.t('expense', 'gharama') }})</small></span><input lsmsMoneyInput type="text" [value]="interest()" (input)="interest.set($any($event.target).value)" /></label>
      </div>
      <p class="gl">{{ i18n.t('Total paid', 'Jumla iliyolipwa') }}: {{ total() | money: { decimals: 0 } }}@if (over()) { · <b class="err">{{ i18n.t('Principal exceeds what is owed', 'Principal inazidi deni') }}</b> }</p>
      <label><span>{{ i18n.t('Date', 'Tarehe') }}</span><input type="date" [max]="today" [value]="date()" (change)="date.set($any($event.target).value)" /></label>
      <app-money-account-picker [(value)]="method" />
      @if (error()) { <p class="err">{{ error() }}</p> }
      <ng-container dialogActions>
        <button lsmsButton="secondary" (click)="ref.close()">{{ i18n.t('Cancel', 'Ghairi') }}</button>
        <button lsmsButton="primary" [disabled]="!valid()" [loading]="saving()" (click)="save()">{{ i18n.t('Record repayment', 'Rekodi malipo') }}</button>
      </ng-container>
    </lsms-dialog>
  `,
  styles: FORM,
})
export class RepayDialog {
  protected readonly data = inject<Loan>(DIALOG_DATA);
  protected readonly ref = inject<DialogRef<boolean>>(DialogRef);
  protected readonly i18n = inject(LanguageService);
  private readonly api = inject(CapitalService);

  protected readonly today = today();
  protected readonly principal = signal('');
  protected readonly interest = signal('');
  protected readonly date = signal(today());
  protected readonly method = signal('CASH');
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly total = computed(() => parse(this.principal()) + parse(this.interest()));
  protected readonly over = computed(() => parse(this.principal()) > this.data.outstandingBalance + 1);
  protected readonly valid = computed(() => this.total() > 0 && !this.over());

  protected async save(): Promise<void> {
    if (!this.valid()) return;
    this.saving.set(true);
    this.error.set(null);
    try {
      await this.api.repayLoan(this.data.uid, {
        amount: this.total(),
        principal_amount: parse(this.principal()),
        interest_amount: parse(this.interest()),
        payment_method: this.method(),
        reason: this.i18n.t('Loan repayment', 'Kulipa mkopo'),
        transaction_date: stamp(this.date()),
      });
      this.ref.close(true);
    } catch (e) {
      this.error.set(ApiError.from(e).message);
    } finally {
      this.saving.set(false);
    }
  }
}
