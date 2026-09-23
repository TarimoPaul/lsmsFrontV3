export type UserStatus = 'PENDING' | 'ACTIVE' | 'INACTIVE' | 'LOCKED' | 'TERMINATED';

export const USER_STATUSES: UserStatus[] = ['ACTIVE', 'PENDING', 'INACTIVE', 'LOCKED'];

/** Row shape from GET /api/users (Spring `UserDto`). */
export interface UserRow {
  uid: string;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string | null;
  gender: string | null;
  profileImageUrl: string | null;
  status: UserStatus;
  roleUids: string[];
  roleNames: string[];
  createdAt: string | null;
  updatedAt: string | null;
  lastLoginAt: string | null;
  emailVerified: boolean;
}

/** GET /api/users/{uid}/details */
export interface UserDetails {
  uid: string;
  firstName: string;
  lastName: string;
  fullName?: string;
  email: string;
  phoneNumber: string | null;
  status: UserStatus;
  roles: Array<{ uid?: string; name: string } | string>;
  permissions: Array<{ name: string } | string>;
  createdAt: string | null;
  updatedAt: string | null;
  lastLoginAt: string | null;
}

/** GET /api/users/statistics */
export interface UserStatistics {
  total: number;
  active: number;
  pending: number;
  inactive: number;
  locked: number;
  terminated: number;
  roleDistribution: Record<string, number>;
}

export interface UserQuery {
  search?: string;
  status?: UserStatus | null;
  roleUid?: string | null;
}

export interface CreateUserRequest {
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber?: string;
  password: string;
  roleUids: string[];
}

export interface UpdateProfileRequest {
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber?: string;
}

export function fullName(u: { firstName?: string | null; lastName?: string | null; email?: string }): string {
  const n = `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim();
  return n || (u.email ?? '');
}

export function userInitials(u: { firstName?: string | null; lastName?: string | null; email?: string }): string {
  const parts = fullName(u).split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '?';
}

/** Role chip colour (ported from Flutter `_roleColor`). */
export function roleColor(name: string): string {
  const n = name.toUpperCase();
  if (n.includes('ROOT')) return 'var(--c-error)';
  if (n.includes('ADMIN') || n.includes('CEO')) return '#9c27b0';
  if (n.includes('MANAGER')) return '#2196f3';
  if (n.includes('SUPERVISOR')) return '#009688';
  if (n.includes('CASHIER') || n.includes('MUUZAJI') || n.includes('SALES')) return 'var(--c-success)';
  if (n.includes('STORE') || n.includes('INVENTORY')) return '#ff9800';
  if (n.includes('FINANCE')) return '#673ab7';
  return 'var(--c-primary)';
}

export const STATUS_META: Record<UserStatus, { en: string; sw: string; color: string; icon: string }> = {
  ACTIVE: { en: 'Active', sw: 'Hai', color: 'var(--c-success)', icon: 'check_circle' },
  PENDING: { en: 'Pending', sw: 'Inasubiri', color: 'var(--c-warning)', icon: 'hourglass_top' },
  INACTIVE: { en: 'Inactive', sw: 'Imezimwa', color: 'var(--c-text-2)', icon: 'pause_circle' },
  LOCKED: { en: 'Locked', sw: 'Imefungwa', color: 'var(--c-error)', icon: 'lock' },
  TERMINATED: { en: 'Deleted', sw: 'Imefutwa', color: 'var(--c-error)', icon: 'block' },
};
