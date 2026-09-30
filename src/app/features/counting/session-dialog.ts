import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';

import { ApiError } from '@core/api/api.types';
import { AuthService } from '@core/auth/auth.service';
import { LanguageService } from '@core/i18n/language.service';
import { Button, DialogService, DialogShell, Icon, SelectField, SelectOption, Skeleton, ToastService } from '@shared/ui';
import { parseLocal } from '@shared/utils/date-utils';
import { Money, MoneyPipe } from '@shared/utils/money';
import { ProductsService } from '../products/products.service';
import { ReasonDialog, ReasonDialogData } from '../reconciliation/reason-dialog';
import { StoreService } from '../store/store.service';
import {
  ADJUSTMENT_REASONS,
  CASHIER_REASONS,
  CHARGE_REASONS,
  CountLine,
  CountSession,
  DECISIONS,
  LineDecision,
  LineDecisionDraft,
  SESSION_STATUS,
  formatQty,
  hasVariance,
} from './counting.models';
import { CountingService } from './counting.service';
import { VarianceMetrics } from './variance-metrics';

export interface SessionDialogData {
  uid: string;
  /** Opened from the approval queue → decision controls (still needs COUNTING_APPROVE). */
  approvable: boolean;
}

const needsReason = (d: LineDecision) => d === 'ADJUST' || d === 'CHARGE_TO_CASHIER';

/**
 * One stock count in detail — port of Flutter `CountingSessionDetailScreen`.
 * Read-only from History; from the approval queue the approver decides every
 * variance line (Adjust stock / No action / Charge staff, with a reason), can
 * bulk-apply an Adjust reason, then approves. Force-close needs a reason.
 * Closes with `true` when the session changed.
 */
@Component({
  selector: 'app-session-dialog',
  imports: [DialogShell, Button, Icon, Skeleton, SelectField, VarianceMetrics, DatePipe, MoneyPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <lsms-dialog [title]="title()" icon="checklist">
      @if (loading()) {
        <lsms-skeleton variant="list" [rows]="6" />
      } @else if (error() && !session()) {
        <p class="err"><lsms-icon name="error" [size]="18" />{{ error() }}</p>
      } @else if (approvedNow()) {
        <section class="done">
          <lsms-icon name="task_alt" [size]="56" />
          <h3>{{ i18n.t('Count approved', 'Zoezi limethibitishwa') }}</h3>
          <p>{{ summaryText() }}</p>
        </section>
      } @else if (session(); as s) {
        @let st = SESSION_STATUS[s.status];
        <section class="head">
          <div class="badges">
            <span class="mode" [class.sighted]="s.countMode === 'SIGHTED'"><lsms-icon [name]="s.countMode === 'SIGHTED' ? 'visibility' : 'visibility_off'" [size]="18" />{{ s.countMode === 'SIGHTED' ? 'SIGHTED' : 'BLIND' }}</span>
            <span class="pill" [style.--pc]="st.color"><lsms-icon [name]="st.icon" [size]="14" />{{ i18n.isSwahili() ? st.sw : st.en }}</span>
          </div>
          <div class="facts">
            <span><small>{{ i18n.t('Counted', 'Zimehesabiwa') }}</small><b>{{ s.itemsCounted }}/{{ s.totalItems }}</b></span>
            @if (s.itemsWithVariance !== null) {
              <span><small>{{ i18n.t('With difference', 'Zenye tofauti') }}</small><b>{{ s.itemsWithVariance }}</b></span>
            }
            @if (s.totalVarianceValue !== null) {
              <span><small>{{ i18n.t('Difference value', 'Thamani ya tofauti') }}</small><b [class.neg]="s.totalVarianceValue < 0" [class.pos]="s.totalVarianceValue > 0">{{ s.totalVarianceValue | money: { decimals: 0 } }}</b></span>
            }
            <span><small>{{ i18n.t('Counted by', 'Aliyehesabu') }}</small><b>{{ name(s.startedByUid) }}</b></span>
            @if (s.approvedByUid) {
              <span><small>{{ i18n.t('Approved by', 'Amethibitisha') }}</small><b>{{ name(s.approvedByUid) }} · {{ day(s.approvedAt) | date: 'dd MMM HH:mm' }}</b></span>
            }
          </div>
          @if (s.countMode === 'SIGHTED') {
            <p class="warn"><lsms-icon name="visibility" [size]="16" />{{ i18n.t('Sighted count — the counter could see system quantities, so a zero difference proves nothing.', 'Kuhesabu kwa kuona — mhesabu aliona idadi ya mfumo, hivyo tofauti sifuri haithibitishi kitu.') }}</p>
          }
          @if (s.status === 'FORCE_CLOSED' && s.forceClosedReason) {
            <p class="bad"><lsms-icon name="block" [size]="16" />{{ i18n.t('Force-closed', 'Imefungwa kwa nguvu') }}: {{ s.forceClosedReason }}</p>
          }
        </section>

        <div class="tools">
          <div class="seg" role="tablist">
            <button type="button" role="tab" [class.on]="!onlyVariance()" (click)="onlyVariance.set(false)">{{ i18n.t('All', 'Zote') }} <em>{{ s.lines.length }}</em></button>
            <button type="button" role="tab" [class.on]="onlyVariance()" (click)="onlyVariance.set(true)">{{ i18n.t('With difference', 'Zenye tofauti') }} <em>{{ varianceLines().length }}</em></button>
          </div>
          <input type="search" [value]="query()" (input)="query.set($any($event.target).value)" [placeholder]="i18n.t('Search product…', 'Tafuta bidhaa…')" [attr.aria-label]="i18n.t('Search product', 'Tafuta bidhaa')" />
        </div>

        @if (deciding() && selected().size) {
          <div class="bulk">
            <b>{{ i18n.t(selected().size + ' selected', 'Zilizochaguliwa: ' + selected().size) }}</b>
            <lsms-select-field [dense]="true" [options]="adjustOptions" [placeholder]="i18n.t('Set reason → Adjust stock', 'Weka sababu → Marekebisho')" [value]="null" (valueChange)="bulkAdjust($event)" [ariaLabel]="i18n.t('Bulk adjust reason', 'Sababu ya marekebisho kwa zote')" />
            <button type="button" class="clear" (click)="clearSelection()">{{ i18n.t('Clear', 'Futa') }}</button>
          </div>
        }

        <ul class="lines">
          @for (l of lines(); track l.uid; let i = $index) {
            @let v = hasVar(l);
            @let d = decisions()[l.uid];
            <li [class.var]="v" [class.short]="(l.varianceQty ?? 0) < 0">
              <div class="l-head">
                @if (deciding() && v) {
                  <input type="checkbox" [checked]="selected().has(l.uid)" (change)="toggle(l.uid)" [attr.aria-label]="i18n.t('Select', 'Chagua') + ' ' + l.productName" />
                }
                <span class="no">{{ i + 1 }}</span>
                <b>{{ l.productName }}</b>
                @if (deciding() && v) {
                  <span class="state" [class.ok]="complete(l.uid)">{{ complete(l.uid) ? i18n.t('Decided', 'Imeamuliwa') : i18n.t('Needs decision', 'Inahitaji uamuzi') }}</span>
                }
              </div>
              @if (l.postCountMovementFlag) {
                <p class="note info"><lsms-icon name="swap_vert" [size]="14" />{{ i18n.t('After counting', 'Baada ya kuhesabu') }}: {{ l.postCountMovementNote || '—' }}</p>
              }
              <app-variance-metrics [line]="l" />
              @if (v) {
                @if (l.explainedAt) {
                  <p class="note info"><lsms-icon name="record_voice_over" [size]="14" /><span><b>{{ i18n.t('Counter says', 'Maelezo ya mhesabu') }}: {{ cashierReason(l.cashierReason) }}</b>@if (l.cashierNote) { — {{ l.cashierNote }} }</span></p>
                } @else {
                  <p class="note warn-t"><lsms-icon name="help" [size]="14" />{{ i18n.t('Not explained by the counter', 'Haijaelezwa na mhesabu') }}</p>
                }
              }
              @if (l.recountQty !== null) {
                <p class="note re"><lsms-icon name="replay" [size]="14" /><span>{{ i18n.t('Count 1', 'Kuhesabu 1') }}: <b>{{ fmt(l, l.firstCountQty) }}</b> · {{ i18n.t('Count 2', 'Kuhesabu 2') }}: <b>{{ fmt(l, l.recountQty) }}</b>@if (l.recountReason) { — {{ l.recountReason }} }</span></p>
              }
              @if (deciding() && v) {
                <div class="decide" role="radiogroup" [attr.aria-label]="i18n.t('Decision', 'Uamuzi')">
                  @for (k of decisionKeys; track k) {
                    <button type="button" role="radio" [attr.aria-checked]="d?.decision === k" [class.on]="d?.decision === k" [style.--dc]="DECISIONS[k].color" (click)="decide(l.uid, k)">
                      <lsms-icon [name]="DECISIONS[k].icon" [size]="16" />{{ i18n.isSwahili() ? DECISIONS[k].sw : DECISIONS[k].en }}
                    </button>
                  }
                </div>
                @if (d && needsReason(d.decision)) {
                  <div class="reason">
                    <lsms-select-field
                      [dense]="true"
                      [options]="d.decision === 'CHARGE_TO_CASHIER' ? chargeOptions : adjustOptions"
                      [value]="d.reason ?? null"
                      [placeholder]="d.decision === 'CHARGE_TO_CASHIER' ? i18n.t('Reason for charging staff', 'Sababu ya kutoza mfanyakazi') : i18n.t('Adjustment reason', 'Sababu ya marekebisho')"
                      (valueChange)="setReason(l.uid, $event)"
                      [ariaLabel]="i18n.t('Reason', 'Sababu')"
                    />
                    @if (d.decision === 'CHARGE_TO_CASHIER') {
                      <input type="text" maxlength="300" [value]="d.notes ?? ''" (input)="setNotes(l.uid, $any($event.target).value)" [placeholder]="i18n.t('Note to the staff member (optional)', 'Maelezo kwa mfanyakazi (hiari)')" />
                      <small class="charge">{{ i18n.t('Debt to record', 'Deni litakaloandikwa') }}: {{ abs(l.varianceValue) | money: { decimals: 0 } }}</small>
                    }
                  </div>
                }
              }
            </li>
          } @empty {
            <li class="empty">{{ i18n.t('No products to show.', 'Hakuna bidhaa za kuonyesha.') }}</li>
          }
        </ul>

        @if (deciding()) {
          <section class="sum">
            <span><small>{{ i18n.t('Adjust stock', 'Marekebisho') }}</small><b>{{ totals().adjust }} · {{ totals().adjustQty > 0 ? '+' : '' }}{{ totals().adjustQty }} pcs · {{ totals().adjustValue | money: { decimals: 0 } }}</b></span>
            <span><small>{{ i18n.t('No action', 'Bila hatua') }}</small><b>{{ totals().none }}</b></span>
            @if (totals().charge) {
              <span class="c"><small>{{ i18n.t('Charge staff', 'Kutoza mfanyakazi') }}</small><b>{{ totals().charge }} · {{ totals().chargeValue | money: { decimals: 0 } }}</b></span>
            }
            <span><small>{{ i18n.t('Decided', 'Zimeamuliwa') }}</small><b>{{ decidedCount() }}/{{ varianceLines().length }}</b></span>
          </section>
        }
      }

      <ng-container dialogActions>
        @if (approvedNow()) {
          <button lsmsButton="primary" (click)="ref.close(true)">{{ i18n.t('Done', 'Rudi') }}</button>
        } @else {
          @if (canForceClose()) {
            <button lsmsButton="danger" icon="block" [loading]="closing()" (click)="forceClose()">{{ i18n.t('Force close', 'Funga kwa nguvu') }}</button>
          }
          <span class="spacer"></span>
          <button lsmsButton="secondary" (click)="ref.close(changed())">{{ i18n.t('Close', 'Funga') }}</button>
          @if (deciding()) {
            <button lsmsButton="success" icon="check" [disabled]="!allDecided()" [loading]="approving()" (click)="approve()">
              {{ allDecided() ? i18n.t('Approve count', 'Thibitisha zoezi') : i18n.t('Decide every difference first', 'Bado line zenye tofauti hazina uamuzi') }}
            </button>
          }
        }
      </ng-container>
    </lsms-dialog>
  `,
  styles: `
    .err { display: flex; align-items: center; gap: 8px; color: var(--c-error); }
    .done { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 28px 12px; text-align: center; color: var(--c-success); }
    .done h3 { margin: 0; font-size: 1.15rem; color: var(--c-text); }
    .done p { margin: 0; font-size: 0.86rem; color: var(--c-text-2); }
    .head { display: flex; flex-direction: column; gap: 10px; padding-bottom: 12px; border-bottom: 1px solid var(--c-border); }
    .badges { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
    .mode { display: inline-flex; align-items: center; gap: 6px; padding: 5px 12px; border-radius: 10px; font-size: 0.82rem; font-weight: 700; letter-spacing: 0.4px; color: var(--c-success); background: color-mix(in srgb, var(--c-success) 12%, transparent); border: 1px solid color-mix(in srgb, var(--c-success) 40%, transparent); }
    .mode.sighted { color: var(--c-warning); background: color-mix(in srgb, var(--c-warning) 12%, transparent); border-color: color-mix(in srgb, var(--c-warning) 40%, transparent); }
    .pill { display: inline-flex; align-items: center; gap: 4px; padding: 3px 10px; border-radius: 100px; font-size: 0.74rem; font-weight: 600; color: var(--pc); background: color-mix(in srgb, var(--pc) 12%, transparent); }
    .facts { display: flex; flex-wrap: wrap; gap: 8px 24px; }
    .facts span { display: flex; flex-direction: column; }
    .facts small, .sum small { font-size: 0.7rem; color: var(--c-text-2); }
    .facts b, .sum b { font-size: 0.86rem; font-weight: 600; color: var(--c-text); }
    .neg { color: var(--c-error) !important; }
    .pos { color: var(--c-success) !important; }
    .warn, .bad { display: flex; align-items: center; gap: 6px; margin: 0; padding: 8px 10px; border-radius: 10px; font-size: 0.8rem; }
    .warn { color: var(--c-warning); background: color-mix(in srgb, var(--c-warning) 9%, transparent); }
    .bad { color: var(--c-error); background: color-mix(in srgb, var(--c-error) 8%, transparent); }
    .tools { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; margin: 12px 0 8px; }
    .seg { display: inline-flex; padding: 3px; border-radius: 10px; background: color-mix(in srgb, var(--c-text-2) 10%, transparent); }
    .seg button { padding: 6px 12px; border: 0; border-radius: 8px; background: transparent; font: inherit; font-size: 0.8rem; font-weight: 500; color: var(--c-text-2); cursor: pointer; }
    .seg button.on { background: var(--c-surface); color: var(--c-text); font-weight: 600; box-shadow: 0 1px 2px rgb(16 24 40 / 0.08); }
    .seg em { font-style: normal; font-size: 0.72rem; opacity: 0.8; }
    .tools input { flex: 1 1 180px; height: 36px; padding: 0 10px; border: 1px solid var(--c-border); border-radius: 10px; background: var(--c-input-fill); font: inherit; font-size: 0.84rem; color: var(--c-text); outline: 0; }
    .bulk { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; margin-bottom: 8px; padding: 8px 12px; border-radius: 12px; background: color-mix(in srgb, var(--c-primary) 8%, var(--c-surface)); }
    .bulk b { font-size: 0.82rem; }
    .bulk lsms-select-field { flex: 1 1 220px; }
    .bulk .clear { border: 0; background: transparent; font: inherit; font-size: 0.8rem; font-weight: 600; color: var(--c-primary); cursor: pointer; }
    .lines { display: flex; flex-direction: column; gap: 8px; margin: 0; padding: 0; list-style: none; }
    .lines li { display: flex; flex-direction: column; gap: 8px; padding: 12px; border-radius: 12px; border: 1px solid var(--c-border); background: var(--c-surface); }
    .lines li.var { border-color: color-mix(in srgb, var(--c-success) 40%, var(--c-border)); }
    .lines li.var.short { border-color: color-mix(in srgb, var(--c-error) 40%, var(--c-border)); }
    .lines li.empty { align-items: center; color: var(--c-text-2); font-size: 0.84rem; }
    .l-head { display: flex; align-items: center; gap: 8px; }
    .l-head input { width: 16px; height: 16px; accent-color: var(--c-primary); }
    .l-head b { flex: 1; font-size: 0.88rem; font-weight: 500; color: var(--c-text); }
    .no { font-size: 0.72rem; color: var(--c-text-2); }
    .state { padding: 2px 8px; border-radius: 100px; font-size: 0.7rem; font-weight: 600; color: var(--c-warning); background: color-mix(in srgb, var(--c-warning) 12%, transparent); }
    .state.ok { color: var(--c-success); background: color-mix(in srgb, var(--c-success) 12%, transparent); }
    .note { display: flex; align-items: flex-start; gap: 6px; margin: 0; padding: 6px 9px; border-radius: 8px; font-size: 0.76rem; }
    .note lsms-icon { flex-shrink: 0; margin-top: 1px; }
    .note b { font-weight: 600; }
    .note.info { color: var(--c-info); background: color-mix(in srgb, var(--c-info) 8%, transparent); }
    .note.warn-t { color: var(--c-warning); background: color-mix(in srgb, var(--c-warning) 9%, transparent); }
    .note.re { color: var(--c-secondary); background: color-mix(in srgb, var(--c-secondary) 8%, transparent); }
    .decide { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; }
    .decide button { display: inline-flex; align-items: center; justify-content: center; gap: 5px; padding: 8px 6px; border-radius: 10px; border: 1px solid var(--c-border); background: var(--c-surface); font: inherit; font-size: 0.78rem; font-weight: 500; color: var(--c-text-2); cursor: pointer; }
    .decide button.on { border-color: var(--dc); color: var(--dc); font-weight: 600; background: color-mix(in srgb, var(--dc) 12%, var(--c-surface)); }
    .reason { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
    .reason lsms-select-field { flex: 1 1 220px; }
    .reason input { flex: 1 1 220px; height: 36px; padding: 0 10px; border: 1px solid var(--c-border); border-radius: 10px; background: var(--c-input-fill); font: inherit; font-size: 0.82rem; color: var(--c-text); outline: 0; }
    .charge { width: 100%; font-size: 0.76rem; font-weight: 600; color: var(--c-error); }
    .sum { position: sticky; bottom: -1px; display: flex; flex-wrap: wrap; gap: 8px 22px; margin-top: 12px; padding: 10px 12px; border-radius: 12px; border: 1px solid var(--c-border); background: var(--c-surface); }
    .sum span { display: flex; flex-direction: column; }
    .sum .c b { color: var(--c-error); }
    .spacer { flex: 1; }
    @media (max-width: 560px) { .decide { grid-template-columns: 1fr; } }
  `,
})
export class SessionDialog {
  protected readonly data = inject<SessionDialogData>(DIALOG_DATA);
  protected readonly ref = inject<DialogRef<boolean>>(DialogRef);
  protected readonly i18n = inject(LanguageService);
  private readonly api = inject(CountingService);
  private readonly auth = inject(AuthService);
  private readonly dialogs = inject(DialogService);
  private readonly toast = inject(ToastService);
  private readonly stock = inject(StoreService);
  private readonly products = inject(ProductsService);

  protected readonly SESSION_STATUS = SESSION_STATUS;
  protected readonly DECISIONS = DECISIONS;
  protected readonly decisionKeys = Object.keys(DECISIONS) as LineDecision[];
  protected readonly needsReason = needsReason;

  protected readonly session = signal<CountSession | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly approving = signal(false);
  protected readonly closing = signal(false);
  protected readonly approvedNow = signal(false);
  protected readonly changed = signal(false);

  protected readonly onlyVariance = signal(false);
  protected readonly query = signal('');
  protected readonly decisions = signal<Record<string, LineDecisionDraft>>({});
  protected readonly selected = signal<ReadonlySet<string>>(new Set());

  protected readonly adjustOptions: SelectOption<string>[] = Object.entries(ADJUSTMENT_REASONS).map(([value, l]) => ({
    value,
    label: this.i18n.isSwahili() ? l.sw : l.en,
  }));
  protected readonly chargeOptions = this.adjustOptions.filter((o) => CHARGE_REASONS.includes(o.value));

  protected readonly title = computed(() => {
    const d = parseLocal(this.session()?.sessionDate);
    const base = this.i18n.t('Stock count', 'Kuhesabu mali');
    return d ? `${base} — ${d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}` : base;
  });

  protected readonly deciding = computed(
    () => this.data.approvable && this.session()?.status === 'PENDING_APPROVAL' && this.auth.hasPermission('COUNTING_APPROVE'),
  );
  protected readonly canForceClose = computed(() => {
    const s = this.session()?.status;
    return this.auth.hasPermission('COUNTING_FORCE_CLOSE') && (s === 'IN_PROGRESS' || s === 'PENDING_RECOUNT' || s === 'PENDING_APPROVAL');
  });

  protected readonly varianceLines = computed(() => (this.session()?.lines ?? []).filter(hasVariance));
  protected readonly lines = computed(() => {
    const q = this.query().trim().toLowerCase();
    let rows = this.onlyVariance() ? this.varianceLines() : (this.session()?.lines ?? []);
    if (q) rows = rows.filter((l) => l.productName.toLowerCase().includes(q));
    return [...rows].sort((a, b) => a.productName.localeCompare(b.productName, undefined, { sensitivity: 'base' }));
  });

  protected readonly decidedCount = computed(() => this.varianceLines().filter((l) => this.complete(l.uid)).length);
  protected readonly allDecided = computed(() => this.decidedCount() === this.varianceLines().length);

  protected readonly totals = computed(() => {
    const t = { adjust: 0, adjustQty: 0, adjustValue: 0, none: 0, charge: 0, chargeValue: 0 };
    for (const l of this.varianceLines()) {
      const d = this.decisions()[l.uid];
      if (d?.decision === 'ADJUST') {
        t.adjust++;
        t.adjustQty += l.varianceQty ?? 0;
        t.adjustValue += l.varianceValue ?? 0;
      } else if (d?.decision === 'NO_ACTION') t.none++;
      else if (d?.decision === 'CHARGE_TO_CASHIER') {
        t.charge++;
        t.chargeValue += Math.abs(l.varianceValue ?? 0);
      }
    }
    return t;
  });

  protected readonly summaryText = computed(() => {
    const t = this.totals();
    return this.i18n.t(
      `Stock adjusted: ${t.adjust}, no action: ${t.none}${t.charge ? `, charged to staff: ${t.charge} (${Money.format(t.chargeValue, { decimals: 0 })})` : ''}.`,
      `Marekebisho ya stock: ${t.adjust}, bila hatua: ${t.none}${t.charge ? `, kutoza mfanyakazi: ${t.charge} (${Money.format(t.chargeValue, { decimals: 0 })})` : ''}.`,
    );
  });

  constructor() {
    void this.load();
    void this.api.staff.load().catch(() => undefined);
  }

  private async load(): Promise<void> {
    try {
      const s = await this.api.session(this.data.uid);
      this.session.set(s);
      // The approver starts on the lines that need a decision.
      this.onlyVariance.set(this.deciding() && this.varianceLines().length > 0);
    } catch (e) {
      this.error.set(ApiError.from(e).message);
    } finally {
      this.loading.set(false);
    }
  }

  protected complete(uid: string): boolean {
    const d = this.decisions()[uid];
    return !!d && (!needsReason(d.decision) || !!d.reason);
  }

  protected decide(uid: string, decision: LineDecision): void {
    this.decisions.update((all) => {
      const prev = all[uid];
      // Keep a reason only if it is still valid for the new decision.
      let reason = needsReason(decision) ? (prev?.reason ?? null) : null;
      if (decision === 'CHARGE_TO_CASHIER' && reason && !CHARGE_REASONS.includes(reason)) reason = null;
      return { ...all, [uid]: { lineUid: uid, decision, reason, notes: decision === 'CHARGE_TO_CASHIER' ? (prev?.notes ?? null) : null } };
    });
  }

  protected setReason(uid: string, reason: string | null): void {
    this.decisions.update((all) => ({ ...all, [uid]: { ...(all[uid] ?? { lineUid: uid, decision: 'ADJUST' }), reason } }));
  }

  protected setNotes(uid: string, notes: string): void {
    this.decisions.update((all) => (all[uid] ? { ...all, [uid]: { ...all[uid], notes } } : all));
  }

  protected toggle(uid: string): void {
    this.selected.update((s) => {
      const n = new Set(s);
      if (n.has(uid)) n.delete(uid);
      else n.add(uid);
      return n;
    });
  }

  protected clearSelection(): void {
    this.selected.set(new Set());
  }

  /** Mark every selected line "Adjust stock" with this reason. */
  protected bulkAdjust(reason: string | null): void {
    if (!reason) return;
    const ids = [...this.selected()];
    this.decisions.update((all) => {
      const next = { ...all };
      for (const uid of ids) next[uid] = { lineUid: uid, decision: 'ADJUST', reason };
      return next;
    });
    this.selected.set(new Set());
  }

  protected async approve(): Promise<void> {
    const s = this.session();
    if (!s || !this.allDecided()) return;
    const t = this.totals();
    const ok = await this.dialogs.confirm({
      title: this.i18n.t('Approve count', 'Thibitisha kuhesabu'),
      message:
        this.summaryText() +
        ' ' +
        (t.charge
          ? this.i18n.t(
              `A debt of ${Money.format(t.chargeValue, { decimals: 0 })} will be recorded against the counter. `,
              `Deni la ${Money.format(t.chargeValue, { decimals: 0 })} litaandikwa kwa mhesabu. `,
            )
          : '') +
        this.i18n.t('After approving, this count cannot be changed. Continue?', 'Baada ya kuthibitisha, zoezi hili haliwezi kubadilishwa tena. Endelea?'),
      confirmText: this.i18n.t('Approve', 'Thibitisha'),
      cancelText: this.i18n.t('Cancel', 'Ghairi'),
    });
    if (!ok) return;
    this.approving.set(true);
    try {
      const approved = await this.api.approve(s.uid, Object.values(this.decisions()).filter((d) => this.varianceLines().some((l) => l.uid === d.lineUid)));
      this.session.set({ ...approved, lines: s.lines });
      this.approvedNow.set(true);
      this.changed.set(true);
      // ADJUST lines moved stock.
      if (t.adjust) {
        this.stock.stock.invalidate();
        this.products.catalogue.invalidate();
      }
    } catch (e) {
      this.toast.error(ApiError.from(e).message || this.i18n.t('Could not approve the count', 'Imeshindwa kuthibitisha zoezi'));
    } finally {
      this.approving.set(false);
    }
  }

  protected async forceClose(): Promise<void> {
    const s = this.session();
    if (!s) return;
    const reason = await this.dialogs.openAsync<string, ReasonDialogData>(ReasonDialog, {
      size: 'sm',
      data: {
        title: this.i18n.t('Force close count', 'Funga zoezi kwa nguvu'),
        message: this.i18n.t(
          'This cannot be undone. The count closes without approval — a new count is allowed the same day.',
          'Hatua hii haiwezi kutenduliwa. Zoezi litafungwa bila kuthibitishwa — kuhesabu upya kutaruhusiwa siku hii hii.',
        ),
        label: this.i18n.t('Reason (required for the audit)', 'Sababu (inahitajika kwa ukaguzi)'),
        confirm: this.i18n.t('Force close', 'Funga kwa nguvu'),
        danger: true,
      },
    });
    if (!reason) return;
    this.closing.set(true);
    try {
      const closed = await this.api.forceClose(s.uid, reason);
      this.session.set({ ...closed, lines: s.lines });
      this.changed.set(true);
      this.toast.success(this.i18n.t('Count force-closed', 'Zoezi limefungwa kwa nguvu'));
    } catch (e) {
      this.toast.error(ApiError.from(e).message || this.i18n.t('Could not force close', 'Imeshindwa kufunga zoezi kwa nguvu'));
    } finally {
      this.closing.set(false);
    }
  }

  protected hasVar(l: CountLine): boolean {
    return hasVariance(l);
  }

  protected fmt(l: CountLine, q: number | null): string {
    return formatQty(q, l.piecesPerPackage, l.packageAbbreviation);
  }

  protected cashierReason(code: string | null): string {
    const r = code ? CASHIER_REASONS[code] : null;
    return r ? (this.i18n.isSwahili() ? r.sw : r.en) : (code ?? '—');
  }

  protected name(uid: string | null): string {
    return this.api.staffName(uid) ?? '—';
  }

  protected abs(v: number | null): number {
    return Math.abs(v ?? 0);
  }

  protected day(v: string | null): Date | null {
    return parseLocal(v);
  }
}
