import { Injectable, inject } from '@angular/core';

import { ApiService } from '@core/api/api.service';
import {
  CreateUserRequest,
  UpdateProfileRequest,
  UserDetails,
  UserQuery,
  UserRow,
  UserStatistics,
  UserStatus,
} from './users.models';

const BASE = '/api/users';

interface SpringPage<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
}

/**
 * User administration API (Spring `UserController`). Permissions enforced by
 * the backend: USER_READ, USER_CREATE, USER_UPDATE, USER_APPROVE,
 * USER_DELETE, ROLE_ASSIGN (replace roles).
 */
@Injectable({ providedIn: 'root' })
export class UsersService {
  private readonly api = inject(ApiService);

  /** Server-side search + filters; deleted (TERMINATED) users are excluded by the backend. */
  async list(q: UserQuery = {}): Promise<{ users: UserRow[]; total: number }> {
    const page = await this.api.get<SpringPage<UserRow>>(BASE, {
      params: {
        search: q.search?.trim() || undefined,
        status: q.status ?? undefined,
        roleUids: q.roleUid ?? undefined,
        page: 0,
        size: 500,
        sortBy: 'createdAt',
        sortDir: 'DESC',
      },
    });
    const users = (page?.content ?? []).map(normalize);
    return { users, total: page?.totalElements ?? users.length };
  }

  statistics(): Promise<UserStatistics> {
    return this.api.get<UserStatistics>(`${BASE}/statistics`);
  }

  details(uid: string): Promise<UserDetails> {
    return this.api.get<UserDetails>(`${BASE}/${uid}/details`);
  }

  async create(body: CreateUserRequest): Promise<string | null> {
    const res = await this.api.postResult<unknown>(BASE, body);
    return res.message;
  }

  async updateProfile(uid: string, body: UpdateProfileRequest): Promise<void> {
    await this.api.put(`${BASE}/${uid}/profile`, body);
  }

  /** Replace the user's roles with exactly `roleUids`. */
  async setRoles(uid: string, roleUids: string[]): Promise<void> {
    await this.api.put(`${BASE}/${uid}/roles`, roleUids);
  }

  async approve(uid: string): Promise<void> {
    await this.api.put(`${BASE}/${uid}/approve`);
  }

  async setStatus(uid: string, status: UserStatus): Promise<void> {
    await this.api.put(`${BASE}/${uid}/status`, {}, { params: { status } });
  }

  /** Soft delete (backend marks the user TERMINATED). */
  async remove(uid: string): Promise<void> {
    await this.api.delete(`${BASE}/${uid}`);
  }
}

function normalize(u: Partial<UserRow>): UserRow {
  return {
    uid: u.uid ?? '',
    firstName: u.firstName ?? '',
    lastName: u.lastName ?? '',
    email: u.email ?? '',
    phoneNumber: u.phoneNumber ?? null,
    gender: u.gender ?? null,
    profileImageUrl: u.profileImageUrl ?? null,
    status: (u.status ?? 'ACTIVE') as UserStatus,
    roleUids: u.roleUids ?? [],
    roleNames: u.roleNames ?? [],
    createdAt: u.createdAt ?? null,
    updatedAt: u.updatedAt ?? null,
    lastLoginAt: u.lastLoginAt ?? null,
    emailVerified: !!u.emailVerified,
  };
}
