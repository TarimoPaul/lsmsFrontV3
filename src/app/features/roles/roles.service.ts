import { Injectable, inject } from '@angular/core';

import { ApiService } from '@core/api/api.service';
import { Permission, PermissionModule, Role, RoleUpsert } from './roles.models';

const BASE = '/api/v1/roles';

/**
 * Role & permission API (Spring `RoleController`).
 *  - GET    /api/v1/roles?page&size&search     ROLE_READ    (ResponsePage<Role>)
 *  - POST   /api/v1/roles                      ROLE_WRITE   (create / update by uid)
 *  - DELETE /api/v1/roles/{uid}                ROLE_DELETE  (soft delete)
 *  - POST   /api/v1/roles/{uid}/permissions    ROLE_ASSIGN  (REPLACES the role's permission set)
 *  - GET    /api/v1/roles/permissions/modules  ROLE_READ    (module → group → permissions)
 */
@Injectable({ providedIn: 'root' })
export class RolesService {
  private readonly api = inject(ApiService);

  async list(search = ''): Promise<Role[]> {
    const data = await this.api.get<Role[]>(BASE, { params: { page: 0, size: 500, search } });
    return (data ?? []).map(normalizeRole);
  }

  async get(uid: string): Promise<Role> {
    return normalizeRole(await this.api.get<Role>(`${BASE}/${uid}`));
  }

  async save(body: RoleUpsert): Promise<{ role: Role; message: string | null }> {
    const res = await this.api.postResult<Role>(BASE, body);
    return { role: normalizeRole(res.data), message: res.message };
  }

  async delete(uid: string): Promise<void> {
    await this.api.delete(`${BASE}/${uid}`);
  }

  /** Replace the role's permissions with exactly `permissionUids`. */
  async setPermissions(roleUid: string, permissionUids: string[]): Promise<Role> {
    return normalizeRole(await this.api.post<Role>(`${BASE}/${roleUid}/permissions`, permissionUids));
  }

  async permissionModules(): Promise<PermissionModule[]> {
    const data = (await this.api.get<PermissionModule[]>(`${BASE}/permissions/modules`)) ?? [];
    return data
      .map((m) => ({
        module: m.module ?? 'OTHER',
        permissionGroups: (m.permissionGroups ?? [])
          .map((g) => ({ group: g.group || 'General', permissions: (g.permissions ?? []).filter((p) => p?.uid) }))
          .filter((g) => g.permissions.length),
      }))
      .filter((m) => m.permissionGroups.length)
      .sort((a, b) => a.module.localeCompare(b.module));
  }
}

function normalizeRole(r: Partial<Role> | null | undefined): Role {
  return {
    uid: r?.uid ?? '',
    name: (r?.name ?? '').trim(),
    description: (r?.description ?? '').trim(),
    status: r?.status ?? 'ACTIVE',
    permissions: ((r?.permissions as Permission[] | undefined) ?? []).filter(Boolean),
    createdAt: r?.createdAt ?? null,
    updatedAt: r?.updatedAt ?? null,
    isDefault: !!r?.isDefault,
  };
}
