import { Pipe, PipeTransform } from '@angular/core';

/**
 * Single source of truth for currency formatting — port of Flutter `Money`.
 * Output is byte-compatible: `TZS 1,234` (whole) / `TZS 1,234.56`.
 */
export const Money = {
  currencyCode: 'TZS',

  format(amount: number | null | undefined, opts: { symbol?: boolean; decimals?: number } = {}): string {
    const value = Number(amount ?? 0) || 0;
    const { symbol = true, decimals } = opts;
    const hasDecimals = decimals !== undefined ? decimals > 0 : value % 1 !== 0;
    const digits = hasDecimals ? (decimals ?? 2) : 0;
    const formatted = value.toLocaleString('en-US', {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    });
    return symbol ? `${Money.currencyCode} ${formatted}` : formatted;
  },

  /** Compact form for tight spaces, e.g. `TZS 1.2M`, `TZS 950K`. */
  compact(amount: number | null | undefined, opts: { symbol?: boolean } = {}): string {
    const value = Number(amount ?? 0) || 0;
    const formatted = new Intl.NumberFormat('en-US', {
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(value);
    return opts.symbol === false ? formatted : `${Money.currencyCode} ${formatted}`;
  },

  /** Parse a formatted currency string back to a number; null on failure. */
  parse(text: string | null | undefined): number | null {
    if (text == null) return null;
    const clean = text.replaceAll(Money.currencyCode, '').replaceAll(',', '').trim();
    if (clean === '') return null;
    const n = Number(clean);
    return Number.isFinite(n) ? n : null;
  },
};

/**
 * `{{ amount | money }}` → `TZS 1,234`
 * `{{ amount | money: { compact: true } }}` → `TZS 1.2K`
 * `{{ amount | money: { symbol: false, decimals: 2 } }}` → `1,234.00`
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
