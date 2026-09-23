import { Money, MoneyPipe } from './money';

describe('Money', () => {
  it('formats whole numbers without decimals (legacy formatTZSClean)', () => {
    expect(Money.format(1234)).toBe('TZS 1,234');
    expect(Money.format(0)).toBe('TZS 0');
    expect(Money.format(null)).toBe('TZS 0');
  });

  it('keeps two decimals for fractional amounts', () => {
    expect(Money.format(1234.5)).toBe('TZS 1,234.50');
    expect(Money.format(1234.567)).toBe('TZS 1,234.57');
  });

  it('honours symbol and explicit decimals', () => {
    expect(Money.format(1234, { symbol: false })).toBe('1,234');
    expect(Money.format(1234, { decimals: 2 })).toBe('TZS 1,234.00');
  });

  it('formats compact amounts', () => {
    expect(Money.compact(1_250_000)).toBe('TZS 1.3M');
    expect(Money.compact(950_000, { symbol: false })).toBe('950K');
  });

  it('parses formatted strings back to numbers', () => {
    expect(Money.parse('TZS 1,234.50')).toBe(1234.5);
    expect(Money.parse(' 12,000 ')).toBe(12000);
    expect(Money.parse('abc')).toBeNull();
    expect(Money.parse('')).toBeNull();
    expect(Money.parse(null)).toBeNull();
  });

  it('pipe delegates to format / compact', () => {
    const pipe = new MoneyPipe();
    expect(pipe.transform(5000)).toBe('TZS 5,000');
    expect(pipe.transform(5000, { compact: true })).toBe('TZS 5K');
  });
});
