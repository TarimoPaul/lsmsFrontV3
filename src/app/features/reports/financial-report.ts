import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { ApiError } from '@core/api/api.types';
import { LanguageService } from '@core/i18n/language.service';
import { EmptyState, Icon, MetricCard, MetricsGrid, SegmentOption, SegmentedFilterBar, Skeleton } from '@shared/ui';
import { downloadCsv, printReport } from '@shared/utils/export';
import { Money } from '@shared/utils/money';
import { ControlCheck, FinancialPosition, IncomeStatement } from '../general-ledger/gl.models';
import { GlService } from '../general-ledger/gl.service';
import { ReportFrame } from './report-frame';
import { MonthPnl, ReportsService } from './reports.service';

type Span = 6 | 12 | 24;

/**
 * Financial statements straight from the General Ledger: profit & loss month
 * by month (the same income statement the GL module shows), today's financial
 * position, expenses by account, and the GL-vs-register checks. Replaces
 * Flutter's P&L, which read the v_profit_loss_statement SQL view — that view
 * drifts from the books (e.g. Sep 2026 opex 274,889 vs 200,000 posted).
 */
@Component({
  selector: 'app-financial-report',
  imports: [ReportFrame, SegmentedFilterBar, MetricCard, MetricsGrid, Skeleton, EmptyState, Icon, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-report-frame report="financial" [hasFilters]="true" [note]="periodLabel()" (refresh)="load()" (csv)="csv()" (print)="print()">
      <lsms-segmented-filter-bar filters [options]="spans()" [selected]="span()" (selectedChange)="setSpan($event)" />

      @if (error()) {
        <lsms-empty-state icon="cloud_off" [title]="i18n.t('Could not load the books', 'Vitabu havikupatikana')" [message]="error()" />
      } @else if (!months()) {
        <lsms-skeleton variant="list" [rows]="6" />
      } @else {
        @let t = totals();
        <lsms-metrics-grid [gap]="12">
          <lsms-metric-card [title]="i18n.t('Net sales', 'Mauzo halisi')" [value]="m(t.revenue)" icon="trending_up" color="var(--c-success)" [subtitle]="i18n.t('after discounts', 'baada ya punguzo')" />
          <lsms-metric-card [title]="i18n.t('Gross profit', 'Faida ghafi')" [value]="m(t.gross)" icon="stacked_line_chart" color="var(--c-info)" [subtitle]="pct(t.gross, t.revenue) + ' ' + i18n.t('margin', 'ya mauzo')" />
          <lsms-metric-card [title]="i18n.t('Running costs', 'Gharama za uendeshaji')" [value]="m(t.opex)" icon="receipt_long" color="var(--c-warning)" />
          <lsms-metric-card [title]="i18n.t('Net profit', 'Faida halisi')" [value]="m(t.net)" icon="savings" [color]="t.net < 0 ? 'var(--c-error)' : 'var(--c-primary)'" [urgent]="t.net < 0" [subtitle]="pct(t.net, t.revenue) + ' ' + i18n.t('of sales', 'ya mauzo')" />
        </lsms-metrics-grid>

        @if (future(); as f) {
          @if (f.operatingExpensesTotal || f.netRevenue) {
            <p class="warn"><lsms-icon name="event_upcoming" [size]="17" />
              {{ i18n.t('Postings dated in the future are left out:', 'Maingizo yenye tarehe za baadaye hayajajumuishwa:') }}
              @if (f.operatingExpensesTotal) { {{ i18n.t('expenses', 'gharama') }} <b>{{ m(f.operatingExpensesTotal) }}</b> }
              @if (f.netRevenue) { · {{ i18n.t('sales', 'mauzo') }} <b>{{ m(f.netRevenue) }}</b> }
            </p>
          }
        }

        <section class="card">
          <header><h4>{{ i18n.t('Net profit by month', 'Faida halisi kwa mwezi') }}</h4><small>{{ i18n.t('Hover a bar for the month', 'Elekeza kwenye nguzo kuona mwezi') }}</small></header>
          <div class="chart" role="img" [attr.aria-label]="i18n.t('Net profit by month', 'Faida halisi kwa mwezi')">
            <div class="plot">
              <span class="zero" [style.bottom.%]="zeroAt()"></span>
              @for (b of bars(); track b.month) {
                <div class="col" tabindex="0" [attr.aria-label]="b.label + ': ' + m(b.net)">
                  <span class="bar" [class.neg]="b.net < 0" [style.bottom.%]="b.net >= 0 ? zeroAt() : zeroAt() - b.h" [style.height.%]="b.h"></span>
                  <span class="tip"><b>{{ b.label }}</b>{{ i18n.t('Sales', 'Mauzo') }} {{ m(b.revenue) }}<br />{{ i18n.t('Net profit', 'Faida halisi') }} {{ m(b.net) }}</span>
                </div>
              }
            </div>
            <div class="axis">
              @for (b of bars(); track b.month) { <span>{{ b.short }}</span> }
            </div>
          </div>
        </section>

        <section class="card">
          <header><h4>{{ i18n.t('Profit & loss by month', 'Faida na hasara kwa mwezi') }}</h4><a routerLink="/general-ledger" [queryParams]="{ tab: 'pnl' }">{{ i18n.t('Open in GL', 'Fungua kwenye GL') }}<lsms-icon name="arrow_forward" [size]="14" /></a></header>
          <div class="scroll">
            <table class="t">
              <thead>
                <tr>
                  <th>{{ i18n.t('Month', 'Mwezi') }}</th>
                  <th class="n">{{ i18n.t('Net sales', 'Mauzo halisi') }}</th>
                  <th class="n">{{ i18n.t('Cost of goods', 'Gharama ya bidhaa') }}</th>
                  <th class="n">{{ i18n.t('Gross profit', 'Faida ghafi') }}</th>
                  <th class="n">%</th>
                  <th class="n">{{ i18n.t('Running costs', 'Gharama') }}</th>
                  <th class="n">{{ i18n.t('Other income', 'Mapato mengine') }}</th>
                  <th class="n">{{ i18n.t('Net profit', 'Faida halisi') }}</th>
                </tr>
              </thead>
              <tbody>
                @for (r of rowsDesc(); track r.month) {
                  @let s = r.statement;
                  <tr [class.quiet]="!s.netRevenue && !s.operatingExpensesTotal">
                    <td>{{ monthLabel(r.month) }}</td>
                    <td class="n">{{ m(s.netRevenue) }}</td>
                    <td class="n">{{ m(s.costOfSalesTotal) }}</td>
                    <td class="n">{{ m(s.grossProfit) }}</td>
                    <td class="n muted">{{ pct(s.grossProfit, s.netRevenue) }}</td>
                    <td class="n">{{ m(s.operatingExpensesTotal) }}</td>
                    <td class="n">{{ m(s.otherIncomeTotal) }}</td>
                    <td class="n strong" [class.neg]="s.netProfit < 0">{{ m(s.netProfit) }}</td>
                  </tr>
                }
              </tbody>
              <tfoot>
                <tr>
                  <td>{{ i18n.t('Total', 'Jumla') }}</td>
                  <td class="n">{{ m(t.revenue) }}</td>
                  <td class="n">{{ m(t.cogs) }}</td>
                  <td class="n">{{ m(t.gross) }}</td>
                  <td class="n">{{ pct(t.gross, t.revenue) }}</td>
                  <td class="n">{{ m(t.opex) }}</td>
                  <td class="n">{{ m(t.other) }}</td>
                  <td class="n" [class.neg]="t.net < 0">{{ m(t.net) }}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </section>

        <div class="two">
          <section class="card">
            <header><h4>{{ i18n.t('Running costs by account', 'Gharama kwa akaunti') }}</h4><small>{{ periodLabel() }}</small></header>
            @if (opexLines().length) {
              <ul class="bars">
                @for (l of opexLines(); track l.code) {
                  <li>
                    <span class="nm">{{ l.name }} <small>{{ l.code }}</small></span>
                    <span class="track"><i [style.width.%]="l.pct"></i></span>
                    <b>{{ m(l.amount) }}</b>
                  </li>
                }
              </ul>
            } @else {
              <p class="muted pad">{{ i18n.t('No running costs in this period', 'Hakuna gharama katika kipindi hiki') }}</p>
            }
          </section>

          <section class="card">
            <header><h4>{{ i18n.t('Books vs registers', 'Vitabu dhidi ya rejista') }}</h4><small>{{ i18n.t('as of today', 'leo') }}</small></header>
            @if (checks(); as cs) {
              <ul class="checks">
                @for (c of cs; track c.key) {
                  <li [class.bad]="!c.reconciled">
                    <lsms-icon [name]="c.reconciled ? 'check_circle' : 'error'" [size]="18" />
                    <span class="nm">{{ i18n.isSwahili() ? c.labelSw : c.label }}<small>GL {{ m(c.glBalance) }} · {{ i18n.t('register', 'rejista') }} {{ m(c.subLedgerBalance) }}</small></span>
                    <b>{{ c.reconciled ? i18n.t('Matches', 'Inalingana') : (c.difference > 0 ? '+' : '') + m(c.difference) }}</b>
                  </li>
                }
              </ul>
            } @else {
              <lsms-skeleton variant="list" [rows]="4" />
            }
          </section>
        </div>

        @if (position(); as p) {
          <section class="card">
            <header><h4>{{ i18n.t('Financial position', 'Hali ya fedha') }}</h4><small>{{ i18n.t('as of', 'hadi') }} {{ p.asOfDate }}</small></header>
            <div class="bs">
              <dl>
                <dt class="h">{{ i18n.t('What the business owns', 'Mali za biashara') }}</dt>
                @for (a of p.cashAccounts; track a.code) { <div><dt>{{ i18n.isSwahili() ? (a.nameSw ?? a.name) : a.name }}</dt><dd [class.neg]="a.amount < 0">{{ m(a.amount) }}</dd></div> }
                <div><dt>{{ i18n.t('Customers owe', 'Madeni ya wateja') }}</dt><dd>{{ m(p.receivables) }}</dd></div>
                @if (p.staffReceivables) { <div><dt>{{ i18n.t('Staff shortages owed', 'Madeni ya wafanyakazi') }}</dt><dd>{{ m(p.staffReceivables) }}</dd></div> }
                <div><dt>{{ i18n.t('Stock at cost', 'Stoki kwa gharama') }}</dt><dd>{{ m(p.inventory) }}</dd></div>
                <div><dt>{{ i18n.t('Fixed assets (net)', 'Mali za kudumu (baada ya uchakavu)') }}</dt><dd>{{ m(p.fixedAssetsNet) }}</dd></div>
                @if (p.otherAssets) { <div><dt>{{ i18n.t('Other assets', 'Mali nyingine') }}</dt><dd>{{ m(p.otherAssets) }}</dd></div> }
                <div class="sum"><dt>{{ i18n.t('Total assets', 'Jumla ya mali') }}</dt><dd>{{ m(p.totalAssets) }}</dd></div>
              </dl>
              <dl>
                <dt class="h">{{ i18n.t('What it owes', 'Madeni ya biashara') }}</dt>
                <div><dt>{{ i18n.t('Suppliers', 'Wasambazaji') }}</dt><dd>{{ m(p.payables) }}</dd></div>
                <div><dt>{{ i18n.t('Loans', 'Mikopo') }}</dt><dd>{{ m(p.loans) }}</dd></div>
                @if (p.otherLiabilities) { <div><dt>{{ i18n.t('Other', 'Mengineyo') }}</dt><dd>{{ m(p.otherLiabilities) }}</dd></div> }
                <div class="sum"><dt>{{ i18n.t('Total liabilities', 'Jumla ya madeni') }}</dt><dd>{{ m(p.totalLiabilities) }}</dd></div>
                <dt class="h">{{ i18n.t('Owner’s equity', 'Mtaji wa mmiliki') }}</dt>
                <div><dt>{{ i18n.t('Capital put in', 'Mtaji uliowekwa') }}</dt><dd>{{ m(p.ownerCapital + p.openingBalanceEquity) }}</dd></div>
                @if (p.drawings) { <div><dt>{{ i18n.t('Drawings', 'Kilichotolewa') }}</dt><dd>−{{ m(p.drawings) }}</dd></div> }
                <div><dt>{{ i18n.t('Profits kept', 'Faida iliyobaki') }}</dt><dd [class.neg]="p.retainedEarnings < 0">{{ m(p.retainedEarnings) }}</dd></div>
                <div class="sum"><dt>{{ i18n.t('Total equity', 'Jumla ya mtaji') }}</dt><dd>{{ m(p.totalEquity) }}</dd></div>
              </dl>
            </div>
            <p class="foot" [class.bad]="!p.isBalanced">
              <lsms-icon [name]="p.isBalanced ? 'verified' : 'error'" [size]="16" />
              {{ p.isBalanced ? i18n.t('Assets = liabilities + equity — the books balance.', 'Mali = madeni + mtaji — vitabu vinalingana.') : i18n.t('The books do not balance.', 'Vitabu havilingani.') }}
            </p>
          </section>
        }
      }
    </app-report-frame>
  `,
  styleUrl: './report.scss',
  styles: `
    .warn { display: flex; align-items: center; flex-wrap: wrap; gap: 6px; margin: 0; padding: 10px 14px; border-radius: 12px; font-size: 0.82rem; color: var(--c-text);
      background: color-mix(in srgb, var(--c-warning) 9%, var(--c-surface)); border: 1px solid color-mix(in srgb, var(--c-warning) 30%, transparent); lsms-icon { color: var(--c-warning); } }
    .chart { padding: 8px 4px 0; }
    .plot { position: relative; height: 180px; display: flex; gap: 2px; }
    .zero { position: absolute; left: 0; right: 0; height: 1px; background: var(--c-border); }
    .col { position: relative; flex: 1; outline: none; }
    .col:hover, .col:focus-visible { background: color-mix(in srgb, var(--c-primary) 5%, transparent); border-radius: 6px; }
    .bar { position: absolute; left: 22%; right: 22%; min-height: 2px; border-radius: 4px 4px 0 0; background: var(--c-primary); }
    .bar.neg { background: var(--c-error); border-radius: 0 0 4px 4px; }
    .tip { display: none; position: absolute; bottom: 100%; left: 50%; transform: translateX(-50%); z-index: 2; min-width: 150px; padding: 8px 10px; border-radius: 10px;
      font-size: 0.74rem; line-height: 1.45; color: var(--c-text); background: var(--c-float); border: 1px solid var(--c-border); box-shadow: 0 8px 20px -8px rgb(16 24 40 / 0.35); white-space: nowrap; }
    .tip b { display: block; }
    .col:nth-last-child(-n + 2) .tip { left: auto; right: 0; transform: none; }
    .col:nth-child(-n + 3) .tip { left: 0; transform: none; }
    .col:hover .tip, .col:focus-visible .tip { display: block; }
    .axis { display: flex; gap: 2px; margin-top: 6px; }
    .axis span { flex: 1; text-align: center; font-size: 0.7rem; color: var(--c-text-2); }
    .bs { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 32px; }
    @media (max-width: 760px) { .bs { grid-template-columns: 1fr; } }
    .bs dl { display: flex; flex-direction: column; margin: 0; }
    .bs dl > div { display: flex; justify-content: space-between; gap: 12px; padding: 7px 0; border-bottom: 1px dashed var(--c-border); font-size: 0.84rem; }
    .bs dt { color: var(--c-text-2); }
    .bs dt.h { margin: 10px 0 2px; font-size: 0.7rem; font-weight: 800; letter-spacing: 0.7px; text-transform: uppercase; }
    .bs dd { margin: 0; font-weight: 500; color: var(--c-text); font-variant-numeric: tabular-nums; }
    .bs .sum dt, .bs .sum dd { font-weight: 700; color: var(--c-text); }
    .foot { display: flex; align-items: center; gap: 6px; margin: 12px 0 0; font-size: 0.8rem; color: var(--c-success); }
    .foot.bad { color: var(--c-error); }
    .checks { display: flex; flex-direction: column; margin: 0; padding: 0; list-style: none; }
    .checks li { display: flex; align-items: center; gap: 10px; padding: 9px 0; border-bottom: 1px dashed var(--c-border); }
    .checks li:last-child { border-bottom: 0; }
    .checks lsms-icon { color: var(--c-success); }
    .checks li.bad lsms-icon, .checks li.bad b { color: var(--c-error); }
    .checks b { font-size: 0.84rem; font-weight: 600; font-variant-numeric: tabular-nums; color: var(--c-text); }
  `,
})
export class FinancialReport {
  protected readonly i18n = inject(LanguageService);
  private readonly api = inject(ReportsService);
  private readonly gl = inject(GlService);

  protected readonly span = signal<Span>(12);
  protected readonly months = signal<MonthPnl[] | null>(null);
  protected readonly future = signal<IncomeStatement | null>(null);
  protected readonly position = signal<FinancialPosition | null>(null);
  protected readonly checks = signal<ControlCheck[] | null>(null);
  protected readonly error = signal('');

  protected readonly spans = computed<SegmentOption<Span>[]>(() => [
    { value: 6, label: this.i18n.t('6 months', 'Miezi 6') },
    { value: 12, label: this.i18n.t('12 months', 'Miezi 12') },
    { value: 24, label: this.i18n.t('24 months', 'Miezi 24') },
  ]);

  protected readonly totals = computed(() => {
    const rows = this.months() ?? [];
    const s = (f: (x: IncomeStatement) => number) => rows.reduce((a, r) => a + f(r.statement), 0);
    return {
      revenue: s((x) => x.netRevenue),
      cogs: s((x) => x.costOfSalesTotal),
      gross: s((x) => x.grossProfit),
      opex: s((x) => x.operatingExpensesTotal),
      other: s((x) => x.otherIncomeTotal),
      net: s((x) => x.netProfit),
    };
  });
  protected readonly rowsDesc = computed(() => [...(this.months() ?? [])].reverse());
  protected readonly periodLabel = computed(() => {
    const r = this.months();
    return r?.length ? `${this.monthLabel(r[0].month)} – ${this.monthLabel(r[r.length - 1].month)}` : null;
  });

  /** Single-series bar chart: net profit per month on a shared zero baseline. */
  private readonly scale = computed(() => {
    const nets = (this.months() ?? []).map((r) => r.statement.netProfit);
    const max = Math.max(0, ...nets);
    const min = Math.min(0, ...nets);
    return { max, min, range: max - min || 1 };
  });
  protected readonly zeroAt = computed(() => (-this.scale().min / this.scale().range) * 100);
  protected readonly bars = computed(() =>
    (this.months() ?? []).map((r) => ({
      month: r.month,
      label: this.monthLabel(r.month),
      short: this.shortMonth(r.month),
      net: r.statement.netProfit,
      revenue: r.statement.netRevenue,
      h: (Math.abs(r.statement.netProfit) / this.scale().range) * 100,
    })),
  );

  protected readonly opexLines = computed(() => {
    const map = new Map<string, { code: string; name: string; amount: number }>();
    for (const r of this.months() ?? []) {
      for (const l of r.statement.operatingExpenses) {
        const cur = map.get(l.code) ?? { code: l.code, name: this.i18n.isSwahili() ? (l.nameSw ?? l.name) : l.name, amount: 0 };
        cur.amount += l.amount;
        map.set(l.code, cur);
      }
    }
    const list = [...map.values()].filter((l) => l.amount).sort((a, b) => b.amount - a.amount);
    const top = list[0]?.amount || 1;
    return list.map((l) => ({ ...l, pct: Math.max(2, (l.amount / top) * 100) }));
  });

  constructor() {
    this.load();
  }

  protected setSpan(s: Span): void {
    this.span.set(s);
    this.loadMonths();
  }

  protected load(): void {
    this.loadMonths();
    this.api.futurePostings().then((f) => this.future.set(f)).catch(() => this.future.set(null));
    this.gl.position().then((p) => this.position.set(p)).catch(() => this.position.set(null));
    this.checks.set(null);
    this.gl.controlChecks().then((c) => this.checks.set(c)).catch(() => this.checks.set([]));
  }

  private loadMonths(): void {
    this.error.set('');
    this.months.set(null);
    this.api
      .monthlyPnl(this.span())
      .then((m) => this.months.set(m))
      .catch((e) => this.error.set(ApiError.from(e).message));
  }

  protected m(v: number): string {
    return Money.format(v, { decimals: 0 });
  }

  protected pct(part: number, whole: number): string {
    return whole ? `${((part / whole) * 100).toFixed(1)}%` : '—';
  }

  protected monthLabel(ym: string): string {
    const [y, mo] = ym.split('-').map(Number);
    return new Intl.DateTimeFormat(this.i18n.isSwahili() ? 'sw-TZ' : 'en-GB', { month: 'short', year: 'numeric' }).format(new Date(y, mo - 1, 1));
  }

  private shortMonth(ym: string): string {
    const [y, mo] = ym.split('-').map(Number);
    return new Intl.DateTimeFormat(this.i18n.isSwahili() ? 'sw-TZ' : 'en-GB', { month: 'short' }).format(new Date(y, mo - 1, 1));
  }

  private table(): { headers: string[]; rows: (string | number)[][] } {
    const t = (en: string, sw: string) => this.i18n.t(en, sw);
    return {
      headers: [t('Month', 'Mwezi'), t('Net sales', 'Mauzo halisi'), t('Cost of goods', 'Gharama ya bidhaa'), t('Gross profit', 'Faida ghafi'), t('Margin', 'Asilimia'), t('Running costs', 'Gharama'), t('Other income', 'Mapato mengine'), t('Net profit', 'Faida halisi')],
      rows: this.rowsDesc().map((r) => {
        const s = r.statement;
        return [this.monthLabel(r.month), s.netRevenue, s.costOfSalesTotal, s.grossProfit, this.pct(s.grossProfit, s.netRevenue), s.operatingExpensesTotal, s.otherIncomeTotal, s.netProfit];
      }),
    };
  }

  protected csv(): void {
    const { headers, rows } = this.table();
    downloadCsv('profit_loss_gl', headers, rows);
  }

  protected print(): void {
    const { headers, rows } = this.table();
    const t = this.totals();
    printReport({
      title: this.i18n.t('Profit & loss (General Ledger)', 'Faida na hasara (Leja Kuu)'),
      subtitle: this.periodLabel() ?? undefined,
      headers,
      rows: rows.map((r) => r.map((c) => (typeof c === 'number' ? this.m(c) : c))),
      numeric: [1, 2, 3, 4, 5, 6, 7],
      summary: [
        [this.i18n.t('Net sales', 'Mauzo halisi'), this.m(t.revenue)],
        [this.i18n.t('Gross profit', 'Faida ghafi'), this.m(t.gross)],
        [this.i18n.t('Running costs', 'Gharama'), this.m(t.opex)],
        [this.i18n.t('Net profit', 'Faida halisi'), this.m(t.net)],
      ],
    });
  }
}
