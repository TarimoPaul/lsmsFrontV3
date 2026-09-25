import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';

import { ApiError } from '@core/api/api.types';
import { LanguageService } from '@core/i18n/language.service';
import { Button, DialogService, DialogShell, Icon, SelectField, SelectOption, TextField, ToastService } from '@shared/ui';
import { MoneyPipe } from '@shared/utils/money';
import { Customer, phoneKey } from './customers.models';
import { CustomersService } from './customers.service';

export interface CustomerMergeData {
  customers: readonly Customer[];
  /** Pre-selected duplicate to fold in (source). */
  source?: Customer;
}

/**
 * Merge two customer records — port of Flutter `CustomerMergeScreen`: pick the
 * duplicate (source) and the record to keep (target), preview what moves,
 * give a reason (required by the backend), confirm. The source's sales,
 * returns, credits and history move to the target; the source is removed.
 */
@Component({
  selector: 'app-customer-merge-dialog',
  imports: [DialogShell, SelectField, TextField, Button, Icon, MoneyPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <lsms-dialog [title]="i18n.t('Merge duplicate customers', 'Unganisha wateja waliojirudia')" icon="merge_type">
      <p class="intro">{{ i18n.t('Everything recorded under the duplicate moves to the customer you keep. The duplicate is then removed.', 'Kila kitu cha nakala kitahamia kwa mteja unayembakiza. Nakala itaondolewa.') }}</p>
      <div class="pick">
        <div class="side">
          <lsms-select-field
            [label]="i18n.t('Duplicate (remove)', 'Nakala (ondoa)')"
            prefixIcon="person_remove"
            [options]="options()"
            [emptyLabel]="i18n.t('Choose…', 'Chagua…')"
            [value]="sourceUid()"
            (valueChange)="sourceUid.set($event)"
          />
          @if (source(); as s) {
            <div class="card src">
              <strong>{{ s.name }}</strong>
              <small>{{ s.phoneNumber || i18n.t('no phone', 'hana simu') }}</small>
              <span>{{ s.salesCount }} {{ i18n.t('sales', 'mauzo') }} · {{ s.totalSpent | money: { decimals: 0 } }}</span>
              @if (s.outstandingBalance > 0) {
                <span class="owe">{{ i18n.t('owes', 'anadaiwa') }} {{ s.outstandingBalance | money }}</span>
              }
            </div>
          }
        </div>
        <lsms-icon class="arrow" name="arrow_forward" [size]="26" />
        <div class="side">
          <lsms-select-field
            [label]="i18n.t('Keep', 'Baki na')"
            prefixIcon="person_check"
            [options]="targetOptions()"
            [emptyLabel]="i18n.t('Choose…', 'Chagua…')"
            [value]="targetUid()"
            (valueChange)="targetUid.set($event)"
          />
          @if (target(); as t) {
            <div class="card dst">
              <strong>{{ t.name }}</strong>
              <small>{{ t.phoneNumber || i18n.t('no phone', 'hana simu') }}</small>
              <span>{{ t.salesCount }} {{ i18n.t('sales', 'mauzo') }} · {{ t.totalSpent | money: { decimals: 0 } }}</span>
              @if (after(); as a) {
                <span class="after">{{ i18n.t('After merge', 'Baada ya kuunganisha') }}: {{ a.sales }} {{ i18n.t('sales', 'mauzo') }} · {{ a.owed | money }} {{ i18n.t('owed', 'deni') }}</span>
              }
            </div>
          }
        </div>
      </div>

      @if (phoneMismatch()) {
        <p class="warn"><lsms-icon name="warning" [size]="16" [filled]="true" />{{ i18n.t('The phone numbers differ — make sure this is really the same person.', 'Namba za simu zinatofautiana — hakikisha ni mtu yule yule.') }}</p>
      }

      <lsms-text-field
        type="textarea"
        [rows]="2"
        [label]="i18n.t('Reason', 'Sababu')"
        [required]="true"
        [maxLength]="255"
        [placeholder]="i18n.t('e.g. Same person registered twice', 'mf. Mtu mmoja amesajiliwa mara mbili')"
        (valueChange)="reason.set($event)"
      />

      <ng-container dialogActions>
        <button lsmsButton="secondary" (click)="ref.close()">{{ i18n.t('Cancel', 'Ghairi') }}</button>
        <button lsmsButton="danger" icon="merge_type" [loading]="busy()" [disabled]="!canMerge()" (click)="merge()">{{ i18n.t('Merge', 'Unganisha') }}</button>
      </ng-container>
    </lsms-dialog>
  `,
  styles: `
    .intro { margin-bottom: 14px; font-size: 0.85rem; color: var(--c-text-2); }
    .pick { display: grid; grid-template-columns: 1fr auto 1fr; gap: 12px; align-items: start; }
    .arrow { margin-top: 36px; color: var(--c-text-2); }
    @media (max-width: 640px) { .pick { grid-template-columns: 1fr; } .arrow { transform: rotate(90deg); margin: 0 auto; } }
    .card { display: flex; flex-direction: column; gap: 2px; padding: 10px 12px; border-radius: 12px; font-size: 0.82rem; background: var(--c-bg); border: 1px solid var(--c-border); }
    .card strong { font-size: 0.92rem; }
    .card small { color: var(--c-text-2); }
    .card.src { border-color: color-mix(in srgb, var(--c-error) 35%, transparent); }
    .card.dst { border-color: color-mix(in srgb, var(--c-success) 35%, transparent); }
    .owe { color: var(--c-error); font-weight: 700; }
    .after { margin-top: 4px; font-weight: 700; color: var(--c-success); }
    .warn { display: flex; align-items: center; gap: 6px; margin: 10px 0; font-size: 0.82rem; color: var(--c-warning); }
  `,
})
export class CustomerMergeDialog {
  protected readonly data = inject<CustomerMergeData>(DIALOG_DATA);
  protected readonly ref = inject<DialogRef<boolean>>(DialogRef);
  protected readonly i18n = inject(LanguageService);
  private readonly api = inject(CustomersService);
  private readonly dialogs = inject(DialogService);
  private readonly toast = inject(ToastService);

  protected readonly sourceUid = signal<string | null>(this.data.source?.uid ?? null);
  protected readonly targetUid = signal<string | null>(null);
  protected readonly reason = signal('');
  protected readonly busy = signal(false);

  private readonly label = (c: Customer) => `${c.name}${c.phoneNumber ? ' · ' + c.phoneNumber : ''}`;
  protected readonly options = computed<SelectOption[]>(() => this.data.customers.map((c) => ({ value: c.uid, label: this.label(c) })));
  protected readonly targetOptions = computed<SelectOption[]>(() => this.options().filter((o) => o.value !== this.sourceUid()));
  protected readonly source = computed(() => this.data.customers.find((c) => c.uid === this.sourceUid()) ?? null);
  protected readonly target = computed(() => this.data.customers.find((c) => c.uid === this.targetUid()) ?? null);
  protected readonly after = computed(() => {
    const s = this.source();
    const t = this.target();
    return s && t ? { sales: s.salesCount + t.salesCount, owed: s.outstandingBalance + t.outstandingBalance } : null;
  });
  protected readonly phoneMismatch = computed(() => {
    const s = phoneKey(this.source()?.phoneNumber);
    const t = phoneKey(this.target()?.phoneNumber);
    return !!s && !!t && s !== t;
  });
  protected readonly canMerge = computed(
    () => !!this.source() && !!this.target() && this.source()!.uid !== this.target()!.uid && this.reason().trim().length >= 5 && !this.busy(),
  );

  protected async merge(): Promise<void> {
    const s = this.source();
    const t = this.target();
    if (!s || !t || !this.canMerge()) return;
    const ok = await this.dialogs.confirmDelete({
      title: this.i18n.t(`Merge ${s.name} into ${t.name}?`, `Unganisha ${s.name} kwa ${t.name}?`),
      message: this.i18n.t(
        `${s.salesCount} sale(s) move to ${t.name} and ${s.name} is removed. This cannot be undone.`,
        `Mauzo ${s.salesCount} yatahamia kwa ${t.name} na ${s.name} ataondolewa. Kitendo hiki hakiwezi kurudishwa.`,
      ),
      confirmText: this.i18n.t('Merge', 'Unganisha'),
    });
    if (!ok) return;
    this.busy.set(true);
    try {
      await this.api.merge(s.uid, t.uid, this.reason().trim());
      this.toast.success(this.i18n.t(`${s.name} merged into ${t.name}`, `${s.name} ameunganishwa na ${t.name}`));
      this.ref.close(true);
    } catch (e) {
      this.toast.error(ApiError.from(e).message);
    } finally {
      this.busy.set(false);
    }
  }
}
