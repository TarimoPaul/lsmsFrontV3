export type RoleStatus = 'ACTIVE' | 'INACTIVE' | string;

export interface Permission {
  uid: string;
  name: string;
  module?: string | null;
  groupName?: string | null;
  description?: string | null;
}

export interface Role {
  uid: string;
  name: string;
  description: string;
  status: RoleStatus;
  permissions: Permission[];
  createdAt?: string | null;
  updatedAt?: string | null;
  isDefault?: boolean;
}

export interface PermissionGroup {
  group: string;
  permissions: Permission[];
}

export interface PermissionModule {
  module: string;
  permissionGroups: PermissionGroup[];
}

/** Body for POST /api/v1/roles (create when uid is absent, update otherwise). */
export interface RoleUpsert {
  uid?: string;
  name: string;
  description: string;
}

/** Roles that ship with the system and should not be deleted from the UI. */
export const PROTECTED_ROLES = new Set(['ROOT', 'ADMIN', 'SUPER_ADMIN']);

/** "SALES_READ_ALL" → "Sales read all" for display. */
export function humanizePermission(name: string): string {
  const s = name.replace(/_/g, ' ').toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function humanizeModule(module: string | null | undefined): string {
  if (!module) return 'Other';
  return module
    .replace(/[_-]+/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
