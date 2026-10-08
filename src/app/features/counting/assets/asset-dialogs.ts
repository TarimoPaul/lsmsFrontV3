import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';

import { ApiError } from '@core/api/api.types';
import { AuthService } from '@core/auth/auth.service';
import { LanguageService } from '@core/i18n/language.service';
import { Button, DialogService, DialogShell, Icon, MoneyInput, SelectField, SelectOption, Skeleton, ToastService } from '@shared/ui';
import { parseLocal } from '@shared/utils/date-utils';
import { Money, MoneyPipe } from '@shared/utils/money';
import { ReasonDialog, ReasonDialogData } from '../../reconciliation/reason-dialog';
import { CountingService } from '../counting.service';
import {
  ASSET_DECISIONS,
  ASSET_REASONS,
  ASSET_SESSION_STATUS,
  AssetDecision,
  AssetDecisionDraft,
  AssetItem,
  AssetLine,
  AssetSession,
  WEEK_DAYS,
  assetHasVariance,
} from './asset.models';
import { AssetService } from './asset.service';

const FORM = `
  label { display: flex; flex-direction: column; gap: 4px; margin-bottom: 12px; font-size: 0.78rem; font-weight: 600; color: var(--c-text-2); }
  label small { font-weight: 400; }
  input { padding: 9px 10px; border: 1px solid var(--c-border); border-radius: 10px; background: var(--c-input-fill); font: inherit; font-size: 0.88rem; color: var(--c-text); outline: none; }
  input:focus { border-color: var(--c-primary); }
  .two { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .info { display: flex; align-items: flex-start; gap: 8px; margin: 0 0 12px; padding: 10px 12px; border-radius: 12px; font-size: 0.8rem; color: var(--c-text); background: color-mix(in srgb, var(--c-info) 8%, transparent); }
  .info lsms-icon { color: var(--c-info); flex-shrink: 0; }
  .err { margin: 0; font-size: 0.82rem; color: var(--c-error); }
  .lbl { display: block; margin-bottom: 6px; font-size: 0.78rem; font-weight: 600; color: var(--c-text-2); }
  .chips { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 14px; }
  .chips button { padding: 7px 13px; border-radius: 100px; border: 1px solid var(--c-border); background: var(--c-surface); font: inherit; font-size: 0.8rem; color: var(--c-text); cursor: pointer; }
  .chips button.on { border-color: var(--c-primary); color: var(--c-primary); font-weight: 600; background: color-mix(in srgb, var(--c-primary) 10%, var(--c-surface)); }
`;

// ── Add / edit one asset ───────────────────────────────────────────────────

/** New asset (name, quantity …) or edit of name / place / unit value. Closes with the saved row. */
@Component({
  selector: 'app-asset-item-dialog',
  imports: [DialogShell, Button, Icon, MoneyInput],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <lsms-dialog [title]="data ? i18n.t('Edit asset', 'Hariri mali') : i18n.t('Add asset', 'Ongeza mali')" icon="chair">
      @if (!data) {
        <p class="info"><lsms-icon name="info" [size]="16" />{{ i18n.t('The quantity is a proposal until the CEO confirms it.', 'Idadi ni pendekezo mpaka CEO aithibitishe.') }}</p>
      }
      <label><span>{{ i18n.t('Asset name', 'Jina la mali') }}</span><input type="text" maxlength="200" [value]="name()" (input)="name.set($any($event.target).value)" [placeholder]="i18n.t('e.g. Fridge, plastic chairs, crates', 'mf. Friji, viti vya plastiki, kreti')" autofocus /></label>
      <div class="two">
        @if (!data) {
          <label><span>{{ i18n.t('Quantity', 'Idadi') }}</span><input type="text" inputmode="numeric" [value]="qty()" (input)="qty.set(digits($any($event.target)))" /></label>
        }
        <label><span>{{ i18n.t('Where it is kept', 'Mahali ilipo') }} <small>({{ i18n.t('optional', 'hiari') }})</small></span><input type="text" maxlength="120" [value]="location()" (input)="location.set($any($event.target).value)" /></label>
      </div>
      <label><span>{{ i18n.t('Value of one', 'Thamani ya kimoja') }} (TZS) <small>({{ i18n.t('optional — suggests the amount when staff are charged', 'hiari — inapendekeza kiasi mfanyakazi akitozwa') }})</small></span><input lsmsMoneyInput type="text" [value]="unitValue()" (input)="unitValue.set($any($event.target).value)" /></label>
      @if (error()) { <p class="err">{{ error() }}</p> }
      <ng-container dialogActions>
        <button lsmsButton="secondary" (click)="ref.close()">{{ i18n.t('Cancel', 'Ghairi') }}</button>
        <button lsmsButton="primary" [disabled]="!valid()" [loading]="saving()" (click)="save()">{{ i18n.t('Save', 'Hifadhi') }}</button>
      </ng-container>
    </lsms-dialog>
  `,
  styles: FORM,
})
export class AssetItemDialog {
  protected readonly data = inject<AssetItem | null>(DIALOG_DATA);
  protected readonly ref = inject<DialogRef<AssetItem>>(DialogRef);
  protected readonly i18n = inject(LanguageService);
  private readonly api = inject(AssetService);

  protected readonly name = signal(this.data?.name ?? '');
  protected readonly location = signal(this.data?.location ?? '');
  protected readonly qty = signal('');
  protected readonly unitValue = signal(this.data?.unitValue ? Money.group(String(this.data.unitValue)) : '');
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly valid = computed(() => this.name().trim().length >= 2 && (!!this.data || this.qty() !== ''));

  protected digits(el: HTMLInputElement): string {
    const d = el.value.replace(/\D/g, '').slice(0, 6);
    if (d !== el.value) el.value = d;
    return d;
  }

  protected async save(): Promise<void> {
    if (!this.valid()) return;
    this.saving.set(true);
    this.error.set(null);
    const body = { name: this.name().trim(), location: this.location().trim(), unitValue: Money.parse(this.unitValue()) ?? 0 };
    try {
      this.ref.close(this.data?.uid ? await this.api.update(this.data.uid, body) : await this.api.create({ ...body, qty: Number(this.qty()) }));
    } catch (e) {
      this.error.set(ApiError.from(e).message);
    } finally {
      this.saving.set(false);
    }
  }
}

// ── Verification schedule ──────────────────────────────────────────────────

/** Daily / weekly reminder (ASSET_COUNT_APPROVE). Closes with `true` once saved. */
@Component({
  selector: 'app-asset-schedule-dialog',
  imports: [DialogShell, Button, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <lsms-dialog [title]="i18n.t('Asset verification schedule', 'Ratiba ya uhakiki wa mali')" icon="edit_calendar">
      <p class="info"><lsms-icon name="info" [size]="16" />{{ i18n.t('A reminder only: when verification is due the counter is told, but sales are never blocked.', 'Ni ukumbusho tu: uhakiki ukifika mhakiki anaonyeshwa, lakini mauzo hayazuiwi.') }}</p>
      <span class="lbl">{{ i18n.t('How often', 'Mara ngapi') }}</span>
      <div class="chips">
        <button type="button" [class.on]="frequency() === 'DAILY'" (click)="frequency.set('DAILY')">{{ i18n.t('Every day', 'Kila siku') }}</button>
        <button type="button" [class.on]="frequency() === 'WEEKLY'" (click)="frequency.set('WEEKLY')">{{ i18n.t('Every week', 'Kila wiki') }}</button>
        <button type="button" [class.on]="frequency() === 'OFF'" (click)="frequency.set('OFF')">{{ i18n.t('No schedule', 'Hakuna ratiba') }}</button>
      </div>
      @if (frequency() === 'WEEKLY') {
        <span class="lbl">{{ i18n.t('On which day', 'Siku gani') }}</span>
        <div class="chips">
          @for (d of days; track $index) {
            <button type="button" [class.on]="day() === $index + 1" (click)="day.set($index + 1)">{{ i18n.isSwahili() ? d.sw : d.en }}</button>
          }
        </div>
      }
      @if (error()) { <p class="err">{{ error() }}</p> }
      <ng-container dialogActions>
        <button lsmsButton="secondary" (click)="ref.close()">{{ i18n.t('Cancel', 'Ghairi') }}</button>
        <button lsmsButton="primary" [loading]="saving()" (click)="save()">{{ i18n.t('Save', 'Hifadhi') }}</button>
      </ng-container>
    </lsms-dialog>
  `,
  styles: FORM,
})
export class AssetScheduleDialog {
  protected readonly ref = inject<DialogRef<boolean>>(DialogRef);
  protected readonly i18n = inject(LanguageService);
  private readonly api = inject(AssetService);

  protected readonly days = WEEK_DAYS;
  protected readonly frequency = signal<'DAILY' | 'WEEKLY' | 'OFF'>(this.api.status()?.frequency ?? 'WEEKLY');
  protected readonly day = signal(this.api.status()?.dayOfWeek ?? 1);
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);

  protected async save(): Promise<void> {
    this.saving.set(true);
    this.error.set(null);
    try {
      await this.api.saveSchedule(this.frequency(), this.frequency() === 'WEEKLY' ? this.day() : null);
      this.ref.close(true);
    } catch (e) {
      this.error.set(ApiError.from(e).message);
    } finally {
      this.saving.set(false);
    }
  }
}

// ── One verification in detail + the CEO's decisions ───────────────────────

export interface AssetSessionDialogData {
  uid: string;
}

type Draft = { decision: AssetDecision; note: string; amount: string; userUid: string | null };

/**
 * Read-only for everyone; for the CEO (ASSET_COUNT_APPROVE) on a count that is
 * awaiting a decision, every differing asset gets: Accept new quantity / No
 * action / Charge staff (amount + who). Closes with `true` when it changed.
 */
@Component({
  selector: 'app-asset-session-dialog',
  imports: [DialogShell, Button, Icon, Skeleton, SelectField, MoneyInput, DatePipe, MoneyPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <lsms-dialog [title]="title()" icon="fact_check">
      @if (loading()) {
        <lsms-skeleton variant="list" [rows]="5" />
      } @else if (error() && !session()) {
        <p class="bad"><lsms-icon name="error" [size]="18" />{{ error() }}</p>
      } @else if (session(); as s) {
        @let st = STATUS[s.status];
        <section class="head">
          <span class="pill" [style.--pc]="st.color"><lsms-icon [name]="st.icon" [size]="14" />{{ i18n.isSwahili() ? st.sw : st.en }}</span>
          <div class="facts">
            <span><small>{{ i18n.t('Counted', 'Zimehesabiwa') }}</small><b>{{ s.itemsCounted }}/{{ s.totalItems }}</b></span>
            @if (s.itemsWithVariance !== null) { <span><small>{{ i18n.t('With difference', 'Zenye tofauti') }}</small><b>{{ s.itemsWithVariance }}</b></span> }
            <span><small>{{ i18n.t('Verified by', 'Aliyehakiki') }}</small><b>{{ name(s.startedByUid) }}</b></span>
            @if (s.approvedByUid) { <span><small>{{ i18n.t('Decided by', 'Aliyeamua') }}</small><b>{{ name(s.approvedByUid) }} · {{ day(s.approvedAt) | date: 'dd MMM HH:mm' }}</b></span> }
          </div>
          @if (s.status === 'CANCELLED' && s.cancelledReason) { <p class="bad"><lsms-icon name="block" [size]="16" />{{ s.cancelledReason }}</p> }
          @if (s.status === 'IN_PROGRESS') { <p class="warn"><lsms-icon name="visibility_off" [size]="16" />{{ i18n.t('Still being counted — quantities appear once it is completed.', 'Bado inahesabiwa — idadi zitaonekana ikikamilika.') }}</p> }
        </section>

        @if (s.status !== 'IN_PROGRESS') {
          <div class="seg" role="tablist">
            <button type="button" role="tab" [class.on]="onlyDiff()" (click)="onlyDiff.set(true)">{{ i18n.t('With difference', 'Zenye tofauti') }} <em>{{ differing().length }}</em></button>
            <button type="button" role="tab" [class.on]="!onlyDiff()" (click)="onlyDiff.set(false)">{{ i18n.t('All', 'Zote') }} <em>{{ s.lines.length }}</em></button>
          </div>
          <ul class="lines">
            @for (l of lines(); track l.uid) {
              @let v = differs(l);
              @let d = drafts()[l.uid];
              <li [class.var]="v" [class.short]="(l.varianceQty ?? 0) < 0">
                <div class="l-head">
                  <b>{{ l.assetName }}</b>
                  @if (l.location) { <small>{{ l.location }}</small> }
                  @if (deciding() && v) { <span class="state" [class.ok]="complete(l)">{{ complete(l) ? i18n.t('Decided', 'Imeamuliwa') : i18n.t('Needs decision', 'Inahitaji uamuzi') }}</span> }
                </div>
                <div class="nums">
                  <span><small>{{ i18n.t('Confirmed', 'Iliyothibitishwa') }}</small><b>{{ l.expectedQty }}</b></span>
                  <span><small>{{ i18n.t('Counted', 'Iliyohesabiwa') }}</small><b>{{ l.countedQty }}</b></span>
                  <span><small>{{ i18n.t('Difference', 'Tofauti') }}</small><b [class.neg]="(l.varianceQty ?? 0) < 0" [class.pos]="(l.varianceQty ?? 0) > 0">{{ (l.varianceQty ?? 0) > 0 ? '+' : '' }}{{ l.varianceQty }}</b></span>
                </div>
                @if (v) {
                  @if (l.explainedAt) {
                    <p class="note info"><lsms-icon name="record_voice_over" [size]="14" /><span><b>{{ i18n.t('Counter says', 'Maelezo ya mhakiki') }}: {{ reason(l.reason) }}</b>@if (l.note) { — {{ l.note }} }</span></p>
                  } @else {
                    <p class="note warn-t"><lsms-icon name="help" [size]="14" />{{ i18n.t('Not explained by the counter', 'Haijaelezwa na mhakiki') }}</p>
                  }
                  @if (l.decision) {
                    @let dd = DECISIONS[l.decision];
                    <p class="note" [style.color]="dd.color"><lsms-icon [name]="dd.icon" [size]="14" /><span><b>{{ i18n.isSwahili() ? dd.sw : dd.en }}</b>@if (l.chargeAmount) { · {{ name(l.chargeUserUid) }} · {{ l.chargeAmount | money: { decimals: 0 } }} }@if (l.decisionNote) { — {{ l.decisionNote }} }</span></p>
                  }
                }
                @if (deciding() && v) {
                  <div class="decide" role="radiogroup" [attr.aria-label]="i18n.t('Decision', 'Uamuzi')">
                    @for (k of decisionKeys; track k) {
                      @if (k !== 'CHARGE_STAFF' || (l.varianceQty ?? 0) < 0) {
                        <button type="button" role="radio" [attr.aria-checked]="d?.decision === k" [class.on]="d?.decision === k" [style.--dc]="DECISIONS[k].color" (click)="decide(l, k)">
                          <lsms-icon [name]="DECISIONS[k].icon" [size]="16" />{{ i18n.isSwahili() ? DECISIONS[k].sw : DECISIONS[k].en }}
                        </button>
                      }
                    }
                  </div>
                  @if (d) {
                    <div class="extra">
                      @if (d.decision === 'CHARGE_STAFF') {
                        <input lsmsMoneyInput type="text" class="amt" [value]="d.amount" (input)="patch(l, { amount: $any($event.target).value })" [placeholder]="i18n.t('Amount to charge (TZS)', 'Kiasi cha kutoza (TZS)')" [attr.aria-label]="i18n.t('Amount to charge', 'Kiasi cha kutoza')" />
                        @if (staffOptions().length) {
                          <lsms-select-field [dense]="true" [options]="staffOptions()" [value]="d.userUid" (valueChange)="patch(l, { userUid: $event })" [ariaLabel]="i18n.t('Staff member to charge', 'Mfanyakazi wa kutozwa')" />
                        } @else {
                          <small class="who">{{ i18n.t('Charged to', 'Atatozwa') }}: {{ name(s.startedByUid) }}</small>
                        }
                      }
                      <input type="text" maxlength="300" [value]="d.note" (input)="patch(l, { note: $any($event.target).value })" [placeholder]="i18n.t('Note (optional)', 'Maelezo (hiari)')" [attr.aria-label]="i18n.t('Note', 'Maelezo')" />
                      @if (d.decision === 'ACCEPT') { <small class="hint">{{ i18n.t('The confirmed quantity becomes', 'Idadi rasmi itakuwa') }} {{ l.countedQty }}.</small> }
                      @if (d.decision === 'NO_ACTION') { <small class="hint">{{ i18n.t('The confirmed quantity stays', 'Idadi rasmi inabaki') }} {{ l.expectedQty }}.</small> }
                      @if (d.decision === 'CHARGE_STAFF') { <small class="hint c">{{ i18n.t('A staff debt is recorded and the confirmed quantity becomes', 'Deni la mfanyakazi linaandikwa na idadi rasmi inakuwa') }} {{ l.countedQty }}.</small> }
                    </div>
                  }
                }
              </li>
            } @empty {
              <li class="empty">{{ i18n.t('Every asset matched.', 'Mali zote zimelingana.') }}</li>
            }
          </ul>
        }
      }

      <ng-container dialogActions>
        @if (canCancel()) {
          <button lsmsButton="danger" icon="block" [loading]="cancelling()" (click)="cancel()">{{ i18n.t('Cancel this verification', 'Futa uhakiki huu') }}</button>
        }
        <span class="spacer"></span>
        <button lsmsButton="secondary" (click)="ref.close(changed())">{{ i18n.t('Close', 'Funga') }}</button>
        @if (deciding()) {
          <button lsmsButton="success" icon="check" [disabled]="!allDecided()" [loading]="approving()" (click)="approve()">
            {{ allDecided() ? i18n.t('Confirm decisions', 'Thibitisha uamuzi') : i18n.t('Decide every difference first', 'Amua kila tofauti kwanza') }}
          </button>
        }
      </ng-container>
    </lsms-dialog>
  `,
  styles: `
    .bad, .warn { display: flex; align-items: center; gap: 6px; margin: 0; padding: 8px 10px; border-radius: 10px; font-size: 0.8rem; }
    .bad { color: var(--c-error); background: color-mix(in srgb, var(--c-error) 8%, transparent); }
    .warn { color: var(--c-warning); background: color-mix(in srgb, var(--c-warning) 9%, transparent); }
    .head { display: flex; flex-direction: column; align-items: flex-start; gap: 10px; padding-bottom: 12px; border-bottom: 1px solid var(--c-border); }
    .pill { display: inline-flex; align-items: center; gap: 4px; padding: 3px 10px; border-radius: 100px; font-size: 0.74rem; font-weight: 600; color: var(--pc); background: color-mix(in srgb, var(--pc) 12%, transparent); }
    .facts { display: flex; flex-wrap: wrap; gap: 8px 24px; }
    .facts span, .nums span { display: flex; flex-direction: column; }
    .facts small, .nums small { font-size: 0.7rem; color: var(--c-text-2); }
    .facts b { font-size: 0.86rem; font-weight: 600; color: var(--c-text); }
    .seg { display: inline-flex; margin: 12px 0 8px; padding: 3px; border-radius: 10px; background: color-mix(in srgb, var(--c-text-2) 10%, transparent); }
    .seg button { padding: 6px 12px; border: 0; border-radius: 8px; background: transparent; font: inherit; font-size: 0.8rem; font-weight: 500; color: var(--c-text-2); cursor: pointer; }
    .seg button.on { background: var(--c-surface); color: var(--c-text); font-weight: 600; box-shadow: 0 1px 2px rgb(16 24 40 / 0.08); }
    .seg em { font-style: normal; font-size: 0.72rem; opacity: 0.8; }
    .lines { display: flex; flex-direction: column; gap: 8px; margin: 0; padding: 0; list-style: none; }
    .lines li { display: flex; flex-direction: column; gap: 8px; padding: 12px; border-radius: 12px; border: 1px solid var(--c-border); background: var(--c-surface); }
    .lines li.var { border-color: color-mix(in srgb, var(--c-success) 40%, var(--c-border)); }
    .lines li.var.short { border-color: color-mix(in srgb, var(--c-error) 40%, var(--c-border)); }
    .lines li.empty { align-items: center; color: var(--c-text-2); font-size: 0.84rem; }
    .l-head { display: flex; align-items: baseline; flex-wrap: wrap; gap: 8px; }
    .l-head b { font-size: 0.9rem; font-weight: 600; color: var(--c-text); }
    .l-head small { flex: 1; font-size: 0.74rem; color: var(--c-text-2); }
    .state { margin-left: auto; padding: 2px 8px; border-radius: 100px; font-size: 0.7rem; font-weight: 600; color: var(--c-warning); background: color-mix(in srgb, var(--c-warning) 12%, transparent); }
    .state.ok { color: var(--c-success); background: color-mix(in srgb, var(--c-success) 12%, transparent); }
    .nums { display: flex; gap: 24px; }
    .nums b { font-size: 1rem; font-weight: 700; color: var(--c-text); font-variant-numeric: tabular-nums; }
    .neg { color: var(--c-error) !important; }
    .pos { color: var(--c-success) !important; }
    .note { display: flex; align-items: flex-start; gap: 6px; margin: 0; padding: 6px 9px; border-radius: 8px; font-size: 0.76rem; background: color-mix(in srgb, currentColor 8%, transparent); }
    .note lsms-icon { flex-shrink: 0; margin-top: 1px; }
    .note.info { color: var(--c-info); }
    .note.warn-t { color: var(--c-warning); }
    .decide { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 6px; }
    .decide button { display: inline-flex; align-items: center; justify-content: center; gap: 5px; padding: 8px 6px; border-radius: 10px; border: 1px solid var(--c-border); background: var(--c-surface); font: inherit; font-size: 0.78rem; font-weight: 500; color: var(--c-text-2); cursor: pointer; }
    .decide button.on { border-color: var(--dc); color: var(--dc); font-weight: 600; background: color-mix(in srgb, var(--dc) 12%, var(--c-surface)); }
    .extra { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
    .extra input { flex: 1 1 200px; height: 36px; padding: 0 10px; border: 1px solid var(--c-border); border-radius: 10px; background: var(--c-input-fill); font: inherit; font-size: 0.82rem; color: var(--c-text); outline: 0; }
    .extra input.amt { flex: 0 1 170px; font-weight: 600; }
    .extra lsms-select-field { flex: 1 1 200px; }
    .hint, .who { width: 100%; font-size: 0.74rem; color: var(--c-text-2); }
    .hint.c { color: var(--c-error); font-weight: 600; }
    .who { width: auto; }
    .spacer { flex: 1; }
  `,
})
export class AssetSessionDialog {
  protected readonly data = inject<AssetSessionDialogData>(DIALOG_DATA);
  protected readonly ref = inject<DialogRef<boolean>>(DialogRef);
  protected readonly i18n = inject(LanguageService);
  private readonly api = inject(AssetService);
  private readonly counting = inject(CountingService);
  private readonly auth = inject(AuthService);
  private readonly dialogs = inject(DialogService);
  private readonly toast = inject(ToastService);

  protected readonly STATUS = ASSET_SESSION_STATUS;
  protected readonly DECISIONS = ASSET_DECISIONS;
  protected readonly decisionKeys: AssetDecision[] = ['ACCEPT', 'NO_ACTION', 'CHARGE_STAFF'];
  protected readonly differs = assetHasVariance;

  protected readonly session = signal<AssetSession | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly onlyDiff = signal(true);
  protected readonly drafts = signal<Record<string, Draft>>({});
  protected readonly approving = signal(false);
  protected readonly cancelling = signal(false);
  protected readonly changed = signal(false);

  private readonly canApprove = computed(() => this.auth.hasPermission('ASSET_COUNT_APPROVE'));
  protected readonly deciding = computed(() => this.canApprove() && this.session()?.status === 'PENDING_APPROVAL');
  protected readonly canCancel = computed(() => {
    const s = this.session()?.status;
    return this.canApprove() && (s === 'IN_PROGRESS' || s === 'PENDING_APPROVAL');
  });

  protected readonly differing = computed(() => (this.session()?.lines ?? []).filter(assetHasVariance));
  protected readonly lines = computed(() => (this.onlyDiff() ? this.differing() : (this.session()?.lines ?? [])));
  protected readonly allDecided = computed(() => this.differing().every((l) => this.complete(l)));

  protected readonly title = computed(() => {
    const d = parseLocal(this.session()?.sessionDate ?? null);
    const base = this.i18n.t('Asset verification', 'Uhakiki wa mali');
    return d ? `${base} · ${d.toLocaleDateString(this.i18n.isSwahili() ? 'sw-TZ' : 'en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}` : base;
  });

  /** Staff the CEO may charge (needs USER_READ; otherwise the counter is charged). */
  protected readonly staffOptions = computed<SelectOption<string>[]>(() =>
    [...(this.counting.staff.value() ?? new Map<string, string>()).entries()].map(([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label)),
  );

  constructor() {
    void this.load();
    void this.counting.staff.load().catch(() => undefined);
  }

  private async load(): Promise<void> {
    try {
      const s = await this.api.session(this.data.uid);
      this.session.set(s);
      if (!this.differing().length) this.onlyDiff.set(false);
    } catch (e) {
      this.error.set(ApiError.from(e).message);
    } finally {
      this.loading.set(false);
    }
  }

  protected decide(l: AssetLine, decision: AssetDecision): void {
    const missing = Math.abs(l.varianceQty ?? 0);
    const prev = this.drafts()[l.uid];
    this.drafts.update((d) => ({
      ...d,
      [l.uid]: {
        decision,
        note: prev?.note ?? '',
        // Suggested charge = missing units × the asset's unit value (editable).
        amount: prev?.amount || (l.unitValue ? Money.group(String(Math.round(l.unitValue * missing))) : ''),
        userUid: prev?.userUid ?? this.session()?.startedByUid ?? null,
      },
    }));
  }

  protected patch(l: AssetLine, part: Partial<Draft>): void {
    this.drafts.update((d) => (d[l.uid] ? { ...d, [l.uid]: { ...d[l.uid], ...part } } : d));
  }

  protected complete(l: AssetLine): boolean {
    const d = this.drafts()[l.uid];
    return !!d && (d.decision !== 'CHARGE_STAFF' || (Money.parse(d.amount) ?? 0) > 0);
  }

  protected async approve(): Promise<void> {
    const s = this.session();
    if (!s || !this.allDecided()) return;
    const drafts = this.drafts();
    const decisions: AssetDecisionDraft[] = this.differing().map((l) => ({
      lineUid: l.uid,
      decision: drafts[l.uid].decision,
      note: drafts[l.uid].note,
      chargeAmount: Money.parse(drafts[l.uid].amount),
      chargeUserUid: drafts[l.uid].userUid,
    }));
    const charged = decisions.filter((d) => d.decision === 'CHARGE_STAFF');
    const total = charged.reduce((sum, d) => sum + (d.chargeAmount ?? 0), 0);
    const ok = await this.dialogs.confirm({
      title: this.i18n.t('Confirm decisions', 'Thibitisha uamuzi'),
      message:
        this.i18n.t(`${decisions.length} difference(s) decided. This cannot be undone.`, `Tofauti ${decisions.length} zimeamuliwa. Hatua hii haiwezi kurudishwa.`) +
        (charged.length ? '\n' + this.i18n.t(`Staff debt to record: ${Money.format(total)}`, `Deni la mfanyakazi litakaloandikwa: ${Money.format(total)}`) : ''),
      confirmText: this.i18n.t('Confirm', 'Thibitisha'),
      cancelText: this.i18n.t('Back', 'Rudi'),
    });
    if (!ok) return;
    this.approving.set(true);
    try {
      this.session.set(await this.api.approve(s.uid, decisions));
      this.changed.set(true);
      this.toast.success(this.i18n.t('Asset verification decided', 'Uhakiki wa mali umeamuliwa'));
    } catch (e) {
      await this.dialogs.error(ApiError.from(e).message);
    } finally {
      this.approving.set(false);
    }
  }

  protected async cancel(): Promise<void> {
    const s = this.session();
    if (!s) return;
    const reason = await this.dialogs.openAsync<string, ReasonDialogData>(ReasonDialog, {
      size: 'sm',
      data: {
        title: this.i18n.t('Cancel this verification', 'Futa uhakiki huu'),
        message: this.i18n.t('The counts entered are discarded and a new verification can be started.', 'Idadi zilizoingizwa zinaachwa na uhakiki mpya unaweza kuanzwa.'),
        label: this.i18n.t('Reason', 'Sababu'),
        confirm: this.i18n.t('Cancel verification', 'Futa uhakiki'),
        danger: true,
      },
    });
    if (!reason) return;
    this.cancelling.set(true);
    try {
      await this.api.cancel(s.uid, reason);
      this.ref.close(true);
    } catch (e) {
      this.toast.error(ApiError.from(e).message);
    } finally {
      this.cancelling.set(false);
    }
  }

  protected reason(code: string | null): string {
    const r = code ? ASSET_REASONS[code] : null;
    return r ? (this.i18n.isSwahili() ? r.sw : r.en) : (code ?? '—');
  }

  protected name(uid: string | null): string {
    return this.counting.staffName(uid) ?? '—';
  }

  protected day(v: string | null): Date | null {
    return parseLocal(v);
  }
}
