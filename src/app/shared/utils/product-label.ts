/**
 * The ONE product label used across the app:
 *
 *   NAME UNIT · category · N pcs/abbr      e.g.  CUCA 200ML · SPIRIT · 30 pcs/ctn
 *
 * - NAME UNIT: the unit of the product's primary measure, not repeated when the
 *   name already carries it (same rule as backend `Products.displayName`).
 * - N pcs/abbr: pieces in one package and what that package is called for THIS
 *   product (ctn, crt…) — never a hard-coded "crate". Left out when the product
 *   is not bought by the package (no pieces-per-package, or 1).
 *
 * Which measure is "primary" when a product has several is decided by the
 * backend (package measure before a single-unit one, then lowest id) — the
 * server sends measures in that order and the abbreviation of that measure.
 */

export interface ProductLabelParts {
  name: string;
  /** Unit of the primary measure (750ML). */
  unit?: string | null;
  category?: string | null;
  piecesPerPackage?: number | null;
  /** Package abbreviation of the primary measure (ctn). */
  abbreviation?: string | null;
}

/** Words that depend on the language; callers pass `i18n.t(...)` results. */
export interface LabelWords {
  /** Used when the product has no measure. Default "pkg". */
  pkg?: string;
  /** Default "pcs". */
  pcs?: string;
}

const squash = (v: string) => v.replace(/\s+/g, '').toLowerCase();

/** "NAME UNIT" — the unit is added only when the name does not already contain it. */
export function productTitle(name: string, unit?: string | null): string {
  const n = (name ?? '').trim();
  const u = (unit ?? '').trim();
  if (!u || squash(n).includes(squash(u))) return n;
  return `${n} ${u}`;
}

/** What one package of this product is called: its abbreviation in lower case, else the fallback word. */
export function packUnit(abbreviation?: string | null, pkg = 'pkg'): string {
  return abbreviation?.trim().toLowerCase() || pkg;
}

/** "30 pcs/ctn" — empty when the product has no package size above one piece. */
export function packSize(piecesPerPackage?: number | null, abbreviation?: string | null, words: LabelWords = {}): string {
  const n = Number(piecesPerPackage) || 0;
  return n > 1 ? `${n} ${words.pcs ?? 'pcs'}/${packUnit(abbreviation, words.pkg)}` : '';
}

/** "category · 30 pcs/ctn" — the part shown under (or after) the title. */
export function productDetail(p: Omit<ProductLabelParts, 'name' | 'unit'>, words: LabelWords = {}): string {
  return [p.category?.trim(), packSize(p.piecesPerPackage, p.abbreviation, words)].filter(Boolean).join(' · ');
}

/** The whole label on one line: "CUCA 200ML · SPIRIT · 30 pcs/ctn". */
export function productLabel(p: ProductLabelParts, words: LabelWords = {}): string {
  return [productTitle(p.name, p.unit), productDetail(p, words)].filter(Boolean).join(' · ');
}
