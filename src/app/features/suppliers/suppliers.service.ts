import { Injectable, inject } from '@angular/core';

import { ApiService } from '@core/api/api.service';
import { CachedList } from '@core/data/cached-resource';
import {
  Supplier,
  SupplierPayment,
  SupplierPaymentRequest,
  SupplierRequest,
  SupplierStatement,
  normalizeStatement,
  normalizeSupplier,
} from './suppliers.models';

const BASE = '/api/v1/suppliers';
const PAYMENTS = '/api/v1/supplier-payments';

/**
 * Supplier master + accounts payable (Spring `SupplierController`,
 * `SupplierPaymentController`): SUPPLIER_READ / WRITE / UPDATE / DELETE,
 * SUPPLIER_PAYMENT_VIEW (statement, payments), SUPPLIER_PAYMENT_PROCESS
 * (record / delete payment). Delete is a soft delete.
 *
 * The list is cached and shared (the purchase form's supplier picker will use
 * it); searching is done client-side instead of one request per keystroke.
 */
@Injectable({ providedIn: 'root' })
export class SuppliersService {
  private readonly api = inject(ApiService);

  readonly list = new CachedList<Supplier>(async () => {
    const rows = await this.api.get<Partial<Supplier>[] | null>(BASE);
    return (rows ?? []).map(normalizeSupplier).sort(byName);
  }, 2 * 60_000);

  async create(body: SupplierRequest): Promise<Supplier> {
    const saved = normalizeSupplier(await this.api.post<Partial<Supplier>>(BASE, body));
    this.list.update((l) => [...l, saved].sort(byName));
    return saved;
  }

  async update(uid: string, body: SupplierRequest, outstanding: number): Promise<Supplier> {
    // The update response does not include `outstanding`; keep the known value.
    const saved = { ...normalizeSupplier(await this.api.put<Partial<Supplier>>(`${BASE}/${uid}`, body)), outstanding };
    this.list.update((l) => l.map((s) => (s.uid === uid ? saved : s)).sort(byName));
    return saved;
  }

  async remove(uid: string): Promise<void> {
    await this.api.delete(`${BASE}/${uid}`);
    this.list.remove(uid);
  }

  async statement(uid: string): Promise<SupplierStatement> {
    return normalizeStatement(await this.api.get<Partial<SupplierStatement>>(`${BASE}/${uid}/statement`));
  }

  async payments(supplierUid: string): Promise<SupplierPayment[]> {
    const rows = await this.api.get<Partial<SupplierPayment>[] | null>(PAYMENTS, { params: { supplierUid } });
    return (rows ?? []).map((p) => ({
      uid: p.uid ?? '',
      supplierUid: p.supplierUid ?? supplierUid,
      purchaseUid: p.purchaseUid ?? null,
      amount: Number(p.amount ?? 0) || 0,
      paymentMethod: p.paymentMethod ?? null,
      paymentProvider: p.paymentProvider ?? null,
      paymentDate: p.paymentDate ?? null,
      paidByName: p.paidByName ?? null,
      reference: p.reference ?? null,
      notes: p.notes ?? null,
    }));
  }

  /** Outstanding changes after a payment: refresh the cached list once. */
  async recordPayment(body: SupplierPaymentRequest): Promise<void> {
    await this.api.post(PAYMENTS, body);
    this.list.invalidate();
    void this.list.load().catch(() => undefined);
  }

  /** Soft delete + GL reversal on the server. */
  async deletePayment(uid: string): Promise<void> {
    await this.api.delete(`${PAYMENTS}/${uid}`);
    this.list.invalidate();
    void this.list.load().catch(() => undefined);
  }
}

function byName(a: Supplier, b: Supplier): number {
  return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
}
