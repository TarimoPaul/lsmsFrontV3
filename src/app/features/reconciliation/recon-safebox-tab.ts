import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';

import { ApiError } from '@core/api/api.types';
import { AuthService } from '@core/auth/auth.service';
import { LanguageService } from '@core/i18n/language.service';
import { Button, DialogService, Icon, ToastService } from '@shared/ui';
import { parseLocal } from '@shared/utils/date-utils';
import { Money, MoneyPipe } from '@shared/utils/money';
import { SAFE_BOX_STATUS, SafeBoxCashierOutstanding, SafeBoxDeposit, SafeBoxOutstandingEntry } from './recon-extra.models';
import { ReconStore } from './recon.store';
import { CashEntry } from './reconciliation.models';
import { ReconciliationService } from './reconciliation.service';
import type { SafeBoxDepositData } from './safe-box-deposit-dialog';
import { DepositRequest, SafeBoxService } from './safe-box.service';

/**
 * Safe Box tab — port of Flutter `_SafeBoxTab`. Money put in the safe is a
 * SAFE_BOX cash entry on the day (it lowers the cash expected). This tab is
 * the accountability layer on top: the cashier banks it or hands it to a
 * manager (deposits), a manager confirms / rejects, and sees what every
 * cashier still owes from approved days. Never changes the day's formula.
 */
@Component({
  selector: 'app-recon-safebox-tab',
  imports: [Button, Icon, MoneyPipe, DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="totals">
      <div style="--tc: var(--c-info)"><small>{{ i18n.t('Put in the safe (this day)', 'Imewekwa safeni (siku hii)') }}</small><b>{{ store.current()?.safeBoxTotal ?? 0 | money }}</b></div>
      <div style="--tc: var(--c-warning)"><small>{{ i18n.t('Still to bank / hand over', 'Bado kupelekwa / kukabidhiwa') }}</small><b>{{ todayRemaining() | money }}</b></div>
      @if (canManage()) {
        <div style="--tc: var(--c-error)"><small>{{ i18n.t('Owed by cashiers (approved days)', 'Deni la cashiers (siku zilizoidhinishwa)') }}</small><b>{{ outstandingTotal() | money }}</b></div>
      }
    </div>

    <!-- This day's safe box entries -->
    <section class="block">
      <header>
        <h4><lsms-icon name="lock" [size]="16" />{{ i18n.t('This day', 'Siku hii') }}</h4>
        @if (canEdit()) {
          <button lsmsButton="secondary" size="sm" icon="add" (click)="adding.set(!adding())">{{ i18n.t('Put money in the safe', 'Weka pesa safeni') }}</button>
        }
      </header>
      @if (adding()) {
        <div class="add">
          <div class="grid">
            <label>
              <span>{{ i18n.t('Amount', 'Kiasi') }} *</span>
              <input type="text" inputmode="numeric" [value]="amountText()" (input)="amountText.set($any($event.target).value)" placeholder="0" />
            </label>
            <label>
              <span>{{ i18n.t('Reference (optional)', 'Kumbukumbu (hiari)') }}</span>
              <input type="text" maxlength="60" [value]="ref()" (input)="ref.set($any($event.target).value)" />
            </label>
            <label class="wide">
              <span>{{ i18n.t('Notes (optional)', 'Maelezo (hiari)') }}</span>
              <input type="text" maxlength="300" [value]="notes()" (input)="notes.set($any($event.target).value)" />
            </label>
          </div>
          <div class="actions">
            <button lsmsButton="text" size="sm" (click)="adding.set(false)">{{ i18n.t('Cancel', 'Ghairi') }}</button>
            <button lsmsButton size="sm" icon="lock" [loading]="store.saving()" [disabled]="!(amount() > 0)" (click)="addEntry()">{{ i18n.t('Put in safe', 'Weka safeni') }}</button>
          </div>
        </div>
      }
      @if (entries().length) {
        <ul class="items">
          @for (e of entries(); track e.uid) {
            @let left = remainingFor(e);
            @let pend = pendingFor(e);
            <li>
              <span class="ic"><lsms-icon name="lock" [size]="17" /></span>
              <span class="t">
                <b>{{ e.amount | money }}</b>
                <small>
                  @if (left > 0.01) { <span class="warn">{{ i18n.t('Not yet confirmed', 'Bado kuthibitishwa') }}: {{ left | money }}</span> } @else { <span class="good">{{ i18n.t('Fully confirmed', 'Imethibitishwa yote') }}</span> }
                  @if (pend > 0.01) { · <span class="info">{{ i18n.t('submitted, waiting', 'imewasilishwa, inasubiri') }} {{ pend | money }}</span> }
                  @if (e.reference || e.notes) { · {{ [e.reference, e.notes].filter(truthy).join(' · ') }} }
                </small>
              </span>
              @if (left > 0.01 && store.isMine()) {
                <button lsmsButton size="sm" icon="upload" (click)="submit(e, left)">{{ i18n.t('Submit deposit', 'Wasilisha deposit') }}</button>
              }
              @if (canEdit()) {
                <button type="button" class="rm" (click)="removeEntry(e)" [attr.aria-label]="i18n.t('Remove', 'Ondoa')"><lsms-icon name="delete" [size]="17" /></button>
              }
            </li>
          }
        </ul>
      } @else {
        <p class="empty">{{ i18n.t('Nothing put in the safe on this day.', 'Hakuna kilichowekwa safeni siku hii.') }}</p>
      }
    </section>

    <!-- My deposits waiting / rejected (all days) -->
    <section class="block">
      <header><h4><lsms-icon name="hourglass_top" [size]="16" />{{ i18n.t('My deposits waiting for confirmation', 'Deposit zangu zinazosubiri uthibitisho') }}</h4></header>
      @if (mine().length) {
        <ul class="items">
          @for (d of mine(); track d.uid) {
            @let st = status[d.status];
            <li>
              <span class="tag" [style.--tc]="st.color">{{ i18n.isSwahili() ? st.sw : st.en }}</span>
              <span class="t">
                <b>{{ d.amount | money }} · {{ depositWhere(d) }}</b>
                <small>
                  {{ day(d.submittedAt) | date: 'dd MMM yyyy, HH:mm' }}@if (d.receipt) { · {{ i18n.t('receipt', 'risiti') }} {{ d.receipt }} }
                  @if (d.rejectionReason) { · <span class="bad">{{ i18n.t('Reason', 'Sababu') }}: {{ d.rejectionReason }}</span> }
                </small>
              </span>
              @if (d.status === 'PENDING') {
                <button lsmsButton="secondary" size="sm" icon="edit" (click)="editDeposit(d)">{{ i18n.t('Edit', 'Hariri') }}</button>
                <button lsmsButton="text" size="sm" icon="delete" class="del" (click)="cancelDeposit(d)">{{ i18n.t('Withdraw', 'Futa') }}</button>
              } @else if (d.status === 'REJECTED') {
                <button lsmsButton="secondary" size="sm" icon="replay" (click)="resubmit(d)">{{ i18n.t('Submit again', 'Wasilisha tena') }}</button>
              }
            </li>
          }
        </ul>
      } @else {
        <p class="empty">{{ i18n.t('No deposits waiting or rejected.', 'Hakuna deposit zinazosubiri au zilizokataliwa.') }}</p>
      }
    </section>

    @if (canManage()) {
      <!-- Manager: confirm / reject -->
      <section class="block">
        <header><h4><lsms-icon name="verified_user" [size]="16" />{{ i18n.t('To confirm (manager)', 'Za kuthibitisha (meneja)') }}</h4></header>
        @if (toConfirm().length) {
          <ul class="items">
            @for (d of toConfirm(); track d.uid) {
              <li>
                <span class="ic"><lsms-icon [name]="d.type === 'HAND_OVER' ? 'handshake' : 'account_balance'" [size]="17" /></span>
                <span class="t">
                  <b>{{ d.cashierName || '—' }} · {{ d.amount | money }}</b>
                  <small>{{ depositWhere(d) }} · {{ day(d.submittedAt) | date: 'dd MMM, HH:mm' }}@if (d.receipt) { · {{ i18n.t('receipt', 'risiti') }} {{ d.receipt }} }</small>
                </span>
                <button lsmsButton size="sm" icon="check" [loading]="busy() === d.uid" (click)="confirmDeposit(d)">{{ i18n.t('Confirm', 'Thibitisha') }}</button>
                <button lsmsButton="text" size="sm" icon="close" class="del" (click)="rejectDeposit(d)">{{ i18n.t('Reject', 'Kataa') }}</button>
              </li>
            }
          </ul>
        } @else {
          <p class="empty">{{ i18n.t('No deposits waiting for you.', 'Hakuna deposit zinazokusubiri.') }}</p>
        }
      </section>

      <!-- Manager: what cashiers still owe -->
      <section class="block">
        <header><h4><lsms-icon name="warning" [size]="16" />{{ i18n.t('Not yet handed over (approved days)', 'Bado kukabidhiwa (siku zilizoidhinishwa)') }}</h4></header>
        @if (outstanding().length) {
          @for (c of outstanding(); track c.cashierUid) {
            <div class="owe">
              <button type="button" class="owe-head" (click)="toggleOwe(c.cashierUid)">
                <lsms-icon name="person" [size]="17" />
                <b>{{ c.cashierName || c.cashierUid }}</b>
                <span class="bad">{{ c.total | money }}</span>
                <lsms-icon [name]="openOwe().has(c.cashierUid ?? '') ? 'expand_less' : 'expand_more'" [size]="20" />
              </button>
              @if (openOwe().has(c.cashierUid ?? '')) {
                <ul class="items flat">
                  @for (o of c.entries; track o.cashEntryUid) {
                    @let age = ageDays(o.date);
                    <li>
                      <span class="t">
                        <b>{{ day(o.date) | date: 'dd MMM yyyy' }}</b>
                        <small>{{ i18n.t('Amount', 'Kiasi') }} {{ o.amount | money: { symbol: false } }} · {{ i18n.t('left', 'bado') }} <b>{{ o.remaining | money: { symbol: false } }}</b></small>
                      </span>
                      @if (age !== null) {
                        <span class="tag" [style.--tc]="age > 7 ? 'var(--c-error)' : age > 3 ? 'var(--c-warning)' : 'var(--c-text-2)'">{{ age }} {{ i18n.t('days', 'siku') }}</span>
                      }
                      <button lsmsButton="secondary" size="sm" icon="campaign" (click)="requestDeposit(o, c)">{{ i18n.t('Ask to bring it', 'Omba alete') }}</button>
                    </li>
                  }
                </ul>
              }
            </div>
          }
        } @else {
          <p class="empty">{{ i18n.t('Nothing owed — every cashier has handed over in full.', 'Hakuna deni — cashiers wote wamekabidhi kikamilifu.') }}</p>
        }
      </section>
    }
  `,
  styleUrl: './recon-tab.scss',
  styles: `
    .block { display: flex; flex-direction: column; gap: 8px; }
    .block header { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
    .block h4 { display: flex; align-items: center; gap: 6px; margin: 0; font-size: 0.86rem; font-weight: 700; }
    .block h4 lsms-icon { color: var(--c-primary); }
    .warn { color: var(--c-warning); font-weight: 600; }
    .good { color: var(--c-success); font-weight: 600; }
    .info { color: var(--c-info); }
    .bad { color: var(--c-error); font-weight: 600; }
    .del { color: var(--c-error); }
    .owe { border-radius: 14px; background: var(--c-surface); border: 1px solid var(--c-border); overflow: hidden; }
    .owe-head { display: flex; align-items: center; gap: 10px; width: 100%; padding: 12px 14px; border: 0; background: transparent; font: inherit; color: var(--c-text); cursor: pointer; }
    .owe-head b { flex: 1; text-align: left; font-weight: 600; }
    .owe-head:hover { background: var(--c-hover); }
    .items.flat { border: 0; border-top: 1px solid var(--c-border); border-radius: 0; }
  `,
})
export class ReconSafeBoxTab {
  protected readonly i18n = inject(LanguageService);
  protected readonly store = inject(ReconStore);
  private readonly auth = inject(AuthService);
  private readonly api = inject(ReconciliationService);
  private readonly safe = inject(SafeBoxService);
  private readonly dialogs = inject(DialogService);
  private readonly toast = inject(ToastService);

  protected readonly status = SAFE_BOX_STATUS;
  protected readonly truthy = (v: unknown) => !!v;
  protected readonly adding = signal(false);
  protected readonly amountText = signal('');
  protected readonly ref = signal('');
  protected readonly notes = signal('');
  protected readonly busy = signal<string | null>(null);
  protected readonly mine = signal<SafeBoxDeposit[]>([]);
  protected readonly toConfirm = signal<SafeBoxDeposit[]>([]);
  protected readonly outstanding = signal<SafeBoxCashierOutstanding[]>([]);
  protected readonly openOwe = signal<Set<string>>(new Set());
  private readonly history = signal<Map<string, SafeBoxDeposit[]>>(new Map());
  private recipients: Array<{ uid: string; name: string }> = [];

  protected readonly canEdit = computed(() => {
    const r = this.store.current();
    return this.store.canEdit() && (!r || r.editable);
  });
  protected readonly canManage = computed(() => this.auth.isRoot() || this.auth.hasAnyPermission(['SAFE_BOX_CONFIRM', 'RECONCILIATION_APPROVE']));
  protected readonly amount = computed(() => Number(this.amountText().replace(/[^\d.]/g, '')) || 0);
  protected readonly entries = computed(() => (this.store.current()?.cashEntries ?? []).filter((e) => e.type === 'SAFE_BOX'));
  protected readonly todayRemaining = computed(() => this.entries().reduce((n, e) => n + this.remainingFor(e), 0));
  protected readonly outstandingTotal = computed(() => this.outstanding().reduce((n, c) => n + c.total, 0));

  constructor() {
    effect(() => {
      const ids = this.entries().map((e) => e.uid).join(',');
      untracked(() => void this.loadEntries(ids ? ids.split(',') : []));
    });
    void this.loadLists();
  }

  private async loadEntries(uids: string[]): Promise<void> {
    const pairs = await Promise.all(uids.map(async (u) => [u, await this.safe.entryHistory(u)] as const));
    this.history.set(new Map(pairs));
  }

  private async loadLists(): Promise<void> {
    const [mine, recipients] = await Promise.all([this.safe.myPending().catch(() => []), this.safe.recipients()]);
    this.mine.set(mine.sort((a, b) => (b.submittedAt ?? '').localeCompare(a.submittedAt ?? '')));
    this.recipients = recipients;
    if (this.canManage()) {
      const [pending, owed] = await Promise.all([this.safe.pendingForManager().catch(() => []), this.safe.outstanding().catch(() => [])]);
      this.toConfirm.set(pending);
      this.outstanding.set(owed);
    }
  }

  /** Entry amount minus CONFIRMED deposits — same figure the manager's outstanding view uses. */
  protected remainingFor(e: CashEntry): number {
    const done = (this.history().get(e.uid) ?? []).filter((d) => d.status === 'CONFIRMED').reduce((n, d) => n + d.amount, 0);
    return Math.max(0, e.amount - done);
  }

  protected pendingFor(e: CashEntry): number {
    return (this.history().get(e.uid) ?? []).filter((d) => d.status === 'PENDING').reduce((n, d) => n + d.amount, 0);
  }

  protected depositWhere(d: SafeBoxDeposit): string {
    if (d.type === 'HAND_OVER') return this.i18n.t('Handed to ', 'Amekabidhi ') + (d.recipientName ?? this.i18n.t('a manager', 'meneja'));
    return d.bankName ?? this.i18n.t('Bank', 'Benki');
  }

  protected day(v: string | null): Date | null {
    return parseLocal(v);
  }

  protected ageDays(v: string | null): number | null {
    const d = parseLocal(v);
    return d ? Math.floor((Date.now() - d.getTime()) / 86_400_000) : null;
  }

  protected toggleOwe(uid: string | null): void {
    const k = uid ?? '';
    this.openOwe.update((s) => {
      const n = new Set(s);
      if (n.has(k)) n.delete(k);
      else n.add(k);
      return n;
    });
  }

  protected async addEntry(): Promise<void> {
    const amount = this.amount();
    if (!(amount > 0)) return;
    const res = await this.store.act(
      (uid) => this.api.addCash(uid, { entryType: 'SAFE_BOX', amount, depositReference: this.ref().trim() || null, notes: this.notes().trim() || null }),
      this.i18n.t(`${Money.format(amount)} put in the safe`, `${Money.format(amount)} imewekwa safeni`),
    );
    if (res.error) return void this.toast.error(res.error);
    this.amountText.set('');
    this.ref.set('');
    this.notes.set('');
    this.adding.set(false);
  }

  protected async removeEntry(e: CashEntry): Promise<void> {
    const ok = await this.dialogs.confirmDelete({
      title: this.i18n.t('Remove this safe box entry?', 'Ondoa ingizo hili la safeni?'),
      message: this.i18n.t(`${Money.format(e.amount)}. Deposits already made stay on record.`, `${Money.format(e.amount)}. Deposit zilizokwisha fanywa zinabaki kwenye kumbukumbu.`),
    });
    if (!ok) return;
    const res = await this.store.act((uid) => this.api.removeCash(uid, e.uid), this.i18n.t('Removed', 'Imeondolewa'));
    if (res.error) this.toast.error(res.error);
  }

  protected submit(e: CashEntry, remaining: number): Promise<void> {
    return this.openDeposit({ cashEntryUid: e.uid, remaining, recipients: this.recipients });
  }

  protected resubmit(d: SafeBoxDeposit): Promise<void> {
    return this.openDeposit({ cashEntryUid: d.cashEntryUid, remaining: this.remainingOf(d), recipients: this.recipients });
  }

  protected editDeposit(d: SafeBoxDeposit): Promise<void> {
    return this.openDeposit({ cashEntryUid: d.cashEntryUid, remaining: this.remainingOf(d), recipients: this.recipients, editing: d });
  }

  /** For a deposit from another day: the server's remaining, else its original amount. */
  private remainingOf(d: SafeBoxDeposit): number {
    const e = this.entries().find((x) => x.uid === d.cashEntryUid);
    return e ? this.remainingFor(e) : (d.remaining ?? d.originalAmount ?? d.amount);
  }

  private async openDeposit(data: SafeBoxDepositData): Promise<void> {
    const { SafeBoxDepositDialog } = await import('./safe-box-deposit-dialog');
    const req = await this.dialogs.openAsync<DepositRequest>(SafeBoxDepositDialog, { size: 'sm', data });
    if (!req) return;
    try {
      if (data.editing) await this.safe.edit(data.editing.uid, req);
      else await this.safe.submit(req);
      this.toast.success(data.editing ? this.i18n.t('Deposit updated', 'Deposit imesasishwa') : this.i18n.t('Deposit submitted — waiting for a manager', 'Deposit imewasilishwa — inasubiri meneja'));
      await Promise.all([this.loadLists(), this.loadEntries(this.entries().map((e) => e.uid))]);
    } catch (e) {
      this.toast.error(ApiError.from(e).message);
    }
  }

  private async reason(title: string, confirm: string, danger = false): Promise<string | undefined> {
    const { ReasonDialog } = await import('./reason-dialog');
    return this.dialogs.openAsync<string>(ReasonDialog, { size: 'sm', data: { title, label: this.i18n.t('Reason (required)', 'Sababu (lazima)'), confirm, danger } });
  }

  protected async cancelDeposit(d: SafeBoxDeposit): Promise<void> {
    const reason = await this.reason(this.i18n.t('Withdraw this deposit?', 'Futa deposit hii?'), this.i18n.t('Withdraw', 'Futa'), true);
    if (!reason) return;
    try {
      await this.safe.cancel(d.uid, reason);
      this.toast.success(this.i18n.t('Deposit withdrawn', 'Deposit imefutwa'));
      await Promise.all([this.loadLists(), this.loadEntries(this.entries().map((e) => e.uid))]);
    } catch (e) {
      this.toast.error(ApiError.from(e).message);
    }
  }

  protected async confirmDeposit(d: SafeBoxDeposit): Promise<void> {
    this.busy.set(d.uid);
    try {
      await this.safe.confirm(d.uid);
      this.toast.success(this.i18n.t('Deposit confirmed', 'Deposit imethibitishwa'));
      await Promise.all([this.loadLists(), this.loadEntries(this.entries().map((e) => e.uid))]);
    } catch (e) {
      this.toast.error(ApiError.from(e).message);
    } finally {
      this.busy.set(null);
    }
  }

  protected async rejectDeposit(d: SafeBoxDeposit): Promise<void> {
    const reason = await this.reason(this.i18n.t('Reject this deposit?', 'Kataa deposit hii?'), this.i18n.t('Reject', 'Kataa'), true);
    if (!reason) return;
    try {
      await this.safe.reject(d.uid, reason);
      this.toast.success(this.i18n.t('Deposit rejected', 'Deposit imekataliwa'));
      await this.loadLists();
    } catch (e) {
      this.toast.error(ApiError.from(e).message);
    }
  }

  protected async requestDeposit(o: SafeBoxOutstandingEntry, c: SafeBoxCashierOutstanding): Promise<void> {
    if (!o.cashEntryUid || !o.reconUid || !c.cashierUid) return;
    try {
      await this.safe.requestDeposit(o.cashEntryUid, o.reconUid, c.cashierUid);
      this.toast.success(this.i18n.t('Request noted in the audit history', 'Ombi limerekodiwa kwenye historia ya ukaguzi'));
    } catch (e) {
      this.toast.error(ApiError.from(e).message);
    }
  }
}
