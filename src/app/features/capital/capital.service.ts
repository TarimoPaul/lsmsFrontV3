import { Injectable, inject } from '@angular/core';

import { ApiService } from '@core/api/api.service';
import { CachedResource } from '@core/data/cached-resource';
import { GlService } from '../general-ledger/gl.service';
import { CapitalMovement, Expenditure, ExpStatus, Loan, LoanCard, n } from './capital.models';

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

  async reclassifyLoan(uid: string, newSourceType: string, reason: string): Promise<Loan> {
    const r = await this.api.post<Loan>(`${CM}/loans/${uid}/reclassify`, { new_source_type: newSourceType, reason });
    this.changed();
    return r;
  }

  // ── Recurring monthly budgets (V121): a template + one approved row per month ──

  async recurringBudgets(): Promise<RecurringBudget[]> {
    return ((await this.api.get<Raw[] | null>(`${CE}/recurring-monthly`)) ?? []).map(toBudget);
  }

  /** Stops future months; rows already created stay. CAPITAL_APPROVE. */
  async stopRecurring(uid: string): Promise<RecurringBudget> {
    const r = toBudget(await this.api.patch<Raw>(`${CE}/recurring-monthly/${uid}/stop`));
    this.all.invalidate();
    return r;
  }

  /** New amount for the months not yet paid. CAPITAL_WRITE. */
  async updateRecurringAmount(uid: string, amount: number): Promise<RecurringBudget> {
    const r = toBudget(await this.api.patch<Raw>(`${CE}/recurring-monthly/${uid}/amount`, {}, { params: { amount } }));
    this.all.invalidate();
    return r;
  }
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
