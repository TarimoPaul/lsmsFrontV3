import { ChangeDetectionStrategy, Component, computed, inject, input, linkedSignal } from '@angular/core';

import { ApiError } from '@core/api/api.types';
import { LanguageService } from '@core/i18n/language.service';
import { Button, Icon, ToastService } from '@shared/ui';
import { CountStore } from './count.store';
import { CASHIER_REASONS, CountLine } from './counting.models';
import { VarianceMetrics } from './variance-metrics';

/**
 * The counter explains one variance line after completing (port of Flutter
 * `CountingStarterVarianceRow`): fixed reason chips + optional note. Stays
 * editable after saving (the backend upserts).
 */
@Component({
  selector: 'app-explain-line',
  imports: [VarianceMetrics, Button, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class.ok]': 'explained()' },
  template: `
    <div class="head">
      <span class="no">{{ index() }}</span>
      <b>{{ line().productName }}</b>
      @if (explained()) {
        <span class="pill"><lsms-icon name="check" [size]="13" />{{ i18n.t('Explained', 'Imeelezwa') }}</span>
      }
    </div>
    <app-variance-metrics [line]="line()" />
    <div class="reasons" role="radiogroup" [attr.aria-label]="i18n.t('Reason for the difference', 'Sababu ya tofauti')">
      @for (r of reasons; track r.key) {
        <button type="button" role="radio" [attr.aria-checked]="reason() === r.key" [class.on]="reason() === r.key" [disabled]="busy()" (click)="reason.set(r.key)">{{ i18n.isSwahili() ? r.sw : r.en }}</button>
      }
    </div>
    <div class="note">
      <input type="text" maxlength="300" [value]="note()" (input)="note.set($any($event.target).value)" [disabled]="busy()" [placeholder]="i18n.t('Note (optional)', 'Maelezo (si lazima)')" [attr.aria-label]="i18n.t('Note', 'Maelezo')" />
      <button lsmsButton="primary" size="sm" [loading]="busy()" [disabled]="!reason() || !dirty()" (click)="save()">
        {{ explained() ? i18n.t('Update', 'Sasisha') : i18n.t('Send', 'Tuma') }}
      </button>
    </div>
  `,
  styles: `
    :host { display: flex; flex-direction: column; gap: 10px; padding: 14px; border: 1px solid var(--c-border); border-radius: 14px; background: var(--c-surface); }
    :host(.ok) { border-color: color-mix(in srgb, var(--c-success) 45%, transparent); }
    .head { display: flex; align-items: center; gap: 8px; }
    .head b { flex: 1; font-size: 0.9rem; font-weight: 500; color: var(--c-text); }
    .no { font-size: 0.74rem; color: var(--c-text-2); }
    .pill { display: inline-flex; align-items: center; gap: 3px; padding: 2px 9px; border-radius: 100px; font-size: 0.7rem; font-weight: 600; color: var(--c-success); background: color-mix(in srgb, var(--c-success) 12%, transparent); }
    .reasons { display: flex; flex-wrap: wrap; gap: 6px; }
    .reasons button { padding: 6px 12px; border-radius: 100px; border: 1px solid var(--c-border); background: var(--c-surface); font: inherit; font-size: 0.78rem; font-weight: 500; color: var(--c-text); cursor: pointer; }
    .reasons button.on { border-color: var(--c-primary); background: color-mix(in srgb, var(--c-primary) 12%, var(--c-surface)); color: var(--c-primary); font-weight: 600; }
    .note { display: flex; gap: 8px; }
    .note input { flex: 1; min-width: 0; height: 36px; padding: 0 10px; border: 1px solid var(--c-border); border-radius: 10px; background: var(--c-input-fill); font: inherit; font-size: 0.84rem; color: var(--c-text); outline: 0; }
    .note input:focus { border-color: var(--c-primary); }
  `,
})
export class ExplainLineRow {
  protected readonly i18n = inject(LanguageService);
  private readonly store = inject(CountStore);
  private readonly toast = inject(ToastService);

  readonly line = input.required<CountLine>();
  readonly index = input(0);

  protected readonly reasons = Object.entries(CASHIER_REASONS).map(([key, l]) => ({ key, ...l }));
  protected readonly reason = linkedSignal(() => this.line().cashierReason);
  protected readonly note = linkedSignal(() => this.line().cashierNote ?? '');

  protected readonly explained = computed(() => !!this.line().explainedAt);
  protected readonly busy = computed(() => this.store.explaining().has(this.line().uid));
  protected readonly dirty = computed(
    () => !this.explained() || this.reason() !== this.line().cashierReason || this.note().trim() !== (this.line().cashierNote ?? ''),
  );

  protected async save(): Promise<void> {
    const r = this.reason();
    if (!r) return;
    try {
      await this.store.explain(this.line(), r, this.note());
    } catch (e) {
      this.toast.error(ApiError.from(e).message || this.i18n.t('Could not save the explanation', 'Imeshindwa kuhifadhi maelezo'));
    }
  }
}
