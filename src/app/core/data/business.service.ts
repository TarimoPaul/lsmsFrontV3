import { Injectable, inject } from '@angular/core';

import { ApiService } from '../api/api.service';
import { CachedResource } from './cached-resource';

/** The resolved (main + branch override) business profile — receipts, invoices, headers. */
export interface BusinessProfile {
  name: string;
  tagline: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  taxId: string | null;
  vatNumber: string | null;
  branchName: string | null;
  receiptHeader: string | null;
  receiptFooter: string | null;
}

type Raw = Record<string, unknown>;
const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);

/** GET /api/v1/business-settings/resolved, cached for 10 minutes. */
@Injectable({ providedIn: 'root' })
export class BusinessService {
  private readonly api = inject(ApiService);

  readonly profile = new CachedResource<BusinessProfile>(async () => {
    const d = await this.api.get<Raw>('/api/v1/business-settings/resolved');
    return {
      name: str(d['businessName']) ?? 'LSMS',
      tagline: str(d['businessTagline']),
      phone: str(d['businessPhone']),
      email: str(d['businessEmail']),
      address: str(d['businessAddress']),
      taxId: str(d['taxId']),
      vatNumber: str(d['vatNumber']),
      branchName: str(d['branchName']),
      receiptHeader: str(d['receiptHeader']),
      receiptFooter: str(d['receiptFooter']),
    };
  }, 10 * 60_000);
}
