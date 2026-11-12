import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';

import { LanguageService } from '@core/i18n/language.service';
import { Button, DialogShell, Icon } from '@shared/ui';
import { ProductsService } from '../products/products.service';

/** Kazi 5 (BAADA §2): answer to "Kuna mzigo uliofika leo ambao haujaandikwa?" at the start of a count. */
export interface DeliveryAnswer {
  unrecordedDelivery: boolean;
  productUids: string[];
  note: string | null;
}

/**
 * The required delivery question before a count starts. NO -> count everything. YES -> either enter the purchase
 * first (cancel), or pick the products of that delivery: they are left out of today's count (no difference).
 */
@Component({
  selector: 'app-delivery-question-dialog',
  imports: [DialogShell, Button, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <lsms-dialog [title]="i18n.t('Before counting', 'Kabla ya kuhesabu')" icon="local_shipping">
      <p class="q">{{ i18n.t('Has any delivery arrived today that is not entered yet?', 'Kuna mzigo uliofika leo ambao haujaandikwa?') }}</p>
      <div class="ans" role="radiogroup">
        <button type="button" role="radio" [class.on]="answer() === false" [attr.aria-checked]="answer() === false" (click)="answer.set(false)">
          <lsms-icon name="check_circle" [size]="17" />{{ i18n.t('No', 'Hapana') }}
        </button>
        <button type="button" role="radio" [class.on]="answer() === true" [attr.aria-checked]="answer() === true" (click)="answer.set(true)">
          <lsms-icon name="local_shipping" [size]="17" />{{ i18n.t('Yes', 'Ndiyo') }}
        </button>
      </div>
      @if (answer() === true) {
        <p class="hint"><lsms-icon name="info" [size]="16" />{{ i18n.t(
          'Best: enter the purchase first, then count. Otherwise pick the products of that delivery - they are left out of today\\'s count.',
          'Bora: andika manunuzi kwanza, kisha hesabu. Vinginevyo chagua bidhaa za mzigo huo - hazitahesabiwa leo.') }}</p>
        <input type="search" class="find" [value]="query()" (input)="query.set($any($event.target).value)" [placeholder]="i18n.t('Search product', 'Tafuta bidhaa')" />
        <ul class="pick">
          @for (p of shown(); track p.uid) {
            <li><label><input type="checkbox" [checked]="picked().has(p.uid)" (change)="toggle(p.uid)" />{{ p.displayName || p.productName }}</label></li>
          } @empty {
            <li class="none">{{ i18n.t('No product found', 'Hakuna bidhaa') }}</li>
          }
        </ul>
        <input type="text" maxlength="300" [value]="note()" (input)="note.set($any($event.target).value)" [placeholder]="i18n.t('Note (supplier, invoice) - optional', 'Maelezo (msambazaji, ankara) - hiari')" />
        <small class="cnt">{{ i18n.t('Left out of the count', 'Hazihesabiwi leo') }}: <b>{{ picked().size }}</b></small>
      }
      <ng-container dialogActions>
        <button lsmsButton="secondary" (click)="ref.close()">{{ answer() === true ? i18n.t('Enter the purchase first', 'Nitaandika manunuzi kwanza') : i18n.t('Cancel', 'Ghairi') }}</button>
        <button lsmsButton="primary" icon="play_arrow" [disabled]="answer() === null || (answer() === true && picked().size === 0)" (click)="done()">{{ i18n.t('Start counting', 'Anza kuhesabu') }}</button>
      </ng-container>
    </lsms-dialog>
  `,
  styles: `
    .q { margin: 0 0 10px; font-weight: 600; font-size: 0.95rem; color: var(--c-text); }
    .ans { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 12px; }
    .ans button { display: flex; align-items: center; justify-content: center; gap: 6px; padding: 10px; border: 1px solid var(--c-border); border-radius: 12px; background: var(--c-bg); font: inherit; color: var(--c-text); cursor: pointer; }
    .ans button.on { border-color: var(--c-primary); background: color-mix(in srgb, var(--c-primary) 10%, var(--c-bg)); font-weight: 600; }
    .hint { display: flex; gap: 6px; align-items: flex-start; margin: 0 0 10px; padding: 8px 10px; border-radius: 10px; font-size: 0.8rem; background: color-mix(in srgb, var(--c-info) 8%, var(--c-bg)); color: var(--c-text); }
    .find, input[type='text'] { width: 100%; box-sizing: border-box; padding: 8px 10px; border: 1px solid var(--c-border); border-radius: 10px; background: var(--c-input-fill); font: inherit; font-size: 0.86rem; color: var(--c-text); }
    .pick { list-style: none; margin: 8px 0; padding: 0; max-height: 240px; overflow: auto; border: 1px solid var(--c-border); border-radius: 10px; }
    .pick li { padding: 6px 10px; border-bottom: 1px solid var(--c-border); font-size: 0.85rem; }
    .pick li:last-child { border-bottom: 0; }
    .pick label { display: flex; gap: 8px; align-items: center; cursor: pointer; }
    .pick .none { color: var(--c-text-2); }
    .cnt { display: block; margin-top: 6px; color: var(--c-text-2); }
  `,
})
export class DeliveryQuestionDialog {
  protected readonly ref = inject<DialogRef<DeliveryAnswer>>(DialogRef);
  protected readonly i18n = inject(LanguageService);
  private readonly products = inject(ProductsService);

  protected readonly answer = signal<boolean | null>(null);
  protected readonly query = signal('');
  protected readonly note = signal('');
  protected readonly picked = signal<Set<string>>(new Set());
  private readonly all = signal<{ uid: string; productName: string; displayName: string }[]>([]);

  protected readonly shown = computed(() => {
    const q = this.query().trim().toLowerCase();
    const rows = this.all();
    const hit = q ? rows.filter((p) => (p.displayName || p.productName).toLowerCase().includes(q)) : rows;
    // picked first, then a short list
    return [...hit.filter((p) => this.picked().has(p.uid)), ...hit.filter((p) => !this.picked().has(p.uid))].slice(0, 60);
  });

  constructor() {
    void this.products.catalogue.load().then((list) => this.all.set(list), () => undefined);
  }

  protected toggle(uid: string): void {
    this.picked.update((s) => {
      const n = new Set(s);
      if (n.has(uid)) n.delete(uid);
      else n.add(uid);
      return n;
    });
  }

  protected done(): void {
    const a = this.answer();
    if (a === null) return;
    this.ref.close({
      unrecordedDelivery: a,
      productUids: a ? [...this.picked()] : [],
      note: a && this.note().trim() ? this.note().trim() : null,
    });
  }
}

export interface SecondCountData {
  productName: string;
}

export interface SecondCountResult {
  qty: number;
  note: string | null;
}

/** Kazi 5: a second person's count of one line (large surplus) - the quantity on the shelf NOW, in pieces. */
@Component({
  selector: 'app-second-count-dialog',
  imports: [DialogShell, Button, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <lsms-dialog [title]="i18n.t('Second person count', 'Hesabu ya mtu wa pili')" icon="group">
      <p class="msg"><lsms-icon name="info" [size]="16" />{{ i18n.t(
        'Count this product again now (pieces). You must not be the person who started or did the first count. Sales since the count are taken into account.',
        'Hesabu bidhaa hii tena sasa (vipande). Usiwe uliyeanzisha wala uliyehesabu kwanza. Mauzo ya baada ya kuhesabu yanazingatiwa.') }}</p>
      <p class="name">{{ data.productName }}</p>
      <label><span>{{ i18n.t('Pieces counted now', 'Vipande vilivyopo sasa') }}</span>
        <input type="number" min="0" step="1" inputmode="numeric" [value]="qty() ?? ''" (input)="setQty($any($event.target).value)" autofocus />
      </label>
      <label><span>{{ i18n.t('Note (optional)', 'Maelezo (hiari)') }}</span>
        <input type="text" maxlength="300" [value]="note()" (input)="note.set($any($event.target).value)" />
      </label>
      <ng-container dialogActions>
        <button lsmsButton="secondary" (click)="ref.close()">{{ i18n.t('Cancel', 'Ghairi') }}</button>
        <button lsmsButton="primary" icon="check" [disabled]="qty() === null" (click)="ref.close({ qty: qty()!, note: note().trim() || null })">{{ i18n.t('Save', 'Hifadhi') }}</button>
      </ng-container>
    </lsms-dialog>
  `,
  styles: `
    .msg { display: flex; gap: 6px; align-items: flex-start; margin: 0 0 10px; padding: 8px 10px; border-radius: 10px; font-size: 0.8rem; background: color-mix(in srgb, var(--c-info) 8%, var(--c-bg)); color: var(--c-text); }
    .name { margin: 0 0 10px; font-weight: 600; }
    label { display: flex; flex-direction: column; gap: 4px; margin-bottom: 10px; font-size: 0.78rem; font-weight: 500; color: var(--c-text-2); }
    input { padding: 9px 10px; border: 1px solid var(--c-border); border-radius: 10px; background: var(--c-input-fill); font: inherit; font-size: 0.9rem; color: var(--c-text); }
  `,
})
export class SecondCountDialog {
  protected readonly data = inject<SecondCountData>(DIALOG_DATA);
  protected readonly ref = inject<DialogRef<SecondCountResult>>(DialogRef);
  protected readonly i18n = inject(LanguageService);
  protected readonly qty = signal<number | null>(null);
  protected readonly note = signal('');

  protected setQty(v: string): void {
    const n = Number(v);
    this.qty.set(v !== '' && Number.isInteger(n) && n >= 0 ? n : null);
  }
}
