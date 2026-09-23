import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';

import { LanguageService } from '../../../core/i18n/language.service';
import { SelectField, SelectOption } from './select-field';

/** A selectable branch, decoupled from any branch model. */
export interface BranchOption {
  uid: string;
  name: string;
}

/**
 * Presentational branch dropdown — port of `SharedBranchSelector`.
 * `null` = "All branches" when `includeAllOption` is on.
 *
 *   <lsms-branch-selector [branches]="branches()" [selectedUid]="branchUid()" (selectedUidChange)="branchUid.set($event)" />
 */
@Component({
  selector: 'lsms-branch-selector',
  imports: [SelectField],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <lsms-select-field
      [label]="label() ?? ''"
      [ariaLabel]="i18n.t('Branch', 'Tawi')"
      prefixIcon="store"
      [dense]="true"
      [options]="options()"
      [emptyLabel]="includeAllOption() ? (allOptionLabel() ?? i18n.t('All Branches', 'Matawi Yote')) : undefined"
      [value]="selectedUid()"
      [attr.aria-disabled]="!enabled() || null"
      [style.pointer-events]="enabled() ? null : 'none'"
      (valueChange)="selectedUidChange.emit($event)"
    />
  `,
  styles: `:host { display: block; min-width: 180px; }`,
})
export class BranchSelector {
  protected readonly i18n = inject(LanguageService);
  readonly branches = input.required<BranchOption[]>();
  readonly selectedUid = input<string | null>(null);
  readonly label = input<string | undefined>(undefined);
  readonly includeAllOption = input(true);
  readonly allOptionLabel = input<string | undefined>(undefined);
  readonly enabled = input(true);
  readonly selectedUidChange = output<string | null>();

  protected readonly options = computed<SelectOption[]>(() =>
    this.branches().map((b) => ({ value: b.uid, label: b.name })),
  );
}
