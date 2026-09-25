/**
 * Single registry of app modules — drives the dashboard tiles, the sidebar
 * and the routes (Flutter kept three copies of this list in main_menu.dart,
 * CustomerSideBar.dart and sidebar_order_manager.dart).
 *
 * `id` is the section id used by the access resolver (`canAccessSection`).
 */

export type ModuleCategory = 'TRANSACTIONS' | 'INVENTORY' | 'MANAGEMENT' | 'FINANCE' | 'ADMINISTRATION';

export interface AppModule {
  id: string;
  route: string;
  category: ModuleCategory;
  icon: string;
  /** CSS colour (token) for the tile accent. */
  color: string;
  title: { en: string; sw: string };
  /** Short label for the sidebar. */
  short: { en: string; sw: string };
  description: { en: string; sw: string };
  /** False until the module is ported to Angular (tile shows "coming soon"). */
  ready?: boolean;
}

export const CATEGORY_ORDER: ModuleCategory[] = ['TRANSACTIONS', 'INVENTORY', 'MANAGEMENT', 'FINANCE', 'ADMINISTRATION'];

export const CATEGORY_LABELS: Record<ModuleCategory, { en: string; sw: string; icon: string }> = {
  TRANSACTIONS: { en: 'Transactions', sw: 'Miamala', icon: 'swap_horiz' },
  INVENTORY: { en: 'Inventory', sw: 'Hesabu ya Mali', icon: 'inventory_2' },
  MANAGEMENT: { en: 'Management', sw: 'Usimamizi', icon: 'groups' },
  FINANCE: { en: 'Finance', sw: 'Fedha', icon: 'account_balance' },
  ADMINISTRATION: { en: 'Administration', sw: 'Utawala', icon: 'admin_panel_settings' },
};

export const APP_MODULES: AppModule[] = [
  // ── TRANSACTIONS ──
  {
    id: 'sales',
    route: '/sales',
    category: 'TRANSACTIONS',
    icon: 'trending_up',
    color: 'var(--c-success)',
    title: { en: 'Sales', sw: 'Usimamizi wa Mauzo' },
    short: { en: 'Sales', sw: 'Mauzo' },
    description: {
      en: 'Monitor sales performance and analytics',
      sw: 'Uchanganuzi wa mauzo, ripoti, na usimamizi wa miamala',
    },
    ready: true,
  },
  {
    id: 'purchases',
    route: '/purchases',
    category: 'TRANSACTIONS',
    icon: 'shopping_cart',
    color: 'var(--c-warning)',
    title: { en: 'Purchases', sw: 'Usimamizi wa Ununuzi' },
    short: { en: 'Purchases', sw: 'Ununuzi' },
    description: {
      en: 'Track purchase orders and suppliers',
      sw: 'Usimamizi wa amri za ununuzi na ufuatiliaji wa wazalishaji',
    },
    ready: true,
  },
  {
    id: 'suppliers',
    route: '/suppliers',
    category: 'TRANSACTIONS',
    icon: 'local_shipping',
    color: 'var(--c-teal)',
    title: { en: 'Suppliers', sw: 'Wasambazaji' },
    short: { en: 'Suppliers', sw: 'Wasambazaji' },
    description: { en: 'Supplier accounts, payments and statements', sw: 'Akaunti za wasambazaji, malipo na taarifa' },
    ready: true,
  },
  {
    id: 'reconciliation',
    route: '/reconciliation',
    category: 'TRANSACTIONS',
    icon: 'balance',
    color: 'var(--c-info)',
    title: { en: 'Reconciliation', sw: 'Ulinganisho wa Hesabu' },
    short: { en: 'Reconciliation', sw: 'Ulinganisho' },
    description: { en: 'Daily cash, bank and mobile-money reconciliation', sw: 'Ulinganisho wa kila siku wa taslimu, benki na pesa za simu' },
    ready: true,
  },
  // ── INVENTORY ──
  {
    id: 'products',
    route: '/products',
    category: 'INVENTORY',
    icon: 'inventory_2',
    color: 'var(--c-warning)',
    title: { en: 'Products', sw: 'Usimamizi wa Bidhaa' },
    short: { en: 'Products', sw: 'Bidhaa' },
    description: {
      en: 'Manage product catalog and inventory',
      sw: 'Usimamizi wa katalogi ya bidhaa na ufuatiliaji wa hesabu',
    },
    ready: true,
  },
  {
    id: 'store-management',
    route: '/store',
    category: 'INVENTORY',
    icon: 'warehouse',
    color: '#059669',
    title: { en: 'Store Management', sw: 'Usimamizi wa Duka' },
    short: { en: 'Store', sw: 'Duka' },
    description: {
      en: 'Complete inventory and stock control',
      sw: 'Usimamizi wa kina wa hisa na vichupo vya uongozaji',
    },
    ready: true,
  },
  {
    id: 'counting',
    route: '/counting',
    category: 'INVENTORY',
    icon: 'checklist',
    color: 'var(--c-info)',
    title: { en: 'Stock Count', sw: 'Kuhesabu Mali' },
    short: { en: 'Stock Count', sw: 'Kuhesabu Mali' },
    description: {
      en: 'Blind stock-count sessions and variances',
      sw: 'Zoezi la kuhesabu mali kwa mfumo wa blind count',
    },
  },
  {
    id: 'categories',
    route: '/categories',
    category: 'INVENTORY',
    icon: 'category',
    color: 'var(--c-info)',
    title: { en: 'Categories', sw: 'Usimamizi wa Kategoria' },
    short: { en: 'Categories', sw: 'Kategoria' },
    description: {
      en: 'Organize products with categories',
      sw: 'Panga bidhaa kwa kategoria na makategoria ndogo',
    },
    ready: true,
  },
  // ── MANAGEMENT ──
  {
    id: 'customers',
    route: '/customers',
    category: 'MANAGEMENT',
    icon: 'work',
    color: 'var(--c-secondary)',
    title: { en: 'Customers Management', sw: 'Usimamizi wa Wateja' },
    short: { en: 'Customers', sw: 'Wateja' },
    description: {
      en: 'Handle customer data and relationships',
      sw: 'Usimamizi wa wateja na muundo wa shirika',
    },
    ready: true,
  },
  {
    id: 'users',
    route: '/users',
    category: 'MANAGEMENT',
    icon: 'group',
    color: 'var(--c-success)',
    title: { en: 'User Management', sw: 'Usimamizi wa Watumiaji' },
    short: { en: 'Users', sw: 'Watumiaji' },
    description: {
      en: 'Manage user accounts, roles, and permissions',
      sw: 'Simamia akaunti za watumiaji, ruhusa, na viwango vya ufikiaji',
    },
    ready: true,
  },
  {
    id: 'branch-management',
    route: '/branches',
    category: 'MANAGEMENT',
    icon: 'business',
    color: 'var(--c-info)',
    title: { en: 'Branch Management', sw: 'Usimamizi wa Matawi' },
    short: { en: 'Branches', sw: 'Matawi' },
    description: {
      en: 'Manage branches, locations, and branch operations',
      sw: 'Simamia matawi, maeneo, na operesheni za matawi',
    },
    ready: true,
  },
  // ── FINANCE ──
  {
    id: 'capital-management',
    route: '/capital',
    category: 'FINANCE',
    icon: 'account_balance',
    color: 'var(--c-primary)',
    title: { en: 'Capital Management', sw: 'Usimamizi wa Mtaji' },
    short: { en: 'Capital', sw: 'Mtaji' },
    description: {
      en: 'Complete capital expenditure tracking and asset management',
      sw: 'Mipango ya kifedha, usimamizi wa bajeti, na ufuatiliaji wa matumizi',
    },
  },
  {
    id: 'general-ledger',
    route: '/general-ledger',
    category: 'FINANCE',
    icon: 'menu_book',
    color: '#059669',
    title: { en: 'General Ledger', sw: 'Leja Kuu' },
    short: { en: 'General Ledger', sw: 'Leja Kuu' },
    description: {
      en: 'Double-entry general ledger and financial postings',
      sw: 'Leja kuu ya double-entry na maingizo ya kifedha',
    },
  },
  {
    id: 'reports',
    route: '/reports',
    category: 'FINANCE',
    icon: 'analytics',
    color: 'var(--c-secondary)',
    title: { en: 'Reports & Analytics', sw: 'Ripoti' },
    short: { en: 'Reports', sw: 'Ripoti' },
    description: {
      en: 'Export stock reports, financial data, and analytics',
      sw: 'Ripoti za hisa, takwimu za fedha na uchanganuzi',
    },
  },
  // ── ADMINISTRATION ──
  {
    id: 'roles',
    route: '/roles',
    category: 'ADMINISTRATION',
    icon: 'admin_panel_settings',
    color: 'var(--c-error)',
    title: { en: 'Role Management', sw: 'Usimamizi wa Majukumu' },
    short: { en: 'Roles', sw: 'Majukumu' },
    description: {
      en: 'Configure user roles and permissions',
      sw: 'Sanidi majukumu ya watumiaji na usimamizi wa ruhusa',
    },
    ready: true,
  },
  {
    id: 'business-settings',
    route: '/business-settings',
    category: 'ADMINISTRATION',
    icon: 'settings_applications',
    color: 'var(--c-warning)',
    title: { en: 'Business Settings', sw: 'Mipangilio ya Biashara' },
    short: { en: 'Settings', sw: 'Mipangilio' },
    description: {
      en: 'Configure business operations and preferences',
      sw: 'Sanidi mipangilio ya jumla ya biashara',
    },
  },
  {
    id: 'settings-approvals',
    route: '/settings-approvals',
    category: 'ADMINISTRATION',
    icon: 'approval',
    color: '#059669',
    title: { en: 'Settings Approvals', sw: 'Idhini za Mipangilio' },
    short: { en: 'Approvals', sw: 'Idhini' },
    description: {
      en: 'Review and approve pending system changes',
      sw: 'Simamia na thibitisha mabadiliko ya mipangilio',
    },
  },
  {
    id: 'items-measure',
    route: '/items-measure',
    category: 'ADMINISTRATION',
    icon: 'straighten',
    color: 'var(--c-info)',
    title: { en: 'Items Measure', sw: 'Usimamizi wa Vipimo vya Bidhaa' },
    short: { en: 'Measures', sw: 'Vipimo' },
    description: {
      en: 'Manage units and measurements',
      sw: 'Simamia aina za kipimo za bidhaa na mipangilio ya ufungaji',
    },
    ready: true,
  },
];

export interface AccountLink {
  id: 'profile' | 'notifications' | 'security' | 'settings';
  route: string;
  icon: string;
  title: { en: string; sw: string };
}

export const ACCOUNT_LINKS: AccountLink[] = [
  { id: 'profile', route: '/account/profile', icon: 'person', title: { en: 'Profile', sw: 'Wasifu' } },
  { id: 'notifications', route: '/account/notifications', icon: 'notifications', title: { en: 'Notifications', sw: 'Arifa' } },
  { id: 'security', route: '/account/security', icon: 'security', title: { en: 'Security', sw: 'Usalama' } },
  { id: 'settings', route: '/account/settings', icon: 'settings', title: { en: 'Settings', sw: 'Mipangilio' } },
];

export function findModule(id: string): AppModule | undefined {
  return APP_MODULES.find((m) => m.id === id);
}
