import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';

import { LanguageService } from '@core/i18n/language.service';
import { Icon } from '@shared/ui';
import { MoneyPipe } from '@shared/utils/money';
import { CartDraft, DRAFT_TTL_MS, DraftsStore } from './drafts.store';

/** Strip of held orders in the till's cart: tap one to resume it, ✕ to discard; each shows the time left of its 12 hours. */
@Component({
  selector: 'app-held-orders',
  imports: [Icon, MoneyPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p class="head">
      <lsms-icon name="pending_actions" [size]="16" />{{ i18n.t('Held orders', 'Oda zilizohifadhiwa') }}
      <span class="n">{{ drafts().length }}</span>
    </p>
    <div class="list" role="list">
      @for (d of drafts(); track d.id) {
        @let left = leftMs(d);
        <div class="draft" role="listitem" [class.soon]="left < hour">
          <button type="button" class="open" (click)="resume.emit(d)" [title]="i18n.t('Resume this order', 'Endelea na oda hii')">
            <b>{{ d.label }}</b>
            <span class="amt">{{ total(d) | money: { decimals: 0 } }}</span>
            <small>{{ i18n.t(d.lines.length + ' item(s)', 'Bidhaa ' + d.lines.length) }} · {{ when(d.createdAt) }}</small>
            <small class="ttl"><lsms-icon name="timer" [size]="12" />{{ i18n.t('Closes in ' + span(left), 'Inafungwa baada ya ' + span(left)) }}</small>
            @if (d.note) {
              <small class="note" [title]="d.note">{{ d.note }}</small>
            }
          </button>
          <button type="button" class="x" (click)="discard.emit(d)" [attr.aria-label]="i18n.t('Discard', 'Futa')" [title]="i18n.t('Discard', 'Futa')">
            <lsms-icon name="close" [size]="15" />
          </button>
        </div>
      }
    </div>
  `,
  styles: `
    :host { display: block; margin-bottom: 12px; }
    .head { display: flex; align-items: center; gap: 6px; margin: 0 0 6px; font-size: 0.74rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.4px; color: var(--c-text-2); }
    .head lsms-icon { color: var(--c-primary); }
    .n { padding: 0 7px; border-radius: 100px; font-size: 0.7rem; line-height: 1.6; color: #fff; background: var(--c-primary); }
    .list { display: flex; gap: 8px; overflow-x: auto; padding: 2px 2px 6px; scroll-snap-type: x proximity; scrollbar-width: thin; }
    .draft { position: relative; flex: 0 0 172px; scroll-snap-align: start; }
    .open {
      display: flex; flex-direction: column; align-items: flex-start; gap: 1px; width: 100%; height: 100%; padding: 9px 26px 9px 11px;
      border-radius: 12px; border: 1px solid color-mix(in srgb, var(--c-primary) 28%, var(--c-border));
      border-left: 3px solid var(--c-primary); background: color-mix(in srgb, var(--c-primary) 5%, var(--c-surface));
      font: inherit; text-align: left; color: var(--c-text); cursor: pointer; transition: background 0.15s ease, transform 0.08s ease;
    }
    .open:hover { background: color-mix(in srgb, var(--c-primary) 11%, var(--c-surface)); }
    .open:active { transform: scale(0.97); }
    .open b { max-width: 100%; font-size: 0.82rem; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .amt { font-size: 0.8rem; font-weight: 700; font-variant-numeric: tabular-nums; color: var(--c-primary); }
    .open small { max-width: 100%; font-size: 0.7rem; color: var(--c-text-2); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .open .note { font-style: italic; }
    .open .ttl { display: inline-flex; align-items: center; gap: 3px; margin-top: 2px; }
    .soon .open { border-left-color: var(--c-warning); background: color-mix(in srgb, var(--c-warning) 7%, var(--c-surface)); }
    .soon .ttl { color: var(--c-warning); font-weight: 600; }
    .x { position: absolute; top: 5px; right: 5px; display: inline-flex; padding: 2px; border: 0; border-radius: 6px; background: transparent; color: var(--c-text-2); cursor: pointer; }
    .x:hover { color: var(--c-error); background: color-mix(in srgb, var(--c-error) 9%, transparent); }
  `,
})
export class HeldOrders {
  protected readonly i18n = inject(LanguageService);
  readonly drafts = input.required<CartDraft[]>();
  /** Clock (ms) from DraftsStore.now — refreshes the countdowns. */
  readonly now = input.required<number>();
  readonly resume = output<CartDraft>();
  readonly discard = output<CartDraft>();
  protected readonly total = DraftsStore.total;
  protected readonly hour = 3_600_000;

  protected leftMs(d: CartDraft): number {
    // The clock ticks every 30s, so a just-held order could read "12h 1m" — cap it.
    return Math.min(DRAFT_TTL_MS, Math.max(0, DraftsStore.expiresAt(d) - this.now()));
  }

  /** "5h 20m" / "12m". */
  protected span(ms: number): string {
    const m = Math.max(1, Math.ceil(ms / 60_000));
    const h = Math.floor(m / 60);
    return h ? `${h}h ${m % 60}m` : `${m}m`;
  }

  /** "14:32" today, else "22 Sep 14:32". */
  protected when(iso: string): string {
    const d = new Date(iso);
    const loc = this.i18n.isSwahili() ? 'sw-TZ' : 'en-GB';
    const time = d.toLocaleTimeString(loc, { hour: '2-digit', minute: '2-digit' });
    return d.toDateString() === new Date().toDateString() ? time : `${d.toLocaleDateString(loc, { day: 'numeric', month: 'short' })} ${time}`;
  }
}
