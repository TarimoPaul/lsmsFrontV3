import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';

import { ApiError } from '@core/api/api.types';
import { LanguageService } from '@core/i18n/language.service';
import { LsmsValidators } from '@shared/forms/validators';
import { Button, DateField, DialogService, DialogShell, Icon, SelectField, SelectOption, TextField, ToastService } from '@shared/ui';
import { dayOnly, parseLocal, toIsoDate } from '@shared/utils/date-utils';
import { MoneyPipe } from '@shared/utils/money';
import { BUSINESS_TYPES, OpeningCapital } from './business-settings.models';
import { BusinessSettingsService } from './business-settings.service';

export interface OpeningCapitalData {
  existing: OpeningCapital | null;
  /** Pre-fill for a first setup (main settings name / TIN). */
  businessName: string;
  taxId: string | null;
}

const STEPS = [
  { en: 'Business', sw: 'Biashara', icon: 'storefront' },
  { en: 'Capital sources', sw: 'Vyanzo vya mtaji', icon: 'savings' },
  { en: 'Allocation', sw: 'Ugawaji', icon: 'pie_chart' },
  { en: 'Review', sw: 'Hakiki', icon: 'fact_check' },
] as const;

/**
 * Opening-capital wizard (Flutter `BusinessSetupWizard`): where the starting
 * capital came from (owner / partners / loan) and how it was used (stock,
 * fixed assets, cash; the rest is working capital). It is a reference record —
 * Capital shows it as "initial capital"; it posts no journal.
 *
 * Differences from Flutter: an existing record is edited (PUT) instead of
 * re-posting initial-setup (which always failed with "already exists"), and
 * nothing is saved silently when the wizard opens.
 */
@Component({
  selector: 'app-opening-capital-dialog',
  imports: [ReactiveFormsModule, DialogShell, TextField, DateField, SelectField, Button, Icon, MoneyPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <lsms-dialog [title]="data.existing ? i18n.t('Edit opening capital', 'Hariri mtaji wa awali') : i18n.t('Opening capital setup', 'Usanidi wa mtaji wa awali')" icon="account_balance_wallet">
      <ol class="steps">
        @for (s of steps; track $index) {
          <li [class.on]="step() === $index" [class.done]="step() > $index">
            <button type="button" [disabled]="$index > maxStep()" (click)="go($index)">
              <span class="dot">@if (step() > $index) { <lsms-icon name="check" [size]="14" /> } @else { {{ $index + 1 }} }</span>
              <span class="lbl">{{ i18n.isSwahili() ? s.sw : s.en }}</span>
            </button>
          </li>
        }
      </ol>

      <form id="oc-form" [formGroup]="form" (ngSubmit)="next()" novalidate>
        @switch (step()) {
          @case (0) {
            <div class="grid">
              <lsms-text-field class="span2" formControlName="businessName" [label]="i18n.t('Business name', 'Jina la biashara')" prefixIcon="business" [required]="true" [maxLength]="120" />
              <lsms-date-field formControlName="startDate" [label]="i18n.t('Start date', 'Tarehe ya kuanzisha')" [required]="true" [max]="today" />
              <lsms-select-field formControlName="businessType" [label]="i18n.t('Business type', 'Aina ya biashara')" prefixIcon="category" [options]="typeOptions()" [placeholder]="i18n.t('Choose…', 'Chagua…')" />
              <lsms-text-field class="span2" formControlName="businessLocation" [label]="i18n.t('Location', 'Mahali')" prefixIcon="location_on" placeholder="Kariakoo, Dar es Salaam" />
              <lsms-text-field class="span2" formControlName="businessDescription" type="textarea" [rows]="2" [maxLength]="300" [label]="i18n.t('Description (optional)', 'Maelezo (si lazima)')" />
            </div>
            <p class="note"><lsms-icon name="info" [size]="16" />{{ i18n.t('Used for reports and the Capital position — no journal is posted.', 'Hutumika kwenye ripoti na hali ya mtaji — hakuna ingizo la hesabu linalowekwa.') }}</p>
          }
          @case (1) {
            @if (stockValue() > 0) {
              <button type="button" class="hint-btn" (click)="useStock('owner')">
                <lsms-icon name="auto_fix_high" [size]="16" />
                <span>{{ i18n.t('Current stock at cost is', 'Stoki ya sasa kwa gharama ni') }} <b>{{ stockValue() | money: { decimals: 0 } }}</b> — {{ i18n.t('use it as owner capital', 'itumie kama mtaji wa mmiliki') }}</span>
              </button>
            }
            <div class="grid one">
              <lsms-text-field formControlName="ownerEquity" type="currency" [label]="i18n.t('Owner capital', 'Mtaji wa mmiliki')" prefixIcon="person" [required]="true" [hint]="i18n.t('Money you put in yourself', 'Pesa uliyoweka wewe mwenyewe')" />
              <lsms-text-field formControlName="partnerContributions" type="currency" [label]="i18n.t('Partner contributions', 'Mchango wa washirika')" prefixIcon="group" [hint]="i18n.t('Optional', 'Si lazima')" />
              <lsms-text-field formControlName="loanCapital" type="currency" [label]="i18n.t('Loan', 'Mkopo')" prefixIcon="account_balance" [hint]="i18n.t('From a bank or elsewhere (optional)', 'Kutoka benki au mahali pengine (si lazima)')" />
            </div>
            <div class="total"><span>{{ i18n.t('Total capital', 'Jumla ya mtaji') }}</span><b>{{ total() | money: { decimals: 0 } }}</b></div>
          }
          @case (2) {
            <div class="total soft"><span>{{ i18n.t('Capital to allocate', 'Mtaji wa kugawa') }}</span><b>{{ total() | money: { decimals: 0 } }}</b></div>
            <div class="grid one">
              <lsms-text-field formControlName="initialStockAllocation" type="currency" [label]="i18n.t('Stock', 'Stoki ya bidhaa')" prefixIcon="inventory_2" [hint]="pct(v().initialStockAllocation)" />
              <lsms-text-field formControlName="initialFixedAssets" type="currency" [label]="i18n.t('Fixed assets', 'Vifaa na mali za kudumu')" prefixIcon="chair" [hint]="pct(v().initialFixedAssets) || i18n.t('Furniture, vehicles, computers …', 'Samani, gari, kompyuta …')" />
              <lsms-text-field formControlName="initialCash" type="currency" [label]="i18n.t('Cash at hand / bank', 'Pesa taslimu / benki')" prefixIcon="payments" [hint]="pct(v().initialCash)" />
            </div>
            @if (stockValue() > 0 && !v().initialStockAllocation) {
              <button type="button" class="link" (click)="useStock('stock')"><lsms-icon name="auto_fix_high" [size]="15" />{{ i18n.t('Use current stock value', 'Tumia thamani ya stoki ya sasa') }} ({{ stockValue() | money: { decimals: 0 } }})</button>
            }
            <div class="alloc">
              <div class="bar" role="img" [attr.aria-label]="i18n.t('Allocation', 'Ugawaji')">
                @for (p of parts(); track p.key) {
                  <i [style.width.%]="p.pct" [style.background]="p.color" [title]="p.label"></i>
                }
              </div>
              <div class="legend">
                @for (p of parts(); track p.key) {
                  <span><i [style.background]="p.color"></i>{{ p.label }} <b>{{ p.value | money: { decimals: 0 } }}</b></span>
                }
              </div>
              <div class="remain" [class.over]="unallocated() < 0" [class.ok]="unallocated() === 0">
                <lsms-icon [name]="unallocated() < 0 ? 'error' : unallocated() > 0 ? 'info' : 'check_circle'" [size]="17" />
                <span>
                  @if (unallocated() < 0) {
                    {{ i18n.t('Allocated more than the capital by', 'Umegawa zaidi ya mtaji kwa') }} <b>{{ -unallocated() | money: { decimals: 0 } }}</b>
                  } @else if (unallocated() > 0) {
                    <b>{{ unallocated() | money: { decimals: 0 } }}</b> {{ i18n.t('is not allocated — it counts as working capital', 'haijagawanywa — inahesabiwa kama mtaji wa uendeshaji') }}
                  } @else {
                    {{ i18n.t('All capital is allocated', 'Mtaji wote umegawanywa') }}
                  }
                </span>
                @if (unallocated() > 0) {
                  <button type="button" lsmsButton="secondary" size="sm" (click)="restToCash()">{{ i18n.t('Put it in cash', 'Weka kwenye pesa taslimu') }}</button>
                }
              </div>
            </div>
          }
          @case (3) {
            <dl class="review">
              <div class="head"><dt>{{ v().businessName }}</dt><dd>{{ startLabel() }}@if (v().businessType) { · {{ v().businessType }} }@if (v().businessLocation) { · {{ v().businessLocation }} }</dd></div>
              <h5>{{ i18n.t('Sources', 'Vyanzo') }}</h5>
              <div><dt>{{ i18n.t('Owner capital', 'Mtaji wa mmiliki') }}</dt><dd>{{ v().ownerEquity ?? 0 | money: { decimals: 0 } }}</dd></div>
              @if (v().partnerContributions) { <div><dt>{{ i18n.t('Partners', 'Washirika') }}</dt><dd>{{ v().partnerContributions | money: { decimals: 0 } }}</dd></div> }
              @if (v().loanCapital) { <div><dt>{{ i18n.t('Loan', 'Mkopo') }}</dt><dd>{{ v().loanCapital | money: { decimals: 0 } }}</dd></div> }
              <div class="sum"><dt>{{ i18n.t('Total capital', 'Jumla ya mtaji') }}</dt><dd>{{ total() | money: { decimals: 0 } }}</dd></div>
              <h5>{{ i18n.t('Allocation', 'Ugawaji') }}</h5>
              @for (p of parts(); track p.key) {
                <div><dt><i class="sw" [style.background]="p.color"></i>{{ p.label }}</dt><dd>{{ p.value | money: { decimals: 0 } }} <small>{{ p.pct.toFixed(1) }}%</small></dd></div>
              }
            </dl>
          }
        }
      </form>

      <ng-container dialogActions>
        @if (step() > 0) {
          <button lsmsButton="secondary" type="button" icon="arrow_back" (click)="go(step() - 1)">{{ i18n.t('Back', 'Rudi') }}</button>
        } @else {
          <button lsmsButton="secondary" type="button" (click)="ref.close()">{{ i18n.t('Cancel', 'Ghairi') }}</button>
        }
        <button lsmsButton type="submit" form="oc-form" [icon]="step() === 3 ? 'check' : 'arrow_forward'" [loading]="busy()" [disabled]="!stepValid()">
          {{ step() === 3 ? (data.existing ? i18n.t('Save changes', 'Hifadhi mabadiliko') : i18n.t('Complete setup', 'Kamilisha usanidi')) : i18n.t('Next', 'Endelea') }}
        </button>
      </ng-container>
    </lsms-dialog>
  `,
  styles: `
    .steps { display: flex; gap: 6px; margin: 0 0 14px; padding: 0; list-style: none; }
    .steps li { flex: 1; min-width: 0; }
    .steps button { display: flex; align-items: center; gap: 8px; width: 100%; padding: 8px 10px; border-radius: 12px; border: 1px solid var(--c-border); background: var(--c-surface); font: inherit; color: var(--c-text-2); cursor: pointer; text-align: left; }
    .steps button:disabled { cursor: default; opacity: 0.6; }
    .dot { display: inline-grid; place-items: center; flex-shrink: 0; width: 22px; height: 22px; border-radius: 50%; font-size: 0.74rem; font-weight: 700; background: color-mix(in srgb, var(--c-text-2) 12%, transparent); }
    .lbl { font-size: 0.78rem; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .steps li.on button { border-color: var(--c-primary); color: var(--c-primary); background: color-mix(in srgb, var(--c-primary) 6%, var(--c-surface)); }
    .steps li.on .dot { color: #fff; background: var(--c-primary); }
    .steps li.done .dot { color: #fff; background: var(--c-success); }
    @media (max-width: 560px) { .lbl { display: none; } .steps button { justify-content: center; } }

    form { display: flex; flex-direction: column; gap: 10px; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0 14px; }
    .grid.one { grid-template-columns: 1fr; }
    .span2 { grid-column: 1 / -1; }
    @media (max-width: 600px) { .grid { grid-template-columns: 1fr; } }
    .note { display: flex; align-items: flex-start; gap: 8px; padding: 10px 12px; border-radius: 12px; font-size: 0.8rem; color: var(--c-text-2); background: color-mix(in srgb, var(--c-info) 7%, var(--c-bg)); lsms-icon { flex-shrink: 0; color: var(--c-info); } }
    .hint-btn { display: flex; align-items: center; gap: 8px; padding: 10px 12px; border-radius: 12px; border: 1px dashed color-mix(in srgb, var(--c-info) 50%, transparent); background: color-mix(in srgb, var(--c-info) 6%, var(--c-bg)); font: inherit; font-size: 0.8rem; color: var(--c-text); text-align: left; cursor: pointer; lsms-icon { flex-shrink: 0; color: var(--c-info); } }
    .link { display: inline-flex; align-items: center; gap: 6px; align-self: flex-start; padding: 0; border: 0; background: none; font: inherit; font-size: 0.8rem; font-weight: 600; color: var(--c-primary); cursor: pointer; }
    .total { display: flex; justify-content: space-between; align-items: baseline; padding: 12px 14px; border-radius: 14px; color: #fff; background: linear-gradient(135deg, var(--c-primary), color-mix(in srgb, var(--c-primary) 75%, #000)); }
    .total span { font-size: 0.8rem; font-weight: 600; opacity: 0.9; }
    .total b { font-size: 1.15rem; font-variant-numeric: tabular-nums; }
    .total.soft { color: var(--c-primary); background: color-mix(in srgb, var(--c-primary) 8%, var(--c-bg)); }
    .alloc { display: flex; flex-direction: column; gap: 10px; padding: 12px 14px; border-radius: 14px; border: 1px solid var(--c-border); background: var(--c-bg); }
    .bar { display: flex; height: 10px; border-radius: 6px; overflow: hidden; background: color-mix(in srgb, var(--c-text-2) 12%, transparent); }
    .bar i { display: block; height: 100%; transition: width 0.3s ease; }
    .legend { display: flex; flex-wrap: wrap; gap: 6px 16px; font-size: 0.76rem; color: var(--c-text-2); }
    .legend span { display: inline-flex; align-items: center; gap: 6px; }
    .legend i, .sw { display: inline-block; width: 9px; height: 9px; border-radius: 50%; }
    .legend b { font-weight: 600; color: var(--c-text); font-variant-numeric: tabular-nums; }
    .remain { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; font-size: 0.8rem; color: var(--c-warning); }
    .remain span { flex: 1; min-width: 180px; }
    .remain.over { color: var(--c-error); }
    .remain.ok { color: var(--c-success); }
    .review { display: flex; flex-direction: column; margin: 0; padding: 4px 14px; border-radius: 14px; border: 1px solid var(--c-border); background: var(--c-bg); }
    .review > div { display: flex; justify-content: space-between; gap: 12px; padding: 7px 0; border-bottom: 1px dashed var(--c-border); font-size: 0.85rem; }
    .review > div:last-child { border-bottom: 0; }
    .review dt { display: inline-flex; align-items: center; gap: 8px; color: var(--c-text-2); }
    .review dd { margin: 0; font-weight: 600; font-variant-numeric: tabular-nums; color: var(--c-text); }
    .review dd small { margin-left: 6px; font-weight: 400; color: var(--c-text-2); }
    .review .head { flex-direction: column; gap: 2px; padding: 10px 0; }
    .review .head dt { font-size: 1rem; font-weight: 700; color: var(--c-text); }
    .review .head dd { font-weight: 400; font-size: 0.78rem; color: var(--c-text-2); }
    .review .sum dd { color: var(--c-primary); }
    .review h5 { margin: 10px 0 2px; font-size: 0.7rem; font-weight: 800; letter-spacing: 0.8px; text-transform: uppercase; color: var(--c-text-2); }
  `,
})
export class OpeningCapitalDialog {
  protected readonly data = inject<OpeningCapitalData>(DIALOG_DATA);
  protected readonly ref = inject<DialogRef<boolean>>(DialogRef);
  protected readonly i18n = inject(LanguageService);
  private readonly api = inject(BusinessSettingsService);
  private readonly dialogs = inject(DialogService);
  private readonly toast = inject(ToastService);

  protected readonly steps = STEPS;
  protected readonly today = dayOnly(new Date());
  protected readonly step = signal(0);
  protected readonly maxStep = signal(this.data.existing ? 3 : 0);
  protected readonly busy = signal(false);
  protected readonly stockValue = signal(0);

  private readonly e = this.data.existing;
  protected readonly form = inject(FormBuilder).group({
    businessName: [this.e?.businessName || this.data.businessName, [LsmsValidators.required('Business name'), LsmsValidators.minLength(2, 'Business name')]],
    startDate: [(this.e ? parseLocal(this.e.businessStartDate) : null) ?? this.today, [LsmsValidators.required('Start date')]],
    businessType: [this.e?.businessType ?? null as string | null],
    businessLocation: [this.e?.businessLocation ?? ''],
    businessDescription: [this.e?.businessDescription ?? ''],
    ownerEquity: [this.e?.ownerEquity ?? null as number | null, [LsmsValidators.currency('Owner capital', 0)]],
    partnerContributions: [this.e?.partnerContributions || null as number | null, [LsmsValidators.currency('Partner contributions', 0)]],
    loanCapital: [this.e?.loanCapital || null as number | null, [LsmsValidators.currency('Loan', 0)]],
    initialStockAllocation: [this.e?.initialStockAllocation || null as number | null, [LsmsValidators.currency('Stock', 0)]],
    initialFixedAssets: [this.e?.initialFixedAssets || null as number | null, [LsmsValidators.currency('Fixed assets', 0)]],
    initialCash: [this.e?.initialCash || null as number | null, [LsmsValidators.currency('Cash', 0)]],
  });
  protected readonly v = toSignal(this.form.valueChanges, { initialValue: this.form.getRawValue() });

  protected readonly typeOptions = computed<SelectOption[]>(() =>
    BUSINESS_TYPES.map((t) => ({ value: t.value, label: this.i18n.isSwahili() ? t.sw : t.en })),
  );
  protected readonly total = computed(() => (this.v().ownerEquity ?? 0) + (this.v().partnerContributions ?? 0) + (this.v().loanCapital ?? 0));
  private readonly allocated = computed(() => (this.v().initialStockAllocation ?? 0) + (this.v().initialFixedAssets ?? 0) + (this.v().initialCash ?? 0));
  protected readonly unallocated = computed(() => this.total() - this.allocated());
  protected readonly parts = computed(() => {
    const t = this.i18n.t.bind(this.i18n);
    const base = Math.max(this.total(), this.allocated(), 1);
    const rows = [
      { key: 'stock', label: t('Stock', 'Stoki'), value: this.v().initialStockAllocation ?? 0, color: 'var(--c-info)' },
      { key: 'assets', label: t('Fixed assets', 'Mali za kudumu'), value: this.v().initialFixedAssets ?? 0, color: 'var(--c-warning)' },
      { key: 'cash', label: t('Cash', 'Pesa taslimu'), value: this.v().initialCash ?? 0, color: 'var(--c-success)' },
      { key: 'working', label: t('Working capital', 'Mtaji wa uendeshaji'), value: Math.max(0, this.unallocated()), color: 'color-mix(in srgb, var(--c-primary) 45%, transparent)' },
    ];
    return rows.filter((r) => r.value > 0 || r.key !== 'working').map((r) => ({ ...r, pct: (r.value / base) * 100 }));
  });
  protected readonly stepValid = computed(() => {
    const v = this.v();
    const c = this.form.controls;
    switch (this.step()) {
      case 0:
        return c.businessName.valid && !!v.startDate;
      case 1:
        return this.total() > 0 && c.ownerEquity.valid && c.partnerContributions.valid && c.loanCapital.valid;
      case 2:
        return this.unallocated() >= 0 && c.initialStockAllocation.valid && c.initialFixedAssets.valid && c.initialCash.valid;
      default:
        return this.form.valid && this.total() > 0 && this.unallocated() >= 0;
    }
  });
  protected readonly startLabel = computed(() => {
    const d = this.v().startDate;
    return d ? new Intl.DateTimeFormat(this.i18n.isSwahili() ? 'sw-TZ' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric' }).format(d) : '';
  });

  constructor() {
    void this.api.inventoryValue().then((n) => this.stockValue.set(n));
  }

  protected pct(n: number | null | undefined): string {
    const t = this.total();
    return n && t > 0 ? this.i18n.t(`${((n / t) * 100).toFixed(1)}% of capital`, `${((n / t) * 100).toFixed(1)}% ya mtaji`) : '';
  }

  protected useStock(target: 'owner' | 'stock'): void {
    const n = this.stockValue();
    if (target === 'owner') this.form.controls.ownerEquity.setValue(n);
    if (target === 'owner' && !this.v().initialStockAllocation) this.form.controls.initialStockAllocation.setValue(n);
    if (target === 'stock') this.form.controls.initialStockAllocation.setValue(n);
  }

  protected restToCash(): void {
    this.form.controls.initialCash.setValue((this.v().initialCash ?? 0) + this.unallocated());
  }

  protected go(i: number): void {
    if (i < 0 || i > this.maxStep()) return;
    this.step.set(i);
  }

  protected async next(): Promise<void> {
    this.form.markAllAsTouched();
    if (!this.stepValid() || this.busy()) return;
    if (this.step() < 3) {
      this.step.update((s) => s + 1);
      this.maxStep.update((m) => Math.max(m, this.step()));
      return;
    }
    await this.save();
  }

  private async save(): Promise<void> {
    if (!this.e) {
      const ok = await this.dialogs.confirm({
        title: this.i18n.t('Complete setup?', 'Kamilisha usanidi?'),
        message: this.i18n.t(
          'The opening capital can be corrected later from Business Settings.',
          'Mtaji wa awali unaweza kurekebishwa baadaye kwenye Mipangilio ya Biashara.',
        ),
        confirmText: this.i18n.t('Yes, complete', 'Ndiyo, kamilisha'),
      });
      if (!ok) return;
    }
    this.busy.set(true);
    try {
      const v = this.form.getRawValue();
      const t = (x: string | null | undefined) => x?.trim() || null;
      const stock = v.initialStockAllocation ?? 0;
      const assets = v.initialFixedAssets ?? 0;
      const cash = v.initialCash ?? 0;
      await this.api.saveOpening(
        {
          uid: this.e?.uid ?? null,
          businessName: (v.businessName ?? '').trim(),
          businessStartDate: toIsoDate(v.startDate ?? this.today),
          businessType: t(v.businessType),
          businessLocation: t(v.businessLocation),
          businessDescription: t(v.businessDescription),
          ownerEquity: v.ownerEquity ?? 0,
          partnerContributions: v.partnerContributions ?? 0,
          loanCapital: v.loanCapital ?? 0,
          totalInitialCapital: this.total(),
          initialStockAllocation: stock,
          initialFixedAssets: assets,
          initialCash: cash,
          initialWorkingCapital: this.total() - stock - assets - cash,
          currency: this.e?.currency ?? 'TZS',
          taxIdentificationNumber: this.e?.taxIdentificationNumber ?? this.data.taxId,
        },
        !!this.e,
      );
      this.toast.success(this.e ? this.i18n.t('Opening capital updated', 'Mtaji wa awali umesasishwa') : this.i18n.t('Business setup completed', 'Usanidi wa biashara umekamilika'));
      this.ref.close(true);
    } catch (e) {
      this.toast.error(ApiError.from(e).message);
    } finally {
      this.busy.set(false);
    }
  }
}
