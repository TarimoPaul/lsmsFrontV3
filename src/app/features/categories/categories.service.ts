import { Injectable, inject } from '@angular/core';

import { ApiService } from '@core/api/api.service';
import { CachedList } from '@core/data/cached-resource';
import { Category, CategoryRequest } from './categories.models';

const BASE = '/api/v1/categories';

/**
 * Category API (Spring `CategoryController`). Permissions enforced by the
 * backend: CATEGORY_READ, CATEGORY_WRITE (create), CATEGORY_UPDATE,
 * CATEGORY_DELETE. Delete is a hard delete that cascades to the category's
 * products, so callers must block it while products exist.
 *
 * The list is cached and shared (the product form, filters and later modules
 * use it too); mutations patch the cache instead of refetching.
 */
@Injectable({ providedIn: 'root' })
export class CategoriesService {
  private readonly api = inject(ApiService);

  readonly list = new CachedList<Category>(async () => {
    const rows = await this.api.get<Partial<Category>[] | null>(BASE);
    return (rows ?? []).map(normalize);
  }, 5 * 60_000);

  async create(body: CategoryRequest): Promise<{ category: Category | null; message: string | null }> {
    const res = await this.api.postResult<Partial<Category> | null>(BASE, body);
    const category = res.data?.uid ? normalize(res.data) : null;
    if (category) this.list.upsert(category);
    else this.list.invalidate();
    return { category, message: res.message };
  }

  async update(uid: string, body: CategoryRequest): Promise<{ category: Category | null; message: string | null }> {
    const res = await this.api.putResult<Partial<Category> | null>(`${BASE}/${uid}`, body);
    const category = res.data ? normalize({ ...res.data, uid }) : null;
    if (category) this.list.upsert(category);
    else this.list.invalidate();
    return { category, message: res.message };
  }

  async remove(uid: string): Promise<void> {
    await this.api.delete(`${BASE}/${uid}`);
    this.list.remove(uid);
  }
}

function normalize(c: Partial<Category>): Category {
  return {
    uid: c.uid ?? '',
    categoryName: (c.categoryName ?? '').trim(),
    description: c.description?.trim() || null,
  };
}
