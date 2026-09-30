/**
 * Capital module (Spring `/api/v1/capital-expenditure`, `/api/v1/capital-monitoring`).
 * Every approved expense, asset, loan and owner movement is posted to the
 * General Ledger — the figures on these pages come from the GL.
 */

export type ExpStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED' | 'DISPOSED';

export interface Expenditure {
  uid: string;
  capitalType: string;
  expenditureType: string;
  amount: number;
  description: string;
  transactionDate: string | null;
  referenceNumber: string | null;
  paymentMethod: string | null;
  status: ExpStatus;
  createdBy: string | null;
  approvedBy: string | null;
  approvalDate: string | null;
  statusChangeReason: string | null;
  lastStatusUpdatedBy: string | null;
  asset: boolean;
  assetLifeMonths: number | null;
  salvageValue: number | null;
  monthlyDepreciation: number | null;
  accumulatedDepreciation: number | null;
  currentAssetValue: number | null;
  disposalGainLoss: number | null;
  purchaseUid: string | null;
  recurring: boolean;
  source?: string | null;
}

export interface CapitalMovement {
  uid: string;
  injection_type: 'INJECTION' | 'WITHDRAWAL' | 'VOID' | string;
  source_type: string;
  amount: number;
  reason: string;
  notes: string | null;
  transaction_date: string | null;
  payment_method: string | null;
  principal_amount: number | null;
  interest_amount: number | null;
  created_by: string | null;
  related_loan_uid: string | null;
  reclassified_from: string | null;
}

export interface Loan {
  uid: string;
  loanAmount: number;
  injectionDate: string | null;
  reason: string;
  notes: string | null;
  status: 'ACTIVE' | 'PARTIALLY_REPAID' | 'FULLY_REPAID' | 'RECLASSIFIED' | string;
  totalRepaid: number;
  outstandingBalance: number;
  repaidDate: string | null;
  reclassifiedTo: string | null;
  activeDays: number;
  profitDuringPeriod: number;
  transactions: CapitalMovement[];
}

type Label = { en: string; sw: string };

/** Expense categories offered for new expenses → capitalType and its GL account. */
export const EXPENSE_CATEGORIES: Array<Label & { type: string; gl: string; icon: string; expType: string; hint?: Label }> = [
  { type: 'OPERATIONAL_CAPITAL', gl: '6200', icon: 'storefront', expType: 'DAILY_EXPENSE', en: 'Running costs', sw: 'Uendeshaji', hint: { en: 'Transport, food, salaries, small items', sw: 'Usafiri, chakula, mishahara, vitu vidogo' } },
  { type: 'RENT_EXPENSE', gl: '6000', icon: 'home_work', expType: 'DAILY_EXPENSE', en: 'Rent', sw: 'Kodi ya pango' },
  { type: 'UTILITIES_EXPENSE', gl: '6010', icon: 'bolt', expType: 'DAILY_EXPENSE', en: 'Electricity & water', sw: 'Umeme na maji' },
  { type: 'MAINTENANCE_EXPENSE', gl: '6020', icon: 'build', expType: 'DAILY_EXPENSE', en: 'Repairs', sw: 'Matengenezo' },
  { type: 'MARKETING_EXPENSE', gl: '6030', icon: 'campaign', expType: 'DAILY_EXPENSE', en: 'Marketing', sw: 'Matangazo' },
  { type: 'TRAINING_EXPENSE', gl: '6040', icon: 'school', expType: 'DAILY_EXPENSE', en: 'Training', sw: 'Mafunzo' },
  { type: 'INSURANCE_EXPENSE', gl: '6050', icon: 'shield', expType: 'DAILY_EXPENSE', en: 'Insurance', sw: 'Bima' },
  { type: 'LEGAL_EXPENSE', gl: '6060', icon: 'gavel', expType: 'DAILY_EXPENSE', en: 'Licences & legal', sw: 'Leseni na sheria' },
  { type: 'TAX_PAYMENT', gl: '6800', icon: 'account_balance', expType: 'MONTHLY_EXPENSE', en: 'Taxes (TRA)', sw: 'Kodi (TRA)' },
];

export const ASSET_TYPES: Array<Label & { type: string; gl: string; icon: string; life: number }> = [
  { type: 'OFFICE_CAPITAL', gl: '1510', icon: 'chair', life: 60, en: 'Furniture & shop fittings', sw: 'Samani na vifaa vya duka' },
  { type: 'TECHNOLOGY_ASSET', gl: '1530', icon: 'computer', life: 36, en: 'Computers & electronics', sw: 'Kompyuta na elektroniki' },
  { type: 'VEHICLE_ASSET', gl: '1520', icon: 'local_shipping', life: 60, en: 'Vehicles', sw: 'Magari' },
  { type: 'FIXED_ASSET', gl: '1500', icon: 'factory', life: 120, en: 'Buildings & machinery', sw: 'Majengo na mashine' },
];

const ALL_TYPE_LABELS: Record<string, Label> = {
  PRODUCT_CAPITAL: { en: 'Stock purchase', sw: 'Ununuzi wa bidhaa' },
  INVENTORY_CAPITAL: { en: 'Stock', sw: 'Stock' },
  WORKING_CAPITAL: { en: 'Running costs', sw: 'Uendeshaji' },
  EMERGENCY_FUND: { en: 'Emergency fund', sw: 'Hazina ya dharura' },
  LOAN_PAYMENT: { en: 'Loan payment', sw: 'Malipo ya mkopo' },
  SHRINKAGE_LOSS: { en: 'Stock loss', sw: 'Upotevu wa bidhaa' },
  RESEARCH_DEVELOPMENT: { en: 'Research', sw: 'Utafiti' },
};

export function typeLabel(type: string, sw: boolean): string {
  const c = EXPENSE_CATEGORIES.find((x) => x.type === type) ?? ASSET_TYPES.find((x) => x.type === type);
  const l = c ?? ALL_TYPE_LABELS[type];
  return l ? (sw ? l.sw : l.en) : type;
}

export function typeIcon(type: string): string {
  return (EXPENSE_CATEGORIES.find((x) => x.type === type) ?? ASSET_TYPES.find((x) => x.type === type))?.icon ?? 'receipt_long';
}

export const STATUS: Record<ExpStatus, Label & { color: string; icon: string }> = {
  PENDING: { en: 'Awaiting approval', sw: 'Inasubiri idhini', color: 'var(--c-warning)', icon: 'hourglass_top' },
  APPROVED: { en: 'Approved · in the books', sw: 'Imeidhinishwa · iko GL', color: 'var(--c-success)', icon: 'verified' },
  REJECTED: { en: 'Rejected', sw: 'Imekataliwa', color: 'var(--c-error)', icon: 'block' },
  CANCELLED: { en: 'Cancelled · reversed', sw: 'Imebatilishwa · imerekebishwa', color: 'var(--c-text-2)', icon: 'undo' },
  DISPOSED: { en: 'Disposed', sw: 'Imeondolewa', color: 'var(--c-text-2)', icon: 'delete_sweep' },
};

export const SOURCE_LABELS: Record<string, Label & { color: string }> = {
  OWNER_EQUITY: { en: 'Owner capital', sw: 'Mtaji wa mmiliki', color: 'var(--c-success)' },
  PARTNER_CONTRIBUTION: { en: 'Partner capital', sw: 'Mchango wa mshirika', color: 'var(--c-success)' },
  LOAN: { en: 'Loan received', sw: 'Mkopo', color: 'var(--c-warning)' },
  OWNER_DRAW: { en: 'Owner withdrawal', sw: 'Mmiliki ametoa', color: 'var(--c-error)' },
  PARTNER_DRAW: { en: 'Partner withdrawal', sw: 'Mshirika ametoa', color: 'var(--c-error)' },
  WITHDRAWAL: { en: 'Withdrawal', sw: 'Kutoa pesa', color: 'var(--c-error)' },
  LOAN_REPAYMENT: { en: 'Loan repayment', sw: 'Kulipa mkopo', color: 'var(--c-info)' },
};

export const LOAN_STATUS: Record<string, Label & { color: string }> = {
  ACTIVE: { en: 'Active', sw: 'Unadaiwa', color: 'var(--c-warning)' },
  PARTIALLY_REPAID: { en: 'Partly repaid', sw: 'Sehemu imelipwa', color: 'var(--c-info)' },
  FULLY_REPAID: { en: 'Repaid', sw: 'Umelipwa wote', color: 'var(--c-success)' },
  RECLASSIFIED: { en: 'Converted to capital', sw: 'Umekuwa mtaji', color: 'var(--c-secondary)' },
};

export const n = (v: unknown): number => (v === null || v === undefined || v === '' ? 0 : Number(v));
