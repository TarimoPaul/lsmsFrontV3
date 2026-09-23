import { buildModuleAccess, canAccessSection, mapSectionToModule, parsePermission } from './access-resolver';

describe('parsePermission (Flutter ModuleAccessResolver parity)', () => {
  it('splits MODULE_ACTION and normalises aliases', () => {
    expect(parsePermission('SALES_READ')).toEqual({ module: 'sales', action: 'read' });
    expect(parsePermission('PRODUCT_CREATE')).toEqual({ module: 'products', action: 'create' });
    expect(parsePermission('STOCK_VIEW')).toEqual({ module: 'store', action: 'read' });
    expect(parsePermission('ROLE_WRITE')).toEqual({ module: 'roles', action: 'create' });
    expect(parsePermission('USER_EDIT')).toEqual({ module: 'users', action: 'update' });
  });

  it('uses the LAST token as the action for 3+ token names (bug K1)', () => {
    expect(parsePermission('BUSINESS_SETTINGS_READ')).toEqual({ module: 'business_settings', action: 'read' });
    expect(parsePermission('SETTINGS_APPROVAL_READ')).toEqual({ module: 'settings_approvals', action: 'read' });
  });

  it('maps report and counting permissions to their tiles', () => {
    expect(parsePermission('STOCK_REPORT')).toEqual({ module: 'reports', action: 'read' });
    expect(parsePermission('SALES_REPORT_VIEW')).toEqual({ module: 'reports', action: 'read' });
    expect(parsePermission('COUNTING_PERFORM')).toEqual({ module: 'counting', action: 'read' });
    expect(parsePermission('BYPASS_COUNTING')).toEqual({ module: 'counting', action: 'read' });
  });

  it('applies the override table', () => {
    expect(parsePermission('SALES_READ_ALL')).toEqual({ module: 'sales', action: 'read' });
    expect(parsePermission('USER_RESET_PASSWORD')).toEqual({ module: 'users', action: 'update' });
    expect(parsePermission('SUPPLIER_PAYMENT_PROCESS')).toEqual({ module: 'suppliers', action: 'update' });
  });

  it('ignores single-token names', () => {
    expect(parsePermission('ADMIN')).toBeNull();
  });
});

describe('canAccessSection', () => {
  const cashier = ['SALES_READ', 'SALES_CREATE', 'CUSTOMER_READ', 'PRODUCT_VIEW'];
  const ctx = (perms: string[], isRoot = false, authenticated = true) => ({
    authenticated,
    isRoot,
    access: buildModuleAccess(perms, isRoot),
  });

  it('unlocks only modules the role can read', () => {
    const c = ctx(cashier);
    expect(canAccessSection('sales', c)).toBe(true);
    expect(canAccessSection('customers', c)).toBe(true);
    expect(canAccessSection('products', c)).toBe(true);
    expect(canAccessSection('roles', c)).toBe(false);
    expect(canAccessSection('store-management', c)).toBe(false);
    expect(canAccessSection('general-ledger', c)).toBe(false);
  });

  it('create-only permission does not unlock the tile', () => {
    expect(canAccessSection('purchases', ctx(['PURCHASE_CREATE']))).toBe(false);
  });

  it('ROOT sees every module', () => {
    const c = ctx([], true);
    for (const s of ['sales', 'roles', 'general-ledger', 'branch-management', 'settings-approvals']) {
      expect(canAccessSection(s, c)).toBe(true);
    }
  });

  it('self-service sections need only a session', () => {
    expect(canAccessSection('profile', ctx([]))).toBe(true);
    expect(canAccessSection('dashboard', ctx([]))).toBe(true);
    expect(canAccessSection('profile', ctx([], false, false))).toBe(false);
    expect(canAccessSection('sales', ctx(cashier, false, false))).toBe(false);
  });

  it('maps UI section ids to RBAC modules', () => {
    expect(mapSectionToModule('store-management')).toBe('store');
    expect(mapSectionToModule('general-ledger')).toBe('finance');
    expect(mapSectionToModule('items-measure')).toBe('items');
  });
});
