import { Directive, ElementRef, OnDestroy, OnInit, inject } from '@angular/core';

import { Money } from '@shared/utils/money';

/**
 * Thousands separators while typing on a plain `<input>` holding money:
 * `10000` shows as `10,000`, `1000000` as `1,000,000`. The caret stays next
 * to the digit the user just typed.
 *
 *   <input lsmsMoneyInput [value]="amountText()" (input)="amountText.set($any($event.target).value)" />
 *
 * The formatted text reaches the page's own (input)/(change) handlers (the
 * capture-phase listener runs first), so parsers must strip commas — every
 * money parser in the app does (`replace(/[^\d.]/g, '')` / Money.parse).
 * Values written through `[value]` are grouped too. Whole shillings only — a
 * typed decimal point is dropped (system rule: money has no decimals).
 */
@Directive({
  selector: 'input[lsmsMoneyInput]',
  host: { inputmode: 'numeric', autocomplete: 'off' },
})
export class MoneyInput implements OnInit, OnDestroy {
  private readonly el = inject<ElementRef<HTMLInputElement>>(ElementRef).nativeElement;
  private readonly onInput = () => this.reformat();

  ngOnInit(): void {
    // Group values set by bindings ([value]="…") as well as typed ones.
    const native = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!;
    Object.defineProperty(this.el, 'value', {
      configurable: true,
      get: () => native.get!.call(this.el),
      set: (v: unknown) => native.set!.call(this.el, Money.group(v as string)),
    });
    this.el.value = native.get!.call(this.el);
    this.el.addEventListener('input', this.onInput, { capture: true });
  }

  ngOnDestroy(): void {
    this.el.removeEventListener('input', this.onInput, { capture: true });
  }

  private reformat(): void {
    const el = this.el;
    const before = el.value;
    const caret = el.selectionStart ?? before.length;
    // Digits left of the caret — where the caret must land again.
    const keep = before.slice(0, caret).replace(/\D/g, '').length;
    el.value = before;
    const after = el.value;
    if (after === before) return;
    let pos = 0;
    for (let seen = 0; pos < after.length && seen < keep; pos++) if (/\d/.test(after[pos])) seen++;
    el.setSelectionRange(pos, pos);
  }
}
