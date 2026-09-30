import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';

import { LanguageService } from '@core/i18n/language.service';
import { Icon } from '@shared/ui';
import { Money } from '@shared/utils/money';
import { BusinessSettings, BusinessSettingsUpdate, SETTINGS_FIELDS } from '../business-settings/business-settings.models';

/**
 * "Field: old → new" list for a settings change. With `current`, a field whose
 * live value no longer matches the request's "old" value is flagged — someone
 * changed it after the request was made.
 */
@Component({
  selector: 'app-change-diff',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ul>
      @for (r of rows(); track r.key) {
        <li>
          <span class="f">{{ r.label }}</span>
          <span class="v">
            <s>{{ r.before }}</s>
            <lsms-icon name="arrow_forward" [size]="14" />
            <b>{{ r.after }}</b>
          </span>
          @if (r.drifted) {
            <small class="drift"><lsms-icon name="info" [size]="13" />{{ i18n.t('Now', 'Sasa') }}: {{ r.now }}</small>
          }
        </li>
      }
    </ul>
  `,
  styles: `
    ul { display: flex; flex-direction: column; gap: 6px; margin: 0; padding: 0; list-style: none; }
    li { display: grid; grid-template-columns: minmax(120px, 180px) 1fr; align-items: baseline; gap: 2px 12px; font-size: 0.84rem; }
    .f { color: var(--c-text-2); }
    .v { display: inline-flex; align-items: center; flex-wrap: wrap; gap: 6px; min-width: 0; overflow-wrap: anywhere; }
    s { color: var(--c-text-2); text-decoration-color: color-mix(in srgb, var(--c-error) 60%, transparent); }
    b { font-weight: 600; color: var(--c-text); }
    lsms-icon { color: var(--c-text-2); flex-shrink: 0; }
    .drift { grid-column: 2; display: inline-flex; align-items: center; gap: 4px; font-size: 0.72rem; color: var(--c-warning); }
    @media (max-width: 520px) { li { grid-template-columns: 1fr; } .drift { grid-column: 1; } }
  `,
})
export class ChangeDiff {
  protected readonly i18n = inject(LanguageService);
  readonly before = input.required<Partial<BusinessSettingsUpdate>>();
  readonly after = input.required<Partial<BusinessSettingsUpdate>>();
  readonly current = input<BusinessSettings | null>(null);

  protected readonly rows = computed(() => {
    const sw = this.i18n.isSwahili();
    const empty = sw ? '(wazi)' : '(empty)';
    const cur = this.current();
    return (Object.keys(this.after()) as (keyof BusinessSettingsUpdate)[]).map((key) => {
      const meta = SETTINGS_FIELDS[key];
      const show = (v: unknown) => (v === null || v === undefined || v === '' ? empty : meta?.money ? Money.format(Number(v)) : String(v));
      const before = this.before()[key];
      const nowRaw = cur ? (cur[key as keyof BusinessSettings] ?? null) : undefined;
      const norm = (v: unknown) => (v === null || v === undefined ? '' : String(v));
      return {
        key,
        label: meta ? (sw ? meta.sw : meta.en) : key,
        before: show(before),
        after: show(this.after()[key]),
        drifted: nowRaw !== undefined && key in this.before() && norm(nowRaw) !== norm(before),
        now: show(nowRaw),
      };
    });
  });
}
