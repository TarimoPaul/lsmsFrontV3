import { Injectable, inject } from '@angular/core';

import { ApiService } from '@core/api/api.service';
import { CachedList } from '@core/data/cached-resource';
import { Product, ProductRequest, normalizeProduct } from './products.models';

const BASE = '/api/v1/products';

/**
 * Product catalogue API (Spring `ProductController`): PRODUCT_READ,
 * PRODUCT_WRITE (create), PRODUCT_UPDATE, PRODUCT_DELETE.
 *
 * The whole catalogue is cached once and shared by every module that needs
 * it (products, categories, and later sales / purchases / stock), so moving
 * between screens does not re-download it. Flutter loaded only the first 50
 * products here (page size 50, never paged further).
 */
@Injectable({ providedIn: 'root' })
export class ProductsService {
  private readonly api = inject(ApiService);

  readonly catalogue = new CachedList<Product>(() => this.fetchAll(), 2 * 60_000);

  private async fetchAll(): Promise<Product[]> {
    const rows = await this.api.get<unknown[] | null>(BASE, { params: { page: 0, size: 10_000 } });
    return (rows ?? []).map((r) => normalizeProduct(r as Parameters<typeof normalizeProduct>[0]));
  }

  async create(body: ProductRequest): Promise<Product | null> {
    const res = await this.api.postResult<unknown>(BASE, body);
    const saved = res.data ? normalizeProduct(res.data as Parameters<typeof normalizeProduct>[0]) : null;
    if (saved?.uid) this.catalogue.upsert(saved);
    else this.catalogue.invalidate();
    return saved;
  }

  async update(uid: string, body: ProductRequest): Promise<Product | null> {
    const res = await this.api.putResult<unknown>(`${BASE}/${uid}`, body);
    const saved = res.data ? normalizeProduct(res.data as Parameters<typeof normalizeProduct>[0]) : null;
    if (saved?.uid) this.catalogue.upsert(saved);
    else this.catalogue.invalidate();
    return saved;
  }

  /** Hard delete; the backend refuses when the product has purchase records. */
  async remove(uid: string): Promise<void> {
    await this.api.delete(`${BASE}/${uid}`);
    this.catalogue.remove(uid);
  }
}
