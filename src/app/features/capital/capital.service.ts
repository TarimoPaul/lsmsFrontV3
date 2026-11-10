import { Injectable, inject } from '@angular/core';

import { ApiService } from '@core/api/api.service';
import { CachedResource } from '@core/data/cached-resource';
import { GlService } from '../general-ledger/gl.service';
import { CapitalMovement, Expenditure, ExpStatus, Loan, LoanCard, ReclassResult, n } from './capital.models';

const CE = '/api/v1/capital-expenditure';
const CM = '/api/v1/capital-monitoring';

type Raw = Record<string, unknown>;

function toExp(r: Raw): Expenditure {
  return {
    uid: String(r['uid']),
    capitalType: String(r['capitalType'] ?? ''),
    expenditureType: String(r['expenditureType'] ?? ''),
    amount: n(r['amount']),
    description: String(r['description'] ?? ''),
    transactionDate: (r['transactionDate'] as string) ?? null,
    referenceNumber: (r['referenceNumber'] as string) ?? null,
    paymentMethod: (r['paymentMethod'] as string) ?? null,
    status: ((r['status'] as string) ?? (r['approved'] ? 'APPROVED' : 'PENDING')) as ExpStatus,
    createdBy: (r['createdBy'] as string) ?? null,
    approvedBy: (r['approvedBy'] as string) ?? null,
    approvalDate: (r['approvalDate'] as string) ?? null,
    statusChangeReason: (r['statusChangeReason'] as string) ?? null,
    lastStatusUpdatedBy: (r['lastStatusUpdatedBy'] as string) ?? null,
    asset: !!r['asset'],
    assetLifeMonths: r['assetLifeMonths'] == null ? null : n(r['assetLifeMonths']),
    salvageValue: r['salvageValue'] == null ? null : n(r['salvageValue']),
    monthlyDepreciation: r['monthlyDepreciation'] == null ? null : n(r['monthlyDepreciation']),
    accumulatedDepreciation: r['accumulatedDepreciation'] == null ? null : n(r['accumulatedDepreciation']),
    currentAssetValue: r['currentAssetValue'] == null ? null : n(r['currentAssetValue']),
    disposalGainLoss: r['disposalGainLoss'] == null ? null : n(r['disposalGainLoss']),
    purchaseUid: (r['purchaseUid'] as string) ?? null,
    recurring: !!r['recurring'],
  };
}

function toCard(c: LoanCard): LoanCard {
  return {
    ...c,
    principal: n(c.principal),
    interestTotal: n(c.interestTotal),
    total: n(c.total),
    daysLeft: n(c.daysLeft),
    interestDaily: n(c.interestDaily),
    reserveDaily: n(c.reserveDaily),
    dailyCharge: n(c.dailyCharge),
    interestBooked: n(c.interestBooked),
    interestRemaining: n(c.interestRemaining),
    repaid: n(c.repaid),
    owed: n(c.owed),
    installments: (c.installments ?? []).map((i) => ({ ...i, amount: n(i.amount), paidAmount: n(i.paidAmount), daysLate: n(i.daysLate) })),
  };
}

/**
 * Capital: expenses, fixed assets, loans and owner capital. Every write that
 * reaches the books bumps {@link GlService.version} so GL / capital views refresh.
 */
@Injectable({ providedIn: 'root' })
export class CapitalService {
  private readonly api = inject(ApiService);
  private readonly gl = inject(GlService);

  /** Every capital-expenditure row (stock-purchase mirrors included; views filter). */
  readonly all = new CachedResource<Expenditure[]>(async () => {
    const page = await this.api.get<{ content?: Raw[] } | Raw[] | null>(CE, { params: { page: 0, size: 5000 } });
    const rows = Array.isArray(page) ? page : (page?.content ?? []);
    return rows.map(toExp);
  }, 60_000);

  readonly movements = new CachedResource<CapitalMovement[]>(
    async () => ((await this.api.get<CapitalMovement[] | null>(`${CM}/injections`)) ?? []).map((m) => ({ ...m, amount: n(m.amount) })),
    60_000,
  );

  readonly loans = new CachedResource<Loan[]>(
    async () =>
      ((await this.api.get<Loan[] | null>(`${CM}/loans`)) ?? []).map((l) => ({
        ...l,
        loanAmount: n(l.loanAmount),
        totalRepaid: n(l.totalRepaid),
        outstandingBalance: n(l.outstandingBalance),
        card: l.card ? toCard(l.card) : null,
      })),
    60_000,
  );

  private changed(): void {
    this.all.invalidate();
    this.movements.invalidate();
    this.loans.invalidate();
    this.gl.touch();
  }

  // ── Expenses & assets ──

  async create(body: Record<string, unknown>): Promise<Expenditure> {
    const r = toExp(await this.api.post<Raw>(CE, body));
    this.all.invalidate();
    return r;
  }

  async approve(uid: string, reason?: string): Promise<Expenditure> {
    const r = toExp(await this.api.patch<Raw>(`${CE}/${uid}/approve`, {}, { params: { reason } }));
    this.changed();
    return r;
  }

  /** CANCELLED (approved → GL reversed) or REJECTED (pending). */
  async setStatus(uid: string, newStatus: ExpStatus, reason: string): Promise<Expenditure> {
    const r = toExp(await this.api.patch<Raw>(`${CE}/${uid}/status`, {}, { params: { newStatus, reason } }));
    this.changed();
    return r;
  }

  async dispose(uid: string, method: string, saleValue: number, reason: string): Promise<Expenditure> {
    const r = toExp(await this.api.patch<Raw>(`${CE}/${uid}/dispose`, {}, { params: { method, saleValue, reason } }));
    this.changed();
    return r;
  }

  async runDepreciation(): Promise<void> {
    await this.api.patch(`${CE}/assets/update-all-depreciation`, {});
    this.changed();
  }

  // ── Owner capital & loans ──

  async recordMovement(body: {
    injection_type: 'INJECTION' | 'WITHDRAWAL';
    source_type: string;
    amount: number;
    reason: string;
    notes?: string;
    transaction_date: string;
    payment_method: string;
  }): Promise<CapitalMovement> {
    const r = await this.api.post<CapitalMovement>(`${CM}/injections`, body);
    this.changed();
    return r;
  }

  /**
   * A loan with its terms (2.3.0): Dr receiving account principal + Dr 1150 interest / Cr 2100 total, the
   * installments, and the interest from the start date up to today. FINANCE_WRITE.
   */
  async registerLoan(body: {
    lender: string;
    notes?: string;
    principal: number;
    interestTotal: number;
    startDate: string;
    endDate: string;
    repaymentType: 'MONTHLY' | 'ONCE';
    /** Money account the loan came into; or receiveAccount '1200' when it went straight to stock. */
    paymentMethod?: string;
    receiveAccount?: '1200';
  }): Promise<Loan> {
    const r = await this.api.post<Loan>(`${CM}/loans`, body);
    this.changed();
    return r;
  }

  /**
   * A repayment reduces 2100 only (interest is spread daily from 1150, never part of a payment). The server
   * credits 1000 before the bank cut-over date and the chosen 102x bank from it on; installments are paid FIFO.
   */
  async repayLoan(uid: string, body: { amount: number; payment_method: string; transaction_date: string; notes?: string }): Promise<Loan> {
    const r = await this.api.post<Loan>(`${CM}/loans/${uid}/repay`, {
      ...body,
      principal_amount: body.amount,
      interest_amount: 0,
      reason: 'Kulipa mkopo',
    });
    this.changed();
    return r;
  }

  /** Description only, no journal: lender, notes, installment due dates. Amounts and loan dates go through corrections. */
  async updateLoanDetails(uid: string, body: { lender?: string; notes?: string; installmentDates?: Array<{ seq: number; dueDate: string }> }): Promise<Loan> {
    const r = await this.api.put<Loan>(`${CM}/loans/${uid}`, body);
    this.changed();
    return r;
  }

  /**
   * Loan → capital: Dr 2100 still owed / Cr 1150 interest not yet spread / Cr 3000 the rest; the loan closes.
   * dryRun returns that journal without writing it. FINANCE_WRITE + CAPITAL_WRITE.
   */
  async reclassifyLoan(uid: string, newSourceType: string, reason: string, dryRun: boolean): Promise<ReclassResult> {
    const r = await this.api.post<ReclassResult>(`${CM}/loans/${uid}/reclassify`, { new_source_type: newSourceType, reason, dry_run: dryRun });
    if (!dryRun) this.changed();
    return {
      ...r,
      owed: n(r.owed),
      prepaidInterest: n(r.prepaidInterest),
      equity: n(r.equity),
      lines: (r.lines ?? []).map((l) => ({ ...l, debit: n(l.debit), credit: n(l.credit) })),
    };
  }

  // ── Recurring monthly budgets (V121): a template + one approved row per month ──

  async recurringBudgets(): Promise<RecurringBudget[]> {
    return ((await this.api.get<Raw[] | null>(`${CE}/recurring-monthly`)) ?? []).map(toBudget);
  }

  /**
   * Stops future months; rows already created stay. CAPITAL_APPROVE.
   * G2: `cancelCurrentMonth` (with a reason) also removes THIS month's row and reverses its journal —
   * only offered when {@link stopPreview} answered (an older backend ignores the flag).
   */
  async stopRecurring(uid: string, cancelCurrentMonth = false, reason?: string): Promise<RecurringBudget> {
    const params: Record<string, string> = cancelCurrentMonth ? { cancelCurrentMonth: 'true', reason: reason ?? '' } : {};
    const r = toBudget(await this.api.patch<Raw>(`${CE}/recurring-monthly/${uid}/stop`, {}, { params }));
    this.all.invalidate();
    return r;
  }

  // ── Kazi 2 / G6: pay down 2400 / 2200 (Dr liability / Cr C3 source), never a new expense ──

  async liabilities(): Promise<LiabilityOverview> {
    const r = await this.api.get<Raw | null>('/api/v1/gl/liability-payments');
    const accounts = ((r?.['accounts'] as Raw[] | undefined) ?? []).map((a) => ({ code: String(a['code'] ?? ''), name: String(a['name'] ?? ''), balance: n(a['balance']) }));
    const payments = ((r?.['payments'] as Raw[] | undefined) ?? []).map((p) => ({
      uid: String(p['uid'] ?? ''),
      referenceNumber: String(p['referenceNumber'] ?? ''),
      accountCode: String(p['accountCode'] ?? ''),
      amount: n(p['amount']),
      paymentDate: String(p['paymentDate'] ?? ''),
      paymentSource: String(p['paymentSource'] ?? ''),
      sourceAccount: p['sourceAccount'] == null ? null : String(p['sourceAccount']),
      creditAccount: String(p['creditAccount'] ?? ''),
      description: String(p['description'] ?? ''),
      status: String(p['status'] ?? 'POSTED') as 'POSTED' | 'REVERSED',
      createdBy: p['createdBy'] == null ? null : String(p['createdBy']),
      reverseReason: p['reverseReason'] == null ? null : String(p['reverseReason']),
    }));
    return { accounts, payments };
  }

  /** FINANCE_WRITE. The server refuses more than the balance, a closed period and a weak description. */
  async payLiability(body: { accountCode: string; amount: number; paymentDate: string; paymentSource: string; sourceAccount: string | null; description: string }): Promise<void> {
    await this.api.post('/api/v1/gl/liability-payments', body);
  }

  async reverseLiabilityPayment(uid: string, reason: string): Promise<void> {
    await this.api.patch(`/api/v1/gl/liability-payments/${uid}/reverse`, {}, { params: { reason } });
  }

  // ── G5: annual expenses paid up front (Dr 1160 / Cr source, then 1/12 a month) ──

  async annualPrepaid(): Promise<AnnualPrepaid[]> {
    return ((await this.api.get<Raw[] | null>(`${CE}/annual-prepaid`)) ?? []).map(toPrepaid);
  }

  /** PENDING until another person approves. CAPITAL_WRITE. */
  async createAnnualPrepaid(body: {
    description: string;
    capitalType: string;
    totalAmount: number;
    startYear: number;
    startMonth: number;
    months: number;
    paymentDate: string;
    paymentMethod: string;
  }): Promise<AnnualPrepaid> {
    const r = toPrepaid(await this.api.post<Raw>(`${CE}/annual-prepaid`, body));
    this.all.invalidate();
    return r;
  }

  /** (dz) `reason` is required when a CEO approves their own entry (>= 10 letters); anyone else needs a second person. */
  async approveAnnualPrepaid(uid: string, reason?: string): Promise<AnnualPrepaid> {
    const r = toPrepaid(await this.api.patch<Raw>(`${CE}/annual-prepaid/${uid}/approve`, {}, { params: { reason: reason ?? '' } }));
    this.all.invalidate();
    return r;
  }

  async rejectAnnualPrepaid(uid: string, reason: string): Promise<AnnualPrepaid> {
    return toPrepaid(await this.api.patch<Raw>(`${CE}/annual-prepaid/${uid}/reject`, {}, { params: { reason } }));
  }

  async cancelAnnualPrepaid(uid: string, reason: string): Promise<AnnualPrepaid> {
    const r = toPrepaid(await this.api.patch<Raw>(`${CE}/annual-prepaid/${uid}/cancel`, {}, { params: { reason } }));
    this.all.invalidate();
    return r;
  }

  /**
   * G3: monthly/annual rows of that month (and running schedules) that look like the expense about to be saved.
   * A warning only; [] when nothing matches or the backend predates G3.
   */
  async possibleDuplicates(description: string, amount: number, year: number, month: number): Promise<PossibleDuplicate[]> {
    try {
      const r = await this.api.get<Raw[] | null>(`${CE}/possible-duplicates`, { params: { description, amount, year, month } });
      return (r ?? []).map((d) => ({
        uid: String(d['uid'] ?? ''),
        description: String(d['description'] ?? ''),
        amount: n(d['amount']),
        kind: String(d['kind'] ?? ''),
        period: String(d['period'] ?? ''),
        reason: String(d['reason'] ?? ''),
      }));
    } catch {
      return [];
    }
  }

  /** G2: this month's row of a schedule (amount, in the books) — null when the backend predates G2. */
  async stopPreview(uid: string): Promise<StopPreview | null> {
    try {
      const r = await this.api.get<{ futureRows?: number; currentMonth?: Raw | null } | null>(
        `${CE}/recurring-monthly/${uid}/stop-preview`,
      );
      if (!r) return null;
      const c = r.currentMonth;
      return {
        futureRows: n(r.futureRows),
        currentMonth: c ? { uid: String(c['uid'] ?? ''), month: String(c['month'] ?? ''), amount: n(c['amount']), inBooks: c['inBooks'] === true } : null,
      };
    } catch {
      return null;
    }
  }

  /** New amount for the months not yet paid. CAPITAL_WRITE. */
  async updateRecurringAmount(uid: string, amount: number): Promise<RecurringBudget> {
    const r = toBudget(await this.api.patch<Raw>(`${CE}/recurring-monthly/${uid}/amount`, {}, { params: { amount } }));
    this.all.invalidate();
    return r;
  }
}

/** Kazi 2 / G6: the expense liabilities and their payments. */
export interface LiabilityPaymentRow {
  uid: string;
  referenceNumber: string;
  accountCode: string;
  amount: number;
  paymentDate: string;
  paymentSource: string;
  sourceAccount: string | null;
  creditAccount: string;
  description: string;
  status: 'POSTED' | 'REVERSED';
  createdBy: string | null;
  reverseReason: string | null;
}

export interface LiabilityOverview {
  accounts: { code: string; name: string; balance: number }[];
  payments: LiabilityPaymentRow[];
}

/** G5: an annual expense paid up front and its months. */
export interface AnnualPrepaid {
  uid: string;
  referenceNumber: string;
  description: string;
  capitalType: string;
  totalAmount: number;
  startYear: number;
  startMonth: number;
  months: number;
  paymentDate: string;
  paymentMethod: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
  createdBy: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
  /** (dz) the maker (a CEO) approved it themself, with approvalReason */
  selfApproved: boolean;
  approvalReason: string | null;
  closeReason: string | null;
  monthRows: { month: string; amount: number; inBooks: boolean }[];
  expensed: number;
  prepaidLeft: number;
}

function toPrepaid(r: Raw): AnnualPrepaid {
  const s = (k: string) => (r[k] == null ? null : String(r[k]));
  return {
    uid: String(r['uid'] ?? ''),
    referenceNumber: String(r['referenceNumber'] ?? ''),
    description: String(r['description'] ?? ''),
    capitalType: String(r['capitalType'] ?? ''),
    totalAmount: n(r['totalAmount']),
    startYear: n(r['startYear']),
    startMonth: n(r['startMonth']),
    months: n(r['months']),
    paymentDate: String(r['paymentDate'] ?? ''),
    paymentMethod: String(r['paymentMethod'] ?? ''),
    status: (s('status') ?? 'PENDING') as AnnualPrepaid['status'],
    createdBy: s('createdBy'),
    approvedBy: s('approvedBy'),
    approvedAt: s('approvedAt'),
    selfApproved: r['selfApproved'] === true,
    approvalReason: s('approvalReason'),
    closeReason: s('closeReason'),
    monthRows: ((r['monthRows'] as Raw[] | undefined) ?? []).map((m) => ({ month: String(m['month'] ?? ''), amount: n(m['amount']), inBooks: m['inBooks'] === true })),
    expensed: n(r['expensed']),
    prepaidLeft: n(r['prepaidLeft']),
  };
}

/** Monthly amounts as the backend splits them: total/months to the cent, the last month takes the rest. */
export function splitAnnual(total: number, months: number): number[] {
  if (!(total > 0) || !(months > 0)) return [];
  const each = Math.round((total / months) * 100) / 100;
  const out = Array.from({ length: months - 1 }, () => each);
  out.push(Math.round((total - each * (months - 1)) * 100) / 100);
  return out;
}

/** G3: an existing expense that looks like the new one. */
export interface PossibleDuplicate {
  uid: string;
  description: string;
  amount: number;
  kind: string; // SCHEDULE | MONTH | ANNUAL
  period: string;
  reason: string; // NAME | AMOUNT | NAME_AND_AMOUNT
}

/** G2: what stopping a schedule would touch. */
export interface StopPreview {
  futureRows: number;
  currentMonth: { uid: string; month: string; amount: number; inBooks: boolean } | null;
}

export interface RecurringBudget {
  uid: string;
  description: string;
  capitalType: string;
  /** Per month — the template's own `amount` is 0 on purpose. */
  monthly: number;
  active: boolean;
  summary: string | null;
  monthsCreated: number | null;
  endDate: string | null;
  startedOn: string | null;
}

function toBudget(r: Raw): RecurringBudget {
  return {
    uid: String(r['uid'] ?? ''),
    description: String(r['description'] ?? ''),
    capitalType: String(r['capitalType'] ?? ''),
    monthly: n(r['monthlyAllocationAmount'] ?? r['amount']),
    active: r['recurringActive'] !== false,
    summary: (r['recurringSummary'] as string) ?? null,
    monthsCreated: r['materializedMonthsCount'] == null ? null : Number(r['materializedMonthsCount']),
    endDate: (r['recurringEndDate'] as string) ?? null,
    startedOn: (r['transactionDate'] as string) ?? null,
  };
}
