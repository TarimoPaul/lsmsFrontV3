import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';

import { LanguageService } from '@core/i18n/language.service';
import { Button, DialogService, Icon, ToastService } from '@shared/ui';
import { Money, MoneyPipe } from '@shared/utils/money';
import { ReconStore } from './recon.store';
import { CASH_TYPES, CASH_TYPES_ADDABLE, EXPENSE_TYPES, MOBILE_PROVIDERS } from './reconciliation.models';
import { ReconciliationService } from './reconciliation.service';

export type EntryKind = 'cash' | 'mobile' | 'expense';

interface Item {
  uid: string;
  icon: string;
  title: string;
  sub: string;
  amount: number;
  verified: boolean;
  verifiedBy: string | null;
  auto: boolean;
  badge?: { text: string; color: string };
}

/**
 * Cash & bank / Mobile money / Expenses tabs (safe-box money has its own tab) — the three Flutter tabs share
 * one shape (totals, add form, entry list with verified / auto badges and
 * delete), so they share this component; only the form fields differ.
 */
@Component({
  selector: 'app-recon-entries-tab',
  imports: [Button, Icon, MoneyPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="totals">
      @for (t of totals(); track t.label) {
        <div [style.--tc]="t.color"><small>{{ t.label }}</small><b>{{ t.value | money }}</b></div>
      }
    </div>

    @if (store.canEdit() && editable()) {
      <form class="add" (submit)="$event.preventDefault(); add()">
        <h4><lsms-icon name="add_circle" [size]="16" />{{ addTitle() }}</h4>

        @switch (kind()) {
          @case ('cash') {
            <div class="chips">
              @for (t of cashTypes; track t) {
                <button type="button" [class.on]="type() === t" (click)="type.set(t)"><lsms-icon [name]="cash[t].icon" [size]="14" />{{ i18n.isSwahili() ? cash[t].sw : cash[t].en }}</button>
              }
            </div>
          }
          @case ('mobile') {
            <div class="chips">
              @for (p of providers; track p) {
                <button type="button" [class.on]="type() === p" (click)="type.set(p)">{{ p }}</button>
              }
            </div>
          }
          @case ('expense') {
            <div class="chips">
              @for (c of expenseKeys; track c) {
                <button type="button" [class.on]="type() === c" (click)="type.set(c)"><lsms-icon [name]="expense[c].icon" [size]="14" />{{ i18n.isSwahili() ? expense[c].sw : expense[c].en }}</button>
              }
            </div>
          }
        }

        <div class="grid">
          <label>
            <span>{{ i18n.t('Amount', 'Kiasi') }} *</span>
            <input type="text" inputmode="numeric" [value]="amountText()" (input)="amountText.set($any($event.target).value)" placeholder="0" />
          </label>
          @if (kind() === 'expense') {
            <label>
              <span>{{ i18n.t('Description', 'Maelezo') }}{{ type() === 'NYINGINE' ? ' *' : '' }}</span>
              <input type="text" maxlength="200" [value]="desc()" (input)="desc.set($any($event.target).value)" />
            </label>
          }
          @if (kind() === 'cash' && isBank()) {
            <label>
              <span>{{ i18n.t('Bank', 'Benki') }}</span>
              <input type="text" maxlength="60" [value]="bank()" (input)="bank.set($any($event.target).value)" placeholder="CRDB, NMB…" />
            </label>
          }
          @if (kind() !== 'cash' || isBank()) {
            <label>
              <span>{{ kind() === 'expense' ? i18n.t('Receipt no.', 'Namba ya risiti') : i18n.t('Reference', 'Kumbukumbu') }}</span>
              <input type="text" maxlength="60" [value]="ref()" (input)="ref.set($any($event.target).value)" />
            </label>
          }
          <label class="wide">
            <span>{{ i18n.t('Notes (optional)', 'Maelezo (hiari)') }}</span>
            <input type="text" maxlength="300" [value]="notes()" (input)="notes.set($any($event.target).value)" />
          </label>
        </div>
        <div class="actions">
          <button lsmsButton icon="add" size="sm" type="submit" [loading]="store.saving()" [disabled]="!valid()">{{ i18n.t('Add', 'Ongeza') }}</button>
        </div>
      </form>
    } @else if (store.current() && !store.current()!.editable) {
      <p class="locked"><lsms-icon name="lock" [size]="15" />{{ i18n.t('This reconciliation is locked — reopen it to change entries.', 'Upatanisho huu umefungwa — ufungue tena kubadilisha.') }}</p>
    }

    @if (items().length) {
      <ul class="items">
        @for (it of items(); track it.uid) {
          <li>
            <span class="ic"><lsms-icon [name]="it.icon" [size]="17" /></span>
            <span class="t">
              <b>{{ it.title }}</b>
              <small>{{ it.sub }}</small>
            </span>
            @if (it.badge) {
              <span class="tag" [style.--tc]="it.badge.color">{{ it.badge.text }}</span>
            }
            @if (it.auto) {
              <span class="tag" style="--tc: var(--c-info)" [title]="i18n.t('Added automatically from a sale payment', 'Imeongezwa yenyewe kutoka malipo ya mauzo')">AUTO</span>
            }
            @if (it.verified) {
              <span class="ok" [title]="i18n.t('Verified by ', 'Imethibitishwa na ') + (it.verifiedBy || '—')"><lsms-icon name="verified" [size]="16" [filled]="true" /></span>
            }
            <b class="amt">{{ it.amount | money }}</b>
            @if (store.canEdit() && editable() && !it.auto) {
              <button type="button" class="rm" (click)="remove(it)" [attr.aria-label]="i18n.t('Remove', 'Ondoa')"><lsms-icon name="delete" [size]="17" /></button>
            }
          </li>
        }
      </ul>
    } @else {
      <p class="empty">{{ i18n.t('Nothing recorded yet.', 'Hakuna kilichorekodiwa bado.') }}</p>
    }
  `,
  styleUrl: './recon-tab.scss',
})
export class ReconEntriesTab {
  protected readonly i18n = inject(LanguageService);
  protected readonly store = inject(ReconStore);
  private readonly api = inject(ReconciliationService);
  private readonly dialogs = inject(DialogService);
  private readonly toast = inject(ToastService);

  readonly kind = input.required<EntryKind>();

  protected readonly cash = CASH_TYPES;
  protected readonly cashTypes = CASH_TYPES_ADDABLE;
  protected readonly providers = MOBILE_PROVIDERS;
  protected readonly expense = EXPENSE_TYPES;
  protected readonly expenseKeys = Object.keys(EXPENSE_TYPES);

  protected readonly type = signal('');
  protected readonly amountText = signal('');
  protected readonly desc = signal('');
  protected readonly bank = signal('');
  protected readonly ref = signal('');
  protected readonly notes = signal('');

  protected readonly editable = computed(() => {
    const r = this.store.current();
    return !r || r.editable;
  });
  protected readonly amount = computed(() => Number(this.amountText().replace(/[^\d.]/g, '')) || 0);
  protected readonly isBank = computed(() => !!CASH_TYPES[this.type()]?.bank);
  protected readonly valid = computed(() => this.amount() > 0 && !!this.type() && (this.kind() !== 'expense' || this.type() !== 'NYINGINE' || this.desc().trim().length >= 2));

  protected readonly addTitle = computed(() => {
    const t = (en: string, sw: string) => this.i18n.t(en, sw);
    return this.kind() === 'cash' ? t('Declare cash or a deposit', 'Taja taslimu au depositi') : this.kind() === 'mobile' ? t('Add mobile money received', 'Ongeza pesa za simu') : t('Add an expense paid from cash', 'Ongeza matumizi');
  });

  protected readonly totals = computed(() => {
    const r = this.store.current();
    const t = (en: string, sw: string) => this.i18n.t(en, sw);
    if (!r) return [];
    if (this.kind() === 'cash') {
      return [
        { label: t('Cash in hand', 'Taslimu mkononi'), value: r.cashOnHandDeclared, color: 'var(--c-success)' },
        { label: t('Bank (today)', 'Benki (leo)'), value: r.bankDepositsTotal - r.safeBoxTotal, color: 'var(--c-info)' },
        { label: t('Safe box', 'Sefu'), value: r.safeBoxTotal, color: 'var(--c-info)' },
        { label: t('Petty cash / float', 'Petty cash / float'), value: r.pettyCashTotal, color: 'var(--c-text-2)' },
        { label: t('Debt money declared', 'Pesa za madeni'), value: r.cashDebtTotal + r.bankDebtTotal + r.mobileDebtTotal, color: 'var(--c-warning)' },
      ];
    }
    if (this.kind() === 'mobile') {
      const by = new Map<string, number>();
      for (const e of r.mobileEntries) by.set(e.provider, (by.get(e.provider) ?? 0) + e.amount);
      return [{ label: t('Total mobile money', 'Jumla ya pesa za simu'), value: r.mobileMoneyTotal, color: 'var(--c-info)' }, ...[...by].map(([p, v]) => ({ label: p, value: v, color: 'var(--c-primary)' }))];
    }
    const pending = r.expenses.filter((e) => e.approvalStatus === 'PENDING');
    return [
      { label: t('Total expenses', 'Jumla ya matumizi'), value: r.expensesTotal, color: 'var(--c-warning)' },
      ...(pending.length ? [{ label: t(`${pending.length} waiting for approval`, `${pending.length} yanasubiri idhini`), value: pending.reduce((n, e) => n + e.amount, 0), color: 'var(--c-error)' }] : []),
    ];
  });

  protected readonly items = computed<Item[]>(() => {
    const r = this.store.current();
    if (!r) return [];
    const sw = this.i18n.isSwahili();
    if (this.kind() === 'cash') {
      return r.cashEntries.filter((e) => e.type !== 'SAFE_BOX').map((e) => {
        const t = CASH_TYPES[e.type];
        return {
          uid: e.uid,
          icon: t?.icon ?? 'payments',
          title: t ? (sw ? t.sw : t.en) : e.type,
          sub: [e.bankName, e.reference, e.notes].filter(Boolean).join(' · ') || '—',
          amount: e.amount,
          verified: e.verified,
          verifiedBy: e.verifiedByName,
          auto: e.auto,
          badge: t?.group === 'debt' ? { text: this.i18n.t('DEBT', 'DENI'), color: 'var(--c-warning)' } : t?.group === 'previous' ? { text: this.i18n.t('EARLIER', 'JANA'), color: 'var(--c-text-2)' } : undefined,
        };
      });
    }
    if (this.kind() === 'mobile') {
      return r.mobileEntries.map((e) => ({ uid: e.uid, icon: 'phone_iphone', title: e.provider, sub: [e.reference, e.notes].filter(Boolean).join(' · ') || '—', amount: e.amount, verified: e.verified, verifiedBy: e.verifiedByName, auto: e.auto }));
    }
    return r.expenses.map((e) => {
      const t = EXPENSE_TYPES[e.type];
      return {
        uid: e.uid,
        icon: t?.icon ?? 'receipt_long',
        title: e.description || (t ? (sw ? t.sw : t.en) : e.type),
        sub: [t ? (sw ? t.sw : t.en) : e.type, e.receipt, e.notes].filter(Boolean).join(' · '),
        amount: e.amount,
        verified: e.verified,
        verifiedBy: e.verifiedByName,
        auto: false,
        badge: e.approvalStatus === 'PENDING' ? { text: this.i18n.t('WAITING APPROVAL', 'INASUBIRI IDHINI'), color: 'var(--c-error)' } : undefined,
      };
    });
  });

  constructor() {
    queueMicrotask(() => this.type.set(this.kind() === 'cash' ? 'CASH_IN_HAND' : this.kind() === 'mobile' ? 'TIGO' : 'NYINGINE'));
  }

  private reset(): void {
    this.amountText.set('');
    this.desc.set('');
    this.bank.set('');
    this.ref.set('');
    this.notes.set('');
  }

  protected async add(): Promise<void> {
    if (!this.valid() || this.store.saving()) return;
    const amount = this.amount();
    const notes = this.notes().trim() || null;
    const done = this.i18n.t(`${Money.format(amount)} added`, `${Money.format(amount)} imeongezwa`);
    const res =
      this.kind() === 'cash'
        ? await this.store.act((uid) => this.api.addCash(uid, { entryType: this.type(), amount, bankName: this.isBank() ? this.bank().trim() || null : null, depositReference: this.isBank() ? this.ref().trim() || null : null, notes }), done)
        : this.kind() === 'mobile'
          ? await this.store.act((uid) => this.api.addMobile(uid, { provider: this.type(), amount, transactionReference: this.ref().trim() || null, notes }), done)
          : await this.store.act(
              (uid) =>
                this.api.addExpense(uid, {
                  expenseType: this.type(),
                  description: this.desc().trim() || (this.i18n.isSwahili() ? EXPENSE_TYPES[this.type()].sw : EXPENSE_TYPES[this.type()].en),
                  amount,
                  receiptReference: this.ref().trim() || null,
                  notes,
                }),
              done,
            );
    if (res.recon) this.reset();
    else if (res.error) this.toast.error(res.error);
  }

  protected async remove(it: Item): Promise<void> {
    const ok = await this.dialogs.confirmDelete({
      title: this.i18n.t('Remove this entry?', 'Ondoa ingizo hili?'),
      message: `${it.title} · ${Money.format(it.amount)}`,
    });
    if (!ok) return;
    const res =
      this.kind() === 'cash'
        ? await this.store.act((uid) => this.api.removeCash(uid, it.uid), this.i18n.t('Removed', 'Imeondolewa'))
        : this.kind() === 'mobile'
          ? await this.store.act((uid) => this.api.removeMobile(uid, it.uid), this.i18n.t('Removed', 'Imeondolewa'))
          : await this.store.act((uid) => this.api.removeExpense(uid, it.uid), this.i18n.t('Removed', 'Imeondolewa'));
    if (res.error) this.toast.error(res.error);
  }
}
