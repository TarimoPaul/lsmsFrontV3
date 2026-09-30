import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { ApiError } from '@core/api/api.types';
import { LanguageService } from '@core/i18n/language.service';
import { LsmsValidators } from '@shared/forms/validators';
import { Button, DialogShell, Icon, TextField, ToastService } from '@shared/ui';
import { SettingsApprovalsService } from '../settings-approvals/settings-approvals.service';
import { BusinessSettings, BusinessSettingsUpdate, DEFAULT_CREDIT_TERM_DAYS, DEFAULT_VARIANCE_THRESHOLD, SETTINGS_FIELDS } from './business-settings.models';
import { BusinessSettingsService } from './business-settings.service';

export type SettingsSection = 'identity' | 'tax' | 'receipt' | 'rules';

export interface SettingsFormData {
  settings: BusinessSettings;
  /** Section to scroll to when the dialog opens. */
  focus?: SettingsSection;
  /** 'request': the user may not edit directly — the changed fields go for approval. */
  mode?: 'direct' | 'request';
}

/**
 * Edit the main business settings. Only fields that something reads are
 * offered; the backend keeps a stored value when it receives null, so a
 * cleared text field is sent as '' to really clear it.
 */
@Component({
  selector: 'app-settings-form-dialog',
  imports: [ReactiveFormsModule, DialogShell, TextField, Button, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <lsms-dialog [title]="requestMode ? i18n.t('Request a settings change', 'Omba badiliko la mipangilio') : i18n.t('Edit business settings', 'Hariri mipangilio ya biashara')" [icon]="requestMode ? 'approval' : 'settings_applications'">
      <form id="bs-form" [formGroup]="form" (ngSubmit)="save()" novalidate>
        @if (requestMode) {
          <p class="req-note"><lsms-icon name="info" [size]="17" />{{ i18n.t('Your changes are sent for approval. They take effect once another authorised person approves them.', 'Mabadiliko yako yatatumwa kwa idhini. Yataanza kutumika mtu mwingine mwenye mamlaka akiyaidhinisha.') }}</p>
        }
        <section class="sec" id="bs-identity">
          <h4><lsms-icon name="storefront" [size]="15" />{{ i18n.t('Business & contact', 'Biashara na mawasiliano') }}</h4>
          <div class="grid">
            <lsms-text-field class="span2" formControlName="businessName" [label]="i18n.t('Business name', 'Jina la biashara')" prefixIcon="business" [required]="true" [maxLength]="120" />
            <lsms-text-field class="span2" formControlName="businessTagline" [label]="i18n.t('Tagline', 'Kauli mbiu')" prefixIcon="format_quote" [maxLength]="120" [hint]="i18n.t('Printed under the name on receipts', 'Huchapishwa chini ya jina kwenye risiti')" />
            <lsms-text-field formControlName="businessPhone" type="tel" [label]="i18n.t('Phone', 'Simu')" prefixIcon="call" placeholder="+255 7xx xxx xxx" />
            <lsms-text-field formControlName="businessEmail" type="email" [label]="i18n.t('Email', 'Barua pepe')" prefixIcon="mail" placeholder="info@biashara.co.tz" />
            <lsms-text-field formControlName="businessAddress" [label]="i18n.t('Address', 'Anwani')" prefixIcon="location_on" placeholder="Kariakoo, Dar es Salaam" />
            <lsms-text-field formControlName="businessWebsite" [label]="i18n.t('Website', 'Tovuti')" prefixIcon="language" />
          </div>
        </section>

        <section class="sec" id="bs-tax">
          <h4><lsms-icon name="gavel" [size]="15" />{{ i18n.t('Tax & registration', 'Kodi na usajili') }}</h4>
          <div class="grid">
            <lsms-text-field formControlName="taxId" label="TIN" prefixIcon="badge" placeholder="123-456-789" />
            <lsms-text-field formControlName="vatNumber" [label]="i18n.t('VAT number (VRN)', 'Namba ya VAT (VRN)')" prefixIcon="receipt" />
            <lsms-text-field class="span2" formControlName="registrationNumber" [label]="i18n.t('Business licence / reg. no.', 'Leseni / namba ya usajili')" prefixIcon="description" />
          </div>
        </section>

        <section class="sec" id="bs-receipt">
          <h4><lsms-icon name="receipt_long" [size]="15" />{{ i18n.t('Receipts', 'Risiti') }}</h4>
          <div class="grid">
            <lsms-text-field class="span2" formControlName="receiptHeader" type="textarea" [rows]="2" [maxLength]="200" [label]="i18n.t('Receipt header', 'Kichwa cha risiti')" [hint]="i18n.t('Shown above the items', 'Huonekana juu ya bidhaa')" />
            <lsms-text-field class="span2" formControlName="receiptFooter" type="textarea" [rows]="2" [maxLength]="200" [label]="i18n.t('Receipt footer', 'Maandishi ya chini ya risiti')" [placeholder]="i18n.t('Thank you for shopping with us', 'Asante kwa kununua kwetu')" />
          </div>
        </section>

        <section class="sec" id="bs-rules">
          <h4><lsms-icon name="tune" [size]="15" />{{ i18n.t('Business rules', 'Kanuni za biashara') }}</h4>
          <div class="grid">
            <lsms-text-field
              formControlName="defaultCreditTermDays"
              type="number"
              [label]="i18n.t('Credit term (days)', 'Muda wa mkopo (siku)')"
              prefixIcon="event_available"
              [placeholder]="'' + creditDefault"
              [hint]="i18n.t('Days a credit sale has before it is overdue. Empty = ' + creditDefault, 'Siku za deni kabla halijachelewa. Wazi = ' + creditDefault)"
            />
            <lsms-text-field
              formControlName="varianceThreshold"
              type="currency"
              [label]="i18n.t('Reconciliation variance threshold', 'Kiwango cha tofauti ya ulinganisho')"
              prefixIcon="rule"
              [hint]="i18n.t('Differences at or above this are flagged', 'Tofauti ya kiasi hiki au zaidi huwekewa alama')"
            />
          </div>
        </section>
        @if (requestMode) {
          <section class="sec">
            <h4><lsms-icon name="chat" [size]="15" />{{ i18n.t('Why this change?', 'Kwa nini badiliko hili?') }}</h4>
            <lsms-text-field formControlName="reason" type="textarea" [rows]="2" [maxLength]="300" [required]="true" [label]="i18n.t('Reason for the approver', 'Sababu kwa atakayeidhinisha')" />
          </section>
        }
      </form>
      <ng-container dialogActions>
        <button lsmsButton="secondary" type="button" (click)="ref.close()">{{ i18n.t('Cancel', 'Ghairi') }}</button>
        <button lsmsButton type="submit" form="bs-form" [icon]="requestMode ? 'send' : 'save'" [loading]="busy()" [disabled]="!dirty()">{{ requestMode ? i18n.t('Send for approval', 'Tuma kwa idhini') : i18n.t('Save changes', 'Hifadhi mabadiliko') }}</button>
      </ng-container>
    </lsms-dialog>
  `,
  styles: `
    form { display: flex; flex-direction: column; gap: 12px; }
    .sec { padding: 12px 14px 6px; border-radius: 14px; background: var(--c-bg); border: 1px solid var(--c-border); scroll-margin-top: 8px; }
    h4 { display: flex; align-items: center; gap: 6px; margin-bottom: 8px; font-size: 0.72rem; font-weight: 800; letter-spacing: 0.8px; text-transform: uppercase; color: var(--c-text-2); lsms-icon { color: var(--c-primary); } }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0 14px; }
    .span2 { grid-column: 1 / -1; }
    @media (max-width: 600px) { .grid { grid-template-columns: 1fr; } }
    .req-note { display: flex; align-items: flex-start; gap: 8px; margin: 0; padding: 10px 12px; border-radius: 12px; font-size: 0.82rem; color: var(--c-text); background: color-mix(in srgb, var(--c-info) 8%, var(--c-bg)); lsms-icon { flex-shrink: 0; color: var(--c-info); } }
  `,
})
export class SettingsFormDialog {
  protected readonly data = inject<SettingsFormData>(DIALOG_DATA);
  protected readonly ref = inject<DialogRef<boolean>>(DialogRef);
  protected readonly i18n = inject(LanguageService);
  private readonly api = inject(BusinessSettingsService);
  private readonly approvals = inject(SettingsApprovalsService);
  private readonly toast = inject(ToastService);
  protected readonly requestMode = this.data.mode === 'request';

  protected readonly creditDefault = DEFAULT_CREDIT_TERM_DAYS;
  protected readonly busy = signal(false);
  private readonly s = this.data.settings;

  protected readonly form = inject(FormBuilder).group({
    businessName: [this.s.businessName, [LsmsValidators.required('Business name'), LsmsValidators.minLength(3, 'Business name'), LsmsValidators.maxLength(120, 'Business name')]],
    businessTagline: [this.s.businessTagline ?? ''],
    businessPhone: [this.s.businessPhone ?? '', [LsmsValidators.phone()]],
    businessEmail: [this.s.businessEmail ?? '', [LsmsValidators.email()]],
    businessAddress: [this.s.businessAddress ?? ''],
    businessWebsite: [this.s.businessWebsite ?? ''],
    taxId: [this.s.taxId ?? '', [Validators.minLength(5)]],
    vatNumber: [this.s.vatNumber ?? ''],
    registrationNumber: [this.s.registrationNumber ?? ''],
    receiptHeader: [this.s.receiptHeader ?? ''],
    receiptFooter: [this.s.receiptFooter ?? ''],
    defaultCreditTermDays: [this.s.defaultCreditTermDays as number | null, [LsmsValidators.integer('Credit term', 1), Validators.max(3650)]],
    varianceThreshold: [this.s.varianceThreshold ?? DEFAULT_VARIANCE_THRESHOLD, [LsmsValidators.currency('Threshold', 0)]],
    reason: ['', this.data.mode === 'request' ? [LsmsValidators.required('Reason'), LsmsValidators.minLength(5, 'Reason')] : []],
  });
  private readonly changes = toSignal(this.form.valueChanges, { initialValue: null });
  protected readonly dirty = computed(() => {
    this.changes();
    return this.form.dirty;
  });

  constructor() {
    const focus = this.data.focus;
    if (focus && focus !== 'identity') setTimeout(() => document.getElementById(`bs-${focus}`)?.scrollIntoView({ block: 'start', behavior: 'smooth' }), 120);
  }

  protected async save(): Promise<void> {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.busy()) return;
    this.busy.set(true);
    try {
      const v = this.form.getRawValue();
      const t = (x: string | null | undefined) => (x ?? '').trim();
      const body: BusinessSettingsUpdate = {
        businessName: t(v.businessName).replace(/\s+/g, ' '),
        businessTagline: t(v.businessTagline),
        businessPhone: t(v.businessPhone).replaceAll(' ', ''),
        businessEmail: t(v.businessEmail),
        businessAddress: t(v.businessAddress),
        businessWebsite: t(v.businessWebsite),
        taxId: t(v.taxId),
        vatNumber: t(v.vatNumber),
        registrationNumber: t(v.registrationNumber),
        receiptHeader: t(v.receiptHeader),
        receiptFooter: t(v.receiptFooter),
        // Empty means "use the default": the backend cannot store null, so send the default itself.
        defaultCreditTermDays: v.defaultCreditTermDays ?? DEFAULT_CREDIT_TERM_DAYS,
        varianceThreshold: v.varianceThreshold ?? DEFAULT_VARIANCE_THRESHOLD,
      };
      if (this.requestMode) {
        await this.sendRequest(body, t(v.reason));
        return;
      }
      await this.api.update(body);
      this.toast.success(this.i18n.t('Business settings saved', 'Mipangilio ya biashara imehifadhiwa'));
      this.ref.close(true);
    } catch (e) {
      this.toast.error(ApiError.from(e).message);
    } finally {
      this.busy.set(false);
    }
  }

  /** Only the fields that really change go into the request (old + new). */
  private async sendRequest(body: BusinessSettingsUpdate, reason: string): Promise<void> {
    const norm = (v: unknown) => (v === null || v === undefined ? '' : String(v));
    const current: BusinessSettingsUpdate = {
      ...this.s,
      defaultCreditTermDays: this.s.defaultCreditTermDays ?? DEFAULT_CREDIT_TERM_DAYS,
      varianceThreshold: this.s.varianceThreshold ?? DEFAULT_VARIANCE_THRESHOLD,
    };
    const before: Record<string, unknown> = {};
    const after: Record<string, unknown> = {};
    for (const key of Object.keys(body) as (keyof BusinessSettingsUpdate)[]) {
      if (norm(body[key]) !== norm(current[key])) {
        before[key] = current[key] ?? '';
        after[key] = body[key];
      }
    }
    const keys = Object.keys(after) as (keyof BusinessSettingsUpdate)[];
    if (!keys.length) {
      this.toast.info(this.i18n.t('Nothing changed', 'Hakuna kilichobadilika'));
      return;
    }
    const sw = this.i18n.isSwahili();
    const description = keys.map((k) => (sw ? SETTINGS_FIELDS[k].sw : SETTINGS_FIELDS[k].en)).join(', ');
    await this.approvals.request(before, after, description, reason, this.s.uid);
    this.toast.success(this.i18n.t('Sent for approval', 'Imetumwa kwa idhini'));
    this.ref.close(true);
  }
}
