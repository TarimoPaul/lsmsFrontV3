import { ChangeDetectionStrategy, Component, ElementRef, computed, effect, inject, input, output, signal, untracked } from '@angular/core';

import { LanguageService } from '@core/i18n/language.service';
import { Icon } from '@shared/ui';

/**
 * PKG + PCS quantity entry with −/+ steppers (port of Flutter's
 * `_SteppedQtyField` pair). Products with more than one piece per package get
 * two fields so "2 crates + 3 loose" needs no mental maths; only the TOTAL
 * piece count ever leaves this component.
 *
 * - `live` fires on every keystroke / step (null while both fields are empty —
 *   "untouched" is never the same as 0).
 * - `commit` fires when focus leaves the whole control, on Enter, or on a step.
 * - The fields re-seed from `value` whenever it changes while not being edited.
 */
@Component({
  selector: 'app-qty-input',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class]': 'tone()', '(focusout)': 'onFocusOut($event)' },
  template: `
    @if (split()) {
      <span class="field">
        <button type="button" tabindex="-1" (click)="step('pkg', -1)" [disabled]="disabled()" [attr.aria-label]="i18n.t('One ' + unitLabel() + ' less', unitLabel() + ' moja pungufu')"><lsms-icon name="remove" [size]="18" /></button>
        <input type="text" inputmode="numeric" class="pkg" [placeholder]="unitLabel()" [value]="pkg()" [disabled]="disabled()" (input)="set('pkg', $any($event.target))" (keydown.enter)="commitNow()" [attr.aria-label]="unitLabel()" />
        <button type="button" tabindex="-1" (click)="step('pkg', 1)" [disabled]="disabled()" [attr.aria-label]="i18n.t('One ' + unitLabel() + ' more', unitLabel() + ' moja zaidi')"><lsms-icon name="add" [size]="18" /></button>
      </span>
      <span class="plus">+</span>
    }
    <span class="field">
      <button type="button" tabindex="-1" (click)="step('pcs', -1)" [disabled]="disabled()" [attr.aria-label]="i18n.t('One piece less', 'Kipande kimoja pungufu')"><lsms-icon name="remove" [size]="18" /></button>
      <input type="text" inputmode="numeric" class="pcs" placeholder="pcs" [value]="pcs()" [disabled]="disabled()" (input)="set('pcs', $any($event.target))" (keydown.enter)="commitNow()" aria-label="pcs" />
      <button type="button" tabindex="-1" (click)="step('pcs', 1)" [disabled]="disabled()" [attr.aria-label]="i18n.t('One piece more', 'Kipande kimoja zaidi')"><lsms-icon name="add" [size]="18" /></button>
    </span>
  `,
  styles: `
    :host { display: inline-flex; align-items: center; gap: 6px; flex-wrap: nowrap; --tone: var(--c-text); --fill: var(--c-input-fill); --ring: var(--c-border); }
    :host(.done) { --tone: var(--c-success); --fill: color-mix(in srgb, var(--c-success) 9%, var(--c-surface)); --ring: color-mix(in srgb, var(--c-success) 40%, transparent); }
    :host(.changed) { --tone: var(--c-secondary); --fill: color-mix(in srgb, var(--c-secondary) 9%, var(--c-surface)); --ring: color-mix(in srgb, var(--c-secondary) 45%, transparent); }
    .field { display: inline-flex; align-items: center; height: 40px; border-radius: 10px; border: 1px solid var(--ring); background: var(--fill); overflow: hidden; transition: border-color 0.15s ease, box-shadow 0.15s ease; }
    .field:focus-within { border-color: var(--c-primary); box-shadow: 0 0 0 3px color-mix(in srgb, var(--c-primary) 16%, transparent); }
    button { display: inline-flex; align-items: center; justify-content: center; width: 36px; height: 100%; border: 0; background: transparent; color: var(--c-text-2); cursor: pointer; }
    button:hover:not(:disabled) { color: var(--c-primary); background: color-mix(in srgb, var(--c-primary) 8%, transparent); }
    button:disabled { opacity: 0.4; cursor: default; }
    input { width: 52px; height: 100%; border: 0; outline: 0; background: transparent; text-align: center; font: inherit; font-size: 0.95rem; font-weight: 600; color: var(--tone); font-variant-numeric: tabular-nums; }
    input::placeholder { font-size: 0.74rem; font-weight: 500; color: var(--c-text-2); opacity: 0.8; }
    .plus { font-size: 0.9rem; color: var(--c-text-2); }
    @media (max-width: 420px) { input { width: 42px; } button { width: 32px; } }
  `,
})
export class QtyInput {
  protected readonly i18n = inject(LanguageService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;

  readonly value = input<number | null>(null);
  readonly piecesPerPackage = input<number | null>(null);
  readonly unit = input<string | null>(null);
  readonly disabled = input(false);
  readonly tone = input<'' | 'done' | 'changed'>('');

  readonly live = output<number | null>();
  readonly commit = output<number | null>();

  protected readonly pkg = signal('');
  protected readonly pcs = signal('');

  protected readonly per = computed(() => Math.max(1, this.piecesPerPackage() ?? 1));
  protected readonly split = computed(() => this.per() > 1);
  protected readonly unitLabel = computed(() => this.unit() || 'pkg');

  /** Null while both fields are empty ("not counted" ≠ 0). */
  readonly total = computed<number | null>(() => {
    if (!this.pkg().trim() && !this.pcs().trim()) return null;
    const pcs = Number(this.pcs()) || 0;
    return this.split() ? (Number(this.pkg()) || 0) * this.per() + pcs : pcs;
  });

  constructor() {
    effect(() => {
      const v = this.value();
      const per = this.per();
      untracked(() => {
        if (this.host.contains(document.activeElement)) return;
        this.seed(v, per);
      });
    });
  }

  /** Put the fields back to `value` (e.g. after "No, that's wrong"). */
  reset(): void {
    this.seed(this.value(), this.per());
    this.host.querySelector<HTMLInputElement>('input.pcs')?.focus();
  }

  protected set(which: 'pkg' | 'pcs', el: HTMLInputElement): void {
    const digits = el.value.replace(/\D/g, '').slice(0, 7);
    if (digits !== el.value) el.value = digits;
    (which === 'pkg' ? this.pkg : this.pcs).set(digits);
    this.live.emit(this.total());
  }

  protected step(which: 'pkg' | 'pcs', delta: number): void {
    const f = which === 'pkg' ? this.pkg : this.pcs;
    const next = (Number(f()) || 0) + delta;
    if (next < 0) return;
    f.set(String(next));
    this.live.emit(this.total());
    this.commit.emit(this.total());
  }

  protected commitNow(): void {
    this.commit.emit(this.total());
  }

  /** Moving between PKG and PCS of the same row is not a "leave". */
  protected onFocusOut(e: FocusEvent): void {
    const next = e.relatedTarget as Node | null;
    if (next && this.host.contains(next)) return;
    this.commit.emit(this.total());
  }

  private seed(v: number | null, per: number): void {
    if (v == null) {
      this.pkg.set('');
      this.pcs.set('');
    } else if (per > 1) {
      this.pkg.set(String(Math.floor(v / per)));
      this.pcs.set(String(v % per));
    } else {
      this.pkg.set('');
      this.pcs.set(String(v));
    }
  }
}
