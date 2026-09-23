import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';

import { ApiError } from '../api/api.types';
import { AuthService } from './auth.service';
import { authGuard, guestGuard, sectionGuard } from './guards';
import { authInterceptor } from './interceptors';

/** Shape returned by POST /api/auth/login for a non-root cashier. */
function loginPayload(overrides: Record<string, unknown> = {}) {
  return {
    status: 'Success',
    message: 'Login successful',
    data: {
      tokenInfo: {
        token: 'jwt-token',
        expiration: new Date(Date.now() + 3_600_000).toISOString(),
        email: 'cashier@shop.co.tz',
        userId: 'u-1',
        firstName: 'Asha',
        lastName: 'Juma',
        isRoot: false,
        privilegeLevel: 'USER',
      },
      roles: ['SALES'],
      permissions: ['SALES_READ', 'SALES_CREATE', 'CUSTOMER_READ'],
      permissionsWithConfig: [{ name: 'SALES_BACKDATE', config: { backdate_days: '7' } }],
      isRoot: false,
      branches: [{ uid: 'b-1', branchName: 'Main Branch', isMainBranch: true }],
      selectedBranchUid: 'b-1',
      requiresBranchSelection: false,
      ...overrides,
    },
  };
}

describe('AuthService', () => {
  let auth: AuthService;
  let http: HttpTestingController;

  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: '**', children: [] }]),
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    auth = TestBed.inject(AuthService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify({ ignoreCancelled: true }));

  async function signIn(payload = loginPayload()) {
    const p = auth.login('cashier@shop.co.tz', 'secret', true);
    http.expectOne('/api/auth/login').flush(payload);
    return p;
  }

  it('builds the session from the login response', async () => {
    const outcome = await signIn();
    expect(outcome.requiresBranchSelection).toBe(false);
    expect(auth.isAuthenticated()).toBe(true);
    expect(auth.displayName()).toBe('Asha Juma');
    expect(auth.roles()).toEqual(['SALES']);
    expect(auth.isRoot()).toBe(false);
    expect(auth.activeBranch()?.branchName).toBe('Main Branch');
    expect(JSON.parse(sessionStorage.getItem('lsms_session')!).token).toBe('jwt-token');
    expect(localStorage.getItem('savedEmail')).toBe('cashier@shop.co.tz');
  });

  it('answers RBAC questions from the permissions', async () => {
    await signIn();
    expect(auth.hasPermission('SALES_READ')).toBe(true);
    expect(auth.hasPermission('ROLE_WRITE')).toBe(false);
    expect(auth.can('sales', 'create')).toBe(true);
    expect(auth.can('sales', 'delete')).toBe(false);
    expect(auth.canAccessSection('customers')).toBe(true);
    expect(auth.canAccessSection('roles')).toBe(false);
    expect(auth.maxBackdateDays()).toBe(0); // no SALES_BACKDATE permission
  });

  it('treats ROOT as having every permission', async () => {
    await signIn(loginPayload({ isRoot: true, roles: [], permissions: [] }));
    expect(auth.isRoot()).toBe(true);
    expect(auth.hasPermission('ANYTHING_AT_ALL')).toBe(true);
    expect(auth.canAccessSection('general-ledger')).toBe(true);
    expect(auth.primaryRole()).toBe('ROOT');
  });

  it('holds the session until a branch is picked for multi-branch users', async () => {
    const outcome = await signIn(
      loginPayload({
        branches: [
          { uid: 'b-1', branchName: 'Kariakoo' },
          { uid: 'b-2', branchName: 'Mwenge' },
        ],
        selectedBranchUid: null,
        requiresBranchSelection: true,
      }),
    );
    expect(outcome.requiresBranchSelection).toBe(true);
    expect(auth.isAuthenticated()).toBe(false);

    const sel = auth.selectBranch('b-2');
    const req = http.expectOne('/api/auth/select-branch');
    expect(req.request.headers.get('Authorization')).toBe('Bearer jwt-token');
    expect(req.request.body).toEqual({ branchUid: 'b-2' });
    req.flush({ status: 'Success', data: { token: 'branch-token', branchUid: 'b-2' } });
    await sel;
    expect(auth.isAuthenticated()).toBe(true);
    expect(auth.token()).toBe('branch-token');
    expect(auth.activeBranch()?.branchName).toBe('Mwenge');
  });

  it('maps backend login failures to friendly codes', async () => {
    const cases: Array<[number, string | object, string]> = [
      [401, 'Invalid email or password', 'INVALID_CREDENTIALS'],
      [400, { status: 'Error', message: 'Transaction was rolled back.' }, 'INVALID_CREDENTIALS'],
      [429, 'Account temporarily locked. Try again in 15 minutes.', 'ACCOUNT_LOCKED'],
    ];
    for (const [status, body, code] of cases) {
      const p = auth.login('x@y.com', 'bad', false);
      http.expectOne('/api/auth/login').flush(body, { status, statusText: 'err' });
      await expect(p).rejects.toMatchObject({ message: code });
    }
    expect(auth.isAuthenticated()).toBe(false);
  });

  it('attaches the bearer token and logs out on 401', async () => {
    await signIn();
    const router = TestBed.inject(Router);
    const nav = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    const p = auth['api'].get('/api/v1/sales').catch((e: unknown) => e);
    const req = http.expectOne('/api/v1/sales');
    expect(req.request.headers.get('Authorization')).toBe('Bearer jwt-token');
    req.flush('Unauthorized', { status: 401, statusText: 'Unauthorized' });
    const err = await p;
    expect(err).toBeInstanceOf(ApiError);
    await Promise.resolve();
    expect(auth.isAuthenticated()).toBe(false);
    expect(auth.lastLogoutReason()).toBe('unauthorized');
    expect(nav).toHaveBeenCalledWith(['/login'], expect.anything());
    expect(sessionStorage.getItem('lsms_session')).toBeNull();
  });

  it('restores a saved session and drops an expired one', async () => {
    await signIn();
    const fresh = TestBed.inject(AuthService);
    expect(fresh.isAuthenticated()).toBe(true);

    const s = JSON.parse(sessionStorage.getItem('lsms_session')!);
    s.expiresAt = Date.now() - 1000;
    sessionStorage.setItem('lsms_session', JSON.stringify(s));
    localStorage.setItem('lsms_session_global', JSON.stringify(s));
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    const restored = TestBed.inject(AuthService);
    restored.restore();
    expect(restored.isAuthenticated()).toBe(false);
    expect(restored.lastLogoutReason()).toBe('expired');
  });

  describe('guards', () => {
    const run = (guard: typeof authGuard, data: Record<string, unknown> = {}, url = '/sales') =>
      TestBed.runInInjectionContext(() => guard({ data } as never, { url } as never));

    it('authGuard redirects to /login with returnUrl when signed out', () => {
      const res = run(authGuard);
      expect(String(res)).toBe('/login?returnUrl=%2Fsales');
    });

    it('guestGuard sends signed-in users to the dashboard', async () => {
      await signIn();
      expect(String(run(guestGuard))).toBe('/dashboard');
    });

    it('sectionGuard allows readable modules and blocks others', async () => {
      await signIn();
      expect(run(sectionGuard, { section: 'sales' })).toBe(true);
      expect(String(run(sectionGuard, { section: 'roles' }))).toBe('/access-denied?section=roles');
    });
  });
});
