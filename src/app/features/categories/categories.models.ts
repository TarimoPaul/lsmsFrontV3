/**
 * Row shape from GET /api/v1/categories (Spring `CategoryDto`).
 *
 * The backend only stores name + description: `isActive` is always true and
 * never persisted, and `createdAt` is not selected by the list query — so the
 * Flutter Active/Inactive toggle (a silent no-op) is not ported.
 */
export interface Category {
  uid: string;
  categoryName: string;
  description: string | null;
}

export interface CategoryRequest {
  categoryName: string;
  description: string | null;
}

export type CategoryFilter = 'ALL' | 'WITH_PRODUCTS' | 'EMPTY' | 'NO_DESCRIPTION';

/** Backend `categoryName` column is VARCHAR(255); description kept to 500 like other modules. */
export const NAME_MAX = 100;
export const DESCRIPTION_MAX = 500;

/** Case/space-insensitive key, so "Beer" and "beer " count as the same category. */
export function nameKey(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLowerCase();
}

const PALETTE = [
  'var(--c-primary)',
  'var(--c-info)',
  'var(--c-success)',
  '#9c27b0',
  '#ff9800',
  '#009688',
  '#e91e63',
  '#673ab7',
  '#795548',
  '#2196f3',
];

/** Stable accent colour per category name. */
export function categoryColor(name: string): string {
  let h = 0;
  for (const ch of nameKey(name)) h = (h * 31 + ch.charCodeAt(0)) | 0;
  return PALETTE[Math.abs(h) % PALETTE.length];
}

export function categoryInitials(name: string): string {
  const parts = name.trim().split(/[\s\-_/]+/).filter(Boolean);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? parts[0]?.[1] ?? '')).toUpperCase() || '?';
}
