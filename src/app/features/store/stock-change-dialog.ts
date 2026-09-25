import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';

import { ApiError } from '@core/api/api.types';
import { LanguageService } from '@core/i18n/language.service';
import { LsmsValidators } from '@shared/forms/validators';
import { Button, DialogShell, Icon, TextField, ToastService } from '@shared/ui';
import { ChangeKind, StockItem, packagesLabel } from './store.models';
import { StoreService } from './store.service';

export interface StockChangeData {
  item: StockItem;
  kind?: ChangeKind;
}

const KINDS: Record<ChangeKind, { en: string; sw: string; hint: { en: string; sw: string }; icon: string; color: string; sign: 1 | -1 }> = {
  ADJUST_IN: { en: 'Add stock', sw: 'Ongeza mzigo', hint: { en: 'Found extra stock or a correction upwards', sw: 'Mzigo wa ziada au marekebisho ya kuongeza' }, icon: 'add_circle', color: 'var(--c-success)', sign: 1 },
  ADJUST_OUT: { en: 'Remove stock', sw: 'Punguza mzigo', hint: { en: 'Missing items or a correction downwards', sw: 'Mzigo uliopotea au marekebisho ya kupunguza' }, icon: 'remove_circle', color: 'var(--c-warning)', sign: -1 },
  DAMAGE: { en: 'Damaged', sw: 'Umeharibika', hint: { en: 'Broken, expired or spoiled items', sw: 'Vilivyovunjika, kuisha muda au kuharibika' }, icon: 'broken_image', color: 'var(--c-error)', sign: -1 },
  RETURN: { en: 'Customer return', sw: 'Marejesho ya mteja', hint: { en: 'Good items brought back by a customer', sw: 'Bidhaa nzima zilizorudishwa na mteja' }, icon: 'assignment_return', color: 'var(--c-info)', sign: 1 },
};

/**
 * Change stock outside a sale / purchase — port of Flutter `StoreForm`
 * (adjustment, damage, return to stock). Quantity can be entered in packages
 * and pieces; the resulting stock is previewed and going below zero is blocked.
 */
@Component({
  selector: 'app-stock-change-dialog',
  imports: [ReactiveFormsModule, DialogShell, TextField, Button, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <lsms-dialog [title]="i18n.t('Change stock', 'Badilisha mzigo') + ' · ' + data.item.productName" icon="tune">
      <div class="kinds" role="radiogroup">
        @for (k of kinds; track k) {
          <button type="button" role="radio" class="kind" [class.on]="kind() === k" [attr.aria-checked]="kind() === k" [style.--k]="meta[k].color" (click)="kind.set(k)">
            <lsms-icon [name]="meta[k].icon" [size]="20" />
            <span><b>{{ i18n.isSwahili() ? meta[k].sw : meta[k].en }}</b><small>{{ meta[k].hint[i18n.lang()] }}</small></span>
          </button>
        }
      </div>

      <form id="stock-form" [formGroup]="form" (ngSubmit)="save()" novalidate>
        <div class="qty" [class.single]="!perPackage">
          @if (perPackage) {
            <lsms-text-field formControlName="packages" type="number" [label]="i18n.t('Packages', 'Paketi') + ' (×' + perPackage + ')'" prefixIcon="deployed_code" placeholder="0" />
          }
          <lsms-text-field formControlName="pieces" type="number" [label]="i18n.t('Pieces', 'Vipande')" prefixIcon="numbers" placeholder="0" [autofocus]="true" />
        </div>

        <div class="preview" [class.bad]="negative()">
          <span><small>{{ i18n.t('Now', 'Sasa') }}</small><b>{{ label(data.item.currentStock) }}</b></span>
          <lsms-icon name="arrow_forward" [size]="20" />
          <span><small>{{ i18n.t('After', 'Baadaye') }}</small><b>{{ label(after()) }}</b></span>
          <span class="delta" [style.color]="meta[kind()].color">{{ signed() > 0 ? '+' : '' }}{{ signed() }} {{ i18n.t('pcs', 'vip') }}</span>
        </div>
        @if (negative()) {
          <p class="err"><lsms-icon name="error" [size]="16" [filled]="true" />{{ i18n.t('Stock cannot go below zero.', 'Mzigo hauwezi kuwa chini ya sifuri.') }}</p>
        }

        <lsms-text-field formControlName="reason" type="textarea" [rows]="2" [label]="i18n.t('Reason', 'Sababu')" [required]="true" [maxLength]="255" [placeholder]="i18n.t('What happened?', 'Nini kimetokea?')" />
        <lsms-text-field formControlName="reference" [label]="i18n.t('Reference (optional)', 'Kumbukumbu (si lazima)')" [placeholder]="i18n.t('Receipt, note or count sheet no.', 'Namba ya risiti au karatasi ya kuhesabu')" [maxLength]="100" />
      </form>

      <ng-container dialogActions>
        <button lsmsButton="secondary" type="button" (click)="ref.close()">{{ i18n.t('Cancel', 'Ghairi') }}</button>
        <button lsmsButton type="submit" form="stock-form" icon="check" [loading]="busy()" [disabled]="!canSave()">{{ i18n.t('Save change', 'Hifadhi mabadiliko') }}</button>
      </ng-container>
    </lsms-dialog>
  `,
  styles: `
    .kinds { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 14px; }
    @media (max-width: 560px) { .kinds { grid-template-columns: 1fr; } }
    .kind {
      --k: var(--c-primary);
      display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-radius: 12px; cursor: pointer; text-align: left;
      font: inherit; color: var(--c-text); background: var(--c-surface); border: 1px solid var(--c-border);
      lsms-icon { color: var(--k); }
      span { display: flex; flex-direction: column; min-width: 0; }
      b { font-size: 0.86rem; }
      small { font-size: 0.72rem; color: var(--c-text-2); }
      &.on { border-color: var(--k); background: color-mix(in srgb, var(--k) 8%, var(--c-surface)); box-shadow: 0 0 0 1px var(--k); }
    }
    .qty { display: grid; grid-template-columns: 1fr 1fr; gap: 0 14px; }
    .qty.single { grid-template-columns: 1fr; }
    .preview {
      display: flex; align-items: center; gap: 14px; margin-bottom: 12px; padding: 12px 14px; border-radius: 12px;
      background: var(--c-bg); border: 1px solid var(--c-border);
      span { display: flex; flex-direction: column; }
      small { font-size: 0.7rem; color: var(--c-text-2); }
      b { font-size: 1rem; font-weight: 800; font-variant-numeric: tabular-nums; }
      .delta { margin-left: auto; font-weight: 800; font-variant-numeric: tabular-nums; }
      lsms-icon { color: var(--c-text-2); }
      &.bad { border-color: color-mix(in srgb, var(--c-error) 40%, transparent); background: color-mix(in srgb, var(--c-error) 6%, var(--c-bg)); }
    }
    .err { display: flex; align-items: center; gap: 6px; margin: -6px 0 10px; font-size: 0.8rem; color: var(--c-error); }
  `,
})
export class StockChangeDialog {
  protected readonly data = inject<StockChangeData>(DIALOG_DATA);
  protected readonly ref = inject<DialogRef<boolean>>(DialogRef);
  protected readonly i18n = inject(LanguageService);
  private readonly api = inject(StoreService);
  private readonly toast = inject(ToastService);

  protected readonly kinds = Object.keys(KINDS) as ChangeKind[];
  protected readonly meta = KINDS;
  protected readonly kind = signal<ChangeKind>(this.data.kind ?? 'ADJUST_IN');
  protected readonly busy = signal(false);
  protected readonly perPackage = this.data.item.piecesPerPackage && this.data.item.piecesPerPackage > 1 ? this.data.item.piecesPerPackage : 0;

  protected readonly form = inject(FormBuilder).group({
    packages: [null as number | null, [LsmsValidators.integer('Packages', 0)]],
    pieces: [null as number | null, [LsmsValidators.integer('Pieces', 0)]],
    reason: ['', [LsmsValidators.required('Reason'), LsmsValidators.minLength(3, 'Reason')]],
    reference: [''],
  });
  private readonly value = toSignal(this.form.valueChanges, { initialValue: this.form.getRawValue() });

  /** Total pieces entered (packages × per-package + pieces). */
  protected readonly quantity = computed(() => {
    const v = this.value();
    const pk = Number(v.packages) || 0;
    const pc = Number(v.pieces) || 0;
    return Math.max(0, Math.round(pk) * this.perPackage + Math.round(pc));
  });
  protected readonly signed = computed(() => this.quantity() * KINDS[this.kind()].sign);
  protected readonly after = computed(() => this.data.item.currentStock + this.signed());
  protected readonly negative = computed(() => this.after() < 0);
  protected readonly canSave = computed(() => this.quantity() > 0 && !this.negative() && !this.busy() && (this.value().reason ?? '').trim().length >= 3);

  protected label(pieces: number): string {
    return packagesLabel(pieces, this.data.item.piecesPerPackage, this.data.item.packageAbbreviation, this.i18n.t('pcs', 'vip'));
  }

  protected async save(): Promise<void> {
    this.form.markAllAsTouched();
    if (this.form.invalid || !this.canSave()) return;
    this.busy.set(true);
    const uid = this.data.item.uid;
    const qty = this.quantity();
    const reason = (this.form.getRawValue().reason ?? '').trim();
    const reference = this.form.getRawValue().reference?.trim() || null;
    try {
      switch (this.kind()) {
        case 'ADJUST_IN':
          await this.api.adjust(uid, qty, reason, reference);
          break;
        case 'ADJUST_OUT':
          await this.api.adjust(uid, -qty, reason, reference);
          break;
        case 'DAMAGE':
          await this.api.damage(uid, qty, reason, reference);
          break;
        case 'RETURN':
          await this.api.returnToStock(uid, qty, reason, reference);
          break;
      }
      this.toast.success(this.i18n.t(`Stock updated: ${this.label(this.after())}`, `Mzigo umesasishwa: ${this.label(this.after())}`));
      this.ref.close(true);
    } catch (e) {
      this.toast.error(ApiError.from(e).message);
    } finally {
      this.busy.set(false);
    }
  }
}
