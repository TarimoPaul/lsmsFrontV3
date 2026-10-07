/**
 * Purchase suggestion ("Pendekezo la oda") — the order of the day for the main
 * (class A) products. Every figure and rule comes from the backend
 * (/api/order-suggestions); the screen only shows it and lets the buyer set the packages.
 */
export const ORDER_VIEW = 'ORDER_SUGGESTION_VIEW';
export const ORDER_EDIT = 'ORDER_SUGGESTION_EDIT';

export type OrderStatus = 'NIGHT' | 'UPDATED' | 'PURCHASED';
export type BudgetSource = 'ESTIMATE' | 'RECON_SUBMITTED' | 'RECON_APPROVED';

/**
 * Words for "package" on the order screens, [English, Swahili] for `i18n.t(...)`.
 * The only place they are spelled: a line names its own package by the product's
 * abbreviation (crt, ctn…), these are for headers, totals and products without one.
 */
export const PACK_WORDS = {
  packs: ['packages', 'vifurushi'],
  Packs: ['Packages', 'Vifurushi'],
  pack: ['package', 'kifurushi'],
  /** Stands in for the abbreviation of a product that has no measure. */
  pkg: ['pkg', 'pkt'],
} as const;

/** The slow-movers verdict a product carries when its stock is stuck (the "OK" of the report is no warning). */
export type OrderSlowAction = 'RETURN_OR_DISCOUNT' | 'DISCOUNT' | 'STOP_ORDERING';

/** Slow-movers warning: days the stock covers at the 60-day sales (null = nothing sold) and its value at cost. */
export interface SlowWarning {
  slowAction: OrderSlowAction | null;
  slowCoverDays: number | null;
  slowValue: number | null;
}

/** A product that is not on the order, as "+ Ongeza bidhaa" offers it. */
export interface OrderCandidate extends SlowWarning {
  productUid: string;
  productName: string;
  displayName: string;
  category: string | null;
  packageAbbreviation: string | null;
  piecesPerPack: number;
  packCost: number;
  stock: number;
  stockSource: 'SYSTEM' | 'COUNT';
  stockCountedAt: string | null;
  velocity: number;
  seasonFactor: number;
}

export interface OrderLine extends SlowWarning {
  uid: string;
  productUid: string;
  productId: number;
  productName: string;
  /** "NAME UNIT" as the rest of the app shows the product. */
  displayName: string;
  category: string | null;
  /** What one package of this product is called (crt, ctn…); null without a measure. */
  packageAbbreviation: string | null;
  piecesPerPack: number;
  unitCost: number;
  packCost: number;
  /** The four versions kept per product. */
  nightPacks: number | null;
  systemPacks: number;
  userPacks: number | null;
  purchasedPacks: number | null;
  /** The order as it stands: the buyer's crates when edited, else the system's. */
  packs: number;
  /**
   * The buyer added this product ("+ Ongeza bidhaa", source USER_ADDED): the system never
   * sets or cuts its packages, and it can be taken off the order again.
   */
  added: boolean;
  edited: boolean;
  cost: number;
  stock: number;
  stockSource: 'SYSTEM' | 'COUNT';
  /** When the product was counted (stockSource COUNT); null for system stock or an older backend. */
  stockCountedAt: string | null;
  /** De-seasonalised pieces per day (last 14 days, stockout days adjusted). */
  velocity: number;
  stockoutDays: number;
  seasonFactor: number;
  target: number;
  need: number;
  /** Crates the formula wants before the budget; cutPacks of them did not fit. */
  wantedPacks: number;
  cutPacks: number;
  /** 1 = served first when money is short. */
  priority: number;
}

export interface OrderSuggestion {
  uid: string;
  orderDate: string;
  status: OrderStatus;
  nightGeneratedAt: string | null;
  salesUpdatedAt: string | null;
  countUpdatedAt: string | null;
  budgetUpdatedAt: string | null;
  calculatedAt: string | null;
  lastReason: string | null;
  purchasedAt: string | null;
  /** The last recompute failed — what is shown is the previous good order. */
  lastError: string | null;
  lastErrorAt: string | null;
  /** Day of the count the stock comes from; null = system stock. */
  countDate: string | null;
  countStatus: string | null;
  seasonFactor: number;
  coverDays: number;
  safetyZ: number;
  /** HH:mm the buyer leaves / the goods arrive. */
  departureTime: string;
  arrivalTime: string;
  budget: {
    source: BudgetSource | null;
    received: number;
    collections: number;
    expenses: number;
    accrual: number;
    amount: number;
    otherPurchases: number;
    poolCarry: number;
    limit: number | null;
    /** False = the limit is 0 or less: the budget is not known, so nothing was cut. */
    known: boolean;
    poolCap: number;
    poolOut: number;
  };
  totals: {
    products: number;
    wantedCost: number;
    systemCost: number;
    cutCost: number;
    orderCost: number;
    orderPacks: number;
    editedLines: number;
    /** Lines the buyer added, and their cost (already inside orderCost). */
    addedLines: number;
    addedCost: number;
    purchasedCost: number | null;
  };
  lines: OrderLine[];
}
