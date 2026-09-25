export type BranchStatus = 'ACTIVE' | 'SUSPENDED' | 'INACTIVE' | 'PENDING' | 'CLOSED';

export const BRANCH_STATUS: Record<BranchStatus, { en: string; sw: string; color: string; icon: string }> = {
  ACTIVE: { en: 'Active', sw: 'Inatumika', color: 'var(--c-success)', icon: 'check_circle' },
  SUSPENDED: { en: 'Suspended', sw: 'Imesimamishwa', color: 'var(--c-warning)', icon: 'pause_circle' },
  INACTIVE: { en: 'Inactive', sw: 'Haitumiki', color: 'var(--c-text-2)', icon: 'do_not_disturb_on' },
  PENDING: { en: 'Pending', sw: 'Inasubiri', color: 'var(--c-info)', icon: 'hourglass_top' },
  CLOSED: { en: 'Closed', sw: 'Imefungwa', color: 'var(--c-error)', icon: 'block' },
};

/** Spring `BranchDto`. (Flutter's form sent databaseName / maxUsers / storage, which the backend does not have.) */
export interface Branch {
  uid: string;
  branchName: string;
  branchCode: string | null;
  description: string | null;
  address: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  phoneNumber: string | null;
  email: string | null;
  status: BranchStatus;
  isMainBranch: boolean;
  openingTime: string | null;
  closingTime: string | null;
  /** Comma-separated day codes, e.g. "MON,TUE,WED". */
  operatingDays: string | null;
  taxId: string | null;
  registrationNumber: string | null;
  createdAt: string | null;
  ownerName: string | null;
}

export type BranchRequest = Omit<Branch, 'uid' | 'status' | 'createdAt' | 'ownerName'>;

export const DAYS = [
  { code: 'MON', en: 'Mon', sw: 'Jtt' },
  { code: 'TUE', en: 'Tue', sw: 'Jnn' },
  { code: 'WED', en: 'Wed', sw: 'Jtn' },
  { code: 'THU', en: 'Thu', sw: 'Alh' },
  { code: 'FRI', en: 'Fri', sw: 'Ijm' },
  { code: 'SAT', en: 'Sat', sw: 'Jms' },
  { code: 'SUN', en: 'Sun', sw: 'Jpl' },
] as const;

export function location(b: Pick<Branch, 'address' | 'city' | 'region' | 'country'>): string {
  return [b.address, b.city, b.region, b.country].filter(Boolean).join(', ');
}

const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);

export function normalizeBranch(r: Record<string, unknown>): Branch {
  const status = (r['status'] as BranchStatus) ?? 'ACTIVE';
  return {
    uid: String(r['uid'] ?? ''),
    branchName: String(r['branchName'] ?? '').trim(),
    branchCode: str(r['branchCode']),
    description: str(r['description']),
    address: str(r['address']),
    city: str(r['city']),
    region: str(r['region']),
    country: str(r['country']),
    phoneNumber: str(r['phoneNumber']),
    email: str(r['email']),
    status: status in BRANCH_STATUS ? status : 'ACTIVE',
    isMainBranch: r['isMainBranch'] === true,
    openingTime: str(r['openingTime']),
    closingTime: str(r['closingTime']),
    operatingDays: str(r['operatingDays']),
    taxId: str(r['taxId']),
    registrationNumber: str(r['registrationNumber']),
    createdAt: str(r['createdAt']),
    ownerName: str(r['ownerName']),
  };
}
