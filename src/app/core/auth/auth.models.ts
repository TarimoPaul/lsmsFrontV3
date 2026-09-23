/** Signed-in user (built from the login `tokenInfo`, refreshed via `/api/auth/me`). */
export interface AuthUser {
  uid: string;
  email: string;
  firstName: string;
  lastName: string;
  gender: 'MALE' | 'FEMALE' | string | null;
  profileImageUrl: string | null;
  privilegeLevel: string;
  isAdmin: boolean;
}

export interface BranchInfo {
  uid: string;
  branchName: string;
  isMainBranch: boolean;
}

/** Permission plus its per-role configuration (e.g. SALES_BACKDATE → backdate_days). */
export interface PermissionWithConfig {
  name: string;
  module?: string | null;
  groupName?: string | null;
  config: Record<string, string>;
}

/** Everything persisted for the current browser tab's session. */
export interface AuthSession {
  token: string;
  /** Epoch ms; null when the backend didn't send an expiry and the JWT has none. */
  expiresAt: number | null;
  user: AuthUser;
  roles: string[];
  permissions: string[];
  permissionsWithConfig: PermissionWithConfig[];
  isRoot: boolean;
  branches: BranchInfo[];
  activeBranchUid: string | null;
}

// ─── Raw backend payloads ────────────────────────────────────────────────────

export interface LoginTokenInfo {
  token: string;
  type?: string;
  expiration?: string | number | null;
  email?: string;
  userId?: string;
  firstName?: string;
  lastName?: string;
  isRoot?: boolean;
  hasRootRole?: boolean;
  systemAdmin?: boolean;
  isAdmin?: boolean;
  privilegeLevel?: string;
  gender?: string | null;
  profileImageUrl?: string | null;
  branchUid?: string | null;
}

export interface LoginResponse {
  tokenInfo: LoginTokenInfo;
  permissions?: unknown[];
  permissionsWithConfig?: unknown[];
  roles?: unknown[];
  isRoot?: boolean;
  privilegeLevel?: string;
  branches?: Array<Partial<BranchInfo>>;
  selectedBranchUid?: string | null;
  requiresBranchSelection?: boolean;
}

export interface MeResponse {
  uid: string;
  email: string;
  firstName?: string;
  lastName?: string;
  fullName?: string;
  isRoot?: boolean;
  roles?: unknown[];
  permissions?: unknown[];
  privilegeLevel?: string;
  gender?: string | null;
  profileImageUrl?: string | null;
  isActive?: boolean;
  canLogin?: boolean;
}

export interface RegisterRequest {
  name: string;
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
  phoneNumber?: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function displayName(user: AuthUser | null | undefined): string {
  if (!user) return 'User';
  const full = `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim();
  return full || nameFromEmail(user.email);
}

/** "john.doe@example.com" → "John Doe" (Flutter `_nameFromEmail`). */
export function nameFromEmail(email: string): string {
  const local = (email ?? '').split('@')[0] ?? '';
  return (
    local
      .split(/[._\-+]+/)
      .filter(Boolean)
      .map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())
      .join(' ') || 'User'
  );
}

export function initials(user: AuthUser | null | undefined): string {
  const name = displayName(user);
  const parts = name.split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || 'U';
}

/** Roles/permissions arrive as strings or `{ name }` objects — normalise to names. */
export function toNames(list: unknown[] | undefined | null): string[] {
  if (!Array.isArray(list)) return [];
  return list
    .map((r) => {
      if (typeof r === 'string') return r;
      if (r && typeof r === 'object') {
        const o = r as Record<string, unknown>;
        return String(o['name'] ?? o['roleName'] ?? o['permissionName'] ?? o['permission'] ?? '');
      }
      return '';
    })
    .filter((s) => s && !s.startsWith('{'));
}

export function toPermissionsWithConfig(list: unknown[] | undefined | null): PermissionWithConfig[] {
  if (!Array.isArray(list)) return [];
  return list
    .filter((p): p is Record<string, unknown> => !!p && typeof p === 'object')
    .map((p) => {
      const cfg: Record<string, string> = {};
      const raw = p['config'];
      if (raw && typeof raw === 'object') {
        for (const [k, v] of Object.entries(raw as Record<string, unknown>)) cfg[k] = String(v);
      }
      return {
        name: String(p['name'] ?? ''),
        module: (p['module'] as string) ?? null,
        groupName: (p['groupName'] as string) ?? null,
        config: cfg,
      };
    })
    .filter((p) => p.name);
}

/** Parse the backend `expiration` (ISO string or epoch) or fall back to the JWT `exp` claim. */
export function resolveExpiry(expiration: string | number | null | undefined, token: string): number | null {
  if (typeof expiration === 'number') return expiration < 1e12 ? expiration * 1000 : expiration;
  if (typeof expiration === 'string' && expiration) {
    const t = Date.parse(expiration);
    if (!Number.isNaN(t)) return t;
  }
  const exp = decodeJwt(token)?.['exp'];
  return typeof exp === 'number' ? exp * 1000 : null;
}

export function decodeJwt(token: string): Record<string, unknown> | null {
  try {
    const payload = token.split('.')[1];
    if (!payload) return null;
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(decodeURIComponent(escape(json)));
  } catch {
    return null;
  }
}
