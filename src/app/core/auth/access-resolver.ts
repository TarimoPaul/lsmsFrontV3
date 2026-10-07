/**
 * Port of Flutter `ModuleAccessResolver` — the single source of truth that
 * turns raw RBAC permission names (`SALES_READ`, `STOCK_REPORT`, …) into a
 * module → CRUD access map and decides whether a module (sidebar item /
 * dashboard tile) is unlocked. Both the dashboard and the sidebar MUST go
 * through here so their access logic can never diverge.
 */

export type CrudAction = 'create' | 'read' | 'update' | 'delete';
export type ModuleAccessMap = Record<string, Partial<Record<string, boolean>>>;

/** Account/self-service sections any active user may open. */
const SELF_SERVICE = new Set(['profile', 'notifications', 'security', 'settings']);

/** UI section id → RBAC module key. */
const SECTION_MODULE: Record<string, string> = {
  users: 'users',
  customers: 'customers',
  products: 'products',
  categories: 'categories',
  purchases: 'purchases',
  sales: 'sales',
  reconciliation: 'reconciliation',
  'store-management': 'store',
  counting: 'counting',
  roles: 'roles',
  'capital-management': 'capital',
  'general-ledger': 'finance',
  suppliers: 'suppliers',
  'items-measure': 'items',
  'branch-management': 'branch',
  'business-settings': 'business_settings',
  'settings-approvals': 'settings_approvals',
  reports: 'reports',
  payments: 'payments',
  dashboard: 'dashboard',
};

const KNOWN_MODULES = [
  'users',
  'customers',
  'products',
  'categories',
  'purchases',
  'sales',
  'reconciliation',
  'store',
  'counting',
  'roles',
  'capital',
  'finance',
  'suppliers',
  'items',
  'branch',
  'business_settings',
  'settings_approvals',
  'reports',
];

/**
 * Permissions whose LAST token isn't a CRUD verb (verb in the middle, or a
 * capability flag). Checked before the generic split.
 */
const OVERRIDES: Record<string, { module: string; action: string }> = {
  BUSINESS_SETTINGS_ADMIN_DASHBOARD: { module: 'business_settings', action: 'read' },
  BUSINESS_SETTINGS_FORCE_APPLY: { module: 'business_settings', action: 'update' },
  BUSINESS_SETUP_INITIAL: { module: 'business_settings', action: 'create' },
  CAPITAL_ASSET_MANAGE: { module: 'capital', action: 'update' },
  PRODUCT_BARCODE_GENERATE: { module: 'products', action: 'create' },
  STOCK_ALERT_CONFIG: { module: 'store', action: 'update' },
  SUPPLIER_PAYMENT_PROCESS: { module: 'suppliers', action: 'update' },
  USER_RESET_PASSWORD: { module: 'users', action: 'update' },
  BRANCH_CREATE_ADMIN: { module: 'branch', action: 'create' },
  BRANCH_DELETE_ADMIN: { module: 'branch', action: 'delete' },
  RECONCILIATION_VIEW_ALL: { module: 'reconciliation', action: 'read' },
  SALES_COMMISSION_CALCULATE: { module: 'sales', action: 'read' },
  SALES_DISCOUNT_APPLY: { module: 'sales', action: 'update' },
  SALES_EXCHANGE_PROCESS: { module: 'sales', action: 'update' },
  SALES_NEGATIVE_STOCK: { module: 'sales', action: 'read' },
  SALES_READ_ALL: { module: 'sales', action: 'read' },
  SALES_RETURN_INITIATE: { module: 'sales', action: 'create' },
  SALES_RETURN_PROCESS: { module: 'sales', action: 'update' },
  SALES_VIEW_NET_PROFIT: { module: 'sales', action: 'read' },
  SALES_VIEW_PROFIT: { module: 'sales', action: 'read' },
  SETTINGS_APPROVAL_REJECT: { module: 'settings_approvals', action: 'update' },
};

const MODULE_ALIASES: Record<string, string> = {
  user: 'users',
  customer: 'customers',
  product: 'products',
  category: 'categories',
  purchase: 'purchases',
  sale: 'sales',
  sales: 'sales',
  stock: 'store',
  store: 'store',
  inventory: 'store',
  capital: 'capital',
  role: 'roles',
  measure: 'items',
  item: 'items',
  permission: 'permissions',
  payment: 'payments',
  dashboard: 'dashboard',
  report: 'reports',
  supplier: 'suppliers',
  branch: 'branch',
  business: 'business_settings',
  settings: 'settings_approvals',
  export: 'exports',
  system: 'system',
  admin: 'system',
  audit: 'system',
  log: 'system',
  finance: 'finance',
};

const ACTION_ALIASES: Record<string, string> = {
  create: 'create',
  add: 'create',
  new: 'create',
  write: 'create',
  read: 'read',
  view: 'read',
  list: 'read',
  update: 'update',
  edit: 'update',
  modify: 'update',
  delete: 'delete',
  remove: 'delete',
  destroy: 'delete',
  approve: 'update',
  cancel: 'update',
  suspend: 'update',
  activate: 'update',
  import: 'create',
  export: 'read',
};

export function parsePermission(permission: string): { module: string; action: string } | null {
  const upper = permission.toUpperCase();

  // Any *_REPORT / *_REPORT_* grants read on the reports module.
  if (upper.endsWith('_REPORT') || upper.includes('_REPORT_')) return { module: 'reports', action: 'read' };

  // Counting permissions are verb-shaped; any of them unlocks the tile.
  if (upper.startsWith('COUNTING_') || upper === 'BYPASS_COUNTING') return { module: 'counting', action: 'read' };

  const override = OVERRIDES[upper];
  if (override) return override;

  const parts = permission.split('_');
  if (parts.length < 2) return null;
  const module = parts[0].toLowerCase();
  const action = parts[parts.length - 1].toLowerCase();
  return {
    module: MODULE_ALIASES[module] ?? module,
    action: ACTION_ALIASES[action] ?? action,
  };
}

export function buildModuleAccess(permissions: readonly string[], isRoot: boolean): ModuleAccessMap {
  const map: ModuleAccessMap = {};
  if (isRoot) {
    const modules = new Set(KNOWN_MODULES);
    for (const p of permissions) {
      const parsed = parsePermission(p);
      if (parsed) modules.add(parsed.module);
    }
    for (const m of modules) map[m] = { create: true, read: true, update: true, delete: true };
    return map;
  }
  for (const p of permissions) {
    const parsed = parsePermission(p);
    if (!parsed) continue;
    (map[parsed.module] ??= {})[parsed.action] = true;
  }
  return map;
}

export function mapSectionToModule(section: string): string {
  return SECTION_MODULE[section] ?? section;
}

/** Whether a section (sidebar id / dashboard tile) is unlocked. */
export function canAccessSection(
  section: string,
  ctx: { authenticated: boolean; isRoot: boolean; access: ModuleAccessMap },
): boolean {
  if (SELF_SERVICE.has(section)) return ctx.authenticated;
  if (section === 'dashboard' || section === 'main-menu') return ctx.authenticated;
  if (!ctx.authenticated) return false;
  if (ctx.isRoot) return true;
  return ctx.access[mapSectionToModule(section)]?.['read'] ?? false;
}
