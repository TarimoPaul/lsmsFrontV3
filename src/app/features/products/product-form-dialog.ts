import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';

import { ApiError } from '@core/api/api.types';
import { AuthService } from '@core/auth/auth.service';
import { LanguageService } from '@core/i18n/language.service';
import { LsmsValidators } from '@shared/forms/validators';
import { Button, DialogShell, Icon, SelectField, SelectOption, TextField, ToastService } from '@shared/ui';
import { MoneyPipe } from '@shared/utils/money';
import { CategoriesService } from '../categories/categories.service';
import { MeasuresService } from '../items-measure/measures.service';
import {
  MeasureRef,
  PricingFields,
  Product,
  ProductRequest,
  TIERS,
  TierDef,
  displayNameOf,
  measureLabel,
  pricingIssues,
  productKey,
  tierPrices,
} from './products.models';
import { ProductsService } from './products.service';

export interface ProductFormData {
  product?: Product;
  /** Pre-fill from `product` but create a new one. */
  duplicate?: boolean;
  /** Catalogue, for the duplicate (name + measure) check. */
  existing: readonly Product[];
}

type Num = number | null;

/**
 * Create / edit / duplicate a product — port of Flutter `ProductFormDialog`
 * (basic info, pricing tiers, measure) in one scrolling form instead of tabs,
 * with live pricing validation (same rules as the backend), per-piece rates,
 * quantity suggestions from pieces-per-package and a duplicate check.
 */
@Component({
  selector: 'app-product-form-dialog',
  imports: [ReactiveFormsModule, DialogShell, TextField, SelectField, Button, Icon, MoneyPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './product-form-dialog.html',
  styleUrl: './product-form-dialog.scss',
})
export class ProductFormDialog {
  protected readonly data = inject<ProductFormData>(DIALOG_DATA);
  protected readonly ref = inject<DialogRef<boolean>>(DialogRef);
  protected readonly i18n = inject(LanguageService);
  private readonly auth = inject(AuthService);
  private readonly api = inject(ProductsService);
  private readonly categoriesApi = inject(CategoriesService);
  private readonly measuresApi = inject(MeasuresService);
  private readonly toast = inject(ToastService);

  protected readonly tiers = TIERS;
  private syncingBase = false;
  protected readonly busy = signal(false);
  protected readonly submitted = signal(false);

  /** Editing an existing product (duplicate = create). */
  protected readonly editing = !!this.data.product && !this.data.duplicate;
  private readonly source = this.data.product;
  /** Measures beyond the first are kept as-is (only one product in the data has two). */
  private readonly extraMeasureUids = (this.source?.itemsMeasureUids ?? []).slice(1);

  protected readonly form = inject(FormBuilder).group({
    productName: [
      this.source ? (this.data.duplicate ? `${this.source.productName} (copy)` : this.source.productName) : '',
      [LsmsValidators.required('Product name'), LsmsValidators.minLength(2, 'Product name'), LsmsValidators.maxLength(100, 'Product name')],
    ],
    categoryUid: [this.source?.categoryUid ?? (null as string | null), [LsmsValidators.required('Category')]],
    measureUid: [this.source?.itemsMeasureUids[0] ?? (null as string | null)],
    piecesPerPackage: [this.source?.piecesPerPackage ?? (null as Num), [LsmsValidators.integer('Pieces per package', 1)]],
    pieceSalePrice: [this.source?.pieceSalePrice ?? (null as Num), [LsmsValidators.currency('Piece price', 0)]],
    quarterSalePrice: [this.source?.quarterSalePrice ?? (null as Num), [LsmsValidators.currency('Quarter price', 0)]],
    quarterPackageQuantity: [this.source?.quarterPackageQuantity ?? (null as Num), [LsmsValidators.integer('Quantity', 1)]],
    halfSalePrice: [this.source?.halfSalePrice ?? (null as Num), [LsmsValidators.currency('Half price', 0)]],
    halfPackageQuantity: [this.source?.halfPackageQuantity ?? (null as Num), [LsmsValidators.integer('Quantity', 1)]],
    wholeSalePrice: [this.source?.wholeSalePrice ?? (null as Num), [LsmsValidators.currency('Whole price', 0)]],
    wholePackageQuantity: [this.source?.wholePackageQuantity ?? (null as Num), [LsmsValidators.integer('Quantity', 1)]],
    priceDescription: [this.source?.priceDescription ?? '', [LsmsValidators.maxLength(255, 'Price note')]],
  });

  private readonly value = toSignal(this.form.valueChanges, { initialValue: this.form.getRawValue() });

  // ── Reference data (shared caches) ─────────────────────────────────────────
  protected readonly categoryOptions = computed<SelectOption[]>(() => {
    const list = this.categoriesApi.list.value() ?? [];
    const opts = list.map((c) => ({ value: c.uid, label: c.categoryName })).sort((a, b) => a.label.localeCompare(b.label));
    // Keep the product's category selectable even if the list could not load.
    if (this.source?.categoryUid && !opts.some((o) => o.value === this.source!.categoryUid)) {
      opts.unshift({ value: this.source.categoryUid, label: this.source.categoryName ?? '—' });
    }
    return opts;
  });

  private readonly measures = computed<MeasureRef[]>(() => {
    const list = this.measuresApi.list.value() ?? [];
    const own = (this.source?.measures ?? []).filter((m) => !list.some((x) => x.uid === m.uid));
    return [...list, ...own];
  });
  protected readonly measureOptions = computed<SelectOption[]>(() =>
    this.measures().map((m) => ({ value: m.uid, label: measureLabel(m) + (m.abbreviation ? ` (${m.abbreviation})` : '') })),
  );

  // ── Derived state ──────────────────────────────────────────────────────────
  private readonly pricing = computed<PricingFields>(() => {
    const v = this.value();
    const n = (x: unknown): Num => (x === null || x === undefined || x === '' || !Number.isFinite(Number(x)) ? null : Number(x));
    return {
      piecesPerPackage: n(v.piecesPerPackage),
      pieceSalePrice: n(v.pieceSalePrice),
      quarterSalePrice: n(v.quarterSalePrice),
      quarterPackageQuantity: n(v.quarterPackageQuantity),
      halfSalePrice: n(v.halfSalePrice),
      halfPackageQuantity: n(v.halfPackageQuantity),
      wholeSalePrice: n(v.wholeSalePrice),
      wholePackageQuantity: n(v.wholePackageQuantity),
    };
  });

  protected readonly selectedMeasure = computed(() => this.measures().find((m) => m.uid === this.value().measureUid) ?? null);
  protected readonly displayName = computed(() => displayNameOf(this.value().productName ?? '', this.selectedMeasure()?.unitType));
  protected readonly rates = computed(() => new Map(tierPrices(this.pricing()).map((r) => [r.tier.key, r])));
  protected readonly hasAnyPrice = computed(() => TIERS.some((t) => this.pricing()[t.price] !== null));
  protected readonly hasPackage = computed(() => TIERS.some((t) => t.qty && this.pricing()[t.price] !== null));
  /** Flutter shows "Base Package Configuration" once any package price is set (kept visible when a value exists). */
  protected readonly showBase = computed(() => this.hasPackage() || this.pricing().piecesPerPackage !== null);
  protected readonly needsBase = computed(() => this.hasPackage() && !(this.pricing().piecesPerPackage! > 0));
  protected readonly baseHint = computed(() => {
    const p = this.pricing();
    if (p.quarterSalePrice !== null) return this.i18n.t('At least 4 when selling quarters', 'Angalau 4 ukiuza robo');
    if (p.halfSalePrice !== null) return this.i18n.t('At least 2 when selling halves', 'Angalau 2 ukiuza nusu');
    return this.i18n.t('Usually the same as the whole-package pieces', 'Kwa kawaida sawa na vipande vya paketi nzima');
  });

  protected readonly issues = computed(() => {
    const lang = this.i18n.lang();
    const list = pricingIssues(this.pricing()).map((i) => i[lang]);
    if (!this.hasAnyPrice()) list.unshift(this.i18n.t('Set at least one price', 'Weka angalau bei moja'));
    // The backend ignores empty values on update, so a stored price/quantity can be changed but not removed.
    if (this.editing && this.source) {
      const p = this.pricing();
      const locked: Array<[keyof PricingFields, string, string]> = [
        ['piecesPerPackage', 'Pieces per package', 'Vipande kwa paketi'],
        ...TIERS.flatMap((t): Array<[keyof PricingFields, string, string]> => [
          [t.price, `${t.en} price`, `Bei ya ${t.sw.toLowerCase()}`],
          ...(t.qty ? [[t.qty, `${t.en} quantity`, `Idadi ya ${t.sw.toLowerCase()}`] as [keyof PricingFields, string, string]] : []),
        ]),
      ];
      for (const [key, en, sw] of locked) {
        if (this.source[key] !== null && p[key] === null) {
          list.push(this.i18n.t(`${en} can be changed but not removed once saved`, `${sw} inaweza kubadilishwa lakini haiwezi kuondolewa`));
        }
      }
      if (this.source.itemsMeasureUids.length && !this.value().measureUid) {
        list.push(this.i18n.t('The measure can be changed but not removed', 'Kipimo kinaweza kubadilishwa lakini hakiwezi kuondolewa'));
      }
    }
    return list;
  });

  private readonly takenKeys = new Set(
    this.data.existing.filter((p) => !this.editing || p.uid !== this.source?.uid).map((p) => productKey(p.productName, p.itemsMeasureUids)),
  );
  protected readonly duplicate = computed(() => {
    const name = (this.value().productName ?? '').trim();
    if (!name) return false;
    return this.takenKeys.has(productKey(name, this.measureUids()));
  });

  private readonly measureUids = computed(() => {
    const first = this.value().measureUid;
    return first ? [first, ...this.extraMeasureUids.filter((u) => u !== first)] : [...this.extraMeasureUids];
  });

  /** Suggested package quantities from pieces-per-package (whole = all, half = ½, quarter = ¼). */
  protected readonly suggestions = computed(() => {
    const ppp = this.pricing().piecesPerPackage;
    if (!ppp || ppp < 1 || !Number.isInteger(ppp)) return null;
    const out: Partial<Record<TierDef['key'], number>> = {};
    for (const t of TIERS) {
      if (!t.qty) continue;
      const q = ppp * t.share;
      if (Number.isInteger(q) && q >= 1) out[t.key] = q;
    }
    return out;
  });
  protected readonly canSuggest = computed(() => {
    const s = this.suggestions();
    if (!s) return false;
    const p = this.pricing();
    return TIERS.some((t) => t.qty && s[t.key] !== undefined && p[t.qty] !== s[t.key] && (p[t.price] !== null || p[t.qty] !== null));
  });

  protected readonly canSave = computed(() => !this.busy() && !this.duplicate() && this.issues().length === 0);

  constructor() {
    // Convenience: the whole-package pieces are the base in practice (every
    // product in the data has whole qty == pieces per package), so prefill the
    // base from it until the user types their own value.
    let baseTouched = this.source?.piecesPerPackage != null;
    this.form.controls.piecesPerPackage.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => {
      if (!this.syncingBase) baseTouched = true;
    });
    this.form.controls.wholePackageQuantity.valueChanges.pipe(takeUntilDestroyed()).subscribe((q) => {
      const n = Number(q);
      if (baseTouched || !Number.isInteger(n) || n < 1) return;
      this.syncingBase = true;
      this.form.controls.piecesPerPackage.setValue(n);
      this.syncingBase = false;
    });
    if (this.auth.hasPermission('CATEGORY_READ')) this.categoriesApi.list.load().catch(() => undefined);
    if (this.auth.hasPermission('MEASURE_READ')) this.measuresApi.list.load().catch(() => undefined);
  }

  protected rateFor(t: TierDef) {
    return this.rates().get(t.key) ?? null;
  }

  /** Fill quantities for priced tiers (and empty ones) from pieces-per-package. */
  protected applySuggestions(): void {
    const s = this.suggestions();
    if (!s) return;
    const p = this.pricing();
    const patch: Record<string, number> = {};
    for (const t of TIERS) {
      if (t.qty && s[t.key] !== undefined && (p[t.price] !== null || p[t.qty] !== null)) patch[t.qty] = s[t.key]!;
    }
    this.form.patchValue(patch);
  }

  protected async save(): Promise<void> {
    this.submitted.set(true);
    this.form.markAllAsTouched();
    if (this.form.invalid || !this.canSave()) return;
    this.busy.set(true);
    try {
      const v = this.form.getRawValue();
      const p = this.pricing();
      const body: ProductRequest = {
        productName: (v.productName ?? '').trim().replace(/\s+/g, ' '),
        categoryUid: v.categoryUid!,
        itemsMeasureUids: this.measureUids(),
        ...p,
        priceDescription: (v.priceDescription ?? '').trim() || (this.editing && this.source?.priceDescription ? '' : null),
      };
      const saved = this.editing ? await this.api.update(this.source!.uid, body) : await this.api.create(body);
      const name = saved?.displayName ?? this.displayName();
      this.toast.success(this.editing ? this.i18n.t(`${name} updated`, `${name} imesasishwa`) : this.i18n.t(`${name} added`, `${name} imeongezwa`));
      this.ref.close(true);
    } catch (e) {
      this.toast.error(ApiError.from(e).message);
    } finally {
      this.busy.set(false);
    }
  }
}
