/** One product's stock position (GET /api/store/display/stock/summary). */
export interface StockItem {
  uid: string; // productUid — lets the shared CachedList key by product
  productName: string;
  category: string | null;
  categoryUid: string | null;
  currentStock: number;
  piecesPerPackage: number | null;
  packageAbbreviation: string | null;
  averageCostPrice: number | null;
  pieceSalePrice: number | null;
  isLowStock: boolean;
  isOutOfStock: boolean;
  isNegativeStock: boolean;
  lastMovementDate: string | null;
  lastMovementType: string | null;
}

/** A stock movement row (display DTO). `stockChange` is signed. */
export interface Movement {
  uid: string;
  productUid: string;
  productName: string;
  categoryName: string | null;
  movementType: string;
  quantityDisplay: string | null;
  stockBefore: number | null;
  stockAfter: number | null;
  stockChange: number;
  unitPrice: number | null;
  totalValue: number | null;
  movementDate: string | null;
  initiatedBy: string | null;
  reference: string | null;
  notes: string | null;
  direction: 'IN' | 'OUT' | 'NEUTRAL';
}

export type MovementGroup = 'IN' | 'OUT' | 'ADJ';

export const MOVEMENT_TYPES: Record<string, { en: string; sw: string; icon: string; color: string; group: MovementGroup }> = {
  PURCHASE: { en: 'Purchase', sw: 'Manunuzi', icon: 'local_shipping', color: 'var(--c-success)', group: 'IN' },
  STOCK_IN: { en: 'Stock in', sw: 'Mzigo umeingia', icon: 'input', color: 'var(--c-success)', group: 'IN' },
  RETURN_TO_STOCK: { en: 'Returned to stock', sw: 'Imerudishwa stoo', icon: 'assignment_return', color: 'var(--c-info)', group: 'IN' },
  SALE: { en: 'Sale', sw: 'Mauzo', icon: 'point_of_sale', color: 'var(--c-primary)', group: 'OUT' },
  STOCK_OUT: { en: 'Stock out', sw: 'Mzigo umetoka', icon: 'output', color: 'var(--c-primary)', group: 'OUT' },
  SALE_REVERSAL: { en: 'Sale reversed', sw: 'Mauzo yamefutwa', icon: 'undo', color: 'var(--c-warning)', group: 'IN' },
  ADJUSTMENT: { en: 'Adjustment', sw: 'Marekebisho', icon: 'tune', color: '#9c27b0', group: 'ADJ' },
  DAMAGE: { en: 'Damage', sw: 'Uharibifu', icon: 'broken_image', color: 'var(--c-error)', group: 'ADJ' },
  RETURN_DAMAGED: { en: 'Damaged return', sw: 'Marejesho mabovu', icon: 'report', color: 'var(--c-error)', group: 'ADJ' },
  RECONCILIATION: { en: 'Stock count', sw: 'Kuhesabu stoo', icon: 'fact_check', color: '#9c27b0', group: 'ADJ' },
};

export function movementMeta(type: string) {
  return MOVEMENT_TYPES[type] ?? { en: type, sw: type, icon: 'swap_vert', color: 'var(--c-text-2)', group: 'ADJ' as MovementGroup };
}

export type StockHealth = 'NEGATIVE' | 'OUT' | 'LOW' | 'OK';

export const HEALTH: Record<StockHealth, { en: string; sw: string; color: string; icon: string }> = {
  OK: { en: 'In stock', sw: 'Ipo', color: 'var(--c-success)', icon: 'check_circle' },
  LOW: { en: 'Low', sw: 'Chache', color: 'var(--c-warning)', icon: 'warning' },
  OUT: { en: 'Out of stock', sw: 'Imeisha', color: 'var(--c-error)', icon: 'remove_shopping_cart' },
  NEGATIVE: { en: 'Negative', sw: 'Hasi', color: '#b71c1c', icon: 'error' },
};

export function stockHealth(s: StockItem, threshold: number): StockHealth {
  if (s.currentStock < 0) return 'NEGATIVE';
  if (s.currentStock === 0) return 'OUT';
  return s.currentStock <= threshold ? 'LOW' : 'OK';
}

/** "2 ctn + 5 pcs" (whole packages + loose pieces). */
export function packagesLabel(pieces: number, perPackage: number | null, abbr: string | null, pcsLabel: string): string {
  if (!perPackage || perPackage <= 1 || Math.abs(pieces) < perPackage) return `${pieces} ${pcsLabel}`;
  const sign = pieces < 0 ? '−' : '';
  const n = Math.abs(pieces);
  const whole = Math.floor(n / perPackage);
  const rest = n % perPackage;
  return `${sign}${whole} ${abbr || 'pkg'}${rest ? ` + ${rest} ${pcsLabel}` : ''}`;
}

/** GET /api/store/analytics/inventory/summary */
export interface InventoryInsights {
  totalProducts: number;
  slowMovingCount: number;
  deadStockCount: number;
  fastMovingCount: number;
  totalDeadStockValue: number;
  totalInventoryValue: number;
  aging: { d0to30: number; d31to60: number; d61to90: number; d90plus: number };
  products: InsightRow[];
}

export interface InsightRow {
  uid: string;
  productName: string;
  categoryName: string | null;
  movementClass: string;
  agingBucket: string | null;
  daysSinceLastOutbound: number;
  unitsSoldLast30Days: number;
  unitsSoldLast90Days: number;
  currentStock: number;
  currentStockValue: number;
  recommendations: string[];
  recommendationPriority: string;
}

export const MOVEMENT_CLASS: Record<string, { en: string; sw: string; color: string }> = {
  FAST: { en: 'Fast', sw: 'Haraka', color: 'var(--c-success)' },
  NORMAL: { en: 'Normal', sw: 'Kawaida', color: 'var(--c-info)' },
  SLOW: { en: 'Slow', sw: 'Polepole', color: 'var(--c-warning)' },
  DEAD: { en: 'Not selling', sw: 'Haiuziki', color: 'var(--c-error)' },
};

export const RECOMMENDATIONS: Record<string, { en: string; sw: string }> = {
  OFFER_DISCOUNT: { en: 'Offer a discount', sw: 'Toa punguzo' },
  BUNDLE_PROMOTION: { en: 'Bundle with fast sellers', sw: 'Uza pamoja na bidhaa zinazouzika' },
  CLEARANCE_SALE: { en: 'Clearance sale', sw: 'Uza kwa bei ya kufuta mzigo' },
  STOP_REORDER: { en: 'Stop re-ordering', sw: 'Acha kuagiza tena' },
  REORDER: { en: 'Re-order soon', sw: 'Agiza tena karibuni' },
  INCREASE_STOCK: { en: 'Increase stock', sw: 'Ongeza mzigo' },
};

export type ChangeKind = 'ADJUST_IN' | 'ADJUST_OUT' | 'DAMAGE' | 'RETURN';
