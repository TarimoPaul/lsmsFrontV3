import { Injectable, inject } from '@angular/core';

import { ApiService } from '@core/api/api.service';
import { CachedResource } from '@core/data/cached-resource';
import { toLocalDateTime } from '@shared/utils/date-utils';
import { DEFAULT_PAYMENT_METHODS, PosProduct, ReturnCheck, ReturnType, SalesReturn, normalizeReturn, Sale, SaleRequest, SalesSummary, StockIssue, normalizePosProduct, normalizeSale, normalizeSummary } from './sales.models';

const BASE = '/api/v1/sales';
type Raw = Record<string, unknown>;

/**
 * Sales API (Spring `SalesController`).
 *
 * Lists: `GET /sales?startDate&endDate` (no `activeOnly` — that flag makes the
 * backend ignore the dates and page through everything) returns the whole
 * window unpaged with lines + payments embedded, deleted sales excluded.
 * KPIs / hourly charts come from `analytics/dashboard-summary`.
 */
@Injectable({ providedIn: 'root' })
export class SalesService {
  private readonly api = inject(ApiService);

  /** Payment methods offered at the till (backend list, falls back to Flutter's defaults). */
  readonly paymentMethods = new CachedResource<string[]>(async () => {
    try {
      const list = await this.api.get<unknown[]>('/api/v1/payments/available-payment-methods');
      const clean = (list ?? []).map((m) => String(m).trim().toUpperCase()).filter(Boolean);
      return clean.length ? clean : DEFAULT_PAYMENT_METHODS;
    } catch {
      return DEFAULT_PAYMENT_METHODS;
    }
  }, 30 * 60_000);

  /** What the till can sell: products with stock + all four price points (126 rows, ~0.1s). */
  readonly posStock = new CachedResource<PosProduct[]>(async () => {
    const rows = await this.api.get<Raw[] | null>('/api/store/display/stock/available');
    return (rows ?? []).map(normalizePosProduct).sort((a, b) => a.name.localeCompare(b.name));
  }, 30_000);

  async list(start: string, end: string): Promise<Sale[]> {
    const rows = await this.api.get<Raw[] | null>(BASE, { params: { startDate: start, endDate: end } });
    return (rows ?? []).map(normalizeSale).sort((a, b) => (b.saleDate ?? '').localeCompare(a.saleDate ?? ''));
  }

  async summary(start: string, end: string, includeHourly = true): Promise<SalesSummary> {
    return normalizeSummary(await this.api.get<Raw>(`${BASE}/analytics/dashboard-summary`, { params: { startDate: start, endDate: end, includeHourly } }));
  }

  async get(uid: string): Promise<Sale> {
    return normalizeSale(await this.api.get<Raw>(`${BASE}/${uid}`));
  }

  async byCustomer(customerUid: string): Promise<Sale[]> {
    const rows = await this.api.get<Raw[] | null>(`${BASE}/customer/${customerUid}`);
    return (rows ?? []).map(normalizeSale).sort((a, b) => (b.saleDate ?? '').localeCompare(a.saleDate ?? ''));
  }

  /**
   * Record money received against a sale's balance. In this flow the backend
   * reads `totalAmount` as the cash received now. Posts to the GL.
   */
  async addPayment(saleUid: string, amount: number, method: string, reference?: string | null, notes?: string | null): Promise<Sale> {
    const body = {
      saleUid,
      paymentMethod: method,
      totalAmount: amount,
      amountPaid: amount,
      paymentDate: toLocalDateTime(),
      transactionReference: reference || null,
      paymentNotes: notes || null,
    };
    return normalizeSale(await this.api.post<Raw>(`${BASE}/${saleUid}/payments`, body));
  }

  /** Days (up to `lookback`, before today) on which no sale was recorded. */
  async missingDays(lookback = 7): Promise<string[]> {
    try {
      const d = await this.api.get<Raw>(`${BASE}/analytics/missing-days`, { params: { lookbackDays: lookback } });
      return ((d['missingDates'] as string[]) ?? []).slice().sort();
    } catch {
      return [];
    }
  }

  /** Dry-run stock check of the cart — nothing is written. */
  async preValidate(body: SaleRequest): Promise<{ issues: StockIssue[]; validCount: number }> {
    const d = await this.api.post<Raw>(`${BASE}/pre-validate`, body);
    const issues = ((d['invalidItems'] as Raw[]) ?? []).map((i) => ({
      productUid: String(i['productUid'] ?? ''),
      productName: String(i['productName'] ?? ''),
      reason: String(i['reason'] ?? ''),
      available: i['availableStock'] === null || i['availableStock'] === undefined ? null : Number(i['availableStock']),
    }));
    return { issues, validCount: Number(d['validCount'] ?? 0) || 0 };
  }

  /**
   * Save a sale; items that fail (stock) are skipped and reported instead of
   * failing the whole sale. The payment travels with the sale (one transaction).
   */
  async createPartial(body: SaleRequest): Promise<{ sale: Sale | null; failed: StockIssue[]; message: string | null }> {
    const res = await this.api.postResult<Raw>(`${BASE}/partial`, body);
    const d = res.data ?? {};
    const failed = ((d['failedItems'] as Raw[]) ?? []).map((i) => ({
      productUid: String(i['productUid'] ?? ''),
      productName: String(i['productName'] ?? ''),
      reason: String(i['reason'] ?? ''),
      available: i['availableStock'] === null || i['availableStock'] === undefined ? null : Number(i['availableStock']),
      saleType: (i['saleType'] as string) ?? null,
    }));
    return { sale: d['sale'] ? normalizeSale(d['sale'] as Raw) : null, failed, message: res.message };
  }

  // ── Returns ──────────────────────────────────────────────────────────────
  async returns(status?: string): Promise<SalesReturn[]> {
    const rows = await this.api.get<Raw[] | null>(`${BASE}/returns`, { params: { status: status || undefined } });
    return (rows ?? []).map(normalizeReturn).sort((a, b) => (b.requestedAt ?? '').localeCompare(a.requestedAt ?? ''));
  }

  async returnByUid(uid: string): Promise<SalesReturn> {
    return normalizeReturn(await this.api.get<Raw>(`${BASE}/returns/${uid}`));
  }

  /** Can this sale be returned (30-day window, stock, refund)? Read-only. */
  async checkReturn(saleUid: string): Promise<ReturnCheck> {
    const env = await this.api.getEnvelope<Raw>(`${BASE}/${saleUid}/validate-return`);
    const d = env.data ?? {};
    return {
      valid: d['valid'] === true || d['isValid'] === true,
      errors: ((d['validationErrors'] as string[]) ?? []).filter(Boolean),
      warnings: ((d['warnings'] as string[]) ?? []).filter(Boolean),
      daysFromSale: d['daysFromSale'] === null || d['daysFromSale'] === undefined ? null : Number(d['daysFromSale']),
      withinWindow: d['withinReturnWindow'] !== false,
      estimatedRefund: d['estimatedRefund'] === null || d['estimatedRefund'] === undefined ? null : Number(d['estimatedRefund']),
    };
  }

  /** Request a return (PENDING until approved; approval restocks and refunds). */
  async createReturn(body: { saleUid: string; returnType: ReturnType; returnReason: string; customerComments: string | null; returnItems: Array<{ productUid: string; quantity: number; reason: string | null; unitPrice: number }> }): Promise<SalesReturn> {
    return normalizeReturn(await this.api.post<Raw>(`${BASE}/returns`, { ...body, returnRequestDate: toLocalDateTime() }));
  }

  async approveReturn(uid: string, notes: string | null): Promise<SalesReturn> {
    return normalizeReturn(await this.api.post<Raw>(`${BASE}/returns/${uid}/approve`, { approvalNotes: notes, approvalDate: toLocalDateTime() }));
  }

  async rejectReturn(uid: string, reason: string): Promise<SalesReturn> {
    return normalizeReturn(await this.api.post<Raw>(`${BASE}/returns/${uid}/reject`, { rejectionReason: reason, rejectionDate: toLocalDateTime() }));
  }

  // ── Editing (each call re-posts stock / GL on the server) ──────────────────
  async updateLine(detailUid: string, body: Record<string, unknown>): Promise<void> {
    await this.api.put(`${BASE}/details/${detailUid}`, body);
  }

  async removeLine(detailUid: string): Promise<void> {
    await this.api.delete(`${BASE}/details/${detailUid}`);
  }

  /** Sale-level fields only (customer, discount, notes, date) — lines are edited above. */
  async updateSale(uid: string, body: Record<string, unknown>): Promise<Sale> {
    return normalizeSale(await this.api.put<Raw>(`${BASE}/${uid}`, body));
  }

  async deleted(): Promise<Sale[]> {
    const rows = await this.api.get<Raw[] | null>(`${BASE}/deleted`);
    return (rows ?? []).map(normalizeSale).sort((a, b) => (b.saleDate ?? '').localeCompare(a.saleDate ?? ''));
  }

  async restore(uid: string): Promise<void> {
    await this.api.post(`${BASE}/${uid}/restore`, {});
  }

  /** Soft delete (restorable from the deleted list); stock is returned by the backend. */
  async remove(uid: string): Promise<void> {
    await this.api.delete(`${BASE}/${uid}`);
  }
}
