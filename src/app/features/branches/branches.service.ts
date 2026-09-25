import { Injectable, inject } from '@angular/core';

import { ApiService } from '@core/api/api.service';
import { CachedList } from '@core/data/cached-resource';
import { Branch, BranchRequest, normalizeBranch } from './branches.models';

const BASE = '/api/v1/branches';
type Raw = Record<string, unknown>;

/**
 * Branch API (Spring `BranchController`): BRANCH_READ, BRANCH_WRITE (create),
 * BRANCH_UPDATE, BRANCH_DELETE (soft; never the main branch), BRANCH_SUSPEND,
 * BRANCH_ACTIVATE. Branches are few, so the list is cached and filtered locally.
 */
@Injectable({ providedIn: 'root' })
export class BranchesService {
  private readonly api = inject(ApiService);

  readonly list = new CachedList<Branch>(async () => {
    const rows = await this.api.get<Raw[] | null>(BASE);
    return (rows ?? []).map(normalizeBranch).sort(order);
  }, 5 * 60_000);

  async create(body: BranchRequest): Promise<Branch> {
    const saved = normalizeBranch(await this.api.post<Raw>(BASE, body));
    await this.afterMainChange(saved, () => this.list.update((l) => [...l, saved].sort(order)));
    return saved;
  }

  async update(uid: string, body: BranchRequest): Promise<Branch> {
    const saved = normalizeBranch(await this.api.put<Raw>(`${BASE}/${uid}`, body));
    await this.afterMainChange(saved, () => this.list.update((l) => l.map((b) => (b.uid === uid ? saved : b)).sort(order)));
    return saved;
  }

  async remove(uid: string): Promise<void> {
    await this.api.delete(`${BASE}/${uid}`);
    this.list.remove(uid);
  }

  async suspend(uid: string, reason: string | null): Promise<void> {
    const saved = normalizeBranch(await this.api.post<Raw>(`${BASE}/${uid}/suspend`, reason ? { reason } : {}));
    this.list.update((l) => l.map((b) => (b.uid === uid ? saved : b)));
  }

  async reactivate(uid: string): Promise<void> {
    const saved = normalizeBranch(await this.api.post<Raw>(`${BASE}/${uid}/reactivate`, {}));
    this.list.update((l) => l.map((b) => (b.uid === uid ? saved : b)));
  }

  /** Making a branch "main" clears the flag elsewhere on the server — reload then. */
  private async afterMainChange(saved: Branch, patch: () => void): Promise<void> {
    if (saved.isMainBranch) {
      this.list.invalidate();
      await this.list.load().catch(() => patch());
    } else {
      patch();
    }
  }
}

function order(a: Branch, b: Branch): number {
  return Number(b.isMainBranch) - Number(a.isMainBranch) || a.branchName.localeCompare(b.branchName);
}
