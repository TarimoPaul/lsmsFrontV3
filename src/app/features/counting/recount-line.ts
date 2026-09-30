import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';

import { ApiError } from '@core/api/api.types';
import { LanguageService } from '@core/i18n/language.service';
import { Button, Icon, ToastService } from '@shared/ui';
import { CountStore } from './count.store';
import { RecountLine, formatQty } from './counting.models';
import { QtyInput } from './qty-input';

/**
 * One product in the blind recount round — port of Flutter
 * `CountingRecountLineCard`. Shows ONLY the counter's own first entry (no
 * variance, no system qty, nothing that tells a real variance from padding).
 * Leaving it untouched keeps the first count; a different total needs a
 * reason and an explicit Save.
 */
@Component({
  selector: 'app-recount-line',
  imports: [QtyInput, Button, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class.changed]': 'changed()', '[class.saved]': 'saved()' },
  template: `
    <div class="row">
      <span class="no">{{ index() }}</span>
      <span class="name">
        <b>{{ line().productName }}</b>
        <small>{{ i18n.t('Your first count', 'Ulivyoandika awali') }}: <em>{{ fmt(line().firstCountQty) }}</em></small>
      </span>
      @if (saved()) {
        <lsms-icon class="tick" name="check_circle" [size]="20" />
      }
      <app-qty-input
        [value]="line().firstCountQty"
        [piecesPerPackage]="line().piecesPerPackage"
        [unit]="line().packageAbbreviation"
        [tone]="saved() ? 'done' : changed() ? 'changed' : ''"
        [disabled]="saving()"
        (live)="total.set($event ?? 0)"
      />
    </div>
    @if (changed()) {
      <div class="why">
        <input type="text" maxlength="300" [value]="reason()" (input)="reason.set($any($event.target).value)" [placeholder]="i18n.t('Reason for the change (required)', 'Sababu ya mabadiliko (inahitajika)')" [attr.aria-label]="i18n.t('Reason for the change', 'Sababu ya mabadiliko')" (keydown.enter)="save()" />
        <button lsmsButton="primary" size="sm" [loading]="saving()" [disabled]="!reason().trim()" (click)="save()">
          {{ saved() ? i18n.t('Update', 'Sasisha') : i18n.t('Save recount', 'Hifadhi recount') }}
        </button>
      </div>
    }
  `,
  styles: `
    :host { display: block; padding: 10px 14px; border-bottom: 1px solid var(--c-border); }
    :host(.changed) { background: color-mix(in srgb, var(--c-secondary) 5%, transparent); }
    :host(.saved) { background: color-mix(in srgb, var(--c-success) 5%, transparent); }
    .row { display: grid; grid-template-columns: 30px minmax(0, 1fr) auto auto; align-items: center; gap: 10px; }
    .no { font-size: 0.74rem; color: var(--c-text-2); text-align: right; }
    .name { display: flex; flex-direction: column; min-width: 0; }
    .name b { font-size: 0.86rem; font-weight: 500; color: var(--c-text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .name small { font-size: 0.7rem; color: var(--c-text-2); }
    .name em { font-style: normal; font-weight: 600; color: var(--c-text); }
    .tick { color: var(--c-success); }
    .why { display: flex; gap: 8px; margin: 8px 0 2px 40px; }
    .why input { flex: 1; min-width: 0; height: 36px; padding: 0 10px; border: 1px solid var(--c-border); border-radius: 10px; background: var(--c-input-fill); font: inherit; font-size: 0.84rem; color: var(--c-text); outline: 0; }
    .why input:focus { border-color: var(--c-primary); }
    @media (max-width: 640px) {
      .row { grid-template-columns: minmax(0, 1fr) auto; }
      .no { display: none; }
      app-qty-input { grid-column: 1 / -1; justify-self: end; }
      .why { margin-left: 0; flex-wrap: wrap; }
    }
  `,
})
export class RecountLineRow {
  protected readonly i18n = inject(LanguageService);
  private readonly store = inject(CountStore);
  private readonly toast = inject(ToastService);

  readonly line = input.required<RecountLine>();
  readonly index = input(0);

  protected readonly total = signal<number | null>(null);
  protected readonly reason = signal('');

  private readonly current = computed(() => this.total() ?? this.line().firstCountQty ?? 0);
  protected readonly saving = computed(() => this.store.savingRecount().has(this.line().uid));
  /** The shown total is what this visit saved (cleared the moment the fields move again). */
  protected readonly saved = computed(() => this.store.savedRecount().get(this.line().uid) === this.current());
  protected readonly changed = computed(() => this.current() !== (this.line().firstCountQty ?? 0));

  protected fmt(q: number | null): string {
    const l = this.line();
    return formatQty(q, l.piecesPerPackage, l.packageAbbreviation);
  }

  protected async save(): Promise<void> {
    if (!this.reason().trim() || this.saving()) return;
    try {
      await this.store.recount(this.line(), this.current(), this.reason().trim());
    } catch (e) {
      this.toast.error(ApiError.from(e).message || this.i18n.t('Could not save the recount', 'Imeshindwa kuhifadhi recount'));
    }
  }
}
