export type PurchaseStatus = 'PENDING' | 'APPROVED' | 'RECEIVED' | 'CANCELLED';
export type PurchaseType = 'WHOLE_PACKAGE' | 'INDIVIDUAL_PIECES';
export type PriceInputMode = 'PER_PIECE' | 'TOTAL_AMOUNT';

export const PURCHASE_STATUS: Record<PurchaseStatus, { en: string; sw: string; color: string; icon: string }> = {
  PENDING: { en: 'Pending approval', sw: 'Inasubiri idhini', color: 'var(--c-warning)', icon: 'hourglass_top' },
  APPROVED: { en: 'Approved', sw: 'Imeidhinishwa', color: 'var(--c-info)', icon: 'verified' },
  RECEIVED: { en: 'Received', sw: 'Imepokelewa', color: 'var(--c-success)', icon: 'inventory' },
  CANCELLED: { en: 'Cancelled', sw: 'Imefutwa', color: 'var(--c-text-2)', icon: 'block' },
};

export const PAYMENT: Record<string, { en: string; sw: string; color: string }> = {
  PAID: { en: 'Paid', sw: 'Imelipwa', color: 'var(--c-success)' },
  PARTIAL: { en: 'Part paid', sw: 'Sehemu', color: 'var(--c-warning)' },
  UNPAID: { en: 'On credit', sw: 'Mkopo', color: 'var(--c-error)' },
};

/** Spring `PurchaseDto` (the fields the UI uses). One purchase = one product line. */
export interface Purchase {
  uid: string;
  productUid: string;
  productName: string;
  categoryName: string | null;
  purchaseType: string;
  priceInputMode: string;
  quantity: number;
  purchasePrice: number;
  /** Total cost of the line (price × qty, or the total entered). */
  totalCost: number;
  costPerPiece: number | null;
  totalPieces: number | null;
  quantityDisplay: string | null;
  supplierName: string | null;
  supplierUid: string | null;
  amountPaid: number;
  paymentStatus: string;
  dueDate: string | null;
  purchaseDate: string | null;
  status: PurchaseStatus;
  notes: string | null;
  discountPercentage: number | null;
  discountAmount: number | null;
  minimumStockLevel: number | null;
  reorderPoint: number | null;
  approvedBy: string | null;
  approvalDate: string | null;
  receivedBy: string | null;
  receivingDate: string | null;
  cancelledBy: string | null;
  cancellationDate: string | null;
  cancellationReason: string | null;
  reference: string | null;
  piecesPerPackage: number | null;
  packageAbbreviation: string | null;
  currentStock: number | null;
  stockDisplay: string | null;
}

export interface PurchaseRequest {
  productUid: string;
  purchaseType: PurchaseType;
  priceInputMode: PriceInputMode;
  quantity: number;
  purchasePrice: number;
  supplierName: string | null;
  supplierUid: string | null;
  amountPaid: number | null;
  discountPercentage: number | null;
  discountAmount: number | null;
  minimumStockLevel: number | null;
  reorderPoint: number | null;
  purchaseNotes: string | null;
  purchaseDate: string;
}

export type EligibilityStatus = 'ELIGIBLE' | 'HAS_PENDING' | 'HAS_APPROVED' | 'HAS_HISTORY';

export interface Eligibility {
  status: EligibilityStatus;
  message: string;
  existingPurchaseUid: string | null;
}

/** GET /purchases/repurchase/template/{productUid} — last purchase + supplier price ranking. */
export interface RepurchaseTemplate {
  lastPurchaseType: PurchaseType | null;
  lastPriceInputMode: PriceInputMode | null;
  lastQuantity: number | null;
  lastPricePerUnit: number | null;
  lastCostPerPiece: number | null;
  /** Cost of one whole package last time. */
  lastCostPerPackage: number | null;
  lastSupplierName: string | null;
  lastMinimumStockLevel: number | null;
  lastReorderPoint: number | null;
  lastPurchaseDate: string | null;
  daysSinceLastPurchase: number | null;
  piecesPerPackage: number | null;
  packageAbbreviation: string | null;
  suppliers: Array<{ name: string; lowestPrice: number | null; averagePrice: number | null; purchases: number; best: boolean; message: string | null }>;
}

const num = (v: unknown) => Number(v ?? 0) || 0;
const numOrNull = (v: unknown) => (v === null || v === undefined || v === '' ? null : Number(v));
const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);

export function normalizePurchase(r: Record<string, unknown>): Purchase {
  const qty = num(r['quantity']);
  const price = num(r['purchasePrice']);
  const mode = String(r['priceInputMode'] ?? 'TOTAL_AMOUNT');
  const status = String(r['status'] ?? 'PENDING') as PurchaseStatus;
  const discount = num(r['discountAmount']);
  return {
    uid: String(r['uid'] ?? ''),
    productUid: String(r['productUid'] ?? ''),
    productName: String(r['productDisplayName'] ?? r['productName'] ?? '').trim(),
    categoryName: str(r['categoryName']),
    purchaseType: String(r['purchaseType'] ?? 'WHOLE_PACKAGE'),
    priceInputMode: mode,
    quantity: qty,
    purchasePrice: price,
    totalCost: Math.max(0, (mode === 'PER_PIECE' ? price * qty : price) - discount),
    costPerPiece: numOrNull(r['costPerPiece']),
    totalPieces: numOrNull(r['totalPiecesPurchased']),
    quantityDisplay: str(r['quantityDisplay']),
    supplierName: str(r['supplierName']),
    supplierUid: str(r['supplierUid']),
    amountPaid: num(r['amountPaid']),
    paymentStatus: String(r['paymentStatus'] ?? 'UNPAID'),
    dueDate: str(r['dueDate']),
    purchaseDate: str(r['purchaseDate']),
    status: status in PURCHASE_STATUS ? status : 'PENDING',
    notes: str(r['purchaseNotes']),
    discountPercentage: numOrNull(r['discountPercentage']),
    discountAmount: numOrNull(r['discountAmount']),
    minimumStockLevel: numOrNull(r['minimumStockLevel']),
    reorderPoint: numOrNull(r['reorderPoint']),
    approvedBy: str(r['approvedBy']),
    approvalDate: str(r['approvalDate']),
    receivedBy: str(r['receivedBy']),
    receivingDate: str(r['receivingDate']),
    cancelledBy: str(r['cancelledBy']),
    cancellationDate: str(r['cancellationDate']),
    cancellationReason: str(r['cancellationReason']),
    reference: str(r['purchaseReference']),
    piecesPerPackage: numOrNull(r['piecesPerPackageAtPurchase'] ?? r['piecesPerPackage']),
    packageAbbreviation: str(r['packageAbbreviation']),
    currentStock: numOrNull(r['currentStock']),
    stockDisplay: str(r['stockDisplay']),
  };
}

export function shortRef(ref: string | null): string {
  return (ref ?? '').replace(/-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i, '');
}

/** GET /purchases/repurchase/products — a product bought before (pending / approved / received). */
export interface RepurchasableProduct {
  uid: string;
  name: string;
  category: string | null;
  piecesPerPackage: number | null;
  abbreviation: string | null;
  pieceSalePrice: number | null;
  averageCost: number | null;
}

export function normalizeRepurchasable(r: Record<string, unknown>): RepurchasableProduct {
  return {
    uid: String(r['uid'] ?? ''),
    name: String(r['formattedDisplayName'] ?? r['productName'] ?? '').trim(),
    category: str(r['categoryName']),
    piecesPerPackage: numOrNull(r['piecesPerPackage']),
    abbreviation: str(r['packageAbbreviation']),
    pieceSalePrice: numOrNull(r['pieceSalePrice']),
    averageCost: numOrNull(r['currentAverageCost']),
  };
}

/** One line of the repurchase cart; `unitPrice` is per package (WHOLE_PACKAGE) or per piece. */
export interface RepurchaseLine {
  productUid: string;
  name: string;
  category: string | null;
  purchaseType: PurchaseType;
  quantity: number;
  unitPrice: number;
  supplierName: string | null;
  piecesPerPackage: number | null;
  abbreviation: string | null;
  pieceSalePrice: number | null;
  /** From the last purchase — for the "vs last time" hint and type switches. */
  lastCostPerPiece: number | null;
  lastCostPerPackage: number | null;
  lastSupplierName: string | null;
  /** Set when the server refused this line on the last submit. */
  error?: string | null;
}

export function linePieces(l: RepurchaseLine): number {
  return l.purchaseType === 'WHOLE_PACKAGE' ? l.quantity * (l.piecesPerPackage || 1) : l.quantity;
}

export function lineTotal(l: RepurchaseLine): number {
  return Math.max(0, Math.round(l.quantity * l.unitPrice * 100) / 100);
}

/** Saved at /api/v1/invoices after a repurchase (Flutter `RepurchaseInvoice`). */
export interface RepurchaseInvoice {
  invoiceNumber: string;
  createdAt: string;
  buyerName: string;
  notes: string | null;
  grandTotal: number;
  totalDiscount: number;
  items: RepurchaseInvoiceItem[];
}

export interface RepurchaseInvoiceItem {
  productUid: string;
  productDisplayName: string;
  quantity: number;
  unitPrice: number;
  totalValue: number;
  discountAmount: number;
  finalTotal: number;
  /** "Jumla" (packages) | "Rejareja" (pieces) — the labels Flutter saves. */
  purchaseTypeLabel: string;
  supplierName: string | null;
}

export type BulkAction = 'approve' | 'receive' | 'cancel';
