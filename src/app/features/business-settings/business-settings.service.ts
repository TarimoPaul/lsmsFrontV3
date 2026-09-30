import { Injectable, inject } from '@angular/core';

import { ApiError } from '@core/api/api.types';
import { ApiService } from '@core/api/api.service';
import { BusinessService } from '@core/data/business.service';
import { CachedResource } from '@core/data/cached-resource';
import { StoreService } from '../store/store.service';
import { BusinessSettings, BusinessSettingsUpdate, OpeningCapital } from './business-settings.models';

type Raw = Record<string, unknown>;
const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);
const num = (v: unknown) => (v === null || v === undefined || v === '' ? null : Number.isFinite(Number(v)) ? Number(v) : null);

function toSettings(d: Raw): BusinessSettings {
  return {
    uid: str(d['uid']),
    businessName: str(d['businessName']) ?? '',
    businessTagline: str(d['businessTagline']),
    businessPhone: str(d['businessPhone']),
    businessEmail: str(d['businessEmail']),
    businessAddress: str(d['businessAddress']),
    businessWebsite: str(d['businessWebsite']),
    taxId: str(d['taxId']),
    vatNumber: str(d['vatNumber']),
    registrationNumber: str(d['registrationNumber']),
    receiptHeader: str(d['receiptHeader']),
    receiptFooter: str(d['receiptFooter']),
    defaultCreditTermDays: num(d['defaultCreditTermDays']),
    varianceThreshold: num(d['varianceThreshold']),
    lastModifiedAt: str(d['lastModifiedAt']) ?? str(d['updatedAt']),
  };
}

function toOpening(d: Raw): OpeningCapital {
  const n = (k: string) => num(d[k]) ?? 0;
  return {
    uid: str(d['uid']),
    businessName: str(d['businessName']) ?? '',
    businessStartDate: (str(d['businessStartDate']) ?? '').slice(0, 10),
    businessType: str(d['businessType']),
    businessLocation: str(d['businessLocation']),
    businessDescription: str(d['businessDescription']),
    ownerEquity: n('ownerEquity'),
    partnerContributions: n('partnerContributions'),
    loanCapital: n('loanCapital'),
    totalInitialCapital: n('totalInitialCapital'),
    initialStockAllocation: n('initialStockAllocation'),
    initialFixedAssets: n('initialFixedAssets'),
    initialCash: n('initialCash'),
    initialWorkingCapital: n('initialWorkingCapital'),
    currency: str(d['currency']) ?? 'TZS',
    taxIdentificationNumber: str(d['taxIdentificationNumber']),
    createdAt: str(d['createdAt']),
  };
}

@Injectable({ providedIn: 'root' })
export class BusinessSettingsService {
  private readonly api = inject(ApiService);
  private readonly business = inject(BusinessService);
  private readonly store = inject(StoreService);

  /** Main settings (the backend creates defaults on first read). */
  readonly main = new CachedResource<BusinessSettings>(
    async () => toSettings((await this.api.get<Raw>('/api/v1/business-settings/main')) ?? {}),
    5 * 60_000,
  );

  /** Opening-capital record, or null when the business was never set up. */
  readonly opening = new CachedResource<OpeningCapital | null>(async () => {
    try {
      const d = await this.api.get<Raw>('/api/v1/business/configuration');
      return d ? toOpening(d) : null;
    } catch (e) {
      if (ApiError.from(e).status === 404) return null;
      throw e;
    }
  }, 5 * 60_000);

  async update(body: BusinessSettingsUpdate): Promise<BusinessSettings> {
    const saved = toSettings((await this.api.put<Raw>('/api/v1/business-settings/main', body)) ?? {});
    this.main.set(saved);
    // Receipts / invoices read the resolved profile — make them pick the change up.
    this.business.profile.invalidate();
    return saved;
  }

  /**
   * Stock at cost (stock × average cost) from the shared Store cache, used to
   * pre-fill the opening-capital wizard. Flutter called /api/v1/store/inventory-value,
   * which does not exist, so its auto-fill was always 0. Returns 0 when unknown.
   */
  async inventoryValue(): Promise<number> {
    try {
      const rows = await this.store.stock.load();
      return Math.round(rows.reduce((s, r) => s + Math.max(0, r.currentStock) * (r.averageCostPrice ?? 0), 0));
    } catch {
      return 0;
    }
  }

  async saveOpening(body: Omit<OpeningCapital, 'createdAt'>, existing: boolean): Promise<OpeningCapital> {
    const payload = { ...body, isSetupComplete: true };
    const d = existing
      ? await this.api.put<Raw>('/api/v1/business/configuration', payload)
      : await this.api.post<Raw>('/api/v1/business/initial-setup', payload);
    const saved = toOpening(d ?? {});
    this.opening.set(saved);
    return saved;
  }
}
