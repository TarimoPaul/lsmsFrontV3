import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';

import { ApiError } from '@core/api/api.types';
import { AuthService } from '@core/auth/auth.service';
import { LanguageService } from '@core/i18n/language.service';
import { DataTable, EmptyState, Icon, MetricCard, MetricsGrid, SegmentOption, SegmentedFilterBar, Skeleton, TableColumn } from '@shared/ui';
import { DateRange, parseLocal, rangeForPreset, toIsoDate } from '@shared/utils/date-utils';
import { Cell, downloadCsv, printReport } from '@shared/utils/export';
import { Money } from '@shared/utils/money';
import { Expenditure, LOAN_STATUS, Loan, SOURCE_LABELS, STATUS, typeLabel } from '../capital/capital.models';
import { CapitalService } from '../capital/capital.service';
import { IncomeStatement } from '../general-ledger/gl.models';
import { GlService } from '../general-ledger/gl.service';
import { ReportFrame } from './report-frame';

type View = 'expenses' | 'assets' | 'funding';

/** Stock-purchase mirrors live in the capital register but are not expenses. */
const NOT_EXPENSES = new Set(['PRODUCT_CAPITAL', 'INVENTORY_CAPITAL']);

/**
 * Expenses & capital from the Capital registers (every approved row is a GL
 * journal), with the period's running costs checked against the GL income
 * statement — the GL also carries depreciation and stock losses posted by
 * other modules, which the report lists separately.
 */
@Component({
  selector: 'app-expenses-report',
  imports: [ReportFrame, SegmentedFilterBar, MetricCard, MetricsGrid, Skeleton, EmptyState, Icon, DataTable, TableColumn],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-report-frame report="expenses" [range]="range()" [hasFilters]="true" (rangeChange)="setRange($event)" (refresh)="load(true)" (csv)="csv()" (print)="print()">
      <lsms-segmented-filter-bar filters [options]="views()" [selected]="view()" (selectedChange)="view.set($event)" />

      @if (error()) {
        <lsms-empty-state icon="cloud_off" [title]="i18n.t('Could not load capital', 'Mtaji haukupatikana')" [message]="error()" />
      } @else if (!all()) {
        <lsms-skeleton variant="list" [rows]="6" />
      } @else {
        @let k = kpi();
        <lsms-metrics-grid [gap]="12">
          <lsms-metric-card [title]="i18n.t('Expenses (approved)', 'Gharama (zimeidhinishwa)')" [value]="m(k.expenses)" icon="receipt_long" color="var(--c-error)" [subtitle]="k.expenseCount + ' ' + i18n.t('entries in this period', 'maingizo katika kipindi hiki')" />
          <lsms-metric-card [title]="i18n.t('Awaiting approval', 'Zinasubiri idhini')" [value]="m(k.pending)" icon="hourglass_top" color="var(--c-warning)" [subtitle]="k.pendingCount + ' ' + i18n.t('entries, any date', 'maingizo, tarehe yoyote')" [urgent]="k.pendingCount > 0" />
          <lsms-metric-card [title]="i18n.t('Assets bought', 'Mali zilizonunuliwa')" [value]="m(k.assets)" icon="chair" color="var(--c-info)" [subtitle]="i18n.t('fixed assets now worth ', 'mali za kudumu sasa zina thamani ') + m(k.nbv)" />
          <lsms-metric-card [title]="i18n.t('Owner capital (net)', 'Mtaji wa mmiliki (halisi)')" [value]="m(k.ownerIn - k.ownerOut)" icon="savings" color="var(--c-primary)" [subtitle]="'+' + m(k.ownerIn) + ' / −' + m(k.ownerOut)" />
        </lsms-metrics-grid>

        @switch (view()) {
          @case ('expenses') {
            <div class="two">
              <section class="card">
                <header><h4>{{ i18n.t('Approved expenses by category', 'Gharama zilizoidhinishwa kwa aina') }}</h4></header>
                @if (categories().length) {
                  <ul class="bars">
                    @for (c of categories(); track c.type) {
                      <li><span class="nm">{{ c.label }} <small>{{ c.count }} ×</small></span><span class="track"><i [style.width.%]="c.pct"></i></span><b>{{ m(c.amount) }}</b></li>
                    }
                  </ul>
                } @else {
                  <p class="muted pad">{{ i18n.t('No approved expenses in this period', 'Hakuna gharama zilizoidhinishwa katika kipindi hiki') }}</p>
                }
              </section>
              <section class="card">
                <header><h4>{{ i18n.t('In the books (GL)', 'Kwenye vitabu (GL)') }}</h4><small>{{ i18n.t('running costs posted', 'gharama zilizowekwa') }}</small></header>
                @if (!canGl()) {
                  <p class="muted pad">{{ i18n.t('Needs FINANCE_READ to compare with the General Ledger.', 'Inahitaji FINANCE_READ kulinganisha na Leja Kuu.') }}</p>
                } @else if (glStatement(); as g) {
                  <ul class="bars" style="--bar: var(--c-secondary)">
                    @for (l of g.operatingExpenses; track l.code) {
                      <li><span class="nm">{{ i18n.isSwahili() ? (l.nameSw ?? l.name) : l.name }} <small>{{ l.code }}</small></span><span class="track"><i [style.width.%]="(l.amount / (g.operatingExpensesTotal || 1)) * 100"></i></span><b>{{ m(l.amount) }}</b></li>
                    } @empty {
                      <li class="muted">{{ i18n.t('Nothing posted', 'Hakuna kilichowekwa') }}</li>
                    }
                  </ul>
                  <p class="xcheck" [class.bad]="!glMatch()" style="margin-top: 12px">
                    <lsms-icon [name]="glMatch() ? 'verified' : 'info'" [size]="17" />
                    GL {{ m(g.operatingExpensesTotal) }} · {{ i18n.t('register', 'rejista') }} {{ m(k.expenses) }}
                    @if (!glMatch()) { — {{ i18n.t('GL also holds depreciation, stock losses and reconciliation expenses', 'GL ina pia uchakavu, upotevu wa stoki na gharama za ulinganisho') }} }
                  </p>
                } @else {
                  <lsms-skeleton variant="list" [rows]="3" />
                }
              </section>
            </div>
            <section class="card flush">
              <lsms-data-table [items]="expenseRows()" title="expenses" [showHeader]="false" [pageSize]="25" defaultSortColumn="date" defaultSortDirection="desc" [mobileTitle]="descOf" [emptyTitle]="i18n.t('No expenses in this period', 'Hakuna gharama katika kipindi hiki')">
                <ng-template lsmsColumn="date" [label]="i18n.t('Date', 'Tarehe')" [sortBy]="byDate" let-row>{{ day(row.transactionDate) }}</ng-template>
                <ng-template lsmsColumn="desc" [label]="i18n.t('Description', 'Maelezo')" let-row>
                  <span class="cell-stack"><strong>{{ row.description || '—' }}</strong><small>{{ type(row.capitalType) }}@if (row.createdBy) { · {{ row.createdBy }} }</small></span>
                </ng-template>
                <ng-template lsmsColumn="amount" [label]="i18n.t('Amount', 'Kiasi')" align="end" [sortBy]="byAmount" let-row><span class="num strong">{{ m(row.amount) }}</span></ng-template>
                <ng-template lsmsColumn="status" [label]="i18n.t('Status', 'Hali')" let-row>
                  @let s = status(row);
                  <span class="status" [style.--st]="s.color">{{ i18n.isSwahili() ? s.sw : s.en }}</span>
                </ng-template>
              </lsms-data-table>
            </section>
          }
          @case ('assets') {
            <section class="card flush">
              <lsms-data-table [items]="assetRows()" title="assets" [showHeader]="false" defaultSortColumn="cost" defaultSortDirection="desc" [mobileTitle]="descOf" [emptyTitle]="i18n.t('No fixed assets', 'Hakuna mali za kudumu')">
                <ng-template lsmsColumn="desc" [label]="i18n.t('Asset', 'Mali')" let-row>
                  <span class="cell-stack"><strong>{{ row.description || '—' }}</strong><small>{{ type(row.capitalType) }} · {{ day(row.transactionDate) }}</small></span>
                </ng-template>
                <ng-template lsmsColumn="cost" [label]="i18n.t('Cost', 'Gharama')" align="end" [sortBy]="byAmount" let-row><span class="num">{{ m(row.amount) }}</span></ng-template>
                <ng-template lsmsColumn="dep" [label]="i18n.t('Depreciation so far', 'Uchakavu hadi sasa')" align="end" let-row><span class="num muted">{{ m(row.accumulatedDepreciation ?? 0) }}</span></ng-template>
                <ng-template lsmsColumn="nbv" [label]="i18n.t('Worth now', 'Thamani sasa')" align="end" [sortBy]="byNbv" let-row><span class="num strong">{{ m(nbv(row)) }}</span></ng-template>
                <ng-template lsmsColumn="life" [label]="i18n.t('Life', 'Muda wa matumizi')" align="end" let-row><span class="num muted">{{ row.assetLifeMonths ? row.assetLifeMonths + ' ' + i18n.t('months', 'miezi') : '—' }}</span></ng-template>
              </lsms-data-table>
            </section>
          }
          @case ('funding') {
            <div class="two">
              <section class="card">
                <header><h4>{{ i18n.t('Loans', 'Mikopo') }}</h4><small>{{ i18n.t('outstanding', 'inayodaiwa') }} {{ m(k.loansOut) }}</small></header>
                <ul class="rows">
                  @for (l of loans(); track l.uid) {
                    @let st = loanStatus(l.status);
                    <li>
                      <span class="nm"><b>{{ l.reason || i18n.t('Loan', 'Mkopo') }}</b><small>{{ day(l.injectionDate) }} · {{ m(l.loanAmount) }} · {{ i18n.t('repaid', 'imelipwa') }} {{ m(l.totalRepaid) }}</small></span>
                      <span class="status" [style.--st]="st.color">{{ i18n.isSwahili() ? st.sw : st.en }}</span>
                      <b>{{ m(l.outstandingBalance) }}</b>
                    </li>
                  } @empty {
                    <li class="muted">{{ i18n.t('No loans recorded', 'Hakuna mikopo') }}</li>
                  }
                </ul>
              </section>
              <section class="card">
                <header><h4>{{ i18n.t('Owner capital in this period', 'Mtaji wa mmiliki katika kipindi') }}</h4></header>
                <ul class="rows">
                  @for (mv of ownerMoves(); track mv.uid) {
                    <li [class.void]="mv.injection_type === 'VOID'">
                      <span class="nm"><b>{{ mv.reason }}</b><small>{{ day(mv.transaction_date) }} · {{ source(mv.source_type) }}</small></span>
                      <b [class.neg]="mv.injection_type === 'WITHDRAWAL'">{{ mv.injection_type === 'WITHDRAWAL' ? '−' : '+' }}{{ m(mv.amount) }}</b>
                    </li>
                  } @empty {
                    <li class="muted">{{ i18n.t('No owner capital movements in this period', 'Hakuna harakati za mtaji katika kipindi hiki') }}</li>
                  }
                </ul>
              </section>
            </div>
          }
        }
      }
    </app-report-frame>
  `,
  styleUrl: './report.scss',
  styles: `
    ul.rows { display: flex; flex-direction: column; margin: 0; padding: 0; list-style: none; }
    ul.rows li { display: flex; align-items: center; gap: 10px; padding: 9px 0; border-bottom: 1px dashed var(--c-border); font-size: 0.84rem; }
    ul.rows li:last-child { border-bottom: 0; }
    ul.rows .nm { flex: 1; min-width: 0; display: flex; flex-direction: column; }
    ul.rows .nm b { font-weight: 500; color: var(--c-text); }
    ul.rows .nm small { font-size: 0.72rem; color: var(--c-text-2); }
    ul.rows > li > b { font-weight: 600; font-variant-numeric: tabular-nums; color: var(--c-text); }
    ul.rows li.void { opacity: 0.55; text-decoration: line-through; }
  `,
})
export class ExpensesReport {
  protected readonly i18n = inject(LanguageService);
  private readonly api = inject(CapitalService);
  private readonly gl = inject(GlService);
  private readonly auth = inject(AuthService);

  protected readonly canGl = computed(() => this.auth.hasPermission('FINANCE_READ'));
  protected readonly range = signal<DateRange>(rangeForPreset('thisMonth'));
  protected readonly view = signal<View>('expenses');
  protected readonly error = signal('');
  protected readonly glStatement = signal<IncomeStatement | null>(null);
  protected readonly all = this.api.all.value;
  private readonly movements = this.api.movements.value;
  protected readonly loans = computed<Loan[]>(() => this.api.loans.value() ?? []);

  protected readonly views = computed<SegmentOption<View>[]>(() => [
    { value: 'expenses', label: this.i18n.t('Expenses', 'Gharama'), icon: 'receipt_long' },
    { value: 'assets', label: this.i18n.t('Fixed assets', 'Mali za kudumu'), icon: 'chair' },
    { value: 'funding', label: this.i18n.t('Loans & owner', 'Mikopo na mmiliki'), icon: 'savings' },
  ]);

  private inRange(v: string | null): boolean {
    const d = (v ?? '').slice(0, 10);
    const r = this.range();
    return !!d && d >= toIsoDate(r.start) && d <= toIsoDate(r.end);
  }

  private readonly expenses = computed(() => (this.all() ?? []).filter((e) => !e.asset && !NOT_EXPENSES.has(e.capitalType)));
  protected readonly expenseRows = computed(() => this.expenses().filter((e) => this.inRange(e.transactionDate)));
  private readonly approvedInRange = computed(() => this.expenseRows().filter((e) => e.status === 'APPROVED'));
  protected readonly assetRows = computed(() => (this.all() ?? []).filter((e) => e.asset && e.status === 'APPROVED'));
  protected readonly ownerMoves = computed(() =>
    (this.movements() ?? [])
      .filter((m) => m.source_type !== 'LOAN' && m.source_type !== 'LOAN_REPAYMENT' && !m.reclassified_from && this.inRange(m.transaction_date))
      .sort((a, b) => (b.transaction_date ?? '').localeCompare(a.transaction_date ?? '')),
  );

  protected readonly kpi = computed(() => {
    const approved = this.approvedInRange();
    const pending = this.expenses().filter((e) => e.status === 'PENDING');
    const live = this.ownerMoves().filter((m) => m.injection_type !== 'VOID');
    return {
      expenses: approved.reduce((a, e) => a + e.amount, 0),
      expenseCount: approved.length,
      pending: pending.reduce((a, e) => a + e.amount, 0),
      pendingCount: pending.length,
      assets: this.assetRows().filter((e) => this.inRange(e.transactionDate)).reduce((a, e) => a + e.amount, 0),
      nbv: this.assetRows().reduce((a, e) => a + this.nbv(e), 0),
      ownerIn: live.filter((m) => m.injection_type === 'INJECTION').reduce((a, m) => a + m.amount, 0),
      ownerOut: live.filter((m) => m.injection_type === 'WITHDRAWAL').reduce((a, m) => a + m.amount, 0),
      loansOut: this.loans().reduce((a, l) => a + l.outstandingBalance, 0),
    };
  });

  protected readonly categories = computed(() => {
    const map = new Map<string, { type: string; label: string; count: number; amount: number }>();
    for (const e of this.approvedInRange()) {
      const row = map.get(e.capitalType) ?? { type: e.capitalType, label: typeLabel(e.capitalType, this.i18n.isSwahili()), count: 0, amount: 0 };
      row.count++;
      row.amount += e.amount;
      map.set(e.capitalType, row);
    }
    const list = [...map.values()].sort((a, b) => b.amount - a.amount);
    const top = list[0]?.amount || 1;
    return list.map((c) => ({ ...c, pct: Math.max(2, (c.amount / top) * 100) }));
  });

  protected readonly glMatch = computed(() => {
    const g = this.glStatement();
    return !!g && Math.abs(g.operatingExpensesTotal - this.kpi().expenses) < 1;
  });

  protected readonly descOf = (e: Expenditure) => e.description || typeLabel(e.capitalType, this.i18n.isSwahili());
  protected readonly byDate = (e: Expenditure) => e.transactionDate ?? '';
  protected readonly byAmount = (e: Expenditure) => e.amount;
  protected readonly byNbv = (e: Expenditure) => this.nbv(e);

  constructor() {
    this.load(false);
  }

  protected setRange(r: DateRange): void {
    this.range.set(r);
    this.loadGl();
  }

  protected load(force: boolean): void {
    this.error.set('');
    Promise.all([this.api.all.load(force), this.api.movements.load(force), this.api.loans.load(force)]).catch((e) => this.error.set(ApiError.from(e).message));
    this.loadGl();
  }

  private loadGl(): void {
    if (!this.canGl()) return;
    const r = this.range();
    this.glStatement.set(null);
    this.gl
      .incomeStatement(toIsoDate(r.start), toIsoDate(r.end))
      .then((s) => this.glStatement.set(s))
      .catch(() => this.glStatement.set(null));
  }

  protected nbv(e: Expenditure): number {
    return e.currentAssetValue ?? Math.max(0, e.amount - (e.accumulatedDepreciation ?? 0));
  }

  protected type(t: string): string {
    return typeLabel(t, this.i18n.isSwahili());
  }

  protected status(e: Expenditure) {
    return STATUS[e.status] ?? { en: e.status, sw: e.status, color: 'var(--c-text-2)' };
  }

  protected loanStatus(s: string) {
    return LOAN_STATUS[s] ?? { en: s, sw: s, color: 'var(--c-text-2)' };
  }

  protected source(s: string): string {
    const l = SOURCE_LABELS[s];
    return l ? (this.i18n.isSwahili() ? l.sw : l.en) : s;
  }

  protected m(v: number): string {
    return Money.format(v, { decimals: 0 });
  }

  protected day(v: string | null): string {
    const d = parseLocal(v);
    return d ? new Intl.DateTimeFormat(this.i18n.isSwahili() ? 'sw-TZ' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(d) : '—';
  }

  private table(): { title: string; headers: string[]; rows: Cell[][]; money: number[] } {
    const t = (en: string, sw: string) => this.i18n.t(en, sw);
    const st = (e: Expenditure) => (this.i18n.isSwahili() ? this.status(e).sw : this.status(e).en);
    if (this.view() === 'assets') {
      return {
        title: t('Fixed assets register', 'Rejista ya mali za kudumu'),
        headers: [t('Asset', 'Mali'), t('Type', 'Aina'), t('Bought', 'Ilinunuliwa'), t('Cost', 'Gharama'), t('Depreciation', 'Uchakavu'), t('Worth now', 'Thamani sasa')],
        rows: this.assetRows().map((e) => [e.description, this.type(e.capitalType), (e.transactionDate ?? '').slice(0, 10), e.amount, e.accumulatedDepreciation ?? 0, this.nbv(e)]),
        money: [3, 4, 5],
      };
    }
    if (this.view() === 'funding') {
      return {
        title: t('Loans', 'Mikopo'),
        headers: [t('Loan', 'Mkopo'), t('Date', 'Tarehe'), t('Amount', 'Kiasi'), t('Repaid', 'Imelipwa'), t('Outstanding', 'Inadaiwa'), t('Status', 'Hali')],
        rows: this.loans().map((l) => [l.reason, (l.injectionDate ?? '').slice(0, 10), l.loanAmount, l.totalRepaid, l.outstandingBalance, this.i18n.isSwahili() ? this.loanStatus(l.status).sw : this.loanStatus(l.status).en]),
        money: [2, 3, 4],
      };
    }
    return {
      title: t('Expenses', 'Gharama'),
      headers: [t('Date', 'Tarehe'), t('Description', 'Maelezo'), t('Category', 'Aina'), t('Amount', 'Kiasi'), t('Status', 'Hali'), t('Recorded by', 'Aliyerekodi')],
      rows: [...this.expenseRows()].sort((a, b) => (b.transactionDate ?? '').localeCompare(a.transactionDate ?? '')).map((e) => [(e.transactionDate ?? '').slice(0, 10), e.description, this.type(e.capitalType), e.amount, st(e), e.createdBy ?? '']),
      money: [3],
    };
  }

  protected csv(): void {
    const tb = this.table();
    downloadCsv(`capital_${this.view()}`, tb.headers, tb.rows);
  }

  protected print(): void {
    const tb = this.table();
    const k = this.kpi();
    const r = this.range();
    printReport({
      title: tb.title,
      subtitle: this.view() === 'expenses' ? `${toIsoDate(r.start)} – ${toIsoDate(r.end)}` : undefined,
      headers: tb.headers,
      rows: tb.rows.map((row) => row.map((c, i) => (typeof c === 'number' && tb.money.includes(i) ? this.m(c) : c))),
      numeric: tb.money,
      summary:
        this.view() === 'expenses'
          ? [
              [this.i18n.t('Approved', 'Zimeidhinishwa'), this.m(k.expenses)],
              [this.i18n.t('Awaiting approval', 'Zinasubiri'), this.m(k.pending)],
              ...this.categories().map((c) => [c.label, this.m(c.amount)] as [string, string]),
            ]
          : this.view() === 'assets'
            ? [[this.i18n.t('Worth now', 'Thamani sasa'), this.m(k.nbv)]]
            : [[this.i18n.t('Loans outstanding', 'Mikopo inayodaiwa'), this.m(k.loansOut)]],
    });
  }
}
