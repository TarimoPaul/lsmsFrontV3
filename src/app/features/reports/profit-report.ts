import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

import { ApiError } from '@core/api/api.types';
import { LanguageService } from '@core/i18n/language.service';
import { EmptyState, Icon, MetricCard, MetricsGrid, Skeleton } from '@shared/ui';
import { DateRange, dayOnly, endOfDay, parseLocal, rangeForPreset, toIsoDate } from '@shared/utils/date-utils';
import { Cell, downloadCsv, printReport } from '@shared/utils/export';
import { Money } from '@shared/utils/money';
import { ReportFrame } from './report-frame';
import { DAILY_PNL_MAX_DAYS, DailyPnl, PnlDay } from './reports.models';
import { ReportsService } from './reports.service';

/**
 * Daily profit & cash. Net profit says what the shop earned; "collected
 * profit" takes out the profit still sitting inside unpaid debts; "money with
 * debtors" is every shilling customers owe at the period end; operating cash
 * flow adds the stock build-up so the owner sees why profit and cash differ.
 * All figures come from GET /api/reports/daily-pnl.
 */
@Component({
  selector: 'app-profit-report',
  imports: [ReportFrame, MetricCard, MetricsGrid, Skeleton, EmptyState, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-report-frame report="profit" [range]="range()" [note]="asOfNote()" (rangeChange)="setRange($event)" (refresh)="load()" (csv)="csv()" (print)="print()">
      @if (error()) {
        <lsms-empty-state icon="cloud_off" [title]="i18n.t('Could not load profit', 'Faida haikupatikana')" [message]="error()" />
      } @else if (!data()) {
        <lsms-skeleton variant="list" [rows]="6" />
      } @else {
        @let d = data()!;
        @let t = d.totals;

        <div class="hero">
          <section class="big ok">
            <header><lsms-icon name="savings" [size]="20" /><span>{{ i18n.t('Profit collected', 'Faida iliyokusanywa') }}</span></header>
            <b [class.neg]="t.collectedProfit < 0">{{ m(t.collectedProfit) }}</b>
            <p>{{ i18n.t('Net profit', 'Faida halisi') }} {{ m(t.netProfit) }} − {{ i18n.t('profit still inside unpaid debts', 'faida iliyo ndani ya madeni yasiyolipwa') }} {{ m(t.marginInStillOwed) }}</p>
            @if (t.marginInStillOwedEstimated > 0) {
              <span class="est" [title]="estTip()">≈ {{ i18n.t('includes an estimate of', 'ina makadirio ya') }} {{ m(t.marginInStillOwedEstimated) }}</span>
            }
            <small>{{ perDay(t.collectedProfit) }}</small>
          </section>
          <section class="big warn">
            <header><lsms-icon name="request_quote" [size]="20" /><span>{{ i18n.t('Money with debtors', 'Pesa iliyokwama kwa wadeni') }}</span></header>
            <b>{{ m(t.arClosing) }}</b>
            <p>{{ i18n.t('All customer debts on', 'Madeni yote ya wateja tarehe') }} {{ dayLabel(d.to) }} · {{ i18n.t('walk-in', 'walk-in') }} {{ m(t.arClosingWalkIn) }} ({{ pct(t.arClosingWalkIn, t.arClosing) }})</p>
            <div class="split">
              <span>{{ i18n.t('From this period, still unpaid', 'Ya kipindi hiki, bado hayajalipwa') }} <b>{{ m(t.stillOwed) }}</b></span>
              <span>{{ i18n.t('Change in the period', 'Mabadiliko ndani ya kipindi') }} <b [class.neg]="t.arClosing - t.arOpening > 0">{{ signed(t.arClosing - t.arOpening) }}</b></span>
            </div>
            <small>{{ i18n.t('Owed right now', 'Inadaiwa sasa hivi') }} {{ m(t.arNow) }}</small>
          </section>
        </div>

        <lsms-metrics-grid [gap]="12">
          <lsms-metric-card [title]="i18n.t('Net profit', 'Faida halisi')" [value]="m(t.netProfit)" icon="trending_up" [color]="t.netProfit < 0 ? 'var(--c-error)' : 'var(--c-primary)'" [urgent]="t.netProfit < 0" [subtitle]="perDay(t.netProfit) + ' · ' + pct(t.netProfit, t.revenue) + ' ' + i18n.t('of sales', 'ya mauzo')" />
          <lsms-metric-card [title]="i18n.t('Operating cash flow', 'Mtiririko wa pesa (uendeshaji)')" [value]="m(t.operatingCashFlow)" icon="account_balance_wallet" [color]="t.operatingCashFlow < 0 ? 'var(--c-error)' : 'var(--c-success)'" [subtitle]="i18n.t('excludes supplier credit', 'bila madeni ya wasambazaji')" />
          <lsms-metric-card [title]="i18n.t('Gross profit', 'Faida ghafi')" [value]="m(t.grossProfit)" icon="stacked_line_chart" color="var(--c-info)" [subtitle]="t.grossMarginPct.toFixed(1) + '% ' + i18n.t('of sales', 'ya mauzo') + ' ' + m(t.revenue)" />
          <lsms-metric-card [title]="i18n.t('Stock value change', 'Mabadiliko ya thamani ya stoki')" [value]="signed(t.stockChange)" icon="inventory_2" color="var(--c-warning)" [subtitle]="m(t.stockOpening) + ' → ' + m(t.stockClosing)" />
        </lsms-metrics-grid>

        @for (w of d.warnings; track w.code) {
          @if (w.code !== 'WALK_IN_MARGIN_ESTIMATED') {
            <p class="xcheck bad"><lsms-icon name="info" [size]="17" />{{ warning(w.code, w.count, w.amount) }}</p>
          }
        }

        <div class="two">
          <section class="card">
            <header><h4>{{ i18n.t('How net profit is reached', 'Jinsi faida halisi inavyopatikana') }}</h4></header>
            <table class="t">
              <tbody>
                <tr><td>{{ i18n.t('Sales', 'Mauzo') }}</td><td class="n">{{ m(t.revenue) }}</td></tr>
                <tr><td>− {{ i18n.t('Cost of goods sold', 'Gharama ya bidhaa zilizouzwa') }}</td><td class="n">{{ m(t.cogs) }}</td></tr>
                <tr class="sub"><td>= {{ i18n.t('Gross profit', 'Faida ghafi') }} ({{ t.grossMarginPct.toFixed(2) }}%)</td><td class="n">{{ m(t.grossProfit) }}</td></tr>
                <tr><td>− {{ i18n.t('Daily expenses (recon)', 'Gharama za kila siku (recon)') }}</td><td class="n">{{ m(t.dailyExpenses) }}</td></tr>
                <tr><td>− {{ i18n.t('Monthly expenses (rent, salaries…)', 'Gharama za mwezi (pango, mishahara…)') }}</td><td class="n">{{ m(t.monthlyExpenses) }}</td></tr>
                <tr><td>− {{ i18n.t('Depreciation', 'Uchakavu wa mali') }}</td><td class="n">{{ m(t.depreciation) }}</td></tr>
                <tr><td>− {{ i18n.t('Stock loss (posted counts)', 'Upotevu wa stoki (uliopostiwa)') }}</td><td class="n" [class.neg]="t.stockLoss > 0">{{ m(t.stockLoss) }}</td></tr>
                <tr class="sub"><td>= {{ i18n.t('Net profit', 'Faida halisi') }}</td><td class="n" [class.neg]="t.netProfit < 0">{{ m(t.netProfit) }}</td></tr>
                <tr><td>− {{ i18n.t('Profit inside debts still unpaid', 'Faida ndani ya madeni yasiyolipwa') }}@if (t.marginInStillOwedEstimated > 0) { <span class="est sm" [title]="estTip()">≈</span> }</td><td class="n">{{ m(t.marginInStillOwed) }}</td></tr>
                <tr class="sub"><td>= {{ i18n.t('Profit collected', 'Faida iliyokusanywa') }}</td><td class="n" [class.neg]="t.collectedProfit < 0">{{ m(t.collectedProfit) }}</td></tr>
              </tbody>
            </table>
          </section>

          <section class="card">
            <header><h4>{{ i18n.t('Operating cash flow', 'Mtiririko wa pesa (uendeshaji)') }}</h4></header>
            <table class="t">
              <tbody>
                <tr><td>{{ i18n.t('Net profit', 'Faida halisi') }}</td><td class="n">{{ m(t.netProfit) }}</td></tr>
                <tr><td>+ {{ i18n.t('Depreciation (no cash left)', 'Uchakavu (haukutoa pesa)') }}</td><td class="n">{{ m(t.depreciation) }}</td></tr>
                <tr><td>− {{ i18n.t('New debts', 'Madeni mapya') }} <small class="muted">(POS {{ m(t.debtIssuedPos) }} · walk-in {{ m(t.debtIssuedWalkIn) }})</small></td><td class="n">{{ m(t.debtIssuedPos + t.debtIssuedWalkIn) }}</td></tr>
                <tr><td>+ {{ i18n.t('Debts collected', 'Makusanyo ya madeni') }}</td><td class="n">{{ m(t.debtCollected) }}</td></tr>
                <tr><td>− {{ i18n.t('Stock value increase (at purchase cost)', 'Ongezeko la thamani ya stoki (bei ya kununua)') }}</td><td class="n" [class.neg]="t.stockChange > 0">{{ signed(t.stockChange) }}</td></tr>
                <tr class="sub"><td>= {{ i18n.t('Operating cash flow', 'Mtiririko wa pesa') }}</td><td class="n" [class.neg]="t.operatingCashFlow < 0">{{ m(t.operatingCashFlow) }}</td></tr>
                <tr class="quiet"><td>{{ i18n.t('Non-cash debt adjustments (not counted above)', 'Marekebisho ya madeni yasiyo ya pesa (hayajahesabiwa juu)') }}</td><td class="n">{{ m(t.debtAdjusted) }}</td></tr>
                <tr class="quiet"><td>{{ i18n.t('Debts: start → end', 'Madeni: mwanzo → mwisho') }}</td><td class="n">{{ m(t.arOpening) }} → {{ m(t.arClosing) }}</td></tr>
              </tbody>
            </table>
            <p class="pad muted">{{ i18n.t('Supplier credit and owner money are not part of this figure.', 'Madeni ya wasambazaji na pesa za mmiliki hazimo kwenye namba hii.') }}</p>
          </section>
        </div>

        <section class="card flush">
          <header><h4>{{ i18n.t('Day by day', 'Kila siku') }}</h4><small>{{ i18n.t('"Still owed" = what is unpaid now from the debts of that day', '"Bado deni" = ya madeni ya siku hiyo, kilichobaki sasa') }}</small></header>
          <div class="scroll">
            <table class="t days">
              <thead>
                <tr>
                  <th>{{ i18n.t('Day', 'Siku') }}</th>
                  <th class="n">{{ i18n.t('Sales', 'Mauzo') }}</th>
                  <th class="n">{{ i18n.t('Gross profit', 'Faida ghafi') }}</th>
                  <th class="n">{{ i18n.t('Expenses', 'Gharama') }}</th>
                  <th class="n">{{ i18n.t('Stock loss', 'Upotevu') }}</th>
                  <th class="n">{{ i18n.t('Net', 'Faida halisi') }}</th>
                  <th class="n">{{ i18n.t('New debts', 'Madeni mapya') }}</th>
                  <th class="n">{{ i18n.t('Collected', 'Makusanyo') }}</th>
                  <th class="n">{{ i18n.t('Still owed', 'Bado deni') }}</th>
                  <th class="n">{{ i18n.t('Profit collected', 'Faida iliyokusanywa') }}</th>
                </tr>
              </thead>
              <tbody>
                @for (r of rowsDesc(); track r.date) {
                  <tr [class.quiet]="!r.revenue">
                    <td>{{ dayLabel(r.date) }}</td>
                    <td class="n">{{ m(r.revenue) }}</td>
                    <td class="n">{{ m(r.grossProfit) }}</td>
                    <td class="n">{{ m(expenses(r)) }}</td>
                    <td class="n" [class.neg]="r.stockLoss > 0">{{ r.stockLoss ? m(r.stockLoss) : '—' }}</td>
                    <td class="n strong" [class.neg]="r.netProfit < 0">{{ m(r.netProfit) }}</td>
                    <td class="n">{{ issued(r) ? m(issued(r)) : '—' }}</td>
                    <td class="n">{{ r.debtCollected ? m(r.debtCollected) : '—' }}</td>
                    <td class="n" [class.owed]="r.stillOwed > 0">{{ r.stillOwed ? m(r.stillOwed) : '—' }}</td>
                    <td class="n strong" [class.neg]="r.collectedProfit < 0">
                      @if (r.marginInStillOwedEstimated > 0) { <span class="est sm" [title]="estTip()">≈</span> }{{ m(r.collectedProfit) }}
                    </td>
                  </tr>
                }
              </tbody>
              <tfoot>
                <tr>
                  <td>{{ i18n.t('Total', 'Jumla') }}</td>
                  <td class="n">{{ m(t.revenue) }}</td>
                  <td class="n">{{ m(t.grossProfit) }}</td>
                  <td class="n">{{ m(expenses(t)) }}</td>
                  <td class="n">{{ m(t.stockLoss) }}</td>
                  <td class="n" [class.neg]="t.netProfit < 0">{{ m(t.netProfit) }}</td>
                  <td class="n">{{ m(issued(t)) }}</td>
                  <td class="n">{{ m(t.debtCollected) }}</td>
                  <td class="n">{{ m(t.stillOwed) }}</td>
                  <td class="n" [class.neg]="t.collectedProfit < 0">{{ m(t.collectedProfit) }}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </section>

        <section class="card">
          <header><h4>{{ i18n.t('Monthly expenses included', 'Gharama za mwezi zilizojumuishwa') }}</h4><small>{{ i18n.t('Spread evenly over the days of the month', 'Zimegawanywa sawa kwa siku za mwezi') }}</small></header>
          <table class="t">
            <tbody>
              @for (mo of d.months; track mo.month) {
                <tr class="sub"><td>{{ monthLabel(mo.month) }} · {{ i18n.t('gross margin', 'faida ghafi') }} {{ mo.grossMarginPct.toFixed(2) }}%</td><td class="n">{{ m(mo.monthlyExpenses) }} <small class="muted">/ {{ mo.daysInMonth }} {{ i18n.t('days', 'siku') }}</small></td></tr>
                @for (it of itemsOf(mo.month); track $index) {
                  <tr><td>{{ it.description }}@if (it.allYear) { <small class="muted"> · {{ i18n.t('all-year (monthly share)', 'mwaka mzima (sehemu ya mwezi)') }}</small> }</td><td class="n">{{ m(it.amount) }}</td></tr>
                }
                @if (mo.depreciation) {
                  <tr class="quiet"><td>{{ i18n.t('Depreciation of assets', 'Uchakavu wa mali') }}</td><td class="n">{{ m(mo.depreciation) }}</td></tr>
                }
              }
            </tbody>
          </table>
        </section>
      }
    </app-report-frame>
  `,
  styleUrl: './report.scss',
  styles: `
    :host { display: block; }
    .hero { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
    @media (max-width: 760px) { .hero { grid-template-columns: 1fr; } }
    .big { --c: var(--c-success); display: flex; flex-direction: column; gap: 6px; padding: 18px 20px; border-radius: 18px; min-width: 0;
      background: color-mix(in srgb, var(--c) 7%, var(--c-surface)); border: 1px solid color-mix(in srgb, var(--c) 30%, var(--c-border)); }
    .big.warn { --c: var(--c-warning); }
    .big header { display: flex; align-items: center; gap: 8px; font-size: 0.8rem; font-weight: 800; letter-spacing: 0.6px; text-transform: uppercase; color: var(--c-text-2); lsms-icon { color: var(--c); } }
    .big > b { font-size: clamp(1.6rem, 4vw, 2.3rem); font-weight: 800; font-variant-numeric: tabular-nums; color: var(--c-text); line-height: 1.15; }
    .big p { margin: 0; font-size: 0.8rem; color: var(--c-text-2); }
    .big small { font-size: 0.74rem; color: var(--c-text-2); }
    .split { display: flex; flex-wrap: wrap; gap: 6px 18px; font-size: 0.8rem; color: var(--c-text-2); b { color: var(--c-text); font-variant-numeric: tabular-nums; } }
    .est { align-self: flex-start; padding: 2px 9px; border-radius: 100px; font-size: 0.72rem; font-weight: 600; cursor: help;
      color: var(--c-warning); background: color-mix(in srgb, var(--c-warning) 12%, transparent); }
    .est.sm { padding: 0 6px; margin-right: 4px; }
    tr.sub td { font-weight: 700; }
    .two table.t td:first-child, section.card:last-of-type table.t td:first-child { white-space: normal; }
    .two table.t td.n { vertical-align: top; }
    td.owed { color: var(--c-warning); font-weight: 600; }
    table.days td:first-child { position: sticky; left: 0; background: var(--c-surface); }
    table.days th:first-child { position: sticky; left: 0; z-index: 1; }
  `,
})
export class ProfitReport {
  protected readonly i18n = inject(LanguageService);
  private readonly api = inject(ReportsService);

  /** ?from=YYYY-MM-DD&to=YYYY-MM-DD opens a given period (links from other pages); default this month. */
  protected readonly range = signal<DateRange>(this.initialRange());
  protected readonly data = signal<DailyPnl | null>(null);
  protected readonly error = signal('');

  protected readonly rowsDesc = computed(() => [...(this.data()?.days ?? [])].reverse());
  protected readonly asOfNote = computed(() => {
    const d = this.data();
    if (!d?.asOf) return null;
    const at = parseLocal(d.asOf);
    return this.i18n.t('debts as of ', 'madeni hadi ') + (at ? at.toLocaleString(this.i18n.isSwahili() ? 'sw-TZ' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : d.asOf);
  });
  protected readonly estTip = computed(() => {
    const months = this.data()?.months ?? [];
    const gm = months.map((m) => `${this.monthLabel(m.month)} ${m.grossMarginPct.toFixed(1)}%`).join(', ');
    return this.i18n.t(
      `Walk-in debts carry no goods, so the profit inside them is estimated with the month's gross margin (${gm}).`,
      `Madeni ya walk-in hayana bidhaa, kwa hiyo faida iliyomo imekadiriwa kwa faida ghafi ya mwezi (${gm}).`,
    );
  });

  constructor() {
    this.load();
  }

  private initialRange(): DateRange {
    const q = inject(ActivatedRoute).snapshot.queryParamMap;
    const from = parseLocal(q.get('from'));
    const to = parseLocal(q.get('to'));
    return from && to && from <= to ? { start: from, end: endOfDay(to) } : rangeForPreset('thisMonth');
  }

  protected setRange(r: DateRange): void {
    this.range.set(r);
    this.load();
  }

  protected load(): void {
    const r = this.range();
    this.error.set('');
    this.data.set(null);
    const days = Math.round((dayOnly(r.end).getTime() - dayOnly(r.start).getTime()) / 86_400_000) + 1;
    if (days > DAILY_PNL_MAX_DAYS) {
      this.error.set(this.i18n.t(`Pick at most ${DAILY_PNL_MAX_DAYS} days.`, `Chagua siku zisizozidi ${DAILY_PNL_MAX_DAYS}.`));
      return;
    }
    this.api
      .dailyPnl(toIsoDate(r.start), toIsoDate(r.end))
      .then((d) => this.data.set(d))
      .catch((e) => this.error.set(ApiError.from(e).message));
  }

  protected itemsOf(month: string) {
    return (this.data()?.monthlyItems ?? []).filter((i) => i.month === month);
  }

  protected expenses(r: Pick<PnlDay, 'dailyExpenses' | 'monthlyExpenses' | 'depreciation'>): number {
    return r.dailyExpenses + r.monthlyExpenses + r.depreciation;
  }

  protected issued(r: Pick<PnlDay, 'debtIssuedPos' | 'debtIssuedWalkIn'>): number {
    return r.debtIssuedPos + r.debtIssuedWalkIn;
  }

  protected warning(code: string, count: number, amount: number | null): string {
    switch (code) {
      case 'RECON_NOT_APPROVED':
        return this.i18n.t(
          `${count} reconciliation(s) in this period are not approved yet — their expenses (${this.m(amount ?? 0)}) are included as entered.`,
          `Reconciliation ${count} za kipindi hiki bado hazijaidhinishwa — gharama zake (${this.m(amount ?? 0)}) zimejumuishwa kama zilivyoingizwa.`,
        );
      case 'UNPOSTED_COUNT_LINES':
        return this.i18n.t(
          `${count} stock-count line(s) with a difference were never posted — stock loss here covers posted counts only.`,
          `Mistari ${count} ya counting yenye tofauti haikupostiwa — upotevu wa stoki hapa ni ule uliopostiwa tu.`,
        );
      default:
        return code;
    }
  }

  protected m(v: number): string {
    return Money.format(v, { decimals: 0 });
  }

  protected signed(v: number): string {
    return (v > 0 ? '+' : '') + this.m(v);
  }

  protected pct(part: number, whole: number): string {
    return whole ? `${((part / whole) * 100).toFixed(1)}%` : '—';
  }

  protected perDay(v: number): string {
    const n = this.data()?.totals.days || 1;
    return `≈ ${this.m(v / n)} ${this.i18n.t('per day', 'kwa siku')}`;
  }

  protected dayLabel(v: string | null): string {
    const d = parseLocal(v);
    return d ? new Intl.DateTimeFormat(this.i18n.isSwahili() ? 'sw-TZ' : 'en-GB', { weekday: 'short', day: 'numeric', month: 'short' }).format(d) : '—';
  }

  protected monthLabel(ym: string): string {
    const [y, mo] = ym.split('-').map(Number);
    return new Intl.DateTimeFormat(this.i18n.isSwahili() ? 'sw-TZ' : 'en-GB', { month: 'long', year: 'numeric' }).format(new Date(y, mo - 1, 1));
  }

  private table(): { headers: string[]; rows: Cell[][]; numeric: number[] } {
    const t = (en: string, sw: string) => this.i18n.t(en, sw);
    return {
      headers: [
        t('Date', 'Tarehe'), t('Sales', 'Mauzo'), t('COGS', 'Gharama ya bidhaa'), t('Gross profit', 'Faida ghafi'),
        t('Daily expenses', 'Gharama za siku'), t('Monthly expenses', 'Gharama za mwezi'), t('Depreciation', 'Uchakavu'),
        t('Stock loss', 'Upotevu wa stoki'), t('Net profit', 'Faida halisi'), t('New debts POS', 'Madeni mapya POS'),
        t('New debts walk-in', 'Madeni mapya walk-in'), t('Collected', 'Makusanyo'), t('Adjusted (non-cash)', 'Marekebisho'),
        t('Still owed', 'Bado deni'), t('Profit in still owed', 'Faida ndani ya bado deni'), t('of which estimated', 'kati yake makadirio'),
        t('Profit collected', 'Faida iliyokusanywa'),
      ],
      rows: (this.data()?.days ?? []).map((r) => [
        r.date, r.revenue, r.cogs, r.grossProfit, r.dailyExpenses, r.monthlyExpenses, r.depreciation, r.stockLoss, r.netProfit,
        r.debtIssuedPos, r.debtIssuedWalkIn, r.debtCollected, r.debtAdjusted, r.stillOwed, r.marginInStillOwed,
        r.marginInStillOwedEstimated, r.collectedProfit,
      ].map((c) => (typeof c === 'number' ? Math.round(c) : c))),
      numeric: Array.from({ length: 16 }, (_, i) => i + 1),
    };
  }

  protected csv(): void {
    const tb = this.table();
    const r = this.range();
    downloadCsv(`faida_${toIsoDate(r.start)}_${toIsoDate(r.end)}`, tb.headers, tb.rows);
  }

  protected print(): void {
    const d = this.data();
    if (!d) return;
    const t = d.totals;
    const keep = [0, 1, 3, 8, 9, 10, 11, 13, 16];
    const tb = this.table();
    printReport({
      title: this.i18n.t('Daily profit & cash', 'Faida ya kila siku'),
      subtitle: `${d.from} – ${d.to}`,
      headers: keep.map((i) => tb.headers[i]),
      rows: tb.rows.map((row) => keep.map((i) => (typeof row[i] === 'number' ? this.m(row[i] as number) : row[i]))),
      numeric: keep.map((_, i) => i).filter((i) => i > 0),
      summary: [
        [this.i18n.t('Net profit', 'Faida halisi'), this.m(t.netProfit)],
        [this.i18n.t('Profit collected', 'Faida iliyokusanywa'), this.m(t.collectedProfit)],
        [this.i18n.t('Money with debtors', 'Pesa kwa wadeni'), this.m(t.arClosing)],
        [this.i18n.t('Operating cash flow', 'Mtiririko wa pesa'), this.m(t.operatingCashFlow)],
      ],
    });
  }
}
