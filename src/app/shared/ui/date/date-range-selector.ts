import { CdkMenu, CdkMenuItem, CdkMenuTrigger } from '@angular/cdk/menu';
import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';

import { LanguageService } from '../../../core/i18n/language.service';
import { DateRange, DateRangePreset, formatRangeLabel, rangeForPreset } from '../../utils/date-utils';
import { DialogService } from '../dialog/dialog.service';
import { Icon } from '../icon/icon';
import { DatePickerDialog, DatePickerDialogData } from './date-picker-dialog';

interface PresetItem {
  preset: DateRangePreset;
  icon: string;
  en: string;
  sw: string;
}

const PRESETS: PresetItem[] = [
  { preset: 'today', icon: 'today', en: 'Today', sw: 'Leo' },
  { preset: 'yesterday', icon: 'history', en: 'Yesterday', sw: 'Jana' },
  { preset: 'thisWeek', icon: 'view_week', en: 'This Week', sw: 'Wiki Hii' },
  { preset: 'thisMonth', icon: 'calendar_month', en: 'This Month', sw: 'Mwezi Huu' },
  { preset: 'thisYear', icon: 'event', en: 'This Year', sw: 'Mwaka Huu' },
];

/**
 * One tappable date-range control with quick presets — port of
 * `DateRangeSelector`. Opens a menu (Leo / Jana / Wiki Hii / Mwezi Huu /
 * Mwaka Huu / Chagua tarehe…); "custom" launches the compact range picker.
 * Emits the chosen range with `end` normalised to 23:59:59.
 *
 *   <lsms-date-range-selector [range]="range()" (rangeChange)="range.set($event)" />
 */
@Component({
  selector: 'lsms-date-range-selector',
  imports: [CdkMenuTrigger, CdkMenu, CdkMenuItem, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      type="button"
      class="trigger"
      [class.icon-only]="iconOnly()"
      [cdkMenuTriggerFor]="menu"
      [attr.aria-label]="i18n.t('Filter by date', 'Chuja kwa tarehe') + ': ' + label()"
      [title]="label()"
    >
      <lsms-icon name="date_range" [size]="iconOnly() ? 20 : 18" class="lead" />
      @if (!iconOnly()) {
        <span class="text">{{ label() }}</span>
        <lsms-icon name="expand_more" [size]="18" class="chev" />
      }
    </button>

    <ng-template #menu>
      <div class="lsms-menu" cdkMenu>
        <div class="menu-title">
          <lsms-icon name="filter_alt" [size]="18" />
          {{ i18n.t('Filter by Date', 'Chuja kwa Tarehe') }}
        </div>
        @for (p of presets; track p.preset) {
          <button type="button" class="lsms-menu-item" cdkMenuItem (cdkMenuItemTriggered)="pick(p.preset)">
            <lsms-icon [name]="p.icon" [size]="20" style="color: var(--c-primary)" />
            {{ i18n.isSwahili() ? p.sw : p.en }}
          </button>
        }
        <hr />
        <button type="button" class="lsms-menu-item" cdkMenuItem (cdkMenuItemTriggered)="pickCustom()">
          <lsms-icon name="edit_calendar" [size]="20" style="color: var(--c-primary)" />
          {{ i18n.t('Pick dates…', 'Chagua tarehe…') }}
        </button>
      </div>
    </ng-template>
  `,
  styles: `
    @use 'typography' as t;
    :host { display: inline-flex; min-width: 0; }
    .trigger {
      display: inline-flex; align-items: center; gap: 8px; min-width: 0;
      height: 40px; padding: 0 12px;
      border: 1px solid var(--c-border); border-radius: 8px;
      background: var(--c-surface); color: var(--c-text); cursor: pointer;
    }
    .trigger:hover { border-color: var(--c-primary); }
    .trigger.icon-only { width: 40px; padding: 0; justify-content: center; }
    .lead { color: var(--c-primary); }
    .chev { color: var(--c-text-2); }
    .text { @include t.body-sm; @include t.ellipsis; font-weight: 600; color: var(--c-text); }
    .menu-title {
      display: flex; align-items: center; gap: 8px;
      padding: 10px 16px 6px; @include t.body; font-weight: 600; color: var(--c-text);
    }
    .menu-title lsms-icon { color: var(--c-primary); }
    hr { border: 0; border-top: 1px solid var(--c-divider); margin: 4px 0; }
  `,
})
export class DateRangeSelector {
  protected readonly i18n = inject(LanguageService);
  private readonly dialogs = inject(DialogService);

  readonly range = input.required<DateRange>();
  /** Earliest selectable date (e.g. business start date). */
  readonly min = input<Date | undefined>(undefined);
  /** Latest selectable date; defaults to today. */
  readonly max = input<Date | undefined>(undefined);
  /** Compact square calendar button for tight mobile rows. */
  readonly iconOnly = input(false);
  readonly rangeChange = output<DateRange>();

  protected readonly presets = PRESETS;
  protected readonly label = computed(() => formatRangeLabel(this.range()));

  protected pick(preset: DateRangePreset): void {
    if (preset !== 'custom') this.rangeChange.emit(rangeForPreset(preset));
  }

  protected async pickCustom(): Promise<void> {
    const r = this.range();
    const picked = await this.dialogs.openAsync<DateRange, DatePickerDialogData>(DatePickerDialog, {
      size: 'sm',
      data: {
        mode: 'range',
        start: r.start,
        end: r.end,
        min: this.min(),
        max: this.max(),
        helpText: this.i18n.t('Select Range', 'Chagua Kipindi'),
      },
    });
    if (picked) this.rangeChange.emit(picked);
  }
}
