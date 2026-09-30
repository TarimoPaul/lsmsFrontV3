import { Money, MoneyPipe } from './money';

describe('Money', () => {
  it('formats whole numbers in full with the currency last', () => {
    expect(Money.format(1234)).toBe('1,234 TZS');
    expect(Money.format(0)).toBe('0 TZS');
    expect(Money.format(null)).toBe('0 TZS');
  });

  it('always shows whole shillings (system rule)', () => {
    expect(Money.format(9999.99)).toBe('10,000 TZS');
    expect(Money.format(1234.5)).toBe('1,235 TZS');
    expect(Money.format(1234.49)).toBe('1,234 TZS');
    expect(Money.format(3833.3333, { symbol: false })).toBe('3,833');
    expect(Money.format(-0.4)).toBe('0 TZS');
    expect(Money.format(-1234.5)).toBe('-1,235 TZS');
  });

  it('honours symbol; decimals option is ignored', () => {
    expect(Money.format(1234, { symbol: false })).toBe('1,234');
    expect(Money.format(1234, { decimals: 2 })).toBe('1,234 TZS');
    expect(Money.format(360475.9, { decimals: 0 })).toBe('360,476 TZS');
  });

  it('rounds half away from zero', () => {
    expect(Money.round(0.5)).toBe(1);
    expect(Money.round(-0.5)).toBe(-1);
    expect(Money.round(null)).toBe(0);
  });

  it('formats compact amounts (chart axes)', () => {
    expect(Money.compact(1_250_000)).toBe('1.3M TZS');
    expect(Money.compact(950_000, { symbol: false })).toBe('950K');
  });

  it('parses formatted strings back to numbers', () => {
    expect(Money.parse('1,234.50 TZS')).toBe(1235);
    expect(Money.parse('TZS 1,234.40')).toBe(1234);
    expect(Money.parse(' 12,000 ')).toBe(12000);
    expect(Money.parse('abc')).toBeNull();
    expect(Money.parse('')).toBeNull();
    expect(Money.parse(null)).toBeNull();
  });

  it('groups money input while typing', () => {
    expect(Money.group('5000')).toBe('5,000');
    expect(Money.group('10000')).toBe('10,000');
    expect(Money.group('100000')).toBe('100,000');
    expect(Money.group('1000000')).toBe('1,000,000');
    expect(Money.group('1,0000')).toBe('10,000');
    expect(Money.group('00500')).toBe('500');
    expect(Money.group('1234.567')).toBe('1,235');
    expect(Money.group('9,999.99')).toBe('10,000');
    expect(Money.group('1234.')).toBe('1,234');
    expect(Money.group('.4')).toBe('0');
    expect(Money.group(9999.99)).toBe('10,000');
    expect(Money.group('12a3')).toBe('123');
    expect(Money.group('')).toBe('');
    expect(Money.group(null)).toBe('');
    expect(Money.group(25000)).toBe('25,000');
  });

  it('pipe delegates to format / compact', () => {
    const pipe = new MoneyPipe();
    expect(pipe.transform(5000)).toBe('5,000 TZS');
    expect(pipe.transform(5000, { compact: true })).toBe('5K TZS');
  });
});
