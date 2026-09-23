import { HttpContext } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';

import { ApiService } from '../api/api.service';
import { ApiError } from '../api/api.types';
import { CrudAction, buildModuleAccess, canAccessSection, mapSectionToModule } from './access-resolver';
import {
  AuthSession,
  AuthUser,
  BranchInfo,
  LoginResponse,
  MeResponse,
  PermissionWithConfig,
  displayName,
  resolveExpiry,
  toNames,
  toPermissionsWithConfig,
} from './auth.models';
import { SKIP_AUTH_REDIRECT } from './auth.tokens';
import { sessionStore } from './session-storage';

export type LogoutReason = 'user' | 'expired' | 'inactivity' | 'unauthorized';

export interface LoginOutcome {
  /** User belongs to >1 branch and must pick one before entering. */
  requiresBranchSelection: boolean;
  branches: BranchInfo[];
}

const AUTH_TIMEOUT = 15_000;
/** Refresh the JWT this long before it expires. */
const REFRESH_LEAD_MS = 2 * 60_000;
/** Re-verify the session with /api/auth/me at most this often. */
const VERIFY_INTERVAL_MS = 5 * 60_000;

/**
 * Authentication + RBAC state — port of Flutter `AuthProvider`.
 * Exposes signals for templates and helpers for permission checks.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);

  private readonly _session = signal<AuthSession | null>(null);
  /** Set during login when the user must pick a branch (session not active yet). */
  private readonly _pendingBranch = signal(false);

  readonly loading = signal(false);
  /** Why the last session ended — the login page shows a matching notice. */
  readonly lastLogoutReason = signal<LogoutReason | null>(null);

  readonly session = this._session.asReadonly();
  readonly user = computed<AuthUser | null>(() => this._session()?.user ?? null);
  readonly token = computed(() => this._session()?.token ?? null);
  readonly isAuthenticated = computed(() => !!this._session() && !this._pendingBranch());
  readonly roles = computed(() => this._session()?.roles ?? []);
  readonly permissions = computed(() => this._session()?.permissions ?? []);
  readonly isRoot = computed(() => {
    const s = this._session();
    return !!s && (s.isRoot || s.roles.some((r) => r.toUpperCase() === 'ROOT'));
  });
  readonly branches = computed(() => this._session()?.branches ?? []);
  readonly activeBranchUid = computed(() => this._session()?.activeBranchUid ?? null);
  readonly activeBranch = computed(
    () => this.branches().find((b) => b.uid === this.activeBranchUid()) ?? null,
  );
  readonly displayName = computed(() => displayName(this.user()));
  readonly primaryRole = computed(() => (this.isRoot() ? 'ROOT' : (this.roles()[0] ?? 'USER')));
  readonly moduleAccess = computed(() => buildModuleAccess(this.permissions(), this.isRoot()));
  private readonly permissionSet = computed(() => new Set(this.permissions().map((p) => p.toUpperCase())));

  private refreshTimer: ReturnType<typeof setTimeout> | undefined;
  private lastVerifiedAt = 0;

  // ─── Lifecycle ─────────────────────────────────────────────────────────────

  /** Restore the tab's session on app start (called from the app initializer). */
  restore(): void {
    const s = sessionStore.load();
    if (!s) return;
    if (s.expiresAt && s.expiresAt <= Date.now()) {
      sessionStore.clear();
      this.lastLogoutReason.set('expired');
      return;
    }
    this._session.set(s);
    this.scheduleRefresh();
    // Verify with the backend shortly after boot (Flutter _scheduleBackgroundVerification).
    setTimeout(() => void this.verify(), 500);
  }

  // ─── Login / branch selection ──────────────────────────────────────────────

  async login(email: string, password: string, rememberMe: boolean): Promise<LoginOutcome> {
    this.loading.set(true);
    this.lastLogoutReason.set(null);
    try {
      const data = await this.api.post<LoginResponse>(
        '/api/auth/login',
        { email, password },
        { timeoutMs: AUTH_TIMEOUT, context: new HttpContext().set(SKIP_AUTH_REDIRECT, true) },
      );
      const session = this.sessionFromLogin(data, email);
      this._session.set(session);
      sessionStore.remember(rememberMe ? email : null);

      const branches = session.branches;
      const needsBranch = data.requiresBranchSelection === true && branches.length > 1;
      this._pendingBranch.set(needsBranch);
      if (!needsBranch) this.activate();
      return { requiresBranchSelection: needsBranch, branches };
    } catch (e) {
      throw this.friendlyLoginError(e);
    } finally {
      this.loading.set(false);
    }
  }

  /** Select / switch the active branch — the backend re-issues a JWT scoped to it. */
  async selectBranch(branchUid: string): Promise<void> {
    const data = await this.api.post<Record<string, unknown>>(
      '/api/auth/select-branch',
      { branchUid },
      { timeoutMs: AUTH_TIMEOUT },
    );
    const info = (data?.['tokenInfo'] as Record<string, unknown>) ?? data;
    const token = info?.['token'] as string | undefined;
    if (!token) throw new ApiError('Branch selection failed: missing token', 200);
    const current = this._session();
    if (!current) throw new ApiError('No active session', 401);
    this._session.set({
      ...current,
      token,
      expiresAt: resolveExpiry(info['expiration'] as string | number | undefined, token),
      activeBranchUid: (info['branchUid'] as string) ?? branchUid,
    });
    this._pendingBranch.set(false);
    this.activate();
  }

  /** Abort a login that is waiting for branch selection. */
  cancelPendingLogin(): void {
    this._pendingBranch.set(false);
    this.clearLocal();
  }

  // ─── Public (unauthenticated) flows ────────────────────────────────────────

  async register(fullName: string, email: string, password: string): Promise<string> {
    const parts = fullName.trim().split(/\s+/);
    // NB: this endpoint answers HTTP 200 with a bare `{ success, message, userUid }`
    // (no envelope) even when it fails — e.g. "Email address already in use".
    const res = await this.api.postResult<{ success?: boolean; message?: string }>(
      '/api/public/register',
      {
        name: fullName.trim(),
        email,
        password,
        firstName: parts[0] ?? '',
        lastName: parts.slice(1).join(' ') || undefined,
      },
      { timeoutMs: AUTH_TIMEOUT, context: new HttpContext().set(SKIP_AUTH_REDIRECT, true) },
    );
    if (res.data && res.data.success === false) {
      const msg = res.data.message ?? 'Registration failed';
      throw new ApiError(msg, /already in use|exists/i.test(msg) ? 409 : 400);
    }
    return res.data?.message ?? res.message ?? 'Registration successful. Please wait for admin approval.';
  }

  async requestPasswordReset(email: string): Promise<string> {
    const res = await this.api.postResult<unknown>(
      '/api/public/password/forgot-password',
      { email },
      { timeoutMs: AUTH_TIMEOUT },
    );
    return res.message ?? 'If your email is registered, you will receive reset instructions shortly.';
  }

  async validateResetToken(token: string): Promise<boolean> {
    try {
      const data = await this.api.get<unknown>('/api/public/password/validate-token', {
        params: { token },
        timeoutMs: AUTH_TIMEOUT,
      });
      if (typeof data === 'boolean') return data;
      if (data && typeof data === 'object' && 'valid' in data) return !!(data as { valid: boolean }).valid;
      return true;
    } catch (e) {
      if (ApiError.from(e).isNetwork) throw e;
      return false;
    }
  }

  async resetPassword(token: string, newPassword: string, confirmPassword: string): Promise<string> {
    const res = await this.api.postResult<unknown>(
      '/api/public/password/reset-password',
      { token, newPassword, confirmPassword },
      { timeoutMs: AUTH_TIMEOUT },
    );
    return res.message ?? 'Password reset successfully';
  }

  // ─── Logout ────────────────────────────────────────────────────────────────

  async logout(reason: LogoutReason = 'user'): Promise<void> {
    const hadSession = !!this._session();
    if (hadSession && reason === 'user') {
      // Best effort — local logout proceeds even if the backend call fails.
      await this.api
        .post('/api/auth/logout', {}, { timeoutMs: 5000, context: new HttpContext().set(SKIP_AUTH_REDIRECT, true) })
        .catch(() => undefined);
    }
    this.clearLocal();
    this.lastLogoutReason.set(reason === 'user' ? null : reason);
    const returnUrl = reason === 'user' ? undefined : this.router.url;
    await this.router.navigate(['/login'], {
      queryParams: returnUrl && !returnUrl.startsWith('/login') ? { returnUrl } : {},
    });
  }

  /** Called by the HTTP interceptor on a 401 from a protected endpoint. */
  handleUnauthorized(): void {
    if (!this._session()) return;
    void this.logout('unauthorized');
  }

  // ─── Session verification & token refresh ──────────────────────────────────

  /** Re-sync user, roles and permissions from `/api/auth/me`. */
  async verify(force = false): Promise<void> {
    if (!this._session()) return;
    if (!force && Date.now() - this.lastVerifiedAt < VERIFY_INTERVAL_MS) return;
    this.lastVerifiedAt = Date.now();
    try {
      const me = await this.api.get<MeResponse>('/api/auth/me', { timeoutMs: AUTH_TIMEOUT });
      const s = this._session();
      if (!s || !me?.email) return;
      const roles = toNames(me.roles);
      const perms = toNames(me.permissions);
      this.updateSession({
        user: {
          ...s.user,
          uid: me.uid ?? s.user.uid,
          email: me.email,
          firstName: me.firstName ?? s.user.firstName,
          lastName: me.lastName ?? s.user.lastName,
          gender: me.gender ?? s.user.gender,
          profileImageUrl: me.profileImageUrl ?? s.user.profileImageUrl,
          privilegeLevel: me.privilegeLevel ?? s.user.privilegeLevel,
        },
        roles: roles.length ? roles : s.roles,
        // Only replace permissions when the backend actually sent some.
        permissions: perms.length ? perms : s.permissions,
        isRoot: me.isRoot ?? s.isRoot,
      });
    } catch (e) {
      // Network blips are ignored; 401s are handled by the interceptor.
      if (ApiError.from(e).isUnauthorized) this.handleUnauthorized();
    }
  }

  private scheduleRefresh(): void {
    clearTimeout(this.refreshTimer);
    const exp = this._session()?.expiresAt;
    if (!exp) return;
    const delay = Math.max(5_000, exp - Date.now() - REFRESH_LEAD_MS);
    // setTimeout caps at ~24.8 days; long-lived tokens just re-schedule.
    this.refreshTimer = setTimeout(() => void this.refreshToken(), Math.min(delay, 2 ** 31 - 1));
  }

  async refreshToken(): Promise<void> {
    const s = this._session();
    if (!s) return;
    try {
      const data = await this.api.post<{ accessToken?: string; expiresAt?: string | number }>(
        '/api/auth/refresh',
        { token: s.token },
        { timeoutMs: AUTH_TIMEOUT, context: new HttpContext().set(SKIP_AUTH_REDIRECT, true) },
      );
      if (!data?.accessToken) throw new ApiError('Token refresh failed', 400);
      this.updateSession({ token: data.accessToken, expiresAt: resolveExpiry(data.expiresAt, data.accessToken) });
      this.scheduleRefresh();
    } catch (e) {
      const err = ApiError.from(e);
      const expired = !s.expiresAt || s.expiresAt <= Date.now() + 10_000;
      if (err.isNetwork && !expired) {
        // Retry shortly while the token is still valid.
        this.refreshTimer = setTimeout(() => void this.refreshToken(), 30_000);
        return;
      }
      void this.logout('expired');
    }
  }

  // ─── RBAC helpers ──────────────────────────────────────────────────────────

  hasPermission(permission: string): boolean {
    return this.isRoot() || this.permissionSet().has(permission.toUpperCase());
  }

  hasAnyPermission(permissions: readonly string[]): boolean {
    return permissions.some((p) => this.hasPermission(p));
  }

  hasAllPermissions(permissions: readonly string[]): boolean {
    return permissions.every((p) => this.hasPermission(p));
  }

  hasRole(role: string): boolean {
    return this.isRoot() || this.roles().some((r) => r.toUpperCase() === role.toUpperCase());
  }

  /** Module-level CRUD check via the access map (e.g. `can('sales', 'create')`). */
  can(moduleOrSection: string, action: CrudAction = 'read'): boolean {
    if (this.isRoot()) return true;
    return !!this.moduleAccess()[mapSectionToModule(moduleOrSection)]?.[action];
  }

  canAccessSection(section: string): boolean {
    return canAccessSection(section, {
      authenticated: this.isAuthenticated(),
      isRoot: this.isRoot(),
      access: this.moduleAccess(),
    });
  }

  permissionConfig(name: string): PermissionWithConfig | undefined {
    const upper = name.toUpperCase();
    return this._session()?.permissionsWithConfig.find((p) => p.name.toUpperCase() === upper);
  }

  permissionConfigValue(name: string, key: string, fallback?: string): string | undefined {
    return this.permissionConfig(name)?.config[key] ?? fallback;
  }

  /** Days a sale may be backdated (SALES_BACKDATE → backdate_days; default 3). */
  maxBackdateDays(): number {
    if (this.isRoot()) return 36_500;
    if (!this.hasPermission('SALES_BACKDATE')) return 0;
    const raw = this.permissionConfigValue('SALES_BACKDATE', 'backdate_days');
    if (!raw) return 3;
    if (raw.toLowerCase() === 'unlimited') return 36_500;
    const n = Number.parseInt(raw, 10);
    return Number.isFinite(n) ? n : 3;
  }

  // ─── Internals ─────────────────────────────────────────────────────────────

  private activate(): void {
    const s = this._session();
    if (!s) return;
    sessionStore.save(s);
    this.lastVerifiedAt = Date.now();
    this.scheduleRefresh();
  }

  private updateSession(patch: Partial<AuthSession>): void {
    const s = this._session();
    if (!s) return;
    const next = { ...s, ...patch };
    this._session.set(next);
    if (!this._pendingBranch()) sessionStore.save(next);
  }

  private clearLocal(): void {
    clearTimeout(this.refreshTimer);
    this._session.set(null);
    this._pendingBranch.set(false);
    sessionStore.clear();
  }

  private sessionFromLogin(data: LoginResponse, email: string): AuthSession {
    const info = data?.tokenInfo;
    if (!info?.token) throw new ApiError('Invalid authentication response: missing token', 200);

    let roles = toNames(data.roles);
    if (!roles.length && info && 'role' in info) roles = toNames([(info as Record<string, unknown>)['role']]);
    const isRoot =
      !!info.isRoot || !!data.isRoot || !!info.hasRootRole || roles.some((r) => r.toUpperCase() === 'ROOT');

    const branches: BranchInfo[] = (data.branches ?? [])
      .filter((b) => b && b.uid)
      .map((b) => ({ uid: b.uid!, branchName: b.branchName ?? 'Tawi', isMainBranch: !!b.isMainBranch }));

    return {
      token: info.token,
      expiresAt: resolveExpiry(info.expiration, info.token),
      user: {
        uid: info.userId ?? '',
        email: info.email ?? email,
        firstName: info.firstName ?? '',
        lastName: info.lastName ?? '',
        gender: info.gender ?? null,
        profileImageUrl: info.profileImageUrl ?? null,
        privilegeLevel: info.privilegeLevel ?? data.privilegeLevel ?? 'USER',
        isAdmin: !!info.isAdmin,
      },
      roles,
      permissions: toNames(data.permissions),
      permissionsWithConfig: toPermissionsWithConfig(data.permissionsWithConfig),
      isRoot,
      branches,
      activeBranchUid: data.selectedBranchUid ?? info.branchUid ?? null,
    };
  }

  private friendlyLoginError(e: unknown): ApiError {
    const err = ApiError.from(e, 'Login failed');
    // The backend answers an unknown email with 400 "Transaction was rolled back…"
    // and a wrong password with 401 plain text — both mean bad credentials.
    if (
      err.status === 401 ||
      err.status === 400 ||
      /invalid email or password|bad credentials|rolled back/i.test(err.message)
    ) {
      return new ApiError('INVALID_CREDENTIALS', err.status || 401);
    }
    if (err.status === 429) return new ApiError('ACCOUNT_LOCKED', 429);
    if (err.isNetwork) return new ApiError('NETWORK', 0);
    return err;
  }
}
