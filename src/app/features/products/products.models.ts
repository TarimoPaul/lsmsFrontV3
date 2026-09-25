/**
 * Product catalogue model — mirrors the Spring `ProductDto` (field names kept
 * as-is so requests need no mapping).
 *
 * Pricing: a product can be sold per piece and/or in up to three package
 * tiers (quarter / half / whole). Each package tier needs a quantity (pieces
 * in that package) and quantities must grow: quarter < half < whole — the
 * same rules as `Products.getPricingValidationErrors()` on the backend.
 */

export interface MeasureRef {
  uid: string;
  packageType: string;
  unitType: string;
  abbreviation: string | null;
  description: string | null;
}

export interface Product {
  uid: string;
  productName: string;
  /** Name + unit of the first measure, e.g. "ABSOLUTE VODKA 200ml". */
  displayName: string;
  categoryUid: string | null;
  categoryName: string | null;
  itemsMeasureUids: string[];
  measures: MeasureRef[];
  piecesPerPackage: number | null;
  pieceSalePrice: number | null;
  quarterSalePrice: number | null;
  quarterPackageQuantity: number | null;
  halfSalePrice: number | null;
  halfPackageQuantity: number | null;
  wholeSalePrice: number | null;
  wholePackageQuantity: number | null;
  priceDescription: string | null;
}

/** Body for POST /api/v1/products and PUT /api/v1/products/{uid}. */
export interface ProductRequest {
  productName: string;
  categoryUid: string;
  itemsMeasureUids: string[];
  piecesPerPackage: number | null;
  pieceSalePrice: number | null;
  quarterSalePrice: number | null;
  quarterPackageQuantity: number | null;
  halfSalePrice: number | null;
  halfPackageQuantity: number | null;
  wholeSalePrice: number | null;
  wholePackageQuantity: number | null;
  priceDescription: string | null;
}

export type TierKey = 'piece' | 'quarter' | 'half' | 'whole';

export interface TierDef {
  key: TierKey;
  price: 'pieceSalePrice' | 'quarterSalePrice' | 'halfSalePrice' | 'wholeSalePrice';
  qty: 'quarterPackageQuantity' | 'halfPackageQuantity' | 'wholePackageQuantity' | null;
  /** Share of a full package, used to suggest quantities from pieces-per-package. */
  share: number;
  en: string;
  sw: string;
  short: { en: string; sw: string };
  color: string;
}

export const TIERS: readonly TierDef[] = [
  { key: 'piece', price: 'pieceSalePrice', qty: null, share: 0, en: 'Piece', sw: 'Kipande', short: { en: 'Piece', sw: 'Kipande' }, color: 'var(--c-primary)' },
  { key: 'quarter', price: 'quarterSalePrice', qty: 'quarterPackageQuantity', share: 0.25, en: 'Quarter package', sw: 'Robo ya paketi', short: { en: 'Quarter', sw: 'Robo' }, color: 'var(--c-success)' },
  { key: 'half', price: 'halfSalePrice', qty: 'halfPackageQuantity', share: 0.5, en: 'Half package', sw: 'Nusu ya paketi', short: { en: 'Half', sw: 'Nusu' }, color: 'var(--c-warning)' },
  { key: 'whole', price: 'wholeSalePrice', qty: 'wholePackageQuantity', share: 1, en: 'Whole package', sw: 'Paketi nzima', short: { en: 'Whole', sw: 'Nzima' }, color: '#9c27b0' },
];

export type PricingFields = Pick<
  Product,
  | 'piecesPerPackage'
  | 'pieceSalePrice'
  | 'quarterSalePrice'
  | 'quarterPackageQuantity'
  | 'halfSalePrice'
  | 'halfPackageQuantity'
  | 'wholeSalePrice'
  | 'wholePackageQuantity'
>;

export interface PricingIssue {
  en: string;
  sw: string;
}

/** Backend rules (`Products.getPricingValidationErrors`) + Flutter's pieces-per-package checks. */
export function pricingIssues(p: PricingFields): PricingIssue[] {
  const issues: PricingIssue[] = [];
  const set = (v: number | null) => v !== null && v !== undefined;
  const pos = (v: number | null) => set(v) && (v as number) > 0;

  for (const t of TIERS) {
    if (t.qty && set(p[t.price]) && !pos(p[t.qty])) {
      issues.push({
        en: `${t.en}: enter how many pieces it contains`,
        sw: `${t.sw}: weka idadi ya vipande vilivyomo`,
      });
    }
  }
  const q = p.quarterPackageQuantity;
  const h = p.halfPackageQuantity;
  const w = p.wholePackageQuantity;
  if (pos(q) && pos(h) && q! >= h!) issues.push({ en: 'Quarter quantity must be less than half', sw: 'Idadi ya robo lazima iwe chini ya nusu' });
  if (pos(h) && pos(w) && h! >= w!) issues.push({ en: 'Half quantity must be less than whole', sw: 'Idadi ya nusu lazima iwe chini ya nzima' });
  if (pos(q) && pos(w) && q! >= w!) issues.push({ en: 'Quarter quantity must be less than whole', sw: 'Idadi ya robo lazima iwe chini ya nzima' });

  const ppp = p.piecesPerPackage;
  // Flutter ProductFormProvider rules: any package price needs the base
  // pieces-per-package; a quarter needs ≥ 4 of them, a half ≥ 2.
  const anyPackage = TIERS.some((t) => t.qty && set(p[t.price]));
  if (anyPackage && !pos(ppp)) {
    issues.push({ en: 'Enter the base pieces per package', sw: 'Weka idadi ya msingi ya vipande kwa paketi' });
  } else if (pos(ppp)) {
    if (set(p.quarterSalePrice) && ppp! < 4) issues.push({ en: 'A quarter price needs at least 4 pieces per package', sw: 'Bei ya robo inahitaji angalau vipande 4 kwa paketi' });
    if (set(p.halfSalePrice) && ppp! < 2) issues.push({ en: 'A half price needs at least 2 pieces per package', sw: 'Bei ya nusu inahitaji angalau vipande 2 kwa paketi' });
  }
  if (pos(ppp)) {
    for (const t of TIERS) {
      if (t.qty && pos(p[t.qty]) && p[t.qty]! > ppp!) {
        issues.push({
          en: `${t.en} quantity (${p[t.qty]}) is more than the pieces per package (${ppp})`,
          sw: `Idadi ya ${t.sw.toLowerCase()} (${p[t.qty]}) inazidi vipande kwa paketi (${ppp})`,
        });
      }
    }
  }
  return issues;
}

export interface TierPrice {
  tier: TierDef;
  price: number;
  pieces: number;
  perPiece: number;
  /** Saving per piece vs. the single-piece price (0 when none / no piece price). */
  savingPct: number;
}

/** Configured, sellable tiers with per-piece rates. */
export function tierPrices(p: PricingFields): TierPrice[] {
  const piece = p.pieceSalePrice;
  const out: TierPrice[] = [];
  for (const t of TIERS) {
    const price = p[t.price];
    if (price === null || price === undefined) continue;
    const pieces = t.qty ? (p[t.qty] ?? 0) : 1;
    if (pieces <= 0) continue;
    const perPiece = price / pieces;
    const savingPct = piece && t.key !== 'piece' && perPiece < piece ? Math.round((1 - perPiece / piece) * 100) : 0;
    out.push({ tier: t, price, pieces, perPiece, savingPct });
  }
  return out;
}

export type ProductHealth = 'READY' | 'ISSUES' | 'NO_PRICE';

export const HEALTH_META: Record<ProductHealth, { en: string; sw: string; icon: string; color: string }> = {
  READY: { en: 'Ready to sell', sw: 'Tayari kuuzwa', icon: 'check_circle', color: 'var(--c-success)' },
  ISSUES: { en: 'Pricing issue', sw: 'Tatizo la bei', icon: 'warning', color: 'var(--c-warning)' },
  NO_PRICE: { en: 'No price', sw: 'Haina bei', icon: 'money_off', color: 'var(--c-error)' },
};

/** Sellable when at least one tier is complete and nothing is inconsistent (backend `findActiveProductsReadyForSales`). */
export function productHealth(p: PricingFields): ProductHealth {
  if (pricingIssues(p).length) return 'ISSUES';
  return tierPrices(p).length ? 'READY' : 'NO_PRICE';
}

export function measureLabel(m: MeasureRef): string {
  return [m.packageType, m.unitType].filter(Boolean).join(' · ');
}

/** Same rule as backend `Products.getFormattedDisplayName()`. */
export function displayNameOf(name: string, unitType?: string | null): string {
  return unitType?.trim() ? `${name.trim()} ${unitType.trim()}` : name.trim();
}

/** Identity used for duplicate checks: name + measures (backend `existsByProductNameAndItemsMeasureUidIn`). */
export function productKey(name: string, measureUids: readonly string[]): string {
  return `${name.trim().replace(/\s+/g, ' ').toLowerCase()}|${[...measureUids].sort().join(',')}`;
}

type Raw = Partial<Product> & {
  formattedDisplayName?: string | null;
  itemsMeasureUids?: string[] | null;
  measures?: Array<Partial<MeasureRef>> | null;
};

const num = (v: unknown): number | null => (v === null || v === undefined || v === '' ? null : Number(v));

export function normalizeProduct(r: Raw): Product {
  const measures = (r.measures ?? []).map((m) => ({
    uid: m.uid ?? '',
    packageType: m.packageType ?? '',
    unitType: m.unitType ?? '',
    abbreviation: m.abbreviation ?? null,
    description: m.description ?? null,
  }));
  const name = (r.productName ?? '').trim();
  return {
    uid: r.uid ?? '',
    productName: name,
    displayName: r.formattedDisplayName?.trim() || name,
    categoryUid: r.categoryUid ?? null,
    categoryName: r.categoryName ?? null,
    itemsMeasureUids: r.itemsMeasureUids?.length ? [...r.itemsMeasureUids] : measures.map((m) => m.uid),
    measures,
    piecesPerPackage: num(r.piecesPerPackage),
    pieceSalePrice: num(r.pieceSalePrice),
    quarterSalePrice: num(r.quarterSalePrice),
    quarterPackageQuantity: num(r.quarterPackageQuantity),
    halfSalePrice: num(r.halfSalePrice),
    halfPackageQuantity: num(r.halfPackageQuantity),
    wholeSalePrice: num(r.wholeSalePrice),
    wholePackageQuantity: num(r.wholePackageQuantity),
    priceDescription: r.priceDescription?.trim() || null,
  };
}
