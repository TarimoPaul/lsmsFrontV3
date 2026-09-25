import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';

import { AuthService } from '@core/auth/auth.service';
import { LanguageService } from '@core/i18n/language.service';
import { Button, DialogService, Icon, ToastService } from '@shared/ui';
import { parseLocal } from '@shared/utils/date-utils';
import { MoneyPipe } from '@shared/utils/money';
import { AuditEntry, ReconSnapshot, SafeBoxUnconfirmed } from './recon-extra.models';
import { ReconStatement } from './recon-statement';
import { ReconStore } from './recon.store';
import { CASH_TYPES, EXPENSE_TYPES, Recon, SHORTAGE_REASONS, VerifyType, pendingVerification } from './reconciliation.models';
import { ReconResult, ReconciliationService } from './reconciliation.service';
import { SafeBoxService } from './safe-box.service';

type Prompt = 'unsubmit' | 'reopen' | 'zero-submit' | 'zero-review' | 'self-approve';

interface CheckItem {
  type: VerifyType;
  uid: string;
  label: string;
  amount: number;
  verified: boolean;
}

const ZERO_CASH_PRESETS = [
  { en: 'All went to the bank', sw: 'Yote ilikwenda benki' },
  { en: 'All is in the safe box', sw: 'Yote iko kwenye Safe Box' },
  { en: 'No cash sales', sw: 'Hakuna mauzo ya taslimu' },
];

/**
 * Approval tab — port of Flutter `_ApprovalTab`: the shared statement,
 * variance explanation, item-by-item verification (approver), the workflow
 * buttons with Flutter's gates (all items verified; variance > 1,000 needs an
 * explanation; zero-cash reason; self-approve reason) and the timeline.
 */
@Component({
  selector: 'app-recon-approval-tab',
  imports: [ReconStatement, Button, Icon, MoneyPipe, DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (store.current(); as r) {
      <app-recon-statement [recon]="r" [liveTotal]="store.summary()?.totalSales ?? null" />

      @if (r.reopenCount >= 2) {
        <p class="alert err"><lsms-icon name="history" [size]="18" />{{ i18n.t('This reconciliation has been reopened ' + r.reopenCount + ' times — check the history and audit log carefully.', 'Upatanisho huu umefunguliwa tena mara ' + r.reopenCount + ' — kagua historia na kumbukumbu kwa makini.') }}</p>
      }
      @if (debtGap() !== 0) {
        <p class="alert warn"><lsms-icon name="payments" [size]="18" />
          {{ debtGap() > 0
            ? i18n.t('Debt money collected but not declared: ', 'Pesa za madeni zilizokusanywa lakini hazijatajwa: ')
            : i18n.t('Debt money declared above what was collected: ', 'Pesa za madeni zilizotajwa zaidi ya zilizokusanywa: ') }}<b>{{ abs(debtGap()) | money }}</b>
        </p>
      }

      <!-- Variance explanation -->
      @if (hasVariance() && canExplain()) {
        <section class="add">
          <h4><lsms-icon name="edit_note" [size]="16" />{{ i18n.t('Explain the difference', 'Eleza tofauti') }}</h4>
          <div class="chips">
            @for (k of reasonKeys; track k) {
              <button type="button" [class.on]="reason() === k" (click)="reason.set(k)">{{ i18n.isSwahili() ? reasons[k].sw : reasons[k].en }}</button>
            }
          </div>
          <div class="grid">
            <label class="wide">
              <span>{{ i18n.t('Explanation', 'Maelezo') }}</span>
              <textarea rows="2" maxlength="1000" [value]="explanation()" (input)="explanation.set($any($event.target).value)"></textarea>
            </label>
          </div>
          <div class="actions">
            <button lsmsButton="secondary" size="sm" icon="save" [loading]="store.saving()" [disabled]="explanation().trim().length < 3" (click)="saveExplanation()">{{ i18n.t('Save explanation', 'Hifadhi maelezo') }}</button>
          </div>
        </section>
      }

      <!-- Verification (approver) -->
      @if (canApprove() && (r.status === 'SUBMITTED' || r.status === 'REVIEWED') && checks().length) {
        <section class="add">
          <h4>
            <lsms-icon name="fact_check" [size]="16" />{{ i18n.t('Verify each item', 'Thibitisha kila kipengele') }}
            <span class="count">{{ checks().length - pending() }}/{{ checks().length }}</span>
          </h4>
          <ul class="items">
            @for (c of checks(); track c.type + c.uid) {
              <li>
                <span class="t"><b>{{ c.label }}</b><small>{{ c.type }}</small></span>
                <b class="amt">{{ c.amount | money }}</b>
                <button type="button" class="vbtn" [class.on]="c.verified" [disabled]="store.saving()" (click)="toggle(c)">
                  <lsms-icon [name]="c.verified ? 'check_circle' : 'radio_button_unchecked'" [size]="18" [filled]="c.verified" />{{ c.verified ? i18n.t('Verified', 'Imethibitishwa') : i18n.t('Verify', 'Thibitisha') }}
                </button>
              </li>
            }
          </ul>
        </section>
      }

      <!-- Notes for review / approve -->
      @if (canApprove() && (r.status === 'SUBMITTED' || r.status === 'REVIEWED')) {
        <div class="grid">
          <label class="wide">
            <span>{{ i18n.t('Notes for this step (optional)', 'Maelezo ya hatua hii (hiari)') }}</span>
            <input type="text" maxlength="500" [value]="notes()" (input)="notes.set($any($event.target).value)" />
          </label>
        </div>
      }

      <!-- Inline reason prompt -->
      @if (prompt(); as p) {
        <section class="add prompt" [class.danger]="p === 'reopen'">
          <h4><lsms-icon [name]="p === 'reopen' ? 'lock_open' : p === 'unsubmit' ? 'undo' : 'help'" [size]="16" />{{ promptTitle() }}</h4>
          @if (p === 'zero-submit' || p === 'zero-review') {
            <div class="chips">
              @for (z of zeroPresets; track z.en) {
                <button type="button" [class.on]="promptText() === (i18n.isSwahili() ? z.sw : z.en)" (click)="promptText.set(i18n.isSwahili() ? z.sw : z.en)">{{ i18n.isSwahili() ? z.sw : z.en }}</button>
              }
            </div>
          }
          @if (p === 'reopen' && r.reopenCount > 0) {
            <p class="warn">{{ i18n.t('Already reopened ' + r.reopenCount + ' time(s).', 'Tayari imefunguliwa mara ' + r.reopenCount + '.') }}</p>
          }
          <div class="grid">
            <label class="wide">
              <span>{{ i18n.t('Reason', 'Sababu') }} ({{ i18n.t('at least', 'angalau') }} {{ promptMin() }} {{ i18n.t('letters', 'herufi') }})</span>
              <textarea rows="2" maxlength="500" [value]="promptText()" (input)="promptText.set($any($event.target).value)"></textarea>
            </label>
          </div>
          <div class="actions">
            <button lsmsButton="secondary" size="sm" (click)="prompt.set(null)">{{ i18n.t('Cancel', 'Ghairi') }}</button>
            <button [lsmsButton]="p === 'reopen' ? 'danger' : 'primary'" size="sm" [loading]="store.saving()" [disabled]="promptText().trim().length < promptMin()" (click)="confirmPrompt()">{{ i18n.t('Confirm', 'Thibitisha') }}</button>
          </div>
        </section>
      }

      @if (unconfirmed(); as u) {
        @if (u.count > 0 && canApprove() && (r.status === 'SUBMITTED' || r.status === 'REVIEWED')) {
          <p class="alert info"><lsms-icon name="lock" [size]="18" />{{ i18n.t(u.count + ' safe box amount(s) of ' , 'Kiasi ' + u.count + ' cha safeni cha ') }}<b>{{ u.total | money }}</b>{{ i18n.t(' not yet confirmed as banked / handed over. Approving is still allowed — it will show as owed by the cashier.', ' bado hakijathibitishwa kupelekwa benki / kukabidhiwa. Unaweza kuidhinisha — kitaonekana kama deni la cashier.') }}</p>
        }
      }

      <!-- Actions -->
      @if (!prompt()) {
        <div class="bar">
          @if ((r.status === 'DRAFT' || r.status === 'REOPENED') && can('RECONCILIATION_SUBMIT') && store.isMine()) {
            <button lsmsButton icon="send" [loading]="store.saving()" (click)="submit()">{{ i18n.t('Submit for approval', 'Wasilisha kwa idhini') }}</button>
          }
          @if (r.status === 'SUBMITTED' && r.userUid === store.me()) {
            <button lsmsButton="secondary" icon="undo" (click)="ask('unsubmit')">{{ i18n.t('Take back to fix', 'Rudisha kwa marekebisho') }}</button>
          }
          @if (r.status === 'SUBMITTED' && canApprove()) {
            <button lsmsButton="secondary" icon="rate_review" [loading]="store.saving()" (click)="review()">{{ i18n.t('Mark reviewed', 'Kagua') }}</button>
          }
          @if (r.status === 'REVIEWED' && canApprove()) {
            @if (pending() > 0) {
              <button lsmsButton="success" icon="lock" [disabled]="true">{{ i18n.t('Verify ' + pending() + ' item(s) first', 'Thibitisha vipengele ' + pending() + ' kwanza') }}</button>
            } @else if (needsExplanation()) {
              <button lsmsButton="success" icon="warning" [disabled]="true">{{ i18n.t('Explain the difference first', 'Andika maelezo ya tofauti kwanza') }}</button>
            } @else {
              <button lsmsButton="success" icon="verified" [loading]="store.saving()" (click)="approve()">{{ i18n.t('Approve', 'Idhinisha') }}</button>
            }
          }
          @if ((r.status === 'APPROVED' || r.status === 'CLOSED') && can('RECONCILIATION_REOPEN')) {
            <button lsmsButton="danger" icon="lock_open" (click)="ask('reopen')">{{ i18n.t('Reopen', 'Fungua tena') }}</button>
          }
        </div>
      }

      <!-- Timeline -->
      <section class="add">
        <h4><lsms-icon name="timeline" [size]="16" />{{ i18n.t('History', 'Historia') }}</h4>
        <ul class="timeline">
          @for (e of timeline(); track e.label + e.at) {
            <li [style.--tc]="e.color">
              <b>{{ e.label }}</b>
              <small>{{ date(e.at) | date: 'dd MMM yyyy, HH:mm' }}@if (e.by) { · {{ e.by }} }</small>
              @if (e.note) {
                <i>“{{ e.note }}”</i>
              }
            </li>
          }
        </ul>
      </section>

      @if (snapshot(); as sn) {
        <section class="add">
          <h4><lsms-icon name="photo_camera" [size]="16" />{{ i18n.t('Figures frozen at approval', 'Takwimu zilizohifadhiwa wakati wa idhini') }}</h4>
          <small class="muted">{{ i18n.t('Approved by', 'Imeidhinishwa na') }} {{ sn.approvedByName || '—' }} · {{ date(sn.approvedAt) | date: 'dd MMM yyyy, HH:mm' }}</small>
          <dl class="snap">
            <dt>{{ i18n.t('Total sales', 'Jumla ya mauzo') }}</dt><dd>{{ sn.totalSales | money }}</dd>
            <dt>{{ i18n.t('Cash declared', 'Taslimu iliyotajwa') }}</dt><dd>{{ sn.cashOnHand | money }}</dd>
            <dt>{{ i18n.t('Bank', 'Benki') }}</dt><dd>{{ sn.bankDeposits - sn.safeBox | money }}</dd>
            @if (sn.safeBox > 0.01) { <dt>{{ i18n.t('Safe box', 'Sefu') }}</dt><dd>{{ sn.safeBox | money }}</dd> }
            <dt>{{ i18n.t('Mobile money', 'Pesa za simu') }}</dt><dd>{{ sn.mobileMoney | money }}</dd>
            <dt>{{ i18n.t('Debts', 'Madeni') }}</dt><dd>{{ sn.retailDebts | money }}</dd>
            <dt>{{ i18n.t('Expenses', 'Matumizi') }}</dt><dd>{{ sn.expenses | money }}</dd>
            <dt>{{ i18n.t('Purchases', 'Manunuzi') }}</dt><dd>{{ sn.purchases | money }}</dd>
            <dt>{{ i18n.t('Debt collections', 'Makusanyo ya madeni') }}</dt><dd>{{ sn.debtCollections | money }}</dd>
            <dt><b>{{ i18n.t('Difference', 'Tofauti') }}</b></dt><dd [class.neg]="sn.variance > 0.01" [class.pos]="sn.variance < -0.01"><b>{{ sn.variance | money }}</b></dd>
          </dl>
          @if (r.hasDrift && r.postApprovalDrift !== null) {
            <p class="alert warn"><lsms-icon name="compare_arrows" [size]="18" />{{ i18n.t('Figures changed after approval by ', 'Takwimu zimebadilika baada ya idhini kwa ') }}<b>{{ r.postApprovalDrift | money }}</b></p>
          }
        </section>
      }

      <section class="add">
        <button type="button" class="audit-head" (click)="toggleAudit()" [attr.aria-expanded]="showAudit()">
          <lsms-icon name="manage_search" [size]="16" /><b>{{ i18n.t('Audit log', 'Kumbukumbu za mabadiliko') }}</b>
          @if (audit().length) { <span class="count">{{ audit().length }}</span> }
          <lsms-icon [name]="showAudit() ? 'expand_less' : 'expand_more'" [size]="20" />
        </button>
        @if (showAudit()) {
          @if (!audit().length) {
            <small class="muted">{{ i18n.t('No entries.', 'Hakuna kumbukumbu.') }}</small>
          } @else {
            <ul class="audit">
              @for (a of audit(); track a.uid) {
                <li>
                  <span class="act">{{ a.action }}</span>
                  <span class="who"><b>{{ a.actorName || '—' }}</b><small>{{ date(a.at) | date: 'dd MMM yyyy, HH:mm' }}</small></span>
                  @if (a.details) { <code>{{ a.details }}</code> }
                </li>
              }
            </ul>
          }
        }
      </section>
    }
  `,
  styleUrl: './recon-tab.scss',
  styles: `
    .count { margin-left: auto; padding: 1px 8px; border-radius: 100px; font-size: 0.72rem; color: var(--c-primary); background: color-mix(in srgb, var(--c-primary) 10%, transparent); }
    .vbtn { display: inline-flex; align-items: center; gap: 4px; padding: 5px 10px; border-radius: 9px; border: 1px solid var(--c-border); background: var(--c-surface); font: inherit; font-size: 0.76rem; font-weight: 700; color: var(--c-text-2); cursor: pointer; }
    .vbtn.on { color: var(--c-success); border-color: color-mix(in srgb, var(--c-success) 45%, transparent); background: color-mix(in srgb, var(--c-success) 8%, var(--c-surface)); }
    .bar { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 8px; }
    .prompt { border-color: color-mix(in srgb, var(--c-primary) 40%, transparent); }
    .prompt.danger { border-color: color-mix(in srgb, var(--c-error) 40%, transparent); }
    .warn { font-size: 0.78rem; font-weight: 600; color: var(--c-warning); }
    .timeline { list-style: none; margin: 0; padding: 0 0 0 14px; border-left: 2px solid var(--c-border); }
    .timeline li { --tc: var(--c-primary); position: relative; display: flex; flex-direction: column; padding: 0 0 12px 12px; font-size: 0.82rem; }
    .timeline li:last-child { padding-bottom: 0; }
    .timeline li::before { content: ''; position: absolute; left: -20px; top: 3px; width: 10px; height: 10px; border-radius: 50%; background: var(--tc); box-shadow: 0 0 0 3px var(--c-surface); }
    .timeline small { color: var(--c-text-2); }
    .timeline i { color: var(--c-text-2); font-size: 0.78rem; }
    .alert { display: flex; align-items: center; flex-wrap: wrap; gap: 6px; padding: 10px 12px; border-radius: 12px; font-size: 0.82rem; }
    .alert.err { color: var(--c-error); background: color-mix(in srgb, var(--c-error) 7%, var(--c-surface)); border: 1px solid color-mix(in srgb, var(--c-error) 25%, var(--c-border)); }
    .alert.warn { color: var(--c-warning); background: color-mix(in srgb, var(--c-warning) 7%, var(--c-surface)); border: 1px solid color-mix(in srgb, var(--c-warning) 25%, var(--c-border)); }
    .alert.info { color: var(--c-text); background: color-mix(in srgb, var(--c-info) 7%, var(--c-surface)); border: 1px solid color-mix(in srgb, var(--c-info) 25%, var(--c-border)); }
    .alert.info lsms-icon { color: var(--c-info); }
    .muted { color: var(--c-text-2); font-size: 0.76rem; }
    .snap { display: grid; grid-template-columns: 1fr auto; gap: 6px 16px; margin: 0; font-size: 0.84rem; }
    .snap dt { color: var(--c-text-2); }
    .snap dd { margin: 0; text-align: right; font-variant-numeric: tabular-nums; }
    .snap .neg { color: var(--c-error); }
    .snap .pos { color: var(--c-success); }
    .audit-head { display: flex; align-items: center; gap: 6px; padding: 0; border: 0; background: none; font: inherit; font-size: 0.86rem; color: var(--c-text); cursor: pointer; }
    .audit-head lsms-icon:first-child { color: var(--c-primary); }
    .audit-head .count { margin-left: 4px; }
    .audit-head lsms-icon:last-child { margin-left: auto; }
    .audit { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; }
    .audit li { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 10px; padding: 8px 0; border-top: 1px dashed var(--c-border); font-size: 0.8rem; }
    .audit .act { padding: 1px 8px; border-radius: 6px; font-size: 0.7rem; font-weight: 700; letter-spacing: 0.3px; color: var(--c-primary); background: color-mix(in srgb, var(--c-primary) 10%, transparent); }
    .audit .who { display: flex; flex-direction: column; flex: 1; min-width: 0; }
    .audit .who small { color: var(--c-text-2); }
    .audit code { flex-basis: 100%; font-size: 0.72rem; color: var(--c-text-2); word-break: break-all; }
  `,
})
export class ReconApprovalTab {
  protected readonly i18n = inject(LanguageService);
  protected readonly store = inject(ReconStore);
  private readonly auth = inject(AuthService);
  private readonly api = inject(ReconciliationService);
  private readonly toast = inject(ToastService);
  private readonly dialogs = inject(DialogService);
  private readonly safe = inject(SafeBoxService);

  protected readonly snapshot = signal<ReconSnapshot | null>(null);
  protected readonly audit = signal<AuditEntry[]>([]);
  protected readonly showAudit = signal(false);
  protected readonly unconfirmed = signal<SafeBoxUnconfirmed | null>(null);
  private loadedFor: string | null = null;

  /** Collected on old debts vs declared (cash + bank + mobile) — positive = not declared. */
  protected readonly debtGap = computed(() => {
    const r = this.store.current();
    return r ? Math.round((r.debtCollectionsTotal - r.cashDebtTotal - r.bankDebtTotal - r.mobileDebtTotal) * 100) / 100 : 0;
  });

  protected readonly reasons = SHORTAGE_REASONS;
  protected readonly reasonKeys = Object.keys(SHORTAGE_REASONS);
  protected readonly zeroPresets = ZERO_CASH_PRESETS;

  protected readonly notes = signal('');
  protected readonly reason = signal<string | null>(null);
  protected readonly explanation = signal('');
  protected readonly prompt = signal<Prompt | null>(null);
  protected readonly promptText = signal('');

  protected readonly canApprove = computed(() => this.auth.hasPermission('RECONCILIATION_APPROVE'));
  protected readonly hasVariance = computed(() => Math.abs(this.store.current()?.result ?? 0) > 0.01);
  protected readonly canExplain = computed(() => {
    const s = this.store.current()?.status;
    return !!s && s !== 'APPROVED' && s !== 'CLOSED' && (this.store.isMine() || this.canApprove());
  });
  protected readonly needsExplanation = computed(() => {
    const r = this.store.current();
    return !!r && Math.abs(r.result) > 1000 && !r.varianceExplanation?.trim();
  });
  protected readonly pending = computed(() => (this.store.current() ? pendingVerification(this.store.current()!) : 0));
  protected readonly checks = computed<CheckItem[]>(() => buildChecks(this.store.current(), this.i18n.isSwahili()));
  protected readonly promptMin = computed(() => (this.prompt() === 'reopen' ? 10 : this.prompt() === 'unsubmit' ? 5 : 3));
  protected readonly promptTitle = computed(() => {
    const t = (en: string, sw: string) => this.i18n.t(en, sw);
    switch (this.prompt()) {
      case 'unsubmit':
        return t('Take back to draft to fix it?', 'Rudisha kwenye rasimu kwa marekebisho?');
      case 'reopen':
        return t('Reopen this approved reconciliation?', 'Fungua tena upatanisho ulioidhinishwa?');
      case 'self-approve':
        return t('Why are you approving your own reconciliation?', 'Kwa nini unajiidhinishia upatanisho wako?');
      default:
        return t('No cash declared — where did the cash go?', 'Hakuna taslimu iliyotajwa — pesa ziko wapi?');
    }
  });

  protected readonly timeline = computed(() => {
    const r = this.store.current();
    const t = (en: string, sw: string) => this.i18n.t(en, sw);
    if (!r) return [];
    const ev = [
      { label: t('Started', 'Imeanzishwa'), at: r.createdAt, by: r.userName, color: 'var(--c-text-2)', note: null as string | null },
      { label: t('Submitted', 'Imewasilishwa'), at: r.submittedAt, by: r.userName, color: 'var(--c-info)', note: r.zeroCashReason },
      { label: t('Reviewed', 'Imekaguliwa'), at: r.reviewedAt, by: r.reviewedByName, color: 'var(--c-warning)', note: r.reviewNotes },
      { label: t('Approved', 'Imeidhinishwa'), at: r.approvedAt, by: r.approvedByName, color: 'var(--c-success)', note: r.approvalNotes },
      { label: t('Reopened', 'Imefunguliwa tena'), at: r.reopenedAt, by: null, color: 'var(--c-error)', note: r.reopenReason },
    ];
    return ev.filter((e) => !!e.at).sort((a, b) => (a.at ?? '').localeCompare(b.at ?? ''));
  });

  constructor() {
    // Side data for the open record: audit log, the approval snapshot and the safe-box warning.
    effect(() => {
      const r = this.store.current();
      const key = r ? `${r.uid}|${r.status}` : null;
      untracked(() => {
        if (!r || key === this.loadedFor) return;
        this.loadedFor = key;
        this.snapshot.set(null);
        this.unconfirmed.set(null);
        void this.api.auditLog(r.uid).then((a) => this.store.current()?.uid === r.uid && this.audit.set(a));
        if (r.status === 'APPROVED' || r.status === 'CLOSED') void this.api.snapshot(r.uid).then((s) => this.store.current()?.uid === r.uid && this.snapshot.set(s));
        if (this.canApprove() && (r.status === 'SUBMITTED' || r.status === 'REVIEWED')) void this.safe.unconfirmed(r.uid).then((u) => this.store.current()?.uid === r.uid && this.unconfirmed.set(u));
      });
    });
  }

  protected toggleAudit(): void {
    this.showAudit.update((v) => !v);
  }

  protected abs(v: number): number {
    return Math.abs(v);
  }

  protected can(p: string): boolean {
    return this.auth.hasPermission(p);
  }

  protected date(v: string | null): Date | null {
    return parseLocal(v);
  }

  protected ask(p: Prompt): void {
    this.promptText.set(p === 'zero-submit' || p === 'zero-review' ? (this.i18n.isSwahili() ? ZERO_CASH_PRESETS[0].sw : ZERO_CASH_PRESETS[0].en) : '');
    this.prompt.set(p);
  }

  private handle(res: ReconResult, zero?: Prompt): boolean {
    if (res.recon) return true;
    if (res.code === 'ZERO_CASH_DECLARATION' && zero) {
      this.ask(zero);
      return false;
    }
    if (res.code === 'STALE_DEBT_COLLECTIONS') {
      this.toast.info(this.i18n.t('New debt payments arrived — refreshed, check and approve again.', 'Malipo mapya ya madeni yameingia — imesasishwa, kagua kisha idhinisha tena.'));
      void this.store.refresh();
      return false;
    }
    if (res.error) this.toast.error(res.error);
    return false;
  }

  protected async submit(zeroCashReason?: string): Promise<void> {
    const res = await this.store.act((uid) => this.api.submit(uid, zeroCashReason), this.i18n.t('Submitted for approval', 'Imewasilishwa kwa idhini'));
    this.handle(res, 'zero-submit');
  }

  protected async review(zeroCashReason?: string): Promise<void> {
    const res = await this.store.act((uid) => this.api.review(uid, this.notes().trim() || undefined, zeroCashReason), this.i18n.t('Marked as reviewed', 'Imekaguliwa'));
    if (this.handle(res, 'zero-review')) this.notes.set('');
  }

  protected async approve(selfReason?: string): Promise<void> {
    const r = this.store.current();
    if (!r) return;
    if (!selfReason && r.userUid === this.store.me() && this.auth.hasPermission('RECONCILIATION_SELF_APPROVE')) {
      this.ask('self-approve');
      return;
    }
    const res = await this.store.act((uid) => this.api.approve(uid, selfReason ?? (this.notes().trim() || undefined)), this.i18n.t('Approved', 'Imeidhinishwa'));
    if (this.handle(res)) this.notes.set('');
  }

  protected async confirmPrompt(): Promise<void> {
    const p = this.prompt();
    const text = this.promptText().trim();
    if (!p || text.length < this.promptMin()) return;
    this.prompt.set(null);
    if (p === 'zero-submit') return this.submit(text);
    if (p === 'zero-review') return this.review(text);
    if (p === 'self-approve') return this.approve(text);
    const res =
      p === 'unsubmit'
        ? await this.store.act((uid) => this.api.unsubmit(uid, text), this.i18n.t('Back to draft', 'Imerudishwa kwenye rasimu'))
        : await this.store.act((uid) => this.api.reopen(uid, text), this.i18n.t('Reopened', 'Imefunguliwa tena'));
    this.handle(res);
  }

  protected async toggle(c: CheckItem): Promise<void> {
    let reason: string | undefined;
    // Separation of duties: verifying your own item needs RECONCILIATION_SELF_APPROVE + a reason.
    if (this.store.current()?.userUid === this.store.me() && this.auth.hasPermission('RECONCILIATION_SELF_APPROVE')) {
      const { ReasonDialog } = await import('./reason-dialog');
      reason = await this.dialogs.openAsync<string>(ReasonDialog, {
        size: 'sm',
        data: {
          title: this.i18n.t('Verifying your own item', 'Kuthibitisha kipengele chako mwenyewe'),
          message: this.i18n.t('You recorded this yourself — a reason is required and is kept in the audit log.', 'Wewe ndiye uliyerekodi hiki — sababu inahitajika na inahifadhiwa kwenye kumbukumbu.'),
          label: this.i18n.t('Reason', 'Sababu'),
          confirm: c.verified ? this.i18n.t('Remove verification', 'Ondoa uthibitisho') : this.i18n.t('Verify', 'Thibitisha'),
        },
      });
      if (!reason) return;
    }
    const res = await this.store.act((uid) => this.api.verify(uid, c.type, c.uid, !c.verified, reason));
    this.handle(res);
  }

  protected async saveExplanation(): Promise<void> {
    const res = await this.store.act((uid) => this.api.explain(uid, this.explanation().trim(), this.reason()), this.i18n.t('Explanation saved', 'Maelezo yamehifadhiwa'));
    this.handle(res);
  }
}

function buildChecks(r: Recon | null, sw: boolean): CheckItem[] {
  if (!r) return [];
  const out: CheckItem[] = [];
  for (const e of r.cashEntries) out.push({ type: 'CASH', uid: e.uid, label: CASH_TYPES[e.type] ? (sw ? CASH_TYPES[e.type].sw : CASH_TYPES[e.type].en) : e.type, amount: e.amount, verified: e.verified });
  for (const e of r.mobileEntries) out.push({ type: 'MOBILE', uid: e.uid, label: e.provider, amount: e.amount, verified: e.verified });
  for (const e of r.collections) out.push({ type: 'COLLECTION', uid: e.uid, label: e.customerName ?? e.receipt ?? '—', amount: e.amount, verified: e.verified });
  for (const d of r.debts.filter((x) => !x.isPaid)) out.push({ type: 'DEBT', uid: d.uid, label: d.customerName ?? '—', amount: d.amount, verified: d.verified });
  for (const e of r.expenses) out.push({ type: 'EXPENSE', uid: e.uid, label: e.description || (EXPENSE_TYPES[e.type] ? (sw ? EXPENSE_TYPES[e.type].sw : EXPENSE_TYPES[e.type].en) : e.type), amount: e.amount, verified: e.verified });
  for (const p of r.purchases) out.push({ type: 'PURCHASE', uid: p.uid, label: p.description || p.supplier || '—', amount: p.amount, verified: p.verified });
  return out;
}
