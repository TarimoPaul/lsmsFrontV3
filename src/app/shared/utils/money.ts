import { Pipe, PipeTransform } from '@angular/core';

/**
 * Single source of truth for currency formatting — port of Flutter `Money`.
 * Amounts are written in full with the currency LAST (system default since
 * 2026-09-24): `1,234 TZS` (whole) / `1,234.56 TZS`.
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
    return symbol ? `${formatted} ${Money.currencyCode}` : formatted;
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
 * `{{ amount | money }}` → `1,234 TZS`
 * `{{ amount | money: { decimals: 0 } }}` → `360,476 TZS` (cards: whole shillings)
 * `{{ amount | money: { compact: true } }}` → `1.2K TZS` (chart axes only)
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
