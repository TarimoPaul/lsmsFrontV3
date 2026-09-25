import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { map } from 'rxjs';

import { ApiError } from '@core/api/api.types';
import { AuthService } from '@core/auth/auth.service';
import { LanguageService } from '@core/i18n/language.service';
import { LsmsValidators } from '@shared/forms/validators';
import { Button, ComboOption, Combobox, DialogShell, Icon, TextField, ToastService } from '@shared/ui';
import { toLocalDateTime } from '@shared/utils/date-utils';
import { MoneyPipe } from '@shared/utils/money';
import { Product } from '../products/products.models';
import { ProductsService } from '../products/products.service';
import { SuppliersService } from '../suppliers/suppliers.service';
import { Eligibility, PriceInputMode, Purchase, PurchaseRequest, PurchaseType } from './purchases.models';
import { PurchasesService } from './purchases.service';

export interface PurchaseFormData {
  /** Edit an existing PENDING purchase. */
  purchase?: Purchase;
  /** Pre-select a product (e.g. "buy again" from a row). */
  productUid?: string;
}

/**
 * Closed with `{ open: uid }` when the user wants the purchase that blocks a
 * new one, or `{ repurchase: productUid }` to buy a product with history
 * through Repurchase.
 */
export type PurchaseFormResult = true | { open: string } | { repurchase: string } | undefined;

type Num = number | null;

/**
 * New / edit purchase — port of Flutter `PurchaseForm`. Picking a product
 * checks eligibility like Flutter: only a product never received before can be
 * bought here; one with history must go through Repurchase ("Tumia
 * Repurchase"), and one with a pending / approved purchase is blocked until
 * that one is finished. Live preview of total, cost per piece and margin.
 */
@Component({
  selector: 'app-purchase-form-dialog',
  imports: [ReactiveFormsModule, DialogShell, TextField, Combobox, Button, Icon, MoneyPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './purchase-form-dialog.html',
  styleUrl: './purchase-form-dialog.scss',
})
export class PurchaseFormDialog {
  protected readonly data = inject<PurchaseFormData>(DIALOG_DATA);
  protected readonly ref = inject<DialogRef<PurchaseFormResult>>(DialogRef);
  protected readonly i18n = inject(LanguageService);
  private readonly auth = inject(AuthService);
  private readonly api = inject(PurchasesService);
  private readonly productsApi = inject(ProductsService);
  private readonly suppliersApi = inject(SuppliersService);
  private readonly toast = inject(ToastService);

  protected readonly editing = !!this.data.purchase;
  private readonly p = this.data.purchase;
  protected readonly busy = signal(false);
  protected readonly checking = signal(false);
  protected readonly eligibility = signal<Eligibility | null>(null);
  protected readonly showMore = signal(false);

  protected readonly form = inject(FormBuilder).group({
    productUid: [this.p?.productUid ?? this.data.productUid ?? (null as string | null), [LsmsValidators.required('Product')]],
    purchaseType: [(this.p?.purchaseType === 'INDIVIDUAL_PIECES' ? 'INDIVIDUAL_PIECES' : 'WHOLE_PACKAGE') as PurchaseType],
    priceInputMode: [((this.p?.priceInputMode as PriceInputMode) ?? 'PER_PIECE') as PriceInputMode],
    quantity: [this.p?.quantity ?? (null as Num), [LsmsValidators.required('Quantity'), LsmsValidators.positive('Quantity')]],
    purchasePrice: [this.p?.purchasePrice ?? (null as Num), [LsmsValidators.required('Price'), LsmsValidators.positive('Price')]],
    supplierName: [this.p?.supplierName ?? (null as string | null)],
    amountPaid: [this.p ? this.p.amountPaid : (null as Num), [LsmsValidators.currency('Amount paid', 0)]],
    discountPercentage: [this.p?.discountPercentage ?? (null as Num), [LsmsValidators.numeric('Discount %', 0, 100)]],
    discountAmount: [this.p?.discountAmount ?? (null as Num), [LsmsValidators.currency('Discount', 0)]],
    minimumStockLevel: [this.p?.minimumStockLevel ?? (null as Num), [LsmsValidators.integer('Minimum stock', 0)]],
    reorderPoint: [this.p?.reorderPoint ?? (null as Num), [LsmsValidators.integer('Reorder point', 0)]],
    purchaseNotes: [this.p?.notes ?? ''],
  });
  /** Raw value (includes the product control, which is disabled when editing). */
  protected readonly value = toSignal(this.form.valueChanges.pipe(map(() => this.form.getRawValue())), { initialValue: this.form.getRawValue() });

  // ── Reference data (shared caches) ─────────────────────────────────────────
  protected readonly product = computed<Product | null>(
    () => (this.productsApi.catalogue.value() ?? []).find((x) => x.uid === this.value().productUid) ?? null,
  );
  protected readonly productOptions = computed<ComboOption[]>(() =>
    (this.productsApi.catalogue.value() ?? []).map((x) => ({
      value: x.uid,
      label: x.displayName,
      hint: x.categoryName ?? undefined,
      keywords: x.productName,
    })),
  );
  protected readonly supplierOptions = computed<ComboOption[]>(() => {
    const names = new Map<string, ComboOption>();
    for (const s of this.suppliersApi.list.value() ?? []) names.set(s.name.toLowerCase(), { value: s.name, label: s.name, hint: s.phone ?? undefined });
    // The name on an edited purchase stays selectable even if it is not in the list.
    const current = this.value().supplierName;
    if (current && !names.has(current.toLowerCase())) names.set(current.toLowerCase(), { value: current, label: current });
    return [...names.values()].sort((a, b) => a.label.localeCompare(b.label));
  });

  // ── Derived pricing ───────────────────────────────────────────────────────
  protected readonly perPackage = computed(() => this.product()?.piecesPerPackage ?? this.p?.piecesPerPackage ?? null);
  protected readonly usePackages = computed(() => this.value().purchaseType === 'WHOLE_PACKAGE');
  protected readonly unitLabel = computed(() =>
    this.usePackages() ? this.i18n.t('packages', 'paketi') : this.i18n.t('pieces', 'vipande'),
  );
  protected readonly calc = computed(() => {
    const v = this.value();
    const qty = Number(v.quantity) || 0;
    const price = Number(v.purchasePrice) || 0;
    const discount = Number(v.discountAmount) || (Number(v.discountPercentage) ? ((Number(v.discountPercentage) || 0) / 100) : 0);
    const gross = v.priceInputMode === 'PER_PIECE' ? price * qty : price;
    const discountValue = Number(v.discountAmount) ? Number(v.discountAmount) : gross * (Number(v.discountPercentage) ? discount : 0);
    const total = Math.max(0, gross - discountValue);
    const pieces = this.usePackages() ? qty * (this.perPackage() || 1) : qty;
    const costPerPiece = pieces > 0 ? total / pieces : 0;
    const sell = this.product()?.pieceSalePrice ?? null;
    const margin = sell && costPerPiece ? Math.round(((sell - costPerPiece) / sell) * 1000) / 10 : null;
    const paid = this.canPayNow() ? Math.min(Number(v.amountPaid) || 0, total) : 0;
    return { qty, total, pieces, costPerPiece, sell, margin, paid, owed: Math.max(0, total - paid) };
  });

  /** Anything but a first purchase is refused here (the backend refuses it too). */
  protected readonly blocked = computed(() => {
    const s = this.eligibility()?.status;
    return !this.editing && (s === 'HAS_PENDING' || s === 'HAS_APPROVED' || s === 'HAS_HISTORY');
  });
  /** The backend stores "paid now" only on a first-time create (update ignores it). */
  protected readonly canPayNow = computed(() => !this.editing);
  protected readonly canSave = computed(() => !this.busy() && !this.checking() && !this.blocked() && !!this.value().productUid && this.calc().total > 0);
  protected readonly dueDays = computed(() => {
    const name = (this.value().supplierName ?? '').toLowerCase();
    return (this.suppliersApi.list.value() ?? []).find((s) => s.name.toLowerCase() === name)?.paymentTermsDays ?? 30;
  });

  constructor() {
    this.productsApi.catalogue.load().catch(() => undefined);
    if (this.auth.hasPermission('SUPPLIER_READ')) this.suppliersApi.list.load().catch(() => undefined);
    if (this.editing) this.form.controls.productUid.disable();
    else if (this.data.productUid) void this.onProduct(this.data.productUid);
  }

  /** Check eligibility (Flutter `_checkProductEligibility`). */
  protected async onProduct(uid: string | null): Promise<void> {
    this.eligibility.set(null);
    if (!uid || this.editing) return;
    this.checking.set(true);
    try {
      const e = await this.api.eligibility(uid);
      if (this.form.getRawValue().productUid !== uid) return;
      this.eligibility.set(e);
      if (e.status === 'ELIGIBLE' && (!this.product()?.piecesPerPackage || (this.product()?.piecesPerPackage ?? 0) <= 1)) {
        this.form.patchValue({ purchaseType: 'INDIVIDUAL_PIECES' });
      }
    } catch (err) {
      this.toast.error(ApiError.from(err).message);
    } finally {
      this.checking.set(false);
    }
  }

  protected setType(t: PurchaseType): void {
    this.form.controls.purchaseType.setValue(t);
  }

  protected setMode(m: PriceInputMode): void {
    // Keep the same money meaning when switching: convert unit price ↔ total.
    const v = this.form.getRawValue();
    const qty = Number(v.quantity) || 0;
    const price = Number(v.purchasePrice) || 0;
    if (qty > 0 && price > 0 && v.priceInputMode !== m) {
      this.form.controls.purchasePrice.setValue(m === 'TOTAL_AMOUNT' ? Math.round(price * qty) : Math.round((price / qty) * 100) / 100);
    }
    this.form.controls.priceInputMode.setValue(m);
  }

  protected payAll(full: boolean): void {
    this.form.controls.amountPaid.setValue(full ? Math.round(this.calc().total) : null);
  }

  protected goRepurchase(): void {
    const uid = this.form.getRawValue().productUid;
    if (uid) this.ref.close({ repurchase: uid });
  }

  protected openExisting(): void {
    const uid = this.eligibility()?.existingPurchaseUid;
    if (uid) this.ref.close({ open: uid });
  }

  protected async save(): Promise<void> {
    this.form.markAllAsTouched();
    if (this.form.invalid || !this.canSave()) return;
    this.busy.set(true);
    try {
      const v = this.form.getRawValue();
      const supplier = (this.suppliersApi.list.value() ?? []).find((s) => s.name.toLowerCase() === (v.supplierName ?? '').toLowerCase());
      const body: PurchaseRequest = {
        productUid: v.productUid!,
        purchaseType: v.purchaseType ?? 'WHOLE_PACKAGE',
        priceInputMode: v.priceInputMode ?? 'PER_PIECE',
        quantity: Number(v.quantity),
        purchasePrice: Number(v.purchasePrice),
        supplierName: v.supplierName?.trim() || null,
        supplierUid: supplier?.uid ?? null,
        amountPaid: this.canPayNow() ? (v.amountPaid ?? null) : null,
        discountPercentage: v.discountPercentage ?? null,
        discountAmount: v.discountAmount ?? null,
        minimumStockLevel: v.minimumStockLevel ?? null,
        reorderPoint: v.reorderPoint ?? null,
        purchaseNotes: v.purchaseNotes?.trim() || null,
        purchaseDate: this.p?.purchaseDate?.slice(0, 19) ?? toLocalDateTime(),
      };
      if (this.editing) await this.api.update(this.p!.uid, body);
      else await this.api.create(body);
      const name = this.product()?.displayName ?? this.p?.productName ?? '';
      this.toast.success(this.editing ? this.i18n.t(`Purchase of ${name} updated`, `Manunuzi ya ${name} yamesasishwa`) : this.i18n.t(`Purchase of ${name} saved — waiting for approval`, `Manunuzi ya ${name} yamehifadhiwa — yanasubiri idhini`));
      this.ref.close(true);
    } catch (e) {
      this.toast.error(ApiError.from(e).message);
    } finally {
      this.busy.set(false);
    }
  }
}
