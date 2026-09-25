import { Injectable, inject } from '@angular/core';

import { ApiService } from '@core/api/api.service';
import { CachedList } from '@core/data/cached-resource';
import { MeasureRef } from '../products/products.models';

const BASE = '/api/v1/items-measure';

export interface MeasureRequest {
  packageType: string;
  unitType: string;
  /** Required on create; the backend ignores it on update. */
  abbreviation: string;
  description: string | null;
}

/**
 * Items-measure API (Spring `ItemsMeasureController`): MEASURE_READ,
 * MEASURE_WRITE (create), MEASURE_UPDATE, MEASURE_DELETE. The list is cached
 * for the session and shared with the product form and filters; mutations
 * patch the cache.
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
  };
}

function byUnit(a: MeasureRef, b: MeasureRef): number {
  return a.unitType.localeCompare(b.unitType, undefined, { numeric: true }) || a.packageType.localeCompare(b.packageType);
}
