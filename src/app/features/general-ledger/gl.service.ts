import { Injectable, inject, signal } from '@angular/core';

import { ApiService } from '@core/api/api.service';
import { PageResult } from '@core/api/api.types';
import { CachedResource } from '@core/data/cached-resource';
import {
  AccountLedger,
  BalanceSheet,
  ControlCheck,
  ControlKey,
  FinancialPosition,
  GlAccount,
  GlStatus,
  IncomeStatement,
  JournalEntry,
  ManualLine,
  TrialBalance,
} from './gl.models';

const BASE = '/api/v1/gl';

/**
 * General Ledger API. Reads need FINANCE_READ (position / control checks also
 * accept CAPITAL_READ); writes (manual journal, transfer, true-up) need
 * FINANCE_WRITE. Every write bumps {@link version} so open reports refresh.
 */
@Injectable({ providedIn: 'root' })
export class GlService {
  private readonly api = inject(ApiService);

  /** Bumped after any posting made from the UI (manual journal, transfer, true-up, capital actions). */
  readonly version = signal(0);

  readonly accounts = new CachedResource<GlAccount[]>(
    async () => (await this.api.get<GlAccount[] | null>(`${BASE}/accounts`)) ?? [],
    30 * 60_000,
  );

  touch(): void {
    this.version.update((v) => v + 1);
  }

  status(): Promise<GlStatus> {
    return this.api.get<GlStatus>(`${BASE}/status`);
  }

  position(asOfDate?: string): Promise<FinancialPosition> {
    return this.api.get<FinancialPosition>(`${BASE}/financial-position`, { params: { asOfDate } });
  }

  controlChecks(asOfDate?: string): Promise<ControlCheck[]> {
    return this.api.get<ControlCheck[]>(`${BASE}/control-checks`, { params: { asOfDate } });
  }

  trialBalance(startDate: string, endDate: string): Promise<TrialBalance> {
    return this.api.get<TrialBalance>(`${BASE}/trial-balance`, { params: { startDate, endDate } });
  }

  balanceSheet(asOfDate: string): Promise<BalanceSheet> {
    return this.api.get<BalanceSheet>(`${BASE}/balance-sheet`, { params: { asOfDate } });
  }

  incomeStatement(startDate: string, endDate: string): Promise<IncomeStatement> {
    return this.api.get<IncomeStatement>(`${BASE}/income-statement`, { params: { startDate, endDate } });
  }

  ledger(accountCode: string, startDate: string, endDate: string): Promise<AccountLedger> {
    return this.api.get<AccountLedger>(`${BASE}/ledger/${accountCode}`, { params: { startDate, endDate } });
  }

  journal(q: { startDate: string; endDate: string; referenceType?: string; page: number; size: number }): Promise<PageResult<JournalEntry>> {
    return this.api.getPage<JournalEntry>(`${BASE}/journal-entries`, {
      params: { startDate: q.startDate, endDate: q.endDate, referenceType: q.referenceType, page: q.page, size: q.size },
    });
  }

  async manualJournal(body: { entryDate: string; memo: string; lines: ManualLine[] }): Promise<string> {
    const ref = await this.api.post<string>(`${BASE}/journal-entries/manual`, body);
    this.touch();
    return ref;
  }

  async transfer(body: { fromAccount: string; toAccount: string; amount: number; date: string; note: string }): Promise<string> {
    const ref = await this.api.post<string>(`${BASE}/transfers`, body);
    this.touch();
    return ref;
  }

  async trueUp(body: { key: ControlKey; asOfDate: string; offsetAccount: string; reason: string }): Promise<Record<string, unknown>> {
    const r = await this.api.post<Record<string, unknown>>(`${BASE}/true-up`, body);
    this.touch();
    return r;
  }

  async trueUpCash(body: { accountCode: string; actualBalance: number; asOfDate: string; offsetAccount: string; reason: string }): Promise<Record<string, unknown>> {
    const r = await this.api.post<Record<string, unknown>>(`${BASE}/true-up/cash`, body);
    this.touch();
    return r;
  }
}
