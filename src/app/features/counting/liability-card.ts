import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input, linkedSignal, output } from '@angular/core';

import { LanguageService } from '@core/i18n/language.service';
import { Button, Icon } from '@shared/ui';
import { parseLocal } from '@shared/utils/date-utils';
import { MoneyPipe } from '@shared/utils/money';
import { CASHIER_REASONS, LIABILITY_STATUS, Liability, LiabilityItem, LiabilityStatus, PAYMENT_TYPES, isPendingItem, isSurplusItem } from './counting.models';

/**
 * One staff liability (a debt raised from a stock count) — the PROOF surface
 * from Flutter `MadeniYanguScreen` / `LiabilityAdminScreen`: every number the
 * debt is built from (system / counted / difference / unit cost), the
 * counter's own explanation, the approver's note, the deduction plan and the
 * payment ledger.
 *
 * `mode = 'mine'`: the owner accepts or disputes each item (owner-only on the
 * server — never offered in the staff view). `mode = 'staff'`: disputes are
 * pinned first; managers get Record payment / Deduction plan.
 */
@Component({
  selector: 'app-liability-card',
  imports: [Button, Icon, DatePipe, MoneyPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class.disputed]': 'disputes().length > 0' },
  template: `
    <button type="button" class="top" (click)="open.set(!open())" [attr.aria-expanded]="open()">
      @if (owner(); as o) {
        <span class="av">{{ initials(o) }}</span>
      }
      <span class="who">
        @if (owner(); as o) { <b>{{ o }}</b> }
        <small>
          {{ i18n.t('Count of', 'Kuhesabu') }} {{ day(liability().sessionDate ?? liability().createdAt) | date: 'dd MMM yyyy' }}
          · {{ i18n.t(liability().items.length + ' item(s)', 'Bidhaa ' + liability().items.length) }}
          @if (disputes().length) { · <em class="red">{{ i18n.t(disputes().length + ' disputed', 'Mizozo ' + disputes().length) }}</em> }
          @if (mode() === 'mine' && pending().length) { · <em class="amber">{{ i18n.t(pending().length + ' awaiting you', pending().length + ' zinakusubiri') }}</em> }
        </small>
      </span>
      <span class="pill" [style.--pc]="status().color">{{ i18n.isSwahili() ? status().sw : status().en }}</span>
      <span class="amt">
        <b>{{ liability().balance | money: { decimals: 0 } }}</b>
        <small>{{ i18n.t('of', 'kati ya') }} {{ liability().amount | money: { decimals: 0 } }}</small>
      </span>
      <lsms-icon [name]="open() ? 'expand_less' : 'expand_more'" [size]="20" />
    </button>

    @if (open()) {
      <div class="body">
        @if (mode() === 'staff' && disputes().length) {
          <section class="disputes">
            <b><lsms-icon name="report" [size]="16" />{{ i18n.t('Disputes', 'Mizozo') }}</b>
            @for (i of disputes(); track i.uid) {
              <p><strong>{{ i.productName }}:</strong> {{ i.disputeReason || '—' }}</p>
            }
          </section>
        }

        @if (liability().monthlyDeduction) {
          <p class="plan">
            <lsms-icon name="event_repeat" [size]="16" />
            <span>
              {{ i18n.t('Deduction', 'Kato') }}: <b>{{ liability().monthlyDeduction | money: { decimals: 0 } }}</b>/{{ i18n.t('month from', 'mwezi kuanzia') }} {{ day(liability().deductionStartMonth) | date: 'MMMM yyyy' }}
              @if (liability().deductionMonthsRemaining !== null) {
                — {{ i18n.t('months left', 'miezi iliyobaki') }}: <b>{{ liability().deductionMonthsRemaining }}</b>
                @if (liability().deductionFinalPartialAmount) { ({{ i18n.t('last one', 'la mwisho') }} {{ liability().deductionFinalPartialAmount | money: { decimals: 0 } }}) }
              }
            </span>
          </p>
        }

        <h4>{{ i18n.t('Charged products', 'Bidhaa zilizotozwa') }}</h4>
        <ul class="items">
          @for (i of liability().items; track i.uid) {
            <li [class.bad]="i.disputed" [class.ok]="!!i.acknowledgedAt">
              <div class="i-top">
                <b>{{ i.productName }}</b>
                <span>{{ i.lineAmount | money: { decimals: 0 } }}</span>
              </div>
              <div class="facts">
                <span>{{ i18n.t('System', 'Mfumo') }}: <b>{{ i.expectedQty ?? '—' }}</b></span>
                <span>{{ i18n.t('Counted', 'Imehesabiwa') }}: <b>{{ i.countedQty ?? '—' }}</b></span>
                <span>{{ i18n.t('Difference', 'Tofauti') }}: <b class="red">{{ i.varianceQty ?? '—' }}</b></span>
                @if (i.unitCostUsed !== null) {
                  <span>{{ i18n.t('Cost/piece', 'Bei/kipande') }}: <b>{{ i.unitCostUsed | money: { decimals: 0 } }}</b></span>
                }
              </div>
              @if (i.cashierReason || i.cashierNote) {
                <small class="said">{{ mode() === 'mine' ? i18n.t('Your explanation', 'Maelezo yako') : i18n.t('Staff explanation', 'Maelezo ya mfanyakazi') }}: {{ reason(i.cashierReason) }}@if (i.cashierNote) { — {{ i.cashierNote }} }</small>
              }
              @if (i.approverNote) {
                <small class="said">{{ i18n.t('Approver’s note', 'Maelezo ya muidhinishaji') }}: {{ i.approverNote }}</small>
              }
              <div class="i-state">
                @if (i.acknowledgedAt) {
                  <span class="st ok"><lsms-icon name="check_circle" [size]="15" />{{ mode() === 'mine' ? i18n.t('You accepted', 'Umekubali') : i18n.t('Accepted', 'Amekubali') }} — {{ day(i.acknowledgedAt) | date: 'dd MMM yyyy HH:mm' }}</span>
                  @if (mode() === 'staff' && i.consentTextUsed) {
                    <small class="consent">“{{ i.consentTextUsed }}”</small>
                  }
                } @else if (i.disputed) {
                  <span class="st bad"><lsms-icon name="report" [size]="15" />{{ mode() === 'mine' ? i18n.t('You disputed', 'Umepinga') : i18n.t('Disputed', 'Amepinga') }}: {{ i.disputeReason }}</span>
                } @else if (mode() === 'mine') {
                  <button lsmsButton="primary" size="sm" icon="check" [loading]="busy() === i.uid" [disabled]="!!busy()" (click)="accept.emit(i)">{{ i18n.t('I accept', 'Nakubali') }}</button>
                  <button lsmsButton="secondary" size="sm" icon="report" class="dispute" [disabled]="!!busy()" (click)="dispute.emit(i)">{{ i18n.t('Dispute', 'Pinga') }}</button>
                } @else {
                  <span class="st wait"><lsms-icon name="hourglass_top" [size]="15" />{{ i18n.t('Waiting for the staff member’s decision', 'Anasubiri uamuzi wa mfanyakazi') }}</span>
                }
              </div>
            </li>
          }
        </ul>

        @if (liability().payments.length) {
          <h4>{{ i18n.t('Payments', 'Historia ya malipo') }}</h4>
          <ul class="pays">
            @for (p of liability().payments; track $index) {
              <li>
                <lsms-icon [name]="payType(p.paymentType).icon" [size]="16" />
                <span>
                  <b>{{ i18n.isSwahili() ? payType(p.paymentType).sw : payType(p.paymentType).en }}</b>
                  <small>{{ day(p.paidAt) | date: 'dd MMM yyyy HH:mm' }}@if (p.notes) { · {{ p.notes }} }</small>
                </span>
                <em>{{ p.amount | money: { decimals: 0 } }}</em>
              </li>
            }
          </ul>
        }

        @if (canManage()) {
          <div class="acts">
            <button lsmsButton="primary" size="sm" icon="payments" [disabled]="liability().balance <= 0 || liability().status === 'WAIVED'" (click)="pay.emit()">{{ i18n.t('Record payment', 'Rekodi malipo') }}</button>
            <button lsmsButton="secondary" size="sm" icon="event_repeat" [disabled]="liability().balance <= 0" (click)="plan.emit()">{{ liability().monthlyDeduction ? i18n.t('Change deduction plan', 'Badili mpango wa makato') : i18n.t('Set deduction plan', 'Weka mpango wa makato') }}</button>
            @if (surplusCharge() === 'all') {
              <button lsmsButton="danger" size="sm" icon="block" (click)="voidSurplus.emit()">{{ i18n.t('Cancel — was a surplus', 'Futa — ilikuwa ziada') }}</button>
            } @else if (surplusCharge() === 'some') {
              <button lsmsButton="danger" size="sm" icon="remove_circle" (click)="voidSurplus.emit()">{{ i18n.t('Remove surplus lines', 'Ondoa ziada') }}</button>
            }
          </div>
        }
      </div>
    }
  `,
  styles: `
    :host { display: block; border-radius: 16px; border: 1px solid var(--c-border); background: var(--c-surface); overflow: hidden; }
    :host(.disputed) { border-color: color-mix(in srgb, var(--c-error) 45%, var(--c-border)); }
    .top { display: flex; align-items: center; gap: 12px; width: 100%; padding: 14px 16px; border: 0; background: transparent; font: inherit; text-align: left; color: var(--c-text); cursor: pointer; }
    .top:hover { background: color-mix(in srgb, var(--c-primary) 4%, transparent); }
    .av { display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; width: 36px; height: 36px; border-radius: 50%; font-size: 0.78rem; font-weight: 700; color: var(--c-primary); background: color-mix(in srgb, var(--c-primary) 12%, transparent); }
    .who { flex: 1; display: flex; flex-direction: column; min-width: 0; }
    .who b { font-size: 0.9rem; font-weight: 500; }
    .who small { font-size: 0.72rem; color: var(--c-text-2); }
    .who em { font-style: normal; font-weight: 600; }
    .red { color: var(--c-error); }
    .amber { color: var(--c-warning); }
    .pill { padding: 2px 10px; border-radius: 100px; font-size: 0.7rem; font-weight: 600; white-space: nowrap; color: var(--pc); background: color-mix(in srgb, var(--pc) 12%, transparent); }
    .amt { display: flex; flex-direction: column; align-items: flex-end; }
    .amt b { font-size: 1rem; font-weight: 700; color: var(--c-primary); font-variant-numeric: tabular-nums; }
    :host(.disputed) .amt b { color: var(--c-error); }
    .amt small { font-size: 0.7rem; color: var(--c-text-2); }
    .body { display: flex; flex-direction: column; gap: 10px; padding: 4px 16px 16px; border-top: 1px solid var(--c-border); }
    h4 { margin: 8px 0 0; font-size: 0.74rem; font-weight: 700; letter-spacing: 0.4px; text-transform: uppercase; color: var(--c-text-2); }
    .disputes { display: flex; flex-direction: column; gap: 4px; margin-top: 10px; padding: 10px 12px; border-radius: 12px; color: var(--c-error); background: color-mix(in srgb, var(--c-error) 7%, transparent); border: 1px solid color-mix(in srgb, var(--c-error) 35%, transparent); }
    .disputes b { display: inline-flex; align-items: center; gap: 6px; font-size: 0.78rem; letter-spacing: 0.4px; text-transform: uppercase; }
    .disputes p { margin: 0; font-size: 0.82rem; color: var(--c-text); }
    .plan { display: flex; align-items: flex-start; gap: 8px; margin: 10px 0 0; padding: 8px 12px; border-radius: 10px; font-size: 0.82rem; color: var(--c-text); background: color-mix(in srgb, var(--c-info) 8%, transparent); }
    .plan lsms-icon { color: var(--c-info); flex-shrink: 0; margin-top: 1px; }
    .items, .pays { display: flex; flex-direction: column; gap: 8px; margin: 0; padding: 0; list-style: none; }
    .items li { display: flex; flex-direction: column; gap: 5px; padding: 10px 12px; border-radius: 12px; background: var(--c-bg); border: 1px solid transparent; }
    .items li.bad { border-color: color-mix(in srgb, var(--c-error) 35%, transparent); background: color-mix(in srgb, var(--c-error) 5%, var(--c-bg)); }
    .i-top { display: flex; justify-content: space-between; gap: 10px; }
    .i-top b { font-size: 0.86rem; font-weight: 500; }
    .i-top span { font-size: 0.86rem; font-weight: 600; font-variant-numeric: tabular-nums; }
    .facts { display: flex; flex-wrap: wrap; gap: 4px 16px; font-size: 0.76rem; color: var(--c-text-2); }
    .facts b { font-weight: 600; color: var(--c-text); }
    .facts b.red { color: var(--c-error); }
    .said { font-size: 0.74rem; color: var(--c-text-2); }
    .i-state { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-top: 2px; }
    .st { display: inline-flex; align-items: center; gap: 5px; font-size: 0.78rem; font-weight: 500; }
    .st.ok { color: var(--c-success); }
    .st.bad { color: var(--c-error); }
    .st.wait { color: var(--c-warning); }
    .consent { width: 100%; font-size: 0.74rem; font-style: italic; color: var(--c-text-2); }
    .dispute { color: var(--c-error); }
    .pays li { display: flex; align-items: center; gap: 10px; padding: 8px 12px; border-radius: 10px; background: color-mix(in srgb, var(--c-success) 6%, transparent); }
    .pays lsms-icon { color: var(--c-success); }
    .pays span { flex: 1; display: flex; flex-direction: column; }
    .pays b { font-size: 0.82rem; font-weight: 600; }
    .pays small { font-size: 0.72rem; color: var(--c-text-2); }
    .pays em { font-style: normal; font-weight: 600; color: var(--c-success); font-variant-numeric: tabular-nums; }
    .acts { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 6px; }
    @media (max-width: 560px) {
      .top { flex-wrap: wrap; }
      .who { flex-basis: calc(100% - 100px); }
      .pill { order: 3; }
    }
  `,
})
export class LiabilityCard {
  protected readonly i18n = inject(LanguageService);

  readonly liability = input.required<Liability>();
  readonly mode = input<'mine' | 'staff'>('mine');
  /** Staff member's name (staff view only). */
  readonly owner = input<string | null>(null);
  readonly canManage = input(false);
  readonly expanded = input(false);
  /** Item uid being saved (disables the buttons). */
  readonly busy = input<string | null>(null);

  readonly accept = output<LiabilityItem>();
  readonly dispute = output<LiabilityItem>();
  readonly pay = output<void>();
  readonly plan = output<void>();
  readonly voidSurplus = output<void>();

  /**
   * Has lines charged for a stock SURPLUS (counted more than expected) — raised in error.
   * 'all' = every line is surplus and nothing paid (whole debt cancelled); 'some' = mixed
   * (only the surplus lines are removed, the shortage stays owed).
   */
  protected readonly surplusCharge = computed<'all' | 'some' | null>(() => {
    const l = this.liability();
    if (l.status === 'WAIVED' || !l.items.some(isSurplusItem)) return null;
    if (l.items.every(isSurplusItem)) return l.balance === l.amount ? 'all' : null;
    return 'some';
  });

  protected readonly open = linkedSignal(() => this.expanded());

  protected readonly status = computed(
    () => LIABILITY_STATUS[this.liability().status as LiabilityStatus] ?? { en: this.liability().status ?? '—', sw: this.liability().status ?? '—', color: 'var(--c-text-2)' },
  );
  protected readonly disputes = computed(() => this.liability().items.filter((i) => i.disputed && !i.acknowledgedAt));
  protected readonly pending = computed(() => this.liability().items.filter(isPendingItem));

  protected reason(code: string | null): string {
    const r = code ? CASHIER_REASONS[code] : null;
    return r ? (this.i18n.isSwahili() ? r.sw : r.en) : (code ?? '');
  }

  protected payType(t: string | null) {
    return PAYMENT_TYPES[t as keyof typeof PAYMENT_TYPES] ?? { en: t ?? '—', sw: t ?? '—', icon: 'payments' };
  }

  protected initials(n: string): string {
    return n.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join('');
  }

  protected day(v: string | null): Date | null {
    return parseLocal(v);
  }
}
