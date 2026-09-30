/**
 * Main business settings (GET/PUT /api/v1/business-settings/main).
 * Only the fields that have an effect somewhere are edited: identity + tax
 * print on receipts/invoices, credit term drives AR aging, variance threshold
 * flags reconciliations. The backend stores many more (currency format,
 * discounts, notifications …) that nothing reads — they are left alone.
 */
export interface BusinessSettings {
  uid: string | null;
  businessName: string;
  businessTagline: string | null;
  businessPhone: string | null;
  businessEmail: string | null;
  businessAddress: string | null;
  businessWebsite: string | null;
  taxId: string | null;
  vatNumber: string | null;
  registrationNumber: string | null;
  receiptHeader: string | null;
  receiptFooter: string | null;
  /** Null → backend default 30. */
  defaultCreditTermDays: number | null;
  /** Null → backend default 2,000. */
  varianceThreshold: number | null;
  lastModifiedAt: string | null;
}

/** PUT body. The backend ignores nulls, so a cleared text field is sent as ''. */
export type BusinessSettingsUpdate = Partial<Omit<BusinessSettings, 'uid' | 'lastModifiedAt'>>;

/** Human labels of the editable fields — shared by the form and the approvals diff. */
export const SETTINGS_FIELDS: Record<keyof BusinessSettingsUpdate, { en: string; sw: string; money?: boolean }> = {
  businessName: { en: 'Business name', sw: 'Jina la biashara' },
  businessTagline: { en: 'Tagline', sw: 'Kauli mbiu' },
  businessPhone: { en: 'Phone', sw: 'Simu' },
  businessEmail: { en: 'Email', sw: 'Barua pepe' },
  businessAddress: { en: 'Address', sw: 'Anwani' },
  businessWebsite: { en: 'Website', sw: 'Tovuti' },
  taxId: { en: 'TIN', sw: 'TIN' },
  vatNumber: { en: 'VAT number (VRN)', sw: 'Namba ya VAT (VRN)' },
  registrationNumber: { en: 'Licence / reg. no.', sw: 'Leseni / usajili' },
  receiptHeader: { en: 'Receipt header', sw: 'Kichwa cha risiti' },
  receiptFooter: { en: 'Receipt footer', sw: 'Maandishi ya chini ya risiti' },
  defaultCreditTermDays: { en: 'Credit term (days)', sw: 'Muda wa mkopo (siku)' },
  varianceThreshold: { en: 'Variance threshold', sw: 'Kiwango cha tofauti', money: true },
};

export const DEFAULT_CREDIT_TERM_DAYS = 30;
export const DEFAULT_VARIANCE_THRESHOLD = 2000;

/** Opening-capital record (/api/v1/business/configuration) — reference for Capital's "initial capital". */
export interface OpeningCapital {
  uid: string | null;
  businessName: string;
  /** yyyy-MM-dd */
  businessStartDate: string;
  businessType: string | null;
  businessLocation: string | null;
  businessDescription: string | null;
  ownerEquity: number;
  partnerContributions: number;
  loanCapital: number;
  totalInitialCapital: number;
  initialStockAllocation: number;
  initialFixedAssets: number;
  initialCash: number;
  initialWorkingCapital: number;
  currency: string;
  taxIdentificationNumber: string | null;
  createdAt: string | null;
}

export const BUSINESS_TYPES: readonly { value: string; en: string; sw: string }[] = [
  { value: 'Duka la Rejareja', en: 'Retail shop', sw: 'Duka la Rejareja' },
  { value: 'Duka la Jumla', en: 'Wholesale shop', sw: 'Duka la Jumla' },
  { value: 'Huduma', en: 'Services', sw: 'Huduma' },
  { value: 'Ujenzi', en: 'Construction', sw: 'Ujenzi' },
  { value: 'Uzalishaji', en: 'Manufacturing', sw: 'Uzalishaji' },
  { value: 'Nyingine', en: 'Other', sw: 'Nyingine' },
];
