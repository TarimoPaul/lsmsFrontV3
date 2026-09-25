import { Injectable, inject } from '@angular/core';

import { ApiService } from '@core/api/api.service';
import { CachedList } from '@core/data/cached-resource';
import {
  BulkAction,
  Eligibility,
  EligibilityStatus,
  PriceInputMode,
  Purchase,
  PurchaseRequest,
  PurchaseStatus,
  RepurchasableProduct,
  RepurchaseInvoice,
  RepurchaseLine,
  RepurchaseTemplate,
  normalizePurchase,
  normalizeRepurchasable,
} from './purchases.models';

const BASE = '/api/v1/purchases';
type Raw = Record<string, unknown>;
const numOrNull = (v: unknown) => (v === null || v === undefined || v === '' ? null : Number(v));

/**
 * Purchase API (Spring `PurchaseController`). Workflow:
 * PENDING (edit / delete) → APPROVED (stock is posted) → RECEIVED (closes the
 * line, supplier owes appear on the statement); PENDING or APPROVED can be
 * CANCELLED (approved stock is reversed).
 *
 * A product that was ever received must be bought again through the
 * repurchase endpoints (see Repurchase); only new products use plain create. The backend's
 * text search endpoints fail ("Transaction was rolled back"), so lists are
 * paged / date-ranged and searched client-side.
 */
@Injectable({ providedIn: 'root' })
export class PurchasesService {
  private readonly api = inject(ApiService);

  /** Products that can be bought again (have a pending / approved / received purchase). */
  readonly repurchasable = new CachedList<RepurchasableProduct>(async () => {
    const rows = await this.api.get<Raw[] | null>(`${BASE}/repurchase/products`);
    return (rows ?? []).map(normalizeRepurchasable).sort((a, b) => a.name.localeCompare(b.name));
  }, 5 * 60_000);

  /** Newest first, 0-based page. */
  async page(page: number, size: number): Promise<{ items: Purchase[]; total: number; pages: number }> {
    const res = await this.api.getPage<Raw>(BASE, { params: { page, size } });
    return { items: res.items.map(normalizePurchase), total: res.total, pages: res.pages };
  }

  async byDateRange(start: string, end: string): Promise<Purchase[]> {
    const rows = await this.api.get<Raw[] | null>(`${BASE}/date-range`, { params: { startDate: start, endDate: end } });
    return (rows ?? []).map(normalizePurchase).sort((a, b) => (b.purchaseDate ?? '').localeCompare(a.purchaseDate ?? ''));
  }

  async byStatus(status: PurchaseStatus): Promise<Purchase[]> {
    const rows = await this.api.get<Raw[] | null>(`${BASE}/status/${status}`);
    return (rows ?? []).map(normalizePurchase);
  }

  async byProduct(productUid: string): Promise<Purchase[]> {
    const rows = await this.api.get<Raw[] | null>(`${BASE}/product/${productUid}`);
    return (rows ?? []).map(normalizePurchase).sort((a, b) => (b.purchaseDate ?? '').localeCompare(a.purchaseDate ?? ''));
  }

  async get(uid: string): Promise<Purchase> {
    return normalizePurchase(await this.api.get<Raw>(`${BASE}/${uid}`));
  }

  /** Answers with status "Warning" (not an error) when the product cannot be bought normally. */
  async eligibility(productUid: string): Promise<Eligibility> {
    const env = await this.api.getEnvelope<Raw>(`${BASE}/product/${productUid}/eligibility`);
    const d = env.data ?? {};
    return {
      status: (d['status'] as EligibilityStatus) ?? 'ELIGIBLE',
      message: String(d['message'] ?? env.message ?? ''),
      existingPurchaseUid: (d['existingPurchaseUid'] as string) ?? null,
    };
  }

  async template(productUid: string): Promise<RepurchaseTemplate> {
    const d = await this.api.get<Raw>(`${BASE}/repurchase/template/${productUid}`);
    const pa = (d['priceAnalytics'] as Raw) ?? {};
    const sup = (d['supplierSuggestions'] as Raw[]) ?? [];
    return {
      lastPurchaseType: (d['lastPurchaseType'] as RepurchaseTemplate['lastPurchaseType']) ?? null,
      lastPriceInputMode: (d['lastPriceInputMode'] as RepurchaseTemplate['lastPriceInputMode']) ?? null,
      lastQuantity: numOrNull(d['lastQuantity']),
      lastPricePerUnit: numOrNull(d['lastPricePerUnit']),
      lastCostPerPiece: numOrNull(d['lastCostPerPiece']),
      lastCostPerPackage: numOrNull(d['lastCostPerPackage']),
      lastSupplierName: (d['lastSupplierName'] as string) ?? null,
      lastMinimumStockLevel: numOrNull(d['lastMinimumStockLevel']),
      lastReorderPoint: numOrNull(d['lastReorderPoint']),
      lastPurchaseDate: (pa['lastPurchaseDate'] as string) ?? null,
      daysSinceLastPurchase: numOrNull(pa['daysSinceLastPurchase']),
      piecesPerPackage: numOrNull(((d['product'] as Raw) ?? {})['piecesPerPackage']),
      packageAbbreviation: (d['packageAbbreviation'] as string) ?? null,
      suppliers: sup.map((s) => ({
        name: String(s['supplierName'] ?? ''),
        lowestPrice: numOrNull(s['lowestPrice']),
        averagePrice: numOrNull(s['averagePrice']),
        purchases: Number(s['totalPurchases'] ?? 0) || 0,
        best: s['isLowestPriceSupplier'] === true,
        message: (s['recommendationMessage'] as string) ?? null,
      })),
    };
  }

  async create(body: PurchaseRequest): Promise<Purchase> {
    return normalizePurchase(await this.api.post<Raw>(BASE, body));
  }

  /**
   * Buy several products again in one go (the repurchase cart). Each line is
   * created PENDING on its own; the server reports per-line failures as
   * "productUid: reason" instead of failing the whole request. It skips the
   * pending / approved duplicate check, so callers must block those products.
   */
  async bulkRepurchase(lines: RepurchaseLine[]): Promise<{ created: Purchase[]; failed: Map<string, string> }> {
    const body = {
      items: lines.map((l) => ({
        productUid: l.productUid,
        useLastPurchaseData: false,
        purchaseType: l.purchaseType,
        priceInputMode: 'PER_PIECE' as PriceInputMode,
        quantity: l.quantity,
        purchasePrice: l.unitPrice,
        supplierName: l.supplierName?.trim() || null,
      })),
    };
    const d = await this.api.post<Raw>(`${BASE}/repurchase/bulk`, body);
    const failed = new Map<string, string>();
    for (const f of (d['failedItems'] as string[]) ?? []) {
      const i = f.indexOf(': ');
      if (i > 0) failed.set(f.slice(0, i), f.slice(i + 2));
    }
    return { created: ((d['successfulPurchases'] as Raw[]) ?? []).map(normalizePurchase), failed };
  }

  /** Idempotent by invoice number — re-sending the same invoice returns the saved one. */
  async saveInvoice(inv: RepurchaseInvoice): Promise<void> {
    await this.api.post('/api/v1/invoices', inv);
  }

  /** Only PENDING purchases can be edited. */
  async update(uid: string, body: PurchaseRequest): Promise<Purchase> {
    return normalizePurchase(await this.api.put<Raw>(`${BASE}/${uid}`, body));
  }

  /** Only PENDING purchases can be deleted (soft). */
  async remove(uid: string): Promise<void> {
    await this.api.delete(`${BASE}/${uid}`);
  }

  async approve(uid: string, notes?: string): Promise<void> {
    await this.api.post(`${BASE}/${uid}/approve`, {}, { params: { approvalNotes: notes || undefined } });
  }

  async receive(uid: string, notes?: string): Promise<void> {
    await this.api.post(`${BASE}/${uid}/receive`, {}, { params: { receivingNotes: notes || undefined } });
  }

  /**
   * Approve / receive / cancel many purchases in one request. The server runs
   * them one by one and answers Success / Warning (some failed) / Error (all
   * failed) with per-purchase reasons "uid: message".
   */
  async bulk(action: BulkAction, uids: string[], note?: string): Promise<{ done: string[]; failed: Map<string, string>; message: string }> {
    const params =
      action === 'approve' ? { approvalNotes: note || undefined } : action === 'receive' ? { receivingNotes: note || undefined } : { cancellationReason: note };
    const env = await this.api.postEnvelope<Raw>(`${BASE}/bulk/${action}`, uids, { params, timeoutMs: 120_000 });
    const d = env.data ?? {};
    const doneKey = action === 'approve' ? 'successfulApprovals' : action === 'receive' ? 'successfulReceivals' : 'successfulCancellations';
    const failed = new Map<string, string>();
    for (const f of (d['failureReasons'] as string[]) ?? []) {
      const i = f.indexOf(': ');
      if (i > 0) failed.set(f.slice(0, i), f.slice(i + 2));
    }
    const done = (d[doneKey] as string[]) ?? [];
    // An Error envelope without data (e.g. missing reason) fails every purchase.
    if (!env.data && env.status !== 'Success') for (const u of uids) failed.set(u, env.message ?? 'Failed');
    return { done, failed, message: env.message ?? '' };
  }

  async cancel(uid: string, reason: string): Promise<void> {
    await this.api.post(`${BASE}/${uid}/cancel`, {}, { params: { cancellationReason: reason } });
  }
}
