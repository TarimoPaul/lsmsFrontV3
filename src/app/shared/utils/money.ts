import { Pipe, PipeTransform } from '@angular/core';

/**
 * Single source of truth for currency formatting — port of Flutter `Money`.
 *
 * System rule (user, 2026-09-28): money is ALWAYS shown as whole shillings —
 * 9,999.99 reads 10,000 — everywhere (screens, CSV, print). Amounts are written
 * in full with the currency LAST: `1,234 TZS`. Stored values (e.g. a cost per
 * piece of 3,833.3333) are not changed; only what people read and type.
 */
export const Money = {
  currencyCode: 'TZS',

  /** Whole shillings, half away from zero (9,999.5 → 10,000; −0.5 → −1). */
  round(amount: number | null | undefined): number {
    const v = Number(amount ?? 0) || 0;
    const r = Math.sign(v) * Math.round(Math.abs(v));
    return r === 0 ? 0 : r; // no "-0"
  },

  /**
   * `1,234 TZS`. `decimals` is accepted for old call sites but ignored — money
   * never shows a fractional part.
   */
  format(amount: number | null | undefined, opts: { symbol?: boolean; decimals?: number } = {}): string {
    const formatted = Money.round(amount).toLocaleString('en-US', { maximumFractionDigits: 0 });
    return opts.symbol === false ? formatted : `${formatted} ${Money.currencyCode}`;
  },

  /** Compact form, e.g. `1.2M TZS` — only for chart axes; cards and lists use `format`. */
  compact(amount: number | null | undefined, opts: { symbol?: boolean } = {}): string {
    const value = Number(amount ?? 0) || 0;
    const formatted = new Intl.NumberFormat('en-US', {
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(value);
    return opts.symbol === false ? formatted : `${formatted} ${Money.currencyCode}`;
  },

  /**
   * Live "as you type" grouping for money inputs: `1000000` → `1,000,000`.
   * Whole shillings only — a decimal point and anything after it are dropped.
   * Returns '' for empty input so placeholders still show.
   */
  group(raw: string | number | null | undefined): string {
    let clean = typeof raw === 'number' ? String(Money.round(raw)) : String(raw ?? '').replace(/[^\d.]/g, '');
    // A pasted / bound "9,999.99" rounds to 10,000; a lone trailing "." (being typed) is just dropped.
    const dot = clean.indexOf('.');
    if (dot >= 0) {
      const frac = clean.slice(dot + 1).replace(/\./g, '');
      clean = frac ? String(Money.round(Number(`${clean.slice(0, dot) || '0'}.${frac}`))) : clean.slice(0, dot);
    }
    const int = clean.replace(/^0+(?=\d)/, '');
    return int.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  },

  /** Parse a formatted currency string back to whole shillings; null on failure. */
  parse(text: string | null | undefined): number | null {
    if (text == null) return null;
    const clean = text.replaceAll(Money.currencyCode, '').replaceAll(',', '').trim();
    if (clean === '') return null;
    const n = Number(clean);
    return Number.isFinite(n) ? Money.round(n) : null;
  },
};

/**
 * `{{ amount | money }}` → `1,234 TZS` (always whole shillings)
 * `{{ amount | money: { symbol: false } }}` → `1,234`
 * `{{ amount | money: { compact: true } }}` → `1.2K TZS` (chart axes only)
 */
@Pipe({ name: 'money' })
export class MoneyPipe implements PipeTransform {
  transform(
    amount: number | null | undefined,
    opts: { symbol?: boolean; decimals?: number; compact?: boolean } = {},
  ): string {
    return opts.compact ? Money.compact(amount, opts) : Money.format(amount, opts);
  }
}
