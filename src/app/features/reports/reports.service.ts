import { Injectable, inject } from '@angular/core';

import { ApiService } from '@core/api/api.service';
import { CachedResource } from '@core/data/cached-resource';
import { toIsoDate } from '@shared/utils/date-utils';
import { GlService } from '../general-ledger/gl.service';
import { IncomeStatement } from '../general-ledger/gl.models';
import { SalesService } from '../sales/sales.service';
import { AgingKey, ArCustomer, ArInvoice, DailyPnl, DeletedDebt, PnlDay } from './reports.models';

type Raw = Record<string, unknown>;
const num = (v: unknown) => (v === null || v === undefined || v === '' ? 0 : Number(v) || 0);
const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);

export interface MonthPnl {
  /** yyyy-MM */
  month: string;
  start: string;
  end: string;
  statement: IncomeStatement;
}

/** Report-only data; everything else comes from the module services' shared caches. */
@Injectable({ providedIn: 'root' })
export class ReportsService {
  private readonly api = inject(ApiService);
  private readonly gl = inject(GlService);
  private readonly sales = inject(SalesService);

  /** GL income statement for each of the last `months` calendar months (current month to date). */
  async monthlyPnl(months: number, today = new Date()): Promise<MonthPnl[]> {
    const list: { month: string; start: string; end: string }[] = [];
    for (let i = months - 1; i >= 0; i--) {
      const first = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const last = i === 0 ? today : new Date(first.getFullYear(), first.getMonth() + 1, 0);
      list.push({ month: toIsoDate(first).slice(0, 7), start: toIsoDate(first), end: toIsoDate(last) });
    }
    const statements = await Promise.all(list.map((m) => this.gl.incomeStatement(m.start, m.end)));
    return list.map((m, i) => ({ ...m, statement: statements[i] }));
  }

  /** Postings dated after today (pre-approved expenses etc.) — they are left out of the report periods. */
  async futurePostings(today = new Date()): Promise<IncomeStatement> {
    const from = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
    const to = new Date(today.getFullYear() + 2, today.getMonth(), today.getDate());
    return this.gl.incomeStatement(toIsoDate(from), toIsoDate(to));
  }

  /**
   * Day-by-day profit with the cash view (GET /api/reports/daily-pnl, SALES_ANALYTICS).
   * Built server-side from the registers, not the GL — see DailyPnlService.
   */
  async dailyPnl(from: string, to: string): Promise<DailyPnl> {
    const r = await this.api.get<Raw>('/api/reports/daily-pnl', { params: { from, to } });
    const day = (d: Raw): PnlDay => ({
      date: String(d['date'] ?? ''),
      revenue: num(d['revenue']),
      cogs: num(d['cogs']),
      grossProfit: num(d['grossProfit']),
      dailyExpenses: num(d['dailyExpenses']),
      monthlyExpenses: num(d['monthlyExpenses']),
      depreciation: num(d['depreciation']),
      stockLoss: num(d['stockLoss']),
      netProfit: num(d['netProfit']),
      debtIssuedPos: num(d['debtIssuedPos']),
      debtIssuedWalkIn: num(d['debtIssuedWalkIn']),
      debtCollected: num(d['debtCollected']),
      debtAdjusted: num(d['debtAdjusted']),
      stillOwed: num(d['stillOwed']),
      stillOwedWalkIn: num(d['stillOwedWalkIn']),
      marginInStillOwed: num(d['marginInStillOwed']),
      marginInStillOwedEstimated: num(d['marginInStillOwedEstimated']),
      collectedProfit: num(d['collectedProfit']),
    });
    const t = (r['totals'] ?? {}) as Raw;
    const list = (v: unknown) => (Array.isArray(v) ? (v as Raw[]) : []);
    return {
      from: String(r['from'] ?? from),
      to: String(r['to'] ?? to),
      asOf: String(r['asOf'] ?? ''),
      walkInMarginEstimated: r['walkInMarginEstimated'] !== false,
      days: list(r['days']).map(day),
      totals: {
        ...day({ ...t, date: '' }),
        days: num(t['days']),
        grossMarginPct: num(t['grossMarginPct']),
        arOpening: num(t['arOpening']),
        arClosing: num(t['arClosing']),
        arClosingWalkIn: num(t['arClosingWalkIn']),
        arNow: num(t['arNow']),
        stockOpening: num(t['stockOpening']),
        stockClosing: num(t['stockClosing']),
        stockChange: num(t['stockChange']),
        operatingCashFlow: num(t['operatingCashFlow']),
      },
      months: list(r['months']).map((m) => ({
        month: String(m['month'] ?? ''),
        revenue: num(m['revenue']),
        grossProfit: num(m['grossProfit']),
        grossMarginPct: num(m['grossMarginPct']),
        monthlyExpenses: num(m['monthlyExpenses']),
        depreciation: num(m['depreciation']),
        daysInMonth: num(m['daysInMonth']),
      })),
      monthlyItems: list(r['monthlyItems']).map((i) => ({
        month: String(i['month'] ?? ''),
        description: str(i['description']) ?? '—',
        amount: num(i['amount']),
        allYear: i['allYear'] === true,
      })),
      warnings: list(r['warnings']).map((w) => ({
        code: String(w['code'] ?? ''),
        count: num(w['count']),
        amount: w['amount'] === null || w['amount'] === undefined ? null : num(w['amount']),
        message: str(w['message']) ?? '',
      })),
    };
  }

  readonly arInvoices = new CachedResource<ArInvoice[]>(async () => {
    const rows = (await this.api.get<Raw[] | null>('/api/reports/ar')) ?? [];
    return rows.map(toInvoice).sort((a, b) => b.daysOutstanding - a.daysOutstanding);
  }, 60_000);

  readonly arCustomers = new CachedResource<ArCustomer[]>(async () => {
    const rows = (await this.api.get<Raw[] | null>('/api/reports/ar/summary')) ?? [];
    return rows.map(toArCustomer).sort((a, b) => b.total - a.total);
  }, 60_000);

  /**
   * Deleted sales that still carried a debt — GET /api/reports/deleted-debts
   * (covers SaleService deletions and both Reconciliation delete paths, with the
   * owed amount at deletion). Seller and, where the audit trail has none, the
   * reason come from the deletion note on the deleted-sales register
   * ("SALE DELETED - Deleted on: …, By: …, Reason: …").
   */
  async deletedDebts(): Promise<DeletedDebt[]> {
    const [rows, sales] = await Promise.all([
      this.api.get<Raw[] | null>('/api/reports/deleted-debts'),
      this.sales.deleted().catch(() => []),
    ]);
    const bySale = new Map(sales.map((s) => [s.uid, s]));
    return (rows ?? []).map((r) => {
      const uid = String(r['saleUid'] ?? '');
      const sale = bySale.get(uid);
      const note = parseDeletionNote(sale?.notes ?? '');
      const by = str(r['deletedByName']) ?? note.by;
      return {
        saleUid: uid,
        receiptNumber: str(r['receiptNumber']) ?? sale?.receiptNumber ?? '—',
        saleDate: str(r['saleDate']) ?? sale?.saleDate ?? null,
        deletedAt: str(r['deletedAt']) ?? note.deletedAt,
        customerName: str(r['customerName']) ?? sale?.customerName ?? 'Walk-in',
        seller: sale?.seller ?? null,
        total: num(r['totalAmount']),
        debt: num(r['outstandingAtDeletion']),
        deletedBy: by,
        reason: str(r['reason']) ?? note.reason,
        untraced: !by || by.toLowerCase() === 'system',
      };
    });
  }
}

function bucketOf(v: unknown, days: number): AgingKey {
  const s = String(v ?? '');
  if (s === '0-30' || s === '31-60' || s === '61-90' || s === '90+') return s;
  return days > 90 ? '90+' : days > 60 ? '61-90' : days > 30 ? '31-60' : '0-30';
}

function toInvoice(r: Raw): ArInvoice {
  const days = num(r['daysOutstanding']);
  return {
    saleUid: String(r['saleUid'] ?? ''),
    receiptNumber: str(r['receiptNumber']) ?? '—',
    saleDate: str(r['saleDate']),
    dueDate: str(r['dueDate']),
    customerUid: str(r['customerUid']),
    customerName: str(r['customerName']) ?? 'Walk-in',
    customerPhone: str(r['customerPhone']),
    totalAmount: num(r['totalAmount']),
    outstanding: num(r['outstandingBalance']),
    paymentStatus: str(r['paymentStatus']),
    daysOutstanding: days,
    bucket: bucketOf(r['agingBucket'], days),
  };
}

function toArCustomer(r: Raw): ArCustomer {
  return {
    customerUid: str(r['customerUid']),
    customerName: str(r['customerName']) ?? 'Walk-in',
    customerPhone: str(r['customerPhone']),
    invoiceCount: num(r['invoiceCount']),
    total: num(r['totalOutstanding']),
    b0: num(r['bucket0To30']),
    b31: num(r['bucket31To60']),
    b61: num(r['bucket61To90']),
    b90: num(r['bucket90Plus']),
    maxDays: num(r['maxDaysOutstanding']),
  };
}

const money = (s: string | undefined) => (s === undefined ? null : Number(s.replaceAll(',', '')) || 0);

/** Pulls the fields out of the backend's "SALE DELETED - …" note (last deletion wins). */
export function parseDeletionNote(notes: string): { deletedAt: string | null; by: string | null; reason: string | null; originalTotal: number | null; paymentsReversed: number | null } {
  const line = notes.split('\n').find((l) => l.includes('SALE DELETED')) ?? '';
  const pick = (re: RegExp) => line.match(re)?.[1]?.trim();
  return {
    deletedAt: pick(/Deleted on:\s*([^,]+)/) ?? null,
    by: pick(/By:\s*([^,]+)/) ?? null,
    reason: pick(/Reason:\s*(.*?),\s*Original Total:/) ?? null,
    originalTotal: money(pick(/Original Total:\s*([\d,.]+)/)),
    paymentsReversed: money(pick(/Payments Reversed:\s*([\d,.]+)/)),
  };
}
