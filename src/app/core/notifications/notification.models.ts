/** One notification of GET /api/v1/notifications (Spring `NotificationDto`). */
export interface AppNotification {
  uid: string;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string | null;
  /** DEBT_COLLECTED → customer uid; PURCHASE_* → purchase uid. */
  referenceUid: string | null;
  productUid: string | null;
  productName: string | null;
  changedByName: string | null;
  /** DAILY_SALES_SUMMARY / PAST_DATE_SALE — the sales day (YYYY-MM-DD). */
  summaryDate: string | null;
  totalCount: number | null;
  totalAmount: number | null;
  totalProfit: number | null;
  oldRetailPrice: number | null;
  newRetailPrice: number | null;
  oldWholesalePrice: number | null;
  newWholesalePrice: number | null;
  oldPurchasePrice: number | null;
  newPurchasePrice: number | null;
}

export type NotificationCategory = 'ALL' | 'DEBT' | 'PURCHASES' | 'SALES' | 'PRICES' | 'SYSTEM';

/** Inbox tabs → the backend types each one covers (null = every type). */
export const CATEGORY_TYPES: Record<NotificationCategory, string[] | null> = {
  ALL: null,
  DEBT: ['DEBT_COLLECTED'],
  PURCHASES: ['PURCHASE_CREATED', 'PURCHASE_APPROVED', 'PURCHASE_RECEIVED'],
  SALES: ['DAILY_SALES_SUMMARY', 'PAST_DATE_SALE'],
  PRICES: ['PRICE_CHANGE'],
  SYSTEM: ['SYSTEM_ALERT'],
};

export const NOTIFICATION_KIND: Record<string, { en: string; sw: string; icon: string; color: string }> = {
  DEBT_COLLECTED: { en: 'Debt collected', sw: 'Deni limelipwa', icon: 'payments', color: 'var(--c-success)' },
  PURCHASE_CREATED: { en: 'Purchase created', sw: 'Manunuzi mapya', icon: 'shopping_cart', color: 'var(--c-info)' },
  PURCHASE_APPROVED: { en: 'Purchase approved', sw: 'Manunuzi yameidhinishwa', icon: 'check_circle', color: 'var(--c-success)' },
  PURCHASE_RECEIVED: { en: 'Stock received', sw: 'Mzigo umepokelewa', icon: 'inventory_2', color: 'var(--c-primary)' },
  DAILY_SALES_SUMMARY: { en: 'Daily sales', sw: 'Mauzo ya siku', icon: 'bar_chart', color: 'var(--c-success)' },
  PAST_DATE_SALE: { en: 'Back-dated sale', sw: 'Mauzo ya tarehe ya nyuma', icon: 'history', color: 'var(--c-warning)' },
  PRICE_CHANGE: { en: 'Price change', sw: 'Bei imebadilika', icon: 'sell', color: 'var(--c-warning)' },
  SYSTEM_ALERT: { en: 'System alert', sw: 'Tahadhari ya mfumo', icon: 'warning', color: 'var(--c-error)' },
};

export const kindOf = (type: string) => NOTIFICATION_KIND[type] ?? { en: type, sw: type, icon: 'notifications', color: 'var(--c-text-2)' };

type Raw = Record<string, unknown>;
const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);
const num = (v: unknown) => (v === null || v === undefined || v === '' ? null : Number(v));

export function toNotification(r: Raw): AppNotification {
  return {
    uid: String(r['uid'] ?? ''),
    type: String(r['type'] ?? 'SYSTEM_ALERT'),
    title: String(r['title'] ?? ''),
    message: String(r['message'] ?? ''),
    isRead: r['isRead'] === true,
    createdAt: str(r['createdAt']),
    referenceUid: str(r['referenceUid']),
    productUid: str(r['productUid']),
    productName: str(r['productName']),
    changedByName: str(r['changedByName']),
    summaryDate: str(r['summaryDate']),
    totalCount: num(r['totalCount']),
    totalAmount: num(r['totalAmount']),
    totalProfit: num(r['totalProfit']),
    oldRetailPrice: num(r['oldRetailPrice']),
    newRetailPrice: num(r['newRetailPrice']),
    oldWholesalePrice: num(r['oldWholesalePrice']),
    newWholesalePrice: num(r['newWholesalePrice']),
    oldPurchasePrice: num(r['oldPurchasePrice']),
    newPurchasePrice: num(r['newPurchasePrice']),
  };
}
