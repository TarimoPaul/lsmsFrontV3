import { Injectable, inject } from '@angular/core';

import { ApiService } from '@core/api/api.service';
import { CachedList } from '@core/data/cached-resource';
import { MeasureRef } from '../products/products.models';

const BASE = '/api/v1/items-measure';

export interface MeasureRequest {
  packageType: string;
  unitType: string;
  /** At most 5 characters; stored lower-case. */
  abbreviation: string;
  description: string | null;
}

/** GET /{uid}/audit-log — one change of a measure. */
export interface MeasureAudit {
  uid: string;
  action: 'CREATED' | 'UPDATED' | 'DELETED' | string;
  actorName: string | null;
  before: string | null;
  after: string | null;
  productsAffected: number | null;
  at: string | null;
}

/**
 * Items-measure API (Spring `ItemsMeasureController`): MEASURE_READ,
 * MEASURE_WRITE (create), MEASURE_UPDATE, MEASURE_DELETE. The list is cached
 * for the session and shared with the product form and filters; mutations
 * patch the cache. Package type, unit and abbreviation can all be edited; the
 * server audits every change and refuses to delete a measure products use.
 */
@Injectable({ providedIn: 'root' })
export class MeasuresService {
  private readonly api = inject(ApiService);

  readonly list = new CachedList<MeasureRef>(async () => {
    const rows = await this.api.get<Array<Partial<MeasureRef>> | null>(BASE);
    return (rows ?? []).map(normalize).sort(byUnit);
  }, 10 * 60_000);

  async create(body: MeasureRequest): Promise<MeasureRef | null> {
    const res = await this.api.postResult<Partial<MeasureRef> | null>(BASE, body);
    const saved = res.data?.uid ? normalize(res.data) : null;
    if (saved) this.list.update((l) => [...l, saved].sort(byUnit));
    else this.list.invalidate();
    return saved;
  }

  async update(uid: string, body: MeasureRequest): Promise<MeasureRef | null> {
    const res = await this.api.putResult<Partial<MeasureRef> | null>(`${BASE}/${uid}`, body);
    const saved = res.data ? normalize({ ...res.data, uid }) : null;
    if (saved) this.list.update((l) => l.map((m) => (m.uid === uid ? saved : m)).sort(byUnit));
    else this.list.invalidate();
    return saved;
  }

  /** Who changed the measure, when, and from what to what — newest first. Empty on an older backend. */
  async auditLog(uid: string): Promise<MeasureAudit[]> {
    const rows = await this.api.get<Array<Record<string, unknown>> | null>(`${BASE}/${uid}/audit-log`).catch(() => null);
    const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v : null);
    return (rows ?? []).map((r) => ({
      uid: String(r['uid'] ?? ''),
      action: String(r['action'] ?? ''),
      actorName: str(r['actorName']),
      before: str(r['beforeValue']),
      after: str(r['afterValue']),
      productsAffected: r['productsAffected'] === null || r['productsAffected'] === undefined ? null : Number(r['productsAffected']),
      at: str(r['createdAt']),
    }));
  }

  async remove(uid: string): Promise<void> {
    await this.api.delete(`${BASE}/${uid}`);
    this.list.remove(uid);
  }
}

function normalize(m: Partial<MeasureRef>): MeasureRef {
  return {
    uid: m.uid ?? '',
    packageType: (m.packageType ?? '').trim(),
    unitType: (m.unitType ?? '').trim(),
    abbreviation: m.abbreviation?.trim() || null,
    description: m.description?.trim() || null,
    productCount: m.productCount === null || m.productCount === undefined ? null : Number(m.productCount),
  };
}

function byUnit(a: MeasureRef, b: MeasureRef): number {
  return a.unitType.localeCompare(b.unitType, undefined, { numeric: true }) || a.packageType.localeCompare(b.packageType);
}
