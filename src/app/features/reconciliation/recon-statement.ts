import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';

import { LanguageService } from '@core/i18n/language.service';
import { Icon } from '@shared/ui';
import { MoneyPipe } from '@shared/utils/money';
import { RECON_STATUS, Recon, SHORTAGE_REASONS } from './reconciliation.models';

interface Row {
  icon: string;
  en: string;
  sw: string;
  subEn: string;
  subSw: string;
  amount: number;
  color: string;
}

/**
 * The day's statement — port of Flutter `_ReconStatement`: total sales, every
 * deduction the backend subtracts (mirrors `todayFormulaResult` exactly), and
 * the result (balanced / shortage / excess) with its explanation. Shared by the
 * Summary and Approval tabs so the approver sees the same breakdown.
 */
@Component({
  selector: 'app-recon-statement',
  imports: [Icon, MoneyPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let r = recon();
    @let st = status();
    <header>
      <h3><lsms-icon name="receipt_long" [size]="16" />{{ i18n.t('Sales accounting', 'Hesabu ya mauzo') }}</h3>
      <span class="pill" [style.--st]="st.color"><lsms-icon [name]="st.icon" [size]="13" />{{ i18n.isSwahili() ? st.sw : st.en }}</span>
    </header>

    <div class="income">
      <span class="ic"><lsms-icon name="trending_up" [size]="18" /></span>
      <span class="t"><b>{{ i18n.t('Total sales (POS)', 'Jumla ya mauzo (POS)') }}</b><small>{{ i18n.t('Everything sold on this day', 'Kila kitu kilichouzwa siku hii') }}</small></span>
      <b class="amt">{{ total() | money }}</b>
    </div>

    <p class="sect"><lsms-icon name="remove_circle_outline" [size]="13" />{{ i18n.t('ACCOUNTED FOR BY', 'KIMETOLEWA KWA') }}</p>
    <ul class="rows">
      @for (row of rows(); track row.en) {
        <li>
          <span class="ic" [style.--rc]="row.color"><lsms-icon [name]="row.icon" [size]="15" /></span>
          <span class="t"><b>{{ i18n.isSwahili() ? row.sw : row.en }}</b><small>{{ i18n.isSwahili() ? row.subSw : row.subEn }}</small></span>
          <span class="amt" [style.color]="row.color"><small>(−)</small>{{ row.amount | money }}</span>
        </li>
      }
    </ul>
    <p class="deducted">{{ i18n.t('Total accounted', 'Jumla iliyotolewa') }} <b>{{ deducted() | money }}</b></p>

    <div class="result" [class.ok]="balanced()" [class.short]="shortage()" [class.excess]="!balanced() && !shortage()">
      <span class="ic"><lsms-icon [name]="balanced() ? 'check_circle' : shortage() ? 'arrow_downward' : 'arrow_upward'" [size]="18" /></span>
      <span class="t">
        <b>{{ balanced() ? i18n.t('Balanced', 'Imelingana') : shortage() ? i18n.t('Shortage', 'Upungufu') : i18n.t('Excess', 'Ziada') }}</b>
        <small>
          {{ balanced() ? i18n.t('Everything sold is accounted for.', 'Kila kilichouzwa kimeelezwa.') : shortage() ? i18n.t('Money from sales not yet accounted for.', 'Pesa za mauzo ambazo hazijaelezwa.') : i18n.t('More money declared than was sold.', 'Pesa zilizotajwa ni zaidi ya mauzo.') }}
        </small>
      </span>
      <b class="amt">{{ (balanced() ? 0 : abs(r.result)) | money }}</b>
      @if (!balanced() && (r.varianceExplanation || r.shortageReason)) {
        <div class="why">
          @if (r.shortageReason) {
            <span class="tag">{{ reason(r.shortageReason) }}</span>
          }
          @if (r.varianceExplanation) {
            <i>“{{ r.varianceExplanation }}”</i>
          }
        </div>
      }
    </div>

    @if (r.debtCollectionsTotal > 0.01 || debtDeclared() > 0.01) {
      <div class="debts">
        <p class="sect"><lsms-icon name="payments" [size]="13" />{{ i18n.t('DEBTS COLLECTED (separate)', 'MADENI YALIYOKUSANYWA (tofauti)') }}</p>
        <div class="dline"><span>{{ i18n.t('Collected from earlier sales', 'Yamekusanywa kutoka mauzo ya nyuma') }}</span><b>{{ r.debtCollectionsTotal | money }}</b></div>
        <div class="dline sub"><span>{{ i18n.t('Declared as cash', 'Yametajwa kama taslimu') }}</span><b>{{ r.cashDebtTotal | money }}</b></div>
        <div class="dline sub"><span>{{ i18n.t('Declared at the bank', 'Yametajwa benki') }}</span><b>{{ r.bankDebtTotal | money }}</b></div>
        <div class="dline sub"><span>{{ i18n.t('Declared on mobile', 'Yametajwa kwa simu') }}</span><b>{{ r.mobileDebtTotal | money }}</b></div>
        @let gap = r.debtCollectionsTotal - debtDeclared();
        <div class="dline" [class.bad]="abs(gap) > 0.01"><span>{{ abs(gap) > 0.01 ? i18n.t('Not declared', 'Hayajatajwa') : i18n.t('All declared', 'Yote yametajwa') }}</span><b>{{ abs(gap) | money }}</b></div>
      </div>
    }
  `,
  styles: `
    :host { display: block; padding: 16px; border-radius: 16px; background: var(--c-surface); border: 1px solid var(--c-border); }
    header { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 10px; }
    h3 { display: flex; align-items: center; gap: 6px; margin: 0; font-size: 0.8rem; font-weight: 800; letter-spacing: 0.6px; text-transform: uppercase; }
    h3 lsms-icon { color: var(--c-primary); }
    .pill { display: inline-flex; align-items: center; gap: 4px; padding: 3px 10px; border-radius: 100px; font-size: 0.72rem; font-weight: 700; color: var(--st); background: color-mix(in srgb, var(--st) 12%, transparent); }
    .income, .result, .rows li { display: flex; align-items: center; gap: 12px; }
    .income { padding: 12px 14px; border-radius: 12px; background: color-mix(in srgb, var(--c-success) 8%, transparent); border: 1px solid color-mix(in srgb, var(--c-success) 25%, transparent); }
    .ic { display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; width: 34px; height: 34px; border-radius: 50%; }
    .income .ic { color: var(--c-success); background: color-mix(in srgb, var(--c-success) 15%, transparent); }
    .t { display: flex; flex-direction: column; flex: 1; min-width: 0; }
    .t b { font-size: 0.86rem; }
    .t small { font-size: 0.72rem; color: var(--c-text-2); }
    .amt { font-weight: 800; font-variant-numeric: tabular-nums; white-space: nowrap; }
    .income .amt { color: var(--c-success); font-size: 1.05rem; }
    .sect { display: flex; align-items: center; gap: 5px; margin: 14px 0 6px 2px; font-size: 0.7rem; font-weight: 800; letter-spacing: 0.5px; color: var(--c-text-2); }
    .rows { list-style: none; margin: 0; padding: 0; border-radius: 12px; border: 1px solid var(--c-border); overflow: hidden; }
    .rows li { padding: 10px 14px; border-top: 1px solid var(--c-border); }
    .rows li:first-child { border-top: 0; }
    .rows .ic { width: 30px; height: 30px; color: var(--rc); background: color-mix(in srgb, var(--rc) 11%, transparent); }
    .rows .amt { display: flex; flex-direction: column; align-items: flex-end; font-size: 0.86rem; }
    .rows .amt small { font-size: 0.7rem; font-weight: 600; color: var(--c-text-2); }
    .deducted { margin: 6px 2px 12px; text-align: right; font-size: 0.76rem; color: var(--c-text-2); }
    .result { --rc: var(--c-success); flex-wrap: wrap; padding: 14px 16px; border-radius: 12px; color: var(--rc); background: color-mix(in srgb, var(--rc) 10%, transparent); border: 1.5px solid color-mix(in srgb, var(--rc) 40%, transparent); }
    .result.short { --rc: var(--c-error); }
    .result.excess { --rc: var(--c-warning); }
    .result .ic { background: color-mix(in srgb, var(--rc) 15%, transparent); }
    .result .t small { color: color-mix(in srgb, var(--rc) 80%, var(--c-text)); }
    .result .amt { font-size: 1.35rem; font-weight: 900; }
    .why { flex-basis: 100%; display: flex; flex-wrap: wrap; align-items: center; gap: 8px; padding-top: 10px; border-top: 1px solid color-mix(in srgb, var(--rc) 20%, transparent); font-size: 0.78rem; color: var(--c-text-2); }
    .tag { padding: 2px 8px; border-radius: 6px; font-weight: 700; color: var(--rc); background: color-mix(in srgb, var(--rc) 12%, transparent); }
    .debts { margin-top: 12px; padding: 4px 14px 10px; border-radius: 12px; background: var(--c-bg); border: 1px dashed var(--c-border); }
    .dline { display: flex; justify-content: space-between; padding: 4px 0; font-size: 0.82rem; }
    .dline b { font-variant-numeric: tabular-nums; }
    .dline.sub { padding-left: 12px; color: var(--c-text-2); }
    .dline.bad { color: var(--c-error); font-weight: 700; }
  `,
})
export class ReconStatement {
  protected readonly i18n = inject(LanguageService);

  readonly recon = input.required<Recon>();
  /** Fallback total when the record has none stored yet. */
  readonly liveTotal = input<number | null>(null);

  protected readonly status = computed(() => RECON_STATUS[this.recon().status]);
  protected readonly total = computed(() => (this.recon().autoTotalSales > 0.01 ? this.recon().autoTotalSales : (this.liveTotal() ?? 0)));
  protected readonly balanced = computed(() => Math.abs(this.recon().result) <= 0.01);
  protected readonly shortage = computed(() => this.recon().result > 0.01);
  protected readonly debtDeclared = computed(() => this.recon().cashDebtTotal + this.recon().bankDebtTotal + this.recon().mobileDebtTotal);

  /** Mirrors the backend's todayFormulaResult terms (POS + manual debts always shown). */
  protected readonly rows = computed<Row[]>(() => {
    const r = this.recon();
    const out: Row[] = [];
    const add = (cond: boolean, row: Row) => cond && out.push(row);
    add(r.mobileMoneyTotal > 0.01, { icon: 'phone_iphone', en: 'Mobile money', sw: 'Pesa za simu', subEn: 'Declared mobile receipts', subSw: 'Malipo ya simu yaliyotajwa', amount: r.mobileMoneyTotal, color: 'var(--c-info)' });
    out.push({ icon: 'point_of_sale', en: 'Credit sales (POS)', sw: 'Madeni ya POS', subEn: 'Still unpaid from the till', subSw: 'Bado hayajalipwa (POS)', amount: r.posDebtsTotal, color: 'var(--c-warning)' });
    out.push({ icon: 'group', en: 'Walk-in debts', sw: 'Madeni ya mkono', subEn: 'Entered by hand', subSw: 'Yaliyoandikwa kwa mkono', amount: r.manualDebtsTotal, color: 'var(--c-warning)' });
    add(r.expensesTotal > 0.01, { icon: 'receipt_long', en: 'Expenses', sw: 'Matumizi', subEn: 'Paid from today’s cash', subSw: 'Yamelipwa kwa pesa za leo', amount: r.expensesTotal, color: 'var(--c-warning)' });
    add(r.purchasesTotal > 0.01, { icon: 'shopping_cart', en: 'Purchases', sw: 'Manunuzi', subEn: 'Stock paid in cash', subSw: 'Mzigo uliolipwa kwa taslimu', amount: r.purchasesTotal, color: 'var(--c-warning)' });
    add(r.autoReturnDeductions > 0.01, { icon: 'assignment_return', en: 'Returns', sw: 'Marejesho', subEn: 'Refunded to customers', subSw: 'Yamerejeshwa kwa wateja', amount: r.autoReturnDeductions, color: 'var(--c-error)' });
    add(r.cashOnHandDeclared > 0.01, { icon: 'payments', en: 'Cash in hand', sw: 'Taslimu mkononi', subEn: 'Counted physical cash', subSw: 'Pesa taslimu zilizohesabiwa', amount: r.cashOnHandDeclared, color: 'var(--c-success)' });
    add(r.bankDepositsTotal - r.safeBoxTotal > 0.01, { icon: 'account_balance', en: 'Bank deposits', sw: 'Depositi benki', subEn: 'Banked today', subSw: 'Zimewekwa benki leo', amount: r.bankDepositsTotal - r.safeBoxTotal, color: 'var(--c-info)' });
    add(r.safeBoxTotal > 0.01, { icon: 'lock', en: 'Safe box', sw: 'Sefu', subEn: 'Put in the safe', subSw: 'Zimewekwa sefu', amount: r.safeBoxTotal, color: 'var(--c-info)' });
    add(r.pettyCashTotal > 0.01, { icon: 'wallet', en: 'Petty cash / float', sw: 'Petty cash / float', subEn: 'Kept for small spending', subSw: 'Zimebaki kwa matumizi madogo', amount: r.pettyCashTotal, color: 'var(--c-text-2)' });
    return out;
  });
  protected readonly deducted = computed(() => this.rows().reduce((n, r) => n + r.amount, 0));

  protected abs(v: number): number {
    return Math.abs(v);
  }

  protected reason(r: string): string {
    const x = SHORTAGE_REASONS[r];
    return x ? (this.i18n.isSwahili() ? x.sw : x.en) : r;
  }
}
