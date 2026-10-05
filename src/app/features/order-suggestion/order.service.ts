import { Injectable, inject } from '@angular/core';

import { ApiService } from '@core/api/api.service';
import { BudgetSource, OrderLine, OrderStatus, OrderSuggestion } from './order.models';

type Raw = Record<string, unknown>;
const BASE = '/api/order-suggestions';
const num = (v: unknown) => (v === null || v === undefined || v === '' ? 0 : Number(v) || 0);
const numOrNull = (v: unknown) => (v === null || v === undefined || v === '' ? null : Number(v));
const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);

/** /api/order-suggestions — read with ORDER_SUGGESTION_VIEW, change with ORDER_SUGGESTION_EDIT. */
@Injectable({ providedIn: 'root' })
export class OrderService {
  private readonly api = inject(ApiService);

  /** The order of today; null when it has not been made yet. */
  async today(): Promise<OrderSuggestion | null> {
    const r = await this.api.get<Raw | null>(`${BASE}/today`);
    return r ? normalize(r) : null;
  }

  /** Orders of a period (max 62 days), newest first, each with its lines. */
  async history(from: string, to: string): Promise<OrderSuggestion[]> {
    const rows = await this.api.get<Raw[] | null>(BASE, { params: { from, to } });
    return (rows ?? []).map(normalize);
  }

  /** The buyer's crates for one line; null hands the line back to the system. */
  async editLine(orderUid: string, lineUid: string, packs: number | null): Promise<OrderSuggestion> {
    return normalize(await this.api.put<Raw>(`${BASE}/${orderUid}/lines/${lineUid}`, { packs }));
  }

  /** "Imenunuliwa": close the order with the crates really bought (lines left out = bought as ordered). */
  async purchased(orderUid: string, lines: { lineUid: string; packs: number }[]): Promise<OrderSuggestion> {
    return normalize(await this.api.post<Raw>(`${BASE}/${orderUid}/purchased`, { lines }));
  }

  /** "Hesabu upya": recompute the order of today now (makes it when there is none). */
  async recalculate(): Promise<OrderSuggestion | null> {
    const r = await this.api.post<Raw | null>(`${BASE}/today/recalculate`);
    return r ? normalize(r) : null;
  }
}

function normalize(r: Raw): OrderSuggestion {
  const b = (r['budget'] ?? {}) as Raw;
  const t = (r['totals'] ?? {}) as Raw;
  const lines = Array.isArray(r['lines']) ? (r['lines'] as Raw[]) : [];
  return {
    uid: String(r['uid'] ?? ''),
    orderDate: String(r['orderDate'] ?? ''),
    status: (str(r['status']) ?? 'UPDATED') as OrderStatus,
    nightGeneratedAt: str(r['nightGeneratedAt']),
    salesUpdatedAt: str(r['salesUpdatedAt']),
    countUpdatedAt: str(r['countUpdatedAt']),
    budgetUpdatedAt: str(r['budgetUpdatedAt']),
    calculatedAt: str(r['calculatedAt']),
    lastReason: str(r['lastReason']),
    purchasedAt: str(r['purchasedAt']),
    lastError: str(r['lastError']),
    lastErrorAt: str(r['lastErrorAt']),
    countDate: str(r['countDate']),
    countStatus: str(r['countStatus']),
    seasonFactor: num(r['seasonFactor']),
    coverDays: num(r['coverDays']),
    safetyZ: num(r['safetyZ']),
    departureTime: str(r['departureTime']) ?? '10:00',
    arrivalTime: str(r['arrivalTime']) ?? '12:00',
    budget: {
      source: str(b['source']) as BudgetSource | null,
      received: num(b['received']),
      collections: num(b['collections']),
      expenses: num(b['expenses']),
      accrual: num(b['accrual']),
      amount: num(b['amount']),
      otherPurchases: num(b['otherPurchases']),
      poolCarry: num(b['poolCarry']),
      limit: numOrNull(b['limit']),
      poolCap: num(b['poolCap']),
      poolOut: num(b['poolOut']),
    },
    totals: {
      products: num(t['products']),
      wantedCost: num(t['wantedCost']),
      systemCost: num(t['systemCost']),
      cutCost: num(t['cutCost']),
      orderCost: num(t['orderCost']),
      orderPacks: num(t['orderPacks']),
      editedLines: num(t['editedLines']),
      purchasedCost: numOrNull(t['purchasedCost']),
    },
    lines: lines.map(
      (l): OrderLine => ({
        uid: String(l['uid'] ?? ''),
        productUid: String(l['productUid'] ?? ''),
        productId: num(l['productId']),
        productName: str(l['productName']) ?? '—',
        piecesPerPack: num(l['piecesPerPack']) || 1,
        unitCost: num(l['unitCost']),
        packCost: num(l['packCost']),
        nightPacks: numOrNull(l['nightPacks']),
        systemPacks: num(l['systemPacks']),
        userPacks: numOrNull(l['userPacks']),
        purchasedPacks: numOrNull(l['purchasedPacks']),
        packs: num(l['packs']),
        edited: l['edited'] === true,
        cost: num(l['cost']),
        stock: num(l['stock']),
        stockSource: l['stockSource'] === 'COUNT' ? 'COUNT' : 'SYSTEM',
        velocity: num(l['velocity']),
        stockoutDays: num(l['stockoutDays']),
        seasonFactor: num(l['seasonFactor']),
        target: num(l['target']),
        need: num(l['need']),
        wantedPacks: num(l['wantedPacks']),
        cutPacks: num(l['cutPacks']),
        priority: num(l['priority']),
      }),
    ),
  };
}
