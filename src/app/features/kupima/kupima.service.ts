import { Injectable, inject, signal } from '@angular/core';

import { ApiService } from '@core/api/api.service';

/** KUPIMA (owner ef/ei/ej/ek): a drink sold by measure out of ONE open container. Backend /api/v1/kupima. */
export interface PourMeasure {
  uid: string;
  ml: number;
  /** eu: the price of the OPEN container (its parent's own price, else the base). */
  price: number;
  basePrice: number;
  /** Cost of this measure from the open container (or the next one): parent avg / container ml x ml. */
  cost: number | null;
}

export interface PourContainer {
  uid: string;
  referenceNumber: string;
  containerMl: number;
  mlLeft: number;
  costPerMl: number;
  openedBy: string | null;
  openedAt: string | null;
  /** es: the parent this container was opened from. */
  parentProductUid: string | null;
  parentName: string | null;
}

/** es/eu: a parent the drink may be opened from, with its price list (own price or the base). */
export interface PourParent {
  uid: string;
  name: string;
  avgCost: number | null;
  stock: number;
  prices: { ml: number; price: number; own: boolean; cost: number | null }[];
}

export interface PourProduct {
  productUid: string;
  productName: string;
  containerName: string;
  containerMl: number;
  parentProductUid: string;
  parentName: string | null;
  parentAvgCost: number | null;
  parentStock: number | null;
  parents: PourParent[];
  measures: PourMeasure[];
  open: PourContainer | null;
}

export interface PourContainerRow {
  uid: string;
  referenceNumber: string;
  productName: string;
  containerMl: number;
  status: 'OPEN' | 'CLOSED';
  closeKind: 'SPLIT' | 'FINISHED' | null;
  openedBy: string | null;
  openedAt: string | null;
  closedBy: string | null;
  closedAt: string | null;
  mlLeft: number;
  mlSold: number;
  mlLost: number;
  lossCost: number;
  revenue: number;
  costPerMl: number;
  smallestMl: number | null;
  parentPrice: number | null;
}

export interface PourHistory {
  field: string;
  oldValue: string | null;
  newValue: string | null;
  byName: string | null;
  at: string | null;
}

export interface PourSettings {
  containerName: string;
  containerMl: number;
  /** es: every parent it may be opened from. */
  parentProductUids: string[];
  measures: { ml: number; price: number }[];
  /** eu: a parent's own price for a base measure (optional). */
  parentPrices: { parentProductUid: string; ml: number; price: number }[];
}

/** eu: a measure's price for a container of this parent (own price, else the base). */
export function priceFor(p: PourProduct, parentUid: string | null, ml: number): number | null {
  const own = p.parents.find((x) => x.uid === parentUid)?.prices.find((x) => x.ml === ml);
  return own ? own.price : (p.measures.find((m) => m.ml === ml)?.basePrice ?? null);
}

type Raw = Record<string, unknown>;
const n = (v: unknown): number => (v === null || v === undefined || v === '' ? 0 : Number(v));
const nn = (v: unknown): number | null => (v === null || v === undefined || v === '' ? null : Number(v));
const s = (v: unknown): string | null => (v === null || v === undefined ? null : String(v));

export function normalizePour(r: Raw): PourProduct {
  const o = r['open'] as Raw | null;
  return {
    productUid: String(r['productUid'] ?? ''),
    productName: String(r['productName'] ?? ''),
    containerName: String(r['containerName'] ?? ''),
    containerMl: n(r['containerMl']),
    parentProductUid: String(r['parentProductUid'] ?? ''),
    parentName: s(r['parentName']),
    parentAvgCost: nn(r['parentAvgCost']),
    parentStock: nn(r['parentStock']),
    parents: ((r['parents'] as Raw[] | undefined) ?? []).map((x) => ({
      uid: String(x['uid'] ?? ''),
      name: String(x['name'] ?? ''),
      avgCost: nn(x['avgCost']),
      stock: n(x['stock']),
      prices: ((x['prices'] as Raw[] | undefined) ?? []).map((q) => ({ ml: n(q['ml']), price: n(q['price']), own: !!q['own'], cost: nn(q['cost']) })),
    })),
    measures: ((r['measures'] as Raw[] | undefined) ?? []).map((m) => ({
      uid: String(m['uid'] ?? ''),
      ml: n(m['ml']),
      price: n(m['price']),
      basePrice: m['basePrice'] === undefined ? n(m['price']) : n(m['basePrice']),
      cost: nn(m['cost']),
    })),
    open: o
      ? {
          uid: String(o['uid'] ?? ''),
          referenceNumber: String(o['referenceNumber'] ?? ''),
          containerMl: n(o['containerMl']),
          mlLeft: n(o['mlLeft']),
          costPerMl: n(o['costPerMl']),
          openedBy: s(o['openedBy']),
          openedAt: s(o['openedAt']),
          parentProductUid: s(o['parentProductUid']),
          parentName: s(o['parentName']),
        }
      : null,
  };
}

/** Share of the container still in it, 0..1 (what the bar shows). */
export function barFraction(p: PourProduct, reservedMl = 0): number {
  if (!p.open || !p.open.containerMl) return 0;
  return Math.max(0, Math.min(1, (p.open.mlLeft - reservedMl) / p.open.containerMl));
}

@Injectable({ providedIn: 'root' })
export class KupimaService {
  private readonly api = inject(ApiService);
  readonly products = signal<PourProduct[]>([]);

  async load(): Promise<PourProduct[]> {
    const rows = (await this.api.get<Raw[] | null>('/api/v1/kupima/products')) ?? [];
    const list = rows.map(normalizePour);
    this.products.set(list);
    return list;
  }

  /** KUPIMA_SETTINGS. Resolves to the saved product and the server's warnings (a measure under its cost). */
  async configure(productUid: string, body: PourSettings): Promise<{ product: PourProduct; warnings: string[] }> {
    const r = await this.api.putResult<Raw>(`/api/v1/kupima/products/${productUid}`, body);
    return { product: normalizePour(r.data), warnings: r.warnings };
  }

  async disable(productUid: string): Promise<void> {
    await this.api.delete(`/api/v1/kupima/products/${productUid}`);
  }

  /** es: `parentUid` = the parent to open from (needed when the drink has more than one). */
  async open(productUid: string, parentUid: string | null = null): Promise<PourProduct> {
    return normalizePour(await this.api.post<Raw>(`/api/v1/kupima/products/${productUid}/open`, parentUid ? { parentProductUid: parentUid } : {}));
  }

  /** "Chombo kimeisha": what is left becomes a loss (5100). */
  async finish(productUid: string, note: string | null): Promise<PourProduct> {
    return normalizePour(await this.api.post<Raw>(`/api/v1/kupima/products/${productUid}/finish`, {}, { params: { note: note ?? '' } }));
  }

  async check(productUid: string, level: string): Promise<{ barMl: number; countedMl: number; differenceMl: number }> {
    const r = await this.api.post<Raw>(`/api/v1/kupima/products/${productUid}/check`, {}, { params: { level } });
    return { barMl: n(r['barMl']), countedMl: n(r['countedMl']), differenceMl: n(r['differenceMl']) };
  }

  async history(productUid: string): Promise<PourHistory[]> {
    const rows = (await this.api.get<Raw[] | null>(`/api/v1/kupima/products/${productUid}/history`)) ?? [];
    return rows.map((h) => ({ field: String(h['field'] ?? ''), oldValue: s(h['old_value']), newValue: s(h['new_value']), byName: s(h['by_name']), at: s(h['at']) }));
  }

  async containers(productUid?: string): Promise<PourContainerRow[]> {
    const rows = (await this.api.get<Raw[] | null>('/api/v1/kupima/containers', { params: { productUid: productUid ?? '' } })) ?? [];
    return rows.map((c) => ({
      uid: String(c['uid'] ?? ''),
      referenceNumber: String(c['reference_number'] ?? ''),
      productName: String(c['product_name'] ?? ''),
      containerMl: n(c['container_ml']),
      status: String(c['status'] ?? 'OPEN') as 'OPEN' | 'CLOSED',
      closeKind: (s(c['close_kind']) as 'SPLIT' | 'FINISHED' | null) ?? null,
      openedBy: s(c['opened_by']),
      openedAt: s(c['opened_at']),
      closedBy: s(c['closed_by']),
      closedAt: s(c['closed_at']),
      mlLeft: n(c['ml_left']),
      mlSold: n(c['ml_sold']),
      mlLost: n(c['ml_lost']),
      lossCost: n(c['loss_cost']),
      revenue: n(c['revenue']),
      costPerMl: n(c['cost_per_ml']),
      smallestMl: nn(c['smallest_ml']),
      parentPrice: nn(c['parent_price']),
    }));
  }
}
