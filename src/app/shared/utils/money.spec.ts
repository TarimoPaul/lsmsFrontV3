import { Money, MoneyPipe } from './money';

describe('Money', () => {
  it('formats whole numbers in full with the currency last', () => {
    expect(Money.format(1234)).toBe('1,234 TZS');
    expect(Money.format(0)).toBe('0 TZS');
    expect(Money.format(null)).toBe('0 TZS');
  });

  it('keeps two decimals for fractional amounts', () => {
    expect(Money.format(1234.5)).toBe('1,234.50 TZS');
    expect(Money.format(1234.567)).toBe('1,234.57 TZS');
  });

  it('honours symbol and explicit decimals', () => {
    expect(Money.format(1234, { symbol: false })).toBe('1,234');
    expect(Money.format(1234, { decimals: 2 })).toBe('1,234.00 TZS');
    expect(Money.format(360475.9, { decimals: 0 })).toBe('360,476 TZS');
  });

  it('formats compact amounts (chart axes)', () => {
    expect(Money.compact(1_250_000)).toBe('1.3M TZS');
    expect(Money.compact(950_000, { symbol: false })).toBe('950K');
  });

  it('parses formatted strings back to numbers', () => {
    expect(Money.parse('1,234.50 TZS')).toBe(1234.5);
    expect(Money.parse('TZS 1,234.50')).toBe(1234.5);
    expect(Money.parse(' 12,000 ')).toBe(12000);
    expect(Money.parse('abc')).toBeNull();
    expect(Money.parse('')).toBeNull();
    expect(Money.parse(null)).toBeNull();
  });

  it('pipe delegates to format / compact', () => {
    const pipe = new MoneyPipe();
    expect(pipe.transform(5000)).toBe('5,000 TZS');
    expect(pipe.transform(5000, { compact: true })).toBe('5K TZS');
  });
});
