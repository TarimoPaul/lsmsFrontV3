import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';

import { LanguageService } from '@core/i18n/language.service';
import { Button, DialogShell, Icon } from '@shared/ui';
import { Money } from '@shared/utils/money';
import { packUnit } from '@shared/utils/product-label';
import { OrderLine, PACK_WORDS } from './order.models';

export interface OrderPurchasedData {
  lines: OrderLine[];
}

/**
 * "Imenunuliwa": the crates really bought, per product — pre-filled with the order,
 * the buyer corrects what the supplier could not deliver. Closes with line uid → crates.
 * Recording here closes the order; it does NOT create a purchase record.
 */
@Component({
  selector: 'app-order-purchased-dialog',
  imports: [DialogShell, Button, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <lsms-dialog [title]="i18n.t('What was bought?', 'Kilichonunuliwa')" icon="task_alt">
      <p class="hint">
        <lsms-icon name="info" [size]="16" />
        {{ i18n.t('Correct the packages you really bought. This closes the order of today — it does not record a purchase; enter the purchase in Purchases as usual.',
                  'Rekebisha vifurushi ulivyonunua kweli. Hii inafunga oda ya leo — haiingizi manunuzi; ingiza manunuzi kwenye Manunuzi kama kawaida.') }}
      </p>
      <ul>
        @for (l of data.lines; track l.uid) {
          <li [class.zero]="!value(l)">
            <span class="nm"><b>{{ l.displayName }}</b><small>{{ i18n.t('ordered', 'oda') }} {{ l.packs }} {{ unit(l) }} · {{ m(l.packCost) }}/{{ unit(l) }}@if (l.added) { · {{ i18n.t('added', 'imeongezwa') }} }</small></span>
            <span class="step">
              <button type="button" (click)="bump(l, -1)" [disabled]="!value(l)" [attr.aria-label]="i18n.t('Less', 'Punguza')">−</button>
              <input type="number" min="0" max="999" inputmode="numeric" [value]="value(l)" (input)="set(l, $any($event.target).value)" [attr.aria-label]="l.productName" />
              <button type="button" (click)="bump(l, 1)" [attr.aria-label]="i18n.t('More', 'Ongeza')">+</button>
            </span>
            <span class="c">{{ m(value(l) * l.packCost) }}</span>
          </li>
        }
      </ul>
      <p class="sum"><span>{{ packsTotal() }} {{ i18n.t(words.packs[0], words.packs[1]) }}</span><b>{{ m(total()) }}</b></p>
      <ng-container dialogActions>
        <button lsmsButton="secondary" (click)="ref.close()">{{ i18n.t('Cancel', 'Ghairi') }}</button>
        <button lsmsButton icon="task_alt" (click)="ref.close(result())">{{ i18n.t('Close the order', 'Funga oda') }}</button>
      </ng-container>
    </lsms-dialog>
  `,
  styles: `
    .hint { display: flex; gap: 8px; margin: 0 0 10px; padding: 9px 12px; border-radius: 10px; font-size: 0.8rem; color: var(--c-text);
      background: color-mix(in srgb, var(--c-info) 8%, var(--c-surface)); border: 1px solid color-mix(in srgb, var(--c-info) 25%, transparent); lsms-icon { color: var(--c-info); flex-shrink: 0; } }
    ul { display: flex; flex-direction: column; margin: 0; padding: 0; list-style: none; }
    li { display: grid; grid-template-columns: minmax(0, 1fr) auto minmax(96px, auto); align-items: center; gap: 10px; padding: 8px 2px; border-bottom: 1px solid var(--c-border); }
    li.zero .nm b, li.zero .c { color: var(--c-text-2); }
    .nm { display: flex; flex-direction: column; min-width: 0; b { font-size: 0.88rem; font-weight: 600; color: var(--c-text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; } small { font-size: 0.72rem; color: var(--c-text-2); } }
    .step { display: inline-flex; align-items: center; border: 1px solid var(--c-border); border-radius: 10px; overflow: hidden; background: var(--c-surface); }
    .step button { width: 34px; height: 36px; border: 0; background: transparent; font-size: 1.1rem; color: var(--c-text); cursor: pointer; }
    .step button:disabled { color: var(--c-text-2); cursor: default; opacity: 0.5; }
    .step button:hover:not(:disabled) { background: var(--c-bg); }
    .step input { width: 48px; height: 36px; border: 0; border-inline: 1px solid var(--c-border); text-align: center; font: inherit; font-weight: 700; font-variant-numeric: tabular-nums; color: var(--c-text); background: transparent; -moz-appearance: textfield; }
    .step input::-webkit-outer-spin-button, .step input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
    .c { text-align: right; font-size: 0.84rem; font-variant-numeric: tabular-nums; color: var(--c-text); }
    .sum { display: flex; justify-content: space-between; align-items: baseline; margin: 12px 2px 0; font-size: 0.86rem; color: var(--c-text-2); b { font-size: 1.15rem; color: var(--c-text); font-variant-numeric: tabular-nums; } }
  `,
})
export class OrderPurchasedDialog {
  protected readonly data = inject<OrderPurchasedData>(DIALOG_DATA);
  protected readonly ref = inject<DialogRef<{ lineUid: string; packs: number }[]>>(DialogRef);
  protected readonly i18n = inject(LanguageService);

  private readonly packs = signal(new Map(this.data.lines.map((l) => [l.uid, l.packs])));
  protected readonly words = PACK_WORDS;
  protected readonly packsTotal = computed(() => [...this.packs().values()].reduce((a, b) => a + b, 0));

  /** What one package of this line's product is called: crt, ctn… */
  protected unit(l: OrderLine): string {
    return packUnit(l.packageAbbreviation, this.i18n.t(PACK_WORDS.pkg[0], PACK_WORDS.pkg[1]));
  }
  protected readonly total = computed(() => this.data.lines.reduce((a, l) => a + this.value(l) * l.packCost, 0));
  protected readonly result = computed(() => this.data.lines.map((l) => ({ lineUid: l.uid, packs: this.value(l) })));

  protected value(l: OrderLine): number {
    return this.packs().get(l.uid) ?? 0;
  }

  protected set(l: OrderLine, raw: string): void {
    const n = Math.max(0, Math.min(999, Math.floor(Number(raw) || 0)));
    this.packs.update((m) => new Map(m).set(l.uid, n));
  }

  protected bump(l: OrderLine, by: number): void {
    this.set(l, String(this.value(l) + by));
  }

  protected m(v: number): string {
    return Money.format(v, { decimals: 0 });
  }
}
