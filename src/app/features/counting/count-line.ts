import { ChangeDetectionStrategy, Component, computed, inject, input, signal, viewChild } from '@angular/core';

import { ApiError } from '@core/api/api.types';
import { LanguageService } from '@core/i18n/language.service';
import { Icon, Spinner, ToastService } from '@shared/ui';
import { CountStore } from './count.store';
import { CountLine, formatQty } from './counting.models';
import { QtyInput } from './qty-input';

/** Typo guard when a product has no count history (Flutter `_defaultTypoThreshold`). */
const DEFAULT_TYPO = 500;

/**
 * One product in the count list — port of Flutter `CountingLineCard`.
 * Saves on leaving the row / Enter / a step (the backend upserts, so editing
 * a counted line is normal). Untouched rows are never sent (NULL ≠ 0). A total
 * above the product's typo threshold asks "is that right?" before saving.
 * The system quantity appears only if the backend sent it (sighted count).
 */
@Component({
  selector: 'app-count-line',
  imports: [QtyInput, Icon, Spinner],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class.done]': 'counted()', '[class.confirming]': 'pending() !== null' },
  template: `
    <div class="row">
      <span class="no">{{ index() }}</span>
      <span class="st" [attr.aria-label]="counted() ? i18n.t('Counted', 'Imehesabiwa') : i18n.t('Not counted', 'Haijahesabiwa')">
        @if (saving()) {
          <lsms-spinner [size]="16" />
        } @else {
          <lsms-icon [name]="counted() ? 'check' : 'inventory_2'" [size]="17" />
        }
      </span>
      <span class="name">
        <b>{{ line().productName }}</b>
        <small>
          @if (category()) { {{ category() }} }
          @if ((line().piecesPerPackage ?? 1) > 1) { @if (category()) { · } {{ line().piecesPerPackage }} pcs/{{ line().packageAbbreviation || 'pkg' }} }
          @if (line().systemQtySnapshot !== null) { <em class="sys">{{ i18n.t('System', 'Mfumo') }}: {{ fmt(line().systemQtySnapshot) }}</em> }
        </small>
      </span>
      <span class="qty">
        <app-qty-input
          #qty
          [value]="line().countedQty"
          [piecesPerPackage]="line().piecesPerPackage"
          [unit]="line().packageAbbreviation"
          [tone]="counted() ? 'done' : ''"
          (live)="live.set($event)"
          (commit)="commit($event)"
        />
        @if (hint(); as h) {
          <small class="hint">{{ h }}</small>
        }
      </span>
    </div>
    @if (pending(); as p) {
      <div class="confirm" role="alert">
        <lsms-icon name="warning" [size]="17" />
        <span>{{ i18n.t('Total is ' + p + ' pcs (' + fmt(p) + '). Is that right?', 'Jumla ni vipande ' + p + ' (' + fmt(p) + '). Ni sahihi?') }}</span>
        <button type="button" class="no-btn" (click)="cancel()">{{ i18n.t('No', 'Hapana') }}</button>
        <button type="button" class="yes-btn" (click)="confirm()">{{ i18n.t('Yes, save', 'Ndiyo, hifadhi') }}</button>
      </div>
    }
  `,
  styles: `
    :host { display: block; padding: 10px 14px; border-bottom: 1px solid var(--c-border); transition: background-color 0.2s ease; }
    :host(.done) { background: color-mix(in srgb, var(--c-success) 4%, transparent); }
    :host(.confirming) { background: color-mix(in srgb, var(--c-warning) 6%, transparent); }
    .row { display: grid; grid-template-columns: 30px 32px minmax(0, 1fr) auto; align-items: center; gap: 10px; }
    .no { font-size: 0.74rem; color: var(--c-text-2); text-align: right; font-variant-numeric: tabular-nums; }
    .st { display: inline-flex; align-items: center; justify-content: center; width: 32px; height: 32px; border-radius: 50%; color: var(--c-text-2); background: color-mix(in srgb, var(--c-text-2) 10%, transparent); }
    :host(.done) .st { color: var(--c-success); background: color-mix(in srgb, var(--c-success) 14%, transparent); }
    .name { display: flex; flex-direction: column; min-width: 0; }
    .name b { font-size: 0.86rem; font-weight: 500; color: var(--c-text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .name small { font-size: 0.7rem; color: var(--c-text-2); }
    .sys { margin-left: 6px; padding: 1px 7px; border-radius: 100px; font-style: normal; font-weight: 600; color: var(--c-info); background: color-mix(in srgb, var(--c-info) 12%, transparent); }
    .qty { display: flex; flex-direction: column; align-items: flex-end; gap: 3px; }
    .hint { font-size: 0.7rem; font-style: italic; color: var(--c-text-2); }
    .confirm { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; margin: 8px 0 2px 72px; padding: 8px 10px; border-radius: 10px; font-size: 0.8rem; color: var(--c-text); background: color-mix(in srgb, var(--c-warning) 10%, var(--c-surface)); border: 1px solid color-mix(in srgb, var(--c-warning) 35%, transparent); }
    .confirm lsms-icon { color: var(--c-warning); }
    .confirm span { flex: 1; min-width: 160px; }
    .confirm button { padding: 5px 12px; border-radius: 8px; border: 1px solid var(--c-border); background: var(--c-surface); font: inherit; font-size: 0.78rem; font-weight: 600; color: var(--c-text); cursor: pointer; }
    .confirm .yes-btn { border-color: var(--c-warning); background: var(--c-warning); color: #fff; }
    @media (max-width: 640px) {
      .row { grid-template-columns: 32px minmax(0, 1fr); row-gap: 8px; }
      .no { display: none; }
      .qty { grid-column: 1 / -1; align-items: flex-end; }
      .confirm { margin-left: 0; }
    }
  `,
})
export class CountLineRow {
  protected readonly i18n = inject(LanguageService);
  private readonly store = inject(CountStore);
  private readonly toast = inject(ToastService);

  readonly line = input.required<CountLine>();
  readonly index = input(0);

  private readonly qtyInput = viewChild.required<QtyInput>('qty');

  protected readonly live = signal<number | null>(null);
  protected readonly pending = signal<number | null>(null);

  protected readonly counted = computed(() => this.line().countedQty != null);
  protected readonly saving = computed(() => this.store.saving().has(this.line().uid));
  protected readonly category = computed(() => this.store.categoryName(this.line().productUid));

  /** "= 1 ctn, 7 pcs — total 31" while typing a split product (display only). */
  protected readonly hint = computed(() => {
    const l = this.line();
    const t = this.live();
    if (t == null || (l.piecesPerPackage ?? 1) <= 1) return null;
    return `= ${formatQty(t, l.piecesPerPackage, l.packageAbbreviation)} — ${this.i18n.t('total', 'jumla')} ${t}`;
  });

  protected fmt(q: number | null): string {
    const l = this.line();
    return formatQty(q, l.piecesPerPackage, l.packageAbbreviation);
  }

  protected commit(total: number | null): void {
    if (total == null || total === this.line().countedQty) return;
    const limit = this.line().typoThreshold ?? DEFAULT_TYPO;
    if (total > limit && this.pending() !== total) {
      this.pending.set(total);
      return;
    }
    this.pending.set(null);
    void this.save(total);
  }

  protected confirm(): void {
    const v = this.pending();
    this.pending.set(null);
    if (v != null) void this.save(v);
  }

  protected cancel(): void {
    this.pending.set(null);
    this.live.set(null);
    this.qtyInput().reset();
  }

  /**
   * One request per line at a time. Enter + blur, or quick −/+ taps, used to fire
   * overlapping saves for the same line → the server's optimistic lock rejected all
   * but one ("Imeshindikana kuhifadhi hesabu"). A value arriving while a save is in
   * flight waits; only the latest is sent afterwards (and only if it still differs).
   */
  private inFlight = false;
  private queued: number | null = null;

  private async save(total: number): Promise<void> {
    if (this.inFlight) {
      this.queued = total;
      return;
    }
    this.inFlight = true;
    try {
      await this.store.submit(this.line(), total);
      this.live.set(null);
    } catch (e) {
      this.toast.error(ApiError.from(e).message || this.i18n.t('Could not save the count', 'Imeshindwa kuhifadhi hesabu'));
    } finally {
      this.inFlight = false;
    }
    const next = this.queued;
    this.queued = null;
    if (next != null && next !== this.line().countedQty) void this.save(next);
  }
}
