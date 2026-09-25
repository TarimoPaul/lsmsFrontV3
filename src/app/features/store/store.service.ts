import { Injectable, inject } from '@angular/core';

import { ApiService } from '@core/api/api.service';
import { CachedList, CachedResource } from '@core/data/cached-resource';
import { InsightRow, InventoryInsights, Movement, StockItem } from './store.models';

const BASE = '/api/store';
type Raw = Record<string, unknown>;
const num = (v: unknown) => Number(v ?? 0) || 0;
const numOrNull = (v: unknown) => (v === null || v === undefined || v === '' ? null : Number(v));
const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);

interface SpringPage<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  number: number;
}

/**
 * Store / inventory API (Spring `StoreController`): STORE_READ for views;
 * adjustments need STORE_WRITE, INVENTORY_ADJUST or STORE_ADMIN.
 *
 * Known backend limits worked around here: `display/search` always fails and
 * falls back to the latest 100 rows, and `entries/by-type` fails to serialise —
 * so movements come from the (unfiltered) paginated endpoint.
 */
@Injectable({ providedIn: 'root' })
export class StoreService {
  private readonly api = inject(ApiService);

  /** Current stock of every product — one request drives inventory, low / out of stock and value. */
  readonly stock = new CachedList<StockItem>(async () => {
    const rows = await this.api.get<Raw[] | null>(`${BASE}/display/stock/summary`);
    return (rows ?? []).map(toStock).sort((a, b) => a.productName.localeCompare(b.productName));
  }, 60_000);

  /** Slow / dead stock analysis — loaded only when the Insights view opens. */
  readonly insights = new CachedResource<InventoryInsights>(async () => {
    const d = await this.api.get<Raw>(`${BASE}/analytics/inventory/summary`);
    return {
      totalProducts: num(d['totalProducts']),
      slowMovingCount: num(d['slowMovingCount']),
      deadStockCount: num(d['deadStockCount']),
      fastMovingCount: num(d['fastMovingCount']),
      totalDeadStockValue: num(d['totalDeadStockValue']),
      totalInventoryValue: num(d['totalInventoryValue']),
      aging: {
        d0to30: num(d['agingBucket0to30']),
        d31to60: num(d['agingBucket31to60']),
        d61to90: num(d['agingBucket61to90']),
        d90plus: num(d['agingBucket90plus']),
      },
      products: ((d['allProducts'] as Raw[]) ?? []).map(toInsight),
    };
  }, 5 * 60_000);

  /** Newest movements first, 0-based page. */
  async movements(page: number, size: number): Promise<{ items: Movement[]; total: number; pages: number }> {
    const res = await this.api.get<SpringPage<Raw>>(`${BASE}/display/entries/paginated`, { params: { page, size } });
    return { items: (res?.content ?? []).map(toMovement), total: res?.totalElements ?? 0, pages: res?.totalPages ?? 1 };
  }

  async productMovements(productUid: string): Promise<Movement[]> {
    const rows = await this.api.get<Raw[] | null>(`${BASE}/display/product/${productUid}/movements`);
    return (rows ?? []).map(toMovement);
  }

  /** Signed quantity: positive adds stock, negative removes it (server refuses going below zero). */
  async adjust(productUid: string, quantity: number, reason: string, reference: string | null): Promise<void> {
    await this.api.post(`${BASE}/adjustment`, { productUid, adjustmentQuantity: quantity, reason, reference });
    this.afterChange();
  }

  async damage(productUid: string, quantity: number, reason: string, reference: string | null): Promise<void> {
    await this.api.post(`${BASE}/damage-movement`, {}, { params: { productUid, quantity, reason, reference: reference ?? undefined } });
    this.afterChange();
  }

  async returnToStock(productUid: string, quantity: number, reason: string, reference: string | null): Promise<void> {
    await this.api.post(`${BASE}/return-movement`, {}, {
      params: { productUid, quantity, isCustomerReturn: true, reason, reference: reference ?? undefined },
    });
    this.afterChange();
  }

  private afterChange(): void {
    this.stock.invalidate();
    this.insights.invalidate();
    void this.stock.load().catch(() => undefined);
  }
}

function toStock(r: Raw): StockItem {
  return {
    uid: String(r['productUid'] ?? ''),
    productName: String(r['productName'] ?? '').trim(),
    category: str(r['category']),
    categoryUid: str(r['categoryUid']),
    currentStock: num(r['currentStock']),
    piecesPerPackage: numOrNull(r['piecesPerPackage']),
    packageAbbreviation: str(r['packageAbbreviation']),
    averageCostPrice: numOrNull(r['averageCostPrice']),
    pieceSalePrice: numOrNull(r['pieceSalePrice']),
    isLowStock: r['isLowStock'] === true,
    isOutOfStock: r['isOutOfStock'] === true,
    isNegativeStock: r['isNegativeStock'] === true,
    lastMovementDate: str(r['lastMovementDate']),
    lastMovementType: str(r['lastMovementType']),
  };
}

function toMovement(r: Raw): Movement {
  const change = r['stockChange'] !== undefined && r['stockChange'] !== null ? num(r['stockChange']) : num(r['quantity']);
  const dir = String(r['movementDirection'] ?? '');
  return {
    uid: String(r['uid'] ?? ''),
    productUid: String(r['productUid'] ?? ''),
    productName: String(r['productName'] ?? ''),
    categoryName: str(r['categoryName']),
    movementType: String(r['movementType'] ?? ''),
    quantityDisplay: str(r['quantityDisplay']),
    stockBefore: numOrNull(r['stockBefore']),
    stockAfter: numOrNull(r['stockAfter']),
    stockChange: change,
    unitPrice: numOrNull(r['unitPrice']),
    totalValue: numOrNull(r['totalValue']),
    movementDate: str(r['movementDate']),
    initiatedBy: str(r['initiatedBy']),
    reference: str(r['reference']),
    notes: str(r['notes']),
    direction: dir === 'IN' || dir === 'OUT' ? dir : change > 0 ? 'IN' : change < 0 ? 'OUT' : 'NEUTRAL',
  };
}

function toInsight(r: Raw): InsightRow {
  return {
    uid: String(r['productUid'] ?? ''),
    productName: String(r['productName'] ?? ''),
    categoryName: str(r['categoryName']),
    movementClass: String(r['movementClass'] ?? 'NORMAL'),
    agingBucket: str(r['agingBucket']),
    daysSinceLastOutbound: num(r['daysSinceLastOutbound']),
    unitsSoldLast30Days: num(r['unitsSoldLast30Days']),
    unitsSoldLast90Days: num(r['unitsSoldLast90Days']),
    currentStock: num(r['currentStock']),
    currentStockValue: num(r['currentStockValue']),
    recommendations: (r['recommendations'] as string[]) ?? [],
    recommendationPriority: String(r['recommendationPriority'] ?? 'LOW'),
  };
}
