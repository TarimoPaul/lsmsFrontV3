import { Injectable, inject } from '@angular/core';

import { ApiService } from '@core/api/api.service';
import { PageResult } from '@core/api/api.types';
import { CachedList, CachedResource } from '@core/data/cached-resource';
import {
  AuditEntry,
  Customer,
  CustomerAnalytics,
  CustomerRequest,
  CustomerStatement,
  PurchaseRecord,
  DebtPayment,
  DebtPaymentQuery,
  DebtPaymentSummary,
  ReconState,
  normalizeCustomer,
} from './customers.models';

const BASE = '/api/v1/customers';
type Raw = Record<string, unknown>;
const num = (v: unknown) => Number(v ?? 0) || 0;

const debtPaymentParams = (q: DebtPaymentQuery) => ({
  from: q.from ?? undefined,
  search: q.search.trim() || undefined,
  receivedBy: q.receivedBy ?? undefined,
  reconState: q.reconState ?? undefined,
});

/**
 * Customer API (Spring `CustomerController`): CUSTOMER_READ / WRITE / UPDATE
 * / DELETE, CUSTOMER_CREDIT_VIEW (statement, debt payments), CUSTOMER_ANALYTICS
 * (analytics, purchase history, activity, audit), CUSTOMER_MERGE.
 *
 * GET /customers returns every customer with sales count, total spent and
 * balance, so one cached request drives the list, KPIs and all filters —
 * Flutter made a separate request per tab (all / recent / top / no-sales).
 */
@Injectable({ providedIn: 'root' })
export class CustomersService {
  private readonly api = inject(ApiService);

  readonly list = new CachedList<Customer>(async () => {
    const rows = await this.api.get<Raw[] | null>(BASE);
    return (rows ?? []).map(normalizeCustomer).sort(byName);
  }, 2 * 60_000);

  /**
   * uid → date of the customer's newest still-owing sale. Only GET
   * /customers/unpaid/paged fills `mostRecentUnpaidDate` (the full list sends
   * null), and Flutter orders the Owing list by it. Loaded on demand;
   * CUSTOMER_CREDIT_VIEW only (empty map without it).
   */
  readonly unpaidSince = new CachedResource<Map<string, string>>(async () => {
    const map = new Map<string, string>();
    for (let page = 1, pages = 1; page <= pages && page <= 20; page++) {
      const res = await this.api.getPage<Raw>(`${BASE}/unpaid/paged`, { params: { page, size: 200 } });
      for (const c of res.items) if (c['uid'] && typeof c['mostRecentUnpaidDate'] === 'string') map.set(String(c['uid']), c['mostRecentUnpaidDate']);
      pages = res.pages;
    }
    return map;
  }, 2 * 60_000);

  /** After a payment / adjustment: balances and unpaid dates both moved. */
  invalidateBalances(): void {
    this.list.invalidate();
    this.unpaidSince.invalidate();
  }

  /**
   * Note: when the phone already exists the backend returns the EXISTING
   * customer with status Success ("Mteja tayari yupo") instead of an error.
   */
  async create(body: CustomerRequest): Promise<{ customer: Customer; existed: boolean; message: string | null }> {
    const known = new Set((this.list.value() ?? []).map((c) => c.uid));
    const res = await this.api.postResult<Raw>(BASE, body);
    const customer = normalizeCustomer(res.data);
    const existed = known.has(customer.uid) || /tayari yupo|already exists/i.test(res.message ?? '');
    if (!known.has(customer.uid)) this.list.update((l) => [...l, customer].sort(byName));
    return { customer, existed, message: res.message };
  }

  async update(uid: string, body: CustomerRequest): Promise<Customer> {
    const prev = this.list.value()?.find((c) => c.uid === uid);
    const fresh = normalizeCustomer(await this.api.put<Raw>(`${BASE}/${uid}`, body));
    // The update response lacks sales totals — keep the known ones.
    const saved: Customer = prev ? { ...fresh, salesCount: prev.salesCount, totalSpent: prev.totalSpent, outstandingBalance: prev.outstandingBalance } : fresh;
    this.list.update((l) => l.map((c) => (c.uid === uid ? saved : c)).sort(byName));
    return saved;
  }

  /** Hard delete; refused by the backend when the customer has sales. */
  async remove(uid: string): Promise<void> {
    await this.api.delete(`${BASE}/${uid}`);
    this.list.remove(uid);
  }

  /** Moves the source's sales / payments to the target and removes the source. */
  async merge(sourceUid: string, targetUid: string, reason: string): Promise<void> {
    await this.api.post(`${BASE}/merge`, {}, { params: { sourceUid, targetUid, reason } });
    this.list.invalidate();
    await this.list.load().catch(() => undefined);
  }

  async statement(uid: string): Promise<CustomerStatement> {
    const d = await this.api.get<Raw>(`${BASE}/${uid}/statement`);
    return {
      totalInvoiced: num(d['totalInvoiced']),
      totalPaid: num(d['totalPaid']),
      totalReturned: num(d['totalReturned']),
      outstandingBalance: num(d['outstandingBalance']),
      overdueAmount: num(d['overdueAmount']),
      totalInvoices: num(d['totalInvoices']),
      unpaidInvoices: num(d['unpaidInvoices']),
      aging0to30: num(d['aging0to30']),
      aging31to60: num(d['aging31to60']),
      aging61to90: num(d['aging61to90']),
      aging90plus: num(d['aging90plus']),
      oldestUnpaidAgeDays: num(d['oldestUnpaidAgeDays']),
      entries: ((d['entries'] as Raw[]) ?? []).map((e) => ({
        date: (e['date'] as string) ?? null,
        type: String(e['type'] ?? 'INVOICE'),
        reference: (e['reference'] as string) ?? null,
        saleUid: (e['saleUid'] as string) ?? null,
        debit: num(e['debit']),
        credit: num(e['credit']),
        runningBalance: num(e['runningBalance']),
        paymentMethod: (e['paymentMethod'] as string) ?? null,
        dueDate: (e['dueDate'] as string) ?? null,
        overdue: e['overdue'] === true,
        receivedByName: (e['receivedByName'] as string) ?? null,
      })),
    };
  }

  async analytics(uid: string): Promise<CustomerAnalytics> {
    const d = await this.api.get<Raw>(`${BASE}/${uid}/sales-analytics`);
    return {
      totalSaleCount: num(d['totalSaleCount']),
      totalRevenue: num(d['totalRevenue']),
      totalProfit: num(d['totalProfit']),
      averageOrderValue: num(d['averageOrderValue']),
      daysSinceLastPurchase: d['daysSinceLastPurchase'] === null ? null : num(d['daysSinceLastPurchase']),
      purchaseFrequencyDays: d['purchaseFrequencyDays'] === null ? null : num(d['purchaseFrequencyDays']),
      distinctProductCount: num(d['distinctProductCount']),
      repeatCustomer: d['repeatCustomer'] === true,
      atRiskOfChurning: d['atRiskOfChurning'] === true,
      fullPaymentPercentage: num(d['fullPaymentPercentage']),
      lastPurchaseDate: (d['lastPurchaseDate'] as string) ?? null,
      firstPurchaseDate: (d['firstPurchaseDate'] as string) ?? null,
    };
  }

  async purchases(uid: string): Promise<PurchaseRecord[]> {
    const d = await this.api.get<Raw>(`${BASE}/${uid}/purchase-history`);
    return ((d['purchaseRecords'] as Raw[]) ?? []).map((r) => ({
      saleUid: String(r['saleUid'] ?? ''),
      receiptNumber: String(r['receiptNumber'] ?? ''),
      purchaseDate: (r['purchaseDate'] as string) ?? null,
      totalAmount: num(r['totalAmount']),
      paymentStatus: String(r['paymentStatus'] ?? ''),
      outstandingBalance: num(r['outstandingBalance']),
      amountPaid: num(r['amountPaid']),
      items: num(r['items']),
    }));
  }

  async auditLog(uid: string): Promise<AuditEntry[]> {
    const rows = await this.api.get<Raw[] | null>(`${BASE}/${uid}/audit-log`);
    return (rows ?? []).map((a) => ({
      action: String(a['action'] ?? ''),
      details: (a['details'] as string) ?? null,
      performedBy: (a['actorName'] as string) ?? null,
      timestamp: (a['createdAt'] as string) ?? null,
    }));
  }

  /** Debt-payment events (partial or final), newest first, with their reconciliation status (server-paged, 1-based). */
  async debtPayments(page: number, size: number, q: DebtPaymentQuery): Promise<PageResult<DebtPayment>> {
    const res = await this.api.getPage<Raw>(`${BASE}/debt-payments`, { params: { page, size, ...debtPaymentParams(q) } });
    const str = (r: Raw, k: string) => (r[k] as string) ?? null;
    return {
      ...res,
      items: res.items.map((r) => ({
        paymentUid: String(r['paymentUid'] ?? ''),
        paymentDate: str(r, 'paymentDate'),
        amount: num(r['amount']),
        paymentMethod: str(r, 'paymentMethod'),
        receivedByUid: str(r, 'receivedByUid'),
        receivedByName: str(r, 'receivedByName'),
        saleUid: str(r, 'saleUid'),
        receiptNumber: str(r, 'receiptNumber'),
        saleDate: str(r, 'saleDate'),
        saleTotal: num(r['saleTotal']),
        customerUid: str(r, 'customerUid'),
        customerName: String(r['customerName'] ?? '—'),
        customerPhone: str(r, 'customerPhone'),
        reconState: (r['reconState'] as ReconState) ?? 'NONE',
        reconUid: str(r, 'reconUid'),
        reconDate: str(r, 'reconDate'),
        reconStatus: str(r, 'reconStatus'),
        reconOwnerName: str(r, 'reconOwnerName'),
        approvedByName: str(r, 'approvedByName'),
        approvedAt: str(r, 'approvedAt'),
        verified: (r['verified'] as boolean) ?? null,
      })),
    };
  }

  /** Totals over the same filters + everyone who has received a debt payment. */
  async debtPaymentSummary(q: DebtPaymentQuery): Promise<DebtPaymentSummary> {
    const r = (await this.api.get<Raw | null>(`${BASE}/debt-payments/summary`, { params: debtPaymentParams(q) })) ?? {};
    return {
      count: num(r['count']),
      totalAmount: num(r['totalAmount']),
      approvedAmount: num(r['approvedAmount']),
      pendingAmount: num(r['pendingAmount']),
      notInReconAmount: num(r['notInReconAmount']),
      notInReconCount: num(r['notInReconCount']),
      customers: num(r['customers']),
      receivers: ((r['receivers'] as Array<{ uid: string; name: string }>) ?? []).filter((x) => x.uid),
    };
  }
}

function byName(a: Customer, b: Customer): number {
  return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
}
